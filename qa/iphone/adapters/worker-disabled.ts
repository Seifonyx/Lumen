// Synthetic QA build only: background workers (code running, searchable-knowledge indexing) are not part
// of the reviewed surface yet, so constructing one fails with a clear message instead of loading anything.

export function disabledWorker(..._args: unknown[]): never {
  throw new Error('Code running and searchable-knowledge indexing are disabled in this synthetic review build.');
}
