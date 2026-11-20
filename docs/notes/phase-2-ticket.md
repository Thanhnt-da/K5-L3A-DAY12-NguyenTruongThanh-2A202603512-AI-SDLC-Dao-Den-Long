# Ticket-02 "Ba hòn đảo" (Phase 2): working copy

Summary of the lab board's Phase 2 tab, read 2026-11-20. Type: feature + standardisation, priority high, tag `phase-2`, **Contract v1.1**. The lab board stays the source of truth; re-check it if something here looks off.

Two goals: (1) **standard numbers** so every submission feels the same, (2) extend the game to **3 Nights**. Creative extras from Phase 1 stay allowed (including new characters/enemies besides Bóng Mực and Gió Lạc) as long as the standard numbers, standard maps and Test Contract are unchanged and extras don't change headless output.

## Part 1: Standard numbers (mandatory, replace all our own values)

60 ticks/s, metres, seconds, Y up.

| Group | Item | Value |
|---|---|---|
| Movement | Run speed | 6.0 m/s; accelerate/stop within ≤ 0.1 s; full air control |
| | Jump | Initial velocity 7.0 m/s, gravity −20 m/s², only jump when grounded |
| Dash (new) | Speed / time / cooldown | 14 m/s / 0.2 s / 1.5 s (cooldown counted from dash start) |
| | Direction | Current move direction; if standing still, the facing direction. Dash keeps height. Not invulnerable while dashing |
| Fireflies | Capacity | 10 |
| | Pickup | Automatic when XZ distance ≤ 1.0 m **and** height difference between Mây's feet and the mote's ground point ≤ 1.5 m |
| | Count | 20 at start on 20 different spawn points; max 30; at ticks 240, 480, … spawn 1 more on a free point if fewer than 30; no free point → skip |
| Lanterns | Cost to light | 10 fireflies, deposit over several visits allowed, lantern shows progress |
| | Interact | Within 2.0 m; each press deposits `min(carried, missing)` into **one** lantern. Only unlit lanterns count; nearest first, tie → smaller id |
| | Safe zone | A **lit** lantern makes a 6 m safe zone. Shades outside are blocked at the 6 m edge. A shade inside when the lantern lights is pushed out to the edge within at most 30 ticks and deals no damage meanwhile |
| Pulse (Tỏa Sáng) | Cost / radius / cooldown | 3 fireflies / 5 m / 3 s |
| | Effect | Centre = Mây + 0.8 m up. Targets locked on the activation tick (3D distance to shade centre ≤ 5 m). Shade stunned 120 ticks; during the first 15 ticks pushed back 4 m total horizontally (stops at obstacles; same position → push +X). Pulse re-stuns and re-pushes a stunned shade. Never kills. Fewer than 3 fireflies → does not activate |
| Bóng Mực | Speed | 4.0 m/s (Night 3: 4.5 m/s) |
| | Detect / lose | 12 m / 18 m |
| | Hit | XZ ≤ 1.0 m and height difference ≤ 1.5 m. Max 1 flame lost per tick. Shade then recoils 2 m over 60 ticks (`recoil`); touching Mây while invulnerable does nothing |
| | Spawn schedule | 2 at tick 300, then 1 per spawn interval (tick 300 + 480k on Night 1); no valid point → skip. Ids `S1`, `S2`, … in spawn order |
| Getting hit | Consequence | −1 flame; drop `floor(carried / 2)` fireflies on a ring 1.5–2.5 m around Mây (they live 480 ticks, pickable from the next tick); invulnerable 90 ticks |
| Falling off (Y < −10) | | Happens **once, ignoring invulnerability**: −1 flame, lose all carried fireflies, wait 60 ticks (no pickup, can't be hit), respawn at start, velocity 0, invulnerable 90 ticks. No flames left → lose at once, no respawn |
| HP | Flames | 3, refilled at the start of each Night |
| Time | Night 1 / 2 / 3 | 300 / 330 / 360 s |
| Win / lose | | After each tick: no flames → **always lose** (`no_flames`); alive and all lanterns lit → win (even on the last tick); otherwise time out → lose (`dawn`) |

**Score (standardised):** +10 per firefly **deposited** · +100 per lantern lit · +5 per shade hit by a pulse (each shade each time, stunned ones too) · on a win: + `floor(seconds left) × 2` + 50 × flames left. Game score = sum over the Nights won.

### Mandatory order inside one tick
1. Read input (handle `pause` first; if just paused, stop here).
2. Count down timers: time, cooldowns, invulnerability, stun, charm, dropped-firefly TTL, charm respawn.
3. Move Mây (jump, dash, jump pad, wind), then check falling off.
4. Pick up fireflies and charms.
5. Interact with lanterns.
6. Update safe zones.
7. Pulse.
8. Move Bóng Mực and Gió Lạc.
9. Contact: Gió Lạc steals first, then Bóng Mực hits (by increasing id).
10. Spawn fireflies, Bóng Mực, Gió Lạc on schedule (new entities interact from the next tick).
11. Check win/lose.
12. Write snapshot if due.

While paused: `tick` still increases, but `sim_tick`, time, cooldowns, spawns and TTLs stand still; snapshots write `state: "paused"`.

## Part 2: Standard maps

Angles are measured from +X, counter-clockwise seen from above, in the XZ plane.

**Night 1, Đảo Bến (re-standardised):** round island centre (0,0,0), **radius 40 m**; beyond 40 m is the cloud sea (fall). Start (0,0,0) facing +Z. Lanterns L1 (0,0,25), L2 (23.8,0,7.7), L3 (14.7,0,−20.2), L4 (−14.7,0,−20.2), L5 (−23.8,0,7.7). Firefly spawn points: 8 on radius 12 m (every 45°) + 16 on radius 33 m (every 22.5°). Bóng Mực spawn on 12 points at radius 37 m (15°, 45°, …), at least 15 m from the player; 2 at second 5, then one every 8 s; max 6.

**Night 2, Đảo Cau (new):** two round islands, radius 28 m, centres A (0,0,0) and B (70,0,0), joined by a bamboo bridge x ∈ [26, 44], z ∈ [−2, 2], no railing. Jump pads, radius 1 m, at (20,0,18) and (50,0,−18): feet touching a pad launch Mây with vertical velocity 14 m/s and horizontal velocity **24 m/s towards the other island's centre**. Launch velocity is kept until landing (movement keys don't override it; dash still works). About 1.4 s of flight, landing inside the target island. Firefly spawn points per island: 4 at radius 10 m (0°, 90°, 180°, 270°) + 8 at radius 22 m (every 45°). Bóng Mực spawn on 8 points at radius 26 m per island (22.5°, 67.5°, …). Lanterns L1–L6 at (0,0,25), (17,0,−10), (−17,0,−10), (70,0,25), (87,0,−10), (53,0,−10). Bóng Mực: one every 7 s, max 8.

**Night 3, Đảo Chuông (new):** round island radius 45 m with **3 levels**: level 0 (Y=0) whole island; level 1 (Y=3) a ring 12–24 m on the half with z > 0; level 2 (Y=6) a disc of radius 8 m at the centre. Level edges are vertical cliffs (can't walk up; walking off drops to the level below). Two 3 m-wide ramps along radius at 30° and 150°: foot at radius 30 m (Y=0), top at radius 24 m (Y=3). Jump pad radius 1 m at (0,3,13): vertical 12 m/s and horizontal 8 m/s towards −Z, kept until landing → lands on level 2. Bell tower 8 m tall at the level-2 centre, cylinder radius 2 m, can't be climbed. Firefly spawn points (30): level 0 has 18 at radius 34 m (every 20° from 0°); level 1 has 8 at radius 18 m (20°, 40°, …, 160°); level 2 has 4 at radius 5 m (45°, 135°, 225°, 315°). Bóng Mực spawn on 16 points at radius 43 m (every 22.5°). Lanterns L1–L7: (0,6,6), (18,3,10), (−18,3,10), (35,0,−10), (−35,0,−10), (20,0,−35), (−20,0,−35). **Strong wind:** every 30 s a gust lasts 5 s in a random direction, pushing the player 2 m/s; warned 2 s ahead by flying leaves and sound. Bóng Mực: one every 6 s, max 10.

## Part 3: New features

1. **Gió Lạc** (Nights 2 and 3): grey-green silk ribbon flying fast (7 m/s), max 2, spawning at tick 1200, 2400, … on a random fog point, ids `D1`, `D2`, …
   - States: `idle` (slow 2 m/s) → `chase` → `flee` → `removed`.
   - `idle` → `chase` when Mây carries **≥ 5 fireflies** and is within 15 m (checked every tick); back to `idle` when that stops being true.
   - Contact (XZ ≤ 1.2 m): **steals `min(3, carried)` fireflies**, switches to `flee` (flies away from Mây at 7 m/s for 240 ticks, then disappears with what it stole). Each one steals only once.
   - Pulse hitting a Gió Lạc in `chase` → it goes to `flee` without stealing. Pulse hitting one in `flee` while carrying → it drops everything it stole where it is (becomes dropped fireflies), and disappears after 120 ticks.
   - Does not cost flames; lantern safe zones don't block it; Mây's invulnerability doesn't stop the theft.
2. **Bùa Gió** (wind charm): gold-edged red leaf, ids `C1`, `C2`. Picked up like a firefly. Lasts 600 ticks (picking one up again resets it): run speed **7.2 m/s** and dash has no cooldown (the button must still be pressed again; pressing while dashing is ignored; dash stays 14 m/s for 12 ticks). Charm reappears 2700 ticks after pickup. Positions: Night 2 (35,0,0); Night 3 (30,0,25) and (−30,0,25).
3. **3-Night chain:** main menu → Night intro (island name, Ông Đăng's words) → play → result → next Night. Winning Night 3 shows the **Bình Minh** (dawn) screen with the total score. Losing lets you replay that Night.
4. **Pause** (Esc/P): game logic fully stops. Options: Continue / Replay Night / Settings / Main menu.
5. **Settings:** volume and mouse sensitivity, **saved** between game launches.
6. **Sound:** night background music plus effects for pickup, lighting a lantern, pulse, getting hit, jump, dash, win, lose, Bóng Mực appearing, and the 10-second countdown.
7. **Full HUD:** flames (top left); `mm:ss` timer (top centre, turns red and blinks when ≤ 30 s); lanterns `k/n` and score (top right); firefly bar with 10 cells (bottom centre); dash and pulse cooldown icons (bottom right); prompt "E — Nạp ánh sáng (x/10)" when near a lantern; arrow to the nearest unlit lantern when it is off screen.
8. **Standard palette** (each RGB channel within 10%, applies to the listed parts; other details are up to me):

| Used for | Hex |
|---|---|
| Night sky / fog | #0E1430 / #1B2350 |
| Grass / sand / wood / cloud sea | #2F5D50 / #C9B48A / #6B4A2F / #12384A |
| Lantern lit / core / unlit | #FFB347 / #FFE9B0 / #5B5F6E |
| Firefly core / halo | #FFF6C2 / #FFE58A |
| Bóng Mực body / rim / stunned | #120A1A / #7A3CFF / #3A3450 |
| Mây's coat / Mây's scarf and Bùa Gió | #E8E2D0 / #C8102E |
| Gold rim, score / Gió Lạc | #F2C14E / #8FA3B8 |
| Danger UI / UI text | #FF5A5F / #F5F1E6 |

Ambient light grows with progress: intensity = `0.15 + 0.55 × (lanterns lit / total lanterns)`.

## Part 4: Test Contract v1.1 (changes from v1.0)

- `contract_version: "1.1"`. `tuning` must **match the standard numbers** in Part 1; new keys `dash_speed`, `dash_duration_s`, `dash_cooldown_s`, `night2_duration_s`, `night3_duration_s`.
- `--night` accepts 1, 2, 3.
- Snapshot root adds `night` and `wind {active, dir_deg}`. `player` adds `vel`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s`.
- **Mandatory** snapshot arrays: `motes` (`id`, `pos`, `kind` = `random` / `dropped`, `ttl_s`), `drifters` (`id`, `pos`, `state`, `stolen`), `charms` (`id`, `available`, `respawn_s`).
- Scenario adds `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`, `shades[].{state, state_ticks_left}`, `drifters`, `charms`, and flags `random_drifters`, `wind_enabled`. The `drifters` and `charms` arrays replace the default lists.
- Input adds `dash` and `pause` (both trigger on a false → true change).
- New events: `dash {}`, `charm_picked {charm_id, charm_ticks}`, `drifter_steal {drifter_id, amount, carried}`, `drifter_drop {drifter_id, amount}`, `night_start {night}`, `paused {}`, `resumed {}`. `player_hit` from falling adds the field `lost`.
- From v1.1, Bóng Mực states must use exactly these names: `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- A full headless Night (at most 21,600 ticks) must finish in **≤ 30 s**.

## Definition of Done

- Evidence that the game meets the phase's requirements (any format).
- Every hidden Phase 1 test still passes when run with the standard numbers (regression).
- My spec doc (any name and place) has acceptance criteria for every item in Part 3.
- Agent guide (AGENTS.md or equivalent) and skills updated for the new scope (git history must show it).
- My tests include at least 1 headless scenario per new feature.
- Build runs at ≥ 30 FPS average at 1280×720.

## Still unclear (my assumptions, to record)

- How `per_mote` maps now: points are paid per firefly **deposited**, not per pickup.
- `spawning` state duration for Bóng Mực, wander behaviour, and the "random fog point" for Gió Lạc are not specified.
- Wind direction RNG must come from the seeded rng (determinism).
