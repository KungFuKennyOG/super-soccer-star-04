// Fouls and cards in plain football (the brawl has none: the referee waves everything on). Pure.
// A tackle that reaches the man on the ball is judged here: clean (he comes away with it), a miss, or a foul
// (the man goes down). Then the referee: a card or not, and a free kick or (inside the box) a penalty.
import { FOUL } from './tuning.js';
import { dirOf, ownLine } from './world.js';

// t tackles v (who has the ball). big: a sliding tackle. → 'clean' | 'miss' | 'foul'
export function judgeTackle(t, v, big, rnd = Math.random) {
  const behind = (t.x - v.x) * v.fx + (t.z - v.z) * v.fz < -0.25 * Math.hypot(t.x - v.x, t.z - v.z);
  const win = (big ? FOUL.slideWin : FOUL.win) * (behind ? FOUL.behindWin : 1);
  if (rnd() < win) return behind && big && rnd() < FOUL.throughBack ? 'foul' : 'clean';
  return rnd() < (big ? FOUL.slideFoul : FOUL.standFoul) ? 'foul' : 'miss';
}

// Is (x, z) inside the penalty area that `team` defends?
export function inBox(w, team, x, z) {
  const d = (z - ownLine(w, team)) * dirOf(w, team);
  return Math.abs(x) < 20.16 && d >= -0.2 && d < 16.5;
}

// The referee's call on a foul by `by` (the tackler) on `on`: { card: null | 'yellow' | 'red', off: bool,
// kind: 'free' | 'penalty', x, z }. Updates the bookings on the player.
export function referee(w, by, on, big, behind, rnd = Math.random) {
  let card = null;
  const r = rnd();
  if (big && behind && r < FOUL.red) card = 'red';
  else if (r < (big ? (behind ? FOUL.yellowBehind : FOUL.yellowSlide) : FOUL.yellowStand)) card = 'yellow';
  if (card === 'yellow' && by.yellow) card = 'red2';
  if (card === 'yellow') by.yellow = 1;
  const off = card === 'red' || card === 'red2';
  const pen = inBox(w, by.team, on.x, on.z);
  return { card, off, kind: pen ? 'penalty' : 'free', x: on.x, z: on.z };
}

// A man sent off leaves the pitch: off his feet for good, out of everyone's reckoning.
export function sendOff(w, p) {
  p.state = 'off'; p.air = null; p.lunge = null; p.holding = false; p.vx = p.vz = 0;
  p.x = Math.sign(p.x || 1) * (w.W + 6); p.z = 0;
  if (w.owner === p.id) w.owner = null;
  if (w.ctrl === p.id) w.ctrl = null;
}
