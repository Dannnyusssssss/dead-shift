import { createCamera, updateCamera } from './core/camera';
import { createInput } from './core/input';
import { createFixedLoop, createFpsMeter } from './core/loop';
import { vec2 } from './core/math';
import { CAMERA_FOLLOW_RATE, JOYSTICK } from './data/render';
import { t } from './data/texts';
import { interpolatedPlayerPos } from './game/player';
import { createWorld, updateWorld } from './game/world';
import { createRenderer, type RenderFrame } from './render/renderer';

function boot(): void {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Falta el <canvas id="game">');
  document.title = t('gameTitle');

  const seed = Date.now() >>> 0;
  const world = createWorld(seed);
  const input = createInput(canvas, JOYSTICK);
  const camera = createCamera(world.player.pos, CAMERA_FOLLOW_RATE);
  const renderer = createRenderer(canvas);
  const fpsMeter = createFpsMeter();
  const playerPos = vec2();
  const frame: RenderFrame = { world, camera, playerPos, input, fps: 0 };

  const loop = createFixedLoop({
    update(dt) {
      input.getMoveAxis(world.moveInput);
      updateWorld(world, dt);
    },
    render(alpha, frameDt) {
      interpolatedPlayerPos(world.player, alpha, playerPos);
      updateCamera(camera, playerPos.x, playerPos.y, frameDt);
      fpsMeter.tick(frameDt);
      frame.fps = fpsMeter.fps;
      renderer.render(frame);
    },
  });
  loop.start();
}

boot();
