import { MapPoint } from './MapPoint.js';
import { ShotType } from './Shot.js';

const TYPE_CLASS = {
  [ShotType.TEE]:      'tee',
  [ShotType.APPROACH]: 'approach',
  [ShotType.OB]:       'ob',
  [ShotType.DROP]:     'drop',
};

export class ShotMarker extends MapPoint {
  constructor(latlng, shot, index, options = {}) {
    super(latlng, options);
    this.shot  = shot;
    this.index = index; // 0-based, displayed as index+1
  }

  createMarker() {
    return L.marker(this.latlng, {
      draggable: this.draggable,
      icon:      this._buildIcon(),
    });
  }

  // Call after shot.type or shot.lie changes to update the dot color
  refresh() {
    this._marker?.setIcon(this._buildIcon());
  }

  _buildIcon() {
    const cls   = TYPE_CLASS[this.shot.type] ?? 'approach';
    const label = this.index + 1;
    return L.divIcon({
      html:       `<div class="map-dot ${cls}">${label}</div>`,
      className:  '',
      iconSize:   [28, 28],
      iconAnchor: [14, 14],
    });
  }
}
