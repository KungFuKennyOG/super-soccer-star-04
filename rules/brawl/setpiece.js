// Set pieces: throw-ins, corners, goal kicks, free kicks and penalties. Pure.
// The ball is put on its spot, a taker walks over to it, waits (the AI a moment, you until you press), then
// runs up and strikes it (a throw-in: picks it up, takes it back over his head and throws). Everyone else
// takes up their place: ten yards off for a free kick or a corner (a wall in front of goal), outside the box
// for a penalty, into the box for a corner.
//   w.sp = { kind, team, x, z, taker, stage: 'walk' | 'ready' | 'runup' | 'throw' | 'flight', t, plan, end, so }
import { TAKE, KICK, GOAL2 } from './tuning.js';
import { dirOf, ownLine, other, shapeSpot } from './world.js';
import { passTo, bestPass, shoot, shotTarget, kickBall, laneBlocked } from './kicks.js';
import { isUp } from './hits.js';
import { toward } from './ai.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Which goal a set piece by `team` is aimed at (penalties in a shoot-out all go at one end).
const goalOf = (w, sp) => sp.end ?? dirOf(w, sp.team);

// Start a set piece. spot: { x, z }. opts: { taker: id, end, so }.
export function startSetPiece(w, kind, team, spot, ev, opts = {}) {
  const b = w.ball;
  Object.assign(b, { x: spot.x, z: spot.z, y: 0.12, vx: 0, vy: 0, vz: 0, inNet: 0 });
  w.owner = null; w.pass = null; w.offside = null; w.charge = 0;
  for (const p of w.players) { p.lunge = null; p.holding = false; p.throwing = false; p.save = null; p.dive = 0; }
  const sp = { kind, team, x: spot.x, z: spot.z, stage: 'walk', t: 0, plan: null, end: opts.end, so: !!opts.so };
  sp.taker = opts.taker || chooseTaker(w, kind, team, spot);
  sp.wall = kind === 'free' ? wallFor(w, sp) : [];
  w.sp = sp;
  if (!sp.so) w.phase = 'setpiece';
  ev.push({ type: 'setpiece', kind, team, taker: sp.taker, x: spot.x, z: spot.z });
  return sp;
}

function chooseTaker(w, kind, team, spot) {
  const men = w.players.filter(p => p.team === team && isUp(p));
  if (kind === 'goalkick') return (men.find(p => p.line === 'gk') || men[0]).id;
  const out = men.filter(p => p.line !== 'gk');
  if (kind === 'penalty') return (out.find(p => p.line === 'fwd') || out.find(p => p.line === 'mid') || out[0]).id;
  out.sort((a, b) => dist(a, spot) - dist(b, spot));
  return (out[0] || men[0]).id;
}

// The way the taker faces as he strikes it: at goal (penalty, free kick near goal), into the box (corner),
// infield (throw-in), upfield (goal kick, other free kicks).
function aimDir(w, sp) {
  const g = goalOf(w, sp), gz = g * w.L;
  let tx, tz;
  if (sp.kind === 'penalty' || (sp.kind === 'free' && Math.abs(gz - sp.z) < TAKE.wallFrom)) { tx = 0; tz = gz; }
  else if (sp.kind === 'corner') { tx = 0; tz = g * (w.L - 11); }
  else if (sp.kind === 'throw') { tx = 0; tz = sp.z + g * 6; }
  else { tx = sp.x * 0.5; tz = sp.z + g * 20; }
  const dx = tx - sp.x, dz = tz - sp.z, l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}

// Where the taker waits: on the line for a throw-in, otherwise his run-up behind the ball.
export function standSpot(w, sp) {
  if (sp.kind === 'throw') return { x: sp.x + Math.sign(sp.x) * 0.25, z: sp.z };
  const d = aimDir(w, sp), back = TAKE.runup[sp.kind] || 2;
  return { x: sp.x - d.x * back, z: sp.z - d.z * back };
}

// A wall: the defending side's nearest outfield men in a line 9.15 m from the ball toward goal.
function wallFor(w, sp) {
  const g = goalOf(w, sp), gz = g * w.L;
  if (Math.abs(gz - sp.z) > TAKE.wallFrom || Math.abs(sp.x) > 24) return [];
  const def = w.players.filter(p => p.team !== sp.team && isUp(p) && p.line !== 'gk').sort((a, b) => dist(a, sp) - dist(b, sp));
  return def.slice(0, TAKE.wall[w.n] || 3).map(p => p.id);
}

// Where everyone but the taker stands for a set piece (or null: their usual place in the shape).
export function setPieceSpot(w, p) {
  const sp = w.sp;
  if (!sp || p.id === sp.taker) return null;
  const g = goalOf(w, sp), gz = g * w.L, ball = { x: sp.x, z: sp.z };
  if (sp.kind === 'penalty') {
    if (p.line === 'gk' && p.team !== sp.team) return { x: 0, z: gz - g * 0.1 };
    // round the edge of the box, either side, nobody inside it
    const i = p.slot, side = i % 2 ? 1 : -1, z = gz - g * (17.5 + (i % 3) * 1.5);
    return { x: side * (4 + (i % 5) * 3), z };
  }
  if (p.line === 'gk') return null;
  const wi = sp.wall.indexOf(p.id);
  if (wi >= 0) {
    // shoulder to shoulder, 9.15 m out, covering the near post side of the goal
    const dx = 0 - sp.x, dz = gz - sp.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    const off = (wi - (sp.wall.length - 1) / 2) * 0.62 + (sp.x > 0 ? -0.4 : 0.4);
    return { x: sp.x + ux * TAKE.gap - uz * off, z: sp.z + uz * TAKE.gap + ux * off };
  }
  let s = shapeSpot(w, p);
  if (sp.kind === 'corner') {
    // the attackers' biggest men into the box; the defenders mark the six-yard box and the penalty spot
    const att = p.team === sp.team, k = p.slot % 5;
    if (att && p.line !== 'def') s = { x: (k - 2) * 3.2, z: gz - g * (6 + (k % 3) * 3.5) };
    else if (!att && p.line !== 'fwd') s = { x: (k - 2) * 2.6, z: gz - g * (3 + (k % 2) * 4) };
  }
  // ten yards from the ball for the side not taking it
  if (p.team !== sp.team && dist(s, ball) < TAKE.gap) {
    const dx = s.x - ball.x, dz = s.z - ball.z, l = Math.hypot(dx, dz) || 1;
    s = { x: ball.x + dx / l * TAKE.gap, z: ball.z + dz / l * TAKE.gap };
  }
  return s;
}

// One step of the set piece: moves the taker (sp.want), decides, takes. input: yours (the home side's
// set pieces are yours unless input.auto).
export function stepSetPiece(w, dt, input, ev, rnd = Math.random) {
  const sp = w.sp, p = w.byId[sp.taker];
  sp.t += dt;
  if (!p || !isUp(p)) { sp.taker = chooseTaker(w, sp.kind, sp.team, sp); sp.stage = 'walk'; return; }
  const yours = sp.team === 'home' && !input.auto && sp.kind !== 'goalkick';
  if (yours) w.ctrl = p.id;
  const d = aimDir(w, sp);
  if (sp.stage === 'walk') {
    const s = standSpot(w, sp);
    sp.want = toward(p, s, 6, false);
    if (dist(p, s) < TAKE.reach || sp.t > TAKE.walkMax) {
      p.x = s.x; p.z = s.z; p.vx = p.vz = 0; sp.want = { x: 0, z: 0 };
      sp.stage = 'ready'; sp.readyT = 0; sp.wait = sp.kind === 'penalty' ? TAKE.penWait : TAKE.aiWait[0] + rnd() * (TAKE.aiWait[1] - TAKE.aiWait[0]);
      if (sp.kind === 'throw') { p.throwing = true; p.throwT = 0; w.owner = p.id; }
      ev.push({ type: 'ready', kind: sp.kind, id: p.id });
    }
    return;
  }
  p.fx = d.x; p.fz = d.z;
  if (sp.stage === 'ready') {
    sp.readyT += dt; sp.want = { x: 0, z: 0 };
    if (sp.kind === 'throw') p.throwT = (p.throwT || 0) + dt;
    if (yours && sp.readyT < TAKE.humanWait) humanPlan(w, sp, p, input, dt);
    else if (sp.readyT > (yours ? TAKE.humanWait : sp.wait)) sp.plan = aiPlan(w, sp, p, rnd);
    if (sp.plan) { sp.stage = sp.kind === 'throw' ? 'throw' : 'runup'; sp.rt = 0; ev.push({ type: 'taking', kind: sp.kind, id: p.id }); }
    return;
  }
  if (sp.stage === 'throw') {
    sp.rt += dt; p.throwT += dt; sp.want = { x: 0, z: 0 };
    if (sp.rt >= TAKE.throwRelease) take(w, sp, p, ev, rnd, input);
    return;
  }
  if (sp.stage === 'runup') {
    sp.rt += dt;
    const at = { x: sp.x - d.x * 0.35, z: sp.z - d.z * 0.35 };
    sp.want = toward(p, at, TAKE.runSpeed, false);
    if (dist(p, at) < 0.3 || sp.rt > 1.4) take(w, sp, p, ev, rnd, input);
  }
}

// Your set piece: the stick aims, pass plays it to the man the stick points at (a throw-in, a cross from a
// corner), shoot charges while held and shoots on release (free kicks and penalties; from a corner, a
// driven ball across the box).
function humanPlan(w, sp, p, it, dt) {
  const mv = it.move || { x: 0, z: 0 }, m = Math.hypot(mv.x, mv.z);
  if (it.pass && sp.kind !== 'penalty') {
    const aim = m > 0.2 ? { x: mv.x, z: mv.z } : aimDir(w, sp);
    const q = bestPass(w, p, aim);
    sp.plan = q ? { type: 'pass', to: q.id } : { type: 'clear' };
  }
  if (it.shoot && sp.kind !== 'throw') w.charge = (w.charge || 0) + dt;
  else if (w.charge) {
    const held = w.charge; w.charge = 0;
    sp.plan = { type: 'shot', power: Math.min(1, held / KICK.maxHold), aimX: mv.x * 1.3, held };
  }
}

// The AI's set piece.
function aiPlan(w, sp, p, rnd) {
  const g = goalOf(w, sp), gz = g * w.L;
  if (sp.kind === 'penalty') {
    const side = rnd() < 0.5 ? -1 : 1;
    return { type: 'shot', power: 0.55 + rnd() * 0.4, aimX: side * (0.45 + rnd() * 0.5), held: 0 };
  }
  if (sp.kind === 'free' && Math.abs(gz - sp.z) < 27 && Math.abs(sp.x) < 18 && rnd() < 0.65) {
    return { type: 'shot', power: 0.6 + rnd() * 0.35, aimX: (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.4), held: 0 };
  }
  if (sp.kind === 'corner' || (sp.kind === 'free' && Math.abs(gz - sp.z) < 40 && rnd() < 0.5)) {
    // into the box: the best-placed man in it, or the penalty spot
    const box = w.players.filter(q => q.team === sp.team && isUp(q) && q !== p && Math.abs(q.x) < 16 && Math.abs(gz - q.z) < 16);
    const q = box[Math.floor(rnd() * box.length)];
    return q ? { type: 'cross', x: q.x, z: q.z, to: q.id } : { type: 'cross', x: (rnd() - 0.5) * 8, z: gz - g * 9 };
  }
  if (sp.kind === 'goalkick' && rnd() < 0.5) return { type: 'clear' };
  const q = bestPass(w, p);
  return q ? { type: 'pass', to: q.id } : { type: 'clear' };
}

// Strike (or throw) it.
function take(w, sp, p, ev, rnd, input) {
  const b = w.ball, plan = sp.plan, g = goalOf(w, sp);
  w.restart = sp.kind;
  if (sp.kind === 'throw') {
    // from over his head, both hands: a lob to his man's feet
    b.x = p.x + p.fx * 0.15; b.z = p.z + p.fz * 0.15; b.y = 2.2;
    const q = plan.to && w.byId[plan.to], t = q ? { x: q.x + q.vx * 0.5, z: q.z + q.vz * 0.5 } : { x: b.x + p.fx * 10, z: b.z + p.fz * 10 };
    const dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz) || 1, v = clamp(d * 0.75 + 5, 8, 15), T = d / v;
    kickBall(w, p, dx / d * v, (0.3 - 2.2) / T + 9.81 * T / 2, dz / d * v, 'throw', ev, q || null, 0.4);
    w.pass = q ? { to: q.id, from: p.id, t: 0 } : null;
  } else if (plan.type === 'shot') {
    if (sp.kind === 'penalty') penaltyKeeper(w, sp, p, plan, input, rnd);
    shoot(w, p, plan.power, plan.aimX, ev, plan.held, g);
    if (sp.kind === 'penalty') { const gk = keeperFacing(w, sp); if (gk && gk.save) gk.save.id = w.lastKick; }
  } else if (plan.type === 'cross') {
    const dx = plan.x - b.x, dz = plan.z - b.z, d = Math.hypot(dx, dz) || 1, vh = clamp(12 + d * 0.25, 14, 22), T = d / vh;
    kickBall(w, p, dx / d * vh, 9.81 * T / 2 + 0.6, dz / d * vh, 'pass', ev, plan.to ? w.byId[plan.to] : null, 0.7);
  } else if (plan.type === 'pass' && w.byId[plan.to]) passTo(w, p, w.byId[plan.to], ev);
  else {
    const vy = 12, vh = (w.L * 0.8) / (2 * vy / 9.81);
    kickBall(w, p, (rnd() - 0.5) * 6, vy, g * vh, 'clear', ev, null, 0.9);
  }
  w.restart = null;
  ev.push({ type: 'taken', kind: sp.kind, id: p.id });
  if (sp.so) { sp.stage = 'flight'; sp.ft = 0; return; }
  w.sp = null; w.phase = 'play';
}

const keeperFacing = (w, sp) => w.players.find(q => q.team !== sp.team && q.line === 'gk' && isUp(q));

// A penalty: the keeper picks his side as it's struck (yours, with the stick, when it's against you), and
// whether he keeps it out is settled now: right way, not in the very corner, not too hard.
function penaltyKeeper(w, sp, p, plan, input, rnd) {
  const gk = keeperFacing(w, sp);
  if (!gk) return;
  const g = goalOf(w, sp), t = shotTarget(w, p, plan.power, plan.aimX, plan.held, g);
  const mx = input && input.move ? input.move.x : 0;
  const side = gk.team === 'home' && !(input && input.auto)
    ? (Math.abs(mx) > 0.3 ? Math.sign(mx) : 0)
    : (() => { const r = rnd(); return r < 0.42 ? -1 : r < 0.84 ? 1 : 0; })();
  const right = side === 0 ? Math.abs(t.x) < 1.1 : Math.sign(t.x) === side && Math.abs(t.x) > 0.6;
  const onTarget = Math.abs(t.x) < GOAL2.halfW && t.y < GOAL2.h;
  const odds = right ? clamp(0.92 - plan.power * 0.3 - (Math.abs(t.x) > 2.8 ? 0.35 : 0) - (t.y > 1.8 ? 0.2 : 0), 0.1, 0.85) : 0;
  const ok = onTarget && rnd() < odds;
  gk.save = { id: -1, kind: ok ? (plan.power < 0.6 ? 'catch' : 'parry') : 'beaten', y: Math.min(t.y, 2.2), eta: 0.45, ok, x: side * 2.4, pen: true };
  gk.dive = side;
  sp.pen = { side, ok, onTarget };
}

// Out of play over a touchline or a goal line: a throw-in, a corner or a goal kick for the other side.
// e: the ball's 'out' event; against: the side that touched it last.
export function outOfPlay(w, e, ev) {
  const against = w.lastTeam || 'home', to = other(against);
  if (e.where === 'side') return startSetPiece(w, 'throw', to, { x: Math.sign(e.x) * w.W, z: clamp(e.z, -w.L + 1, w.L - 1) }, ev);
  const defending = ownLine(w, 'home') * e.end > 0 ? 'home' : 'away';
  if (against === defending) return startSetPiece(w, 'corner', to, { x: Math.sign(e.x || 1) * (w.W - 0.6), z: e.end * (w.L - 0.6) }, ev);
  return startSetPiece(w, 'goalkick', defending, { x: Math.sign(e.x || 1) * 5, z: e.end * (w.L - 5.5) }, ev);
}

// Whether a man of the side not taking it is still too close (the AI keeps away; this is for tests).
export const tooClose = (w, p) => !!w.sp && p.team !== w.sp.team && w.sp.kind !== 'penalty' && dist(p, w.sp) < TAKE.gap - 0.5;
export const laneOpen = (w, p, t) => !laneBlocked(w, p, t);
