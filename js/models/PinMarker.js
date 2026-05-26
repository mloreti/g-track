import { MapPoint } from './MapPoint.js';

export class PinMarker extends MapPoint {
  constructor(latlng, options = {}) {
    super(latlng, options);
  }

  createMarker() {
    return L.marker(this.latlng, {
      draggable: this.draggable,
      icon:      L.divIcon({
        html:       `<div class="map-pin">⛳</div>`,
        className:  '',
        iconSize:   [32, 32],
        iconAnchor: [16, 32], // anchor at bottom-center of flag
      }),
    });
  }
}
