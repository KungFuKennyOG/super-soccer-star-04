// Offside, as the Laws have it (simplified): when a man plays the ball, any teammate of his in the other
// half who is nearer the other side's goal line than both the ball and the second-last of their men is in
// an offside position. If one of them is the next to touch the ball before anyone on the other side does,
// he's offside: an indirect free kick where he stood when it was played. Never from a throw-in, a corner or
// a goal kick. Pure.
import { dirOf } from './world.js';

// How far toward the other goal (in z, along dir) a man of `team` can stand without being offside: the
// second-last man of theirs, or the ball if it's further on, never short of halfway.
export function offsideLine(w, team, ballZ = w.ball.z) {
  const dir = dirOf(w, team);
  const deep = w.players.filter(o => o.team !== team && o.state !== 'off').map(o => o.z * dir).sort((a, b) => b - a);
  return Math.max(deep[1] ?? 0, ballZ * dir, 0);
}

// Who is in an offside position as `kicker` plays the ball: their ids and where they stood.
export function snapshot(w, kicker, restart = null) {
  if (restart === 'throw' || restart === 'corner' || restart === 'goalkick') return null;
  const dir = dirOf(w, kicker.team), line = offsideLine(w, kicker.team, w.ball.z), off = {};
  for (const p of w.players) {
    if (p.team !== kicker.team || p === kicker || p.state === 'off' || p.line === 'gk') continue;
    if (p.z * dir > line + 0.05) off[p.id] = { x: p.x, z: p.z };
  }
  return Object.keys(off).length ? { team: kicker.team, off } : null;
}

// p has just touched the ball. Returns where he stood if that makes him offside, or null; clears the
// snapshot once the other side has touched it.
export function touched(w, p) {
  const s = w.offside;
  if (!s) return null;
  if (p.team !== s.team) { w.offside = null; return null; }
  const at = s.off[p.id];
  w.offside = null;
  return at || null;
}
