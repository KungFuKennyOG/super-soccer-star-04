// The brawl's world: two sides of 6 or 11, a ball, the score and the clock; where everyone stands at a
// kick-off; where each man's slot in the shape is as the ball moves. Pure.
import { SIZES, CLOCK } from './tuning.js';
import { newBall } from './ball.js';

// Which way a side attacks in z (home toward -z), and where its own goal line is.
// Which way a side attacks in z: home toward -z in the first half, the other way after half time.
export const dirOf = (w, team) => (team === 'home' ? -1 : 1) * (w.half === 2 ? -1 : 1);
export const ownLine = (w, team) => -dirOf(w, team) * w.L;
export const other = team => (team === 'home' ? 'away' : 'home');

// n: 6 or 11. chaos: 0 is plain football (a tackle wins the ball, nobody leaves the ground); above 0 the
// brawl, where hits send men flying, this much further (1 robust). real: how long the match lasts (s).
export function createBrawl({ n = 11, chaos = 0, real = CLOCK.real, knockout = false } = {}) {
  const S = SIZES[n] || SIZES[11];
  const w = {
    n, W: S.halfW, L: S.halfL, shape: S.shape, chaos: chaos || 1, brawl: chaos > 0, real, knockout, half: 1, firstKick: 'home',
    fouls: { home: 0, away: 0 }, sp: null, so: null, offside: null, restart: null,
    players: [], byId: {}, ball: newBall(), owner: null, lastTeam: null, lastKick: null, noTouch: { team: null, t: 0 },
    score: { home: 0, away: 0 }, t: 0, clock: 0, phase: 'kickoff', phaseT: CLOCK.kickoff, kickoffTeam: 'home',
    ctrl: null, brain: { t: 0 }, seq: 0, stats: { hits: 0, flown: 0, longest: 0 },
  };
  for (const team of ['home', 'away']) S.shape.forEach(([sx, d, line], i) => {
    const p = {
      id: team[0] + i, team, slot: i, line, num: S.nums[i], role: line === 'gk' ? 'gk' : 'mate',
      x: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: dirOf(w, team), stride: Math.random() * 6,
      state: 'up', air: null, downT: 0, getT: 0, lunge: null, cool: 0, noBall: 0, stun: 0, think: Math.random() * 0.2,
      holding: false, throwing: false, save: null, dive: 0, sprint: false, aim: null, kicked: 0, yellow: 0,
    };
    w.players.push(p); w.byId[p.id] = p;
  });
  kickoff(w, 'home');
  return w;
}

export const side = (w, team) => w.players.filter(p => p.team === team);

// A slot's spot when nobody is moving: x across, z from the side's own goal line.
export function homeSpot(w, p) {
  const [sx, d] = w.shape[p.slot], dir = dirOf(w, p.team);
  return { x: sx * w.W * -dir, z: ownLine(w, p.team) + dir * d * 2 * w.L };
}

// Everyone back in their own half, the ball on the spot, `team` to kick off: its two most forward men stand
// over the ball.
export function kickoff(w, team) {
  w.kickoffTeam = team; w.owner = null; w.lastTeam = null; w.phase = 'kickoff'; w.phaseT = CLOCK.kickoff;
  Object.assign(w.ball, newBall());
  w.sp = null; w.offside = null;
  for (const p of w.players) {
    if (p.state === 'off') continue;
    const s = homeSpot(w, p), dir = dirOf(w, p.team);
    // pulled back a little, and never over halfway
    let z = s.z - dir * 2;
    if (dir * z > -1) z = -dir * 1;
    Object.assign(p, { x: s.x * 0.9, z, vx: 0, vz: 0, fx: 0, fz: dir, state: 'up', air: null, lunge: null, cool: 0, stun: 0, holding: false, save: null, dive: 0, noBall: 0 });
  }
  const fwd = side(w, team).filter(p => p.line !== 'gk' && p.state !== 'off').sort((a, b) => dirOf(w, team) * (b.z - a.z))[0];
  if (fwd) { fwd.x = 0; fwd.z = -dirOf(w, team) * 0.6; }
  w.taker = fwd ? fwd.id : null;
}

// Where a man should be in open play: his slot, the whole shape slid toward the ball and pushed up when his
// side has it.
export function shapeSpot(w, p) {
  const s = homeSpot(w, p), b = w.ball, dir = dirOf(w, p.team), ours = w.owner && w.byId[w.owner].team === p.team;
  if (p.line === 'gk') return s;
  // how far up the pitch the ball is for this side, 0 at its own goal line and 1 at theirs
  const depth = (b.z - ownLine(w, p.team)) * dir / (2 * w.L);
  const push = ours ? (p.line === 'def' ? 0.12 : 0.2) : -0.08, slide = 0.55;
  const baseD = w.shape[p.slot][1];
  let d = baseD + (depth - 0.5) * slide + push + (p.line === 'fwd' && ours ? 0.1 : 0);
  d = Math.max(0.06, Math.min(0.9, d));
  const x = s.x * (ours ? 0.95 : 0.75) + b.x * 0.3;
  return { x: Math.max(-w.W + 1.5, Math.min(w.W - 1.5, x)), z: ownLine(w, p.team) + dir * d * 2 * w.L };
}

// The clock as the scoreboard shows it, 0:00 to 90:00.
export function clockText(w) {
  if (w.phase === 'half') return 'HT';
  if (w.phase === 'shootout') return 'PENS';
  if (w.phase === 'full') return 'FT';
  const m = Math.min(90, (w.clock / w.real) * 90), mm = Math.floor(m), ss = Math.floor((m - mm) * 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
}
