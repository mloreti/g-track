import { MapPoint } from './MapPoint.js';

export class PuttMarker extends MapPoint {
  constructor(latlng, putt, index, options = {}) {
    super(latlng, options);
    this.putt  = putt;
    this.index = index; // 0-based
  }

  createMarker() {
    return L.marker(this.latlng, {
      draggable: this.draggable,
      icon:      this._buildIcon(),
    });
  }

  refresh() {
    this._marker?.setIcon(this._buildIcon());
  }

  _buildIcon() {
    const label = `P${this.index + 1}`;
    return L.divIcon({
      html:       `<div class="map-dot putt">${label}</div>`,
      className:  '',
      iconSize:   [28, 28],
      iconAnchor: [14, 14],
    });
  }
}
