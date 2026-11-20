# Changelog

## Phase 4 — Contract 1.3 / v1.0.0

- Added reproducible browser benchmark and 10-night headless soak commands with JSON evidence.
- Added persistent local top-10 leaderboard, name validation, and JSON export.
- Added key remapping with collision detection/reset, reduced motion, larger text, and visual gameplay alerts.
- Added the accessibility palette setting and documented the benchmark renderer/VSync behavior.
- Updated the current contract and release documentation to v1.3.

## Phase 3 — Contract 1.2

Breaking changes from Contract 1.1:

- Lanterns now have fuel; they decay, can be refueled, extinguish, and can be relit for five motes.
- Victory no longer occurs when every lantern is lit. Players must survive to dawn with at least 60% lit; durations are now 240/270/300 seconds.
- Shade safe zones require at least 30 fuel. Weak lanterns can be drained, adding the `drain` Shade state and fuel events.
- Scoring changed: mote deposit +5, first light +100, relight +40, pulse +5 or +15 against a draining Shade, dawn lantern +50 plus `floor(fuel)`, and +50 per remaining flame. The time bonus was removed.
- Carry capacity now starts at 10, grows by two per successful ignition, and caps at 20.
- Contract is now v1.2. Lantern snapshots add `fuel`, `ever_lit`, and `relit_count`; player snapshots add `capacity`. New events are `refuel`, `lantern_out`, and `fuel_drain`; `lantern_lit` adds `relight`; `game_over.reason` uses `dawn_survived`, `dawn`, or `no_flames`. `all_lit` is removed.
- Added a persistent color-distinguishable palette setting.

## Phase 2 — Contract 1.1

- Added three canonical islands, Night 1–3, ramps, bridge, jump pads, charms, wind, and Drifters.
- Added dash, pause handling, drops/respawn, per-night rules, and campaign progression.
- Updated the headless snapshot/events and timing contract for multi-night play.

## Phase 1 — Contract 1.0

- Established the deterministic 60 Hz headless engine, scenario inputs, JSONL snapshots/events, and replay checks.
- Added the first island, player movement, motes, lanterns, Shades, pulse, health, score, and game-over rules.

Earlier Phase 1–3 evidence is retained under `docs/proof/` as historical output for those contracts.
