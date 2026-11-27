import type { FireMode } from './data/controls';
import { WEAPON_IDS } from './data/weapons';
import { isGun } from './game/manual';
import { shiftClock } from './game/shift';
import type { World } from './game/world';

/** Host values published next to the world's (frame timing, settings). */
export interface DatasetExtras {
  fps: number;
  cpuMs: number;
  paused: boolean;
  /** Strongest camera shake since the last publish. */
  trauma: number;
  muted: boolean;
  showDebug: boolean;
  viewScale: number;
  aimAssist: boolean;
  fireMode: FireMode;
  /** A gamepad is connected. */
  pad: boolean;
}

/**
 * Writes the state of the run into `document.body.dataset` for automated checks in a headless
 * browser (`docs/DEBUG.md`). Only called while the metrics overlay is visible.
 */
export function publishDataset(
  ds: DOMStringMap,
  world: Readonly<World>,
  x: Readonly<DatasetExtras>,
): void {
  ds.fps = String(x.fps);
  ds.cpu = x.cpuMs.toFixed(2);
  ds.enemies = String(world.enemies.count);
  ds.kills = String(world.kills);
  ds.level = String(world.player.level);
  ds.status = x.paused ? 'paused' : world.status;
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
  ds.trauma = x.trauma.toFixed(2);
  ds.difficulty = world.difficulty.id;
  ds.frenzy = String(world.frenzy);
  ds.muted = String(x.muted);
  ds.showDebug = String(x.showDebug);
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
  ds.viewScale = String(x.viewScale);
  ds.aimAssist = String(x.aimAssist);
  ds.aimAssistUsed = String(world.aimAssistUsed);
  ds.fireMode = x.fireMode;
  ds.pad = String(x.pad);
}
