export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  bg: string;
  surface: string;
  card: string;
  /** Hairline / panel borders (typically slightly above `card` luminance). */
  border: string;
  primary: string;
  primaryHover: string;
  success: string;
  warning: string;
  destructive: string;
  textPrimary: string;
  textMuted: string;
}

export const themes: Theme[] = [
  {
    id: 'deep-space',
    name: 'Deep Space',
    dark: true,
    bg: '#121212',
    surface: '#1a1a1a',
    card: '#232323',
    border: '#333333',
    primary: '#6c8aff',
    primaryHover: '#8ba1ff',
    success: '#34d399',
    warning: '#fbbf24',
    destructive: '#f87171',
    textPrimary: '#e8e8ea',
    textMuted: '#737373',
  },
  {
    id: 'carbon',
    name: 'Carbon',
    dark: true,
    bg: '#111111',
    surface: '#1c1c1c',
    card: '#242424',
    border: '#333333',
    primary: '#3b82f6',
    primaryHover: '#60a5fa',
    success: '#22c55e',
    warning: '#fbbf24',
    destructive: '#f87171',
    textPrimary: '#f5f5f5',
    textMuted: '#737373',
  },
  {
    id: 'terminal-green',
    name: 'Terminal Green',
    dark: true,
    bg: '#0a0a0a',
    surface: '#141414',
    card: '#1c1c1c',
    border: '#2a2a2a',
    primary: '#00ff41',
    primaryHover: '#00cc33',
    success: '#00ff41',
    warning: '#ffd60a',
    destructive: '#ff453a',
    textPrimary: '#e8ebe8',
    textMuted: '#737373',
  },
  {
    id: 'midnight-violet',
    name: 'Midnight Violet',
    dark: true,
    bg: '#0e0e0e',
    surface: '#161616',
    card: '#202020',
    border: '#2f2f2f',
    primary: '#7c6af5',
    primaryHover: '#9585f8',
    success: '#4ade80',
    warning: '#fbbf24',
    destructive: '#f87171',
    textPrimary: '#f4f4f5',
    textMuted: '#737373',
  },
  {
    id: 'ember',
    name: 'Ember',
    dark: true,
    bg: '#121212',
    surface: '#181818',
    card: '#222222',
    border: '#303030',
    primary: '#e53e3e',
    primaryHover: '#f56565',
    success: '#68d391',
    warning: '#f6ad55',
    destructive: '#fc8181',
    textPrimary: '#f2f0f0',
    textMuted: '#737373',
  },
  {
    id: 'bloodline',
    name: 'Bloodline',
    dark: true,
    bg: '#0d0d0d',
    surface: '#161616',
    card: '#1f1f1f',
    border: '#2e2e2e',
    primary: '#cc2222',
    primaryHover: '#e53e3e',
    success: '#4ade80',
    warning: '#facc15',
    destructive: '#f87171',
    textPrimary: '#f5f5f5',
    textMuted: '#737373',
  },
  {
    id: 'oled',
    name: 'OLED',
    dark: true,
    bg: '#0c0c0c',
    surface: '#141414',
    card: '#1c1c1c',
    border: '#2a2a2a',
    primary: '#ff2d55',
    primaryHover: '#ff4d72',
    success: '#4ade80',
    warning: '#fbbf24',
    destructive: '#f87171',
    textPrimary: '#f4f4f5',
    textMuted: '#737373',
  },
  {
    id: 'infrared',
    name: 'Infrared',
    dark: true,
    bg: '#0a0a0a',
    surface: '#141414',
    card: '#1c1c1c',
    border: '#2a2a2a',
    primary: '#ff2d55',
    primaryHover: '#ff4d72',
    success: '#30d158',
    warning: '#ffd60a',
    destructive: '#ff453a',
    textPrimary: '#f2f2f7',
    textMuted: '#737373',
  },
  {
    id: 'taskscape',
    name: 'Taskscape',
    dark: false,
    bg: '#f3f4f6',
    surface: '#ffffff',
    card: '#ffffff',
    border: '#e5e7eb',
    primary: '#4f46e5',
    primaryHover: '#4338ca',
    success: '#059669',
    warning: '#d97706',
    destructive: '#dc2626',
    textPrimary: '#111827',
    textMuted: '#6b7280',
  },
  {
    id: 'cloud',
    name: 'Cloud',
    dark: false,
    bg: '#f5f5f6',
    surface: '#ebebec',
    card: '#e0e0e3',
    border: '#d1d1d6',
    primary: '#4f6ef7',
    primaryHover: '#3b5af5',
    success: '#12a06e',
    warning: '#d97706',
    destructive: '#dc2626',
    textPrimary: '#111827',
    textMuted: '#52525b',
  },
  {
    id: 'cream',
    name: 'Cream',
    dark: false,
    bg: '#faf9f7',
    surface: '#efeeeb',
    card: '#e6e4df',
    border: '#d9d6cf',
    primary: '#b45309',
    primaryHover: '#92400e',
    success: '#059669',
    warning: '#d97706',
    destructive: '#dc2626',
    textPrimary: '#1c1917',
    textMuted: '#78716c',
  },
  {
    id: 'frost',
    name: 'Frost',
    dark: false,
    bg: '#f4f4f5',
    surface: '#e8e8ea',
    card: '#dcdce0',
    border: '#cecfd4',
    primary: '#0284c7',
    primaryHover: '#0369a1',
    success: '#059669',
    warning: '#d97706',
    destructive: '#dc2626',
    textPrimary: '#0f172a',
    textMuted: '#52525b',
  },
  {
    id: 'sakura',
    name: 'Sakura',
    dark: false,
    bg: '#faf8f9',
    surface: '#f0eef0',
    card: '#e6e2e6',
    border: '#d8d2d8',
    primary: '#db2777',
    primaryHover: '#be185d',
    success: '#059669',
    warning: '#d97706',
    destructive: '#dc2626',
    textPrimary: '#1f1720',
    textMuted: '#6b6570',
  },
];

export const DEFAULT_THEME_ID = 'taskscape';
export const DEFAULT_DARK_THEME_ID = 'deep-space';
export const DEFAULT_LIGHT_THEME_ID = 'taskscape';

export type AppearanceChoice = 'auto' | 'dark' | 'light';

/** Maps stored user settings to the simplified Auto / Light / Dark control. */
export function deriveAppearanceChoice(settings: {
  autoTheme: boolean;
  darkTheme: string | null;
  lightTheme: string | null;
}): AppearanceChoice {
  if (settings.autoTheme) {
    return 'auto';
  }
  if (settings.darkTheme && !settings.lightTheme) {
    return 'dark';
  }
  if (settings.lightTheme && !settings.darkTheme) {
    return 'light';
  }
  if (settings.darkTheme && settings.lightTheme) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'auto';
}

export function settingsPatchForAppearance(choice: AppearanceChoice): {
  autoTheme: boolean;
  darkTheme: string | null;
  lightTheme: string | null;
} {
  if (choice === 'auto') {
    return {
      autoTheme: true,
      darkTheme: DEFAULT_DARK_THEME_ID,
      lightTheme: DEFAULT_LIGHT_THEME_ID,
    };
  }
  if (choice === 'dark') {
    return {
      autoTheme: false,
      darkTheme: DEFAULT_DARK_THEME_ID,
      lightTheme: null,
    };
  }
  return {
    autoTheme: false,
    darkTheme: null,
    lightTheme: DEFAULT_LIGHT_THEME_ID,
  };
}

export function resolveStoredThemeId(themeId: string): string {
  return themeId === 'rust' ? 'oled' : themeId;
}

export function getThemeById(themeId: string): Theme | undefined {
  const resolvedId = resolveStoredThemeId(themeId);
  return themes.find((t) => t.id === resolvedId);
}

export function getDefaultTheme(): Theme {
  return getThemeById(DEFAULT_THEME_ID) ?? themes[0]!;
}

export function migrateLegacyThemeLocalStorage(): void {
  for (const key of ['theme', 'darkTheme', 'lightTheme'] as const) {
    const value = localStorage.getItem(key);
    if (value === 'rust') {
      localStorage.setItem(key, 'oled');
    }
  }
}

function isLightHex(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 127.5;
}

export function applyTheme(themeId: string): void {
  migrateLegacyThemeLocalStorage();
  const resolvedId = resolveStoredThemeId(themeId);
  const theme = themes.find((t) => t.id === resolvedId) ?? getDefaultTheme();
  const root = document.documentElement;
  root.style.setProperty('--color-bg', theme.bg);
  root.style.setProperty('--color-surface', theme.surface);
  root.style.setProperty('--color-card', theme.card);
  root.style.setProperty('--color-input', theme.surface);
  root.style.setProperty('--color-border', theme.border);
  root.style.setProperty('--color-primary', theme.primary);
  root.style.setProperty('--color-primary-hover', theme.primaryHover);
  root.style.setProperty('--color-success', theme.success);
  root.style.setProperty('--color-warning', theme.warning);
  root.style.setProperty('--color-destructive', theme.destructive);
  root.style.setProperty('--color-text-primary', theme.textPrimary);
  root.style.setProperty('--color-text-muted', theme.textMuted);
  root.style.setProperty('--color-info', '#64748b');
  root.style.setProperty('--color-fg', isLightHex(theme.bg) ? '#000000' : '#ffffff');
  root.setAttribute('data-theme', theme.dark ? 'dark' : 'light');
  document.body.style.background = theme.bg;
  document.body.style.color = theme.textPrimary;
}

export function resolveAutoTheme(
  darkThemeId: string | null,
  lightThemeId: string | null,
): string {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) {
    return resolveStoredThemeId(darkThemeId ?? DEFAULT_DARK_THEME_ID);
  }
  return resolveStoredThemeId(lightThemeId ?? DEFAULT_LIGHT_THEME_ID);
}

let colorSchemeListener: ((event: MediaQueryListEvent) => void) | null = null;
let colorSchemeQuery: MediaQueryList | null = null;

/** Watches system light/dark preference and reapplies the active preset (reads dark/light ids from localStorage). */
export function watchAutoTheme(): void {
  stopWatchAutoTheme();
  colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  colorSchemeListener = () => {
    const darkId = localStorage.getItem('darkTheme');
    const lightId = localStorage.getItem('lightTheme');
    applyTheme(resolveAutoTheme(darkId, lightId));
  };
  colorSchemeQuery.addEventListener('change', colorSchemeListener);
}

export function stopWatchAutoTheme(): void {
  if (colorSchemeQuery && colorSchemeListener) {
    colorSchemeQuery.removeEventListener('change', colorSchemeListener);
  }
  colorSchemeQuery = null;
  colorSchemeListener = null;
}

export function applyUserThemePreferences(settings: {
  autoTheme: boolean;
  darkTheme: string | null;
  lightTheme: string | null;
}): void {
  if (settings.autoTheme) {
    const dark = settings.darkTheme ?? DEFAULT_DARK_THEME_ID;
    const light = settings.lightTheme ?? DEFAULT_LIGHT_THEME_ID;
    localStorage.setItem('darkTheme', dark);
    localStorage.setItem('lightTheme', light);
    applyTheme(resolveAutoTheme(settings.darkTheme, settings.lightTheme));
    watchAutoTheme();
    return;
  }
  stopWatchAutoTheme();
  const d = settings.darkTheme;
  const l = settings.lightTheme;
  if (d && !l) {
    localStorage.setItem('darkTheme', d);
    localStorage.setItem('lightTheme', DEFAULT_LIGHT_THEME_ID);
    applyTheme(resolveStoredThemeId(d));
  } else if (l && !d) {
    localStorage.setItem('darkTheme', DEFAULT_DARK_THEME_ID);
    localStorage.setItem('lightTheme', l);
    applyTheme(resolveStoredThemeId(l));
  } else if (d && l) {
    localStorage.setItem('darkTheme', d);
    localStorage.setItem('lightTheme', l);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(resolveStoredThemeId(prefersDark ? d : l));
  } else {
    localStorage.setItem('darkTheme', DEFAULT_DARK_THEME_ID);
    localStorage.setItem('lightTheme', DEFAULT_LIGHT_THEME_ID);
    applyTheme(resolveStoredThemeId(DEFAULT_LIGHT_THEME_ID));
  }
}
