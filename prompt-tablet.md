# prompt-tablet.md: quick play (Levels 1–4) on an Android tablet

**For:** the build session (it owns `hub.js`, `hub-head.html`, `hub-body.html`, `build.py`).
**Written:** 19 October 2026, from the code on `main` (25a8a83, the build live on Vercel) and a headless tablet run.
**Goal:** Levels 1–4 play well on an Android tablet in Chrome: playable with fingers alone, smooth, and lighter to load. The laptop game must not change by a single pixel.

**Decision (the player, 19 October 2026, 19:30): the tablet is 2D only.** No 3D on a tablet at all: no toggle, no button, no setting, and the 3D code and three.js are never downloaded. The laptop keeps its 3D as it is.

---

## 0. Scope and rules

**In scope:**
- quick play, Levels 1–4;
- the start menu, the level cards, the in-shift HUD, the debrief sheet;
- the 2D map. **On a tablet the game is 2D only.**

**Out of scope:**
- the concession and Stage 0 paper screens (`money/*`); they get their own tablet pass later. This pass must not break them.
- any 3D on a tablet; new 3D work anywhere;
- any redesign. Same look, same words. Only sizes, inputs and loading change.

**Devices:**
- **10–11" Android tablets in Chrome.** Design for **1280×800 CSS px landscape**, which is what a Galaxy Tab S9 / A9+ or a Lenovo Tab M10/P11 reports. Also check 1340×800 and 1200×750.
- **Portrait (800×1280)** must be playable, but landscape is the intended way.
- **Phones stay out.** If the short side is under 600 CSS px, show one plain line on the menu: "Vikram Sarabhai International plays best on a laptop or a tablet." Do not block play.

**Do not change the laptop.** Every change sits behind one tablet flag, set once at load:

```js
const TOUCH = matchMedia('(pointer:coarse)').matches && Math.min(screen.width, screen.height) >= 600;
document.documentElement.classList.toggle('touch', TOUCH);
```

All CSS changes go under `html.touch …`. All JS changes go under `if (TOUCH)`.

**Where the code goes (to keep merges clean):**
- Put the tablet code in two new files, appended by `build.py`:
  - `tablet.js`, inside hub.js's closure at a new `/*@@TABLET@@*/` marker, like `/*@@3D@@*/`;
  - `tablet.css`, appended to the head styles.
- `hub.js` gets only small hooks: the hit radius, the pinch handler entry, the 3D default, the DPR cap.
- `money` is being integrated tonight. **Cut branch `tablet` from `main` after the 22:00 deploy lands.** Do not start before: `hub.js` is mid-merge.

---

## 1. What the code does today (measured, not guessed)

| # | Finding | Where | Effect on a tablet |
|---|---|---|---|
| 1 | **No pinch zoom.** The 2D map pans with one pointer and zooms only by `wheel` or the + / − / Fit buttons. "How to play" says "Wheel or pinch to zoom", but there is no pinch code. | `hub.js` ~2229–2232 (`cv` pointer and wheel handlers) | Zooming means the small buttons only. The help text is wrong on a tablet. |
| 2 | **Aircraft hit radius is 9 px** (`Math.max(9, f.sr)`). Planes draw at 2–4 px. | `pick()` | A finger tap 14 px off a plane opens nothing (tested at L1 and L4). Prioritising or holding a flight is close to impossible. |
| 3 | **Every control is under 44 px.** 36–38 visible buttons in a shift are all below 44 px; the smallest are 22 px tall. This covers the runway desk ARR/DEP/MIX/OFF, Pause/1×/2×/4×, + − Fit and the tabs. | `hub-head.html` CSS | Mis-taps on the runway desk, the game's main control. |
| 4 | **Hover-only information:** the runway-mode preview on the bank chart (`onmouseenter`), the bank chart tooltip (`mousemove`), the KPI explanations (`title=`), and the aircraft hover highlight. | `previewOn()`, the `wcv` handlers, the `#kpis` titles | Invisible on touch. |
| 5 | **Keyboard-only actions:** Space pause (there is a button, fine), 1/2/3 speed (buttons, fine), **M 2D/3D, C camera, Q/E rotate, G quality, Shift+P perf report, Escape**. | `keydown` handlers in `hub.js` and `hub3d.js` | No way to switch view, cycle the camera or close a popup without a keyboard. |
| 6 | **3D is the default** (`V3.want = zm_view !== '2d'`). It uses three.js from jsDelivr with shadows, AO and bloom, plus about **740 KB of 3D code inlined in the page even when 2D is used**. If the CDN fails, a **red error banner** covers the bank chart. | `hub3d.js` line 14, `build.py` (the `/*@@3D@@*/` inlining) | Heavy on a tablet GPU and battery. On a weak connection the first thing a player sees is an error. |
| 7 | **The page is one 1.66 MB file, 459 KB gzipped, and 246 KB of that gzipped is 3D.** The voice clips (6.8 MB) and music (1.2 MB) already load on demand. | `site/index.html` | Over half the first load is code a tablet player won't use. |
| 8 | **The canvas renders at up to DPR 2**, a 2560×1600 backing store at 1280×800. | `resize()`: `Math.min(devicePixelRatio, 2)` | About 4 million pixels redrawn every frame. Headless at 4× CPU slow-down: L1 4 fps, L4 8 fps (software rendering, so pessimistic, but CPU-bound). |
| 9 | **Portrait (under 980 px wide) hides the bank chart, the At risk / Coach / Terms tabs and the coach toast.** The runway desk takes 44% of the height. | `@media (max-width:980px)` in `hub-head.html` | The bank chart is the game's radar ("How to play" says so), and the coach toast is Level 1's tutorial. Both are gone in portrait. |
| 10 | **Landscape 1280×800 fits:** no page scroll, and the HUD, map, desk, incidents and bank chart are all visible. The coach card covers part of the map. | screenshots in §6 | A good base: size up, don't re-lay out. |
| 11 | **Sound already defaults off on a coarse pointer**, and music retries after a `NotAllowedError` on the next pointerdown. | `SND`, `music()` | Fine. Keep it. |
| 12 | **The map terrain is already cached** to an offscreen canvas (`TERR`). | `hub.js` ~1913 | Fine. |

---

## 2. The work, in order (P0 first; each item has its acceptance check)

### P0 · Playable with fingers (about 2.5 h)

1. **Hit targets on the map (TOUCH only).**
   - Aircraft pick radius is `Math.max(24, f.sr)` CSS px, nearest wins. Incidents: 28 px. Runway signs: the sign box plus 10 px.
   - If two aircraft fall within the radius, open a small chooser listing both callsigns, rather than guessing.
   - *Check:* a tap 18 px off a plane opens its popup at L1 and L4.
2. **Pinch, pan and double-tap on the 2D map.** Track the active pointers in a `Map` keyed by `pointerId`:
   - **one finger** pans (as now);
   - **two fingers** pinch-zoom about the midpoint and pan with the midpoint, using the same `camT`/`clampCam` path the wheel uses;
   - **double-tap** zooms ×1.6 about the tap;
   - a pinch never counts as a tap: no popup opens after two fingers lift.

   *Check:* a CDP `Input.dispatchTouchEvent` two-finger pinch changes `cam.s` and opens no popup.
3. **Controls at 44 CSS px or more** under `html.touch`:
   - runway desk ARR/DEP/MIX/OFF, at least 44 px tall;
   - Pause/1×/2×/4×/Sound;
   - + / − / Fit;
   - tabs;
   - every popup and incident option button;
   - the sheet's level cards, already large.

   Keep the same type and colours. If the rail runs out of height at 800 px, the incidents panel and the tabs share one panel with a two-tab switch; never shrink the runway desk.

   *Check:* the bot finds no visible game control under 44×44 at 1280×800.
4. **Replace every hover:**
   - **Runway-mode preview:** pressing and holding a mode button for 350 ms shows the preview on the bank chart; lifting the finger off it cancels; a normal tap sets the mode as now.
   - **Bank chart tooltip:** tap a bar to show it; tap anywhere else to hide it.
   - **KPI explanations:** tap a KPI for a small paper-slip note with the `title` text; it closes on the next tap.
   - **Aircraft highlight:** drop it on touch.
5. **On-screen replacements for keyboard-only actions** (TOUCH only), in the existing `#zoomBox` style:
   - every popup gets a visible **×**;
   - a tap on empty map closes the open popup (that is Escape);
   - Shift+P stays a menu setting; add **Copy report** to the perf meter overlay.

   The 3D keys (M, C, Q/E, G) get **no** tablet equivalent: there is no 3D on a tablet.
6. **2D only on tablets.**
   - When `TOUCH` is true, `V3.want` is forced to false and `init3D()` is never called, whatever `zm_view` says in storage.
   - Hide every 3D control and every mention of 3D on the tablet: the view switch, the quality setting, and any "3D" wording in the menu or the help.
   - The 2D/3D keyboard shortcut does nothing on TOUCH.
   - three.js is never fetched, so the red "3D view could not start" banner can never appear on a tablet.
   - *Check:* on the tablet profile, no request goes to jsDelivr, `V3.on` stays false through L1–L4, and no visible text contains "3D".
7. **Words that match the device.** On touch, "How to play" and the tooltips read:
   - "Tap any aircraft to see where it's going, prioritise it or hold it at the gate";
   - "Pinch to zoom, drag to move";
   - "Tap Pause, 1×, 2× or 4×".

   No "Space", no key caps, no "click", no "wheel". Laptop text is unchanged.

### P0 · Portrait that still plays (about 30 min)

8. Under `html.touch` in portrait, **keep the bank chart**, at about 22% of the height, between the map and the runway desk. The runway desk keeps its 6 rows; incidents and the tabs share one panel as in 3. The coach toast becomes a **bottom sheet** above the desk, so Level 1's tutorial is not lost.
9. The menu gets one quiet line in portrait: "Turn the tablet sideways for the full desk." This is a hint, not a block.

### P1 · Lighter and smoother (about 1.5 h)

10. **Tablets never download the 3D code.** `build.py` writes `hub3d.js` plus `3d/*.js` to `site/v3.js` instead of inlining them. At boot, a non-touch device loads `v3.js` straight away, exactly when the inline code runs today, so the laptop behaves the same. A TOUCH device never loads it.

    Today 3D shares hub.js's closure, so the split needs the closure's bindings passed through one object (`window.__V3HOST`). If that diff grows past a clean hook, build two pages instead: `index.html` (the laptop, unchanged) and a 2D-only `index.html` variant chosen at load by a tiny inline check. Pick the smaller diff and note which in `progress.md`.

    *Check:* first-load gzipped size on the tablet profile is at most **230 KB** (today 459 KB). The laptop still opens in 3D with no visible difference.
11. **Cap the canvas DPR at 1.5 on TOUCH.** That is 1920×1200 at 1280×800: 44% fewer pixels, still sharp at tablet viewing distance. Lines and labels stay crisp, because they are drawn in CSS px. *Check:* the canvas backing store is 1920×1200 at 1280×800 DPR 2.
12. **A frame budget.** Reuse the existing perf meter (`PERFM`). On TOUCH, if the frame time stays over 25 ms for 3 s, drop the cosmetic layers in this order: particle and weather dust, terrain grain, the aircraft trails; then show "Lighter graphics on" in the ticker. Never drop gameplay: aircraft, runways, labels, incident rings. *Check:* at 4× CPU slow-down, L4 holds **at least 30 fps** in headless 2D after the drop. Confirm on the real tablet (§5).
13. **Draw less when nothing moves.** When paused, or with the menu or debrief sheet open, render the map at 10 fps. `visibilitychange` already exists; make sure a hidden tab draws nothing.

### P1 · Feels like an app (about 45 min)

14. **Web app manifest** (`site/manifest.webmanifest`):
    - name "Vikram Sarabhai International", short name "VSI";
    - `display: fullscreen`, `orientation: landscape`;
    - theme and background in the game's ink colour;
    - 192 and 512 px icons drawn from the existing VSI mark.

    On TOUCH, the menu shows **Add to home screen** when Chrome's `beforeinstallprompt` fires.
15. **Full screen and landscape:** on TOUCH, a **Full screen** button in the menu calls `requestFullscreen()`, then `screen.orientation.lock('landscape')` (wrapped in try/catch; it only works in full screen).
16. **Screen stays on during a shift:** `navigator.wakeLock.request('screen')` when a level starts; release it on pause, the menu or the debrief; re-request it on `visibilitychange`.
17. **No accidental browser gestures** (TOUCH only):
    - `overscroll-behavior: none` on `html, body`, so there is no pull-to-refresh mid-shift;
    - `touch-action: manipulation` on every button, so there is no double-tap page zoom;
    - `-webkit-user-select: none` and `-webkit-touch-callout: none` on the HUD and the rail.

    Keep pinch-zoom of the page available on the menu and debrief sheets, for accessibility.

### P2 · If there is time

18. A short vibration (`navigator.vibrate(30)`) when a new call arrives, behind the Sound setting.
19. A service worker that caches `index.html` and the fonts, so a level can start on a weak connection. The voice clips and music stay on demand.

---

## 3. Guardrails

- **The laptop is untouched.** Take screenshots at 1440×900 and 1280×800 with a mouse (`hasTouch: false`) of the menu, L1 running, and an L4 incident, before and after. **They must be pixel-identical.** Any difference fails the branch.
- **The money-off gate**, run alone: the expert autopilot keeps 3★ on L1–L4 within noise of the `progress.md` baseline.
- **Quick play rules hold:**
  - at most 3 choices per call;
  - safety calls never show a price;
  - plain words (no DSCR, RAB, WACC, true-up, EBITDA, IRR, SLA, UDF, covenant, step-in, CFADS);
  - tags stay in the margins.
- **Concession mode still opens and plays on the laptop.** On the tablet it may look unpolished, but it must not throw.
- No new external domains. Fonts stay on Google Fonts. three.js stays on jsDelivr and is fetched only by the laptop.

---

## 4. The automated tablet test (`tools/tablet_test.py`, Playwright, Chromium in `/opt/pw-browsers`)

**Profiles:**
- `tab-land`: 1280×800, DPR 2, `isMobile`, `hasTouch`, an Android Chrome user agent;
- `tab-land-15`: 1280×800 at DPR 1.5;
- `tab-port`: 800×1280;
- `phone`: 412×915, which must show the "plays best on" line;
- `laptop`: 1440×900 with a mouse, for the pixel comparison.

**A tap-only play-through of L1, then L4 for 3 minutes of game time.** Use no `click()` and no keyboard; only `touchscreen.tap`, plus CDP touch events for pinch and hold.
1. From the menu, tap Level 1.
2. Read the coach (portrait: the bottom sheet).
3. Tap a runway to MIX and back.
4. Long-press DEP and check the bank chart preview appears.
5. Tap an aircraft 18 px off its centre and check the popup opens; tap **Prioritise**.
6. Pinch in and out.
7. Double-tap.
8. Tap Pause and 2×.
9. Resolve an incident by tapping an option.
10. Tap the empty map and check the popup closes.

**Assertions:**
- no page errors;
- no visible game control under 44×44;
- no keyboard-only action;
- the bank chart is visible in every profile except `phone`;
- 3D never loads on a tablet: no `v3.js`, no jsDelivr request, `V3.on` always false, no "3D" text;
- first-load gzipped size is 230 KB or less;
- L4 holds 30 fps or more at a 4× CPU slow-down after the frame-budget drop;
- laptop screenshots are pixel-identical.

Save a screenshot of every step for each profile in `shots/tablet/`.

---

## 5. On the real tablet (the last step; headless numbers are only a floor)

The player plays L1 and L4 on his own Android tablet in Chrome (model and Chrome version to be noted). Steps:
1. Open the Vercel preview of the `tablet` branch.
2. Turn the perf meter on in the menu and play 5 minutes of L4 at 2×.
3. Tap **Copy report** and paste the report into `progress.md`.
4. Note anything that was hard to hit or read.

Pass:
- L4 at 2× holds 45 fps or more on the device;
- no control he had to tap twice;
- the screen did not dim mid-shift.

---

## 6. Evidence from the headless run (19 October 2026, `main` 25a8a83)

| Profile | What happened |
|---|---|
| 1280×800 landscape, touch | Fits, with no page scroll. HUD 892×134, rail 352×776, bank chart 892×190. **36 of 36 controls under 44 px; smallest 22 px.** A tap 14 px off a plane opened nothing. |
| 800×1280 portrait, touch | Bank chart and tabs hidden (the 980 px rule). Runway desk at the bottom, 44% of the height. Coach toast hidden. |
| Both | The 3D view tried to load from jsDelivr, failed (no network in the test box) and showed the red "3D view could not start" banner over the bank chart. With 2D only on tablets, this can't happen there. |
| CPU 4× slower | 2D: L1 at 4 fps, L4 at 8 fps (software rendering; real GPUs do better, but the drawing is CPU-bound at DPR 2). |
| Page weight | `index.html` 1.66 MB, 459 KB gzipped. 3D code is 246 KB of that. Masterplan SVG 31 KB, spec 24 KB, roof 12 KB (all gzipped). |

---

## 7. Time and order

| Step | Time |
|---|---|
| P0 fingers (1–7) | 2.5 h |
| P0 portrait (8–9) | 0.5 h |
| P1 lighter (10–13) | 1.5 h |
| P1 app feel (14–17) | 0.75 h |
| The tablet test and the laptop pixel check | 1 h |
| **Total** | **≈ 6 h of build time**, after tonight's deploy |

Merge to `main` only after §3 and §4 pass and the real-tablet check in §5 is logged in `progress.md`.
