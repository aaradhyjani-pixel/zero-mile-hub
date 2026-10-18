# progress.md — session log (newest at the bottom)

Keep this current so a restart loses nothing. Working copy: `~/zero-mile-hub` (git clone of github.com/aaradhyjani-pixel/zero-mile-hub). Playwright venv: `.venv/` (gitignored).

## 2026-10-18 — session start

### Baseline (before any change; commit a635bbe)
Build OK (`gen_airport.py` VALID: 6 runways, 309 taxi nodes all reachable, 372 stands: 288 C / 68 E / 16 F). `site/index.html` rebuilt byte-identical.

| Level | Expert | Lazy |
|---|---|---|
| 1 | 3★ 98/82 moves, OTP 98, cnx 100, safety 100, 14 incidents | 0★ 85/82, OTP 75, safety 60 (4 timed out) |
| 2 | 3★ 199/165, OTP 94, cnx 99, 17 incidents | 0★ 179/165, OTP 81, safety 56 |
| 3 | 2★ 269/245, OTP 89, cnx 88, 17 incidents | 0★ 260/245, OTP 82, safety 42 |
| 4 | 2★ 315/310, OTP 85, cnx 90, 33 incidents | 0★ 272/310, OTP 77, safety 40 |

Zero console errors on all 8 runs.

### User feedback mid-session (top priority)
"Constantly asking me to sweep this runway / send bird patrol" wastes the player's time; cut it ≥10× or remove it. Cause found: `incSpawner` rolls every 60 sim-s (3 real s at 1×) with 10–30% odds; FOD+birds ≈ 60% of the pool; one-button chores; timeouts cost 8–12 safety, so chores decided the stars.

Plan: routine ops automated + visible; player incidents = consequences of runway decisions + a few scripted two-sided choices with a stated default; pacing governor; "Incidents: Standard / Off" switch; retune stars so the runway desk is the skill.

### Work queue
- [ ] Incident overhaul (Phase 0 item 7 + user feedback)
- [ ] run.py: handler bot, per-run outdir, incident counting
- [ ] A0 research (workflow wf_a1b74a77-581 running) → design.md
- [ ] Workstream A: roof, stands/MARS, airside, landside, phase 2, drawings (masterplan, roof, section, axo)
- [ ] Merger in the game: menu, "The airport" tab, level briefings, last-flight-out moments
- [ ] Phase 0 items 1–6, 8–11
- [ ] Final acceptance runs, screenshots, publish
