// Entry point for files the model writes: what kind of file it is, and how to build it.
// Heavy libraries are loaded only when a file is actually built.

import { extOf } from '../util';
import { parseDeck } from './deck-spec';
import { parseWorkbook } from './sheet-spec';

export type FileKind = 'docx' | 'xlsx' | 'pptx' | 'pdf' | 'csv' | 'html' | 'markdown' | 'code' | 'text' | 'unsupported';

export interface FileKindInfo {
  kind: FileKind;
  label: string;
}

const CODE_EXT = /^(js|jsx|ts|tsx|py|java|c|cpp|h|cs|go|rs|rb|php|sql|css|scss|sh|bat|json|xml|yaml|yml|toml|ini|svg)$/;

export function fileKind(name: string): FileKindInfo {
  const ext = extOf(name);
  if (ext === 'docx') return { kind: 'docx', label: 'Word document' };
  if (ext === 'xlsx') return { kind: 'xlsx', label: 'Excel workbook' };
  if (ext === 'pptx') return { kind: 'pptx', label: 'PowerPoint deck' };
  if (ext === 'pdf') return { kind: 'pdf', label: 'PDF document' };
  if (ext === 'csv' || ext === 'tsv') return { kind: 'csv', label: 'CSV spreadsheet' };
  if (ext === 'html' || ext === 'htm') return { kind: 'html', label: 'Web page' };
  if (ext === 'md' || ext === 'markdown') return { kind: 'markdown', label: 'Markdown' };
  if (CODE_EXT.test(ext)) return { kind: 'code', label: `${ext.toUpperCase()} file` };
  if (['doc', 'xls', 'ppt', 'png', 'jpg', 'jpeg', 'gif', 'mp3', 'mp4', 'zip'].includes(ext)) return { kind: 'unsupported', label: `${ext.toUpperCase()} file` };
  return { kind: 'text', label: ext ? `${ext.toUpperCase()} file` : 'Text file' };
}

const TEXT_MIME: Record<string, string> = {
  csv: 'text/csv', tsv: 'text/tab-separated-values', txt: 'text/plain', md: 'text/markdown', html: 'text/html', htm: 'text/html',
  json: 'application/json', xml: 'application/xml', js: 'text/javascript', py: 'text/x-python', css: 'text/css', svg: 'image/svg+xml',
};

export async function buildFile(name: string, content: string): Promise<Blob> {
  const { kind } = fileKind(name);
  if (kind === 'docx') {
    const { buildDocx } = await import('./docx');
    return buildDocx(content);
  }
  if (kind === 'xlsx') {
    const { buildXlsx } = await import('./xlsx');
    const spec = parseWorkbook(content);
    if (!spec) throw new Error("the model didn't include any table data for this workbook.");
    return buildXlsx(spec);
  }
  if (kind === 'pptx') {
    const { buildPptx } = await import('./pptx');
    const deck = parseDeck(content);
    if (!deck) throw new Error("the model's slide data couldn't be read. Ask it to try again.");
    return buildPptx(deck);
  }
  if (kind === 'unsupported') throw new Error(`${name.split('.').pop()} files can't be created here. Ask for Word, Excel, PowerPoint or PDF instead.`);
  const ext = extOf(name);
  // Excel only reads Arabic in CSV files correctly when they start with a byte-order mark.
  const body = kind === 'csv' ? '\uFEFF' + content : content;
  return new Blob([body], { type: `${TEXT_MIME[ext] || 'text/plain'};charset=utf-8` });
}
