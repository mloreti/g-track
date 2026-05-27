import { describe, it, expect } from 'bun:test';
import { HoleRound } from '../../js/models/HoleRound.js';

const TEE = { lat: 26.1000, lng: -81.7000 };
const PIN = { lat: 26.1020, lng: -81.7000 };

const makeHole = () => {
  const h = new HoleRound(1, 4);
  h.tee = TEE;
  h.pin = PIN;
  return h;
};

describe('HoleRound.addShot', () => {
  it('adds a shot and auto-derives startLie from tee for first shot', () => {
    const h = makeHole();
    const s = h.addShot({ lat: 26.1010, lng: -81.7000 });
    expect(h.shots).toHaveLength(1);
    expect(s.startLie).toBe('tee');
  });

  it('auto-derives startLie from previous shot endLie', () => {
    const h = makeHole();
    const s1 = h.addShot({ lat: 26.1010, lng: -81.7000 });
    s1.endLie = 'fairway';
    const s2 = h.addShot({ lat: 26.1015, lng: -81.7000 });
    expect(s2.startLie).toBe('fairway');
  });

  it('explicit startLie overrides auto-derive', () => {
    const h = makeHole();
    const s = h.addShot({ lat: 26.1010, lng: -81.7000 }, 'penalty');
    expect(s.startLie).toBe('penalty');
  });

  it('removeLastShot pops correctly', () => {
    const h = makeHole();
    h.addShot({ lat: 26.1010, lng: -81.7000 });
    h.addShot({ lat: 26.1015, lng: -81.7000 });
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

describe('HoleRound score (computed)', () => {
  it('score = shots + putts', () => {
    const h = makeHole();
    h.addShot({ lat: 26.1010, lng: -81.7000 });
    h.addShot({ lat: 26.1018, lng: -81.7000 });
    const p1 = h.addPutt({ lat: 26.1019, lng: -81.7000 });
    const p2 = h.addPutt({ lat: 26.1020, lng: -81.7000 });
    p2.holed = true;
    expect(h.score).toBe(4);
  });

  it('penalty strokes already in shots array — no extra counting needed', () => {
    const h = makeHole();
    // Tee shot into water
    const s1 = h.addShot({ lat: 26.1005, lng: -81.7000 });
    s1.endLie = 'penalty';
    // Penalty drop (stroke 2)
    h.addShot({ lat: 26.1008, lng: -81.7000 }, 'penalty');
    // Chip (stroke 3)
    h.addShot({ lat: 26.1018, lng: -81.7000 });
    // 1 putt (stroke 4)
    const p = h.addPutt({ lat: 26.1019, lng: -81.7000 });
    p.holed = true;
    expect(h.score).toBe(4);
  });
});

describe('HoleRound.penalties (computed)', () => {
  it('counts shots that ended in penalty or OB', () => {
    const h = makeHole();
    const s = h.addShot({ lat: 26.1005, lng: -81.7000 });
    s.endLie = 'penalty';
    h.addShot({ lat: 26.1008, lng: -81.7000 }, 'penalty');
    expect(h.penalties).toBe(1);
  });

  it('zero penalties on clean hole', () => {
    const h = makeHole();
    const s = h.addShot({ lat: 26.1010, lng: -81.7000 });
    s.endLie = 'fairway';
    expect(h.penalties).toBe(0);
  });
});

describe('HoleRound.carryYds', () => {
  it('first shot carry is from hole.tee to shots[0]', () => {
    const h = makeHole();
    h.addShot({ lat: 26.1010, lng: -81.7000 });
    const carry = h.carryYds(0);
    expect(carry).toBeGreaterThan(0);
  });

  it('returns null when tee not set', () => {
    const h = new HoleRound(1, 4);
    h.pin = PIN;
    h.addShot({ lat: 26.1010, lng: -81.7000 });
    expect(h.carryYds(0)).toBeNull();
  });
});

describe('HoleRound.isComplete', () => {
  it('false when no putts', () => {
    expect(makeHole().isComplete()).toBe(false);
  });

  it('true when last putt is holed', () => {
    const h = makeHole();
    const p = h.addPutt({ lat: 26.102, lng: -81.7 });
    p.holed = true;
    expect(h.isComplete()).toBe(true);
  });
});

describe('HoleRound JSON round-trip', () => {
  it('restores all fields including tee', () => {
    const h = makeHole();
    const s = h.addShot({ lat: 26.1010, lng: -81.7 });
    s.endLie = 'fairway';
    s.club   = 'Dr';
    const p = h.addPutt({ lat: 26.1019, lng: -81.7 });
    p.holed = true;

    const restored = HoleRound.fromJSON(h.toJSON());
    expect(restored.holeNum).toBe(1);
    expect(restored.par).toBe(4);
    expect(restored.tee).toEqual(TEE);
    expect(restored.pin).toEqual(PIN);
    expect(restored.shots[0].club).toBe('Dr');
    expect(restored.shots[0].endLie).toBe('fairway');
    expect(restored.putts[0].holed).toBe(true);
    expect(restored.score).toBe(2);
  });
});
