// One quiet line of a chat for lists (Canvas): Markdown syntax stripped, and nothing when it would only repeat the
// title. Text only; never parsed as HTML.
export function chatPreview(text: string | undefined, title: string): string {
  const plain = (text || '')
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/gm, '')
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/(^|[^\p{L}\p{N}])(\*\*|__|~~|\*|_)(?=\S)(.*?\S)\2(?![\p{L}\p{N}])/gu, '$1$3')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  if (!plain || norm(plain) === norm(title)) return '';
  return plain.slice(0, 120);
}
