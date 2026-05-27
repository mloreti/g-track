# Golf Hole — All Possible Scenarios

## The Stroke Loop

Every stroke in golf ends in one of five outcomes. The hole continues until the ball is holed.

```
                        ┌─────────────────────┐
                        │     Play Stroke      │
                        └──────────┬──────────┘
                                   │
              ┌────────────────────┼──────────────────────────┐
              │                    │                           │
              ▼                    ▼                           ▼
       Ball in Play           Ball Holed              Ball Not in Play
     (Fairway / Rough /      └──► DONE              (see below)
      Bunker / Green)
              │
              ▼
       Play next stroke
       from that lie
```

---

## Ball Not in Play — Decision Tree

```
Ball Not in Play
        │
        ├── Out of Bounds (OB) ──────────────────────────────► Stroke & Distance
        │                                                        Re-play from previous spot
        │                                                        +1 penalty stroke
        │
        ├── Lost Ball ───────────────────────────────────────► Stroke & Distance
        │                                                        Re-play from previous spot
        │                                                        +1 penalty stroke
        │
        ├── Penalty Area ────────────────────────────────────► Player chooses one of:
        │   (Water / Hazard)                                     │
        │                                                        ├── Stroke & Distance
        │                                                        │   Re-play from previous spot
        │                                                        │   +1 penalty stroke
        │                                                        │
        │                                                        ├── Back-on-the-Line Drop
        │                                                        │   Drop anywhere on line from pin
        │                                                        │   through where ball crossed margin
        │                                                        │   +1 penalty stroke
        │                                                        │
        │                                                        └── Lateral Drop (Red stakes only)
        │                                                            Drop within 2 club lengths
        │                                                            of where ball crossed margin
        │                                                            +1 penalty stroke
        │
        └── Unplayable Lie ─────────────────────────────────► Player chooses one of:
            (Player declares)                                    │
                                                                 ├── Stroke & Distance
                                                                 │   Re-play from previous spot
                                                                 │   +1 penalty stroke
                                                                 │
                                                                 ├── Back-on-the-Line Drop
                                                                 │   Drop on line behind ball
                                                                 │   +1 penalty stroke
                                                                 │
                                                                 └── Lateral Drop
                                                                     Drop within 2 club lengths
                                                                     of ball position
                                                                     +1 penalty stroke
```

---

## Putting

Once the ball is on the green, the player putts until holed.

```
Ball on Green
      │
      ▼
   Putt ──► Holed? ──► Yes ──► DONE
              │
              No
              │
              ▼
           Putt again
```

---

## Special Situations

```
Provisional Ball
      │
      If original ball is found in bounds ──► Play original, abandon provisional
      │
      If original is lost or OB ──────────► Provisional becomes ball in play
                                             (stroke + distance already applied)


Free Relief (no penalty stroke)
      │
      ├── Abnormal Course Conditions (cart path, ground under repair, casual water)
      ├── Embedded ball in general area
      └── Drop within 1 club length of nearest point of complete relief


Wrong Ball / Wrong Place
      └── General penalty: 2 strokes (stroke play) or loss of hole (match play)
```

---

## Full Lie Taxonomy

| Where Ball Ends Up | In Play? | Options |
|---|---|---|
| Fairway | ✓ | Play as lies |
| Rough | ✓ | Play as lies |
| Bunker | ✓ | Play as lies (or unplayable +1) |
| Green | ✓ | Putt |
| Penalty area (yellow) | ✗ | Stroke & distance or back-on-line |
| Penalty area (red) | ✗ | Stroke & distance, back-on-line, or lateral |
| Out of bounds | ✗ | Stroke & distance only |
| Lost | ✗ | Stroke & distance only |
| Unplayable | Player decides | Any of 3 unplayable options |
| Holed | ✓ | Done |

---

## Stroke Counting

```
Total strokes = strokes played + penalty strokes

Each "not in play" outcome adds +1 penalty stroke on top of the re-play stroke.

Example — ball in water on tee shot:
  Stroke 1: tee shot (into water)
  + 1 penalty stroke
  Stroke 3: play from drop
```
