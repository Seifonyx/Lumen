# WebKit checks

The Safari-engine CI jobs run Playwright WebKit suites and `tabbar.cjs`.
For a local run:

```sh
npm ci
npx playwright install --with-deps webkit
npm run build
MR_WEBKIT=1 npm run test:e2e -- welcome layout message-navigation
# In another terminal: npm run preview -- --port 5190 --strictPort
node tests/webkit/tabbar.cjs
```

`MR_TEST_URL` selects an already-running app. `WEBKIT_EXECUTABLE_PATH` selects a local launcher for `tabbar.cjs`.
These checks cover browser behavior; iPhone touch latency, glass rendering, VoiceOver, keyboard and Home Screen
behavior still need a physical device. Current unresolved device checks are in [HANDOFF.md](../../HANDOFF.md).
