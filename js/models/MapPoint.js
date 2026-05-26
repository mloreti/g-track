// Base class for any draggable point on the Leaflet map.
// Subclasses add domain meaning (ShotMarker, PuttMarker, PinMarker).
// Designed to be extended by planning mode as well.

export class MapPoint {
  constructor(latlng, options = {}) {
    this.latlng     = latlng;
    this.map        = null;
    this._marker    = null;
    this.draggable  = options.draggable ?? true;
    this.onMove     = options.onMove ?? null;   // (latlng) => void
    this.onClick    = options.onClick ?? null;  // (latlng) => void
  }

  // Add to map. Subclasses override createMarker() for custom icons.
  addTo(map) {
    this.map = map;
    this._marker = this.createMarker();
    this._marker.addTo(map);

    if (this.draggable) {
      this._marker.on('dragend', e => {
        this.latlng = e.target.getLatLng();
        this.onMove?.(this.latlng);
      });
    }

    if (this.onClick) {
      this._marker.on('click', () => this.onClick(this.latlng));
    }

    return this;
  }

  // Override in subclasses to return a custom L.marker / L.circleMarker
  createMarker() {
    return L.marker(this.latlng, { draggable: this.draggable });
  }

  moveTo(latlng) {
    this.latlng = latlng;
    this._marker?.setLatLng(latlng);
  }

  remove() {
    this._marker?.remove();
    this._marker = null;
    this.map = null;
  }

  getLatLng() {
    return this.latlng;
  }
}
