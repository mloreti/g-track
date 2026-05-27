# Hole Flow Chart

## Setup

Before any shots can be recorded, two positions must be confirmed:

```
Load Hole
    │
    ▼
Place Tee ──► hole.tee set
    │
    ▼
Place Pin ──► hole.pin set
    │
    ▼
 [SHOT MODE]
```

---

## Shot Loop

Once setup is complete, every stroke follows the same decision tree:

```
[SHOT MODE]
    │
    ▼
Record ball position ──► shots.push({ latlng, startLie, endLie, club })
    │
    ▼
 Where did ball end up? (endLie)
    │
    ├── Fairway / Rough / Bunker ──────────────────────► [SHOT MODE] (next approach)
    │
    ├── Green ──────────────────────────────────────────► [PUTT MODE]
    │
    ├── Penalty / OB ──────────────────────────────────► [PENALTY MODE]
    │
    └── Holed (chip-in / ace) ──────────────────────────► [HOLE COMPLETE]
```

---

## Penalty Mode

A penalty results in one additional ball position (the drop), then returns to the shot loop:

```
[PENALTY MODE]
    │
    ▼
Record drop position ──► shots.push({ latlng, startLie: 'penalty', endLie, club: null })
    │
    ▼
 Where is the drop? (endLie)
    │
    ├── Fairway / Rough / Bunker ──────────────────────► [SHOT MODE]
    │
    └── Green ──────────────────────────────────────────► [PUTT MODE]
```

Note: a drop cannot end in penalty or OB — the player must drop in a legal area.

---

## Putt Mode

```
[PUTT MODE]
    │
    ▼
Record putt position ──► putts.push({ latlng, holed })
    │
    ▼
 Holed?
    │
    ├── No ─────────────────────────────────────────────► [PUTT MODE] (next putt)
    │
    └── Yes ────────────────────────────────────────────► [HOLE COMPLETE]
```

---

## Hole Complete

```
[HOLE COMPLETE]
    │
    ▼
score    = shots.length + putts.length
penalties = shots where endLie = 'penalty' or 'ob'  (informational)
scoreToPar = score - hole.par
```

---

## Full Scenario Examples

### Scenario A — Standard hole (par 4, bogey)
```
Tee ──► FW ──► Green ──► Putt (miss) ──► Putt (holed)
         1       2           3                 4
```

### Scenario B — Hole in one (ace)
```
Tee ──► Holed
          1
```

### Scenario C — Chip-in (par 4, birdie)
```
Tee ──► FW ──► Holed
         1        2
```

### Scenario D — Penalty on tee shot (par 3, bogey)
```
Tee ──► Water ──► Drop ──► Green ──► Putt (holed)
          1         2         3           4
```
Arc 1→2: red (penalty)
Arc 2→3: dashed (penalty stroke)

### Scenario E — Penalty on approach (par 4, double bogey)
```
Tee ──► FW ──► Water ──► Drop ──► Green ──► Putt (miss) ──► Putt (holed)
          1       2         3        4           5                 6
```

### Scenario F — Multiple penalties (par 5)
```
Tee ──► Water ──► Drop ──► FW ──► Water ──► Drop ──► Green ──► Putt (holed)
          1         2        3       4         5        6           7
```

### Scenario G — Up and down from bunker (par 4, par)
```
Tee ──► FW ──► Bunker ──► Green ──► Putt (miss) ──► Putt (holed)
          1        2           3          4                5
```

---

## Key Rules

- **Tee and pin must be set before any shot is recorded.**
- **Every stroke adds exactly one position to the chain** (`shots[]` or `putts[]`).
- **A penalty adds one position** (the drop) — the arc from previous position to drop is the penalty stroke.
- **Score is always `shots.length + putts.length`** — no separate counting needed.
- **Putting begins when any shot's `endLie === 'green'`** or the player manually enters putt mode.
- **Hole is complete when `putts[last].holed === true`** or a shot ends `holed` (ace/chip-in).
