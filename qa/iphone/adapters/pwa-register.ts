// Synthetic QA build only: replaces src/pwa/register.ts. Review builds never register a service worker,
// precache an offline copy or offer installation, so expiry and revocation apply to every load.

export function registerServiceWorker(_onUpdate: (apply: () => void) => void): void {}
