# Phase 4 verification

Current evidence targets Test Contract v1.3. Re-run from the repository root with Node.js 22.12 or newer:

The 19-second [demo video](../../demo/demo.mp4) shows live gameplay, pause behavior, and the test, headless, benchmark, and soak evidence.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run bench -- --seed 42 --duration 30 --out docs/proof/phase-4/bench.json --screenshot docs/proof/phase-4/bench.png
npm.cmd run build:headless
npm.cmd run soak -- --seed 7 --nights 10 --out docs/proof/phase-4/soak.json
```

`soak.json` records the ten-night result, crash count, RSS after loading/resetting, and elapsed time. The soak command uses V8's 32 MB old-space and 1 MB semi-space limits and explicitly runs GC at night boundaries; RSS remains sampled from `process.memoryUsage().rss`. The test fails on crashes, and the acceptance check is `mem_end_mb <= 1.2 * mem_start_mb`.

The benchmark opens the real Three.js client at 1280×720, uses the fixed seed and 200-Shade/100-mote scene, warms up for 3 seconds, and measures the requested interval. VSync is disabled through Chromium launch flags. `peak_mem_mb` is `null`: the browser benchmark cannot reliably aggregate RSS across Chromium's browser and renderer processes.

The final regression run completed **55 tests, 55 passed, 0 failed, 0 skipped**.

The grader's machine and its performance results may differ from this local machine. The benchmark JSON is evidence only for the host and renderer recorded in that file; it does not replace the specified instructor-machine measurement.

## Local measurements

The 30-second run on Windows 11 (`Windows_NT 10.0.26200`, x64), Three.js r176/WebGL2, reported 302.1 average FPS, 26.3 p1-low FPS, 13.5 ms p95 frame time, 9,064 frames, and 2,376.3 ms load time. Average FPS and load time meet their numeric targets on this host; p1-low FPS is below 30, so this local run does **not** establish that the full benchmark thresholds pass. The instructor-machine run remains authoritative. Chromium RSS was not aggregatable, so `peak_mem_mb` is `null`.

The 10-night run completed with zero crashes in 3.3 s. RSS was 42.7 MB after loading the first night and 47.8 MB after the final reset (1.12×, below the 1.2× limit). All ten seeded results were `lost`; the soak requirement measures stability and does not require winning.
