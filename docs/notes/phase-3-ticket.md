# Ticket-03 CHANGE REQUEST "Đèn cạn dầu" (Phase 3): working copy

Summary of the lab board's Phase 3 tab, read 2026-11-20. Type: **change request, changes core rules**. Priority: very high. Tag `phase-3`. **Contract v1.2**. The lab board is the source of truth.

**Why:** playtesters lit every lantern within 2 minutes and the Night ended with no tension at the end. New design: **a lit lantern can go out again**. The goal changes from "light them all" to **"keep the island lit until dawn"**. Rules marked [THAY THẾ] (replaced) override old ones; I must record the design decision (a short ADR) and update my tests. Creative extras still allowed if they don't change rules, numbers, the contract or headless output.

## 1. Lantern fuel — [REPLACES] "a lit lantern takes no more fireflies"

| Rule | Value |
|---|---|
| Max fuel | 100 |
| When lit (first time or relit) | `fuel = 100` |
| Burn while lit | 1.0 unit/s (counted per tick: 1/60 per tick) |
| Refuel | Interact at a lit lantern: `used = min(carried, ceil((100 − fuel) / 10))`, `fuel = min(100, fuel + 10 × used)`, carried −= used. A full lantern (`used = 0`) is not chosen by interact: no event, no score |
| Which lantern interact picks | Only lanterns that **accept**: unlit, or lit but not full. Nearest, tie → smaller id |
| Precision | Keep fuel in exact integer units of 1/60 so no float error builds up; round only on output |
| Out of fuel (`fuel ≤ 0`) | Lantern goes **out**, `deposited = 0`, event `lantern_out`, ambient light drops. It remembers `ever_lit = true` |
| Relight | A lantern that was lit before (`ever_lit`) needs only **5** fireflies; one never lit still needs 10 |
| Display | Fuel bar on lit lanterns; when `fuel < 30` the lantern and bar blink slowly (1 Hz) |

## 2. Bóng Mực drain fuel — [REPLACES] "Bóng Mực never enter a safe zone"

- A lantern with `fuel < 30` **loses its safe zone**. At exactly 30 it still has it.
- **Only shades in `wander`** choose a weak lantern: they head for the nearest lit lantern with `fuel < 30` (tie → smaller id). If there is none, they head for the nearest unlit lantern "as before". Shades in `chase` keep their target.
- Within 2 m (XZ) of that lantern: switch to the new state **`drain`**, stand still and drain **5 fuel/s continuously** (5/60 per tick). Several shades add up. The lantern can go out.
- From `drain`: to `chase` if Mây comes within 6 m; to `stunned` if hit by a pulse; to `wander` if the lantern goes out, if its fuel is raised to ≥ 30, or if the distance becomes > 2 m.
- After a stun ends → `wander`.
- When a refuel brings a lantern to ≥ 30 while shades are inside its 6 m zone, they are pushed to the edge within ≤ 30 ticks and deal no damage meanwhile (same as when a lantern is lit).

## 3. New win rule — [REPLACES] "win as soon as every lantern is lit"

| Rule | New value |
|---|---|
| Time, Night 1 / 2 / 3 | **240 / 270 / 300 s** |
| Win | Mây **alive when time runs out** (dawn) **and** lanterns lit at the last tick ≥ `ceil(0.6 × total)`: Night 1 needs 3/5, Night 2 4/6, Night 3 5/7 |
| No early win | Lighting every lantern does **not** end the Night |
| Lose | Out of flames (immediately, even on the last tick), or time runs out with fewer lanterns lit than needed |
| Reasons | Win: `dawn_survived`. Lose: `dawn` or `no_flames` |
| Tick order | Ticket-02's order, plus: in step 2 subtract fuel (burn + drain); right after step 2, lanterns with `fuel ≤ 0` go out. The win/lose check comes after every other update of the tick, including the dawn tick: out of flames is always checked first (`no_flames` wins) |

## 4. Growing capacity (new)

Capacity = `10 + 2 × successful_lights`, max **20**. `successful_lights` = successful lightings this Night, relights included; lanterns pre-lit by a scenario don't count. Reset to 0 at the start of every Night. The HUD shows `carried / capacity`.

## 5. New scoring — [REPLACES] the whole old formula

| Event | Points |
|---|---|
| Each firefly put into a lantern (light, relight or refuel) | +5 |
| First lighting | +100 |
| Relighting | +40 |
| Bóng Mực hit by a pulse | +5 each; **+15 total** if it was in `drain` just before |
| Dawn (only on a win): each lit lantern | +50 + `floor(fuel)` |
| Dawn (only on a win): each flame left | +50 |
| Time bonus | **Removed** |
| Game total, replay | Unchanged from Ticket-02 |

## 6. Colour-blind mode (new)

Setting **"Bảng màu dễ phân biệt"** (saved):
- Bóng Mực rim and eyes change from `#7A3CFF` to `#00B3FF`.
- Danger UI changes from `#FF5A5F` to `#FFFFFF` with a ⚠ icon.
- Unlit and lit lanterns must be told apart **without colour**: unlit ones tilt 20% and have torn paper; lit ones about to run out blink.

## 7. Test Contract v1.2 (changes)

- `contract_version: "1.2"`. `tuning` adds `fuel_max: 100`, `fuel_decay_per_s: 1.0`, `fuel_per_mote: 10`, `relight_cost: 5`, `win_ratio: 0.6`, `drain_per_s: 5`, `low_fuel_threshold: 30`, `capacity_max: 20`; `night1_duration_s = 240`, `night2_duration_s = 270`, `night3_duration_s = 300`.
- Snapshot: each lantern adds `fuel` (number, 1 decimal; unlit lanterns have `fuel: 0`), `ever_lit` and `relit_count`; `player` adds `capacity`. Shades get the new state `drain`.
- Scenario: each lantern may set `lit`, `fuel`, `ever_lit`; `player` adds `successful_lights`; `shades[]` adds `target_lantern_id`. A lantern set `lit: true` without `fuel` gets `fuel: 100`.
- New events: `refuel {lantern_id, amount, fuel}`, `lantern_out {lantern_id}`, `fuel_drain {lantern_id, shade_id, fuel}` (logged **every 60 ticks** while draining). `lantern_lit` adds `relight: true|false`. `game_over.reason` adds `dawn_survived`; **`all_lit` is no longer used**.

## Definition of Done

- Evidence that the game meets this phase's requirements.
- At least **1 short ADR** (any name and place) on how I model lantern state and the win rule.
- Old tests broken by the new rules are **updated or deleted with a reason**; never skipped silently.
- A **changelog** listing the Phase 3 breaking changes.
- Every hidden Phase 1–2 test that was not replaced still passes.
