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
  fontSize: 'auto',
  enterToSend: true,
  haptics: true,
  sendSound: false,
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

/**
 * Text size "Auto": on iPhone and iPad, follow the text size set in iOS (Safari exposes it through the
 * -apple-system-body font; 17px is the standard size, Lumen's standard is 15px). Elsewhere it's the standard size.
 */
let phoneTextWatch = false;
function applyPhoneTextSize(on: boolean) {
  const root = document.documentElement;
  if (!on) { root.style.removeProperty('--fs'); return; }
  let px = 17;
  if (typeof CSS !== 'undefined' && CSS.supports('font', '-apple-system-body')) {
    const probe = document.createElement('span');
    probe.style.cssText = 'font: -apple-system-body; position: absolute; visibility: hidden';
    document.body.append(probe);
    px = parseFloat(getComputedStyle(probe).fontSize) || 17;
    probe.remove();
  }
  root.style.setProperty('--fs', `${Math.max(13, Math.min(26, Math.round((px * 15) / 17 * 2) / 2))}px`);
  // The iOS setting can change while the app is in the background.
  if (!phoneTextWatch) {
    phoneTextWatch = true;
    document.addEventListener('visibilitychange', () => { if (!document.hidden && root.dataset.font === 'auto') applyPhoneTextSize(true); });
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
  applyPhoneTextSize(s.fontSize === 'auto');
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

/** Reply language and answer length, as instructions for every model. With no reply language chosen, the
 *  reply follows the language of the person's latest message: other context (memories, project names and
 *  notes, files, earlier messages) can be in another language, and some models would otherwise copy it. */
export function styleInstructions(settings: Pick<Settings, 'replyLanguage' | 'answerLength'>): string {
  const out: string[] = [];
  if (settings.replyLanguage) out.push(`Always reply in ${settings.replyLanguage}, whatever language the user writes in, unless they ask for another language.`);
  else out.push("Reply in the language of the user's latest message. Memories, project names and notes, files and earlier messages may be in other languages; they don't change the language you reply in.");
  if (settings.answerLength === 'short') out.push('Keep answers short: lead with the answer in a few sentences or bullets, and only go longer when the task clearly needs it.');
  else if (settings.answerLength === 'detailed') out.push('Give thorough answers: explain the reasoning, cover the important details and caveats, and include examples where they help.');
  return out.join('\n');
}
