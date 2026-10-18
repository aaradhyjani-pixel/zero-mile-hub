# Art-direction review of the round-2 3D (2026-10-18)

The review was run on main 32ed038. The screenshots are in `qa/art-review-shots/`, which is gitignored and was copied from `/tmp/zmh/ad/`.

**Verdict:** the scene has gone from about 3/10 to about 5/10. It now clearly reads as 3D, with light, AO, shadows, haze and PBR materials. It still looks like a 2013–2016 browser sim, and three things give that away:
- the milky, low-contrast image;
- flat ground at close range;
- the andhi, which is one flat brown fill from inside and too short a wall from outside.

| Area | Before | After | Main problem |
|---|---|---|---|
| Lighting / sky / post | 3 | 5.5 | Pale grey sky with no blue zenith; the wide view is washed out; L3 heat looks pea-green, not dry |
| Ground / runways | 2 | 4.5 | Flat grass close up; runways almost invisible from the wide view; the mode wash turns asphalt teal at low angles |
| Terminal | 4 | 6 | The roof is a uniform white plane; skylights read as dark holes |
| Aircraft | 4 | 6 | Good shapes and liveries, but small on an empty, flat apron |
| Andhi | 2 | 4.5 | Wall about 800 m tall (should be 1.5–2.5 km); a cumulus sits in front of it; the inside is flat brown; the terrain stays in full sun under a black sky |
| Clouds | 1 | 4 | One to three cotton balls per view, and one sits on the 27R label |

## Fixes, in order of impact per hour

1. **Remove the milky veil (about 1 h).**
   - In `hub3d.js`:
     - Set `HAZE_K` 1.2→0.5, `HAZE_H` 650→400, and base `fogDensity` 0.000035→0.000022 on L1–2.
     - In `atmoApply`, set turbidity 4.2→2.6, `mieCoefficient` 0.0055→0.0035, and `skyGain` to about 0.5.
   - In `3d/weather.js`, change `def.grade` to contrast 1.1, saturation 1.08 and vignette 0.08.
   - Try AgX tone mapping at exposure about 1.1 instead of ACES.
   - On L3, make the heat warm rather than green.
2. **Runway readability (about 45 min, `3d/field.js`).**
   - In the washes shader, apply `a *= smoothstep(1500.,5000.,camDist)` to the full-surface alpha, and keep only the edge band and the changeover markers close up.
   - Darken the asphalt albedo to 0.08–0.10.
   - Add rubber deposits in the touchdown zones.
3. **Runway-light halos (about 40 min, a bug; `field.js` `lightMat`).**
   - Change `mv.xyz -= normalize(mv.xyz)*4.0` (it is `*=0.997` today).
   - Set the dust swell from 1.6 to 0.6 and clamp `gl_PointSize` to 40.
   - Use a sharper `exp(-d*8.)` core with a faint skirt.
4. **Andhi interior (about 1.5 h, `weather.js`).**
   - Set the dust sheets' renderOrder −10→10, so the oculus dome stops showing through.
   - Cap `inDen` at about 0.0009.
   - Add a vertical fog gradient from #5a3d26 at the ground to #b48a5c overhead.
   - Add large-scale density noise to the sheets, moving at wind speed.
5. **Close-range ground detail (2–3 h, `field.js`).**
   - Blend world-space detail at three scales (2 m, 15 m and 120 m): dry tufts, bare earth by the taxiways, and mowing rows inside the strip.
   - Shift the L3 palette towards ochre and straw.
6. **Haboob wall scale (about 1.5 h, `weather.js`).**
   - Change `colTop` to about 1900±600 m and make the wall puffs 1.5× larger.
   - Shade from a dark base (#2e2017) to a sunlit top (#c89660), with a rim term towards the sun.
   - Overlap the skirt puffs to about 350 m to hide the seam.
   - Set `uCumA = 1 - appr`.
7. **Storm light and wet look (about 1 h).**
   - Under the wall: `sunDim = mix(1,0.45,wall*appr)`, a brown ambient at about 0.6, and ground saturation 0.75.
   - In the rain tail, set apron and runway roughness to about 0.35.
   - Rain streaks: 1 px wide, alpha 0.25, length −40%.
8. **Clouds (about 1 h).**
   - Use 3–4× as many clusters, with flatter and darker bases.
   - Add a distant band of clouds at the horizon.
   - Then make the roof skylights reflective glass with per-panel roughness.

## Bugs

- **Oculus dome shows through the brown-out.** Cause: render order. Fix 4 above.
- **Runway light halos are clipped by the ground** and show as half-domes ("mushrooms"). Fix 3 above.
- **Haboob wall seam:** a straight horizontal cut with pale sky showing through.
- **Possible diagonal hatching on the far ground** (low confidence). It might be shadow acne at the low storm sun; check with shadows off.
- **Overlays ignore fog.** The guide lines (`gmat`, `fog:false`) and the mode washes stay crisp in the storm. Fade them with `Z.atmo.visibility`.
- **Red frame edges in the storm.** The holding-stack vignette (`#vign`) stacks with the storm vignette. Desaturate `#vign` or hand over to the grade while the dust is on.

## Performance (High tier, 1440×860)

- **Day:** 56–60 fps, 77–93 draw calls, 0.86–1.33 M tris.
- **Inside the andhi:** 42 fps, 99 calls, 1.55 M tris, cpuMs 9.7. That sits right on the AO drop threshold, so real players will probably fall to Medium inside the storm. The cost is mostly fill rate.
- **Hitch:** a one-off 668 ms frame when the storm meshes first become visible. Prewarm with `renderer.compileAsync` and the weather meshes forced visible at level start.
