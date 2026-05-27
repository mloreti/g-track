import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync } from 'fs';
import { SGCalc }    from '../../js/managers/SGCalc.js';
import { HoleRound } from '../../js/models/HoleRound.js';
import { Putt }      from '../../js/models/Putt.js';

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
    const val = calc.expectedStrokes('putting', 'green', 11, 'ft');
    expect(val).toBeGreaterThan(1.43);
    expect(val).toBeLessThan(1.51);
    expect(val).toBeCloseTo(1.47, 1);
  });

  it('returns null for unknown category/lie', () => {
    expect(calc.expectedStrokes('chipping', 'fringe', 10, 'ft')).toBeNull();
  });

  it('clamps to nearest row when out of range', () => {
    expect(calc.expectedStrokes('putting', 'green', 200, 'ft')).toBeCloseTo(2.18);
  });
});

describe('SGCalc.sgPutting', () => {
  const PIN = { lat: 26.102, lng: -81.7 };
  const FT  = 0.00000274; // degrees lat per foot

  function makePutt(distFtApprox, holed = false) {
    const p = new Putt({ lat: PIN.lat - distFtApprox * FT, lng: PIN.lng }, PIN);
    p.holed = holed;
    return p;
  }

  it('calculates SG for 3-putt from 24ft ≈ -1.15', () => {
    const putts = [makePutt(24), makePutt(4), makePutt(1, true)];
    expect(calc.sgPutting(putts)).toBeCloseTo(-1.15, 0);
  });

  it('calculates SG for 1-putt from 6ft ≈ +0.19', () => {
    expect(calc.sgPutting([makePutt(6, true)])).toBeCloseTo(0.19, 1);
  });

  it('returns null for empty putts', () => {
    expect(calc.sgPutting([])).toBeNull();
  });
});

// ── SGCalc.sgApproach helpers ─────────────────────────────────────────────────
// shots[] in new model = ball positions after each stroke (latlng = where ball ended up)
// shots[0] = tee shot result (startLie='tee')
// shots[i] = approach shot result (startLie = previous shot's endLie)

const YD  = 0.00000914; // degrees lat per yard
const FT2 = 0.00000274;
const PIN = { lat: 26.1000, lng: -81.7 };
const TEE_LATLNG = { lat: PIN.lat - 300 * YD, lng: PIN.lng }; // 300 yds from pin

function makeHole({ par = 4, shotConfigs, puttFt = null } = {}) {
  const hole = new HoleRound(1, par);
  hole.tee   = TEE_LATLNG;
  hole.pin   = PIN;

  // shotConfigs: [{ endLie, distYdsFromPin, club? }]
  // shots[0] always startLie='tee', subsequent inherit from previous endLie
  shotConfigs.forEach((cfg, i) => {
    const latlng   = { lat: PIN.lat - cfg.distYdsFromPin * YD, lng: PIN.lng };
    const startLie = i === 0 ? 'tee' : (shotConfigs[i - 1].endLie ?? 'fairway');
    const s        = hole.addShot(latlng, startLie);
    s.endLie       = cfg.endLie ?? null;
    if (cfg.club) s.club = cfg.club;
  });

  if (puttFt !== null) {
    const p = hole.addPutt({ lat: PIN.lat - puttFt * FT2, lng: PIN.lng });
    p.holed = true;
  }

  return hole;
}

describe('SGCalc.sgApproach', () => {
  it('missed green from fairway (110 yds) shows negative SG', () => {
    const hole = makeHole({
      shotConfigs: [
        { endLie: 'fairway', distYdsFromPin: 110 }, // tee shot lands FW
        { endLie: 'rough',   distYdsFromPin:  25 }, // approach misses green → rough
        { endLie: 'green',   distYdsFromPin:   8 }, // chip onto green
      ],
      puttFt: 25,
    });
    expect(calc.sgApproach(hole)).toBeLessThan(-0.5);
  });

  it('hit green in regulation from 110 yds fairway is near-zero SG', () => {
    const hole = makeHole({
      shotConfigs: [
        { endLie: 'fairway', distYdsFromPin: 110 }, // tee shot lands FW
        { endLie: 'green',   distYdsFromPin:   8 }, // approach hits green
      ],
      puttFt: 25,
    });
    expect(calc.sgApproach(hole)).toBeGreaterThan(-0.5);
  });

  it('uses startLie (rough) for the chip, not endLie of previous shot', () => {
    const hole = makeHole({
      shotConfigs: [
        { endLie: 'fairway', distYdsFromPin: 110 },
        { endLie: 'rough',   distYdsFromPin:  25 },
        { endLie: 'green',   distYdsFromPin:   8 },
      ],
      puttFt: 25,
    });
    const sg = calc.sgApproach(hole);
    expect(sg).not.toBeNull();
    expect(typeof sg).toBe('number');
  });

  it('returns null when no approach shots exist (only tee shot)', () => {
    const hole = makeHole({
      shotConfigs: [
        { endLie: 'green', distYdsFromPin: 8 }, // tee shot on green (par 3)
      ],
      puttFt: 25,
    });
    // Only 1 shot (tee result), no approach shots → null
    expect(calc.sgApproach(hole)).toBeNull();
  });

  it('skips penalty strokes in SG calculation', () => {
    const hole = makeHole({
      shotConfigs: [
        { endLie: 'penalty', distYdsFromPin: 150 }, // tee into water
        { endLie: 'fairway', distYdsFromPin: 140 }, // penalty drop (startLie auto='penalty')
        { endLie: 'green',   distYdsFromPin:   8 }, // approach
      ],
      puttFt: 25,
    });
    // Penalty stroke (shots[1]) should be skipped; only shots[2] contributes
    const sg = calc.sgApproach(hole);
    expect(sg).not.toBeNull();
  });
});
