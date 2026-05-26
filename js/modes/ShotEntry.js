import { HoleRound }          from '../models/HoleRound.js';
import { ShotMarker }          from '../models/ShotMarker.js';
import { PuttMarker }          from '../models/PuttMarker.js';
import { PinMarker }           from '../models/PinMarker.js';
import { ShotType, Lie }       from '../models/Shot.js';
import { Shot }                from '../models/Shot.js';
import { MapManager }          from '../managers/MapManager.js';

const CLUBS = ['Dr', '3w', '7w', '4i', '5i', '6i', '7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW'];

const LIE_NAMES = {
  fairway: 'Fairway', rough: 'Rough', bunker: 'Bunker', green: 'Green', ob: 'OB',
};

export class ShotEntry {
  constructor({ mapManager, round, holeConfig, sgCalc, onRoundChange, onHoleConfigChange }) {
    this.mapMgr             = mapManager;
    this.round              = round;
    this.holeConfig         = holeConfig;
    this.sgCalc             = sgCalc;
    this.onRoundChange      = onRoundChange;
    this.onHoleConfigChange = onHoleConfigChange;

    this.currentHoleIdx = 0;
    this.phase          = 'approach';
    this._markers       = [];
    this._pinMarker     = null;
    this._activeMode    = null;
    this._deregClick    = null;
    this._arcLayers       = [];
    this._arcLabels       = [];
    this._pinIsFirstSetup = false;

    this._bindUI();
  }

  get hole() {
    return this.round.holes[this.currentHoleIdx]
      ?? (() => {
        const cfg = this.holeConfig[this.currentHoleIdx];
        const h   = new HoleRound(this.currentHoleIdx + 1, cfg.par);
        this.round.holes[this.currentHoleIdx] = h;
        return h;
      })();
  }

  get cfg() { return this.holeConfig[this.currentHoleIdx]; }

  // ── Public ──────────────────────────────────────────────────────────────────

  loadHole(idx) {
    this._exitMode();
    this.currentHoleIdx = idx;
    this.phase = this.hole.putts.length > 0 ? 'putting' : 'approach';
    this._clearMarkers();
    this._restoreMarkers();
    this._centerMap();
    this._updateHoleLabel();
    this.renderShotList();

    if (this.hole.shots.length === 0) {
      this._autoPlaceTee();
    } else {
      this._setGuidance(null);
    }
  }

  _autoPlaceTee() {
    const teeLatLng = this.cfg.tee;
    if (teeLatLng) this._placeTeeAt(teeLatLng);

    // Pin must be placed each session — it changes daily
    if (!this.hole.pin) {
      this._pinIsFirstSetup = true;
      this._enterMode('pin');
      this._setGuidance('Tap to set the pin location');
    } else {
      this._enterMode('shot');
      this._setGuidance('Tap where your tee shot landed');
    }
  }

  _placeTeeAt(latlng) {
    const shot   = this.hole.addShot(latlng, ShotType.TEE);
    const marker = new ShotMarker(latlng, shot, 0, {
      draggable: true,
      onMove: newLatLng => {
        shot.latlng = newLatLng;
        this.renderShotList();
        this.onRoundChange();
      },
    });
    marker.addTo(this.mapMgr.map);
    this._markers.push({ kind: 'shot', point: marker, data: shot });
    this.renderShotList();
    this.onRoundChange();
  }

  _setGuidance(text) {
    const el = document.getElementById('guidance-label');
    if (text) {
      el.textContent = text;
      el.classList.add('visible');
    } else {
      el.classList.remove('visible');
    }
  }

  // ── UI binding ───────────────────────────────────────────────────────────────

  _bindUI() {
    document.getElementById('btn-add-shot').addEventListener('click', () => this._toggleMode('shot'));
    document.getElementById('btn-on-green').addEventListener('click', () => this._enterGreen());
    document.getElementById('btn-add-putt').addEventListener('click', () => this._toggleMode('putt'));
    document.getElementById('btn-place-pin').addEventListener('click', () => this._toggleMode('pin'));
    document.getElementById('btn-undo').addEventListener('click', () => this._undo());
    document.getElementById('btn-prev').addEventListener('click', () => this._navHole(-1));
    document.getElementById('btn-next').addEventListener('click', () => this._navHole(+1));
    document.getElementById('save-hole-btn').addEventListener('click', () => this._saveHole());

    document.getElementById('btn-pbp').addEventListener('click', () => {
      document.getElementById('pbp-panel').classList.toggle('open');
    });
    document.getElementById('btn-close-pbp').addEventListener('click', () => {
      document.getElementById('pbp-panel').classList.remove('open');
    });

    document.getElementById('input-score').addEventListener('change', e => {
      this.hole.score = Number(e.target.value) || null;
      this.onRoundChange();
    });
    document.getElementById('input-penalties').addEventListener('change', e => {
      this.hole.penalties = Number(e.target.value) || 0;
      this.onRoundChange();
    });
  }

  // ── Mode management ──────────────────────────────────────────────────────────

  _toggleMode(mode) {
    if (this._activeMode === mode) {
      this._exitMode();
    } else {
      this._enterMode(mode);
    }
  }

  _enterMode(mode) {
    this._exitMode();
    this._activeMode = mode;
    this._highlightBtn(mode, true);

    const hints = {
      shot: 'Tap map — where did the ball land?',
      putt: 'Tap map — where did the putt start?',
      pin:  'Tap map — place the pin',
    };
    this._setGuidance(hints[mode] ?? null);

    this._deregClick = this.mapMgr.onMapClick(latlng => {
      if (mode === 'shot') this._placeShot(latlng);
      if (mode === 'putt') this._placePutt(latlng);
      if (mode === 'pin')  this._placePin(latlng);
    });
  }

  _exitMode() {
    if (this._deregClick) { this._deregClick(); this._deregClick = null; }
    if (this._activeMode) this._highlightBtn(this._activeMode, false);
    this._activeMode = null;
  }

  _highlightBtn(mode, on) {
    const map = { shot: 'btn-add-shot', putt: 'btn-add-putt', pin: 'btn-place-pin' };
    document.getElementById(map[mode])?.classList.toggle('active', on);
  }

  _enterGreen() {
    this.phase = 'putting';
    this._exitMode();
    document.getElementById('btn-on-green').classList.add('green');
    this._setGuidance('Tap + Putt for each putt');
    this.renderShotList();
    this.onRoundChange();
  }

  // ── Shot / putt / pin placement ──────────────────────────────────────────────

  _placeShot(latlng) {
    const shot = this.hole.addShot(latlng, ShotType.APPROACH);
    const idx  = this.hole.shots.length - 1;

    const marker = new ShotMarker(latlng, shot, idx, {
      draggable: true,
      onMove: newLatLng => {
        shot.latlng = newLatLng;
        this.renderShotList();
        this.onRoundChange();
      },
    });
    marker.addTo(this.mapMgr.map);
    this._markers.push({ kind: 'shot', point: marker, data: shot });

    this._exitMode();
    this._setGuidance(null);
    this.renderShotList();
    this.onRoundChange();
  }

  _placePutt(latlng) {
    if (!this.hole.pin) {
      alert('Place the pin first (📌 Pin button)');
      return;
    }
    const putt   = this.hole.addPutt(latlng);
    const idx    = this.hole.putts.length - 1;
    const marker = new PuttMarker(latlng, putt, idx, {
      draggable: true,
      onMove: newLatLng => {
        putt.latlng = newLatLng;
        this.renderShotList();
        this.onRoundChange();
      },
    });
    marker.addTo(this.mapMgr.map);
    this._markers.push({ kind: 'putt', point: marker, data: putt });

    this._exitMode();
    this.renderShotList();
    this.onRoundChange();
  }

  _placePin(latlng) {
    this._pinMarker?.remove();
    this.hole.pin = latlng;
    this.hole.putts.forEach(p => { p.pinLatLng = latlng; });

    this._pinMarker = new PinMarker(latlng, {
      draggable: true,
      onMove: newLatLng => {
        this.hole.pin = newLatLng;
        this.hole.putts.forEach(p => { p.pinLatLng = newLatLng; });
        this.renderShotList();
        this.onRoundChange();
      },
    });
    this._pinMarker.addTo(this.mapMgr.map);

    this._exitMode();
    this.renderShotList();
    this.onRoundChange();

    // After initial pin setup, automatically enter shot mode for tee landing
    if (this._pinIsFirstSetup) {
      this._pinIsFirstSetup = false;
      this._enterMode('shot');
      this._setGuidance('Tap where your tee shot landed');
    }
  }

  // ── Undo ────────────────────────────────────────────────────────────────────

  _undo() {
    if (this.phase === 'putting' && this.hole.putts.length > 0) {
      this.hole.removeLastPutt();
      const last = this._markers.filter(m => m.kind === 'putt').pop();
      if (last) { last.point.remove(); this._markers = this._markers.filter(m => m !== last); }
    } else if (this.hole.shots.length > 0) {
      this.hole.removeLastShot();
      const last = this._markers.filter(m => m.kind === 'shot').pop();
      if (last) { last.point.remove(); this._markers = this._markers.filter(m => m !== last); }
    }
    this.renderShotList();
    this.onRoundChange();
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  _saveHole() {
    const score = Number(document.getElementById('input-score').value);
    if (score) this.hole.score = score;
    this.onRoundChange();
    this._navHole(+1);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  _navHole(delta) {
    const next = this.currentHoleIdx + delta;
    if (next < 0 || next > 17) return;
    this.loadHole(next);
  }

  // ── Arc drawing ──────────────────────────────────────────────────────────────

  _drawArcs() {
    this._arcLayers.forEach(l => this.mapMgr.map.removeLayer(l));
    this._arcLayers = [];
    this._arcLabels.forEach(l => this.mapMgr.map.removeLayer(l));
    this._arcLabels = [];

    const shots = this.hole.shots;
    const putts = this.hole.putts;
    const pin   = this.hole.pin;

    // Shot-to-shot arcs with carry distance labels
    for (let i = 0; i + 1 < shots.length; i++) {
      const from = shots[i].latlng;
      const to   = shots[i + 1].latlng;
      if (from && to) this._addArc(from, to, this.hole.carryYds(i));
    }

    // Last shot → first putt (or pin if in putting phase with no putts yet)
    if (shots.length > 0) {
      const lastPos = shots[shots.length - 1].latlng;
      if (lastPos) {
        if (putts.length > 0 && putts[0].latlng) {
          this._addArc(lastPos, putts[0].latlng);
        } else if (pin && this.phase === 'putting') {
          this._addArc(lastPos, pin, null, true);
        }
      }
    }

    // Putt-to-putt arcs
    for (let i = 0; i + 1 < putts.length; i++) {
      const from = putts[i].latlng;
      const to   = putts[i + 1].latlng;
      if (from && to) this._addArc(from, to);
    }

    // Last putt → pin
    if (putts.length > 0 && pin) {
      const lastPutt = putts[putts.length - 1];
      if (lastPutt.latlng) this._addArc(lastPutt.latlng, pin);
    }
  }

  _addArc(from, to, dist = null, dashed = false) {
    const pts  = this._bezierArc(from, to);
    const line = L.polyline(pts, {
      color: '#4a9eff',
      weight: 2.5,
      opacity: 0.85,
      smoothFactor: 0,
      interactive: false,
      ...(dashed ? { dashArray: '6 6' } : {}),
    }).addTo(this.mapMgr.map);
    this._arcLayers.push(line);

    if (dist !== null) {
      const mid = pts[Math.floor(pts.length / 2)];
      const lbl = L.marker(mid, {
        icon: L.divIcon({
          className: 'arc-label',
          html: `${Math.round(dist)} yds`,
          iconSize: null,
          iconAnchor: [28, 10],
        }),
        interactive: false,
        zIndexOffset: -10,
      }).addTo(this.mapMgr.map);
      this._arcLabels.push(lbl);
    }
  }

  // Quadratic bezier arc — control point offset perpendicular to shot direction
  _bezierArc(from, to, numPts = 20) {
    const dx  = to.lng - from.lng;
    const dy  = to.lat - from.lat;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) return [[from.lat, from.lng], [to.lat, to.lng]];

    const scale = Math.min(len * 0.1, 0.0008);
    const ctrl  = {
      lat: (from.lat + to.lat) / 2 - (dx / len) * scale,
      lng: (from.lng + to.lng) / 2 + (dy / len) * scale,
    };

    const pts = [];
    for (let i = 0; i <= numPts; i++) {
      const t = i / numPts;
      const u = 1 - t;
      pts.push([
        u * u * from.lat + 2 * u * t * ctrl.lat + t * t * to.lat,
        u * u * from.lng + 2 * u * t * ctrl.lng + t * t * to.lng,
      ]);
    }
    return pts;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  renderShotList() {
    const list = document.getElementById('shot-list');
    list.innerHTML = '';

    this._drawArcs();

    if (this.hole.shots.length > 0) {
      const label = document.createElement('div');
      label.className = 'phase-label';
      label.textContent = 'Shots';
      list.appendChild(label);
    }

    this.hole.shots.forEach((shot, i) => {
      const carry    = this.hole.carryYds(i);
      const isTee    = shot.type === ShotType.TEE;
      const distText = isTee && carry === null
        ? 'tap map for landing'
        : carry !== null ? Math.round(carry) + ' yds' : '—';

      const item = document.createElement('div');
      item.className = 'shot-item';

      // Row 1: number, type label, carry, delete
      const row = document.createElement('div');
      row.className = 'shot-row';
      row.innerHTML = `
        <span class="shot-num">${i + 1}</span>
        <span class="shot-type">${this._shotLabel(shot.type)}</span>
        <span class="shot-dist ${isTee && carry === null ? 'muted-hint' : ''}">${distText}</span>
        <button class="shot-del" data-idx="${i}">✕</button>
      `;
      row.querySelector('.shot-del').addEventListener('click', () => this._deleteShot(i));
      item.appendChild(row);

      // Description line (TOURCAST style)
      const desc = this._shotDescription(shot, i);
      if (desc) {
        const dl = document.createElement('div');
        dl.className = 'shot-desc';
        dl.textContent = desc;
        item.appendChild(dl);
      }

      // Club + lie buttons for all struck shots
      if (shot.type !== ShotType.OB) {
        const sel = document.createElement('select');
        sel.className = 'club-select';
        sel.innerHTML = `<option value="">Club…</option>` +
          CLUBS.map(c => `<option value="${c}" ${shot.club === c ? 'selected' : ''}>${c}</option>`).join('');
        sel.addEventListener('change', e => {
          shot.club = e.target.value || null;
          this.onRoundChange();
        });
        item.appendChild(sel);

        const lieRow = document.createElement('div');
        lieRow.className = 'lie-row';
        [
          { key: Lie.FAIRWAY, label: 'FW' },
          { key: Lie.ROUGH,   label: 'Rough' },
          { key: Lie.BUNKER,  label: 'Bunker' },
          { key: 'green',     label: 'Green' },
          { key: 'ob',        label: 'OB' },
        ].forEach(({ key, label }) => {
          const btn = document.createElement('button');
          btn.className = 'lie-btn' + (shot.lie === key ? ' active' : '');
          btn.dataset.lie = key;
          btn.textContent = label;
          btn.addEventListener('click', () => {
            shot.lie = key;
            if (key === 'ob') shot.type = ShotType.OB;
            const entry = this._markers.filter(m => m.kind === 'shot')[i];
            entry?.point.refresh?.();
            if (key === 'green') this._enterGreen();
            else { this.renderShotList(); this.onRoundChange(); }
          });
          lieRow.appendChild(btn);
        });
        item.appendChild(lieRow);
      }

      list.appendChild(item);
    });

    // Putting phase
    if (this.phase === 'putting' && this.hole.putts.length > 0) {
      const label = document.createElement('div');
      label.className = 'phase-label';
      label.textContent = 'Putts';
      list.appendChild(label);

      this.hole.putts.forEach((putt, i) => {
        const item = document.createElement('div');
        item.className = 'putt-item';
        const ft = Math.round(putt.distFt);
        item.innerHTML = `
          <span class="putt-num">${i + 1}</span>
          <span class="putt-dist">${ft} ft to pin</span>
          <button class="putt-holed-btn ${putt.holed ? 'holed' : ''}" data-idx="${i}">
            ${putt.holed ? '⛳ Holed' : 'Holed?'}
          </button>
          <button class="shot-del" data-idx="${i}">✕</button>
        `;
        item.querySelector('.putt-holed-btn').addEventListener('click', () => {
          putt.holed = !putt.holed;
          this.renderShotList();
          this._updateSGSummary();
          this.onRoundChange();
        });
        item.querySelector('.shot-del').addEventListener('click', () => this._deletePutt(i));
        list.appendChild(item);
      });
    }

    this._updateSGSummary();
    this._syncScoreInputs();
  }

  // "235 yds to Fairway · 95 yds to pin"
  _shotDescription(shot, i) {
    const carry  = this.hole.carryYds(i);
    const toPin  = i + 1 < this.hole.shots.length ? this.hole.toPinYds(i + 1) : null;
    const lie    = shot.lie ? (LIE_NAMES[shot.lie] ?? shot.lie) : null;

    const parts = [];
    if (carry !== null) parts.push(`${Math.round(carry)} yds`);
    if (lie)            parts.push(`to ${lie}`);
    if (toPin !== null && shot.lie !== 'green') parts.push(`· ${Math.round(toPin)} yds to pin`);
    if (shot.lie === 'green' && this.hole.putts[0]) {
      parts.push(`· ${Math.round(this.hole.putts[0].distFt)} ft to pin`);
    }
    return parts.join(' ');
  }

  _updateSGSummary() {
    const summary = document.getElementById('sg-summary');
    if (!this.hole.isComplete()) { summary.style.display = 'none'; return; }
    summary.style.display = '';

    const fmt = v => v === null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2);
    const cls = v => v === null ? '' : v >= 0 ? 'pos' : 'neg';

    const sgPutt = this.sgCalc.sgPutting(this.hole.putts);
    const sgApp  = this.sgCalc.sgApproach(this.hole);
    const sgOtt  = this.sgCalc.sgOffTee(this.hole);

    const set = (id, v) => {
      const el = document.getElementById(id);
      el.textContent = fmt(v);
      el.className   = 'sg-val ' + cls(v);
    };
    set('sg-ott',  sgOtt);
    set('sg-app',  sgApp);
    set('sg-putt', sgPutt);
  }

  _syncScoreInputs() {
    document.getElementById('input-score').value     = (this.hole.score ?? this.hole.totalStrokes()) || '';
    document.getElementById('input-penalties').value = this.hole.penalties;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _shotLabel(type) {
    return { tee: 'Tee shot', approach: 'Approach', ob: 'OB', drop: 'Drop' }[type] ?? type;
  }

  _deleteShot(idx) {
    this.hole.shots.splice(idx, 1);
    const shotMarkers = this._markers.filter(m => m.kind === 'shot');
    const target = shotMarkers[idx];
    if (target) { target.point.remove(); this._markers = this._markers.filter(m => m !== target); }
    this.renderShotList();
    this.onRoundChange();
  }

  _deletePutt(idx) {
    this.hole.putts.splice(idx, 1);
    const puttMarkers = this._markers.filter(m => m.kind === 'putt');
    const target = puttMarkers[idx];
    if (target) { target.point.remove(); this._markers = this._markers.filter(m => m !== target); }
    this.renderShotList();
    this.onRoundChange();
  }

  _clearMarkers() {
    this._markers.forEach(m => m.point.remove());
    this._markers = [];
    this._pinMarker?.remove();
    this._pinMarker = null;
    this._arcLayers.forEach(l => this.mapMgr.map.removeLayer(l));
    this._arcLayers = [];
    this._arcLabels.forEach(l => this.mapMgr.map.removeLayer(l));
    this._arcLabels = [];
  }

  _restoreMarkers() {
    this.hole.shots.forEach((shot, i) => {
      const marker = new ShotMarker(shot.latlng, shot, i, {
        draggable: true,
        onMove: latlng => { shot.latlng = latlng; this.renderShotList(); this.onRoundChange(); },
      });
      marker.addTo(this.mapMgr.map);
      this._markers.push({ kind: 'shot', point: marker, data: shot });
    });

    if (this.hole.pin) {
      this._placePin(this.hole.pin);
    }

    this.hole.putts.forEach((putt, i) => {
      const marker = new PuttMarker(putt.latlng, putt, i, {
        draggable: true,
        onMove: latlng => { putt.latlng = latlng; this.renderShotList(); this.onRoundChange(); },
      });
      marker.addTo(this.mapMgr.map);
      this._markers.push({ kind: 'putt', point: marker, data: putt });
    });
  }

  _centerMap() {
    const cfg = this.cfg;
    if (cfg.tee) {
      this.mapMgr.centerOn(cfg.tee);
      if (cfg.green) {
        const bearing = MapManager.bearing(cfg.tee, cfg.green);
        this.mapMgr.rotateTo(bearing);
      }
    }
  }

  _updateHoleLabel() {
    const cfg = this.cfg;
    // Keep #hole-label for e2e test compatibility
    document.getElementById('hole-label').textContent = `Hole ${cfg.holeNum} · Par ${cfg.par}`;
    // Update bottom bar stats
    document.getElementById('stat-hole').textContent = cfg.holeNum;
    document.getElementById('stat-par').textContent  = cfg.par;
    if (cfg.tee && cfg.green) {
      const yds = Math.round(Shot.distanceYds(cfg.tee, cfg.green));
      document.getElementById('stat-yards').textContent = yds;
    } else {
      document.getElementById('stat-yards').textContent = '—';
    }
  }
}
