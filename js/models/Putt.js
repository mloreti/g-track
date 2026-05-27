import { Shot } from './Shot.js';

export class Putt {
  constructor(latlng, pinLatLng) {
    this.latlng      = latlng;      // { lat, lng } — where the putt started
    this.pinLatLng   = pinLatLng;   // { lat, lng } — pin position
    this.holed       = false;
    this.autoPlaced  = false;       // true when silently placed at chip landing (no map marker)
  }

  // Distance from putt start to pin in feet
  get distFt() {
    return Shot.distanceFt(this.latlng, this.pinLatLng);
  }

  toJSON() {
    return { latlng: this.latlng, pinLatLng: this.pinLatLng, holed: this.holed, autoPlaced: this.autoPlaced };
  }

  static fromJSON(data) {
    const p = new Putt(data.latlng, data.pinLatLng);
    p.holed      = data.holed;
    p.autoPlaced = data.autoPlaced ?? false;
    return p;
  }
}
