// Shaping to shoot. While you hold the trigger the sim only knows a shot is charging (intent.charging); the
// strike comes six frames after you let go (STRIKE in rules/tuning.js), which is the length of a real downswing
// and no more. So what a player does before that, he does here while the charge builds, in proportion to it and
// without stopping his run, because the trigger may be held for a second or let go at once:
//
//   above the hips   he is drawn toward the top of the recorded kick's backswing (game/kickcap.js, the same take
//                    the strike will play): the arm opposite the kicking leg out and forward, the kicking side's
//                    shoulder back, the trunk a little more upright. His run's own arm swing goes on underneath.
//   the pelvis       opens a little toward the kicking side, as the recording's does, over feet that stay put
//   the kicking leg  when it trails, its heel comes up nearer the seat than a runner's (hip extended, knee
//                    flexed: where a kick's backswing has it), so a release then finds it at the top of one
//
// On release the recorded downswing takes over from wherever that left him (game/inertia.js carries it in).
// The pass ring is the same thing, smaller, and only near the moment the ring closes on the circle.
// m.charge = { kind: 'shot' | 'pass', t: seconds held } while a hold is on (game/main.js sets it for you; a
// replay plays it back), null otherwise. Right-footed, like everything here (game/actors.js mirrors).
import * as THREE from 'three';
import { SHOT, PASS } from '../rules/tuning.js';
import { CLIPS, applyPose } from './mocap.js';
import { sampleKick } from './kickcap.js';
import { ankleOf, footOf, reachLeg, aimFoot } from './legik.js';

const smooth = x => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
// rise, fall: how fast he shapes up and lets it go (1/s); least: how much of it a bare touch of the trigger is;
// body: how far toward the backswing's top the trunk and arms go at full charge; open: how much of the
// recording's pelvis turn he takes while still running; heel, tuck: the trailing leg's extra lift and fold (m)
const CHARGE = { rise: 9, fall: 7, least: 0.3, body: 0.6, open: 0.45, heel: 0.13, tuck: 0.07 };
const TRUNK = new Set(['spine', 'chest', 'clavicleL', 'upperArmL', 'foreArmL', 'clavicleR', 'upperArmR', 'foreArmR']);
const TOP = {};                                         // the pose at the top of each kind's backswing
function topOf(kind) {
  const c = kind === 'pass' ? CLIPS.kickPass : CLIPS.kickShot;
  if (!c) return null;
  if (!TOP[kind]) {
    const P = { q: new Float32Array(c.q.length / c.n), h: new Float32Array(3), a: new Float32Array(6) };
    sampleKick(c, -c.top, P);
    const hq = new THREE.Quaternion().fromArray(P.q, 0), f = new THREE.Vector3(0, 0, 1).applyQuaternion(hq);
    TOP[kind] = { P, yaw: Math.atan2(f.x, f.z) };
  }
  return TOP[kind];
}

// How far he is into shaping up (0..1), eased. Call once a frame.
export function chargeLevel(m, dt) {
  const c = m.charge;
  let want = 0;
  if (c && c.kind === 'shot') want = CHARGE.least + (1 - CHARGE.least) * smooth(c.t / SHOT.chargeTime);
  else if (c) { const perfect = PASS.ringTime * (1 - 1 / PASS.ringStart); want = 0.5 * smooth((c.t - perfect + 0.3) / 0.25); }   // (a pass: as the ring nears the circle)
  if (c) m.chargeKind = c.kind;
  if (m.strike) return m.chargeK = 0;                    // struck: the kick has him now
  const k = m.chargeK || 0;
  return m.chargeK = k + (want - k) * Math.min(1, dt * (want > k ? CHARGE.rise : CHARGE.fall));
}

const Y = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), aL = new THREE.Vector3(), aR = new THREE.Vector3(), fL = new THREE.Quaternion(), fR = new THREE.Quaternion();
// The pelvis and the kicking leg (third person; your own boots keep their run). Call after the stride's legs
// are posed and before a boot is sent to the ball.
export function chargeLegs(m, bn) {
  const k = m.chargeK || 0, top = topOf(m.chargeKind);
  if (k <= 0.001 || !top || m.firstPerson) return;
  const h = bn.hips;
  ankleOf(bn, 'L', aL); ankleOf(bn, 'R', aR); footOf(bn, 'L', fL); footOf(bn, 'R', fR);
  h.quaternion.premultiply(q.setFromAxisAngle(Y, top.yaw * CHARGE.open * k));
  // the trailing right leg, off the grass: heel up toward the seat
  const back = smooth((h.position.z - aR.z - 0.05) / 0.3) * smooth((aR.y - 0.14) / 0.12) * (m.chargeKind === 'pass' ? 0.4 : 1);
  aR.y += CHARGE.heel * k * back; aR.z += CHARGE.tuck * k * back;
  reachLeg(bn, 'L', aL); aimFoot(bn, 'L', fL); reachLeg(bn, 'R', aR); aimFoot(bn, 'R', fR);
}

// The trunk and arms. Call after the upper body and its layers are posed, before the head is aimed.
export function layerCharge(m, bn) {
  const k = m.chargeK || 0, top = topOf(m.chargeKind);
  if (k <= 0.001 || !top) return;
  applyPose(bn, top.P, CHARGE.body * k, TRUNK);
}
