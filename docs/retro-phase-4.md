# Retrospective — Phases 1–4

## Evaluation

The project progressed from a deterministic headless core (Phase 1), through three islands and campaign mechanics (Phase 2), to the fuel-and-dawn rules change (Phase 3), then release tooling and accessibility (Phase 4). Keeping simulation rules in `GameEngine` and defining contract versions made headless regression tests useful across the rule changes. Scenario/replay fixtures also made tick-order changes easier to inspect.

The most effective AI-assisted work was using focused tests and real browser runs to check behavior rather than accepting a plausible code review. The early Phase 4 soak measurement failed its RSS limit even though the game completed without crashes. Inspecting post-GC heap/RSS showed that per-tick snapshots were unnecessary and that Node's default heap arenas dominated this small headless workload. The soak loop now reads the engine's outcome directly, and its documented Node heap limits keep the measured process within the acceptance threshold without changing the RSS measurement. The recorded JSON is the actual run result, not a manually adjusted estimate.

## AI collaboration and mistakes

The most useful harnesses were the versioned `game.contract.json`, deterministic seeds/scenarios, the retained Phase 1–3 tests, replay comparison, and the repository's `AGENTS.md`/proof documents. They exposed mismatches that a visual playtest could miss, especially exact tick ordering, event shapes, deterministic outputs, and benchmark/soak output fields.

An early command suggestion used Unix shell syntax (`&&`, `ls`, `head`) in Windows PowerShell; it failed immediately and was replaced with PowerShell-compatible commands. Another mistake was treating an early one-second benchmark smoke test as evidence for the required 30-second benchmark; it is only a smoke test and is not used as acceptance evidence. The first soak runs also failed the memory ratio; the recorded output was inspected and the implementation/configuration was changed before rerunning.

## AI usage estimate

The local session usage ledger for this project conversation reports **301 requests**, **35,841,789 input tokens**, **346,557 output tokens**, and **67,122,158,000 nano-AIU** (about **67.12 AIU**, not USD). These totals cover the available Copilot session history across the earlier project phases as well as Phase 4; they are not a Phase-4-only or all-tools billing statement. The session ledger does not provide a reliable USD conversion, so no dollar cost is claimed.

Token use was reduced by reusing the existing contract, engine, and test harness; inspecting targeted files/ranges; running the smallest relevant test during iteration; and collecting related file reads together instead of repeatedly dumping the full repository.

## What I would change next time

I would capture benchmark and soak baselines before implementation, record the target-machine configuration alongside every measurement, and add early automated checks for the exact acceptance thresholds. I would also reserve time for a clean-machine packaging/release rehearsal and a short accessible gameplay recording before the release deadline.
