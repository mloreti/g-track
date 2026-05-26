import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync } from 'fs';
import { SGCalc } from '../../js/managers/SGCalc.js';
import { HoleRound } from '../../js/models/HoleRound.js';
import { ShotType, Lie } from '../../js/models/Shot.js';
import { Putt } from '../../js/models/Putt.js';

const CSV_PATH = new URL('../../sg_baseline.csv', import.meta.url).pathname;

let calc;
beforeAll(() => {
  const csv = readFileSync(CSV_PATH, 'utf8');
  calc = SGCalc.fromCSV(csv);
});

describe('SGCalc.expectedStrokes', () => {
  it('returns exact match from baseline', () => {
    expect(calc.expectedStrokes('putting', 'green', 10, 'ft')).toBeCloseTo(1.43);
  });

  it('interpolates between two rows', () => {
    // Between 10ft (1.43) and 12ft (1.51)
    const val = calc.expectedStrokes('putting', 'green', 11, 'ft');
    expect(val).toBeGreaterThan(1.43);
    expect(val).toBeLessThan(1.51);
    expect(val).toBeCloseTo(1.47, 1);
  });

  it('returns null for unknown category/lie', () => {
    expect(calc.expectedStrokes('chipping', 'fringe', 10, 'ft')).toBeNull();
  });

  it('clamps to nearest row when out of range', () => {
    // 200ft > max putting distance (100ft) — should return 100ft value
    expect(calc.expectedStrokes('putting', 'green', 200, 'ft')).toBeCloseTo(2.18);
  });
});

describe('SGCalc.sgPutting', () => {
  it('calculates SG for 3-putt from 24ft', () => {
    // Example from flowchart: 24ft → 4ft → 1ft → holed
    const PIN = { lat: 26.102, lng: -81.7 };
    const makePutt = (distFtApprox, holed = false) => {
      // Place putt start lat/lng so distFt ≈ distFtApprox
      // 1 ft ≈ 0.00000274 degrees latitude
      const latOffset = distFtApprox * 0.00000274;
      const p = new Putt({ lat: PIN.lat - latOffset, lng: PIN.lng }, PIN);
      p.holed = holed;
      return p;
    };

    const putts = [
      makePutt(24),
      makePutt(4),
      makePutt(1, true),
    ];

    const sg = calc.sgPutting(putts);
    // expected(24ft) ≈ 1.85, actual = 3, SG ≈ -1.15
    expect(sg).toBeCloseTo(-1.15, 0);
  });

  it('calculates SG for 1-putt from 6ft', () => {
    const PIN = { lat: 26.102, lng: -81.7 };
    const latOffset = 6 * 0.00000274;
    const p = new Putt({ lat: PIN.lat - latOffset, lng: PIN.lng }, PIN);
    p.holed = true;
    const sg = calc.sgPutting([p]);
    // expected(6ft) ≈ 1.19, actual = 1, SG ≈ +0.19
    expect(sg).toBeCloseTo(0.19, 1);
  });

  it('returns null for empty putts', () => {
    expect(calc.sgPutting([])).toBeNull();
  });
});

// Helpers to build a HoleRound with specific shot/putt positions
// yd offset: 1 yd ≈ 0.00000914 degrees lat
const YD = 0.00000914;
const FT = 0.00000274;
const PIN = { lat: 26.1000, lng: -81.7 };

function makeHole({ par = 4, pinDistYds, shots, puttFt = null } = {}) {
  const hole = new HoleRound(1, par);
  hole.pin = PIN;

  // shots: [{ type, lie, distYdsFromPin }]
  shots.forEach(s => {
    const latlng = { lat: PIN.lat - s.distYdsFromPin * YD, lng: PIN.lng };
    hole.addShot(latlng, s.type);
    hole.shots[hole.shots.length - 1].lie = s.lie ?? null;
  });

  if (puttFt !== null) {
    const pLatlng = { lat: PIN.lat - puttFt * FT, lng: PIN.lng };
    const putt = hole.addPutt(pLatlng);
    putt.holed = true;
  }

  return hole;
}

describe('SGCalc.sgApproach', () => {
  it('missed green from fairway (110 yds) shows negative SG', () => {
    // Tee shot landed FW 110 yds out (lie=fairway), approach missed green into rough
    // Chip from rough 25 yds, landed on green → first putt 25 ft
    const hole = makeHole({
      shots: [
        { type: ShotType.TEE,      lie: Lie.FAIRWAY, distYdsFromPin: 110 },
        { type: ShotType.APPROACH, lie: 'rough',     distYdsFromPin:  25 },
        { type: ShotType.APPROACH, lie: 'green',     distYdsFromPin:   8 },
      ],
      puttFt: 25,
    });

    const sg = calc.sgApproach(hole);
    // Missed green from FW 110 yds is a bad shot → negative SG
    expect(sg).toBeLessThan(-0.5);
  });

  it('hit green in regulation from 110 yds fairway shows near-zero or positive SG', () => {
    // Tee shot landed FW 110 yds out (lie=fairway), hit green (lie=green)
    const hole = makeHole({
      shots: [
        { type: ShotType.TEE,      lie: Lie.FAIRWAY, distYdsFromPin: 110 },
        { type: ShotType.APPROACH, lie: 'green',     distYdsFromPin:   8 },
      ],
      puttFt: 25,
    });

    const sg = calc.sgApproach(hole);
    // GIR from 110 FW is average, SG should be near zero (not wildly negative)
    expect(sg).toBeGreaterThan(-0.5);
  });

  it('uses result lie (rough) for the chip starting position, not result lie of chip', () => {
    // Chip from rough 25 yds → green; first putt 25 ft
    const hole = makeHole({
      shots: [
        { type: ShotType.TEE,      lie: Lie.FAIRWAY, distYdsFromPin: 110 },
        { type: ShotType.APPROACH, lie: 'rough',     distYdsFromPin:  25 },
        { type: ShotType.APPROACH, lie: 'green',     distYdsFromPin:   8 },
      ],
      puttFt: 25,
    });

    const sg = calc.sgApproach(hole);
    // Should be a real number, not null (the green lie bug returned null before)
    expect(sg).not.toBeNull();
    expect(typeof sg).toBe('number');
  });

  it('returns null when no approach shots exist', () => {
    const hole = new HoleRound(1, 3);
    hole.pin = PIN;
    const teeLatLng = { lat: PIN.lat - 150 * YD, lng: PIN.lng };
    hole.addShot(teeLatLng, ShotType.TEE);
    hole.shots[0].lie = 'green';
    expect(calc.sgApproach(hole)).toBeNull();
  });
});
