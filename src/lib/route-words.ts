// Canvas route line in plain words: "Picked by Auto for writing". The stored route is Auto's reason for its pick
// (src/lib/routing.ts REASONS); anything else is shown as it was recorded.
const FOR: Record<string, string> = {
  'reads images': 'for an image',
  'can search the web': 'to search the web',
  'handles long conversations': 'for a long conversation',
  'reads PDFs directly': 'for a PDF',
  'reliable at making files': 'to make files',
  'good at code': 'for code',
  'thinks step by step': 'for step-by-step reasoning',
  'strong in Arabic': 'for Arabic',
  'strong writer': 'for writing',
  'fast for quick replies': 'for a quick reply',
  'quick reply': 'for a quick reply',
  'best available': 'as the best match',
};

export function routeWords(route: string | undefined, by = 'Auto'): string {
  if (!route) return `Picked by ${by}`;
  const words = FOR[route.trim()];
  return words ? `Picked by ${by} ${words}` : `Picked by ${by}: ${route}`;
}
