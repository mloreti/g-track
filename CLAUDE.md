# G-Track · Shot Entry — Project Guide

Golf shot-tracking web app. Full-screen Leaflet map with a slide-in "Play By Play" panel, inspired by PGA TOUR TOURCAST. No build step — plain ES modules, deployable to GitHub Pages.

**Repo:** `github.com:mloreti/g-track.git` (branch: `main`)
**Serve locally:** `python3 -m http.server 8765` from the project root, then open `http://localhost:8765/index.html`

---

## Golf Rules Reference

**`docs/golf-hole-flowchart.md`** is the authoritative reference for how a golf hole works. Consult it when making decisions about shot flow, penalty handling, relief options, or stroke counting. Resolve any disagreements about golf rules or model design against that document.

---

## Architecture

```
app.js                  — entry point: wires everything together
js/
  data/stonebridge.js   — 18-hole config (tee/green lat-lng, par, yardage)
  managers/
    MapManager.js       — Leaflet map init, click handlers, rotation
    SaveManager.js      — localStorage persistence (round + holeConfig)
    SGCalc.js           — Strokes Gained calculator (Broadie baseline)
  models/
    Round.js            — top-level round (array of HoleRound)
    HoleRound.js        — per-hole state: shots[], putts[], pin, score
    Shot.js             — a single struck shot (type, latlng, lie, club)
    Putt.js             — a single putt (latlng, pinLatLng → distFt)
    ShotMarker.js       — Leaflet divIcon marker for shots
    PuttMarker.js       — Leaflet divIcon marker for putts
    PinMarker.js        — Leaflet divIcon marker for the pin (⛳)
    MapPoint.js         — base draggable marker helper
  modes/
    ShotEntry.js        — all UX logic: click flow, modes, rendering
sg_baseline.csv         — Broadie SG expected-strokes table (CSV)
index.html              — shell; panel/bar HTML; loads app.js as module
css/styles.css          — dark theme, full-screen layout, panel styles
tests/
  e2e/app.test.mjs      — Playwright browser tests (12 tests)
  models/               — bun unit tests for SGCalc, HoleRound, etc.
  scenarios/            — bun scenario tests
```

---

## Click Flow (current UX)

Each hole follows this strict sequence — every state transition is managed by `_enterMode()` in `ShotEntry.js`:

1. **Tee mode** (`'tee'`): First click places the tee marker. Transitions to pin mode.
2. **Pin mode** (`'pin'`): Next click places the ⛳ pin. Transitions to shot mode.
3. **Shot mode** (`'shot'`, persistent): Each click places an approach landing dot. Stays in shot mode — clicks keep adding shots.
4. **Putt mode** (`'putt'`, persistent): Activated when user marks a shot's lie as "Green" (sidebar lie buttons). Each click places a putt dot. Stays in putt mode.
5. **Holed**: User clicks "Holed?" button on the last putt in the sidebar.

The 📌 button in the panel header re-enters pin mode at any time (for repositioning).
Undo (↩ button) removes the last placed item and restores the correct mode.

---

## Key Design Decisions

**`shot.lie` = result lie** — where the ball ended up after that shot. This is the *starting* lie for the NEXT shot. SG calculations must use `shots[i-1].lie` as the starting lie for `shots[i]`, not `shots[i].lie`.

**Modes are managed by `_enterMode(mode)`** — always call this to switch modes. It calls `_exitMode()` first (deregisters current click handler), sets up the new handler, updates guidance label, and highlights the relevant button. Never directly assign `_activeMode` or set up `mapMgr.onMapClick` outside `_enterMode`.

**`_placePin` has a `silent` option** — `_placePin(latlng, { silent: true })` skips mode transitions and `renderShotList()`. Used by `_restoreMarkers()` during hole load so the restore doesn't trigger mode changes.

**Arc drawing** — shot arcs are quadratic bezier curves drawn in `_drawArcs()`, called from `renderShotList()`. Arcs connect: tee→approach1, approach1→approach2, ..., lastApproach→putt1, putt1→putt2, ..., lastPutt→pin. Carry distance labels appear on shot-to-shot arcs only.

**No build step** — everything is native ES modules. `import` paths must use relative paths with `.js` extensions.

**Persistence** — `SaveManager` stores the in-progress round in `localStorage` under `gtrack_round`. Hole config (user-adjusted tee/green positions) is stored separately under `gtrack_holeconfig`. Both are restored on page load in `app.js`.

---

## SG Calculation

`SGCalc` uses `sg_baseline.csv` (Broadie scratch-golfer expected strokes by category/lie/distance).

- **`expectedStrokes(category, lie, distance, unit)`** — interpolates between nearest rows; clamps at boundaries; returns `null` for unknown category+lie combos.
- **`sgPutting(putts[])`** — `expected(firstPutt.distFt) - numPutts`
- **`sgOffTee(holeRound)`** — `expected(tee, holeDist) - 1 - expected(approach, tee.lie, nextDist)`
- **`sgApproach(holeRound)`** — sums `expected(approach, prevLie, dist) - 1 - expected(next)` for each approach shot. When result lie is `'green'`, routes to putting baseline using `nextDist * 3` ft approximation.

SG summary only shows when `holeRound.isComplete()` is true (last putt holed or score manually set).

---

## Running Tests

```bash
# Unit + scenario tests (bun)
bun test tests/models tests/scenarios

# E2E browser tests (Playwright) — requires server running
python3 -m http.server 8765 &
npx playwright test
```

E2E tests are in `tests/e2e/app.test.mjs`. The helper `loadAndSetupHole(page)` places tee (first click) then pin (second click) — matching the current tee-first flow. All 12 tests pass as of the last commit.

---

## Stonebridge Course Data

`js/data/stonebridge.js` — 18 holes, Naples FL (~lat 26.26, lng -81.77). Each hole has `{ holeNum, par, tee: {lat,lng}, green: {lat,lng} }`. The map centers on `cfg.tee` and rotates toward `cfg.green` on hole load.

---

## What's Working

- Full tee → pin → shots → putts → holed flow
- Shot arcs with carry distance labels
- Lie buttons (FW / Rough / Bunker / Green / OB) on each shot row in sidebar
- Club selector per shot
- OB shots turn red on the map
- Undo restores correct mode at each step
- SG:Off Tee, SG:Approach, SG:Putting shown when hole is complete
- Round persists across page reloads via localStorage
- Hole navigation (prev/next) with map re-centering

## Known Gaps / Possible Next Steps

- No scorecard view (summary across all 18 holes)
- No export / sharing of rounds
- Chip-in / hole-out from non-putt (currently requires 0 putts + manual score)
- Pin repositioning after initial placement works via 📌 button but doesn't re-enter shot mode afterward
- Course data is hard-coded to Stonebridge; no multi-course support yet
