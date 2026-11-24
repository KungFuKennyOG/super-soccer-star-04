// Passing and shooting in the brawl, for you and the AI alike. Pure.
import { KICK, BALL2, GOAL2, CHAOS } from './tuning.js';
import { dirOf } from './world.js';
import { isUp } from './hits.js';
import { snapshot, offsideLine } from './offside.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// The ball leaves p's boot with this velocity. kind: 'pass' | 'shot' | 'clear'. to: the man it's meant for.
// From a set piece (w.restart set) the ball goes from where it lies; otherwise from just ahead of him.
// Offside is judged as it's played (rules/brawl/offside.js).
export function kickBall(w, p, vx, vy, vz, kind, ev, to = null, power = 0.5) {
  const b = w.ball, h = Math.hypot(vx, vz) || 1;
  w.offside = snapshot(w, p, w.restart);
  if (!w.restart) { b.x = p.x + vx / h * 0.45; b.z = p.z + vz / h * 0.45; b.y = Math.max(BALL2.r, p.holding ? 1.0 : BALL2.r); }
  w.restart = null;
  b.vx = vx; b.vy = vy; b.vz = vz;
  w.owner = null; w.lastTeam = p.team; w.lastKick = ++w.seq; w.lastKickBy = p.id; w.lastKind = kind; w.pass = to ? { to: to.id, from: p.id, t: 0 } : null;
  p.noBall = KICK.noRetake; p.holding = false; p.throwing = false; p.kicked = { kind, dir: { x: vx / h, z: vz / h }, power, t: 0 };
  ev.push({ type: kind, id: p.id, to: to ? to.id : null, power, speed: Math.hypot(vx, vy, vz) });
}

// A pass to q, led to where he's going. Long ones go in the air.
export function passTo(w, p, q, ev) {
  const d0 = Math.hypot(q.x - p.x, q.z - p.z), lead = clamp(d0 / 16, 0.2, 1.2);
  const tx = q.x + q.vx * lead, tz = q.z + q.vz * lead, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
  if (d > KICK.lobAt || laneBlocked(w, p, { x: tx, z: tz })) {
    const vh = clamp(10 + d * 0.32, 13, 24), T = d / vh;
    kickBall(w, p, dx / d * vh * 0.92, 9.81 * T / 2, dz / d * vh * 0.92, 'pass', ev, q, 0.7);
  } else {
    const v = clamp(Math.sqrt(KICK.arrive ** 2 + 2 * 4.5 * d), KICK.passMin, KICK.passMax);
    kickBall(w, p, dx / d * v, 0, dz / d * v, 'pass', ev, q, v / KICK.passMax);
  }
}

// Is anyone from the other side standing in the lane from p to the spot t?
export function laneBlocked(w, p, t) {
  const dx = t.x - p.x, dz = t.z - p.z, L = Math.hypot(dx, dz) || 1;
  return w.players.some(o => {
    if (o.team === p.team || !isUp(o)) return false;
    const k = ((o.x - p.x) * dx + (o.z - p.z) * dz) / (L * L);
    if (k < 0.08 || k > 0.95) return false;
    return Math.hypot(p.x + dx * k - o.x, p.z + dz * k - o.z) < 1.3;
  });
}

// The best man for p to pass to. aim: a direction to favour (your stick), or null (the AI's: forward and open).
export function bestPass(w, p, aim = null) {
  const dir = dirOf(w, p.team);
  let best = null, bs = -1e9;
  for (const q of w.players) {
    if (q === p || q.team !== p.team || !isUp(q)) continue;
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
    if (d < 4 || d > 48) continue;
    let s = -d * 0.05;
    const open = Math.min(...w.players.filter(o => o.team !== p.team && isUp(o)).map(o => Math.hypot(o.x - q.x, o.z - q.z)), 30);
    s += Math.min(open, 8) * 0.35;
    if (laneBlocked(w, p, q)) s -= 2.2;
    if (!aim && q.z * dir > offsideLine(w, p.team) + 0.05 && q.z * dir > 0) s -= 9;       // the AI doesn't play a man offside
    if (aim) { const al = (dx * aim.x + dz * aim.z) / (d * (Math.hypot(aim.x, aim.z) || 1)); s += al * 5; if (al < 0.2) s -= 6; }
    else s += (dz * dir) * 0.09;
    if (q.line === 'gk') s -= 4;
    if (s > bs) { bs = s; best = q; }
  }
  return best;
}

// Where a shot ends up on the goal line: power 0..1 (held past KICK.overHold: over the bar), aimX across the
// goal (-1..1, 0 the middle), end: the goal it's aimed at (-1 / 1; his side's by default). → { x, y, z, speed }
export function shotTarget(w, p, power, aimX, held = 0, end = dirOf(w, p.team)) {
  const tx = clamp(aimX, -1, 1) * (GOAL2.halfW - 0.45);
  let h = 0.35 + 1.5 * Math.pow(power, 1.6);
  if (held > KICK.overHold) h = 4 + (held - KICK.overHold) * 10;          // skied
  return { x: tx, y: h, z: end * w.L, speed: KICK.shot[0] + KICK.shot[1] * power };
}

// A shot at goal (the one his side attacks, or end). sup: a super shot (rules/brawl/chaos.js): flat, very
// hard, and it goes through people.
export function shoot(w, p, power, aimX, ev, held = 0, end = dirOf(w, p.team), sup = false) {
  const t = shotTarget(w, p, power, aimX, held, end), from = w.restart ? w.ball : p;
  if (sup) { t.speed = CHAOS.superSpeed; t.y = 0.5 + 1.2 * Math.abs(aimX % 1); }
  const dx = t.x - from.x, dz = t.z - from.z, d = Math.hypot(dx, dz) || 1, T = d / t.speed;
  const vy = (t.y - BALL2.r) / T + 9.81 * T / 2;
  kickBall(w, p, dx / d * t.speed, Math.min(vy, 14), dz / d * t.speed, 'shot', ev, null, power);
  if (sup) { w.super = { team: p.team, kick: w.lastKick, id: p.id }; ev.push({ type: 'super', id: p.id, team: p.team }); }
}

// How good a chance it is to shoot from where p is: 0 (no) to 1.
export function shotChance(w, p) {
  const dir = dirOf(w, p.team), gz = dir * w.L, d = Math.hypot(p.x, gz - p.z);
  const ang = Math.abs(Math.atan2(p.x, Math.abs(gz - p.z)));
  return clamp((1 - d / 34) * (1 - ang / 1.3), 0, 1);
}
