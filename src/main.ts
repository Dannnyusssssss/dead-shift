import './ui/ui.css';
import { createCamera, updateCamera } from './core/camera';
import { createInput } from './core/input';
import { createFixedLoop, createFrameStats } from './core/loop';
import { vec2 } from './core/math';
import { PROGRESSION } from './data/progression';
import { CAMERA_FOLLOW_RATE, JOYSTICK, PARTICLES } from './data/render';
import { t } from './data/texts';
import { WEAPON_IDS } from './data/weapons';
import { interpolatedPlayerPos } from './game/player';
import { chooseOffer, levelBeingChosen, rerollOffers } from './game/progression';
import { spawnHorde, spawnRadiusForView } from './game/spawner';
import { createWeapon } from './game/weapons';
import { createWorld, updateWorld, type World } from './game/world';
import { createParticles } from './render/particles';
import { createRenderer, type RenderFrame } from './render/renderer';
import { describeOffer } from './ui/describe';
import { createLevelUpScreen } from './ui/levelup';
import { createGameOverScreen } from './ui/menu';

/**
 * Debug switches from the URL: `?spawn=300` starts with a horde, `?god` disables death,
 * `?weapons=all` starts with every weapon at max level (ignores the slot limit).
 */
interface DebugOptions {
  enabled: boolean;
  spawn: number;
  god: boolean;
  allWeapons: boolean;
}

function readDebugOptions(search: string): DebugOptions {
  const params = new URLSearchParams(search);
  const spawn = Math.max(0, Math.floor(Number(params.get('spawn') ?? 0)) || 0);
  const god = params.has('god');
  const allWeapons = params.get('weapons') === 'all';
  return { enabled: spawn > 0 || god || allWeapons || params.has('debug'), spawn, god, allWeapons };
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
  const gameOver = createGameOverScreen(document.body);
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
    if (debug.spawn > 0) spawnHorde(w, debug.spawn);
    return w;
  };

  let world = newWorld();
  const camera = createCamera(world.player.pos, CAMERA_FOLLOW_RATE);
  const frame: RenderFrame = {
    world,
    camera,
    playerPos,
    alpha: 0,
    input,
    particles,
    debug: { fps: 0, cpuMs: 0 },
  };

  const restart = (): void => {
    gameOver.hide();
    levelUp.hide();
    world = newWorld();
    frame.world = world;
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

  /** Turns gameplay events into cosmetic effects, then empties the queue. */
  const drainEvents = (): void => {
    const events = world.events;
    for (let i = 0; i < events.count; i++) {
      const ev = events.items[i];
      if (!ev) continue;
      if (ev.type === 'enemyDeath') particles.burst(ev.x, ev.y, ev.color, PARTICLES.death);
      else particles.burst(ev.x, ev.y, PARTICLES.hitColor, PARTICLES.hit);
    }
    events.clear();
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
      renderer.render(frame);

      if (world.status === 'levelup' && !levelUp.visible) showLevelUp();
      if (world.status === 'dead' && !gameOver.visible) {
        gameOver.show(
          { timeSurvived: world.time, kills: world.kills, level: world.player.level },
          restart,
        );
      }

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
        ds.loadout = [
          ...world.player.weapons.map((w) => `${w.def.id}:${w.level}`),
          ...world.player.passives.map((p) => `${p.def.id}:${p.level}`),
        ].join(',');
      }
    },
  });
  loop.start();
}

boot();
