import './ui/ui.css';
import { createSfx } from './audio/sfx';
import { addShake, createCamera, updateCamera, updateShake } from './core/camera';
import { createInput, type AimResult } from './core/input';
import { createFixedLoop, createFrameStats } from './core/loop';
import { setVec, vec2 } from './core/math';
import type { SoundId } from './data/audio';
import type { DifficultyId } from './data/difficulty';
import {
  CAMERA_FOLLOW_RATE,
  FAINT,
  HURT_FLASH,
  JOYSTICK,
  PARTICLES,
  SHAKE,
  VICTORY_SCREEN_DELAY,
} from './data/render';
import { t } from './data/texts';
import { WEAPON_IDS } from './data/weapons';
import type { GameEventType } from './game/events';
import { giveAllWeapons, setPistolAmmo } from './game/debug';
import { parseDebugOptions } from './game/debug-options';
import { initialDifficulty } from './game/difficulty';
import { isGun } from './game/manual';
import { interpolatedPlayerPos } from './game/player';
import { chooseOffer, levelBeingChosen, rerollOffers } from './game/progression';
import { shiftClock } from './game/shift';
import { fastForward, spawnHorde, spawnRadiusForView } from './game/spawner';
import { createWorld, updateWorld, type World } from './game/world';
import { createFloaters } from './render/floaters';
import { createParticles } from './render/particles';
import { createRenderer, type RenderFrame } from './render/renderer';
import { browserStorage, createSaveStore, recordRun, type SaveData } from './save/storage';
import { describeOffer } from './ui/describe';
import { createLevelUpScreen } from './ui/levelup';
import { createEndScreen, createMainMenu, createPauseMenu, type RunStats } from './ui/menu';
import { createTouchControls } from './ui/touch';

/** Sound played for each gameplay event (events without one only drive visuals). */
const EVENT_SOUNDS: Readonly<Record<GameEventType, SoundId | null>> = {
  enemyDeath: null,
  playerHit: 'playerHurt',
  explosion: 'explosion',
  gunFire: 'gunFire',
  reloadStart: 'reloadStart',
  reloadDone: 'reloadDone',
  dryFire: 'dryFire',
  weaponSwap: 'weaponSwap',
  ammoPickup: 'ammoPickup',
  couponPickup: 'couponPickup',
  medkitPickup: 'medkitPickup',
  magnetPickup: 'magnetPickup',
  meleeSwing: 'meleeSwing',
  canThrow: 'canThrow',
  levelUp: 'levelUp',
  chestOpen: 'chestOpen',
  bossSpawn: 'bossSpawn',
  bossDeath: 'bossDeath',
  shockwave: 'shockwave',
  shelfHit: null,
  chainZap: 'chainZap',
  canExplosion: 'canExplosion',
  frenzyStart: 'frenzy',
};

/** `menu`: title screen over an idle world. `run`: a run is in progress (or just ended). */
type Phase = 'menu' | 'run';

function boot(): void {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Falta el <canvas id="game">');
  document.title = t('gameTitle');

  const debug = parseDebugOptions(window.location.search);
  const store = createSaveStore(browserStorage());
  let save = store.load();
  /** The saved «Reducir movimiento» choice, or the system preference when there is none. */
  const reducedMotionOf = (data: Readonly<SaveData>): boolean =>
    data.reducedMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  /** Difficulty of the next run: the URL parameter, else the last one chosen in the menu. */
  let difficulty = initialDifficulty(debug.difficulty, save.difficulty);
  const sfx = createSfx(save.muted);
  const input = createInput(canvas, JOYSTICK);
  const renderer = createRenderer(canvas);
  const particles = createParticles();
  const floaters = createFloaters();
  const stats = createFrameStats();
  const playerPos = vec2();
  const aim: AimResult = { dir: vec2(1, 0), active: false, trigger: false };

  // Browsers only allow audio after a user gesture; a touch counts on release, not on press.
  const unlockAudio = (): void => sfx.unlock();
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) {
    window.addEventListener(type, unlockAudio, true);
  }

  const newWorld = (): World => {
    const w = createWorld(Date.now() >>> 0, difficulty);
    w.player.invincible = debug.god;
    if (debug.allWeapons) giveAllWeapons(w, debug.evolved);
    if (debug.ammo !== null) setPistolAmmo(w, debug.ammo);
    if (debug.startTime > 0) fastForward(w, debug.startTime);
    if (debug.spawn > 0) spawnHorde(w, debug.spawn);
    return w;
  };

  let world = newWorld();
  let phase: Phase = 'menu';
  let paused = false;
  /** The finished run was already folded into the save. */
  let runRecorded = false;
  let lastRun: RunStats | undefined;
  /** Real seconds since dawn, driving the fainting animation and the victory screen. */
  let sinceDawn = 0;
  let hurtTimer = 0;
  const camera = createCamera(world.player.pos, CAMERA_FOLLOW_RATE);
  const frame: RenderFrame = {
    world,
    camera,
    playerPos,
    alpha: 0,
    input,
    particles,
    floaters,
    hud: { debug: { visible: false, fps: 0, cpuMs: 0 }, touch: false },
    hurtFlash: 0,
    faint: 0,
    reducedMotion: reducedMotionOf(save),
  };
  /** Camera shake, skipped entirely with «Reducir movimiento». */
  const shake = (amount: number): void => {
    if (!frame.reducedMotion) addShake(camera, amount);
  };

  const resetRun = (): void => {
    world = newWorld();
    frame.world = world;
    frame.faint = 0;
    sinceDawn = 0;
    hurtTimer = 0;
    paused = false;
    runRecorded = false;
    lastRun = undefined;
    particles.clear();
    floaters.clear();
    camera.x = world.player.pos.x;
    camera.y = world.player.pos.y;
    camera.trauma = 0;
  };

  const bestTime = (): number => save.records[difficulty].bestTime;
  const menuInfo = () => ({
    difficulty,
    bestClock: bestTime() > 0 ? shiftClock(bestTime()) : null,
    wins: save.records[difficulty].wins,
    totalKills: save.totalKills,
    muted: save.muted,
    reducedMotion: frame.reducedMotion,
    touch: input.touchMode,
  });

  /** The overlay shows with the saved preference (F3 / checkbox) or any debug URL parameter. */
  const syncDebugOverlay = (): void => {
    const visible = save.showDebug || debug.enabled;
    if (visible && !frame.hud.debug.visible) stats.reset();
    frame.hud.debug.visible = visible;
    pauseMenu.setShowDebug(visible);
  };

  const toggleDebugOverlay = (): void => {
    // With a URL parameter forcing it on, there is nothing to toggle.
    if (debug.enabled) {
      syncDebugOverlay();
      return;
    }
    save = { ...save, showDebug: !save.showDebug };
    store.save(save);
    syncDebugOverlay();
  };

  const toggleMute = (): void => {
    save = { ...save, muted: !save.muted };
    sfx.setMuted(save.muted);
    store.save(save);
    mainMenu.setMuted(save.muted);
    pauseMenu.setMuted(save.muted);
  };

  const toggleReducedMotion = (): void => {
    const reduced = !frame.reducedMotion;
    save = { ...save, reducedMotion: reduced };
    store.save(save);
    frame.reducedMotion = reduced;
    if (reduced) camera.trauma = 0;
    mainMenu.setReducedMotion(reduced);
    pauseMenu.setReducedMotion(reduced);
  };

  /** «Borrar datos guardados»: removes the save and goes back to the defaults. */
  const clearData = (): void => {
    store.clear();
    save = store.load();
    difficulty = initialDifficulty(debug.difficulty, save.difficulty);
    sfx.setMuted(save.muted);
    frame.reducedMotion = reducedMotionOf(save);
    syncDebugOverlay();
    mainMenu.show(menuInfo());
  };

  const selectDifficulty = (id: DifficultyId): void => {
    difficulty = id;
    save = { ...save, difficulty: id };
    store.save(save);
    // The idle world behind the menu keeps its difficulty: `startRun` builds a new one.
    mainMenu.show(menuInfo());
  };

  const startRun = (): void => {
    mainMenu.hide();
    endScreen.hide();
    levelUp.hide();
    resetRun();
    phase = 'run';
  };

  const goToMenu = (): void => {
    endScreen.hide();
    pauseMenu.hide();
    levelUp.hide();
    resetRun();
    phase = 'menu';
    mainMenu.show(menuInfo());
  };

  const pause = (): void => {
    if (phase !== 'run' || paused || world.status !== 'playing') return;
    paused = true;
    pauseMenu.show(save.muted, frame.hud.debug.visible, world.difficulty.id, frame.reducedMotion);
  };

  const resume = (): void => {
    if (!paused) return;
    paused = false;
    pauseMenu.hide();
  };

  const mainMenu = createMainMenu(document.body, {
    onPlay: startRun,
    onToggleMute: toggleMute,
    onToggleReducedMotion: toggleReducedMotion,
    onClearData: clearData,
    onSelectDifficulty: selectDifficulty,
  });
  const pauseMenu = createPauseMenu(document.body, {
    onResume: resume,
    onToggleMute: toggleMute,
    onToggleReducedMotion: toggleReducedMotion,
    onToggleDebug: toggleDebugOverlay,
    onQuit: goToMenu,
  });
  const endScreen = createEndScreen(document.body);
  const levelUp = createLevelUpScreen(document.body);
  const touch = createTouchControls(document.body, {
    onSwap: () => input.requestSwap(),
    onReload: () => input.requestReload(),
    onPause: pause,
  });

  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

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

  /**
   * Saves the finished run once and remembers its stats for the end screen. A run with debug
   * assists (`debug.assisted`) never touches the save: no records, wins or kills.
   */
  const finishRun = (): RunStats => {
    if (lastRun) return lastRun;
    let newRecord = false;
    if (!debug.assisted) {
      const result = recordRun(
        save,
        world.difficulty.id,
        world.time,
        world.kills,
        world.status === 'won',
      );
      save = result.save;
      newRecord = result.newRecord;
      store.save(save);
    }
    runRecorded = true;
    lastRun = {
      timeSurvived: world.time,
      kills: world.kills,
      level: world.player.level,
      clock: shiftClock(world.time),
      newRecord,
      difficulty: world.difficulty.id,
    };
    return lastRun;
  };

  /** Turns gameplay events into particles, sounds, shake and damage numbers, then empties the queues. */
  const drainEvents = (): void => {
    const events = world.events;
    const p = world.player.pos;
    for (let i = 0; i < events.count; i++) {
      const ev = events.items[i];
      if (!ev) continue;
      const sound = EVENT_SOUNDS[ev.type];
      if (sound) sfx.play(sound);
      switch (ev.type) {
        case 'enemyDeath':
          particles.burst(ev.x, ev.y, ev.color, PARTICLES.death);
          break;
        case 'playerHit':
          particles.burst(ev.x, ev.y, PARTICLES.hitColor, PARTICLES.hit);
          shake(SHAKE.playerHit);
          hurtTimer = HURT_FLASH.duration;
          break;
        case 'explosion': {
          particles.burst(ev.x, ev.y, PARTICLES.explosionColor, PARTICLES.explosion);
          const near = Math.hypot(ev.x - p.x, ev.y - p.y) <= SHAKE.explosionRange;
          if (near) shake(SHAKE.explosion);
          break;
        }
        case 'bossSpawn':
          shake(SHAKE.bossSpawn);
          break;
        case 'frenzyStart':
          shake(SHAKE.frenzy);
          break;
        case 'shockwave':
          shake(SHAKE.shockwave);
          break;
        case 'bossDeath':
          shake(SHAKE.bossDeath);
          break;
        case 'shelfHit':
          particles.burst(ev.x, ev.y, PARTICLES.shelfHitColor, PARTICLES.shelfHit);
          break;
        case 'canExplosion':
          particles.burst(ev.x, ev.y, PARTICLES.explosionColor, PARTICLES.canExplosion);
          break;
        case 'chainZap':
          particles.burst(ev.x, ev.y, PARTICLES.zapColor, PARTICLES.zap);
          break;
        default:
          break;
      }
    }
    events.clear();

    const hits = world.hits;
    if (hits.count > 0) sfx.play('enemyHit');
    for (let i = 0; i < hits.count; i++) {
      const h = hits.items[i];
      if (h) floaters.spawn(h.x, h.y, h.amount, h.armored);
    }
    hits.clear();
  };

  /** UI that reacts to the run's status (level-up, dawn, death). */
  const syncScreens = (frameDt: number): void => {
    if (world.status === 'levelup' && !levelUp.visible) showLevelUp();
    if (world.status === 'won') {
      if (!runRecorded) sfx.play('victory');
      const run = finishRun();
      sinceDawn += frameDt;
      frame.faint = Math.min(1, sinceDawn / FAINT.duration);
      if (sinceDawn >= VICTORY_SCREEN_DELAY && !endScreen.visible) {
        endScreen.show('victory', run, startRun, goToMenu);
      }
    }
    if (world.status === 'dead' && !endScreen.visible) {
      if (!runRecorded) sfx.play('defeat');
      endScreen.show('defeat', finishRun(), startRun, goToMenu);
    }
  };

  /** One-shot keys that work outside gameplay too (M, F3) or toggle it (Esc / P). */
  const handleGlobalKeys = (): void => {
    if (input.consumeMute()) toggleMute();
    if (input.consumeDebug()) toggleDebugOverlay();
    if (input.consumePause()) {
      if (paused) resume();
      else pause();
    }
    // Presses made while a menu is open (e.g. R to reroll) must not leak into the run.
    if (phase !== 'run' || paused || world.status !== 'playing') input.clearEdges();
  };

  let lastStatsPublish = 0;
  /** Strongest shake since the last publish (it decays faster than the publish interval). */
  let peakTrauma = 0;
  let frameStart = 0;

  /** Frame timing is only measured while someone can see it (or a test reads the dataset). */
  const measuring = (): boolean => frame.hud.debug.visible;

  const loop = createFixedLoop({
    update(dt) {
      if (frameStart === 0 && measuring()) frameStart = performance.now();
      if (phase !== 'run' || paused) return;
      world.spawnRadius = spawnRadiusForView(renderer.viewW, renderer.viewH);
      input.getMoveAxis(world.moveInput);
      // The aim is measured from where the player is drawn on screen.
      const p = world.player.pos;
      const screenX = p.x - (camera.x - renderer.viewW / 2);
      const screenY = p.y - (camera.y - renderer.viewH / 2);
      input.getAim(screenX, screenY, aim);
      world.aimActive = aim.active;
      if (aim.active) setVec(world.aim, aim.dir.x, aim.dir.y);
      world.triggerHeld = aim.trigger;
      if (input.consumeSwap()) world.swapRequested = true;
      world.selectRequested = input.consumeSelect();
      if (input.consumeReload()) world.reloadRequested = true;
      updateWorld(world, dt);
    },
    render(alpha, frameDt) {
      if (frameStart === 0 && measuring()) frameStart = performance.now();
      handleGlobalKeys();
      drainEvents();
      // While paused, effects freeze along with the world.
      const fxDt = paused ? 0 : frameDt;
      particles.update(fxDt);
      floaters.update(fxDt);
      updateShake(camera, SHAKE, fxDt);
      hurtTimer = Math.max(0, hurtTimer - fxDt);
      frame.hurtFlash = hurtTimer / HURT_FLASH.duration;
      interpolatedPlayerPos(world.player, alpha, playerPos);
      updateCamera(camera, playerPos.x, playerPos.y, frameDt);
      frame.alpha = alpha;
      frame.hud.touch = input.touchMode;
      if (phase === 'run') syncScreens(frameDt);
      touch.setPlaying(phase === 'run' && !paused && world.status === 'playing');
      renderer.render(frame);

      if (!measuring()) return;
      const now = performance.now();
      // The frame the overlay was turned on has no start mark: skip it instead of a bogus reading.
      if (frameStart > 0) stats.tick(frameDt, now - frameStart);
      frameStart = 0;
      frame.hud.debug.fps = stats.fps;
      frame.hud.debug.cpuMs = stats.cpuMs;
      peakTrauma = Math.max(peakTrauma, camera.trauma);
      if (now - lastStatsPublish >= 500) {
        // Exposed for automated checks (headless browser).
        lastStatsPublish = now;
        const ds = document.body.dataset;
        ds.fps = String(stats.fps);
        ds.cpu = stats.cpuMs.toFixed(2);
        ds.enemies = String(world.enemies.count);
        ds.kills = String(world.kills);
        ds.level = String(world.player.level);
        ds.status = paused ? 'paused' : world.status;
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
          if (e?.def.behavior.kind === 'charge' && e.behaviorState === 1) {
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
        const m = world.player.manual;
        ds.active = m.active;
        ds.ammo = m.owned
          .filter(isGun)
          .map((e) => `${e.weapon.def.id}:${e.mag}/${e.reserve}`)
          .join(',');
        ds.reloading = String(m.reloadTimer > 0);
        ds.ammoBoxes = String(world.ammoBoxes.count);
        ds.shellBoxes = String(world.shellBoxes.count);
        ds.manualLevels = m.owned.map((e) => `${e.weapon.def.id}:${e.weapon.level}`).join(',');
        ds.pistolMods = m.mods.join(',');
        ds.trauma = peakTrauma.toFixed(2);
        peakTrauma = 0;
        ds.difficulty = world.difficulty.id;
        ds.frenzy = String(world.frenzy);
        ds.muted = String(save.muted);
        ds.showDebug = String(save.showDebug);
        const weaponKills: Record<string, number> = {};
        WEAPON_IDS.forEach((id, i) => {
          const n = world.killsByWeapon[i] ?? 0;
          if (n > 0) weaponKills[id] = n;
        });
        ds.weaponKills = JSON.stringify(weaponKills);
        const floorKinds: Record<string, number> = {};
        for (let i = 0; i < world.floorItems.count; i++) {
          const kind = world.floorItems.items[i]?.kind ?? '?';
          floorKinds[kind] = (floorKinds[kind] ?? 0) + 1;
        }
        ds.floorItems = JSON.stringify(floorKinds);
        ds.hp = world.player.hp.toFixed(1);
        let stuck = 0;
        for (let i = 0; i < world.enemies.count; i++) {
          if ((world.enemies.items[i]?.stuckTimer ?? 0) > 0) stuck++;
        }
        ds.stuck = String(stuck);
        ds.stuckRelocations = String(world.stuckRelocations);
      }
    },
  });

  syncDebugOverlay();
  if (debug.enabled) startRun();
  else mainMenu.show(menuInfo());
  loop.start();
  document.getElementById('boot')?.remove();
}

/**
 * Shows a generic message over the game (no error details: those stay in the console). Used when
 * booting fails and when an error stops the loop mid-run, instead of a silent frozen screen.
 */
function showFatalError(key: 'bootError' | 'runtimeError'): void {
  let msg = document.getElementById('boot');
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'boot';
    msg.className = 'boot-msg';
    document.body.append(msg);
  }
  msg.setAttribute('role', 'alert');
  if (!msg.textContent || key === 'bootError') msg.textContent = t(key);
}

window.addEventListener('error', () => showFatalError('runtimeError'));
window.addEventListener('unhandledrejection', () => showFatalError('runtimeError'));

try {
  boot();
} catch (err) {
  showFatalError('bootError');
  throw err;
}
