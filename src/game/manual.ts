import { setVec } from '../core/math';
import {
  MANUAL_WEAPONS,
  WEAPONS,
  type ArcLevel,
  type GunLevel,
  type GunWeaponDef,
  type MeleeWeaponDef,
} from '../data/weapons';
import { emit } from './events';
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
  /** Trigger state of the previous step, to detect fresh presses (dry-fire click). */
  triggerWasHeld: boolean;
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
    triggerWasHeld: false,
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

/**
 * Adds rounds to the reserve (capped). Switches back to the gun if it had run dry.
 * Returns true when it switched back.
 */
export function addAmmo(player: Player, amount: number): boolean {
  const m = player.manual;
  m.reserve = Math.min(maxReserve(), m.reserve + amount);
  if (m.active !== 'melee' || !m.autoSwitched) return false;
  selectManual(m, 'gun');
  startReload(m);
  return true;
}

function updateGun(world: World, m: ManualState, dt: number, aimAngle: number): void {
  const { x, y } = world.player.pos;
  if (isReloading(m)) {
    if (world.triggerHeld && !m.triggerWasHeld) emit(world.events, 'dryFire', x, y);
    m.reloadTimer = Math.max(0, m.reloadTimer - dt);
    if (m.reloadTimer === 0) {
      finishReload(m);
      emit(world.events, 'reloadDone', x, y);
    }
    return;
  }
  if (m.mag === 0) {
    if (startReload(m)) {
      emit(world.events, 'reloadStart', x, y);
    } else {
      selectManual(m, 'melee', true);
      emit(world.events, 'weaponSwap', x, y);
    }
    return;
  }
  if (!world.triggerHeld || m.gun.cooldown > 0) return;
  const s = gunStats(m);
  fireVolley(m.gun, s, gunDef().look, world, aimAngle);
  m.mag--;
  m.gun.cooldown = s.cooldown * world.player.mods.cooldown;
  emit(world.events, 'gunFire', x, y);
  // The hammer clicks on an empty chamber.
  if (m.mag === 0) emit(world.events, 'dryFire', x, y);
}

function updateMelee(world: World, m: ManualState, aimAngle: number): void {
  if (!world.triggerHeld || m.melee.cooldown > 0) return;
  const s = meleeStats(m);
  swingArc(m.melee, s, world, aimAngle);
  m.melee.cooldown = s.cooldown * world.player.mods.cooldown;
  emit(world.events, 'meleeSwing', world.player.pos.x, world.player.pos.y);
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
  if (world.swapRequested && swapManual(m)) emit(world.events, 'weaponSwap', p.pos.x, p.pos.y);
  if (world.reloadRequested && startReload(m)) emit(world.events, 'reloadStart', p.pos.x, p.pos.y);
  world.swapRequested = false;
  world.reloadRequested = false;

  const aimAngle = Math.atan2(world.aim.y, world.aim.x);
  if (m.active === 'gun') updateGun(world, m, dt, aimAngle);
  // Not `else`: the gun may have just handed over to the melee weapon this step.
  if (m.active === 'melee') updateMelee(world, m, aimAngle);
  m.triggerWasHeld = world.triggerHeld;
}
