// Splits the in-app test files across CI machines (E2E_SHARD=i/n, see scripts/test-e2e.mjs). Each machine starts its own
// emulators, so suites that share them can be split as well as the isolated ones. Each group is balanced on its own by
// recorded duration: longest first, onto the machine with the least work so far (ties: the lower number). The result
// depends only on the file list and timings, so every machine computes the same split.

/** Parses "i/n" (1-based). Returns null when unset. */
export function parseShard(value) {
  if (!value) return null;
  const m = /^(\d+)\/(\d+)$/.exec(value);
  const index = m && Number(m[1]), count = m && Number(m[2]);
  if (!m || count < 1 || index < 1 || index > count) throw new Error(`E2E_SHARD must look like 2/4, not "${value}"`);
  return { index, count };
}

/** Files for machine `index` of `count`; `groups` are lists of file names, `duration(file)` is in seconds. */
export function shardFiles(groups, { index, count }, duration) {
  const mine = [];
  for (const group of groups) {
    const load = Array(count).fill(0);
    const order = [...group].sort((a, b) => duration(b) - duration(a) || a.localeCompare(b));
    for (const file of order) {
      let target = 0;
      for (let i = 1; i < count; i++) if (load[i] < load[target]) target = i;
      load[target] += duration(file);
      if (target === index - 1) mine.push(file);
    }
  }
  return mine.sort();
}
