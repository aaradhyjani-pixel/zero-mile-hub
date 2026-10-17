# Zero Mile International (ZMI)

A speculative mega-hub at India's geographic centre, near Nagpur, sized for the combined traffic of Delhi, Mumbai, Bengaluru and Hyderabad: about 3,630 movements and 209 million passengers a year. Plus a browser game where you run it.

**Play:** open `site/index.html`, or the GitHub Pages / Vercel deployment.

- Six parallel runways in two triples, with end-around taxiways, so no aircraft crosses a runway to reach a gate.
- The Zero Mile Hall: a seven-lobed "Nagpur orange" shell. The Mall: a fluid spine with a people mover. Six concourses and 372 stands.
- Four levels as the airlines move in: Bengaluru → + Hyderabad → + Mumbai (46 °C heat) → + Delhi (full hub, dust storm).

## Build
```
python3 gen_airport.py    # geometry → spec.json (validates connectivity, clearances)
python3 gen_drawings.py   # masterplan.svg, roof.svg
python3 build.py          # → site/index.html (single self-contained file)
python3 run.py 4 expert   # headless playtest (needs playwright + chromium)
```
See **build.md** for the full context and architecture, and **prompt.md** for the polish and 3D roadmap.

## Deploy
- **GitHub Pages:** the workflow in `.github/workflows/pages.yml` publishes `site/` on every push to `main` (Settings → Pages → Source: GitHub Actions).
- **Vercel:** Add New → Project → import this repo. `vercel.json` serves `site/` with no build step.
