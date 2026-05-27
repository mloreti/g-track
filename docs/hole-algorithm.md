# Hole Playback Algorithm

## Core Idea

A hole is a chain of positions. Every position is a coordinate on the map. Every consecutive pair of positions is one stroke. The chain always starts at the tee and ends at the pin.

```
hole.tee → shots[0] → shots[1] → ... → putts[0] → putts[1] → ... → hole.pin
```

---

## Data

**Hole data (fixed per hole, not strokes):**
- `hole.tee` — where the hole is played from
- `hole.pin` — the hole location (⛳)

**Shots** — ball positions after each non-putt stroke:
- `shots[i].latlng` — where the ball ended up
- `shots[i].startLie` — lie the ball was in before this stroke
- `shots[i].endLie` — lie the ball ended up in after this stroke
- `shots[i].club` — club used

**Putts** — ball positions after each putt:
- `putts[j].latlng` — where the ball ended up after this putt
- `putts[j].holed` — true on the final putt

---

## Building the Position Chain

```
positions = [hole.tee, ...shots.map(s => s.latlng), ...putts.map(p => p.latlng)]
```

The final arc always goes from `putts[last].latlng` to `hole.pin` when `putts[last].holed = true`.

---

## Stroke Numbering

Stroke `n` = the arc from `positions[n-1]` to `positions[n]`.

| Stroke | From | To |
|--------|------|----|
| 1 | hole.tee | shots[0].latlng |
| 2 | shots[0].latlng | shots[1].latlng |
| ... | ... | ... |
| N | shots[N-2].latlng | shots[N-1].latlng |
| N+1 | shots[N-1].latlng | putts[0].latlng |
| N+2 | putts[0].latlng | putts[1].latlng |
| ... | ... | ... |
| Final | putts[last].latlng | hole.pin |

---

## Arc Styling

For each arc from `positions[i]` to `positions[i+1]`:

- If `i > 0` and `shots[i-1].endLie === 'penalty'` → **red solid arc** (ball in water/OB)
- If `i > 0` and `shots[i-1].startLie === 'penalty'` → **dashed arc** (penalty stroke — no club swing)
- Otherwise → **white solid arc**

Carry distance label shown on all arcs except the penalty drop arc and putt arcs.

---

## Derived Values

```
score    = shots.length + putts.length

penalties = shots.filter(s => s.endLie === 'penalty' || s.endLie === 'ob').length

scoreToPar = score - hole.par

isComplete = putts.length > 0 && putts[last].holed === true
```

---

## Distances

**Carry** for stroke `n` = haversine distance between `positions[n-1]` and `positions[n]`.

**To pin** after stroke `n` = haversine distance between `positions[n]` and `hole.pin`.

---

## Penalty Hole Example (Hole 3, Par 3, Bogey)

```
positions = [
  hole.tee,          // stroke 1 starts here
  shots[0].latlng,   // stroke 1 ends here (ball in water)   endLie='penalty'
  shots[1].latlng,   // stroke 2 ends here (drop location)   startLie='penalty', endLie='fairway'
  shots[2].latlng,   // stroke 3 ends here (chip on green)   startLie='fairway', endLie='green'
  putts[0].latlng,   // stroke 4 ends here (holed)
  hole.pin           // final arc target
]
```

Arcs:
1. `hole.tee → shots[0]` — white arc, 7i, 167 yds (ends in penalty → red)
2. `shots[0] → shots[1]` — dashed arc, penalty stroke (no club)
3. `shots[1] → shots[2]` — white arc, 58°, 26 yds
4. `shots[2] → putts[0]` — white arc (putt)
5. `putts[0] → hole.pin` — final arc (holed)

Score = 3 shots + 1 putt = **4 (Bogey)** ✓
Penalties = 1 (shots[0].endLie = 'penalty') — informational only, already counted in score
