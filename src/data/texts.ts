const es = {
  gameTitle: 'Dead Shift',
  hp: 'Vida',
  fps: 'FPS',
  kills: 'Bajas',
  zombies: 'zombis',
  gameOverTitle: 'Te mordieron',
  gameOverSubtitle: 'El turno terminó antes de tiempo.',
  statTime: 'Tiempo sobrevivido',
  statKills: 'Zombis derribados',
  retry: 'Reintentar',
} as const;

export type TextKey = keyof typeof es;
export type Language = 'es';

const TEXTS: Readonly<Record<Language, Readonly<Record<TextKey, string>>>> = { es };

let language: Language = 'es';

export function setLanguage(lang: Language): void {
  language = lang;
}

export function t(key: TextKey): string {
  return TEXTS[language][key];
}
