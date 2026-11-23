const es = {
  gameTitle: 'Dead Shift',
  coverTagline: 'Supermercado 24 h · Hordas de zombis · Aguanta hasta las 6 AM',
  coverDownload: 'Descargar PNG',
  bootError:
    'No se pudo iniciar el juego. Recarga la página o prueba con un navegador actualizado.',
  runtimeError: 'Ocurrió un error y el juego se detuvo. Recarga la página para seguir jugando.',
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
  frenzy: '¡FRENESÍ!',
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

  evoElectricBroom: 'Escoba eléctrica',
  evoElectricBroomDesc: 'Golpea a ambos lados y suelta una descarga que salta entre zombis.',
  evoLaserGun: 'Pistola láser',
  evoLaserGunDesc: 'Rayo que atraviesa toda la fila de zombis, con cadencia altísima.',
  evoRiotShotgun: 'Escopeta antidisturbios',
  evoRiotShotgunDesc: 'Más perdigones, que perforan, y un empuje que despeja el pasillo.',
  evoGrenadeCans: 'Latas granada',
  evoGrenadeCansDesc: 'Las latas explotan al impactar y dañan a todos alrededor.',
  evoFlamethrower: 'Lanzallamas casero',
  evoFlamethrowerDesc: 'Llamarada larga y frecuente que deja a los zombis ardiendo.',
  evoBlizzard: 'Ventisca',
  evoBlizzardDesc: 'Más bolsas en un radio mayor; congelan a los zombis que tocan.',
  evoIndustrialMicrowave: 'Microondas industrial',
  evoIndustrialMicrowaveDesc: 'Tres microondas con más rayos, más alcance y más daño.',
  tagEvolution: 'EVOLUCIÓN',
  evolvedShort: 'EVO',
  recipeLine: '{icon} {name}: {weapon} + {passive}',
  recipeWeaponPart: 'arma Nv {need} {mark}',
  recipePassivePart: '{icon} {name} Nv {need} {mark}',
  recipeHave: '(tienes {have})',
  recipeDone: '✓',
  recipeForWeapon: 'Evoluciona {icon} con Nv {need}',

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
  difficultyEasy: 'Fácil',
  difficultyNormal: 'Medio',
  difficultyHard: 'Difícil',
  difficultyTitle: 'Dificultad',
  difficultyLabel: 'Dificultad: {name}',
  statDifficulty: 'Dificultad',
  statWins: 'Victorias',
  reducedMotionOn: 'Reducir movimiento: sí',
  reducedMotionOff: 'Reducir movimiento: no',
  contentNote: 'Edad orientativa 12+: violencia de fantasía contra zombis, sin sangre realista.',
  clearData: 'Borrar datos guardados',
  clearDataConfirm: '¿Seguro? Pulsa otra vez para borrar',
  clearDataDone: 'Datos borrados de este navegador.',
  back: 'Volver',

  legalTitle: 'Privacidad y créditos',
  legalPrivacyTitle: 'Privacidad',
  legalPrivacyBody:
    'Responsable: Danny Sivinta (Quito, Ecuador), cuartojuegos.contacto@gmail.com. Dead Shift no recolecta datos personales: no hay cuentas, formularios, cookies, analítica ni publicidad, y el juego no envía información a ningún servidor.',
  legalStorageTitle: 'Qué se guarda en tu navegador',
  legalStorageBody:
    'Para recordar tus ajustes y récords, el juego guarda en este navegador (almacenamiento local, clave deadshift:v1): bajas totales, sonido, métricas visibles, dificultad elegida, «Reducir movimiento» y, por dificultad, tu mejor hora y tus victorias. Esa información no sale de tu dispositivo y se conserva hasta que la borres con el botón «Borrar datos guardados» del menú o desde la configuración de tu navegador.',
  legalThirdTitle: 'Alojamiento',
  legalThirdBody:
    'El juego se sirve desde un servicio de alojamiento web (GitHub Pages, o el sitio donde lo juegues). Como en cualquier sitio web, ese servicio puede registrar datos técnicos de la conexión, como la dirección IP, según su propia política de privacidad. El juego no carga fuentes, scripts ni contenido de otros sitios.',
  legalRightsTitle: 'Tus derechos',
  legalRightsBody:
    'Como el responsable no recibe ni guarda datos tuyos, todo lo guardado está en tu propio navegador y puedes borrarlo cuando quieras. Para cualquier consulta sobre tus datos personales, escribe al correo de contacto. También puedes presentar un reclamo ante la Superintendencia de Protección de Datos Personales del Ecuador.',
  legalMinorsTitle: 'Menores de edad',
  legalMinorsBody:
    'El juego puede ser usado por menores de edad. No pide ni recolecta datos de ninguna persona, tampoco de niñas, niños o adolescentes.',
  legalContentTitle: 'Contenido',
  legalContentBody:
    'Edad orientativa 12+ (orientación propia, no una clasificación oficial): violencia de fantasía contra zombis dibujados con formas simples, sin sangre realista.',
  legalCreditsTitle: 'Créditos y licencia',
  legalCreditsBody:
    'Creado por Danny Sivinta. No usa recursos de terceros: los gráficos se dibujan y los sonidos se sintetizan en el navegador; los emojis se muestran con las fuentes de tu sistema. © 2026 Danny Sivinta. Todos los derechos reservados.',
  legalUpdated: 'Última actualización: 21 de noviembre de 2026.',

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
