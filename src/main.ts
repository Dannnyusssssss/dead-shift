import './ui/ui.css';
import { createCamera, updateCamera } from './core/camera';
import { createInput } from './core/input';
import { createFixedLoop, createFrameStats } from './core/loop';
import { vec2 } from './core/math';
import { PROGRESSION } from './data/progression';
import { SHIFT } from './data/shift';
import {
  CAMERA_FOLLOW_RATE,
  FAINT,
  JOYSTICK,
  PARTICLES,
  VICTORY_SCREEN_DELAY,
} from './data/render';
import { t } from './data/texts';
import { WEAPON_IDS } from './data/weapons';
import { interpolatedPlayerPos } from './game/player';
import { chooseOffer, levelBeingChosen, rerollOffers } from './game/progression';
import { shiftClock } from './game/shift';
import { fastForward, spawnHorde, spawnRadiusForView } from './game/spawner';
import { createWeapon } from './game/weapons';
import { createWorld, updateWorld, type World } from './game/world';
import { createParticles } from './render/particles';
import { createRenderer, type RenderFrame } from './render/renderer';
import { describeOffer } from './ui/describe';
import { createLevelUpScreen } from './ui/levelup';
import { createEndScreen } from './ui/menu';

/**
 * Debug switches from the URL: `?spawn=300` starts with a horde, `?god` disables death,
 * `?weapons=all` starts with every weapon at max level (ignores the slot limit),
 * `?t=540` starts the shift clock at that many seconds.
 */
interface DebugOptions {
  enabled: boolean;
  spawn: number;
  god: boolean;
  allWeapons: boolean;
  startTime: number;
}

function readDebugOptions(search: string): DebugOptions {
  const params = new URLSearchParams(search);
  const num = (key: string): number => Math.max(0, Number(params.get(key) ?? 0) || 0);
  const spawn = Math.floor(num('spawn'));
  const startTime = Math.min(num('t'), SHIFT.durationSeconds - 1);
  const god = params.has('god');
  const allWeapons = params.get('weapons') === 'all';
  const enabled = spawn > 0 || god || allWeapons || startTime > 0 || params.has('debug');
  return { enabled, spawn, god, allWeapons, startTime };
}

function boot(): void {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Falta el <canvas id="game">');
  document.title = t('gameTitle');

  const debug = readDebugOptions(window.location.search);
  const input = createInput(canvas, JOYSTICK);
  const renderer = createRenderer(canvas);
  const particles = createParticles();
  const stats = createFrameStats();
  const endScreen = createEndScreen(document.body);
  const levelUp = createLevelUpScreen(document.body);
  const playerPos = vec2();

  const newWorld = (): World => {
    const w = createWorld(Date.now() >>> 0);
    w.player.invincible = debug.god;
    if (debug.allWeapons) {
      w.player.weapons = WEAPON_IDS.map((id) => {
        const weapon = createWeapon(id);
        weapon.level = PROGRESSION.maxLevel;
        return weapon;
      });
    }
    if (debug.startTime > 0) fastForward(w, debug.startTime);
    if (debug.spawn > 0) spawnHorde(w, debug.spawn);
    return w;
  };

  let world = newWorld();
  /** Real seconds since dawn, driving the fainting animation and the victory screen. */
  let sinceDawn = 0;
  const camera = createCamera(world.player.pos, CAMERA_FOLLOW_RATE);
  const frame: RenderFrame = {
    world,
    camera,
    playerPos,
    alpha: 0,
    input,
    particles,
    debug: { fps: 0, cpuMs: 0 },
    faint: 0,
  };

  const restart = (): void => {
    endScreen.hide();
    levelUp.hide();
    world = newWorld();
    frame.world = world;
    frame.faint = 0;
    sinceDawn = 0;
    particles.clear();
    camera.x = world.player.pos.x;
    camera.y = world.player.pos.y;
  };

  const showLevelUp = (): void => {
    if (world.status !== 'levelup') {
      levelUp.hide();
      return;
    }
    levelUp.show(
      {
        source: world.offerSource,
        level: levelBeingChosen(world.player),
        offers: world.offers.map((o) => describeOffer(o, world.player)),
        rerollsLeft: world.rerollsLeft,
      },
      {
        onChoose: (i) => {
          chooseOffer(world, i);
          showLevelUp();
        },
        onReroll: () => {
          if (rerollOffers(world)) showLevelUp();
        },
      },
    );
  };

  const runStats = () => ({
    timeSurvived: world.time,
    kills: world.kills,
    level: world.player.level,
    clock: shiftClock(world.time),
  });

  /** Turns gameplay events into cosmetic effects, then empties the queue. */
  const drainEvents = (): void => {
    const events = world.events;
    for (let i = 0; i < events.count; i++) {
      const ev = events.items[i];
      if (!ev) continue;
      switch (ev.type) {
        case 'enemyDeath':
          particles.burst(ev.x, ev.y, ev.color, PARTICLES.death);
          break;
        case 'playerHit':
          particles.burst(ev.x, ev.y, PARTICLES.hitColor, PARTICLES.hit);
          break;
        case 'explosion':
          particles.burst(ev.x, ev.y, PARTICLES.explosionColor, PARTICLES.explosion);
          break;
      }
    }
    events.clear();
  };

  /** UI that reacts to the run's status (level-up, dawn, death). */
  const syncScreens = (frameDt: number): void => {
    if (world.status === 'levelup' && !levelUp.visible) showLevelUp();
    if (world.status === 'won') {
      sinceDawn += frameDt;
      frame.faint = Math.min(1, sinceDawn / FAINT.duration);
      if (sinceDawn >= VICTORY_SCREEN_DELAY && !endScreen.visible) {
        endScreen.show('victory', runStats(), restart);
      }
    }
    if (world.status === 'dead' && !endScreen.visible) {
      endScreen.show('defeat', runStats(), restart);
    }
  };

  let lastStatsPublish = 0;
  let frameStart = 0;

  const loop = createFixedLoop({
    update(dt) {
      if (frameStart === 0) frameStart = performance.now();
      world.spawnRadius = spawnRadiusForView(renderer.viewW, renderer.viewH);
      input.getMoveAxis(world.moveInput);
      updateWorld(world, dt);
    },
    render(alpha, frameDt) {
      if (frameStart === 0) frameStart = performance.now();
      drainEvents();
      particles.update(frameDt);
      interpolatedPlayerPos(world.player, alpha, playerPos);
      updateCamera(camera, playerPos.x, playerPos.y, frameDt);
      frame.alpha = alpha;
      syncScreens(frameDt);
      renderer.render(frame);

      stats.tick(frameDt, performance.now() - frameStart);
      frameStart = 0;
      frame.debug.fps = stats.fps;
      frame.debug.cpuMs = stats.cpuMs;
      const now = performance.now();
      if (debug.enabled && now - lastStatsPublish >= 500) {
        // Exposed for automated checks (headless browser).
        lastStatsPublish = now;
        const ds = document.body.dataset;
        ds.fps = String(stats.fps);
        ds.cpu = stats.cpuMs.toFixed(2);
        ds.enemies = String(world.enemies.count);
        ds.kills = String(world.kills);
        ds.level = String(world.player.level);
        ds.status = world.status;
        ds.time = world.time.toFixed(1);
        ds.clock = shiftClock(world.time);
        ds.loadout = [
          ...world.player.weapons.map((w) => `${w.def.id}:${w.level}`),
          ...world.player.passives.map((p) => `${p.def.id}:${p.level}`),
        ].join(',');
        const kinds: Record<string, number> = {};
        for (let i = 0; i < world.enemies.count; i++) {
          const e = world.enemies.items[i];
          const id = e?.def.id ?? '?';
          kinds[id] = (kinds[id] ?? 0) + 1;
          if (e?.def.behavior.kind === 'charge' && e.aiState === 1) {
            kinds.aiming = (kinds.aiming ?? 0) + 1;
          }
        }
        ds.kinds = JSON.stringify(kinds);
        ds.hazards = String(world.hazards.count);
        const hazardKinds: Record<string, number> = {};
        for (let i = 0; i < world.hazards.count; i++) {
          const kind = world.hazards.items[i]?.kind ?? '?';
          hazardKinds[kind] = (hazardKinds[kind] ?? 0) + 1;
        }
        ds.hazardKinds = JSON.stringify(hazardKinds);
        ds.chests = String(world.chests.count);
      }
    },
  });
  loop.start();
}

boot();
