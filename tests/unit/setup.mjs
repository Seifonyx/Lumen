// Browser globals that app modules touch when they load (tests run in Node).
globalThis.location ??= { hostname: 'test', search: '', origin: 'https://model-router.web.app' };
