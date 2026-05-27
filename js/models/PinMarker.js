import { MapPoint } from './MapPoint.js';

export class PinMarker extends MapPoint {
  constructor(latlng, options = {}) {
    super(latlng, options);
    this._icon = options.icon ?? 'pin'; // 'pin' | 'tee'
  }

  createMarker() {
    const html = this._icon === 'tee'
      ? `<div class="map-pin map-tee">🏌️</div>`
      : `<div class="map-pin">⛳</div>`;
    return L.marker(this.latlng, {
      draggable: this.draggable,
      icon: L.divIcon({
        html,
        className:  '',
        iconSize:   [32, 32],
        iconAnchor: [16, 16],
      }),
    });
  }
}
