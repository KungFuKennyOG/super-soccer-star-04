// A penalty shoot-out, after a knockout match ends level: five each, then sudden death, all at the goal at
// z = -L. Each kick is a penalty set piece (rules/brawl/setpiece.js) with the taker turning in his side's
// order; everyone else waits in the centre circle. Pure.
//   w.so = { score, taken, order, next, end, wait, done, winner }
import { CLOCK } from './tuning.js';
import { other } from './world.js';
import { startSetPiece } from './setpiece.js';
import { isUp } from './hits.js';

export function startShootout(w, ev, rnd = Math.random) {
  const order = {};
  for (const team of ['home', 'away']) {
    // forwards first, then midfield, then the back line; the keeper last of all
    const rank = { fwd: 0, mid: 1, def: 2, gk: 3 };
    order[team] = w.players.filter(p => p.team === team && p.state !== 'off').sort((a, b) => rank[a.line] - rank[b.line] || b.slot - a.slot).map(p => p.id);
  }
  w.so = { score: { home: 0, away: 0 }, taken: { home: 0, away: 0 }, order, next: rnd() < 0.5 ? 'home' : 'away', end: -1, wait: CLOCK.kickoff, done: false, winner: null, log: [] };
  w.phase = 'shootout'; w.owner = null; w.sp = null;
  lineUp(w);
  ev.push({ type: 'shootout', first: w.so.next });
}

// Everyone not involved in this kick stands in the centre circle.
function lineUp(w) {
  w.players.forEach((p, i) => {
    if (p.state === 'off') return;
    Object.assign(p, { state: 'up', air: null, lunge: null, vx: 0, vz: 0, holding: false, throwing: false, save: null, dive: 0 });
    const a = (i / w.players.length) * Math.PI * 2;
    p.x = Math.cos(a) * 6; p.z = Math.sin(a) * 4 + 2; p.fx = 0; p.fz = -1;
  });
}

// Has it been decided? (a side can't catch up with the kicks it has left, or sudden death has a winner)
export function decided(so) {
  const { score: s, taken: t } = so, left = team => Math.max(0, 5 - t[team]);
  if (t.home <= 5 && t.away <= 5 && (t.home < 5 || t.away < 5)) {
    if (s.home + left('home') < s.away) return 'away';
    if (s.away + left('away') < s.home) return 'home';
    return null;
  }
  if (t.home === t.away && s.home !== s.away) return s.home > s.away ? 'home' : 'away';
  return null;
}

// Each step of the shoot-out, after the set piece has stepped. outcome: 'goal' | 'saved' | null, from the
// ball this step.
export function stepShootout(w, dt, ev, outcome) {
  const so = w.so;
  if (so.done) return;
  if (!w.sp) {
    if ((so.wait -= dt) > 0) return;
    const team = so.next, ids = so.order[team], taker = ids[so.taken[team] % ids.length];
    const gk = w.players.find(p => p.team === other(team) && p.line === 'gk' && p.state !== 'off');
    lineUp(w);
    if (gk) { gk.x = 0; gk.z = -w.L + 0.4; gk.fx = 0; gk.fz = 1; }
    const tk = w.byId[taker]; tk.x = 0; tk.z = -w.L + 16; tk.fx = 0; tk.fz = -1;
    startSetPiece(w, 'penalty', team, { x: 0, z: -w.L + 11 }, ev, { taker, end: -1, so: true });
    return;
  }
  const sp = w.sp;
  if (sp.stage !== 'flight') return;
  sp.ft += dt;
  const b = w.ball, still = Math.hypot(b.vx, b.vy, b.vz) < 0.6;
  if (!outcome && !(sp.ft > 3 || (sp.ft > 0.8 && still) || (sp.ft > 0.4 && b.z > -w.L + 14 && b.vz > 0))) return;
  const team = sp.team, scored = outcome === 'goal';
  so.taken[team]++; if (scored) so.score[team]++;
  so.log.push({ team, id: sp.taker, scored });
  ev.push({ type: 'pen', team, id: sp.taker, scored, score: { ...so.score } });
  w.sp = null; so.wait = 1.6; so.next = other(team);
  const win = decided(so);
  if (win) {
    so.done = true; so.winner = win; w.phase = 'full';
    ev.push({ type: 'fulltime', score: { ...w.score }, pens: { ...so.score }, winner: win });
  }
}

export const keeperInShootout = (w, p) => w.phase === 'shootout' && w.sp && p.line === 'gk' && p.team !== w.sp.team && isUp(p);
