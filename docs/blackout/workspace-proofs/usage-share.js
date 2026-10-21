// Preview-only display rule for usage shares. Canonical UsageMeter data and its numeric meter values are unchanged.
// A small nonzero share must not read as "0%", and a share just under the limit must not read as "100%".
/**
 * @param {number} used
 * @param {number} limit
 * @returns {{label: string, text: string, arc: number}} label for the gauge, spoken text, and visual arc (0–1)
 */
export function usageShare(used, limit) {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return { label: '—', text: 'Not reported', arc: 0 };
  const share = Math.max(0, used) / limit * 100;
  if (share <= 0) return { label: '0%', text: '0% used', arc: 0 };
  if (share >= 100) return { label: '100%', text: '100% used', arc: 1 };
  if (share < 1) return { label: '<1%', text: 'Less than 1% used', arc: 0.02 };
  if (share > 99) return { label: '>99%', text: 'More than 99% used', arc: 0.99 };
  const rounded = Math.round(share);
  return { label: `${rounded}%`, text: `About ${rounded}% used`, arc: share / 100 };
}
