# Phase 3 — Ticket-03 acceptance notes

Contract 1.2 is authoritative for current play. Ticket-03 supersedes Phase 1–2 rules for lantern permanence, early all-lit victory, durations, and scoring. Historical specifications and evidence remain under the Phase 1–2 paths.

## Fuel and ignition

- Fuel max is 100. Internal representation is integer 1/60 units; each lit tick costs one unit and each draining Shade costs five. Fuel is clamped at zero and the lantern turns off immediately after tick-2 fuel changes.
- Initial ignition costs 10 motes; every relight costs 5. A lit lantern accepts fuel using `min(carried, ceil((100-fuel)/10))`; each mote adds up to 10 fuel, capped at 100. A full lantern is not an interaction target when no fuel can be added.
- `deposited` is progress toward the current ignition and resets to zero on extinguish. `ever_lit` remains true; `relit_count` increments on relights. Scenario-lit lanterns default to fuel 100 and do not increment player successful lights.
- Fuel in snapshots/events is rounded to one decimal. Dawn scoring uses unrounded fuel units.

## Shades, safety and expulsion

- A lit lamp is safe at fuel ≥30; below 30 it is unsafe.
- `wander` Shades target the nearest weak lit lamp by XZ distance, ID as tie-breaker; if none exists they target the nearest unlit lamp. At ≤2 m from a weak target they enter `drain` and stay still.
- Drain is 5 fuel/second per Shade in addition to natural decay. `fuel_drain` is emitted for each draining Shade every 60 `sim_tick`, in ascending ID order, with post-drain fuel.
- A drainer chases when the player is within 6 m; it returns to `wander` when its target is gone, no longer weak, or farther than 2 m. Pulse stuns it; expiry returns it to `wander`.
- Lighting/refueling a lamp to ≥30 expels Shades inside 6 m over at most 30 ticks. They cannot damage the player during expulsion, even if fuel falls below 30 before it finishes.

## Dawn and score

| Night | Duration | Lit lamps required |
|---|---:|---:|
| 1 | 240 s | 3 of 5 |
| 2 | 270 s | 4 of 6 |
| 3 | 300 s | 5 of 7 |

No early victory. At the final tick, loss for zero flames takes precedence; otherwise a living player wins only if the lit count meets `ceil(0.6 * lantern_count)`. On a win, each lit lantern awards `50 + floor(fuel)` and each remaining flame awards 50. There is no time bonus.

Each mote loaded into a lantern scores 5; first ignition scores 100; relight scores 40. A pulse scores 5 per Shade hit, or 15 total for a Shade that was draining immediately before the hit. Capacity is `min(20, 10 + 2 * successful_lights)`, where scenario-placed lights do not count.

## Scenario and output

- Contract version is 1.2. Snapshots expose lantern `fuel`, `ever_lit`, and `relit_count`, plus player `capacity`; fuel is a one-decimal number and an unlit lamp has fuel zero.
- Scenarios accept lantern `lit`, `fuel`, `ever_lit`, player `successful_lights`, and Shade `target_lantern_id`. `lit:true` without fuel defaults to 100. Contradictory lantern states are rejected.
- `refuel.amount` is motes consumed; `refuel.fuel` and `fuel_drain.fuel` are post-event fuel. Events are emitted deterministically. `lantern_lit` contains `relight`; game-over reasons are `dawn_survived`, `dawn`, and `no_flames`. `all_lit` is removed.

## Verification map

| Requirement | Automated test |
|---|---|
| Duration, output shape, capacity and defaults | `tests/phase-3.test.mjs` |
| Tick-exact decay, extinguish, pause, refuel/relight and score | `tests/phase-3.test.mjs` and updated Phase 1/2 regressions |
| Multi-Shade drain, event cadence, chase, pulse and expulsion | `tests/phase-3.test.mjs` |
| Dawn thresholds, score, no early victory and flame precedence | `tests/phase-3.test.mjs`, `tests/phase-1.test.ts` |
| Replay bytes and full-night runtime | `scripts/verify-replays.mjs`; `docs/proof/phase-3/README.md` |
| Browser campaign and FPS | `scripts/check-client.mjs`, `scripts/measure-fps.mjs`; results recorded only if executed |
| Color setting persistence and visual manual review | Browser persistence verified; visual contrast review remains outstanding (see `docs/proof/phase-3/README.md`) |
