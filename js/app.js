import { MapManager }  from './managers/MapManager.js';
import { SaveManager } from './managers/SaveManager.js';
import { SGCalc }      from './managers/SGCalc.js';
import { Round }       from './models/Round.js';
import { ShotEntry }   from './modes/ShotEntry.js';
import { STONEBRIDGE } from './data/stonebridge.js';

async function loadSGCalc() {
  const res = await fetch('./sg_baseline.csv');
  const csv = await res.text();
  return SGCalc.fromCSV(csv);
}

async function init() {
  const sgCalc = await loadSGCalc();

  // Hole config: localStorage overrides (user-dragged tee/green positions)
  // merged on top of STONEBRIDGE defaults
  const savedConfig  = SaveManager.loadHoleConfig() ?? {};
  const holeConfig   = STONEBRIDGE.holes.map((h, i) => ({
    ...h,
    ...(savedConfig[i] ?? {}),
  }));

  // Round: restore in-progress round or start fresh
  const savedRound = SaveManager.loadRound();
  const today      = new Date().toISOString().slice(0, 10);
  const round      = savedRound
    ? Round.fromJSON(savedRound)
    : new Round(today, STONEBRIDGE.name);

  const mapMgr = new MapManager('map').init();

  const entry = new ShotEntry({
    mapManager: mapMgr,
    round,
    holeConfig,
    sgCalc,
    onRoundChange:      () => SaveManager.saveRound(round),
    onHoleConfigChange: (idx, patch) => {
      const config = SaveManager.loadHoleConfig() ?? {};
      config[idx]  = { ...config[idx], ...patch };
      SaveManager.saveHoleConfig(config);
    },
  });

  entry.loadHole(0);
}

init();
