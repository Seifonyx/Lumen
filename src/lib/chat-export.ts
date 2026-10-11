import type { Chat } from '../types';
import { modelShortName, safeFileName } from './util';

const inline = (value: string) => value.replace(/[\r\n]+/g, ' ').replace(/[\\`*_[\]<>#]/g, char => `\\${char}`);
export function chatToMarkdown(chat: Chat): string {
  const lines = [`# ${inline(chat.title)}`, ''];
  if (chat.summary?.from) lines.push('_This chat continues an earlier conversation._', '', '## Earlier conversation summary', '', chat.summary.text, '');
  for (const message of chat.messages) {
    lines.push(message.role === 'user' ? '## You' : `## Assistant${message.model ? ` · ${inline(modelShortName(message.model))}` : ''}`, '');
    if (message.files?.length) lines.push(`Attachments: ${message.files.map(file => inline(file.name)).join(', ')}`, '');
    if (message.text) lines.push(message.text, '');
    if (message.error) lines.push(`Error: ${inline(message.error)}`, '');
    if (message.status === 'stopped' || message.status === 'streaming') lines.push('_Reply incomplete._', '');
    if (message.sources?.length) {
      lines.push('Sources:', ...message.sources.filter(source => /^https?:\/\//i.test(source.url)).map(source => `- [${inline(source.title)}](<${source.url.replace(/[<>\r\n]/g, '')}>)`), '');
    }
  }
  for (const doc of chat.documents || []) lines.push(`## Canvas · ${inline(doc.name)}`, '', doc.content, '');
  return lines.join('\n');
}
export function chatExportName(chat: Chat, extension: 'md' | 'docx' | 'pdf'): string {
  return `${safeFileName(chat.title, 'Chat')}.${extension}`;
}
export function chatDocumentContent(chat: Chat): string {
  // JSON title metadata is separate from the Markdown and never interprets user HTML as settings.
  const config = JSON.stringify({ title: chat.title, header: 'Conversation', theme: '355E4E' }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `<!-- ${config} -->\n${chatToMarkdown(chat).replace(/^# .*\n/, '')}`;
}
