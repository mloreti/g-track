/**
 * End-to-end scenario tests that simulate full holes of golf.
 *
 * Coordinate helpers
 * ------------------
 * 1 degree lat ≈ 121,000 yards at this latitude.
 * YDS_PER_DEG lets us place latlngs at known distances.
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync } from 'fs';
import { HoleRound }          from '../../js/models/HoleRound.js';
import { Shot, ShotType, Lie } from '../../js/models/Shot.js';
import { Putt }                from '../../js/models/Putt.js';
import { SGCalc }              from '../../js/managers/SGCalc.js';

// ── Coordinate helpers ───────────────────────────────────────────────────────

const TEE = { lat: 26.10000, lng: -81.70000 };
const YDS_PER_DEG = 121_000; // yards per degree of latitude (approx)

/** Return a latlng N yards north of TEE (along the hole). */
function ydsFromTee(yds) {
  return { lat: TEE.lat + yds / YDS_PER_DEG, lng: TEE.lng };
}

/** Return a latlng N feet north of a given point. */
function ftFrom(point, ft) {
  return { lat: point.lat + (ft / 3) / YDS_PER_DEG, lng: point.lng };
}

// ── SGCalc shared instance ───────────────────────────────────────────────────

let calc;
beforeAll(() => {
  const csv = readFileSync(new URL('../../sg_baseline.csv', import.meta.url).pathname, 'utf8');
  calc = SGCalc.fromCSV(csv);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeHole(holeNum = 1, par = 4) {
  return new HoleRound(holeNum, par);
}

function addShot(hole, latlng, type, lie = null, club = null) {
  const s = hole.addShot(latlng, type);
  s.lie  = lie;
  s.club = club;
  return s;
}

function addPutt(hole, latlng, holed = false) {
  const p = hole.addPutt(latlng);
  p.holed = holed;
  return p;
}

// ── Scenario 1: Clean par 4 ──────────────────────────────────────────────────
describe('Scenario: clean par 4 (tee → fairway → green → 2-putt)', () => {
  let hole;
  const PIN = ydsFromTee(400);

  beforeAll(() => {
    hole     = makeHole(1, 4);
    hole.pin = PIN;

    addShot(hole, TEE,             ShotType.TEE,      null,         'Dr');
    addShot(hole, ydsFromTee(250), ShotType.APPROACH, Lie.FAIRWAY,  '9i');
    addPutt(hole, ftFrom(PIN, 20), false);
    addPutt(hole, ftFrom(PIN, 3),  true);
  });

  it('totalStrokes = 4 (par)', () => expect(hole.totalStrokes()).toBe(4));
  it('no penalties',           () => expect(hole.totalPenalties()).toBe(0));
  it('isComplete',             () => expect(hole.isComplete()).toBe(true));
  it('SG:Putting < 0 (3ft gimme still 2-putts from 20ft)', () => {
    const sg = calc.sgPutting(hole.putts);
    // expected(20ft) ≈ 1.72, actual 2 putts → SG ≈ -0.28
    expect(sg).toBeLessThan(0);
    expect(sg).toBeCloseTo(-0.28, 0);
  });
});

// ── Scenario 2: OB off the tee — stroke and distance (re-tee) ───────────────
describe('Scenario: OB off the tee, re-tee, bogey 6 on par 4', () => {
  let hole;
  const PIN = ydsFromTee(400);

  beforeAll(() => {
    hole     = makeHole(1, 4);
    hole.pin = PIN;

    // Tee shot goes OB — marks where ball crossed boundary
    addShot(hole, { lat: TEE.lat + 0.0010, lng: TEE.lng + 0.0015 }, ShotType.OB);

    // Re-tee (stroke and distance) — now lying 3
    addShot(hole, TEE,             ShotType.TEE,      null,        'Dr');
    addShot(hole, ydsFromTee(230), ShotType.APPROACH, Lie.FAIRWAY, '9i');
    addPutt(hole, ftFrom(PIN, 15), false);
    addPutt(hole, ftFrom(PIN, 2),  true);
  });

  it('totalStrokes = 6 (double bogey)', () => expect(hole.totalStrokes()).toBe(6));
  it('OB adds 1 penalty stroke',        () => expect(hole.totalPenalties()).toBe(1));
  it('isComplete',                       () => expect(hole.isComplete()).toBe(true));
  it('shots array has 3 entries',        () => expect(hole.shots).toHaveLength(3));
  it('first shot typed OB',             () => expect(hole.shots[0].type).toBe(ShotType.OB));
});

// ── Scenario 3: Lateral hazard on approach — drop, bogey 6 on par 4 ─────────
describe('Scenario: approach goes lateral hazard, drop and play, 2-putt', () => {
  let hole;
  const PIN = ydsFromTee(400);

  beforeAll(() => {
    hole     = makeHole(1, 4);
    hole.pin = PIN;

    addShot(hole, TEE,             ShotType.TEE,      null,        'Dr');
    // Approach clips hazard — mark it OB (lateral), adds 1 penalty
    addShot(hole, ydsFromTee(310), ShotType.OB);
    // Drop location ~2 club-lengths from hazard margin, play from there
    addShot(hole, ydsFromTee(300), ShotType.DROP,     Lie.ROUGH,   'SW');
    addPutt(hole, ftFrom(PIN, 8),  false);
    addPutt(hole, ftFrom(PIN, 2),  true);
  });

  it('totalStrokes = 6 (double bogey)', () => expect(hole.totalStrokes()).toBe(6));
  it('1 OB penalty',                    () => expect(hole.totalPenalties()).toBe(1));
  it('drop shot is in shots array',     () => expect(hole.shots[2].type).toBe(ShotType.DROP));
  it('isComplete',                      () => expect(hole.isComplete()).toBe(true));
});

// ── Scenario 4: Ace (hole in one) on par 3 ───────────────────────────────────
describe('Scenario: ace on par 3', () => {
  let hole;
  const PIN = ydsFromTee(165);

  beforeAll(() => {
    hole     = makeHole(5, 3);
    hole.pin = PIN;

    addShot(hole, TEE, ShotType.TEE, null, '7i');
    hole.score = 1; // holed out — no putts placed
  });

  it('totalStrokes = 1',   () => expect(hole.totalStrokes()).toBe(1));
  it('0 putts',            () => expect(hole.putts).toHaveLength(0));
  it('0 penalties',        () => expect(hole.totalPenalties()).toBe(0));
  it('isComplete via score', () => expect(hole.isComplete()).toBe(true));
  it('sgPutting = null (no putts)', () => expect(calc.sgPutting(hole.putts)).toBeNull());
});

// ── Scenario 5: Chip-in (hole out from fairway) on par 4 ────────────────────
describe('Scenario: chip-in eagle on par 4', () => {
  let hole;
  const PIN = ydsFromTee(400);

  beforeAll(() => {
    hole     = makeHole(6, 4);
    hole.pin = PIN;

    addShot(hole, TEE,             ShotType.TEE,      null,        'Dr');
    addShot(hole, ydsFromTee(150), ShotType.APPROACH, Lie.FAIRWAY, 'SW');
    hole.score = 2; // chip-in — 0 putts
  });

  it('totalStrokes = 2 (eagle)',    () => expect(hole.totalStrokes()).toBe(2));
  it('0 putts',                     () => expect(hole.putts).toHaveLength(0));
  it('isComplete via score',        () => expect(hole.isComplete()).toBe(true));
  it('sgPutting = null (no putts)', () => expect(calc.sgPutting(hole.putts)).toBeNull());
});

// ── Scenario 6: Drive the green on par 4, 1-putt eagle ──────────────────────
describe('Scenario: drive the green, 1-putt eagle on par 4', () => {
  let hole;
  const PIN = ydsFromTee(380);

  beforeAll(() => {
    hole     = makeHole(7, 4);
    hole.pin = PIN;

    // Tee shot lands on the green
    addShot(hole, ydsFromTee(380), ShotType.TEE, null, 'Dr');
    addPutt(hole, ftFrom(PIN, 30), false);
    addPutt(hole, ftFrom(PIN, 3),  true);
  });

  it('totalStrokes = 3 (eagle)',  () => expect(hole.totalStrokes()).toBe(3));
  it('1 shot + 2 putts',         () => {
    expect(hole.shots).toHaveLength(1);
    expect(hole.putts).toHaveLength(2);
  });
  it('SG:Putting from 30ft, 2-putt', () => {
    const sg = calc.sgPutting(hole.putts);
    // expected(30ft) ≈ 1.85, actual 2 → SG ≈ -0.15
    expect(sg).toBeCloseTo(-0.15, 0);
  });
  it('isComplete', () => expect(hole.isComplete()).toBe(true));
});

// ── Scenario 7: 3-putt bogey on par 3 ────────────────────────────────────────
describe('Scenario: 3-putt bogey on par 3', () => {
  let hole;
  const PIN = ydsFromTee(165);

  beforeAll(() => {
    hole     = makeHole(8, 3);
    hole.pin = PIN;

    addShot(hole, TEE, ShotType.TEE, null, '7i');
    addPutt(hole, ftFrom(PIN, 24), false);
    addPutt(hole, ftFrom(PIN, 4),  false);
    addPutt(hole, ftFrom(PIN, 1),  true);
  });

  it('totalStrokes = 4 (bogey)',   () => expect(hole.totalStrokes()).toBe(4));
  it('3 putts recorded',           () => expect(hole.putts).toHaveLength(3));
  it('SG:Putting from 24ft, 3-putt', () => {
    const sg = calc.sgPutting(hole.putts);
    // expected(24ft) ≈ 1.85, actual 3 → SG ≈ -1.15
    expect(sg).toBeCloseTo(-1.15, 0);
  });
});

// ── Scenario 8: Double OB (two penalties same hole) ──────────────────────────
describe('Scenario: two OB shots on par 5, makes 9', () => {
  let hole;
  const PIN = ydsFromTee(500);

  beforeAll(() => {
    hole     = makeHole(3, 5);
    hole.pin = PIN;

    addShot(hole, { lat: TEE.lat + 0.001, lng: TEE.lng + 0.002 }, ShotType.OB); // drive OB
    addShot(hole, TEE,             ShotType.TEE,      null,        'Dr');        // re-tee, lying 3
    addShot(hole, ydsFromTee(220), ShotType.OB);                                 // 2nd shot OB
    addShot(hole, ydsFromTee(220), ShotType.DROP,     Lie.ROUGH,   '7i');        // drop, lying 6
    addShot(hole, ydsFromTee(310), ShotType.APPROACH, Lie.FAIRWAY, '9i');        // lying 7
    addPutt(hole, ftFrom(PIN, 10), false);  // lying 8
    addPutt(hole, ftFrom(PIN, 2),  true);   // makes 9
  });

  it('totalStrokes = 9',        () => expect(hole.totalStrokes()).toBe(9));
  it('2 OB penalties',          () => expect(hole.totalPenalties()).toBe(2));
  it('isComplete',              () => expect(hole.isComplete()).toBe(true));
});

// ── Scenario 9: 1-putt birdie on par 4 ───────────────────────────────────────
describe('Scenario: tee, fairway approach, 1-putt birdie', () => {
  let hole;
  const PIN = ydsFromTee(400);

  beforeAll(() => {
    hole     = makeHole(9, 4);
    hole.pin = PIN;

    addShot(hole, TEE,             ShotType.TEE,      null,        'Dr');
    addShot(hole, ydsFromTee(260), ShotType.APPROACH, Lie.FAIRWAY, '9i');
    addPutt(hole, ftFrom(PIN, 6),  true);
  });

  it('totalStrokes = 3 (birdie)', () => expect(hole.totalStrokes()).toBe(3));
  it('SG:Putting from 6ft, 1-putt', () => {
    const sg = calc.sgPutting(hole.putts);
    // expected(6ft) ≈ 1.19, actual 1 → SG ≈ +0.19
    expect(sg).toBeCloseTo(0.19, 1);
  });
  it('isComplete', () => expect(hole.isComplete()).toBe(true));
});

// ── Scenario 10: Stroke counting round-trip through JSON ─────────────────────
describe('Scenario: full hole serialises and restores correctly', () => {
  it('JSON round-trip preserves all scenario data', () => {
    const PIN  = ydsFromTee(400);
    const hole = makeHole(1, 4);
    hole.pin   = PIN;

    addShot(hole, TEE,             ShotType.TEE,      null,        'Dr');
    addShot(hole, ydsFromTee(250), ShotType.APPROACH, Lie.FAIRWAY, '8i');
    addPutt(hole, ftFrom(PIN, 15), false);
    addPutt(hole, ftFrom(PIN, 2),  true);

    const restored = HoleRound.fromJSON(hole.toJSON());

    expect(restored.totalStrokes()).toBe(4);
    expect(restored.totalPenalties()).toBe(0);
    expect(restored.isComplete()).toBe(true);
    expect(restored.shots[0].club).toBe('Dr');
    expect(restored.shots[1].lie).toBe(Lie.FAIRWAY);
    expect(restored.putts[1].holed).toBe(true);
    expect(restored.putts[0].distFt).toBeGreaterThan(10);
  });
});
