// Changing from one movement to another without a jump. When a pose source takes a player over at once (a
// recorded kick the moment you let go of the trigger: game/kickcap.js), the new pose is used from that frame
// on and what the body was doing is carried into it: the difference between where each part was heading and
// where the new movement has it is kept as an offset, with its speed, and eased away to nothing over the time
// given (a cubic that ends at zero, at rest). So a leg that was swinging keeps swinging and bends into the new
// path, and a leg already near the new path just follows it. ("Inertialization": D. Bollo, GDC 2018.)
//
// The legs are carried as their ankles (model space: metres, +z the way he faces) and the way the feet point,
// and bent to them again afterwards, so no boot goes under the grass; the hips as their place and turn; the
// rest as each bone's own turn. Call remember() at the end of every pose, ask for a change with inertialize()
// while posing (before the new source has posed him this frame), and settle() once the pose is complete.
import * as THREE from 'three';
import { ankleOf, footOf, aimFoot } from './legik.js';
import { nudgeLeg } from './kickcap.js';

const UPPER = ['spine', 'chest', 'neck', 'head', 'clavicleL', 'clavicleR', 'upperArmL', 'upperArmR', 'foreArmL', 'foreArmR', 'handL', 'handR', 'toeL', 'toeR'];
const NV = 3, NQ = 3 + UPPER.length;                      // vectors: hips, ankle L, ankle R; turns: hips, foot L, foot R, then UPPER
const SOLE = 0.085;
const v = new THREE.Vector3(), q = new THREE.Quaternion(), qi = new THREE.Quaternion(), pt = new THREE.Vector3();
const snap = () => ({ v: Array.from({ length: NV }, () => new THREE.Vector3()), q: Array.from({ length: NQ }, () => new THREE.Quaternion()), dt: 0, ok: false });

// the pose as it is now → s
function read(bn, s) {
  s.v[0].copy(bn.hips.position); ankleOf(bn, 'L', s.v[1]); ankleOf(bn, 'R', s.v[2]);
  s.q[0].copy(bn.hips.quaternion); footOf(bn, 'L', s.q[1]); footOf(bn, 'R', s.q[2]);
  UPPER.forEach((n, i) => s.q[3 + i].copy(bn[n].quaternion));
  return s;
}
// a turn as a vector (axis x angle, the short way round), and back
function toVec(a, out) {
  const w = Math.min(1, Math.abs(a.w)), s = Math.sqrt(1 - w * w), ang = 2 * Math.acos(w) * (a.w < 0 ? -1 : 1);
  return s < 1e-6 ? out.set(a.x, a.y, a.z).multiplyScalar(2 * (a.w < 0 ? -1 : 1)) : out.set(a.x, a.y, a.z).multiplyScalar(ang / s);
}
function fromVec(a, out) {
  const ang = a.length();
  if (ang < 1e-9) return out.set(0, 0, 0, 1);
  const s = Math.sin(ang / 2) / ang;
  return out.set(a.x * s, a.y * s, a.z * s, Math.cos(ang / 2));
}
// the lowest point of a boot's sole below its ankle when it points as f says (heel, ball of the foot, toe)
const under = f => Math.min(pt.set(0.05, -SOLE, -0.1).applyQuaternion(f).y, pt.set(-0.05, -SOLE, -0.1).applyQuaternion(f).y, pt.set(0.04, -SOLE, 0.2).applyQuaternion(f).y, pt.set(-0.04, -SOLE, 0.2).applyQuaternion(f).y);

const stateOf = m => m.inert || (m.inert = { a: snap(), b: snap(), now: snap(), x: Array.from({ length: NV + NQ }, () => new THREE.Vector3()), u: Array.from({ length: NV + NQ }, () => new THREE.Vector3()), t: 0, T: 0, phase: 0, ask: 0 });

// The pose he will have from this frame on comes from somewhere new: carry the old movement into it over T seconds.
export function inertialize(m, T) {
  const S = stateOf(m);
  if (S.a.ok && T > 0) S.ask = T;
}
// How much of an eased-away difference is left (1 → 0), for callers that want to know.
export const settling = m => (m.inert && m.inert.phase ? 1 - Math.min(1, m.inert.t / m.inert.T) : 0);

// The pose is complete: lay what is left of the old movement over it. dt: this frame's time step.
export function settle(m, bn, dt) {
  const S = stateOf(m);
  if (S.ask && dt > 0) {
    // where each part would have been this frame had it carried on (a: last frame, b: the one before), less where it is now
    const now = read(bn, S.now), a = S.a, b = S.b, k = b.ok && a.dt > 0 ? dt / a.dt : 0;
    for (let i = 0; i < NV; i++) { S.u[i].subVectors(a.v[i], b.v[i]).multiplyScalar(b.ok && a.dt > 0 ? 1 / a.dt : 0); S.x[i].copy(a.v[i]).addScaledVector(S.u[i], dt).sub(now.v[i]); }
    for (let i = 0; i < NQ; i++) {
      toVec(q.copy(a.q[i]).multiply(qi.copy(b.q[i]).invert()), S.u[NV + i]).multiplyScalar(k);            // how far it turned last frame, scaled to this one
      toVec(fromVec(S.u[NV + i], q).multiply(a.q[i]).multiply(qi.copy(now.q[i]).invert()), S.x[NV + i]);
      S.u[NV + i].multiplyScalar(1 / dt);
    }
    S.T = S.ask; S.ask = 0; S.t = 0; S.phase = 1; S.last = snap(); read(bn, S.last); S.ldt = dt;
  } else if (S.phase === 1 && dt > 0) {
    // the second frame: now the new movement's own speed is known, and the offset's speed is the old one less that
    const now = read(bn, S.now), L = S.last;
    for (let i = 0; i < NV; i++) S.u[i].sub(v.subVectors(now.v[i], L.v[i]).multiplyScalar(1 / dt));
    for (let i = 0; i < NQ; i++) S.u[NV + i].sub(toVec(q.copy(now.q[i]).multiply(qi.copy(L.q[i]).invert()), v).multiplyScalar(1 / dt));
    S.phase = 2; S.t += dt;
  } else if (S.phase) S.t += dt;
  if (!S.phase) return;
  const s = S.t / S.T;
  if (s >= 1) { S.phase = 0; return; }
  // x0 and its speed u0, eased to nothing at T: x0 (2s^3 - 3s^2 + 1) + u0 T (s^3 - 2s^2 + s)
  const h0 = 2 * s * s * s - 3 * s * s + 1, h1 = (s * s * s - 2 * s * s + s) * S.T * (S.phase === 2 ? 1 : 0);
  const off = i => v.copy(S.x[i]).multiplyScalar(h0).addScaledVector(S.u[i], h1);
  const now = read(bn, S.now);
  // the upper body: each bone turned on from where the new movement has it
  UPPER.forEach((n, i) => bn[n].quaternion.premultiply(fromVec(off(NV + 3 + i), q)));
  // hips, then both legs bent again to their ankles (the knees keep pointing as the new movement has them)
  bn.hips.position.add(off(0)); bn.hips.quaternion.premultiply(fromVec(off(NV), q));
  for (const [n, i] of [['L', 1], ['R', 2]]) {
    const f = fromVec(off(NV + i), q).multiply(now.q[i]);
    now.v[i].add(off(i)); now.v[i].y = Math.max(now.v[i].y, -under(f));
    nudgeLeg(bn, n, now.v[i]); aimFoot(bn, n, qi.copy(f));
  }
}

// The pose as it ended up this frame, for next frame's change (call last, every frame).
export function remember(m, bn, dt) {
  if (!(dt > 0)) return;
  const S = stateOf(m), t = S.b;
  S.b = S.a; S.a = read(bn, t); S.a.dt = dt; S.a.ok = true;
}
// Forget it all (a model put somewhere new: a replay's start, a restart).
export function forget(m) { m.inert = null; }
