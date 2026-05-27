import { Shot } from './Shot.js';
import { Putt } from './Putt.js';

export class HoleRound {
  constructor(holeNum, par) {
    this.holeNum = holeNum;  // 1-18
    this.par     = par;      // 3 | 4 | 5
    this.tee     = null;     // { lat, lng } — set by first click (hole data, not a shot)
    this.pin     = null;     // { lat, lng } — set by second click
    this.shots   = [];       // Shot[] — ball positions after each stroke
    this.putts   = [];       // Putt[] — ordered, last one has holed=true
  }

  // score = total strokes (computed)
  get score() {
    return this.shots.length + this.putts.length;
  }

  // penalties = shots that ended in a penalty area or OB (informational only)
  get penalties() {
    return this.shots.filter(s => s.isInPenalty()).length;
  }

  get scoreToPar() {
    return this.score - this.par;
  }

  addShot(latlng, startLie = null) {
    // Auto-derive startLie from previous shot's endLie if not provided
    if (startLie === null && this.shots.length > 0) {
      startLie = this.shots[this.shots.length - 1].endLie;
    }
    if (startLie === null && this.shots.length === 0) {
      startLie = 'tee';
    }
    const shot = new Shot(latlng, startLie);
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

  // Carry in yards for shots[i]: from previous position to shots[i].latlng
  // Previous position is hole.tee for i===0, otherwise shots[i-1].latlng
  carryYds(i) {
    const from = i === 0 ? this.tee : this.shots[i - 1]?.latlng;
    const to   = this.shots[i]?.latlng;
    if (!from || !to) return null;
    return Shot.distanceYds(from, to);
  }

  // Distance in yards from shots[i].latlng to the pin
  toPinYds(i) {
    if (!this.pin) return null;
    const latlng = this.shots[i]?.latlng;
    if (!latlng) return null;
    return Shot.distanceYds(latlng, this.pin);
  }

  isComplete() {
    return this.putts.length > 0 && this.putts[this.putts.length - 1].holed;
  }

  toJSON() {
    return {
      holeNum: this.holeNum,
      par:     this.par,
      tee:     this.tee,
      pin:     this.pin,
      shots:   this.shots.map(s => s.toJSON()),
      putts:   this.putts.map(p => p.toJSON()),
    };
  }

  static fromJSON(data) {
    const h   = new HoleRound(data.holeNum, data.par);
    h.tee     = data.tee ?? null;
    h.pin     = data.pin ?? null;
    h.shots   = data.shots.map(Shot.fromJSON);
    h.putts   = data.putts.map(Putt.fromJSON);
    return h;
  }
}
