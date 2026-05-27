import { Shot } from '../models/Shot.js';

// Strokes Gained calculator against scratch golfer baseline (Broadie).
export class SGCalc {
  constructor(rows) {
    this._rows = rows;
  }

  static fromCSV(csvText) {
    const lines = csvText.trim().split('\n').slice(1);
    const rows = lines.map(line => {
      const [category, lie, distance, unit, expected_strokes] = line.split(',');
      return { category, lie, distance: Number(distance), unit, expected_strokes: Number(expected_strokes) };
    });
    return new SGCalc(rows);
  }

  expectedStrokes(category, lie, distance, unit) {
    const candidates = this._rows.filter(
      r => r.category === category && r.lie === lie && r.unit === unit
    );
    if (candidates.length === 0) return null;

    const exact = candidates.find(r => r.distance === distance);
    if (exact) return exact.expected_strokes;

    const lower = [...candidates].filter(r => r.distance <= distance).sort((a, b) => b.distance - a.distance)[0];
    const upper = [...candidates].filter(r => r.distance >= distance).sort((a, b) => a.distance - b.distance)[0];

    if (!lower) return upper.expected_strokes;
    if (!upper) return lower.expected_strokes;
    if (lower.distance === upper.distance) return lower.expected_strokes;

    const t = (distance - lower.distance) / (upper.distance - lower.distance);
    return lower.expected_strokes + t * (upper.expected_strokes - lower.expected_strokes);
  }

  // SG:Putting — expected(first_putt_dist_ft) - num_putts
  sgPutting(putts) {
    if (!putts || putts.length === 0) return null;
    const expected = this.expectedStrokes('putting', 'green', putts[0].distFt, 'ft');
    if (expected === null) return null;
    return expected - putts.length;
  }

  // SG:Off the Tee — based on hole length (tee to pin) and where tee shot landed
  sgOffTee(holeRound) {
    if (!holeRound.tee || !holeRound.pin) return null;
    if (holeRound.shots.length === 0) return null;

    const holeDist      = Shot.distanceYds(holeRound.tee, holeRound.pin);
    const expectedStart = this.expectedStrokes('tee', 'tee', holeDist, 'yds');
    if (expectedStart === null) return null;

    const teeShot = holeRound.shots[0];

    // Tee shot into penalty/OB: the ball is re-played from the drop.
    // Cost = tee stroke + penalty stroke = 2. Use the drop's endLie/dist.
    if (teeShot.isInPenalty()) {
      const dropShot = holeRound.shots.find(s => s.isPenaltyStroke());
      if (!dropShot) return null;
      const dropIdx  = holeRound.shots.indexOf(dropShot);
      const dropDist = holeRound.toPinYds(dropIdx);
      if (dropDist === null) return null;
      const dropLie = dropShot.endLie ?? 'fairway';
      const expectedAfterDrop = dropLie === 'green'
        ? this.expectedStrokes('putting', 'green', dropDist * 3, 'ft')
        : this.expectedStrokes('approach', dropLie, dropDist, 'yds');
      if (expectedAfterDrop === null) return null;
      return expectedStart - 2 - expectedAfterDrop;
    }

    // Normal case
    const endDist = holeRound.toPinYds(0);
    if (endDist === null) return null;
    const endLie = teeShot.endLie ?? 'fairway';
    const expectedNext = endLie === 'green'
      ? this.expectedStrokes('putting', 'green', endDist * 3, 'ft')
      : this.expectedStrokes('approach', endLie, endDist, 'yds');
    if (expectedNext === null) return null;
    return expectedStart - 1 - expectedNext;
  }

  // SG:Approach — for all shots after the tee shot result (shots[1+])
  // shots[i].startLie = lie ball was in, shots[i].endLie = where ball ended up
  sgApproach(holeRound) {
    if (holeRound.shots.length < 2) return null;

    let total = 0;
    let counted = 0;

    for (let i = 1; i < holeRound.shots.length; i++) {
      const shot = holeRound.shots[i];

      // Skip penalty strokes — no club swing, no SG contribution
      if (shot.isPenaltyStroke()) continue;

      // Starting position = shots[i-1] (where ball was before this stroke)
      const startDist = holeRound.toPinYds(i - 1);
      if (startDist === null) continue;

      const startLie = shot.startLie ?? holeRound.shots[i - 1]?.endLie ?? 'fairway';
      if (startLie === 'green') continue; // on the green = putting, not approach

      const expectedStart = this.expectedStrokes('approach', startLie, startDist, 'yds');
      if (expectedStart === null) continue;

      // Ending position = shots[i] (where ball ended up)
      const endLie  = shot.endLie ?? 'fairway';
      const endDist = holeRound.toPinYds(i);

      let expectedNext;
      if (endLie === 'green' || endLie === 'holed') {
        // Use putting baseline — prefer first putt distFt, fall back to yds approximation
        const firstPutt = holeRound.putts[0];
        expectedNext = firstPutt
          ? this.expectedStrokes('putting', 'green', firstPutt.distFt, 'ft')
          : (endDist !== null ? this.expectedStrokes('putting', 'green', endDist * 3, 'ft') : null);
      } else if (endDist !== null) {
        expectedNext = this.expectedStrokes('approach', endLie, endDist, 'yds');
      }

      if (expectedNext == null) continue;
      total += expectedStart - 1 - expectedNext;
      counted++;
    }

    return counted > 0 ? total : null;
  }
}
