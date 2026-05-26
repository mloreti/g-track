export const ShotType = Object.freeze({
  TEE:      'tee',
  APPROACH: 'approach',
  OB:       'ob',       // ball went out of bounds — no carry, triggers drop
  DROP:     'drop',     // penalty drop location
});

export const Lie = Object.freeze({
  FAIRWAY: 'fairway',
  ROUGH:   'rough',
  BUNKER:  'bunker',
  OB:      'ob',
});

export class Shot {
  constructor(latlng, type = ShotType.APPROACH) {
    this.latlng = latlng;   // { lat, lng }
    this.type   = type;
    this.lie    = null;     // Lie enum value, null for tee/ob/drop
    this.club   = null;     // string, null for ob/drop
  }

  // Yards between two { lat, lng } positions using Haversine
  static distanceYds(a, b) {
    const R = 6371000; // metres
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const chord = sinLat * sinLat +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
    const metres = R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
    return metres * 1.09361;
  }

  // Feet between two { lat, lng } positions
  static distanceFt(a, b) {
    return Shot.distanceYds(a, b) * 3;
  }

  isStruck() {
    return this.type !== ShotType.OB && this.type !== ShotType.DROP;
  }

  // OB shots add a penalty stroke on top of the shot itself
  penaltyStrokes() {
    return this.type === ShotType.OB ? 1 : 0;
  }

  toJSON() {
    return { latlng: this.latlng, type: this.type, lie: this.lie, club: this.club };
  }

  static fromJSON(data) {
    const s = new Shot(data.latlng, data.type);
    s.lie  = data.lie;
    s.club = data.club;
    return s;
  }
}
