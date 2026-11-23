// The referee's signals, laid over whatever animate() has him doing (standing, walking, running): only the
// arms, the chest's turn and the head change; his legs and hips are the animation's.
// Hand-built from the Laws of the Game. Law 13 gives one in words (an indirect free kick: 'raising the arm
// above the head', kept there until the kick is taken and the ball touches another player); the rest are the
// drawings of the approved signals under Law 5: a direct free kick is an arm out, a little above level,
// pointing the way the kick goes; a penalty is an arm pointing down at the mark; advantage is both arms (or
// one) swept forward the way play goes; a card is held up at full stretch, facing the player. Nobody in the
// CMU library is refereeing, so none of this is a recording.
// Not in the Laws, from watching referees: the whistle goes to the mouth with the hand that isn't signalling
// (here always the left); the card comes out of the breast pocket first; full time is the long blasts with an
// arm straight up, then the arm brought down to point at the centre circle or the tunnel.
import * as THREE from 'three';
import { reach } from './getup.js';

// How long each lasts (s). sig.hold (optional) makes any of them last that long instead (an indirect free kick's
// arm should stay up until the kick is taken).
export const REF_SIGNALS = { free: 2, indirect: 2, penalty: 2, card: 2.2, advantage: 1.2, whistle: 0.5, halftime: 2, fulltime: 2 };
const IN = 0.36, OUT = 0.4, DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const turnOf = a => Math.atan2(Math.sin(a), Math.cos(a));

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), tgt = new THREE.Vector3(), pole = new THREE.Vector3(), d = new THREE.Vector3();
const X = new THREE.Vector3(), Z = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), rootQ = new THREE.Quaternion(), basis = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

// An arm out straight along a direction: how far it is from hanging (up: rad from straight down) and which way
// round him (az: rad about the sky, 0 = the pitch's +z), by weight k. It goes there by its own angles, so an
// arm that hangs is raised out to that side, never folded up through the shoulder.
function aimArm(bn, s, up, az, k) {
  if (k <= 0) return;
  const sh = bn['upperArm' + s], lo = bn['foreArm' + s], hand = bn['hand' + s];
  sh.getWorldPosition(v1); hand.getWorldPosition(v2);
  const L = lo.position.length() + hand.position.length(), c = v2.sub(v1), len = c.length() || 1;
  const up0 = Math.acos(clamp(-c.y / len, -1, 1)), az0 = Math.atan2(c.x, c.z);
  const e = up0 + (up - up0) * k, a = az0 + turnOf(az - az0) * ease(k * 2.2), r = len + (L * 0.985 - len) * k;
  tgt.set(Math.sin(e) * Math.sin(a), -Math.cos(e), Math.sin(e) * Math.cos(a)).multiplyScalar(r).add(v1);
  // the elbow's side: outward and back, as a hanging arm's is
  pole.copy(X).multiplyScalar(s === 'L' ? 1 : -1).addScaledVector(Z, -0.6).addScaledVector(UP, -0.3);
  lo.getWorldPosition(v2).sub(v1); pole.normalize().lerp(v2.normalize(), 1 - k);
  reach(sh, lo, hand, tgt, 1, -9, pole);
  hand.quaternion.slerp(q1.identity(), k * 0.8);        // the hand in line with the arm: he is pointing with it
}
// A hand to a spot on him: `at` (world), by weight k, the elbow down and out.
function handTo(bn, s, at, k) {
  if (k <= 0) return;
  const sh = bn['upperArm' + s], lo = bn['foreArm' + s], hand = bn['hand' + s];
  hand.getWorldPosition(v2); tgt.lerpVectors(v2, at, k);
  sh.getWorldPosition(v1);
  pole.copy(X).multiplyScalar(s === 'L' ? 0.7 : -0.7).addScaledVector(UP, -1);
  lo.getWorldPosition(v2).sub(v1); pole.normalize().lerp(v2.normalize(), 1 - k);
  reach(sh, lo, hand, tgt, 1, -9, pole);
}
// The trunk and head turned toward a direction rel rad to his left (as far as a man's trunk and neck go), by k.
function turnTo(bn, rel, k, trunk = 0.5, head = 0.5) {
  const a = clamp(rel, -1.5, 1.5) * k;
  bn.spine.quaternion.multiply(q1.setFromAxisAngle(UP, a * trunk * 0.35)); bn.chest.quaternion.multiply(q1.setFromAxisAngle(UP, a * trunk * 0.35));
  bn.neck.quaternion.multiply(q1.setFromAxisAngle(UP, a * head * 0.3)); bn.head.quaternion.multiply(q1.setFromAxisAngle(UP, a * head * 0.4));
}

// Poses a signal over the animation's pose. sig: { kind, dir: { x, z } (world, unit), hold (s, optional), red
// (a card: the other arm points him off) }; t: seconds since it began. Eases in and out by itself. Returns
// false once it is over (and before it starts), true while any of it is on him.
// Two at once (a whistle with a free kick): call the whistle last; it takes his left hand for as long as it lasts.
export function poseRefSignal(m, sig, t) {
  const bn = m.bone, T = sig.hold || REF_SIGNALS[sig.kind];
  if (sig.kind !== 'whistle') m.refCard = null;
  if (!T || t < 0 || t >= T) return false;
  m.root.updateMatrixWorld(true);
  m.root.getWorldQuaternion(rootQ);
  X.set(1, 0, 0).applyQuaternion(rootQ); Z.set(0, 0, 1).applyQuaternion(rootQ);
  const dir = sig.dir || { x: Z.x, z: Z.z }, az = Math.atan2(dir.x, dir.z), rel = turnOf(az - Math.atan2(Z.x, Z.z));      // rel: + to his left
  const w = ease(t / IN) * (1 - ease((t - (T - OUT)) / OUT)), near = rel > 0.35 ? 'L' : 'R';
  // a hand at his mouth: the wrist under and in front of his chin, the fingers up to his lips
  const blow = (s, k) => {
    if (k <= 0) return;
    m.root.updateMatrixWorld(true);
    const sg = s === 'L' ? 1 : -1, hand = bn['hand' + s];
    handTo(bn, s, v3.set(sg * 0.05, -0.055, 0.185).applyMatrix4(bn.head.matrixWorld), k);
    v1.set(sg * 0.012, 0.04, 0.105).applyMatrix4(bn.head.matrixWorld).sub(hand.getWorldPosition(v2)).normalize();      // wrist to lips
    v2.set(0, -1, 0).applyQuaternion(hand.getWorldQuaternion(q1));                                                    // the way his fingers point
    q2.setFromUnitVectors(v2, v1).multiply(q1); q1.slerp(q2, k);
    hand.parent.getWorldQuaternion(q2); hand.quaternion.copy(q2.invert().multiply(q1)); hand.updateWorldMatrix(false, true);
  };
  switch (sig.kind) {
    case 'free':            // an arm out the way the kick goes, a little above level
      turnTo(bn, rel, w, 0.5, 0.25); m.root.updateMatrixWorld(true);
      aimArm(bn, near, 112 * DEG, az, w);
      break;
    case 'indirect':        // an arm straight up
      aimArm(bn, 'R', 176 * DEG, Math.atan2(Z.x, Z.z), w);
      break;
    case 'penalty':         // pointing down at the mark, looking at it
      turnTo(bn, rel, w, 0.5, 0.7); m.root.updateMatrixWorld(true);
      aimArm(bn, near, 68 * DEG, az, w);
      break;
    case 'advantage': {     // both arms swept forward and up the way play goes, a shoulder's width apart
      const a = Math.atan2(Z.x, Z.z) + clamp(rel, -1.1, 1.1), sweep = ease(t / 0.42) * (1 - ease((t - (T - 0.4)) / 0.4));
      turnTo(bn, rel, sweep, 0.5, 0.3); m.root.updateMatrixWorld(true);
      aimArm(bn, 'L', 122 * DEG, a + 0.16, sweep); aimArm(bn, 'R', 122 * DEG, a - 0.16, sweep);
      break;
    }
    case 'card': {          // right hand to the breast pocket, then the card straight up at full stretch, facing the player
      const out = ease(t / 0.3) * (1 - ease((t - 0.3) / 0.3)), up = ease((t - 0.34) / 0.3) * (1 - ease((t - (T - OUT)) / OUT));
      turnTo(bn, rel, w, 0.35, 0.8); m.root.updateMatrixWorld(true);
      if (out > 0) handTo(bn, 'R', v3.set(0.03, 0.07, 0.15).applyMatrix4(bn.chest.matrixWorld), out);
      if (up > 0) aimArm(bn, 'R', 177 * DEG, Math.atan2(Z.x, Z.z), up);
      if (sig.red) aimArm(bn, 'L', 100 * DEG, az + Math.PI, ease((t - 0.9) / 0.35) * (1 - ease((t - (T - OUT)) / OUT)));      // off: pointing away past himself, the way the player has to go
      if (t > 0.3 && t < T - OUT * 0.5) m.refCard = { x: dir.x, z: dir.z };
      break;
    }
    case 'whistle':         // the left hand to the mouth, the short blow
      blow('L', ease(t / 0.16) * (1 - ease((t - (T - 0.2)) / 0.2)));
      break;
    case 'halftime': case 'fulltime': {     // the long blasts with the right arm straight up, then that arm brought down to point where they are going
      const fwd = Math.atan2(Z.x, Z.z), down = ease((t - 1.0) / 0.4);
      turnTo(bn, rel, w * down, 0.5, 0.4); m.root.updateMatrixWorld(true);
      aimArm(bn, 'R', (176 - 62 * down) * DEG, fwd + turnOf(az - fwd) * down, w);
      blow('L', ease(t / 0.2) * (1 - ease((t - 0.95) / 0.25)));
      break;
    }
    default: return false;
  }
  return true;
}

// Where the card is while it is in his hand (world): pos its middle, quat turning a card that stands in its own
// x-y plane (0.075 wide along x, 0.105 tall along y) to face the player along its +z. Returns false when no card is out.
export function cardTransform(m, pos, quat) {
  const c = m.refCard, hand = m.bone.handR;
  if (!c) return false;
  m.root.updateMatrixWorld(true);
  hand.getWorldPosition(pos);
  const fingers = v1.set(0, -1, 0).applyQuaternion(hand.getWorldQuaternion(q2));
  pos.addScaledVector(fingers, 0.135);                       // pinched by its bottom edge at the fingertips
  const z = v2.set(c.x, 0, c.z).normalize(), y = fingers.addScaledVector(z, -fingers.dot(z)).normalize();
  quat.setFromRotationMatrix(basis.makeBasis(d.crossVectors(y, z), y, z));
  return true;
}
