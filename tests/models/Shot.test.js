import { describe, it, expect } from 'bun:test';
import { Shot, ShotType, Lie } from '../../js/models/Shot.js';

describe('Shot.distanceYds', () => {
  it('returns 0 for same point', () => {
    const p = { lat: 26.1, lng: -81.7 };
    expect(Shot.distanceYds(p, p)).toBeCloseTo(0, 5);
  });

  it('calculates reasonable yardage between two nearby points', () => {
    // ~100 yards apart on a golf hole
    const a = { lat: 26.1000, lng: -81.7000 };
    const b = { lat: 26.1008, lng: -81.7000 }; // ~97 yds north
    const yds = Shot.distanceYds(a, b);
    expect(yds).toBeGreaterThan(90);
    expect(yds).toBeLessThan(110);
  });

  it('distanceFt is 3x distanceYds', () => {
    const a = { lat: 26.1, lng: -81.7 };
    const b = { lat: 26.101, lng: -81.701 };
    expect(Shot.distanceFt(a, b)).toBeCloseTo(Shot.distanceYds(a, b) * 3, 5);
  });
});

describe('Shot', () => {
  it('creates with correct defaults', () => {
    const s = new Shot({ lat: 26.1, lng: -81.7 }, ShotType.TEE);
    expect(s.type).toBe('tee');
    expect(s.lie).toBeNull();
    expect(s.club).toBeNull();
  });

  it('isStruck returns false for OB and DROP', () => {
    expect(new Shot({}, ShotType.OB).isStruck()).toBe(false);
    expect(new Shot({}, ShotType.DROP).isStruck()).toBe(false);
    expect(new Shot({}, ShotType.TEE).isStruck()).toBe(true);
    expect(new Shot({}, ShotType.APPROACH).isStruck()).toBe(true);
  });

  it('OB shot adds 1 penalty stroke', () => {
    expect(new Shot({}, ShotType.OB).penaltyStrokes()).toBe(1);
    expect(new Shot({}, ShotType.TEE).penaltyStrokes()).toBe(0);
  });

  it('round-trips through JSON', () => {
    const s = new Shot({ lat: 26.1, lng: -81.7 }, ShotType.APPROACH);
    s.lie  = Lie.FAIRWAY;
    s.club = '7i';
    const restored = Shot.fromJSON(s.toJSON());
    expect(restored.latlng).toEqual({ lat: 26.1, lng: -81.7 });
    expect(restored.type).toBe(ShotType.APPROACH);
    expect(restored.lie).toBe(Lie.FAIRWAY);
    expect(restored.club).toBe('7i');
  });
});
