# Texoma RV Park — 3D Concept Plan (rev 15)

**Live 3D view:** https://texoma-rv-park.github.io/Texoma-RV-Park/  
Survey PDF: https://texoma-rv-park.github.io/Texoma-RV-Park/survey_11.266ac.pdf

Interactive three.js site plan for an 11.266-ac tract, William Ritchey Survey A-892, Cooke County TX
(US Hwy 82 frontage south, County Road 167 west). Survey PDF: `survey_11.266ac.pdf`.

## Build
```
npm install
npm run build        # -> dist/index.html (single file, three.js inlined, no CDN)
```
Open `dist/index.html` in any browser. For GitHub Pages, publish `dist/index.html` as the site root.

## Code map (`src/main.js`)
- **Coordinates:** feet; x = east, y = north; origin = survey P.O.B. (SE corner on Hwy 82). `W(x,y,h)` maps plan → three.js world.
- `PARCEL` — boundary from survey bearings (closes at 11.266 ac).
- **Roads:** `road(pts,width,radius)` = filleted ribbon + clearance entry. Ritchey Trail 36', Pecan Loop 32',
  Park Entrance Blvd 70' (26' median), Check-In Lane 18' one-way, Park Row 20' one-way + NE spur, Office Drive (exit only).
- `keep[]` — keep-out polygons; RV sites auto-place only where clear of roads, keep-outs, and 5' from the boundary.
- `ROWS` — site rows `[xFrom,xTo,edgeY,dir,depth]` (or `[yFrom,yTo,edgeX,dir,depth,'col']` for E/W-facing).
  `place()` → `siteRow()` / `siteCol()`. Numbering order is set where `numLabels` is built.
- **Wastewater:** aerobic ATUs + subsurface drip. Flow = sites×40 gpd + 400 (laundry/restrooms) + homes×180.
  Drip area = flow / RA (0.20 assumed). The drip field's east edge `Xe` is auto-sized in the loop after `ROWS`.
- Other blocks: commercial reserve `RES`, office/laundry, container homes (`containerHome`), amenity strip
  (play/sitting/dog park), detention pond + drainage swale/arrows, trees (instanced), highway traffic.
- `VIEWS` — camera presets for the bottom buttons; `window.__view(p,t,nums)` sets a camera for screenshots.

## Current numbers
80 RV sites + 3 two-story 1-BR container homes · commercial ±1.05 ac · flow ≈4,140 gpd (<5,000 OSSF limit)
· drip ≈21,900 sf shown vs 20,700 sf needed.

## Open items
- Soil test (sets drip RA), OSSF design, TxDOT driveway permit (Hwy 82), county permit (CR 167),
  drainage study / pond sizing, locate 20' Woodbine WSC easement, county rules for container homes.
- Deploy: GitHub Pages via `.github/workflows/pages.yml` — publishes the committed `dist/index.html` on every push to `master`.
