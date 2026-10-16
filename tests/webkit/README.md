# Safari-engine release checks

The `Safari engine (WebKit)` CI job installs pinned Playwright WebKit and runs the existing welcome/layout suites plus `tabbar.cjs`. Failures are kept visible; do not skip assertions or replace WebKit with Chromium to get a green result.

Locally, install dependencies with `npm ci`, install WebKit with `npx playwright install --with-deps webkit`, build, and run:

```sh
MR_WEBKIT=1 npm run test:e2e -- welcome layout
# In another terminal, start npm run preview -- --port 5190 --strictPort
node tests/webkit/tabbar.cjs
```

`MR_TEST_URL` can select an already-running app. `WEBKIT_EXECUTABLE_PATH` can select a local WebKit launcher for the standalone tab-bar checks.

Coverage: iPhone-sized light/dark/black and landscape contexts, actual touch taps, pointer dragging across tabs, stationary icons, backdrop filter, selection on release, outside cancellation, lost pointer capture and keyboard activation. Pointer drags here use WebKit mouse input. Chromium's glass suite separately exercises real touch events through CDP. Neither substitutes for physical iPhone touch latency, GPU compositing or native refraction.

Release gate: type check, unit tests, build, relevant Chromium and WebKit checks, reviewed motion evidence, and explained CI failures. A physical iPhone check or real-device service is needed before claiming native touch/glass fidelity. Keep device/emulator results and known gaps distinct.

The local WebKit welcome suite passes five configurations, the layout suite passes six, and the tab-bar suite passes four. Testing exposed tiny reduced-motion transitions retaining stale viewport dimensions; disabling transitions rather than shortening them fixes keyboard fit. A narrow-phone type adjustment fits Safari fallback fonts. Popup geometry is checked after layout settles, with the original bounds preserved. A complete release also requires current CI results and physical iPhone feedback for touch/glass fidelity.
