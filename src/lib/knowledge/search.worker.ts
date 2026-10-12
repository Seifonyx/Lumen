import { chunkBatch } from "./db";
import { scoreChunk, type KnowledgeHit } from "./core";
self.onmessage = async (
  event: MessageEvent<{
    uid: string;
    ids: string[];
    query: string;
    vector?: Float32Array;
  }>,
) => {
  try {
    const { uid, ids, query, vector } = event.data,
      allowed = new Set(ids);
    let after: string | undefined;
    const best = new Map<string, KnowledgeHit>();
    while (true) {
      const batch = await chunkBatch(uid, after);
      if (!batch.length) break;
      for (const chunk of batch) {
        if (!allowed.has(chunk.docId)) continue;
        const score = scoreChunk(chunk, query, vector);
        if (score <= 0) continue;
        const id = `${chunk.docId}:${chunk.page}`;
        if (score > (best.get(id)?.score || 0))
          best.set(id, {
            docId: chunk.docId,
            page: chunk.page,
            score,
            text: chunk.text,
          });
        if (best.size > 40) {
          const lowest = [...best].sort((a, b) => a[1].score - b[1].score)[0];
          best.delete(lowest[0]);
        }
      }
      after = batch.at(-1)!.id;
    }
    self.postMessage({
      hits: [...best.values()].sort((a, b) => b.score - a.score).slice(0, 8),
    });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
