import { setVec } from '../core/math';
import {
  MANUAL_KEYS,
  MANUAL_ORDER,
  MELEE_FALLBACK,
  PISTOL_MOD_RULES,
  PISTOL_MODS,
  STARTING_MANUAL,
  WEAPONS,
  type ArcLevel,
  type GunLevel,
  type GunWeaponDef,
  type MeleeWeaponDef,
  type PistolModId,
  type WeaponId,
} from '../data/weapons';
import { emit } from './events';
import type { Player } from './player';
import { createWeapon, fireVolley, statsAt, swingArc, type WeaponInstance } from './weapons';
import type { World } from './world';

/** One manual weapon the player owns, with its own ammo (always 0 / 0 for the melee one). */
export interface ManualEntry {
  weapon: WeaponInstance;
  /** Rounds in the magazine. */
  mag: number;
  /** Rounds in the reserve. */
  reserve: number;
}

/** The player's manual weapons (outside the automatic slots). */
export interface ManualState {
  /** Owned manual weapons, kept in MANUAL_ORDER order. */
  owned: ManualEntry[];
  active: WeaponId;
  /** Remaining reload time of the active gun; 0 when not reloading. */
  reloadTimer: number;
  /** The active weapon was picked automatically because the previous one ran dry. */
  autoSwitched: boolean;
  /** Trigger state of the previous step, to detect fresh presses (dry-fire click). */
  triggerWasHeld: boolean;
  /** Pistol mods taken this run (no levels, no slots). */
  mods: PistolModId[];
}

/** The definition of a manual gun, or undefined for anything else (e.g. the broom). */
export function gunDefOf(id: WeaponId): Readonly<GunWeaponDef> | undefined {
  const def = WEAPONS[id];
  return def.behavior === 'gun' ? def : undefined;
}

function requireGun(id: WeaponId): Readonly<GunWeaponDef> {
  const def = gunDefOf(id);
  if (!def) throw new Error(`${id} is not a manual gun`);
  return def;
}

function meleeDef(): Readonly<MeleeWeaponDef> {
  const def = WEAPONS[MELEE_FALLBACK];
  if (def.behavior !== 'melee') throw new Error('MELEE_FALLBACK must be a melee weapon');
  return def;
}

export function entryOf(m: Readonly<ManualState>, id: WeaponId): ManualEntry | undefined {
  return m.owned.find((e) => e.weapon.def.id === id);
}

export function activeEntry(m: Readonly<ManualState>): ManualEntry {
  const e = entryOf(m, m.active);
  if (!e) throw new Error(`active manual weapon ${m.active} is not owned`);
  return e;
}

export const isGun = (e: Readonly<ManualEntry>): boolean => e.weapon.def.behavior === 'gun';

/** A gun level with the given pistol mods applied (a new object; callers cache it). */
export function applyPistolMods(base: Readonly<GunLevel>, mods: readonly PistolModId[]): GunLevel {
  const out: GunLevel = { ...base };
  for (const id of mods) {
    const mod = PISTOL_MODS[id];
    out.pierce += mod.pierce ?? 0;
    if (mod.magazineMultiplier) out.magazine = Math.round(out.magazine * mod.magazineMultiplier);
    if (mod.burnDps) {
      out.burnDps = (out.burnDps ?? 0) + mod.burnDps;
      out.burnTime = Math.max(out.burnTime ?? 0, mod.burnTime ?? 0);
    }
    if (mod.bounces) {
      out.bounces = (out.bounces ?? 0) + mod.bounces;
      out.bounceRange = Math.max(out.bounceRange ?? 0, mod.bounceRange ?? 0);
    }
  }
  return out;
}

/** Modded pistol stats, rebuilt only when its level or the mods change (no per-frame objects). */
let moddedCache: { level: number; mods: string; stats: GunLevel } | undefined;

/** Stats of a manual gun at its current level (pistol mods included). */
export function gunStats(m: Readonly<ManualState>, id: WeaponId = m.active): Readonly<GunLevel> {
  const def = requireGun(id);
  const level = entryOf(m, id)?.weapon.level ?? 1;
  const base = statsAt(def.levels, level);
  if (id !== PISTOL_MOD_RULES.weapon || m.mods.length === 0) return base;
  const key = m.mods.join(',');
  if (!moddedCache || moddedCache.level !== level || moddedCache.mods !== key) {
    moddedCache = { level, mods: key, stats: applyPistolMods(base, m.mods) };
  }
  return moddedCache.stats;
}

export function meleeStats(m: Readonly<ManualState>): Readonly<ArcLevel> {
  return statsAt(meleeDef().levels, entryOf(m, MELEE_FALLBACK)?.weapon.level ?? 1);
}

export function maxReserve(id: WeaponId): number {
  return requireGun(id).ammo.maxReserve;
}

/** A gun with rounds left (magazine or reserve), or the melee weapon (always usable). */
export function isUsable(e: Readonly<ManualEntry>): boolean {
  return !isGun(e) || e.mag + e.reserve > 0;
}

/** The gun `id` has rounds left (false if not owned or not a gun). */
export function hasAmmo(m: Readonly<ManualState>, id: WeaponId): boolean {
  const e = entryOf(m, id);
  return e !== undefined && isGun(e) && e.mag + e.reserve > 0;
}

function newEntry(id: WeaponId): ManualEntry {
  const entry: ManualEntry = { weapon: createWeapon(id), mag: 0, reserve: 0 };
  const def = gunDefOf(id);
  if (def) {
    entry.mag = statsAt(def.levels, 1).magazine;
    entry.reserve = def.ammo.startReserve;
  }
  return entry;
}

const orderIndex = (id: WeaponId): number => MANUAL_ORDER.indexOf(id);

/** Adds a manual weapon (full magazine, starting reserve). Returns false if already owned. */
export function addManualWeapon(m: ManualState, id: WeaponId): boolean {
  if (entryOf(m, id) || orderIndex(id) < 0) return false;
  m.owned.push(newEntry(id));
  m.owned.sort((a, b) => orderIndex(a.weapon.def.id) - orderIndex(b.weapon.def.id));
  return true;
}

export function createManualState(): ManualState {
  const m: ManualState = {
    owned: [],
    active: STARTING_MANUAL[0] ?? MELEE_FALLBACK,
    reloadTimer: 0,
    autoSwitched: false,
    triggerWasHeld: false,
    mods: [],
  };
  for (const id of STARTING_MANUAL) addManualWeapon(m, id);
  return m;
}

/** Adds a pistol mod (once each, up to the per-run limit). Returns true if added. */
export function addPistolMod(m: ManualState, id: PistolModId): boolean {
  if (m.mods.includes(id) || m.mods.length >= PISTOL_MOD_RULES.maxPerRun) return false;
  m.mods.push(id);
  return true;
}

export const isReloading = (m: Readonly<ManualState>): boolean => m.reloadTimer > 0;

/** Starts reloading the active gun if it would add anything. Returns true if one started. */
export function startReload(m: ManualState): boolean {
  const e = activeEntry(m);
  if (!isGun(e) || isReloading(m)) return false;
  const s = gunStats(m);
  if (e.mag >= s.magazine || e.reserve <= 0) return false;
  m.reloadTimer = s.reloadTime;
  return true;
}

function finishReload(m: ManualState): void {
  const e = activeEntry(m);
  const moved = Math.min(gunStats(m).magazine - e.mag, e.reserve);
  e.mag += Math.max(0, moved);
  e.reserve -= Math.max(0, moved);
  m.reloadTimer = 0;
}

/** Selects an owned manual weapon; any reload in progress is cancelled. Returns false if not owned. */
export function selectManual(m: ManualState, id: WeaponId, automatic = false): boolean {
  if (!entryOf(m, id)) return false;
  m.reloadTimer = 0;
  m.active = id;
  m.autoSwitched = automatic;
  return true;
}

/** Q / wheel / touch button: the next usable weapon in MANUAL_ORDER (guns need rounds). */
export function cycleManual(m: ManualState): boolean {
  const n = m.owned.length;
  const start = m.owned.findIndex((e) => e.weapon.def.id === m.active);
  for (let k = 1; k < n; k++) {
    const e = m.owned[(start + k) % n] as ManualEntry;
    if (isUsable(e)) return selectManual(m, e.weapon.def.id);
  }
  return false;
}

/** Number key (1 / 2 / 3, see MANUAL_KEYS): ignored for weapons not owned, dry or already active. */
export function selectManualByKey(m: ManualState, key: number): boolean {
  const e = m.owned.find((o) => MANUAL_KEYS[o.weapon.def.id] === key);
  if (!e || e.weapon.def.id === m.active || !isUsable(e)) return false;
  return selectManual(m, e.weapon.def.id);
}

/** After the active gun runs dry: the next gun with rounds in MANUAL_ORDER, else the melee fallback. */
function autoSwitch(m: ManualState): void {
  const n = m.owned.length;
  const start = m.owned.findIndex((e) => e.weapon.def.id === m.active);
  for (let k = 1; k < n; k++) {
    const e = m.owned[(start + k) % n] as ManualEntry;
    if (isGun(e) && isUsable(e)) {
      selectManual(m, e.weapon.def.id, true);
      return;
    }
  }
  selectManual(m, MELEE_FALLBACK, true);
}

/**
 * Adds rounds to a gun's reserve (capped). If the active weapon was picked automatically and
 * comes after that gun in MANUAL_ORDER, switches back to it and reloads. Returns true when it
 * switched back.
 */
export function addAmmo(player: Player, id: WeaponId, amount: number): boolean {
  const m = player.manual;
  const e = entryOf(m, id);
  if (!e || !isGun(e)) return false;
  e.reserve = Math.min(maxReserve(id), e.reserve + amount);
  if (!m.autoSwitched || orderIndex(m.active) <= orderIndex(id)) return false;
  selectManual(m, id);
  startReload(m);
  return true;
}

function updateGun(world: World, m: ManualState, dt: number, aimAngle: number): void {
  const { x, y } = world.player.pos;
  const e = activeEntry(m);
  if (isReloading(m)) {
    if (world.triggerHeld && !m.triggerWasHeld) emit(world.events, 'dryFire', x, y);
    m.reloadTimer = Math.max(0, m.reloadTimer - dt);
    if (m.reloadTimer === 0) {
      finishReload(m);
      emit(world.events, 'reloadDone', x, y);
    }
    return;
  }
  if (e.mag === 0) {
    if (startReload(m)) {
      emit(world.events, 'reloadStart', x, y);
    } else {
      autoSwitch(m);
      emit(world.events, 'weaponSwap', x, y);
    }
    return;
  }
  if (!world.triggerHeld || e.weapon.cooldown > 0) return;
  const s = gunStats(m);
  fireVolley(e.weapon, s, requireGun(m.active).look, world, aimAngle);
  e.mag--;
  e.weapon.cooldown = s.cooldown * world.player.mods.cooldown;
  emit(world.events, 'gunFire', x, y);
  // The hammer clicks on an empty chamber.
  if (e.mag === 0) emit(world.events, 'dryFire', x, y);
}

function updateMelee(world: World, m: ManualState, aimAngle: number): void {
  const w = activeEntry(m).weapon;
  if (!world.triggerHeld || w.cooldown > 0) return;
  const s = meleeStats(m);
  swingArc(w, s, world, aimAngle);
  w.cooldown = s.cooldown * world.player.mods.cooldown;
  emit(world.events, 'meleeSwing', world.player.pos.x, world.player.pos.y);
}

/** Aim, trigger, reload and weapon switching for the manual weapons. */
export function manualWeaponSystem(world: World, dt: number): void {
  const p = world.player;
  const m = p.manual;
  // With a mouse/aim stick the character faces the aim; keyboard-only, the aim follows movement.
  if (world.aimActive) setVec(p.facing, world.aim.x, world.aim.y);
  else setVec(world.aim, p.facing.x, p.facing.y);

  for (const e of m.owned) e.weapon.cooldown = Math.max(0, e.weapon.cooldown - dt);
  const swapped =
    (world.selectRequested > 0 && selectManualByKey(m, world.selectRequested)) ||
    (world.swapRequested && cycleManual(m));
  if (swapped) emit(world.events, 'weaponSwap', p.pos.x, p.pos.y);
  if (world.reloadRequested && startReload(m)) emit(world.events, 'reloadStart', p.pos.x, p.pos.y);
  world.swapRequested = false;
  world.selectRequested = 0;
  world.reloadRequested = false;

  const aimAngle = Math.atan2(world.aim.y, world.aim.x);
  if (isGun(activeEntry(m))) updateGun(world, m, dt, aimAngle);
  // Not `else`: a dry gun may have just handed over to the melee weapon this step.
  if (!isGun(activeEntry(m))) updateMelee(world, m, aimAngle);
  m.triggerWasHeld = world.triggerHeld;
}
