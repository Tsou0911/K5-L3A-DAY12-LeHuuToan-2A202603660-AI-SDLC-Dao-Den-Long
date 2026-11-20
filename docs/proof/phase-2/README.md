# Phase 2 verification and evidence

Run commands from the repository root after installing dependencies and building. On Windows PowerShell, use `npm.cmd` if `npm` is blocked by Execution Policy.

## Automated tests and build

```powershell
npm.cmd test
npm.cmd run build
```

Verification in the current workspace: **36 tests passed, 0 failed**. The production client and headless CLI both build. Vite reports a non-fatal warning that the minified JavaScript chunk exceeds 500 kB.

## Headless scenarios

```powershell
node dist/headless.js --seed 42 --night 1 --ticks 60 --scenario scenarios/one-mote.json --snapshot-every 1 --out "$env:TEMP\one-mote.jsonl"
node dist/headless.js --seed 42 --night 1 --ticks 60 --scenario scenarios/win-one-lantern.json --inputs scenarios/interact.inputs.json --snapshot-every 1 --out "$env:TEMP\final-lantern.jsonl"
node dist/headless.js --seed 42 --night 3 --ticks 21600 --scenario scenarios/phase-2/full-night.json --inputs scenarios/phase-2/full-night.inputs.json --snapshot-every 60 --out "$env:TEMP\night-3.jsonl"
```

- The one-mote scenario records a pickup; pickup alone does not award points in v1.1. Points are awarded when motes are deposited.
- The final-lantern scenario ends in `won` at tick 1 with score 948.
- A full 21,600-tick Night 3 run was independently timed at **about 1.9 seconds** on the current Windows environment. It ended at tick 21,600 with `lost` at dawn, which is the expected timeout outcome for this scenario.
- `headless.json` records the generated outputs, replay hashes and an earlier full-run measurement. Its replay A/B SHA-256 values match.

## Browser and rendering

`measure-fps.mjs` measures the production WebGL client at 1280×720 in follow and overhead views. The saved `fps.json` reports a mean of **165.04 FPS** over approximately five seconds per view, on Windows with an Intel Core Ultra 7 356H and Intel integrated graphics, using the recorded HeadlessChrome/Edge user agent and ANGLE D3D11 renderer.

The following screenshots show the three night maps in both camera modes:

| Night | Follow camera | Overhead camera |
|---|---|---|
| 1 | [night-1-follow.png](night-1-follow.png) | [night-1-overhead.png](night-1-overhead.png) |
| 2 | [night-2-follow.png](night-2-follow.png) | [night-2-overhead.png](night-2-overhead.png) |
| 3 | [night-3-follow.png](night-3-follow.png) | [night-3-overhead.png](night-3-overhead.png) |

`check-client.mjs` exercises the campaign screens with a QA-only scenario that places the player one interaction away from victory. `campaign.json` records the Night 1 → Night 2 → Night 3 flow and final Dawn score. This is a UI smoke test, not evidence that a player completed all three nights unaided.

## Determinism

`verify-replays.mjs` runs the Night 2 pause/dash inputs twice. The saved `replay-a.jsonl` and `replay-b.jsonl` have identical bytes; the recorded SHA-256 for both is `17cd81afb9a9cca6bc25810b2cdd8a2dee4408579b661805d7c116e17e629ff7`.

To compare on Windows:

```powershell
fc.exe /b docs\proof\phase-2\replay-a.jsonl docs\proof\phase-2\replay-b.jsonl
```

## Still to verify manually

- Play the maps directly and check keyboard movement, camera switching, pause/resume, interactions and replay on the user’s browser.
- Confirm settings persist after reload and that background music and required sound effects are audible.
- macOS/Linux were not tested in this environment.
