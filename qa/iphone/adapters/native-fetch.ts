// Synthetic QA build only: the one place the browser's own fetch is kept, before the QA entry replaces
// the global with the synthetic transport. The output audit allows exactly this one capture.
export const nativeFetch: typeof fetch = globalThis.fetch.bind(globalThis);
