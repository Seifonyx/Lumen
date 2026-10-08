// Parsing helpers for the file specs that models write (lenient JSON, settings comments, themes).

/** Parses JSON that may contain // or /* comments, trailing commas, or a ```json wrapper. */
export function parseLooseJson<T = any>(text: string): T | null {
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      out += ch;
      if (ch === '\\') out += s[++i] ?? '';
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
      out += ch;
    } else if (ch === '/' && s[i + 1] === '/') {
      while (i < s.length && s[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && s[i + 1] === '*') {
      i = s.indexOf('*/', i + 2);
      if (i < 0) break;
      i++;
    } else out += ch;
  }
  s = out.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export interface DocConfig {
  title?: string;
  subtitle?: string;
  author?: string;
  date?: string;
  cover?: boolean;
  theme?: string;
  header?: string;
  footer?: boolean;
  font?: string;
}

/** Splits an optional leading <!-- {settings} --> comment from a Markdown document. */
export function splitDocConfig(content: string): { config: DocConfig; body: string } {
  const m = /^\s*<!--\s*(\{[\s\S]*?\})\s*-->\s*/.exec(content);
  if (!m) return { config: {}, body: content };
  return { config: parseLooseJson<DocConfig>(m[1]) || {}, body: content.slice(m[0].length) };
}

export const hex = (c: string | undefined, fallback: string) => {
  const v = (c || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^[0-9a-f]{3}$/i.test(v)) return v.split('').map((x) => x + x).join('').toUpperCase();
  return fallback;
};

export interface DeckTheme {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  dark: boolean;
  palette: string[];
}

const PRESETS: Record<string, Omit<DeckTheme, 'palette'> & { palette?: string[] }> = {
  ocean: { primary: '1F4E79', accent: '2E9CCA', background: 'FFFFFF', surface: 'EAF2F8', text: '1B263B', muted: '5B6B7F', dark: false },
  forest: { primary: '2D5A3D', accent: '8DB580', background: 'FFFFFF', surface: 'EEF5EC', text: '1E2B22', muted: '5D6B60', dark: false },
  sunset: { primary: 'B83B2E', accent: 'F39C12', background: 'FFFDF9', surface: 'FDF0E6', text: '2B1D16', muted: '7A6156', dark: false },
  berry: { primary: '6C3483', accent: 'E84393', background: 'FFFFFF', surface: 'F5EEF8', text: '2A1A33', muted: '6E5A78', dark: false },
  midnight: { primary: '38BDF8', accent: 'F472B6', background: '0F172A', surface: '1E293B', text: 'E2E8F0', muted: '94A3B8', dark: true },
  slate: { primary: '334155', accent: '0EA5E9', background: 'FFFFFF', surface: 'F1F5F9', text: '0F172A', muted: '64748B', dark: false },
  medical: { primary: '0E7C86', accent: 'E63946', background: 'FFFFFF', surface: 'E8F6F7', text: '12343B', muted: '587A80', dark: false },
};

export function deckTheme(input: any): DeckTheme {
  const preset = PRESETS[String(input?.preset || '').toLowerCase()] || PRESETS.ocean;
  const dark = typeof input?.dark === 'boolean' ? input.dark : preset.dark;
  const base = dark && !preset.dark ? { ...preset, background: '111827', surface: '1F2937', text: 'F3F4F6', muted: '9CA3AF' } : preset;
  const primary = hex(input?.primary, base.primary);
  const accent = hex(input?.accent, base.accent);
  return {
    ...base,
    dark,
    primary,
    accent,
    background: hex(input?.background, base.background),
    text: hex(input?.text, base.text),
    palette: [primary, accent, '70AD47', 'FFC000', '7F6084', '4BACC6', 'F79646', 'A5A5A5'],
  };
}
