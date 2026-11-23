// A throw-in. Hand-built from how it is coached and from the Laws (Law 15: both hands, the ball delivered from
// behind and over the head, part of each foot on the ground on or behind the line): the CMU library has nobody
// throwing a ball two-handed from overhead (111_33 and 113_24 'Throwing' are one-armed and chest passes).
// The coaching points it follows: hands behind and to the sides of the ball, thumbs nearly together; the ball
// taken back behind the head with the elbows bent and out; knees bent and the back arched, hips forward; then
// the trunk snaps forward and the arms whip over, the ball let go above and just in front of the head while
// the hands are still speeding up; the arms follow through at the target and the trunk goes over the feet.
// Both feet stay where they stand, flat, the whole way (no run-up, no step, no dragged toe).
//
// Called after animate() has stood him at the line facing the pitch. Times (s): t = -THROW.hold he has the ball
// in both hands at his chest, by t = 0 it is over his head; the wind-up takes it behind his head by
// THROW.windup; it leaves his hands at t = THROW.windup + THROW.release; THROW.follow later he is standing
// again. Before -THROW.hold (he reaches for the ball over 0.2 s) and after the end nothing is changed.
import * as THREE from 'three';
import { reach } from './getup.js';

export const THROW = { hold: 0.5, windup: 0.42, release: 0.14, follow: 0.55 };
const REACH = 0.2, PEAK = 0.19, R = 0.12, GRIP = 30 * Math.PI / 180, PALM = 0.09;      // PEAK: s after the release when the arms are furthest through; R: the ball; PALM: wrist to the middle of the palm
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, mix = (a, b, k) => a + (b - a) * k;
const DEG = Math.PI / 180;

// The ball's place in his own side view, from a point 12 cm over the middle of his shoulders: [angle from
// straight up (rad, + forward), distance (m)], and the body under it: pitch of the trunk (rad, + forward),
// how far the hips sink and go forward (m). Chest: carried. Over: held over the head. Back: behind the head,
// back arched. Let go: above and in front of the head. Through: where the empty hands end up.
const CHEST = { a: 128 * DEG, r: 0.5, pitch: 0.04, drop: 0, fwd: 0 };
const OVER = { a: 10 * DEG, r: 0.39, pitch: 0, drop: 0.01, fwd: 0 };
const BACK = { a: -79 * DEG, r: 0.265, pitch: -0.3, drop: 0.075, fwd: 0.07 };
const LETGO = { a: 29 * DEG, r: 0.5, pitch: 0.13, drop: 0.005, fwd: 0.07 };
const THROUGH = { a: 96 * DEG, r: 0.56, pitch: 0.42, drop: 0.035, fwd: 0.09 };

// Where he is in the throw at time t → out { a, r, pitch, drop, fwd, w (how much of it is on him, 0..1), ball (he has it) }
function at(t, out) {
  const go = THROW.windup + THROW.release, end = go + THROW.follow;
  let A, B, k, ka, kr = null, wide = 0;
  if (t < 0) { A = CHEST; B = OVER; ka = k = ease((t + THROW.hold) / THROW.hold); }
  else if (t < THROW.windup) { A = OVER; B = BACK; ka = k = ease(t / THROW.windup); wide = 0.06 * Math.sin(Math.PI * k); }      // (out round the back of his head, not through it)
  else if (t < go) { A = BACK; B = LETGO; k = (t - THROW.windup) / THROW.release; kr = 1 - (1 - k) * (1 - k); ka = k * k; k = ka; }      // speeding up all the way to the release, his arms straightening early so it clears his head
  else {
    // the arms carry on at the speed they had and are braked; then he comes back up
    const s = clamp((t - go) / PEAK, 0, 1), v = 2 * (LETGO.a - BACK.a) / THROW.release * PEAK, s2 = s * s, s3 = s2 * s;
    A = LETGO; B = THROUGH; k = ease(s);
    out.a = (2 * s3 - 3 * s2 + 1) * A.a + (s3 - 2 * s2 + s) * v + (-2 * s3 + 3 * s2) * B.a;
    ka = null;
  }
  if (ka !== null) out.a = mix(A.a, B.a, ka);
  out.r = mix(A.r, B.r, kr ?? k) + wide; out.pitch = mix(A.pitch, B.pitch, k); out.drop = mix(A.drop, B.drop, k); out.fwd = mix(A.fwd, B.fwd, k);
  out.w = t < -THROW.hold ? ease((t + THROW.hold + REACH) / REACH) : t > go + PEAK ? 1 - ease((t - go - PEAK) / (THROW.follow - PEAK)) : 1;
  out.ball = t <= go && t >= -THROW.hold;
  return t < end && t > -THROW.hold - REACH ? out : null;
}

const S = {}, v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), C = new THREE.Vector3(), ball = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3(), X = new THREE.Vector3(), Z = new THREE.Vector3();
const palm = new THREE.Vector3(), n = new THREE.Vector3(), tgt = new THREE.Vector3(), pole = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), rootQ = new THREE.Quaternion(), basis = new THREE.Matrix4();
const ank = { L: new THREE.Vector3(), R: new THREE.Vector3() }, footQ = { L: new THREE.Quaternion(), R: new THREE.Quaternion() }, was = new THREE.Vector3();
const AX = new THREE.Vector3(1, 0, 0);
const pitchBone = (b, a) => b.quaternion.multiply(q1.setFromAxisAngle(AX, a));

// Poses the throw-in over the standing pose animate() gave him. t: seconds, 0 = the ball held over his head
// (see the top of the file). Remembers where the ball is for throwInBall().
export function poseThrowIn(m, t) {
  const bn = m.bone, s = at(t, S);
  m.throwIn = null;
  if (!s || s.w <= 0) return;
  const k = s.w;
  m.root.updateMatrixWorld(true);
  m.root.getWorldQuaternion(rootQ);
  for (const side of ['L', 'R']) { bn['foot' + side].getWorldPosition(ank[side]); bn['foot' + side].getWorldQuaternion(footQ[side]); }
  // the trunk: hips sink and go forward, pelvis, spine and chest share the arch or the bend, the head stays up
  bn.hips.position.y -= s.drop * k; bn.hips.position.z += s.fwd * k;
  pitchBone(bn.hips, s.pitch * 0.24 * k); pitchBone(bn.spine, s.pitch * 0.38 * k); pitchBone(bn.chest, s.pitch * 0.38 * k);
  pitchBone(bn.neck, -s.pitch * 0.3 * k); pitchBone(bn.head, -s.pitch * 0.3 * k);
  m.root.updateMatrixWorld(true);
  // both feet stay where they stood
  for (const side of ['L', 'R']) {
    const foot = bn['foot' + side];
    reach(bn['upperLeg' + side], bn['lowerLeg' + side], foot, ank[side], -1);
    foot.parent.getWorldQuaternion(q1); foot.quaternion.copy(q1.invert().multiply(footQ[side])); foot.updateWorldMatrix(false, true);
  }
  // the ball, in his own side view from over the middle of his shoulders
  X.set(1, 0, 0).applyQuaternion(rootQ); Z.set(0, 0, 1).applyQuaternion(rootQ);
  C.copy(bn.upperArmL.getWorldPosition(v1)).add(bn.upperArmR.getWorldPosition(v2)).multiplyScalar(0.5);
  u.set(0, Math.cos(s.a), 0).addScaledVector(Z, Math.sin(s.a));               // from there to the ball
  C.y += 0.12;
  ball.copy(C).addScaledVector(u, s.r);
  w.crossVectors(X, u);                                                          // the way the hands push it
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? 1 : -1, up = bn['upperArm' + side], lo = bn['foreArm' + side], hand = bn['hand' + side];
    // the palm on the ball, to the side and a little behind it; the wrist a palm's length back along the arm
    palm.copy(ball).addScaledVector(X, sg * R * Math.cos(GRIP)).addScaledVector(w, -R * Math.sin(GRIP));
    n.subVectors(ball, palm).normalize();
    tgt.copy(palm).addScaledVector(u, -PALM);
    hand.getWorldPosition(was);
    tgt.lerpVectors(was, tgt, k);
    // elbows out to the sides and a little forward (under the ball when it is over or behind his head)
    pole.copy(X).multiplyScalar(sg).addScaledVector(Z, 0.55 + 0.6 * Math.max(0, -Math.sin(s.a))).addScaledVector(v1.set(0, 1, 0), -0.25);
    lo.getWorldPosition(v1).sub(up.getWorldPosition(v2)); pole.normalize().lerp(v1.normalize(), 1 - k);
    reach(up, lo, hand, tgt, 1, -9, pole);
    // the hand: fingers along the arm's line, the palm to the ball (a hanging hand's palm faces his thigh: -x on the left hand)
    v1.copy(n).multiplyScalar(-sg); v2.copy(u).multiplyScalar(-1); v1.addScaledVector(v2, -v1.dot(v2)).normalize();
    q2.setFromRotationMatrix(basis.makeBasis(v1, v2, tgt.crossVectors(v1, v2)));
    hand.getWorldQuaternion(q1).slerp(q2, k);
    hand.parent.getWorldQuaternion(q2); hand.quaternion.copy(q2.invert().multiply(q1)); hand.updateWorldMatrix(false, true);
  }
  if (s.ball) m.throwIn = { w: w.clone() };
}

// Where the ball is while he has it (world): between his palms, as his hands actually are. Returns null when
// he hasn't got it (before -THROW.hold, or once it has gone).
export function throwInBall(m, out) {
  if (!m.throwIn) return null;
  const bn = m.bone;
  out.set(0, 0, 0);
  for (const side of ['L', 'R']) {
    const hand = bn['hand' + side];
    out.add(hand.getWorldPosition(v1)).add(v2.set(0, -PALM, 0).applyQuaternion(hand.getWorldQuaternion(q1)));
  }
  return out.multiplyScalar(0.5).addScaledVector(m.throwIn.w, R * Math.sin(GRIP));
}
