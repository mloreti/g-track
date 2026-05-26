import { Shot } from './Shot.js';

export class Putt {
  constructor(latlng, pinLatLng) {
    this.latlng    = latlng;      // { lat, lng } — where the putt started
    this.pinLatLng = pinLatLng;   // { lat, lng } — pin position
    this.holed     = false;
  }

  // Distance from putt start to pin in feet
  get distFt() {
    return Shot.distanceFt(this.latlng, this.pinLatLng);
  }

  toJSON() {
    return { latlng: this.latlng, pinLatLng: this.pinLatLng, holed: this.holed };
  }

  static fromJSON(data) {
    const p = new Putt(data.latlng, data.pinLatLng);
    p.holed = data.holed;
    return p;
  }
}
