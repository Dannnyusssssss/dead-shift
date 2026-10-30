const es = {
  gameTitle: 'Dead Shift',
  bootError: 'No se pudo iniciar el juego: este navegador no soporta Canvas 2D.',
  hp: 'Vida',
  fps: 'FPS',
  kills: 'Bajas',
  zombies: 'zombis',
  level: 'Nv',
  gameOverTitle: 'Te mordieron',
  gameOverSubtitle: 'Moriste a las {clock}. El turno terminó antes de tiempo.',
  victoryTitle: '¡Llegaste a las 6:00 AM!',
  victorySubtitle: 'Amanece y los zombis se desmayan. Turno cumplido.',
  bossName: 'Gerente Zombi',
  chestTitle: '¡Cofre del gerente!',
  chestHint: 'Mejora gratis para una de tus armas',
  statTime: 'Tiempo sobrevivido',
  statKills: 'Zombis derribados',
  statLevel: 'Nivel alcanzado',
  retry: 'Reintentar',

  levelUpTitle: '¡Subiste al nivel {level}!',
  levelUpHint: 'Elige una mejora',
  reroll: 'Cambiar opciones',
  rerollsLeft: '(restantes: {n})',
  tagNew: 'Nuevo',
  tagLevel: 'Nv {from} → {to}',
  healName: 'Sándwich de la góndola',
  healDesc: 'Recupera {pct}% de vida',

  weaponBroom: 'Escoba',
  weaponBroomDesc: 'Golpe en arco hacia donde apuntas. No gasta munición.',
  weaponCans: 'Latas de conserva',
  weaponCansDesc: 'Lanza latas al zombi más cercano.',
  weaponIce: 'Bolsas de hielo',
  weaponIceDesc: 'Orbitan a tu alrededor y ralentizan.',
  weaponAerosol: 'Aerosol insecticida',
  weaponAerosolDesc: 'Nube de gas al frente que daña con el tiempo.',
  weaponMicrowave: 'Microondas',
  weaponMicrowaveDesc: 'Lo dejas en el suelo y dispara rayos.',
  weaponLabelGun: 'Pistola de etiquetas',
  weaponLabelGunDesc: 'Tu arma principal: dispara etiquetas hacia donde apuntas.',
  weaponShotgun: 'Escopeta',
  weaponShotgunDesc:
    'Arma manual: ráfaga de perdigones en cono, de corto alcance y mucho empuje. Tecla 3.',
  modPiercing: 'Etiquetas perforantes',
  modPiercingDesc: 'Mod de pistola: cada etiqueta atraviesa un zombi más.',
  modExtendedMag: 'Cargador extendido',
  modExtendedMagDesc: 'Mod de pistola: +50 % de balas por cargador.',
  modIncendiary: 'Etiquetas incendiarias',
  modIncendiaryDesc: 'Mod de pistola: los zombis alcanzados se queman ({dps}/s durante {time} s).',
  modRicochet: 'Etiquetas con rebote',
  modRicochetDesc: 'Mod de pistola: tras impactar, la etiqueta salta al zombi más cercano.',
  tagMod: 'Mod',

  noAmmo: 'SIN MUNICIÓN',
  reloading: 'Recargando',
  swapHint: '1/2/3 · Q: cambiar',
  reloadHint: 'R: recargar',
  swapButton: 'Cambiar arma',
  reloadButton: 'Recargar',
  pauseButton: 'Pausa',
  touchHint: 'Botones: cambiar arma y recargar',

  menuTagline:
    'Turno de noche en el súper. A las 10 PM se cortó la luz y los clientes volvieron… distintos.',
  menuGoal: 'Sobrevive hasta las 6:00 AM.',
  play: 'Jugar',
  bestClock: 'Mejor hora alcanzada',
  bestNone: '—',
  totalKills: 'Zombis derribados en total',
  soundOn: '🔊 Sonido: sí',
  soundOff: '🔇 Sonido: no',
  controlsDesktop:
    'WASD: moverse · Mouse: apuntar · Clic: disparar · R: recargar · Q / rueda: cambiar arma · Esc: pausa · M: silencio · F3: métricas',
  controlsTouch:
    'Mitad izquierda: moverse · Mitad derecha: apuntar y disparar · Botones para cambiar arma, recargar y pausar',
  pauseTitle: 'Pausa',
  resume: 'Continuar',
  quitToMenu: 'Salir al menú',
  showDebug: 'Mostrar FPS y métricas',
  killsShort: 'bajas',
  statClock: 'Hora del turno',
  newRecord: '¡Nuevo récord!',
  menuButton: 'Menú principal',

  passiveShoes: 'Zapatillas antideslizantes',
  passiveShoesDesc: '+8% velocidad de movimiento',
  passiveCoffee: 'Café de máquina',
  passiveCoffeeDesc: '-8% enfriamiento de todas las armas',
  passiveMagnet: 'Imán de heladera',
  passiveMagnetDesc: '+20% radio de recogida',
  passiveVest: 'Chaleco reflectante',
  passiveVestDesc: '-1 daño recibido por golpe',
  passiveSoup: 'Termo con sopa',
  passiveSoupDesc: '+0.5 vida por segundo',
  passiveCalculator: 'Calculadora del jefe',
  passiveCalculatorDesc: '+10% daño de todas las armas',

  statDamage: 'daño',
  statCooldown: 's enfriamiento',
  statArc: '° arco',
  statRange: 'alcance',
  statBothSides: 'barre ambos lados',
  statCount: 'proyectiles',
  statPierce: 'perforación',
  statBags: 'bolsas',
  statOrbitRadius: 'radio',
  statAngularSpeed: 'velocidad de giro',
  statActiveTime: 's de nube',
  statPoison: 'veneno por segundo',
  statRays: 'rayos',
  statDuration: 's de duración',
  statUnits: 'microondas',
  statSpread: '° dispersión',
  statMagazine: 'balas por cargador',
  statReload: 's recarga',
} as const;

export type TextKey = keyof typeof es;
export type Language = 'es';

const TEXTS: Readonly<Record<Language, Readonly<Record<TextKey, string>>>> = { es };

let language: Language = 'es';

export function setLanguage(lang: Language): void {
  language = lang;
}

/** Looks up a text and replaces `{name}` placeholders with `params[name]`. */
export function t(key: TextKey, params?: Readonly<Record<string, string | number>>): string {
  const text = TEXTS[language][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
