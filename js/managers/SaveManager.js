const LS_ROUND  = 'gtrack_current_round';
const LS_CONFIG = 'gtrack_hole_config';
const LS_LAST   = 'gtrack_last_save';
const REPO      = 'mloreti/g-track';
const SAVES_API = `https://api.github.com/repos/${REPO}/contents/saves`;

export class SaveManager {
  // ── Local storage ──────────────────────────────────────────────────────────

  static saveRound(round) {
    localStorage.setItem(LS_ROUND, JSON.stringify(round.toJSON()));
  }

  static loadRound() {
    try {
      const data = JSON.parse(localStorage.getItem(LS_ROUND));
      return data ?? null;
    } catch { return null; }
  }

  static saveHoleConfig(config) {
    localStorage.setItem(LS_CONFIG, JSON.stringify(config));
  }

  static loadHoleConfig() {
    try {
      return JSON.parse(localStorage.getItem(LS_CONFIG)) ?? null;
    } catch { return null; }
  }

  // ── GitHub Pages saves ────────────────────────────────────────────────────

  // List .json files available in /saves on the deployed repo
  static async listSaves() {
    try {
      const res  = await fetch(SAVES_API);
      if (!res.ok) return [];
      const files = await res.json();
      return files
        .filter(f => f.name.endsWith('.json'))
        .map(f => ({ name: f.name, url: f.download_url }));
    } catch { return []; }
  }

  // Fetch and parse a save file from the repo
  static async fetchSave(downloadUrl) {
    try {
      const res  = await fetch(downloadUrl);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  // Load the last-used save from the repo (called on startup)
  static async loadLastSave() {
    const lastName = localStorage.getItem(LS_LAST);
    if (!lastName) return null;
    try {
      const res = await fetch(`./saves/${lastName}`);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  static setLastSave(filename) {
    localStorage.setItem(LS_LAST, filename);
  }

  static getLastSave() {
    return localStorage.getItem(LS_LAST);
  }

  // Build a JSON payload to download / commit as a save file
  static buildPayload({ round, holeConfig }) {
    return JSON.stringify({ round: round.toJSON(), holeConfig }, null, 2);
  }

  // Trigger a browser download of the current round as a .json file
  static downloadAsFile(payload, filename) {
    const blob = new Blob([payload], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
