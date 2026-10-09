// Privacy shield: finds personal or sensitive details in what's about to be sent to a free model
// and swaps them for placeholders like [PHONE_1]. Runs entirely on this device. Replies come back
// with the placeholders, which the app turns back into the real values for you to read.

export type Kind = 'NAME' | 'PHONE' | 'EMAIL' | 'NATIONAL_ID' | 'CARD' | 'IBAN' | 'RECORD' | 'BIRTH_DATE' | 'SECRET';

export const KIND_LABEL: Record<Kind, string> = {
  NAME: 'Patient name',
  PHONE: 'Phone number',
  EMAIL: 'Email address',
  NATIONAL_ID: 'National ID',
  CARD: 'Card number',
  IBAN: 'Bank account (IBAN)',
  RECORD: 'Medical record / file number',
  BIRTH_DATE: 'Date of birth',
  SECRET: 'Password or key',
};

export interface Finding {
  kind: Kind;
  value: string;
  start: number;
  end: number;
}

/** Arabic-Indic and Persian digits → 0-9, keeping every character in place. */
const latinDigits = (s: string) => s.replace(/[٠-٩۰-۹]/g, (d) => String((d.charCodeAt(0) & 0xf) % 10));

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Egyptian national ID: 14 digits, century 2/3, then a real YYMMDD birth date. */
function egyptianId(id: string): boolean {
  if (!/^[23]\d{13}$/.test(id)) return false;
  const month = Number(id.slice(3, 5));
  const day = Number(id.slice(5, 7));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

const DATE = String.raw`(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})`;
const NAME_WORD = String.raw`(?:[A-Z][a-z'’-]+|[ء-ي][ء-يً-ْ]+)`;

type Rule = { kind: Kind; re: RegExp; group?: number; valid?: (m: string) => boolean };

const RULES: Rule[] = [
  { kind: 'SECRET', re: /\b(?:AIza[0-9A-Za-z_\-]{35}|sk-(?:or-|proj-|ant-)?[A-Za-z0-9_\-]{20,}|ghp_[A-Za-z0-9]{30,}|xox[abp]-[A-Za-z0-9\-]{10,})\b/g },
  { kind: 'SECRET', re: /\b(?:password|passcode|passwd|pwd|pin|كلمة (?:السر|المرور))\s*(?:is|=|:|هي)?\s*["“']?([^\s"”',;]{4,})/gi, group: 1 },
  { kind: 'EMAIL', re: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g },
  { kind: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g, valid: (m) => m.replace(/ /g, '').length >= 15 },
  { kind: 'NATIONAL_ID', re: /(?<!\d)[23]\d{13}(?!\d)/g, valid: egyptianId },
  { kind: 'CARD', re: /(?<!\d)(?:\d[ \-]?){12,18}\d(?!\d)/g, valid: (m) => luhn(m.replace(/\D/g, '')) && !/^(\d)\1+$/.test(m.replace(/\D/g, '')) },
  // Egyptian mobiles (01x…), +20/0020 numbers, and other international numbers.
  { kind: 'PHONE', re: /(?<![\d+])(?:(?:\+|00)20[\s\-]?)?0?1[0125](?:[\s\-]?\d){8}(?!\d)/g },
  { kind: 'PHONE', re: /(?<![\w+])\+(?!20)\d{1,3}[\s\-]?(?:\(?\d{1,4}\)?[\s\-]?){2,4}\d{2,4}(?!\d)/g, valid: (m) => m.replace(/\D/g, '').length >= 8 },
  { kind: 'PHONE', re: /(?<!\d)0(?:2|3|\d{2})[\s\-]?\d{7,8}(?!\d)/g },
  {
    kind: 'RECORD',
    re: /\b(?:MRN|medical record(?: number| no\.?)?|record (?:no|number)\.?|file (?:no|number)\.?|patient (?:id|no\.?|number)|hospital (?:no|number)\.?|رقم (?:الملف|المريض|السجل))\s*[:#.\-]?\s*([A-Za-z]{0,3}[\-\/]?\d[\d\-\/]{2,})/gi,
    group: 1,
  },
  { kind: 'BIRTH_DATE', re: new RegExp(String.raw`\b(?:DOB|D\.O\.B\.?|date of birth|born(?: on)?|birth ?date|تاريخ الميلاد|مواليد)\s*[:\-]?\s*(${DATE})`, 'gi'), group: 1 },
  // Names right after "patient", "Mr/Mrs", "name:" or their Arabic equivalents.
  {
    kind: 'NAME',
    re: new RegExp(String.raw`(?:\b(?:[Pp]atient(?: [Nn]ame)?|PATIENT|[Pp]t\.?|[Nn]ame|NAME|M(?:r|rs|s|iss)\.?)\s*[:\-]?\s+|(?:المريض(?:ة)?|اسم المريض(?:ة)?|المريض اسمه|الاسم|السيد(?:ة)?)\s*[:\-]?\s*)(${NAME_WORD}(?:\s+${NAME_WORD}){0,3})`, 'g'),
    group: 1,
  },
];

const STOP_NAMES = /^(?:is|was|has|had|with|and|the|who|which|presented|presents|came|needs|in|on|at|of|for|to|a|an|data|details|information|list|record|records|file|files|names?)$/i;

/** Finds sensitive details in text. Overlaps go to the longest match. */
export function scan(text: string): Finding[] {
  if (!text) return [];
  const src = latinDigits(text);
  const found: Finding[] = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    for (let m: RegExpExecArray | null; (m = rule.re.exec(src)); ) {
      const value = rule.group ? m[rule.group] : m[0];
      if (!value) continue;
      const start = m.index + (rule.group ? m[0].lastIndexOf(value) : 0);
      let clean = value.replace(/[\s\-]+$/, '');
      if (rule.kind === 'NAME') {
        // Cut the name at the first ordinary word ("Ahmed Ali presented …").
        const words = clean.split(/\s+/);
        const keep = [];
        for (const w of words) {
          if (STOP_NAMES.test(w)) break;
          keep.push(w);
        }
        clean = keep.join(' ');
        if (!clean || clean.length < 3) continue;
      }
      if (rule.valid && !rule.valid(clean)) continue;
      found.push({ kind: rule.kind, value: text.slice(start, start + clean.length), start, end: start + clean.length });
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const out: Finding[] = [];
  for (const f of found) {
    const last = out[out.length - 1];
    if (last && f.start < last.end) {
      if (f.end - f.start > last.end - last.start) out[out.length - 1] = f;
      continue;
    }
    out.push(f);
  }
  return out;
}

/**
 * Placeholders shared across a whole conversation, so the same phone number is always [PHONE_1]
 * and a model's reply can be turned back into real values.
 */
export class Masker {
  private byValue = new Map<string, string>();
  private byToken = new Map<string, string>();
  private counts = new Map<Kind, number>();

  private key(kind: Kind, value: string) {
    return `${kind}:${latinDigits(value).replace(/[\s\-().]/g, '').toLowerCase()}`;
  }

  token(kind: Kind, value: string): string {
    const k = this.key(kind, value);
    let t = this.byValue.get(k);
    if (!t) {
      const n = (this.counts.get(kind) || 0) + 1;
      this.counts.set(kind, n);
      t = `[${kind}_${n}]`;
      this.byValue.set(k, t);
      this.byToken.set(t, value);
    }
    return t;
  }

  /** Replaces everything found in `text`, plus any detail already seen earlier in the chat. */
  mask(text: string): { text: string; count: number } {
    const found = scan(text);
    // Details found before (e.g. a name in an earlier message) are hidden wherever they appear again,
    // such as in a model's reply that was shown with the real values.
    for (const [token, value] of this.byToken) {
      if (value.length < 3) continue;
      const re = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'gi');
      for (let m: RegExpExecArray | null; (m = re.exec(text)); ) {
        const start = m.index;
        const end = start + m[0].length;
        if (found.some((f) => start < f.end && end > f.start)) continue;
        found.push({ kind: token.slice(1, token.lastIndexOf('_')) as Kind, value, start, end });
      }
    }
    found.sort((x, y) => x.start - y.start);
    if (!found.length) return { text, count: 0 };
    let out = '';
    let at = 0;
    for (const f of found) {
      out += text.slice(at, f.start) + this.token(f.kind, f.value);
      at = f.end;
    }
    return { text: out + text.slice(at), count: found.length };
  }

  /** Puts the real values back into a model's reply. */
  unmask(text: string): string {
    if (!this.byToken.size) return text;
    return text.replace(/\[(NAME|PHONE|EMAIL|NATIONAL_ID|CARD|IBAN|RECORD|BIRTH_DATE|SECRET)_(\d+)\]/g, (t) => this.byToken.get(t) ?? t);
  }

  get size() {
    return this.byToken.size;
  }
}

/** Shows only the ends of a value, e.g. 010•••••678. */
export function obscure(v: string): string {
  if (v.length <= 4) return '•'.repeat(v.length);
  const keep = Math.min(3, Math.floor(v.length / 4));
  return v.slice(0, keep) + '•'.repeat(Math.max(3, v.length - keep * 2)) + v.slice(-keep);
}
