# Changelog

## Phase 3 — Contract 1.2

Breaking changes from Contract 1.1:

- Lanterns now have fuel; they decay, can be refueled, extinguish, and can be relit for five motes.
- Victory no longer occurs when every lantern is lit. Players must survive to dawn with at least 60% lit; durations are now 240/270/300 seconds.
- Shade safe zones require at least 30 fuel. Weak lanterns can be drained, adding the `drain` Shade state and fuel events.
- Scoring changed: mote deposit +5, first light +100, relight +40, pulse +5 or +15 against a draining Shade, dawn lantern +50 plus `floor(fuel)`, and +50 per remaining flame. The time bonus was removed.
- Carry capacity now starts at 10, grows by two per successful ignition, and caps at 20.
- Contract is now v1.2. Lantern snapshots add `fuel`, `ever_lit`, and `relit_count`; player snapshots add `capacity`. New events are `refuel`, `lantern_out`, and `fuel_drain`; `lantern_lit` adds `relight`; `game_over.reason` uses `dawn_survived`, `dawn`, or `no_flames`. `all_lit` is removed.
- Added a persistent color-distinguishable palette setting.

Earlier Phase 1–2 evidence is retained under `docs/proof/` as historical output for those contracts.
