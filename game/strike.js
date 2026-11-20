// The boot meets the ball. Two things pose the legs on top of the run cycle (game/actors.js), both by
// putting the right boot where the ball is (game/legik.js):
//
//   strikes   a shot or pass: the leg draws back, swings to the ball and is on it on the frame the sim
//             launches it, then follows through. Your own strikes are wound up by the sim for a moment
//             (STRIKE in rules/tuning.js, the 'windup' event) so the swing has time to get there; anyone
//             else's starts on the contact frame (boot on the ball, then the follow-through). Replays
//             know what's coming, so there everyone gets the full swing.
//             A knock-on is a push with the laces in stride, a nutmeg a toe-poke, the standing flick-up a
//             scoop, a volley the laces wherever the ball is in the air; the rainbow's heel flicks it over
//             from behind you. What the rest of the body does in a trick is game/tricks.js.
//   touches   dribbling: once a stride of the sim's (rules/dribble.js) the right boot's own swing is steered
//             onto the ball and taps it on (game/dribblecap.js).
//   holds     the sole on top of the ball, pulling it in (drag-back, roulette: the sim moves the ball,
//             HOLD in rules/tuning.js), and the step-over's boot going over the front of it.
//
// m.strike = { kind: a STYLE, wind, t, dir (world), power, hit, hold, c (ball at contact, model space) }
import * as THREE from 'three';
import { BALL, HOLD } from '../rules/tuning.js';
import { touchBoot } from './dribblecap.js';
import { ankleOf, footOf, reachLeg, aimFoot } from './legik.js';
import { isKick, poseKick } from './kickcap.js';

const FOLLOW = 0.14, RECOVER = 0.2;      // seconds of follow-through, then back to the run
// How each strike is hit. spot: the part of the boot that meets the ball, in the foot's own space (+z to
// the toe, +x the inside of the right boot, the ankle at the origin: the boot is the box in game/body.js);
// face: which way the boot's surface faces there; yaw/pitch: how the foot is turned (toes out / down);
// back, up: where the backswing starts behind the ball (m, [soft, + per power]); thru, lift: the follow-through.
const STYLE = {
  shot: { spot: [0, -0.019, 0.17], face: [0, 0.936, 0.351], yaw: 0, pitch: 0.9, back: [0.6, 0.25], up: [0.26, 0.14], thru: [0.3, 0.3], lift: [0.18, 0.4] },   // the laces, toes pointed down
  pass: { spot: [0.052, -0.035, 0.05], face: [1, 0, 0], yaw: -1.25, pitch: 0, back: [0.45, 0], up: [0.12, 0], thru: [0.3, 0], lift: [0.1, 0] },                // the inside of the foot, turned out
  poke: { spot: [0, -0.05, 0.2], face: [0, 0, 1], yaw: 0, pitch: 0.15, back: [0, 0], up: [0, 0], thru: [0.06, 0], lift: [0.1, 0] },                            // the toe: a nutmeg
  push: { spot: [0, -0.019, 0.17], face: [0, 0.936, 0.351], yaw: 0, pitch: 0.9, back: [0, 0], up: [0, 0], thru: [0.2, 0], lift: [0.04, 0] },                   // the laces, toes down, in stride: a knock-on (game/tricks.js)
  scoop: { spot: [0, -0.05, 0.2], face: [0, 0, 1], yaw: 0, pitch: -0.2, back: [0, 0], up: [0, 0], thru: [0.06, 0], lift: [0.3, 0] },                       // the toes under it, the leg lifting from knee and hip: the flick-up
  volley: { spot: [0, -0.019, 0.17], face: [0, 0.936, 0.351], yaw: 0, pitch: 0.4, back: [0, 0], up: [0, 0], thru: [0.3, 0.2], lift: [0.1, 0.15] },             // the laces, in the air
  rainbow: { spot: [0, -0.035, -0.1], face: [0, 0, -1], yaw: 0, pitch: 1.0, back: [0, 0], up: [0, 0], thru: [-0.22, 0], lift: [0.3, 0] },                      // the heel under it behind you, toes down (and clear of the grass), kicking up and back from the knee
};
const SOLE = { spot: [0, -0.085, 0.06], face: [0, -1, 0] };          // the studs on top of the ball
const OVER = { r: 0.21, y: 0.14, rise: 0.12, time: 0.15 };             // a step-over: the boot's arc round the front of the ball (m), and how long it takes
const UP = new THREE.Vector3(0, 1, 0);
const WIDE = 0.1;                                        // dribbling on hand-built legs: how far apart the feet run (rad at the hip)
const PLANT = new THREE.Vector3(0.11, 0.085, 0.12);    // where the standing foot plants for a strike: a step forward, beside the ball
const MAX_TURN = 1.3;                                    // the swing follows the ball's direction this far round (rad)

const B = new THREE.Vector3(), K = new THREE.Vector3(), T = new THREE.Vector3(), A = new THREE.Vector3();
const nR = new THREE.Vector3(), nL = new THREE.Vector3(), spot = new THREE.Vector3(), face = new THREE.Vector3();
const qf = new THREE.Quaternion(), qn = new THREE.Quaternion(), ql = new THREE.Quaternion(), flat = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
const smooth = x => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

// A point on the pitch as the model sees it (out: Vector3). The model stands at root.position turned by root.rotation.y.
function toModel(m, x, y, z, out) {
  const c = Math.cos(m.root.rotation.y), s = Math.sin(m.root.rotation.y), dx = x - m.root.position.x, dz = z - m.root.position.z;
  return out.set(dx * c - dz * s, y, dx * s + dz * c);
}

// Where the ankle has to be (out) for the boot's spot to be on the ball at b, the foot turned as q says.
function ankleFor(st, b, q, out) {
  face.fromArray(st.face).normalize().applyQuaternion(q);
  return out.copy(b).addScaledVector(face, -BALL.r).sub(spot.fromArray(st.spot).applyQuaternion(q));
}

// The swing begins: the boot has `wind` seconds to reach the ball. dir: where the ball will go (world x, z).
export function startStrike(m, { kind = 'shot', wind = 0, dir, power = 0.5 }) {
  m.strike = { kind: STYLE[kind] ? kind : 'shot', wind, t: 0, dir: { x: dir.x, z: dir.z }, power, hit: false, hold: false, c: null };
}

// The sim has just launched the ball off this player's boot: this frame is the contact frame, wherever
// the swing had got to (and the start of one for a strike nobody saw coming).
export function struck(m, kind, dir, power = 0.5) {
  if (!m.strike || m.strike.hit) startStrike(m, { kind, wind: 0, dir, power });
  const s = m.strike;
  s.t = s.wind; s.dir = { x: dir.x, z: dir.z }; s.hit = true; s.hold = true; s.c = null;
}

// Poses a strike in progress. ball: the sim ball { x, y, z }. Returns how much of a strike the pose is (0..1).
export function poseStrike(m, bn, ball, dt) {
  const s = m.strike, st = STYLE[s.kind], pw = s.power;
  // the ball in model space: where it is until it's hit, then where it was hit
  if (!s.c) { toModel(m, ball.x, ball.y ?? BALL.r, ball.z, B); if (s.t >= s.wind) s.c = B.clone(); } else B.copy(s.c);
  // which way the swing goes: the ball's direction as the model sees it, as far round as a leg can go
  const c = Math.cos(m.root.rotation.y), sn = Math.sin(m.root.rotation.y);
  const turn = Math.min(MAX_TURN, Math.max(-MAX_TURN, Math.atan2(s.dir.x * c - s.dir.z * sn, s.dir.x * sn + s.dir.z * c)));
  K.set(Math.sin(turn), 0, Math.cos(turn));
  qf.setFromEuler(eul.set(st.pitch, turn + st.yaw, 0));
  // the ankle when the boot is on the ball, then where the swing starts and where it ends up
  ankleFor(st, B, qf, A);
  A.y = Math.max(0.085, A.y);                                    // never through the grass
  if (isKick(s.kind)) return poseKick(m, bn, s, A, qf, turn, dt, B);   // a shot, a pass or a volley is a recorded kick round that contact (game/kickcap.js)
  const before = s.t < s.wind, after = s.t - s.wind;
  let w = 1;
  if (before) {
    const k = s.wind > 0 ? s.t / s.wind : 1;
    T.copy(A).addScaledVector(K, -(st.back[0] + st.back[1] * pw) * (1 - k * k)); T.y += (st.up[0] + st.up[1] * pw) * (1 - k * k);
    w = smooth(k / 0.35);
  } else {
    const k = Math.min(1, after / FOLLOW), out = 1 - (1 - k) * (1 - k);
    T.copy(A).addScaledVector(K, (st.thru[0] + st.thru[1] * pw) * out); T.y += (st.lift[0] + st.lift[1] * pw) * out;
    w = 1 - smooth((after - FOLLOW) / RECOVER);
  }
  // both legs from where the run cycle has them: the standing foot plants, the striking one goes to the ball
  ankleOf(bn, 'R', nR); ankleOf(bn, 'L', nL); footOf(bn, 'R', qn); footOf(bn, 'L', ql);
  bn.hips.position.y -= 0.05 * w;
  reachLeg(bn, 'L', nL.lerp(PLANT, w)); aimFoot(bn, 'L', ql.slerp(flat, w));
  reachLeg(bn, 'R', nR.lerp(T, w)); aimFoot(bn, 'R', qn.slerp(qf, w));
  // the contact frame is held as it is; then time moves on
  if (s.hold) s.hold = false; else s.t += dt;
  if (s.t > s.wind + FOLLOW + RECOVER) m.strike = null;
  return w;
}

// Dribbling. p: the sim player; onBall: he has the ball at his feet. Returns how much of a touch the pose is.
export function poseTouch(m, bn, p, ball, onBall, dt) {
  m.onBallK = Math.min(1, Math.max(0, (m.onBallK || 0) + (onBall ? 1 : -1) * dt * 8));
  const k = m.onBallK;
  if (k <= 0) return 0;
  // hand-built legs (your own, or his when he isn't on a captured stride) run either side of the ball, not
  // through it; a captured stride steps round it instead (game/dribblecap.js dribbleFoot)
  const wide = WIDE * k * (1 - (m.capLegs || 0));
  bn.upperLegL.rotation.z += wide; bn.upperLegR.rotation.z -= wide;
  return touchBoot(m, bn, p, ball, k, dt);
}

// Holds. sp: the model's special { kind: 'drag' | 'roulette' | 'stepover', t, dir, yaw, c, rot }. A drag-back
// or a roulette puts the studs on the ball while the sim pulls it in (the roulette's foot turned sp.yaw, with
// the body: game/tricks.js, which then gives the ball to the other sole). A step-over swings the boot over
// the front of the ball without touching, from behind it out to the side of the fake: to his right (sp.dir 1,
// a scissors, inside to outside) or across to his left (-1, outside to inside). The sim bursts him and the
// ball off the other way as the move begins, so the arc is round where the ball was when it began (sp.c, in
// the model's space now; sp.rot: how far the model has turned since) and it is quick; game/tricks.js then
// brings the boot down as his next step.
export function poseHold(m, bn, sp, ball) {
  toModel(m, ball.x, ball.y ?? BALL.r, ball.z, B);
  let w = 0;
  if (sp.kind === 'stepover') {
    const k = sp.t / OVER.time, a = Math.PI * (0.3 + 0.7 * k), dir = sp.dir || 1, rot = sp.rot || 0, c = sp.c || B;
    if (k >= 1) return 0;
    qf.setFromEuler(eul.set(0.1, rot + (dir > 0 ? -0.6 : 0.9) * k, 0));
    K.set(dir * OVER.r * Math.cos(a), 0, OVER.r * Math.sin(a)).applyAxisAngle(UP, rot);
    A.set(c.x + K.x, OVER.y + OVER.rise * Math.sin(a), c.z + K.z).sub(spot.set(0, -0.04, 0.08).applyQuaternion(qf));
    w = smooth(k / 0.3) * (1 - smooth((k - 0.8) / 0.2));
  } else {
    const k = sp.t / HOLD[sp.kind], spin = sp.kind === 'roulette';
    if (k >= 1 || B.z < -0.2 || B.z > 1.1 || Math.abs(B.x) > 0.5) return 0;
    qf.setFromEuler(eul.set(0, spin ? sp.yaw || 0 : 0, 0));
    ankleFor(SOLE, B, qf, A);
    w = smooth(k / 0.15) * (1 - smooth((k - (spin ? 0.5 : 0.55)) / (spin ? 0.16 : 0.25)));
  }
  if (w <= 0) return 0;
  ankleOf(bn, 'R', nR); footOf(bn, 'R', qn);
  nR.lerp(A, w);
  // on its way to and from the circle the step-over's boot goes over the ball, not through it
  if (sp.kind === 'stepover') { const near = 1 - smooth((Math.hypot(nR.x - B.x, nR.z + 0.08 - B.z) - 0.2) / 0.15); nR.y = Math.max(nR.y, 0.36 * near); }
  else nR.y = Math.max(nR.y, A.y * (1 - smooth((Math.hypot(nR.x - B.x, nR.z + 0.06 - B.z) - 0.16) / 0.12)));     // and the sole comes down onto it from above
  reachLeg(bn, 'R', nR); aimFoot(bn, 'R', qn.slerp(qf, w));
  return w;
}
