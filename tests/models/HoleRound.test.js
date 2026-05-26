import { describe, it, expect } from 'bun:test';
import { HoleRound } from '../../js/models/HoleRound.js';
import { ShotType, Lie } from '../../js/models/Shot.js';

const PIN = { lat: 26.1020, lng: -81.7000 };

const makeHole = () => {
  const h = new HoleRound(1, 4);
  h.pin = PIN;
  return h;
};

describe('HoleRound.addShot', () => {
  it('adds a shot and returns it', () => {
    const h = makeHole();
    const s = h.addShot({ lat: 26.1000, lng: -81.7000 }, ShotType.TEE);
    expect(h.shots).toHaveLength(1);
    expect(s.type).toBe(ShotType.TEE);
  });

  it('removeLastShot pops correctly', () => {
    const h = makeHole();
    h.addShot({ lat: 26.1000, lng: -81.7000 }, ShotType.TEE);
    h.addShot({ lat: 26.1010, lng: -81.7000 }, ShotType.APPROACH);
    h.removeLastShot();
    expect(h.shots).toHaveLength(1);
  });

  it('returns null when removing from empty shots', () => {
    expect(makeHole().removeLastShot()).toBeNull();
  });
});

describe('HoleRound.addPutt', () => {
  it('throws if pin not set', () => {
    const h = new HoleRound(1, 4);
    expect(() => h.addPutt({ lat: 26.102, lng: -81.7 })).toThrow();
  });

  it('adds a putt with correct pin reference', () => {
    const h = makeHole();
    const p = h.addPutt({ lat: 26.1018, lng: -81.7000 });
    expect(h.putts).toHaveLength(1);
    expect(p.pinLatLng).toEqual(PIN);
  });
});

describe('HoleRound stroke counting', () => {
  it('totalStrokes = shots + putts + penalties', () => {
    const h = makeHole();
    h.addShot({ lat: 26.1000, lng: -81.7000 }, ShotType.TEE);
    h.addShot({ lat: 26.1010, lng: -81.7000 }, ShotType.APPROACH);
    h.addPutt({ lat: 26.1019, lng: -81.7000 });
    const p2 = h.addPutt({ lat: 26.1020, lng: -81.7000 });
    p2.holed = true;
    expect(h.totalStrokes()).toBe(4); // 2 shots + 2 putts
  });

  it('OB shot adds 1 penalty stroke', () => {
    const h = makeHole();
    h.addShot({ lat: 26.1000, lng: -81.7000 }, ShotType.TEE);
    h.addShot({ lat: 26.0990, lng: -81.7000 }, ShotType.OB);
    h.addShot({ lat: 26.1005, lng: -81.7000 }, ShotType.DROP);
    expect(h.totalPenalties()).toBe(1);
    expect(h.totalStrokes()).toBe(4); // 3 shots + 1 OB penalty
  });
});

describe('HoleRound.isComplete', () => {
  it('false when no putts', () => {
    expect(makeHole().isComplete()).toBe(false);
  });

  it('false when last putt not holed', () => {
    const h = makeHole();
    h.addPutt({ lat: 26.102, lng: -81.7 });
    expect(h.isComplete()).toBe(false);
  });

  it('true when last putt is holed', () => {
    const h = makeHole();
    const p = h.addPutt({ lat: 26.102, lng: -81.7 });
    p.holed = true;
    expect(h.isComplete()).toBe(true);
  });
});

describe('HoleRound JSON round-trip', () => {
  it('restores all fields', () => {
    const h = makeHole();
    const s = h.addShot({ lat: 26.1, lng: -81.7 }, ShotType.TEE);
    s.club = 'Dr';
    const p = h.addPutt({ lat: 26.1019, lng: -81.7 });
    p.holed = true;
    h.score = 3;

    const restored = HoleRound.fromJSON(h.toJSON());
    expect(restored.holeNum).toBe(1);
    expect(restored.par).toBe(4);
    expect(restored.shots[0].club).toBe('Dr');
    expect(restored.putts[0].holed).toBe(true);
    expect(restored.score).toBe(3);
  });
});
