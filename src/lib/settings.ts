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

export function applyAppearance(s: Settings) {
  const root = document.documentElement;
  if (s.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = s.theme === 'black' ? 'dark' : s.theme;
  if (s.theme === 'black') root.dataset.appearance = 'black';
  else delete root.dataset.appearance;
  root.dataset.font = s.fontSize;
}
