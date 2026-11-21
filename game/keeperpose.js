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
import { keepAboveGrass } from './keeperhands.js';
import { startSave, poseSave } from './keepersave.js';
import { SET, stance, plantFeet, plantFromPose, toLocal, toWorldPt } from './keeperfeet.js';
import { BONES } from './mocap.js';

export { SET };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), mix = (a, b, k) => a + (b - a) * k;
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z), tmp = new THREE.Vector3(), tq = new THREE.Quaternion();

// Whether he's running (off his line for a loose ball): then he's posed as any runner is (game/actors.js).
export function keeperRuns(m, p) {
  const run = !m.sv && !p.holding && Math.hypot(p.vx, p.vz) > SET.run;
  if (run !== (m.kState === 'run')) blendFrom(m, run ? 0.2 : 0.25);
  if (run) { m.kState = 'run'; m.kf = null; m.kg = null; m.off = null; }
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
    blendFrom(m, m.sv.stand ? 0.12 : 0.06);
  } else if (p.holding && !m.wasHolding && !m.sv && ball) {
    // he gathers a loose ball: a quick scoop from where it is
    placeRoot(m, p, 0);
    if (!m.kf) plantFeet(m);
    m.sv = startSave(m, { save: { id: 'claim', kind: 'catch', y: ball.y, eta: 0.12 }, dive: 0 }, null, m.root);
    m.sv.c = toLocal(m, ball, V(0, 0, 0)); m.sv.c.y = Math.max(0.13, m.sv.c.y); m.sv.c.z = Math.max(0.3, m.sv.c.z); m.sv.reach = m.sv.c; m.sv.mode = 'scoop'; m.sv.T = 0.16;
    blendFrom(m, 0.15);
  } else if (!!p.holding !== !!m.wasHolding && !m.sv) blendFrom(m, 0.25);     // the ball leaves his hands
  m.wasHolding = !!p.holding;
  if (m.sv) {
    m.root.position.copy(m.sv.O); m.root.rotation.y = m.sv.Y;
    if (poseSave(m, p, dt, ball)) { finish(m, 'save', dt, p); return; }
    // done: he carries on from where it left him (his feet where they are), back toward his spot, stepping
    m.root.updateMatrixWorld(true);
    const hw = bn.hips.getWorldPosition(V(0, 0, 0));
    plantFromPose(m);
    m.off = V(hw.x - p.x, 0, hw.z - p.z); m.offV = 0; m.yawOff = m.sv.Y - Math.atan2(p.fx, p.fz);
    m.yawOff -= Math.round(m.yawOff / (Math.PI * 2)) * Math.PI * 2;
    m.sv = null;
    blendFrom(m, 0.3);
    restPose(bn);
  }
  placeRoot(m, p, dt);
  stance(m, p, dt, t, ball);
  finish(m, p.holding ? 'hold' : 'set', dt, p);
}

// His root: the sim's spot, plus what is left of the way back from a save (a walk that starts and stops gently,
// SET.recover at most), turned to the ball.
function placeRoot(m, p, dt) {
  if (m.off && dt > 0) {
    const l = Math.hypot(m.off.x, m.off.z), want = Math.min(SET.recover, l * 5 + 0.05);
    m.offV = Math.min(want, (m.offV || 0) + 7 * dt);
    const k = l > 1e-4 ? Math.max(0, l - m.offV * dt) / l : 0;
    m.off.multiplyScalar(k); if (l * k < 0.004) m.off = null;
  }
  if (m.yawOff) { m.yawOff *= Math.exp(-dt * 5); if (Math.abs(m.yawOff) < 1e-3) m.yawOff = 0; }
  m.root.position.set(p.x + (m.off ? m.off.x : 0), 0, p.z + (m.off ? m.off.z : 0));
  m.root.rotation.y = Math.atan2(p.fx, p.fz) + (m.yawOff || 0);
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
