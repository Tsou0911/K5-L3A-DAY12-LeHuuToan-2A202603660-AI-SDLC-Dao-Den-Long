# Phase 3 verification

Current evidence is for Contract v1.2. Phase 1–2 evidence remains historical.

## Reproduce

Run from the repository root:

```powershell
npm.cmd test
npm.cmd run build
node scripts/verify-replays.mjs
```

`npm.cmd test` runs the retained Phase 1–2 regression tests and Phase 3 tests. The verified run completed **50 tests, 50 passed, 0 failed, 0 skipped**. The production client, TypeScript check, and headless CLI build succeed; Vite emits a non-fatal warning that the minified client bundle exceeds 500 kB.

`verify-replays.mjs` writes `headless.json`, repeated JSONL replays, a one-mote scenario, a one-tick dawn win, and a complete Night 3 simulation here. It asserts replay A/B byte equality and the 18,000-tick Night 3 duration. The dawn fixture wins after lighting the final lamp and reports `dawn_survived`.

## Browser check

- The local browser rendered the initial HUD at 4:00 with bag capacity 0/10.
- Opened settings, enabled “Bảng màu dễ phân biệt”, reloaded, and confirmed it remained enabled; restored it to off afterward.

The full three-night playtest, visual contrast/animation review, audio, and target-browser review have not been performed. macOS/Linux were not tested.
- macOS/Linux were not tested.

Browser campaign/FPS scripts are available as `scripts/check-client.mjs` and `scripts/measure-fps.mjs`; their results should be recorded only after a real browser run.
