# ADR 0003: Lantern fuel and dawn victory

- Status: Accepted
- Phase: 3, Ticket-03

## Context

Playtesting showed that players could light every lantern too early. Ticket-03 replaces immediate all-lit victory with surviving until dawn while at least 60% of the lanterns remain lit. It also makes fuel, relighting, and shade draining part of the core simulation.

## Decision

- Store fuel as integer sixtieths: 6000 units is 100 fuel; natural decay is 1 unit per simulation tick and each draining Shade removes 5 units. Round to one decimal only in output. Scoring uses unrounded units.
- Keep `deposited` as progress toward the current ignition (10 motes initially, 5 to relight); reset it when a lantern goes out. `ever_lit` persists and `relit_count` counts subsequent ignitions.
- Treat a lantern as safe only while lit with at least 30 fuel. A Shade may drain a weak lamp; an ignition or refuel to the safe threshold starts an expulsion lasting at most 30 ticks. The expulsion state prevents damage even if fuel falls below 30 during those ticks.
- Determine the outcome after all updates on the final tick. Zero flames always loses; otherwise win only if the lit-lantern count meets `ceil(0.6 * total)`. Award dawn points only on a win.
- `refuel.amount` is the number of motes consumed; `refuel.fuel` and `fuel_drain.fuel` report post-operation fuel rounded to one decimal.

## Consequences

Contract 1.2 changes the headless snapshot and event schema, night durations, score, and win/loss reasons. The Phase 1–2 evidence remains historical; all current acceptance tests run against v1.2.
