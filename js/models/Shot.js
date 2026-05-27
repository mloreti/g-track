export class Shot {
  constructor(latlng, startLie = null) {
    this.latlng   = latlng;     // { lat, lng } — where ball ended up after this stroke
    this.startLie = startLie;   // lie before this stroke
    this.endLie   = null;       // lie after this stroke (where ball ended up)
    this.club     = null;
  }

  isPenaltyStroke() {
    return this.startLie === 'penalty' || this.startLie === 'ob';
  }

  isInPenalty() {
    return this.endLie === 'penalty' || this.endLie === 'ob';
  }

  // Yards between two { lat, lng } positions using Haversine
  static distanceYds(a, b) {
    const R = 6371000;
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

  static distanceFt(a, b) {
    return Shot.distanceYds(a, b) * 3;
  }

  toJSON() {
    return {
      latlng:   this.latlng,
      startLie: this.startLie,
      endLie:   this.endLie,
      club:     this.club,
    };
  }

  static fromJSON(data) {
    // Support old format: { type, lie, startLie, club }
    let startLie = data.startLie ?? null;
    let endLie   = data.endLie ?? data.lie ?? null;

    // Migrate old type field to startLie
    if (!startLie && data.type) {
      if (data.type === 'tee')    startLie = 'tee';
      if (data.type === 'drop')   startLie = 'penalty';
    }

    const s     = new Shot(data.latlng, startLie);
    s.endLie    = endLie;
    s.club      = data.club ?? null;
    return s;
  }
}
