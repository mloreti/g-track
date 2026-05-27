import { HoleRound } from '../models/HoleRound.js';
import { ShotMarker } from '../models/ShotMarker.js';
import { PuttMarker } from '../models/PuttMarker.js';
import { PinMarker }  from '../models/PinMarker.js';
import { Shot }       from '../models/Shot.js';
import { MapManager } from '../managers/MapManager.js';

const CLUBS = ['Dr', '3w', '7w', '4i', '5i', '6i', '7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW'];

const LIE_NAMES = {
  tee:     'Tee',
  fairway: 'Fairway',
  rough:   'Rough',
  bunker:  'Bunker',
  green:   'Green',
  ob:      'OB',
  penalty: 'Penalty Area',
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
    this._markers       = [];   // { kind: 'shot'|'putt', point: MapPoint, data: Shot|Putt }
    this._teeMarker     = null;
    this._pinMarker     = null;
    this._activeMode    = null;
    this._deregClick    = null;
    this._arcLayers     = [];
    this._arcLabels     = [];

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
    this._clearMarkers();
    this._restoreMarkers();
    this._centerMap();
    this._updateHoleLabel();
    this.renderShotList();

    this._enterMode(this._deriveMode());
  }

  // ── UI binding ───────────────────────────────────────────────────────────────

  _bindUI() {
    document.getElementById('btn-place-pin').addEventListener('click', () => this._enterMode('pin'));
    document.getElementById('btn-undo').addEventListener('click',      () => this._undo());
    document.getElementById('btn-prev').addEventListener('click',      () => this._navHole(-1));
    document.getElementById('btn-next').addEventListener('click',      () => this._navHole(+1));
    document.getElementById('save-hole-btn').addEventListener('click', () => this._saveHole());

    document.getElementById('btn-pbp').addEventListener('click', () => {
      document.getElementById('pbp-panel').classList.toggle('open');
    });
    document.getElementById('btn-close-pbp').addEventListener('click', () => {
      document.getElementById('pbp-panel').classList.remove('open');
    });
  }

  // ── Mode management ──────────────────────────────────────────────────────────

  // Derive the correct mode purely from current hole state.
  _deriveMode() {
    if (!this.hole.tee) return 'tee';
    if (!this.hole.pin) return 'pin';
    const shots = this.hole.shots;
    if (shots.length === 0) return 'shot';
    const last = shots[shots.length - 1];
    if (last.isInPenalty()) return 'drop';
    if (last.endLie === 'green') return 'putt';
    return 'shot';
  }

  _enterMode(mode) {
    this._exitMode();
    this._activeMode = mode;
    this._highlightBtn(mode, true);

    const hints = {
      tee:  'Tap to place the tee',
      pin:  'Tap to set the pin location',
      shot: 'Tap where each shot landed',
      putt: 'Tap where each putt started',
      drop: 'Tap to place the penalty drop location',
    };
    this._setGuidance(hints[mode] ?? null);

    this._deregClick = this.mapMgr.onMapClick(latlng => {
      if (mode === 'tee')  this._placeTee(latlng);
      if (mode === 'pin')  this._placePin(latlng);
      if (mode === 'shot') this._placeShot(latlng);
      if (mode === 'putt') this._placePutt(latlng);
      if (mode === 'drop') this._placeDrop(latlng);
    });
  }

  _exitMode() {
    if (this._deregClick) { this._deregClick(); this._deregClick = null; }
    if (this._activeMode) this._highlightBtn(this._activeMode, false);
    this._activeMode = null;
  }

  _highlightBtn(mode, on) {
    const map = { pin: 'btn-place-pin' };
    document.getElementById(map[mode])?.classList.toggle('active', on);
  }

  _setGuidance(text) {
    const el = document.getElementById('guidance-label');
    if (text) { el.textContent = text; el.classList.add('visible'); }
    else       { el.classList.remove('visible'); }
  }

  // ── Placement ────────────────────────────────────────────────────────────────

  _placeTee(latlng) {
    this.hole.tee = latlng;
    this._teeMarker?.remove();
    this._teeMarker = new PinMarker(latlng, {
      draggable: true,
      icon: 'tee',
      onMove: newLatLng => {
        this.hole.tee = newLatLng;
        this.renderShotList();
        this.onRoundChange();
      },
    });
    this._teeMarker.addTo(this.mapMgr.map);
    this.onRoundChange();
    this._enterMode('pin');
  }

  _placePin(latlng, { silent = false } = {}) {
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

    if (!silent) {
      this.renderShotList();
      this.onRoundChange();
      this._enterMode('shot');
    }
  }

  _placeShot(latlng) {
    const shot = this.hole.addShot(latlng);
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
    this.renderShotList();
    this.onRoundChange();
  }

  _placeDrop(latlng) {
    const shot = this.hole.addShot(latlng, 'penalty');
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
    this._enterMode('shot');
    this.renderShotList();
    this.onRoundChange();
  }

  _placePutt(latlng) {
    if (!this.hole.pin) { alert('Place the pin first'); return; }
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
    this.renderShotList();
    this.onRoundChange();
  }

  // ── Undo ─────────────────────────────────────────────────────────────────────

  _undo() {
    if (this.hole.putts.length > 0) {
      this.hole.removeLastPutt();
      const last = this._markers.filter(m => m.kind === 'putt').pop();
      if (last) { last.point.remove(); this._markers = this._markers.filter(m => m !== last); }
    } else if (this.hole.shots.length > 0) {
      this.hole.removeLastShot();
      const last = this._markers.filter(m => m.kind === 'shot').pop();
      if (last) { last.point.remove(); this._markers = this._markers.filter(m => m !== last); }
    }
    this._enterMode(this._deriveMode());
    this.renderShotList();
    this.onRoundChange();
  }

  _enterDropModeForShot(shotIdx) {
    this._exitMode();
    this._activeMode = 'drop';
    this._setGuidance('Tap to place the penalty drop location');
    this._deregClick = this.mapMgr.onMapClick(latlng => this._placeDrop(latlng));
  }

  // ── Save / Navigation ─────────────────────────────────────────────────────────

  _saveHole() {
    this.onRoundChange();
    this._navHole(+1);
  }

  _navHole(delta) {
    const next = this.currentHoleIdx + delta;
    if (next < 0 || next > 17) return;
    this.loadHole(next);
  }

  // ── Arc drawing ───────────────────────────────────────────────────────────────
  // Arc chain: hole.tee → shots[0] → shots[1] → ... → putts[0] → ... → hole.pin

  _drawArcs() {
    this._arcLayers.forEach(l => this.mapMgr.map.removeLayer(l));
    this._arcLayers = [];
    this._arcLabels.forEach(l => this.mapMgr.map.removeLayer(l));
    this._arcLabels = [];

    const shots = this.hole.shots;
    const putts = this.hole.putts;
    const tee   = this.hole.tee;
    const pin   = this.hole.pin;

    // Build position chain: [tee, ...shots.latlng]
    const positions = [
      tee,
      ...shots.map(s => s.latlng),
    ].filter(Boolean);

    // Shot arcs: positions[i] → positions[i+1], styled by shots[i]
    for (let i = 0; i + 1 < positions.length; i++) {
      const shot  = shots[i];   // shots[i] is the stroke that lands at positions[i+1]
      const from  = positions[i];
      const to    = positions[i + 1];
      if (!from || !to) continue;

      const carry   = this.hole.carryYds(i);
      const dashed  = shot.isPenaltyStroke();
      const color   = shot.isInPenalty() ? 'red' : 'default';
      this._addArc(from, to, dashed ? null : carry, dashed, color);
    }

    // Last shot → first putt
    if (shots.length > 0 && shots[shots.length - 1].latlng) {
      const lastPos = shots[shots.length - 1].latlng;
      if (putts.length > 0 && putts[0].latlng) {
        this._addArc(lastPos, putts[0].latlng);
      } else if (pin && this._activeMode === 'putt') {
        this._addArc(lastPos, pin, null, true);
      }
    }

    // Putt arcs
    for (let i = 0; i + 1 < putts.length; i++) {
      if (putts[i].latlng && putts[i + 1].latlng) {
        this._addArc(putts[i].latlng, putts[i + 1].latlng);
      }
    }

    // Last putt → pin
    if (putts.length > 0 && pin && putts[putts.length - 1].latlng) {
      this._addArc(putts[putts.length - 1].latlng, pin);
    }
  }

  _addArc(from, to, dist = null, dashed = false, color = 'default') {
    const lineColor = color === 'red' ? '#e05252' : '#4a9eff';
    const pts  = this._bezierArc(from, to);
    const line = L.polyline(pts, {
      color:       lineColor,
      weight:      2.5,
      opacity:     0.85,
      smoothFactor:0,
      interactive: false,
      ...(dashed ? { dashArray: '6 6' } : {}),
    }).addTo(this.mapMgr.map);
    this._arcLayers.push(line);

    if (dist !== null) {
      const mid = pts[Math.floor(pts.length / 2)];
      const lbl = L.marker(mid, {
        icon: L.divIcon({
          className: 'arc-label',
          html:      `${Math.round(dist)} yds`,
          iconSize:  null,
          iconAnchor:[28, 10],
        }),
        interactive:  false,
        zIndexOffset: -10,
      }).addTo(this.mapMgr.map);
      this._arcLabels.push(lbl);
    }
  }

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

  // ── Render ────────────────────────────────────────────────────────────────────

  renderShotList() {
    const list = document.getElementById('shot-list');
    list.innerHTML = '';

    // Keep auto-placed putt in sync with the last shot position (drag support)
    const shots = this.hole.shots;
    const putts = this.hole.putts;
    if (putts.length > 0 && putts[0].autoPlaced && shots.length > 0) {
      putts[0].latlng = shots[shots.length - 1].latlng;
    }

    this._drawArcs();

    if (shots.length > 0) {
      list.appendChild(this._phaseLabel('Shots'));
    }

    shots.forEach((shot, i) => {
      const strokeNum = i + 1;
      const toPin     = this.hole.toPinYds(i);
      const carry     = this.hole.carryYds(i);
      const toPinText = toPin !== null ? `${Math.round(toPin)} yds to hole` : '';

      const item = document.createElement('div');
      item.className = 'shot-item';

      // Row: stroke number, starting lie, distance to hole, delete
      // Derive starting lie dynamically from the previous shot's current endLie
      // (shot.startLie can be stale if endLie was set after this shot was placed)
      const effectiveStartLie = i === 0
        ? 'tee'
        : (shots[i - 1]?.endLie ?? shot.startLie);
      const startLieLabel = shot.isPenaltyStroke()
        ? 'Penalty Stroke'
        : (LIE_NAMES[effectiveStartLie] ?? effectiveStartLie ?? '—');
      const row = document.createElement('div');
      row.className = 'shot-row';
      row.innerHTML = `
        <span class="shot-num">${strokeNum}</span>
        <span class="shot-type">${startLieLabel}</span>
        <span class="shot-dist">${toPinText}</span>
        <button class="shot-del" data-idx="${i}">✕</button>
      `;
      row.querySelector('.shot-del').addEventListener('click', () => this._deleteShot(i));
      item.appendChild(row);

      // Sub-line: Club • carry yds • to EndLie
      const desc = this._shotDescription(shot, carry, i === 0);
      if (desc) {
        const dl = document.createElement('div');
        dl.className = 'shot-desc';
        dl.textContent = desc;
        item.appendChild(dl);
      }

      // Club select — only for non-penalty strokes
      if (!shot.isPenaltyStroke()) {
        const sel = document.createElement('select');
        sel.className = 'club-select';
        sel.innerHTML = `<option value="">Club…</option>` +
          CLUBS.map(c => `<option value="${c}" ${shot.club === c ? 'selected' : ''}>${c}</option>`).join('');
        sel.addEventListener('change', e => {
          shot.club = e.target.value || null;
          this.onRoundChange();
        });
        item.appendChild(sel);
      }

      // End lie buttons
      // Penalty strokes (drops) can't end in penalty/OB again
      const lieOptions = shot.isPenaltyStroke()
        ? [
            { key: 'fairway', label: 'FW' },
            { key: 'rough',   label: 'Rough' },
            { key: 'bunker',  label: 'Bunker' },
            { key: 'green',   label: 'Green' },
          ]
        : [
            { key: 'fairway', label: 'FW' },
            { key: 'rough',   label: 'Rough' },
            { key: 'bunker',  label: 'Bunker' },
            { key: 'green',   label: 'Green' },
            { key: 'penalty', label: 'Penalty' },
            { key: 'ob',      label: 'OB' },
          ];

      const lieRow = document.createElement('div');
      lieRow.className = 'lie-row';
      lieOptions.forEach(({ key, label }) => {
        const btn = document.createElement('button');
        btn.className = 'lie-btn' + (shot.endLie === key ? ' active' : '');
        btn.dataset.lie = key;
        btn.textContent = label;
        btn.addEventListener('click', () => {
          shot.endLie = key;
          // Propagate to the next shot's startLie so the model stays consistent
          // (the next shot may have been placed before this endLie was set)
          const nextShot = shots[i + 1];
          if (nextShot && !nextShot.isPenaltyStroke()) {
            nextShot.startLie = key;
          }
          const markerEntry = this._markers.filter(m => m.kind === 'shot')[i];
          markerEntry?.point.refresh?.();

          if (key === 'green') {
            // Auto-place P1 at the chip landing and show its marker.
            // P1 marker (purple) renders on top of the shot dot (blue).
            if (this.hole.putts.length === 0) {
              const p = this.hole.addPutt(shot.latlng);
              p.autoPlaced = true;
              const puttMarker = new PuttMarker(shot.latlng, p, 0, { draggable: false });
              puttMarker.addTo(this.mapMgr.map);
              this._markers.push({ kind: 'putt', point: puttMarker, data: p });
            }
            this._enterMode('putt');
            this.renderShotList();
            this.onRoundChange();
          } else if (key === 'penalty' || key === 'ob') {
            this.renderShotList();
            this.onRoundChange();
            // Enter drop mode if no drop already placed after this shot
            const hasDropAlready = shots.slice(i + 1).some(s => s.isPenaltyStroke());
            if (!hasDropAlready) this._enterDropModeForShot(i);
          } else {
            this.renderShotList();
            this.onRoundChange();
          }
        });
        lieRow.appendChild(btn);
      });
      item.appendChild(lieRow);

      list.appendChild(item);
    });

    // Putts
    if (putts.length > 0) {
      list.appendChild(this._phaseLabel('Putts'));
      putts.forEach((putt, i) => {
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
    this._syncScoreDisplay();
  }

  _phaseLabel(text) {
    const el = document.createElement('div');
    el.className = 'phase-label';
    el.textContent = text;
    return el;
  }

  _shotDescription(shot, carry, isFirst) {
    const endLieName = LIE_NAMES[shot.endLie] ?? shot.endLie;

    if (shot.isPenaltyStroke()) {
      return endLieName ? `Dropped in ${endLieName}` : '';
    }

    const parts = [];
    if (shot.club) parts.push(shot.club);
    if (carry !== null) {
      parts.push(`${Math.round(carry)} yds`);
    } else if (isFirst) {
      parts.push('tap map for shot landing');
    }
    if (endLieName && carry !== null) parts.push(`to ${endLieName}`);
    return parts.join(' • ');
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

  _syncScoreDisplay() {
    document.getElementById('input-score').value     = this.hole.score || '';
    document.getElementById('input-penalties').value = this.hole.penalties;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _deleteShot(idx) {
    this.hole.shots.splice(idx, 1);
    const shotMarkers = this._markers.filter(m => m.kind === 'shot');
    const target = shotMarkers[idx];
    if (target) { target.point.remove(); this._markers = this._markers.filter(m => m !== target); }
    this._enterMode(this._deriveMode());
    this.renderShotList();
    this.onRoundChange();
  }

  _deletePutt(idx) {
    this.hole.putts.splice(idx, 1);
    const puttMarkers = this._markers.filter(m => m.kind === 'putt');
    const target = puttMarkers[idx];
    if (target) { target.point.remove(); this._markers = this._markers.filter(m => m !== target); }
    this._enterMode(this._deriveMode());
    this.renderShotList();
    this.onRoundChange();
  }

  _clearMarkers() {
    this._markers.forEach(m => m.point.remove());
    this._markers = [];
    this._teeMarker?.remove(); this._teeMarker = null;
    this._pinMarker?.remove(); this._pinMarker = null;
    this._arcLayers.forEach(l => this.mapMgr.map.removeLayer(l)); this._arcLayers = [];
    this._arcLabels.forEach(l => this.mapMgr.map.removeLayer(l)); this._arcLabels = [];
  }

  _restoreMarkers() {
    if (this.hole.tee) {
      // Restore tee marker silently
      this._teeMarker = new PinMarker(this.hole.tee, {
        draggable: true,
        icon: 'tee',
        onMove: newLatLng => {
          this.hole.tee = newLatLng;
          this.renderShotList();
          this.onRoundChange();
        },
      });
      this._teeMarker.addTo(this.mapMgr.map);
    }

    if (this.hole.pin) {
      this._placePin(this.hole.pin, { silent: true });
    }

    this.hole.shots.forEach((shot, i) => {
      const marker = new ShotMarker(shot.latlng, shot, i, {
        draggable: true,
        onMove: latlng => { shot.latlng = latlng; this.renderShotList(); this.onRoundChange(); },
      });
      marker.addTo(this.mapMgr.map);
      this._markers.push({ kind: 'shot', point: marker, data: shot });
    });

    this.hole.putts.forEach((putt, i) => {
      const draggable = !putt.autoPlaced;
      const marker = new PuttMarker(putt.latlng, putt, i, {
        draggable,
        onMove: draggable ? (latlng => { putt.latlng = latlng; this.renderShotList(); this.onRoundChange(); }) : undefined,
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
    document.getElementById('hole-label').textContent = `Hole ${cfg.holeNum} · Par ${cfg.par}`;
    document.getElementById('stat-hole').textContent  = cfg.holeNum;
    document.getElementById('stat-par').textContent   = cfg.par;
    if (cfg.tee && cfg.green) {
      document.getElementById('stat-yards').textContent = Math.round(Shot.distanceYds(cfg.tee, cfg.green));
    } else {
      document.getElementById('stat-yards').textContent = '—';
    }
  }
}
