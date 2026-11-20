# Phase 2 — Ticket-02 acceptance criteria and assumptions

This document records the Phase 2 implementation against Ticket-02 “Ba hòn đảo.” The ticket is the source of truth; `game.contract.json` is the executable tuning contract.

## Standard rules

| Area | Acceptance criteria |
|---|---|
| Simulation | Fixed 60 Hz. Headless `--ticks N` performs N simulation steps unless the game ends. Paused wall ticks increment `tick`, while `sim_tick`, gameplay timers, cooldowns, spawning and TTL remain frozen. |
| Movement | Run speed 6 m/s; acceleration and braking reach the requested speed within 6 ticks; full air control. Jump starts at 7 m/s with −20 m/s² gravity and only starts while grounded. |
| Dash | 14 m/s for 12 ticks, 90-tick cooldown measured from dash start; heading follows movement or facing when idle. Air dash preserves height and does not grant invulnerability. A wind charm removes cooldown but still requires a new button press. |
| Motes | Capacity 10. Pick up at horizontal XZ distance ≤1 m and vertical difference ≤1.5 m. Start with 20 at distinct map points, cap 30, attempt a spawn every 240 simulation ticks at a vacant point. Dropped motes last 480 ticks and can be collected starting on the following tick. |
| Lanterns | Cost 10 motes, deposited over multiple interactions. Interact within 2 m; choose the nearest unlit lantern, breaking ties by ascending ID. Each lit lantern creates a 6 m safe radius. A Shade inside when the lantern lights is expelled within at most 30 ticks and cannot damage the player during expulsion. |
| Pulse | Costs 3 carried motes; cooldown 180 ticks. Range is a 3D sphere of radius 5 m centered 0.8 m above the player’s feet. A hit stuns for 120 ticks and pushes horizontally 4 m over 15 ticks; a repeat refreshes the effect. Push stops at obstacles; coincident positions use +X. Pulse does not kill. |
| Shades | Speed 4 m/s, or 4.5 m/s on Night 3. Acquire at 12 m and stop chasing beyond 18 m. Contact requires XZ distance ≤1 m and vertical difference ≤1.5 m. At most one flame is lost per tick. Contact causes a 2 m recoil over 60 ticks. |
| Damage and falling | Shade hit costs one flame, drops `floor(carried/2)` motes in a 1.5–2.5 m ring, and grants 90 ticks invulnerability. Falling below Y=−10 is handled once even during invulnerability: lose one flame and all carried motes, then respawn after 60 ticks with zero velocity and 90 ticks invulnerability. No flames means immediate loss without respawn. |
| Time and score | Night durations are 300/330/360 s. Each night starts with 3 flames. Depositing motes gives 10 points each, lighting a lantern gives 100, each Shade hit by a pulse gives 5. A won night adds `floor(time_left_s)*2 + flames*50`; campaign score sums won nights. |

## Canonical maps

Angles below are measured counter-clockwise from +X in the XZ plane. Procedural rings in `src/core/islands.ts` use those angles.

| Night | Terrain and points | Lanterns | Special schedule |
|---|---|---|---|
| 1 — Đảo Bến | Disc centered at (0,0), radius 40 m; start (0,0,0), facing +Z. Mote points: 8 at radius 12 m every 45°, 16 at radius 33 m every 22.5°. Shade points: 12 at radius 37 m, starting 15° every 30°, at least 15 m from player. | L1 (0,0,25), L2 (23.8,0,7.7), L3 (14.7,0,−20.2), L4 (−14.7,0,−20.2), L5 (−23.8,0,7.7). | Two Shades at tick 300, then one every 480 ticks; cap 6. |
| 2 — Đảo Cau | Discs radius 28 m centered at (0,0) and (70,0), linked by bridge x=[26,44], z=[−2,2]. Jump pads at (20,0,18) and (50,0,−18); launch velocity has Y=14 m/s and horizontal speed 24 m/s toward the other island. Each island has 4 mote points at radius 10 m every 90° and 8 at radius 22 m every 45°. Shade points: 8 per island at radius 26 m, beginning at 22.5° every 45°. | L1 (0,0,20), L2 (17,0,−10), L3 (−17,0,−10), L4 (70,0,20), L5 (87,0,−10), L6 (53,0,−10). | Shade interval 420 ticks, cap 8. Wind Charm at (35,0,0). Drifters start spawning at tick 1200, then every 1200 ticks, cap 2. |
| 3 — Đảo Chuông | Disc radius 45 m. Ground level Y=0; upper annulus Y=3, radii 12–24 m where z>0; summit disc Y=6, radius 8 m. Two 3 m-wide ramps at 30° and 150°, from radius 30 m/Y=0 to radius 24 m/Y=3. Jump pad at (0,3,13) launches with velocity (0,12,−8). Tower at center, radius 2 m, height 8 m. Motes: 18 at radius 34 m every 20°; 8 at radius 18 m from 20° through 160°; 4 at radius 5 m at 45°, 135°, 225°, 315°. Shades: 16 at radius 43 m every 22.5°. | L1 (0,6,6), L2 (18,3,10), L3 (−18,3,10), L4 (35,0,−10), L5 (−35,0,−10), L6 (20,0,−35), L7 (−20,0,−35). | Shade interval 360 ticks, cap 10. Wind Charm points (30,0,25) and (−30,0,25). Wind cycle: every 1800 ticks, 120-tick warning followed by 300 ticks of seeded direction wind at 2 m/s. |

## Tick-order contract

`GameEngine.step` follows Ticket-02’s ordering:

1. Advance wall tick and handle pause/resume; a newly paused step stops here.
2. Advance simulation tick and decrement clocks, cooldowns, invulnerability, stun, charms and mote TTL.
3. Move player (jump, dash, pads, wind), then process falling.
4. Collect motes and charms.
5. Interact with lantern.
6. Constrain Shades to lit-lantern safe zones.
7. Process pulse and its immediate target set.
8. Move Shades and Drifters.
9. Resolve Drifter steals before Shade contact; Shade contacts are ordered by ID and limited to one hit.
10. Spawn scheduled entities; newly spawned entities act from the next tick.
11. Resolve loss before win, then dawn loss. A living player lighting the final lantern on the last time tick wins.
12. Emit the scheduled snapshot.

## Contract v1.1

`game.contract.json` sets version 1.1 and the standardized tuning. Headless accepts nights 1–3, `dash` and `pause` inputs, and the scenario fields described by Ticket-02. Snapshots expose `night`, `wind`, player velocity/grounded/invulnerability/cooldowns/charm time, and `motes`, `drifters`, and `charms`. Events include `night_start`, `dash`, `paused`, `resumed`, `charm_picked`, `drifter_steal`, and `drifter_drop`; fall hits include `lost`. Shade states are `spawning`, `wander`, `chase`, `recoil`, and `stunned`.

The renderer uses the specified palette in `src/client/main.ts` and `src/client/terrain.ts`. Ambient intensity is `.15 + .55 * lit_lanterns / lantern_count`.

## Assumptions recorded

- Night 3’s player start is not explicitly stated in the supplied map table. The implementation starts at (0,6,−5), on the summit platform. Confirm this against the instructor’s intended start if a later authoritative clarification is issued.
- Night 2 and Night 3 use the shared initial two-Shade spawn at tick 300, then their map-specific intervals (420 and 360 ticks). This follows the shared spawn rule; confirm if the instructor intended that rule to apply only to Night 1.
- When a mote drop would exceed the 30-mote cap, the implementation removes an existing random mote before adding the dropped mote. The ticket gives the cap but does not define replacement priority.

## Acceptance-test map

| Requirement | Automated check / evidence |
|---|---|
| Phase 1 regression, tick schema, invalid input, determinism | `tests/phase-1.test.ts`; `docs/proof/phase-2/tests.txt`; replay files |
| Movement, dash, jump, pulse, damage, fall/respawn, lantern and score | `tests/phase-2.test.mjs` |
| Three nights, map points, scheduled entities, bridge, ramps, tower, pads and wind | `tests/phase-2.test.mjs`; night screenshots and `night-3.jsonl` |
| Drifter, charm, pause, TTL and event ordering | `tests/phase-2.test.mjs`; replay files |
| Campaign screens and camera modes | `scripts/check-client.mjs`, `scripts/measure-fps.mjs`, `campaign.json`, screenshots |
| 21,600-tick headless performance | `scripts/verify-replays.mjs`; `headless.json`; repeated local timing in the Phase 2 proof README |
| Settings persistence and audible music/SFX | Manual verification still required; not claimed as automated proof |
| macOS/Linux | Not run in this environment |
