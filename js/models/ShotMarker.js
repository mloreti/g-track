import { MapPoint } from './MapPoint.js';

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

  refresh() {
    this._marker?.setIcon(this._buildIcon());
  }

  _buildIcon() {
    let cls;
    if (this.shot.isInPenalty?.()) {
      cls = 'ob';       // red — ball ended in penalty/OB
    } else if (this.shot.isPenaltyStroke?.()) {
      cls = 'drop';     // orange — this is the penalty drop location
    } else {
      cls = 'approach'; // blue — normal ball position
    }
    const label = this.index + 1;
    return L.divIcon({
      html:      `<div class="map-dot ${cls}">${label}</div>`,
      className: '',
      iconSize:  [28, 28],
      iconAnchor:[14, 14],
    });
  }
}
