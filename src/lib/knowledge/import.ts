import { uid } from "../util";
import { Masker, scan } from "../privacy";
import {
  EMBEDDING_MODEL,
  pageChunks,
  type KnowledgeDocument,
  type KnowledgeChunk,
} from "./core";
import {
  documents,
  notify,
  removeDocument,
  transaction,
  updateDocument,
} from "./db";

export async function importDocument(
  account: string,
  file: File,
  signal: AbortSignal,
  valid: () => boolean,
  onProgress: (pages: number) => void,
) {
  const check = () => {
    signal.throwIfAborted();
    if (!valid()) throw new Error("Account changed. Import stopped.");
  };
  check();
  if (!/\.(pdf|txt|md|markdown)$/i.test(file.name))
    throw new Error("Use a PDF, text or Markdown file.");
  if (file.size > 75 * 1024 * 1024)
    throw new Error("Each document can be up to 75 MB.");
  const library = await documents(account);
  check();
  if (
    library.length >= 100 ||
    library.reduce((sum, doc) => sum + doc.size, 0) + file.size >
      250 * 1024 * 1024
  )
    throw new Error(
      "This device library supports 100 documents and 250 MB of original files. Remove a document first.",
    );
  const id = uid(),
    meta: KnowledgeDocument = {
      id,
      name: file.name.slice(0, 180),
      size: file.size,
      pages: 0,
      chunks: 0,
      indexed: 0,
      createdAt: Date.now(),
      status: "importing",
      model: EMBEDDING_MODEL,
      privacy: "masked",
      findings: 0,
    };
  let count = 0,
    total = 0,
    findings = 0,
    pages = 0,
    dispose: (() => Promise<void>) | undefined;
  const masker = new Masker();
  await transaction<void>(
    account,
    ["documents", "files"],
    "readwrite",
    (tx) => {
      check();
      tx.objectStore("documents").put(meta);
      tx.objectStore("files").put(file, id);
    },
  );
  notify();
  const save = async (number: number, text: string) => {
    check();
    if (text.length > 120_000)
      throw new Error(
        `Page ${number} has too much text to index safely. Split this document first.`,
      );
    total += text.length;
    if (total > 30_000_000)
      throw new Error(
        "This document exceeds the 30 million character limit. Split it into volumes.",
      );
    findings += scan(text).length;
    const parts = pageChunks(text, masker),
      rows: KnowledgeChunk[] = parts.map((part, i) => ({
        id: `${id}:${count + i}`,
        docId: id,
        page: number,
        ordinal: count + i,
        ...part,
      }));
    count += rows.length;
    pages = number;
    await transaction<void>(account, ["pages", "chunks"], "readwrite", (tx) => {
      check();
      tx.objectStore("pages").put({
        id: `${id}:${number}`,
        docId: id,
        page: number,
        text,
      });
      for (const row of rows) tx.objectStore("chunks").put(row);
    });
    onProgress(number);
  };
  try {
    if (/\.pdf$/i.test(file.name)) {
      const pdfjs = await import("pdfjs-dist"),
        worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      check();
      const loading = pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
      });
      dispose = () => loading.destroy();
      const abort = () => void loading.destroy();
      signal.addEventListener("abort", abort, { once: true });
      try {
        const pdf = await loading.promise;
        check();
        if (pdf.numPages > 3000)
          throw new Error("Split PDFs above 3,000 pages into volumes.");
        for (let p = 1; p <= pdf.numPages; p++) {
          check();
          const page = await pdf.getPage(p),
            content = await page.getTextContent();
          await save(
            p,
            content.items
              .map((item) =>
                "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
              )
              .join(""),
          );
          page.cleanup();
        }
      } finally {
        signal.removeEventListener("abort", abort);
      }
    } else {
      const text = await file.text();
      check();
      if (text.length > 30_000_000)
        throw new Error("Split text files above 30 million characters.");
      const parts = text.split("\f");
      for (let p = 0; p < parts.length; p++) {
        // Text sections have no physical PDF page numbering.
        const section = parts[p];
        for (let start = 0; start < section.length; start += 24_000)
          await save(pages + 1, section.slice(start, start + 24_000));
      }
    }
    check();
    if (total < 50 || !count)
      throw new Error(
        "No readable text found. Scanned PDFs need OCR before importing.",
      );
    await updateDocument(account, id, {
      pages,
      chunks: count,
      status: "ready",
      findings,
    });
    check();
    return id;
  } catch (error) {
    await removeDocument(account, id);
    throw error;
  } finally {
    await dispose?.().catch(() => {});
  }
}
