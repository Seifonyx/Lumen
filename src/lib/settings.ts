import type { Settings } from '../types';

const KEY = 'mr.settings';

export const DEFAULT_SETTINGS: Settings = {
  enabledModels: [],
  defaultModel: '',
  autoSwitch: true,
  webSearch: false,
  showThinking: true,
  customInstructions: '',
  theme: 'system',
  fontSize: 'medium',
  enterToSend: true,
  haptics: true,
  autoTitle: true,
  autoCompact: true,
  memory: true,
  memoryAuto: true,
  privacyShield: false,
  privacyMode: 'ask',
  privacyRestore: true,
  voiceLang: '',
};

export function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

const BAR = { light: '#f6f7f9', dark: '#0d0f12', black: '#000000' } as const;

export function applyAppearance(s: Settings) {
  const root = document.documentElement;
  const before = `${root.dataset.theme || ''}|${root.dataset.appearance || ''}`;
  if (s.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = s.theme === 'black' ? 'dark' : s.theme;
  if (s.theme === 'black') root.dataset.appearance = 'black';
  else delete root.dataset.appearance;
  root.dataset.font = s.fontSize;
  // Status bar colour on phones: the chosen theme, or the system's (the two media-specific tags) for Auto.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = s.theme === 'system' ? (m.media.includes('dark') ? BAR.dark : BAR.light) : BAR[s.theme as keyof typeof BAR] || BAR.light;
  });
  // Switching theme repaints everything in one frame: no element fades on its own and leaves the page
  // half light, half dark for a moment.
  if (before !== `${root.dataset.theme || ''}|${root.dataset.appearance || ''}`) {
    root.classList.add('theme-switching');
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
  }
}
