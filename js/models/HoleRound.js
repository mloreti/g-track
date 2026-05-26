import { Shot, ShotType } from './Shot.js';
import { Putt } from './Putt.js';

export class HoleRound {
  constructor(holeNum, par) {
    this.holeNum  = holeNum;  // 1-18
    this.par      = par;      // 3 | 4 | 5
    this.shots    = [];       // Shot[] — tee through last approach
    this.putts    = [];       // Putt[] — ordered, last one has holed=true
    this.pin      = null;     // { lat, lng }
    this.score    = null;     // confirmed score (null until saved)
    this.penalties = 0;       // extra penalty strokes (lost ball, etc.)
  }

  addShot(latlng, type = ShotType.APPROACH) {
    const shot = new Shot(latlng, type);
    this.shots.push(shot);
    return shot;
  }

  addPutt(latlng) {
    if (!this.pin) throw new Error('Pin must be set before adding putts');
    const putt = new Putt(latlng, this.pin);
    this.putts.push(putt);
    return putt;
  }

  removeLastShot() {
    return this.shots.pop() ?? null;
  }

  removeLastPutt() {
    return this.putts.pop() ?? null;
  }

  // Carry in yards from shot N to shot N+1 (or to first putt if last approach)
  carryYds(shotIndex) {
    const from = this.shots[shotIndex]?.latlng;
    const to   = this.shots[shotIndex + 1]?.latlng ?? this.putts[0]?.latlng;
    if (!from || !to) return null;
    return Shot.distanceYds(from, to);
  }

  // Distance in yards from a shot to the pin
  toPinYds(shotIndex) {
    if (!this.pin) return null;
    const latlng = this.shots[shotIndex]?.latlng;
    if (!latlng) return null;
    return Shot.distanceYds(latlng, this.pin);
  }

  // Total penalty strokes: OB shots + manual penalties
  totalPenalties() {
    const obStrokes = this.shots.reduce((n, s) => n + s.penaltyStrokes(), 0);
    return obStrokes + this.penalties;
  }

  // Auto-calculated stroke count (shots + putts + penalties)
  totalStrokes() {
    return this.shots.length + this.putts.length + this.totalPenalties();
  }

  // Hole is complete when the last putt is holed OR score has been manually confirmed
  // (covers aces, chip-ins, and other hole-outs with 0 putts)
  isComplete() {
    if (this.score !== null) return true;
    return this.putts.length > 0 && this.putts[this.putts.length - 1].holed;
  }

  toJSON() {
    return {
      holeNum:   this.holeNum,
      par:       this.par,
      shots:     this.shots.map(s => s.toJSON()),
      putts:     this.putts.map(p => p.toJSON()),
      pin:       this.pin,
      score:     this.score,
      penalties: this.penalties,
    };
  }

  static fromJSON(data) {
    const h = new HoleRound(data.holeNum, data.par);
    h.shots     = data.shots.map(Shot.fromJSON);
    h.putts     = data.putts.map(Putt.fromJSON);
    h.pin       = data.pin;
    h.score     = data.score;
    h.penalties = data.penalties ?? 0;
    return h;
  }
}
