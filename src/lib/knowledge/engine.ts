import { Masker } from "../privacy";
import {
  DIMENSIONS,
  EMBEDDING_MODEL,
  normalizedVector,
  type KnowledgeHit,
} from "./core";
import {
  document,
  documents,
  nextChunk,
  notify,
  saveEmbedding,
  transaction,
  updateDocument,
} from "./db";

export interface KnowledgeSession {
  uid: string;
  key: string;
  masked: boolean;
  ask: boolean;
  valid: () => boolean;
  available: () => boolean;
}
let active: { uid: string; id: string; controller: AbortController } | null =
  null;
const cache = new Map<string, Float32Array>();
let metadataKey = "";
let lastRequest = 0;
export const indexing = () => active;
export function cancelKnowledge() {
  active?.controller.abort(
    new Error("Indexing paused. Your progress is saved."),
  );
  cache.clear();
  metadataKey = "";
}
const check = (session: KnowledgeSession, signal: AbortSignal) => {
  signal.throwIfAborted();
  if (!session.valid())
    throw new Error(
      "Account, key or privacy settings changed. Indexing stopped.",
    );
};
async function request(
  session: KnowledgeSession,
  path: string,
  signal: AbortSignal,
  body?: unknown,
) {
  check(session, signal);
  if (!navigator.onLine)
    throw new Error("Offline. Your library is saved; resume when connected.");
  const timeout = AbortSignal.timeout(20_000),
    combined = AbortSignal.any([signal, timeout]);
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${path}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          "x-goog-api-key": session.key,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: combined,
      },
    );
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      timeout.aborted
        ? "Embedding request timed out. Resume to try again."
        : "Could not reach Google. Your progress is saved.",
    );
  }
  check(session, signal);
  if (!response.ok) {
    if (response.status === 429)
      throw new Error(
        "Google embedding quota reached. Progress is saved. Resume after your limit resets.",
      );
    if ([401, 403].includes(response.status))
      throw new Error(
        "Google could not authorize embeddings. Check your Gemini key and region, then resume.",
      );
    if (response.status === 404)
      throw new Error(
        "The embedding model is unavailable for this key. Keyword search still works.",
      );
    throw new Error(
      "Google could not complete embedding. Progress is saved; try again later.",
    );
  }
  return response.json();
}
async function embedding(
  session: KnowledgeSession,
  text: string,
  query: boolean,
  signal: AbortSignal,
) {
  if (!session.key)
    throw new Error(
      "Add a Gemini key in Settings → API keys for semantic search.",
    );
  if (metadataKey !== session.key) {
    const model = await request(session, EMBEDDING_MODEL, signal);
    check(session, signal);
    if (!model.supportedGenerationMethods?.includes("embedContent"))
      throw new Error(
        "This key does not have access to the embedding model. Keyword search still works.",
      );
    metadataKey = session.key;
  }
  const prompt = query
    ? `task: search result | query: ${text}`
    : `title: none | text: ${text}`;
  lastRequest = Date.now();
  const result = await request(
    session,
    `${EMBEDDING_MODEL}:embedContent`,
    signal,
    {
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: prompt }] },
      embedContentConfig: { outputDimensionality: DIMENSIONS },
    },
  );
  check(session, signal);
  return normalizedVector(result.embedding?.values);
}
const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
      resolve();
    };
    const stop = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
      reject(signal.reason);
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) stop();
  });
export async function indexDocument(session: KnowledgeSession, id: string) {
  if (active)
    throw new Error("A document is already indexing. Pause it first.");
  const controller = new AbortController(),
    signal = controller.signal;
  active = { uid: session.uid, id, controller };
  notify();
  const visibility = () => {
    if (documentHidden())
      controller.abort(new Error("Indexing paused while the app is hidden."));
  };
  const offline = () =>
    controller.abort(new Error("Indexing paused while offline."));
  window.document.addEventListener("visibilitychange", visibility);
  window.addEventListener("offline", offline);
  try {
    check(session, signal);
    let doc = await document(session.uid, id);
    if (!doc || doc.status === "importing")
      throw new Error("Wait for this document to finish importing.");
    const privacy = session.masked ? "masked" : "asIs";
    if (doc.privacy !== privacy) {
      await transaction<void>(
        session.uid,
        ["chunks", "documents"],
        "readwrite",
        (tx) => {
          check(session, signal);
          const r = tx
            .objectStore("chunks")
            .index("docId")
            .openCursor(IDBKeyRange.only(id));
          r.onsuccess = () => {
            const cursor = r.result;
            if (cursor) {
              const row = cursor.value;
              delete row.vector;
              cursor.update(row);
              cursor.continue();
            }
          };
          tx.objectStore("documents").put({
            ...doc,
            indexed: 0,
            privacy,
            status: "ready",
          });
        },
      );
      doc = { ...doc, indexed: 0, privacy };
    }
    await updateDocument(session.uid, id, {
      status: "indexing",
      error: undefined,
    });
    while (doc.indexed < doc.chunks) {
      check(session, signal);
      if (!session.available()) {
        await delay(1000, signal);
        continue;
      }
      const wait = Math.max(0, 6100 - (Date.now() - lastRequest));
      if (wait) await delay(wait, signal);
      check(session, signal);
      if (!session.available()) continue;
      const chunk = await nextChunk(session.uid, id, doc.indexed);
      if (!chunk)
        throw new Error(
          "A saved chunk is missing. Remove and import this document again.",
        );
      const vector = await embedding(
        session,
        session.masked ? chunk.embeddingText : chunk.text,
        false,
        signal,
      );
      check(session, signal);
      await saveEmbedding(session.uid, doc, chunk, vector);
      doc = { ...doc, indexed: doc.indexed + 1 };
    }
  } catch (error) {
    const message = signal.aborted
      ? signal.reason instanceof Error
        ? signal.reason.message
        : "Indexing paused. Your progress is saved."
      : (error as Error).message;
    await updateDocument(session.uid, id, { status: "paused", error: message });
  } finally {
    window.document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("offline", offline);
    if (active?.controller === controller) active = null;
    notify();
  }
}
const documentHidden = () => window.document.visibilityState === "hidden";
export async function searchLibrary(
  session: KnowledgeSession,
  query: string,
  signal: AbortSignal,
  ids?: string[],
): Promise<{ hits: KnowledgeHit[]; mode: string }> {
  check(session, signal);
  const docs = (await documents(session.uid)).filter(
    (doc) => doc.status !== "importing" && (!ids || ids.includes(doc.id)),
  );
  check(session, signal);
  let vector: Float32Array | undefined,
    mode = "Keyword search";
  // Ask-me queries with personal details stay local until the normal chat privacy review.
  const masked = session.masked
    ? new Masker().mask(query)
    : { text: query, count: 0 };
  if (
    session.key &&
    navigator.onLine &&
    docs.some((doc) => doc.indexed > 0) &&
    session.available() &&
    !(session.ask && masked.count)
  ) {
    const cacheKey = `${session.uid}:${session.masked}:${masked.text}`;
    try {
      vector =
        cache.get(cacheKey) ||
        (await embedding(session, masked.text, true, signal));
      if (cache.size >= 10) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, vector);
      mode = "Semantic + keyword search";
    } catch (error) {
      check(session, signal);
      mode = `Keyword search · ${(error as Error).message}`;
    }
  }
  check(session, signal);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./search.worker.ts", import.meta.url), {
        type: "module",
      }),
      timer = setTimeout(
        () =>
          finish(
            new Error(
              "Search took too long. Select fewer documents and try again.",
            ),
          ),
        30_000,
      );
    const stop = () => finish(signal.reason || new Error("Search cancelled."));
    const finish = (error?: Error, hits?: KnowledgeHit[]) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
      worker.terminate();
      if (error) reject(error);
      else {
        try {
          check(session, signal);
          resolve({ hits: hits || [], mode });
        } catch (e) {
          reject(e);
        }
      }
    };
    signal.addEventListener("abort", stop, { once: true });
    worker.onerror = () =>
      finish(new Error("Could not search this device library. Try again."));
    worker.onmessage = (event) =>
      finish(
        event.data.error ? new Error(event.data.error) : undefined,
        event.data.hits,
      );
    worker.postMessage({
      uid: session.uid,
      ids: docs.map((doc) => doc.id),
      query,
      vector,
    });
    if (signal.aborted) stop();
  });
}
