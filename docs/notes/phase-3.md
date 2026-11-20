# Phase 3: Ticket-03 "Đèn cạn dầu" (Contract v1.2)

Requirements: [phase-3-ticket.md](phase-3-ticket.md). Design decision: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md).

## Why the design changed (short)

Lanterns now have fuel and can go out, shades can drain weak ones, and the Night is won at dawn, not by lighting everything. Lantern state became one record (`lit`, integer `fuel` in 1/60 units, `deposited`, `everLit`, `relitCount`). "Weak" and "has a safe zone" are derived from fuel, so they can't drift. The win check stays in step 11, after everything else in the tick, and checks `no_flames` first. Details are in the ADR.

## Acceptance criteria

| # | Criterion | Verified by | Status |
|---|---|---|---|
| F1 | Contract v1.2: new tuning keys, Nights 240/270/300 s, new score values | `contract.test.js` | đạt |
| F2 | Lit lantern burns exactly 1/s; at 0: `lantern_out`, `deposited 0`, `ever_lit` kept | `fuel.test.js` fuel | đạt |
| F3 | Refuel `min(carried, ceil((100−fuel)/10))`, +10 fuel each (max 100), +5 each, `refuel` event | `fuel.test.js` refuel ×2 | đạt |
| F4 | Relight costs 5 for an ever-lit lantern, +40, `relight: true`, `relit_count`; a first lighting still costs 10, +100 | `fuel.test.js` relight, `rules.test.js` lantern | đạt |
| F5 | Capacity 10 + 2 × successful lights, max 20; scenario pre-lit lanterns don't count | `fuel.test.js` capacity | đạt |
| F6 | Fuel < 30 loses the safe zone; ≥ 30 keeps it | `fuel.test.js` weak lantern | đạt |
| F7 | Wandering shades head for the nearest weak lantern, `drain` within 2 m at 5/s (stacking), `fuel_drain` every 60 ticks; lantern can go out, shade returns to wander | `fuel.test.js` drain, scenario `p3-shade-drain` | đạt |
| F8 | drain → chase (Mây ≤ 6 m), → wander (refuel ≥ 30, lantern out, > 2 m), → stunned (pulse); after stun → wander | `fuel.test.js` drain transitions, pulse | đạt |
| F9 | Pulse on a draining shade = +15 in total | `fuel.test.js` pulse | đạt |
| F10 | Dawn: alive and ≥ ceil(0.6 × n) lit → `dawn_survived`, +50 + floor(fuel) per lit lantern, +50 per flame; otherwise `dawn` | `fuel.test.js` win + thresholds, scenario `p3-dawn-survived` | đạt |
| F11 | No flames on the dawn tick → `no_flames` (checked first) | `fuel.test.js` dawn tick | đạt |
| F12 | Lighting every lantern does not end the Night | `rules.test.js` | đạt |
| F13 | Client: fuel bar on lit lanterns, 1 Hz blink below 30, refuel prompt, HUD `carried / capacity` | browser check, [screens/fuel-bar-refuel-prompt.jpg](../proof/phase-3/screens/fuel-bar-refuel-prompt.jpg) | đạt (by hand) |
| F14 | Colour-blind setting (saved): shade rim `#00B3FF`, danger UI white with ⚠, unlit lanterns tilted with torn paper | code + browser smoke test | **một phần**: setting and colours are implemented; I did not take a screenshot with it switched on |

## Tests changed or removed because Ticket-03 replaced a rule

| Test | Change | Reason |
|---|---|---|
| contract "v1.1 tuning" | now checks v1.2 values | Ticket-03 Part 7 |
| `rules` "win: lighting the last lantern wins…" | **removed**; replaced by "lighting every lantern no longer ends the Night" | Part 3 removes the instant `all_lit` win; Part 5 removes the time bonus |
| `rules` lantern deposit scores 40 / 160 | now 20 / 130 | Part 5: +5 per firefly; `lantern_lit` gained `relight` |
| `rules` pause `time_left_s` 299.5 | 239.5 | Night 1 is 240 s |
| `rules` / `nights` performance runs | 14,400 / 18,000 ticks, 200 flames instead of hiding in a safe zone | Nights are shorter, and lanterns now burn out, so a safe zone no longer protects for a whole Night |
| `nights` Night 2/3 lengths | 270 / 300 s | Part 3 |
| contract scenario setup lantern | adds `fuel`, `ever_lit`, `relit_count` | Contract v1.2 snapshot |
| scenario `last-lantern-win` | **removed**, replaced by `p3-dawn-survived` | its expected `all_lit` win no longer exists |

## Assumptions

| # | Topic | Assumption |
|---|---|---|
| C1 | Snapshot `fuel` of a lit lantern | Rounded to 1 decimal from the exact 1/60 units |
| C2 | Wandering shade with no weak and no unlit lantern | Roams randomly as in Phase 2 |
| C3 | "A full lantern is not chosen" | Burn happens in step 2, before interact in step 5, so a lantern is never exactly full at interact time. A just-filled lantern still takes 1 firefly |
| C4 | Shade next to an unlit lantern | Waits about 1 m from it. Draining applies only to weak lit lanterns |
| C5 | Tilt "20%" for unlit lanterns (colour-blind cue) | 0.2 rad (about 11°) |

## Evaluation

- Met: F1–F13. F14 is partly verified (no colour-blind screenshot).
- Broke earlier phases: only where Ticket-03 replaced a rule (table above). All other Phase 1–2 tests are unchanged and pass (56/56 in total).
- What AI got wrong and how I caught it: (1) the long inline shell script broke on quoting, so I moved it to a script file. (2) Two of my new tests expected the wrong values: a "full" lantern case that the tick order makes impossible (now assumption C3), and fuel 70 where the tick-1 drain makes 69.9 correct. I read both failures before changing anything; the game matched the ticket in both. (3) A browser screenshot showed stale numbers; I re-checked through the live state (`window.__game`) instead of trusting the picture.
- Harness: no new parts needed. The Stop hook (tests + build) and the evidence script caught everything this phase.
- Tokens: see [ai-log.md](ai-log.md).
