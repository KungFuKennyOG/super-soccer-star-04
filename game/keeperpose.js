// The goalkeeper's body (Nov 2026 rebuild, on goalkeeping coaching and a capture: docs/notes-keeper-anim.md).
// The sim says what he's doing (p.save { y, kind, id, eta } when he goes for a shot, p.dive -1 / 0 / 1 for which
// way, p.holding); this poses it, on the PS1 body and the '04 body alike (the same skeleton).
//
//   set          feet a little wider than his shoulders, weight forward on the balls of the feet (heels just up),
//                knees bent, trunk leaned so his nose is over his toes, hands out in front at waist height, palms
//                to the ball, elbows narrow; taller and looser while the ball is far away
//   shuffle      his feet grip the grass: each is planted where it lands (world space) and steps when the body has
//                left it behind, the lead foot first, never crossing; low, short, quick steps
//   split step   as a shot is struck: a small hop, landing wider and lower on the balls of his feet (m.split)
//   saves        game/keepersave.js: dives and standing saves, and up off the grass afterwards
//   holding      the ball held to his chest, a palm either side of it
//   running      off his line flat out for a loose ball he runs like anyone else (keeperRuns: game/actors.js)
// Springs for weight (game/sway.js) work on him as on the others. Nothing goes under the grass (keepAboveGrass).
import * as THREE from 'three';
import { restPose } from './body.js';
import { reachLeg, aimFoot } from './legik.js';
import { sway } from './sway.js';
import { placeHands, lookAt, keepAboveGrass, grip, ankleFor } from './keeperhands.js';
import { startSave, poseSave, chestPoint } from './keepersave.js';
import { BONES } from './mocap.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), mix = (a, b, k) => a + (b - a) * k;
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export const SET = {
  hips: 0.8, hipsFar: 0.9, pitch: 0.3, width: 0.46, ahead: 0.05, heel: 0.12, toeOut: 0.14,   // the set position (m, rad)
  hands: [0.2, 0.15, 0.36],                                                                // palms: out, above the hips, ahead (m)
  step: { thr: 0.07, still: 0.11, time: [0.22, 0.17], lift: 0.05, gap: 0.27, rise: 0.05 },   // (lift, gap, rise and the quick time: measured from a recorded defensive slide, see the notes)                        // when a foot steps, how quick (slow, fast), how high
  split: { hop: 0.07, land: 0.17, up: 0.03, wide: 0.08, sink: 0.04 },                       // s, s, m, m, m
  recover: 1.8, run: 4.2,                                                                  // m/s back to his spot after a save; faster than this he runs
};
const V = (x, y, z) => new THREE.Vector3(x, y, z), tmp = new THREE.Vector3(), tq = new THREE.Quaternion(), te = new THREE.Euler();

// Whether he's running (off his line for a loose ball): then he's posed as any runner is (game/actors.js).
export function keeperRuns(m, p) {
  const run = !m.sv && !p.holding && Math.hypot(p.vx, p.vz) > SET.run;
  if (run !== (m.kState === 'run')) blendFrom(m, run ? 0.2 : 0.25);
  if (run) { m.kState = 'run'; m.kf = null; m.off = null; }
  return run;
}

// ball: the sim ball. Call instead of the outfield animation (after placeModel).
export function animateKeeper(m, p, dt, t, ball) {
  const bn = m.bone;
  restPose(bn);
  if (m.bigHead) bn.head.scale.setScalar(1.65);
  // a new save attempt: latch it so the move plays out even after the sim has moved on
  if (p.save && !m.sv && p.save.id !== m.saveId) {
    placeRoot(m, p, 0);
    if (!m.kf) plantFeet(m);
    m.saveId = p.save.id;
    m.sv = startSave(m, p, ball, m.root);
    blendFrom(m, 0.06);
  } else if (p.holding && !m.wasHolding && !m.sv && ball) {
    // he gathers a loose ball: a quick scoop from where it is
    placeRoot(m, p, 0);
    if (!m.kf) plantFeet(m);
    m.sv = startSave(m, { save: { id: 'claim', kind: 'catch', y: ball.y, eta: 0.12 }, dive: 0 }, null, m.root);
    m.sv.c = toLocal(m, ball, V(0, 0, 0)); m.sv.c.y = Math.max(0.13, m.sv.c.y); m.sv.reach = m.sv.c; m.sv.grip = 'scoop'; m.sv.T = 0.16;
    blendFrom(m, 0.15);
  }
  m.wasHolding = !!p.holding;
  if (m.sv) {
    m.root.position.copy(m.sv.O); m.root.rotation.y = m.sv.Y;
    if (poseSave(m, p, dt, ball)) { finish(m, 'save', dt, p); return; }
    // done: from where he's got to back toward his spot, stepping
    m.root.updateMatrixWorld(true);
    const hw = bn.hips.getWorldPosition(V(0, 0, 0));
    m.off = V(hw.x - p.x, 0, hw.z - p.z); m.yawOff = m.sv.Y - Math.atan2(p.fx, p.fz);
    m.yawOff -= Math.round(m.yawOff / (Math.PI * 2)) * Math.PI * 2;
    m.sv = null; m.kf = null;
    blendFrom(m, 0.3);
    restPose(bn);
  }
  stance(m, p, dt, t, ball);
  finish(m, p.holding ? 'hold' : 'set', dt, p);
}

// His root: the sim's spot, plus what is left of the way back from a save, turned to the ball.
function placeRoot(m, p, dt) {
  if (m.off) {
    const l = Math.hypot(m.off.x, m.off.z), k = l > 1e-4 ? Math.max(0, l - SET.recover * dt) / l : 0;
    m.off.multiplyScalar(k); if (l * k < 0.01) m.off = null;
  }
  if (m.yawOff) { m.yawOff *= Math.exp(-dt * 5); if (Math.abs(m.yawOff) < 1e-3) m.yawOff = 0; }
  m.root.position.set(p.x + (m.off ? m.off.x : 0), 0, p.z + (m.off ? m.off.z : 0));
  m.root.rotation.y = Math.atan2(p.fx, p.fz) + (m.yawOff || 0);
}
const toLocal = (m, w, out) => { m.root.updateMatrixWorld(true); return m.root.worldToLocal(out.set(w.x, w.y, w.z)); };
const toWorldPt = (m, v, out) => { m.root.updateMatrixWorld(true); return m.root.localToWorld(out.copy(v)); };
// feet where the set position puts them, planted (world)
function plantFeet(m) {
  m.kf = {};
  for (const [n, sd] of [['L', 1], ['R', -1]]) m.kf[n] = { p: toWorldPt(m, V(sd * SET.width / 2, 0, SET.ahead), V(0, 0, 0)), air: null };
}

/* ---------- the set position and the shuffle ---------- */

function stance(m, p, dt, t, ball) {
  const bn = m.bone;
  placeRoot(m, p, dt);
  if (!m.kf) plantFeet(m);
  const far = ball ? clamp((Math.hypot(ball.x - p.x, ball.z - p.z) - 18) / 10, 0, 1) : 0, hold = p.holding ? 1 : 0;
  const v = V(p.vx, 0, p.vz), sp = v.length();
  // split step: up off the grass a little, down wider and lower
  let up = 0, wide = 0, sink = 0;
  if (m.split !== undefined && m.split < SET.split.land + 0.25) {
    m.split += dt;
    const S = SET.split, a = m.split;
    up = a < S.hop ? Math.sin(Math.PI * a / S.hop) * S.up : 0;
    wide = ease((a - S.hop * 0.5) / (S.land - S.hop * 0.5)) * S.wide * (1 - ease((a - 0.5) / 0.4));
    sink = Math.sin(Math.PI * clamp((a - S.hop) / (S.land + 0.2 - S.hop), 0, 1)) * S.sink;
    if (a >= S.hop && a - dt < S.hop) for (const n of ['L', 'R']) m.kf[n].air = null;     // he lands: replanted below
  }
  // the feet: each stays where it is planted until the body has left it behind, then steps (the lead foot first)
  const width = mix(SET.width, 0.3, hold) + wide, home = {}, lead = sp > 0.3 ? Math.sign(toLocal(m, { x: p.x + v.x, y: 0, z: p.z + v.z }, tmp).x - toLocal(m, { x: p.x, y: 0, z: p.z }, V(0, 0, 0)).x) : 0;
  for (const [n, sd] of [['L', 1], ['R', -1]]) home[n] = toWorldPt(m, V(sd * width / 2, 0, SET.ahead), V(0, 0, 0));
  const S = SET.step, T = mix(S.time[0], S.time[1], clamp(sp / 3, 0, 1));
  const busy = m.kf.L.air || m.kf.R.air;
  if (!busy || sp > 2.4) {
    let pick = null, worst = sp > 0.2 ? S.thr : S.still;
    for (const [n, sd] of [['L', 1], ['R', -1]]) {
      const f = m.kf[n]; if (f.air) continue;
      const e = f.p.distanceTo(tmp.copy(home[n]).addScaledVector(v, T * 0.5)) + (sd === lead ? 0.03 : 0);
      if (e > worst) { worst = e; pick = n; }
    }
    if (pick) { const f = m.kf[pick]; f.air = { from: f.p.clone(), t: 0, T }; m.phase = (m.phase || 0) + Math.PI; }
  }
  const at = {};
  for (const n of ['L', 'R']) {
    const f = m.kf[n];
    let lift = 0;
    if (f.air) {
      f.air.t += dt;
      const u = Math.min(1, f.air.t / f.air.T), to = tmp.copy(home[n]).addScaledVector(v, (f.air.T - f.air.t) * 0.5 + 0.04);
      f.p.copy(f.air.from).lerp(to, ease(u)); lift = Math.sin(Math.PI * u) * (S.lift + 0.02 * Math.min(sp, 3));
      if (u >= 1) f.air = null;
    }
    if (up) lift += up;
    at[n] = toLocal(m, f.p, V(0, 0, 0));
    // feet never cross: the left stays on his left
    if (n === 'R' && at.R.x > at.L.x - S.gap) at.R.x = at.L.x - S.gap;
    at[n].y = ankleFor(lift > 0.015 ? 0.35 : SET.heel * (1 - hold)) + lift;
  }
  // hips: low in the set, riding up a little as he pushes across (the recorded slide rises 10 cm and more between its stops), up and loose when the ball is far; never higher than the legs reach
  const H = mix(mix(SET.hips, SET.hipsFar, far), 0.9, hold) - sink + Math.min(S.rise, sp * 0.022) + up + 0.005 * Math.sin(t * 2.3 + (m.phase || 0) * 0.1);
  const mid = at.L.clone().add(at.R).multiplyScalar(0.5);
  bn.hips.position.set(mid.x * 0.6, H, mid.z * 0.4 - 0.03);
  const reach = 0.86;
  for (const [n, sd] of [['L', 1], ['R', -1]]) {
    const dx = at[n].x - (bn.hips.position.x + sd * 0.09), dz = at[n].z - bn.hips.position.z, dh = Math.hypot(dx, dz);
    bn.hips.position.y = Math.min(bn.hips.position.y, at[n].y + 0.02 + Math.sqrt(Math.max(0.01, reach * reach - dh * dh)));
  }
  const weight = clamp((at.L.y - at.R.y) * 4, -1, 1);                  // over the planted foot
  bn.hips.rotation.set(mix(SET.pitch, 0.08, hold) * mix(1, 0.55, far), 0, -weight * 0.05);
  bn.spine.rotation.set(mix(0.1, 0.02, hold), 0, weight * 0.04); bn.chest.rotation.set(0.05, 0, 0);
  for (const [n, sd] of [['L', 1], ['R', -1]]) {
    reachLeg(bn, n, at[n]);
    aimFoot(bn, n, tq.setFromEuler(te.set(m.kf[n].air || up > 0.015 ? 0.35 : SET.heel * (1 - hold), sd * SET.toeOut, 0)));
  }
  // weight: springs on the trunk and arms (before the hands are put where they go)
  sway(m, bn, p, dt, { mv: 0.6, run: 0 });
  if (hold) {
    // the ball held to his chest
    const b = chestPoint(bn, V(0, 0, 0)); b.y -= 0.04;
    placeHands(bn, grip('sides', b, 1), 1, 1, 0.2);
    m.held = b;
    lookAt(bn, V(0, 1.6, 12), 0.6);
    return;
  }
  m.held = null;
  // hands out in front at waist height, palms to the ball, a little alive; lower and looser when it's far away
  const tb = ball ? toLocal(m, ball, V(0, 0, 0)) : V(0, 1, 10), g = {};
  for (const [n, sd] of [['L', 1], ['R', -1]]) {
    const palm = V(sd * mix(SET.hands[0], 0.22, far), SET.hands[1] - 0.1 * far + 0.01 * Math.sin(t * 3.1 + sd), mix(SET.hands[2], 0.22, far)).applyQuaternion(bn.hips.quaternion).add(bn.hips.position);
    const N = tb.clone().sub(palm).normalize().negate().lerp(V(-sd, 0, 0.2), far * 0.7).normalize().negate();
    g[n] = { palm, N, F: V(sd * 0.2, 1, 0.3).normalize() };
  }
  placeHands(bn, g, 1, 1, 0.5);
  lookAt(bn, tb, 0.9);
}

/* ---------- moving from one thing to the next without a pop ---------- */

const NB = BONES.length;
function blendFrom(m, T) { if (m.kLast) m.kBlend = { from: m.kLast.slice(), t: 0, T }; }
function finish(m, state, dt, p) {
  const bn = m.bone;
  m.kState = state;
  applyBlend(m, dt);
  const up = keepAboveGrass(m, !!(m.sv && m.sv.ground), m.held);
  if (m.held) m.held.y += up;                                          // the ball goes with his hands
  remember(m);
  // his shadow goes where his body is
  const h = bn.hips.getWorldPosition(tmp);
  if (m.shadow) m.shadow.position.set(h.x + (m.shadow.position.x - p.x), m.shadow.position.y, h.z + (m.shadow.position.z - p.z));
  m.heldW = m.held ? toWorldPt(m, m.held, m.heldW || V(0, 0, 0)) : null;
}
function applyBlend(m, dt) {
  const bn = m.bone;
  if (m.kBlend) {
    const b = m.kBlend, k = ease((b.t += dt) / b.T);
    for (let i = 0; i < NB; i++) { tq.fromArray(b.from, i * 4); bn[BONES[i]].quaternion.slerp(tq, 1 - k); }   // (from the old pose toward this one)
    const hp = bn.hips.position; hp.set(mix(b.from[NB * 4], hp.x, k), mix(b.from[NB * 4 + 1], hp.y, k), mix(b.from[NB * 4 + 2], hp.z, k));
    if (b.t >= b.T) m.kBlend = null;
  }
}
function remember(m) {
  const bn = m.bone, last = m.kLast ??= new Float32Array(NB * 4 + 3);
  for (let i = 0; i < NB; i++) bn[BONES[i]].quaternion.toArray(last, i * 4);
  last[NB * 4] = bn.hips.position.x; last[NB * 4 + 1] = bn.hips.position.y; last[NB * 4 + 2] = bn.hips.position.z;
}

// Where a ball he has hold of is drawn (world, into out): where the pose put it between his gloves; null if he
// isn't holding one. For game/main.js holdInGloves and the look page.
export function heldBall(m, out) {
  if (!m.heldW) return null;
  return out.copy(m.heldW);
}
// called by game/actors.js after a running keeper is posed, so the next change blends from it
export function keeperRan(m, dt) {
  applyBlend(m, dt); remember(m);
  m.held = m.heldW = null;
}
