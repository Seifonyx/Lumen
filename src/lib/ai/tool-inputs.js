export const toolModel = (id) => /^gemini:gemini-/.test(id || '');
export const hasVideo = (messages) => messages.some(m => (m.files || []).some(f => f.videoUri));
export function safeVideoUri(value) {
  if (typeof value !== 'string' || !/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(value)) throw new Error('Invalid YouTube video link. Add it again through Tools.');
  return value;
}

// The model may emit Markdown fence characters inside tool output. Choose a longer fence.
export function toolBlock(language, value) {
  const text = String(value || '');
  let size = 3;
  for (const match of text.matchAll(/`+/g)) size = Math.max(size, match[0].length + 1);
  const fence = '`'.repeat(size);
  return `\n\n${fence}${language}\n${text}\n${fence}\n\n`;
}
