import { setVec } from '../core/math';
import {
  MANUAL_WEAPONS,
  WEAPONS,
  type ArcLevel,
  type GunLevel,
  type GunWeaponDef,
  type MeleeWeaponDef,
} from '../data/weapons';
import type { Player } from './player';
import { createWeapon, fireVolley, statsAt, swingArc, type WeaponInstance } from './weapons';
import type { World } from './world';

export type ManualSlot = 'gun' | 'melee';

/** The player's two manual weapons and the gun's ammo. */
export interface ManualState {
  gun: WeaponInstance;
  melee: WeaponInstance;
  active: ManualSlot;
  /** Rounds in the magazine. */
  mag: number;
  /** Rounds in the reserve. */
  reserve: number;
  /** Remaining reload time; 0 when not reloading. */
  reloadTimer: number;
  /** The melee weapon was selected automatically because the gun ran dry. */
  autoSwitched: boolean;
}

function gunDef(): Readonly<GunWeaponDef> {
  const def = WEAPONS[MANUAL_WEAPONS.gun];
  if (def.behavior !== 'gun') throw new Error('MANUAL_WEAPONS.gun must be a gun');
  return def;
}

function meleeDef(): Readonly<MeleeWeaponDef> {
  const def = WEAPONS[MANUAL_WEAPONS.melee];
  if (def.behavior !== 'melee') throw new Error('MANUAL_WEAPONS.melee must be a melee weapon');
  return def;
}

export function gunStats(m: Readonly<ManualState>): Readonly<GunLevel> {
  return statsAt(gunDef().levels, m.gun.level);
}

export function meleeStats(m: Readonly<ManualState>): Readonly<ArcLevel> {
  return statsAt(meleeDef().levels, m.melee.level);
}

export function maxReserve(): number {
  return gunDef().ammo.maxReserve;
}

export function createManualState(): ManualState {
  const m: ManualState = {
    gun: createWeapon(MANUAL_WEAPONS.gun),
    melee: createWeapon(MANUAL_WEAPONS.melee),
    active: 'gun',
    mag: 0,
    reserve: gunDef().ammo.startReserve,
    reloadTimer: 0,
    autoSwitched: false,
  };
  m.mag = gunStats(m).magazine;
  return m;
}

export const isReloading = (m: Readonly<ManualState>): boolean => m.reloadTimer > 0;
export const hasAmmo = (m: Readonly<ManualState>): boolean => m.mag + m.reserve > 0;

/** Starts a reload if it would add anything. Returns true if one started. */
export function startReload(m: ManualState): boolean {
  if (m.active !== 'gun' || isReloading(m)) return false;
  if (m.mag >= gunStats(m).magazine || m.reserve <= 0) return false;
  m.reloadTimer = gunStats(m).reloadTime;
  return true;
}

function finishReload(m: ManualState): void {
  const moved = Math.min(gunStats(m).magazine - m.mag, m.reserve);
  m.mag += moved;
  m.reserve -= moved;
  m.reloadTimer = 0;
}

/** Selects a manual weapon; any reload in progress is cancelled. */
export function selectManual(m: ManualState, slot: ManualSlot, automatic = false): void {
  m.reloadTimer = 0;
  m.active = slot;
  m.autoSwitched = automatic && slot === 'melee';
}

/** Manual toggle (Q / wheel / touch button). The gun can't be picked with no rounds at all. */
export function swapManual(m: ManualState): boolean {
  if (m.active === 'gun') {
    selectManual(m, 'melee');
    return true;
  }
  if (!hasAmmo(m)) return false;
  selectManual(m, 'gun');
  return true;
}

/** Adds rounds to the reserve (capped). Switches back to the gun if it had run dry. */
export function addAmmo(player: Player, amount: number): void {
  const m = player.manual;
  m.reserve = Math.min(maxReserve(), m.reserve + amount);
  if (m.active === 'melee' && m.autoSwitched) {
    selectManual(m, 'gun');
    startReload(m);
  }
}

function updateGun(world: World, m: ManualState, dt: number, aimAngle: number): void {
  if (isReloading(m)) {
    m.reloadTimer = Math.max(0, m.reloadTimer - dt);
    if (m.reloadTimer === 0) finishReload(m);
    return;
  }
  if (m.mag === 0) {
    if (!startReload(m)) selectManual(m, 'melee', true);
    return;
  }
  if (!world.triggerHeld || m.gun.cooldown > 0) return;
  const s = gunStats(m);
  fireVolley(m.gun, s, gunDef().look, world, aimAngle);
  m.mag--;
  m.gun.cooldown = s.cooldown * world.player.mods.cooldown;
}

function updateMelee(world: World, m: ManualState, aimAngle: number): void {
  if (!world.triggerHeld || m.melee.cooldown > 0) return;
  const s = meleeStats(m);
  swingArc(m.melee, s, world, aimAngle);
  m.melee.cooldown = s.cooldown * world.player.mods.cooldown;
}

/** Aim, trigger, reload and weapon switching for the two manual weapons. */
export function manualWeaponSystem(world: World, dt: number): void {
  const p = world.player;
  const m = p.manual;
  // With a mouse/aim stick the character faces the aim; keyboard-only, the aim follows movement.
  if (world.aimActive) setVec(p.facing, world.aim.x, world.aim.y);
  else setVec(world.aim, p.facing.x, p.facing.y);

  m.gun.cooldown = Math.max(0, m.gun.cooldown - dt);
  m.melee.cooldown = Math.max(0, m.melee.cooldown - dt);
  if (world.swapRequested) swapManual(m);
  if (world.reloadRequested) startReload(m);
  world.swapRequested = false;
  world.reloadRequested = false;

  const aimAngle = Math.atan2(world.aim.y, world.aim.x);
  if (m.active === 'gun') updateGun(world, m, dt, aimAngle);
  // Not `else`: the gun may have just handed over to the melee weapon this step.
  if (m.active === 'melee') updateMelee(world, m, aimAngle);
}
