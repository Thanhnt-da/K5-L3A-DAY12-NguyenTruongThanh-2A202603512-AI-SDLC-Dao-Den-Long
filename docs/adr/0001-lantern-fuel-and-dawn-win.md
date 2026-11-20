# ADR 0001: Lantern fuel state and the dawn win rule (Phase 3, Ticket-03)

- Status: accepted · Date: 2026-11-20 · Replaces: the Phase 2 "lit forever + instant all_lit win" model

## Context

Ticket-03 makes lanterns burn fuel and go out, lets Bóng Mực drain weak lanterns, and replaces "win as soon as every lantern is lit" with "survive until dawn with ≥ 60% lit". The hidden tests compare exact numbers (`fuel` with 1 decimal, events every 60 ticks), so fuel must not drift.

## Decision

1. **Lantern state = `{ lit, fuel, deposited, everLit, relitCount, evictLeft }`.** One record covers every case:
   - unlit and never lit: cost 10;
   - unlit after going out: `everLit`, so cost 5;
   - lit: fuel > 0;
   - weak: lit with fuel < 30. This is derived (`hasSafeZone`), not stored, so it can never disagree with `fuel`.
2. **Fuel is stored as an integer count of 1/60 units** (100 fuel = 6000). Burn is −1 per tick, drain −5 per tick per shade, a refuel firefly +600. All arithmetic is integer, so a lantern lit at fuel 100 goes out on exactly tick 6000. Output divides by 60 and rounds to 1 decimal.
3. **Order inside a tick** follows Ticket-02's 12 steps with Ticket-03's additions in step 2: count down timers → burn and drain fuel (logging `fuel_drain` every 60 drain ticks) → put out lanterns at ≤ 0 (`lantern_out`; draining shades go back to `wander`). Safe zones (step 6) apply only to lanterns that are `hasSafeZone`. A refuel that brings a lantern back to ≥ 30 starts the same 30-tick eviction as lighting does.
4. **Win and lose are checked only in step 11, after every other update of the tick:**
   1. no flames → `lost/no_flames`. This is checked first, so it wins over a dawn on the same tick.
   2. otherwise, when the time is up: `lit ≥ ceil(win_ratio × lanterns)` → `won/dawn_survived`, else `lost/dawn`.
   Lighting every lantern no longer ends the Night. The dawn bonus is computed at that moment from the final lantern fuels.
5. **Capacity is derived, not stored:** `capacityOf(p) = min(20, 10 + 2 × successfulLights)`. Only real lightings in the sim increment `successfulLights`; scenario pre-lit lanterns don't.
6. **Shade `drain` is a sixth state** with a target lantern id. Only `wander` shades choose a target (weak lantern first, otherwise the nearest unlit one), so `chase` behaviour from Phase 2 is unchanged.

## Consequences

- Phase 2 tests that relied on the replaced rules were updated or removed, with reasons ([docs/notes/phase-3.md](../notes/phase-3.md)). Rules that were not replaced kept their tests unchanged, and all still pass.
- Because burn (step 2) runs before interact (step 5), a lit lantern is never exactly full at interact time. The ticket's "full lantern is not chosen" case can't trigger, so a just-filled lantern still takes 1 firefly (assumption C3).
- Integer fuel makes headless output deterministic and byte-identical across machines.
