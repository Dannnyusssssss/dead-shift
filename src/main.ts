import './ui/ui.css';
import { createCamera, updateCamera } from './core/camera';
import { createInput } from './core/input';
import { createFixedLoop, createFrameStats } from './core/loop';
import { vec2 } from './core/math';
import { CAMERA_FOLLOW_RATE, JOYSTICK, PARTICLES } from './data/render';
import { t } from './data/texts';
import { interpolatedPlayerPos } from './game/player';
import { spawnHorde, spawnRadiusForView } from './game/spawner';
import { createWorld, updateWorld, type World } from './game/world';
import { createParticles } from './render/particles';
import { createRenderer, type RenderFrame } from './render/renderer';
import { createGameOverScreen } from './ui/menu';

/** Debug switches from the URL: `?spawn=300` starts with a horde, `?god` disables death. */
interface DebugOptions {
  enabled: boolean;
  spawn: number;
  god: boolean;
}

function readDebugOptions(search: string): DebugOptions {
  const params = new URLSearchParams(search);
  const spawn = Math.max(0, Math.floor(Number(params.get('spawn') ?? 0)) || 0);
  const god = params.has('god');
  return { enabled: spawn > 0 || god || params.has('debug'), spawn, god };
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
  const playerPos = vec2();

  const newWorld = (): World => {
    const w = createWorld(Date.now() >>> 0);
    w.player.invincible = debug.god;
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
    world = newWorld();
    frame.world = world;
    particles.clear();
    camera.x = world.player.pos.x;
    camera.y = world.player.pos.y;
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

      if (world.status === 'dead' && !gameOver.visible) {
        gameOver.show({ timeSurvived: world.time, kills: world.kills }, restart);
      }

      stats.tick(frameDt, performance.now() - frameStart);
      frameStart = 0;
      frame.debug.fps = stats.fps;
      frame.debug.cpuMs = stats.cpuMs;
      const now = performance.now();
      if (debug.enabled && now - lastStatsPublish >= 500) {
        // Exposed for automated checks (headless browser).
        lastStatsPublish = now;
        document.body.dataset.fps = String(stats.fps);
        document.body.dataset.cpu = stats.cpuMs.toFixed(2);
        document.body.dataset.enemies = String(world.enemies.count);
        document.body.dataset.kills = String(world.kills);
      }
    },
  });
  loop.start();
}

boot();
