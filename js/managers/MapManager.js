// Owns the Leaflet map instance and tile layers.
// ShotEntry mode registers its own click handlers via onMapClick().

export class MapManager {
  constructor(containerId) {
    this.containerId = containerId;
    this.map         = null;
    this._clickHandlers = [];
  }

  init() {
    this.map = L.map(this.containerId, { zoomControl: true });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Esri World Imagery', maxZoom: 20 }
    ).addTo(this.map);

    this.map.on('click', e => {
      this._clickHandlers.forEach(fn => fn(e.latlng));
    });

    return this;
  }

  // Register a click handler — returns a deregister function
  onMapClick(fn) {
    this._clickHandlers.push(fn);
    return () => {
      this._clickHandlers = this._clickHandlers.filter(h => h !== fn);
    };
  }

  centerOn(latlng, zoom = 17) {
    this.map.setView(latlng, zoom);
  }

  // Rotate map so the hole plays bottom-to-top (tee at bottom, green at top)
  rotateTo(bearing) {
    if (this.map.setBearing) this.map.setBearing(bearing);
  }

  // Bearing in degrees from tee to green
  static bearing(tee, green) {
    const toRad = d => d * Math.PI / 180;
    const toDeg = r => r * 180 / Math.PI;
    const dLng  = toRad(green.lng - tee.lng);
    const lat1  = toRad(tee.lat);
    const lat2  = toRad(green.lat);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
}
