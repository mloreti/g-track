// Strokes Gained calculator against scratch golfer baseline (Broadie).
// Load once via SGCalc.load(csvText), then use instance methods.

export class SGCalc {
  constructor(rows) {
    // rows: [{ category, lie, distance, unit, expected_strokes }]
    this._rows = rows;
  }

  // Parse CSV text and return an SGCalc instance
  static fromCSV(csvText) {
    const lines = csvText.trim().split('\n').slice(1); // skip header
    const rows = lines.map(line => {
      const [category, lie, distance, unit, expected_strokes] = line.split(',');
      return {
        category,
        lie,
        distance: Number(distance),
        unit,
        expected_strokes: Number(expected_strokes),
      };
    });
    return new SGCalc(rows);
  }

  // Expected strokes from given position. Interpolates between nearest rows.
  expectedStrokes(category, lie, distance, unit) {
    const candidates = this._rows.filter(
      r => r.category === category && r.lie === lie && r.unit === unit
    );
    if (candidates.length === 0) return null;

    // Exact match
    const exact = candidates.find(r => r.distance === distance);
    if (exact) return exact.expected_strokes;

    // Interpolate between nearest lower and upper
    const lower = [...candidates].filter(r => r.distance <= distance).sort((a, b) => b.distance - a.distance)[0];
    const upper = [...candidates].filter(r => r.distance >= distance).sort((a, b) => a.distance - b.distance)[0];

    if (!lower) return upper.expected_strokes;
    if (!upper) return lower.expected_strokes;
    if (lower.distance === upper.distance) return lower.expected_strokes;

    const t = (distance - lower.distance) / (upper.distance - lower.distance);
    return lower.expected_strokes + t * (upper.expected_strokes - lower.expected_strokes);
  }

  // SG:Putting for an array of Putt objects (last putt must have holed=true)
  // Formula: expected(first_putt_dist_ft) - num_putts
  sgPutting(putts) {
    if (!putts || putts.length === 0) return null;
    const firstDistFt = putts[0].distFt;
    const expected = this.expectedStrokes('putting', 'green', firstDistFt, 'ft');
    if (expected === null) return null;
    return expected - putts.length;
  }

  // SG:Off the Tee for the tee shot (Shot with type 'tee')
  // SG = expected(tee, distance) - 1 - expected(next_position)
  sgOffTee(holeRound) {
    const tee = holeRound.shots[0];
    if (!tee || tee.type !== 'tee') return null;
    if (!holeRound.pin) return null;

    // Tee-to-pin distance is the baseline distance for SG:OTT
    const holeDist = holeRound.toPinYds(0);
    if (holeDist === null) return null;
    const expectedStart = this.expectedStrokes('tee', 'tee', holeDist, 'yds');

    // Next shot expected strokes — starting lie for shots[1] is where the tee shot landed (tee.lie)
    if (!holeRound.shots[1]) return null;
    const nextDist = holeRound.toPinYds(1);
    if (nextDist === null) return null;
    const nextLie = tee.lie ?? 'fairway';
    const expectedNext = this.expectedStrokes('approach', nextLie, nextDist, 'yds');

    if (expectedStart === null || expectedNext === null) return null;
    return expectedStart - 1 - expectedNext;
  }

  // SG:Approach for all approach shots (between tee and green)
  sgApproach(holeRound) {
    const approachShots = holeRound.shots.slice(1).filter(s => s.type === 'approach' || s.type === 'drop');
    if (approachShots.length === 0) return null;

    let total = 0;
    let counted = 0;
    for (let i = 0; i < approachShots.length; i++) {
      const globalIdx = holeRound.shots.indexOf(approachShots[i]);
      const dist = holeRound.toPinYds(globalIdx);
      if (dist === null) continue;

      // Starting lie = where the previous shot landed (result of shots[globalIdx-1])
      const prevLie = holeRound.shots[globalIdx - 1]?.lie ?? 'fairway';
      if (prevLie === 'green') continue; // starting on green → this is a putt, not approach

      const expectedStart = this.expectedStrokes('approach', prevLie, dist, 'yds');
      if (expectedStart === null) continue;

      // Result lie = where this shot landed (shots[globalIdx].lie)
      const resultLie = approachShots[i].lie ?? 'fairway';

      let expectedNext;
      if (i < approachShots.length - 1) {
        // Next position is another approach shot
        const nextGlobalIdx = holeRound.shots.indexOf(approachShots[i + 1]);
        const nextDist = holeRound.toPinYds(nextGlobalIdx);
        if (nextDist === null) continue;
        if (resultLie === 'green') {
          // Ball is on the green — use putting baseline (yds × 3 ≈ ft)
          expectedNext = this.expectedStrokes('putting', 'green', nextDist * 3, 'ft');
        } else {
          expectedNext = this.expectedStrokes('approach', resultLie, nextDist, 'yds');
        }
      } else {
        // Last approach — next position is first putt on the green
        const firstPutt = holeRound.putts[0];
        if (!firstPutt) continue;
        expectedNext = this.expectedStrokes('putting', 'green', firstPutt.distFt, 'ft');
      }

      if (expectedNext === null) continue;
      total += expectedStart - 1 - expectedNext;
      counted++;
    }
    return counted > 0 ? total : null;
  }
}
