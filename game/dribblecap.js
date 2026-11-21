// Running with the ball. The legs are the captured strides everyone runs on (game/mocap.js); this is what the
// ball changes about them, from how players are coached to dribble:
//
//   cadence   The sim taps the ball once per turn of its stride (rules/dribble.js), and that stride is a
//             runner's: fine at pace, a metre a step at a walk. Slow, with the ball close, a player takes short
//             quick steps instead, so the legs go round two (or three) times per touch and the captured
//             "quick little steps" and low short-stride jog are played (dribbleCadence, quickSteps).
//   feet      A boot that would come down on the ball is put down short of it or beside it (dribbleFoot).
//   touch     The right boot's own forward swing is steered onto the ball so it is on it on the sim's touch
//             frame, then follows it a few centimetres and lets it run: with the laces, toes pointed down and
//             a little in, at pace; with the inside of the foot, turned out, at a walk (touchBoot).
//   carriage  Over the ball: a little more forward, arms wider for balance, eyes down on the ball for each
//             touch and up for a look between touches (layerDribble, dribbleGlance).
//
// Everything is the right boot's; a left-footed player is posed in a mirror (game/actors.js).
// Spaces: the model's own (metres, +z the way he faces, +x his left, the origin on the grass under him).
import * as THREE from 'three';
import { BALL, DRIBBLE } from '../rules/tuning.js';
import { strideRate, sinceTouch } from '../rules/dribble.js';
import { ankleOf, footOf, reachLeg, aimFoot } from './legik.js';

const TAU = Math.PI * 2;
const smooth = x => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), wrap = a => a - TAU * Math.round(a / TAU);

// step: a quick dribbling step's turn of the legs (s); at: where the legs' cycle is as the boot meets the ball
// (the captured swing has the right foot coming through low and forward there; your own first-person legs
// keep the sim's phase); slow, fast: the legs never turn over slower or faster than this against the cadence asked
const CADENCE = { step: 0.66, at: 4.45, slow: 0.55, fast: 1.7 };
// the part of the boot that meets the ball (foot space: +z to the toe, +x the inside of the right boot, the
// ankle at the origin), which way the boot's surface faces there, and how the foot is turned (toes in / down)
const LACES = { spot: [-0.012, -0.019, 0.17], face: [0, 0.936, 0.351], yaw: 0.22, pitch: 1.0 };
const INSIDE = { spot: [0.052, -0.035, 0.05], face: [1, 0, 0], yaw: -1.05, pitch: 0.1 };
// before, after: how much of a turn of the legs the boot is steered onto the ball over (gently at first, so it
// arrives with the swing's own pace), and let go over;
// follow: how far it goes with the ball before the ball leaves it (m); clear: how near the ball's middle a
// boot on the ground may come (m, in plan)
const TOUCH = { before: 0.24, after: 0.085, follow: 0.05, clear: BALL.r + 0.075 };

const stateOf = m => m.drib || (m.drib = { n: 1, in: 0, u: 0, z0: DRIBBLE.near, up: 0, since: 9, seed: (m.gait && m.gait.seed) || 0.5 });

// How fast the legs turn over this frame (rad/s) for a man on the ball. ph: the legs' phase (the gait's own);
// stride: the sim's. The legs go round a whole number of times between two touches, the number that comes
// nearest a dribbler's quick step, and are on `at` as the sim's stride reaches its touch.
export function dribbleCadence(m, ph, stride, speed, dt) {
  const D = stateOf(m), w = strideRate(speed), u = sinceTouch(stride), want = Math.max(1, TAU / w / CADENCE.step);
  if (Math.abs(want - D.n) > 0.6) D.n = Math.round(want);
  const at = m.firstPerson ? DRIBBLE.touchAt : CADENCE.at, d0 = wrap(at - ph) / TAU;       // turns to the touch pose, the short way round
  const left = Math.max(0, Math.round(D.n * (1 - u) - d0)) + d0, nat = D.n * w;
  const rate = clamp(left * TAU / Math.max((1 - u) * TAU / w, dt, 1e-3), CADENCE.slow * nat, CADENCE.fast * nat);
  // (a change of cadence comes in over a tenth of a second, not in one frame)
  return D.rate = D.rate && dt > 0 ? D.rate + (rate - D.rate) * Math.min(1, dt * 14) : rate;
}
// 0..1: how much he is on short quick steps (more than one turn of the legs per touch) rather than a running stride.
export function quickSteps(m, dt = 0) {
  const D = stateOf(m);
  D.q = clamp((D.q ?? (D.n > 1 ? 1 : 0)) + (D.n > 1 ? 1 : -1) * dt * 5, 0, 1);
  return smooth(D.q);
}

const B = new THREE.Vector3(), A = new THREE.Vector3(), nR = new THREE.Vector3(), spot = new THREE.Vector3(), face = new THREE.Vector3(), fw = new THREE.Vector3();
const qf = new THREE.Quaternion(), qn = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
function toModel(m, ball, out) {
  const c = Math.cos(m.root.rotation.y), s = Math.sin(m.root.rotation.y), dx = ball.x - m.root.position.x, dz = ball.z - m.root.position.z;
  return out.set(dx * c - dz * s, ball.y ?? BALL.r, dx * s + dz * c);
}

// How far a boot's line (0.08 m behind the ankle a to 0.2 m ahead, the way the foot q points) is from the
// ball's middle b, in plan. Leaves the way out of the ball in out (x, z: away from it, leaning to his own side).
const out = { x: 0, z: 0 };
function bootOff(a, q, n, b) {
  fw.set(0, 0, 1).applyQuaternion(q); fw.y = 0;
  const fl = fw.length() || 1, sd = n === 'L' ? 1 : -1;
  const t = clamp(((b.x - a.x) * fw.x + (b.z - a.z) * fw.z) / fl, -0.08, 0.2 * fl), px = a.x + fw.x / fl * t, pz = a.z + fw.z / fl * t;
  const nx = px - b.x + sd * 0.03, nz = Math.min(0, pz - b.z), l = Math.hypot(nx, nz) || 1;
  out.x = nx / l; out.z = nz / l;
  return Math.hypot(px - b.x, pz - b.z);
}
// A boot on its way down near the ball goes round it. a: where the stride has the ankle (changed in place),
// q: how the foot is turned, n: 'L' or 'R', k: how much he is on the ball. The boot is kept `clear` from the
// ball's middle in plan: pushed back the way it came, and out to its own side. (The right boot is steered
// onto the ball from there by touchBoot.)
export function dribbleFoot(m, n, a, q, ball, k) {
  a.x += (n === 'L' ? 1 : -1) * 0.055 * k * smooth(stateOf(m).q || 0);      // (the quick steps were recorded on a line: his feet go either side of it)
  toModel(m, ball, B);
  const low = 1 - smooth((a.y - 0.24) / 0.1);                     // (a boot carried above the ball is no matter)
  if (low <= 0 || B.z < 0.2 || B.z > 1.2) return;
  const push = Math.max(0, TOUCH.clear - bootOff(a, q, n, B)) * low * k;
  a.x += out.x * push; a.z += out.z * push;
}

// Where the ankle has to be (out) for the boot's spot to be on the ball at b, the foot turned as q says.
function ankleFor(st, b, q, out) {
  face.fromArray(st.face).normalize().applyQuaternion(q);
  return out.copy(b).addScaledVector(face, -BALL.r).sub(spot.fromArray(st.spot).applyQuaternion(q));
}

// The touch. p: the sim player; k: how much he is on the ball (0..1). Steers the right boot from wherever the
// stride has it onto the ball as the sim's stride comes round to its touch, keeps it on the ball for the first
// few centimetres, and gives the leg back to the stride. Returns how much of a touch the pose is (0..1).
export function touchBoot(m, bn, p, ball, k, dt = 0) {
  const D = stateOf(m), speed = Math.hypot(p.vx, p.vz), u = sinceTouch(p.stride ?? m.phase);
  const before = TOUCH.before / D.n, after = TOUCH.after / D.n;
  toModel(m, ball, B);
  if (u < D.u) D.z0 = B.z;                                         // the sim has just touched it: where the ball was
  D.u = u;
  // (the sim's touch frame is the first one past the touch: the boot is still fully on the ball for that one)
  const hold = strideRate(speed) * Math.max(dt, 1 / 72) * 1.1 / TAU;
  let w = u > 1 - before ? smooth(((u - (1 - before)) / before) ** 2) : u < hold + after ? 1 - smooth((u - hold) / after) : 0;
  w *= k * smooth((speed - 0.35) / 0.5) * (1 - smooth((B.y - BALL.r - 0.05) / 0.15));       // (a ball in the air isn't touched on: his own chip, dropping ahead of him as he runs)
  if (w <= 0) { D.in = D.n > 1 ? 1 : 0; return 0; }                // (which part of the boot is chosen between touches)
  if (B.z < 0.25 || B.z > 1.1 || Math.abs(B.x) > 0.3) return 0;   // only a ball in front of him
  const st = D.in ? INSIDE : LACES;
  if (u < hold + after) B.z = Math.min(B.z, D.z0 + TOUCH.follow);          // it goes with the ball a little way, then the ball runs on
  // the foot turns to the ball as it comes, and the ankle goes where that part of the boot, turned as it is
  // by now, would be on the ball: so it closes on the ball's surface and is never in it
  ankleOf(bn, 'R', nR); footOf(bn, 'R', qn);
  qn.slerp(qf.setFromEuler(eul.set(st.pitch, st.yaw, 0)), w);
  nR.lerp(ankleFor(st, B, qn, A), w);
  if (u < hold + after && w < 1) {
    // letting go: the boot leaves the ball's back and comes down beside it, round it and not through it
    // (as near as it was on the ball at first, as clear as any footfall by the end)
    const on = bootOff(A, qn, 'R', B);
    toModel(m, ball, B);
    const push = Math.max(0, on + (TOUCH.clear - on) * (1 - w) - bootOff(nR, qn, 'R', B));
    nR.x += out.x * push; nR.z += out.z * push;
  }
  reachLeg(bn, 'R', nR); aimFoot(bn, 'R', qn);
  return w;
}

// Is he looking up from the ball? Coaches ask for the head up with glimpses down at the ball: his eyes are on
// it for a touch, and after a touch, about once a second, he looks up for half a second or more. Call once a
// frame while he is on the ball.
export function dribbleGlance(m, p, dt) {
  const D = stateOf(m), u = sinceTouch(p.stride ?? m.phase);
  D.since += dt;
  if (D.up > 0) D.up -= dt;
  else if (u < D.lu && D.since > 0.9 + 0.6 * D.seed) { D.up = 0.5 + 0.3 * ((D.seed * 7.3) % 1); D.since = 0; }
  D.lu = u;
  return D.up > 0;
}

// Over the ball. Laid on whatever the trunk and arms are doing (call after the stride's own trunk and before
// the head is aimed). g: the gait state; k: how much he is on the ball; drive: how much of a sprinter's drive
// he is in (that has its own pitch).
const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), q1 = new THREE.Quaternion();
export function layerDribble(bn, g, k, drive = 0) {
  const a = k * g.mv;
  if (a <= 0) return;
  const lean = (0.13 - 0.05 * g.sprint) * a * (1 - drive);
  bn.spine.quaternion.premultiply(q1.setFromAxisAngle(X, lean * 0.55)); bn.chest.quaternion.premultiply(q1.setFromAxisAngle(X, lean * 0.45));
  for (const n of 'LR') {
    const sd = n === 'L' ? 1 : -1;
    bn['upperArm' + n].quaternion.premultiply(q1.setFromAxisAngle(Z, sd * (0.1 + 0.14 * g.run) * a));   // elbows away from the body
    bn['foreArm' + n].quaternion.multiply(q1.setFromAxisAngle(X, (0.25 * g.run - 0.3 * (1 - g.run)) * a));   // bent and ready at a walk, a little straighter running
  }
}
