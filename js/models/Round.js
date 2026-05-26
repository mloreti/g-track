import { HoleRound } from './HoleRound.js';

export class Round {
  constructor(date, course) {
    this.date   = date;    // ISO string e.g. '2026-05-25'
    this.course = course;  // string
    this.holes  = [];      // HoleRound[], index 0 = hole 1
  }

  getHole(holeNum) {
    return this.holes[holeNum - 1] ?? null;
  }

  setHole(holeRound) {
    this.holes[holeRound.holeNum - 1] = holeRound;
  }

  totalScore() {
    return this.holes.reduce((sum, h) => sum + (h?.score ?? h?.totalStrokes() ?? 0), 0);
  }

  totalVsPar() {
    return this.holes.reduce((sum, h) => {
      const score = h?.score ?? h?.totalStrokes() ?? null;
      return score !== null ? sum + score - h.par : sum;
    }, 0);
  }

  completedHoles() {
    return this.holes.filter(h => h?.isComplete()).length;
  }

  toJSON() {
    return {
      date:   this.date,
      course: this.course,
      holes:  this.holes.map(h => h?.toJSON() ?? null),
    };
  }

  static fromJSON(data) {
    const r = new Round(data.date, data.course);
    r.holes = data.holes.map(h => h ? HoleRound.fromJSON(h) : null);
    return r;
  }
}
