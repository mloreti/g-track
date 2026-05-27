import { describe, it, expect } from 'bun:test';
import { Shot } from '../../js/models/Shot.js';

describe('Shot.distanceYds', () => {
  it('returns 0 for same point', () => {
    const p = { lat: 26.1, lng: -81.7 };
    expect(Shot.distanceYds(p, p)).toBeCloseTo(0, 5);
  });

  it('calculates reasonable yardage between two nearby points', () => {
    const a = { lat: 26.1000, lng: -81.7000 };
    const b = { lat: 26.1008, lng: -81.7000 };
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
    const s = new Shot({ lat: 26.1, lng: -81.7 }, 'tee');
    expect(s.startLie).toBe('tee');
    expect(s.endLie).toBeNull();
    expect(s.club).toBeNull();
  });

  it('isPenaltyStroke returns true when startLie is penalty or ob', () => {
    expect(new Shot({}, 'penalty').isPenaltyStroke()).toBe(true);
    expect(new Shot({}, 'ob').isPenaltyStroke()).toBe(true);
    expect(new Shot({}, 'tee').isPenaltyStroke()).toBe(false);
    expect(new Shot({}, 'fairway').isPenaltyStroke()).toBe(false);
  });

  it('isInPenalty returns true when endLie is penalty or ob', () => {
    const s = new Shot({}, 'tee');
    s.endLie = 'penalty';
    expect(s.isInPenalty()).toBe(true);

    s.endLie = 'ob';
    expect(s.isInPenalty()).toBe(true);

    s.endLie = 'fairway';
    expect(s.isInPenalty()).toBe(false);
  });

  it('round-trips through JSON', () => {
    const s = new Shot({ lat: 26.1, lng: -81.7 }, 'fairway');
    s.endLie = 'green';
    s.club   = '7i';
    const restored = Shot.fromJSON(s.toJSON());
    expect(restored.latlng).toEqual({ lat: 26.1, lng: -81.7 });
    expect(restored.startLie).toBe('fairway');
    expect(restored.endLie).toBe('green');
    expect(restored.club).toBe('7i');
  });

  it('round-trips penalty stroke through JSON', () => {
    const s = new Shot({ lat: 26.1, lng: -81.7 }, 'penalty');
    s.endLie = 'fairway';
    const restored = Shot.fromJSON(s.toJSON());
    expect(restored.startLie).toBe('penalty');
    expect(restored.endLie).toBe('fairway');
    expect(restored.isPenaltyStroke()).toBe(true);
  });

  it('migrates old format (type+lie) to new format', () => {
    const old = { latlng: { lat: 26.1, lng: -81.7 }, type: 'drop', lie: 'fairway', startLie: 'rough', club: null };
    const s = Shot.fromJSON(old);
    expect(s.startLie).toBe('rough'); // explicit startLie wins
    expect(s.endLie).toBe('fairway');
  });

  it('migrates old tee type to startLie=tee', () => {
    const old = { latlng: { lat: 26.1, lng: -81.7 }, type: 'tee', lie: 'fairway', club: 'Dr' };
    const s = Shot.fromJSON(old);
    expect(s.startLie).toBe('tee');
    expect(s.endLie).toBe('fairway');
    expect(s.club).toBe('Dr');
  });
});
