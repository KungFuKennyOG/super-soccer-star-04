// Kicks from motion capture: a shot, a pass or a volley is a recorded kick (game/assets/anim/clips.js,
// kind 'kick', baked by tools/build-anim.mjs) played round the frame the sim launches the ball on, with the
// boot put on the ball by IK on that frame (game/strike.js works out where: its STYLE says which part of
// the boot meets it). What is the capture's: the kicking leg's path and the fold and whip of its knee, the
// plant leg, the pelvis turning through, the trunk, the arms. What is not:
//   time     the sim gives your own strike 3 or 6 frames of wind-up (STRIKE in rules/tuning.js) and anyone
//            else's none, where a real downswing takes 0.17 to 0.2 s. So the wind-up plays the last of the
//            captured downswing faster than life (`warp` times at most; what doesn't fit is never seen) and
//            a strike with no wind-up starts on the contact pose: the kicking leg at once, the rest of him
//            eased in over a few frames (EASE). The follow-through is at life speed, cut short at a run.
//   place    the ball is straight ahead of him (the sim's), where a real one is struck out to the side of
//            the plant foot: the hips go only part of the way over (HIPS) and the legs are bent to the rest.
//   aim      the capture kicks straight ahead; the kicking leg's path is turned to where the ball goes and
//            the body follows part of the way (BODY).
//   ground   he keeps the speed the sim gives him where the man recorded all but stopped: the plant foot is
//            kept on its spot of the pitch for as long as the leg reaches, then let go to the run (GRASS).
//   ankle    held as it met the ball, toes pointed, into the follow-through (LOCK, `point`): from coaching.
// Your own first-person legs get the same paths under hips that stay centred and unturned.
// Left-footed players are mirrored whole by game/actors.js: here every kick is the right boot's.
import * as THREE from 'three';
import { CLIPS, BONES, newPose, applyPose } from './mocap.js';
import { ankleOf, footOf, aimFoot } from './legik.js';

// Which recorded kick each kind of strike is. clips: [soft, hard], mixed by power (one take each for now); warp: how much faster than
// life the downswing may play in a wind-up; follow: seconds of follow-through before he eases back to his run;
// pace: about how fast the ball leaves (m/s: only to keep the plant foot out of its way); point: how much further
// the toes are pointed through the follow-through than they were on the ball (rad: coaching, not capture).
//   shot     subject 11's kick (11_01): the hardest football kick in the library, off the inside of the instep,
//            followed through across the body with a hop. The boot is turned to the laces on the ball (STYLE).
//   pass     the inside of the foot: subject 10's side-foot kick (10_01)
//   volley   no capture of one: the shot's contact and follow-through with the boot lifted to the ball, the knee
//            high over it and the trunk tipped a little forward (how a volley is coached: `lean`)
// A chip (a shot let go at once: little power) is the shot with a short backswing, stopped short with the boot
// kept low, the trunk a little back: a stab under the ball (how a chip is coached; no capture of one).
const KICKS = {
  shot: { clips: [CLIPS.kickShot, CLIPS.kickShot], warp: 1.6, follow: 0.27, pace: 22, point: 0.25 },
  pass: { clips: [CLIPS.kickPass, CLIPS.kickPass], warp: 2, follow: 0.2, pace: 16, point: 0 },
  volley: { clips: [CLIPS.kickShot, CLIPS.kickShot], warp: 1.6, follow: 0.24, pace: 24, point: 0.25, lean: true },
};
const RECOVER = 0.2, NEAR = 0.09, LOCK = [0.08, 0.3], LEAN = { volley: 0.1, chip: -0.09 };     // s back to the run; s either side of contact the boot is steered to the ball; s the ankle stays locked after it, then lets go over; the trunk tipped forward over a volley, back under a chip (rad)
const HIPS = { x: 0.26, z: 0.25, drop: 0.06 }, BODY = { share: 0.7, max: 0.75 }, EASE = 22;   // how far the hips may go over (m), how much of the aim the body takes (rad), how fast the body joins a kick (1/s)
const GRASS = { ahead: 0.4, hold: 0.28, let: 0.3 };       // the plant foot on a moving man: how far ahead of its place it may land, how far he goes on before it lifts, and it is let go over (m)
const PLANT = { min: 0.2, max: 0.3, ahead: 0.2, left: 1.3, right: -0.35 }, SOLE = 0.085, CLEAR = 0.2;      // the plant foot beside the ball: m to the left of its path and at most ahead of the kicking ankle; how far it goes round with the path (rad)
const LEGL = new Set(['upperLegL', 'lowerLegL', 'footL', 'toeL']), LEGR = new Set(['upperLegR', 'lowerLegR', 'footR', 'toeR']);
const TRUNK = new Set(['spine', 'chest', 'clavicleL', 'upperArmL', 'foreArmL', 'clavicleR', 'upperArmR', 'foreArmR']);
const NB = BONES.length, IDX = Object.fromEntries(BONES.map((n, i) => [n, i])), slerp = THREE.Quaternion.slerpFlat;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), smooth = x => { const k = clamp(x, 0, 1); return k * k * (3 - 2 * k); };

export const isKick = kind => !!(KICKS[kind] && KICKS[kind].clips[0]);
const newKick = () => Object.assign(newPose(), { a: new Float32Array(6) });

// A recorded kick `tau` seconds from its contact (before: negative) → out { q, h, a }.
export function sampleKick(clip, tau, out) {
  const f = clamp(clip.c + tau * clip.hz, 0, clip.n - 1.001), i0 = Math.floor(f), k = f - i0;
  for (let b = 0; b < NB; b++) slerp(out.q, b * 4, clip.q, (i0 * NB + b) * 4, clip.q, ((i0 + 1) * NB + b) * 4, k);
  for (let j = 0; j < 3; j++) out.h[j] = clip.h[i0 * 3 + j] + (clip.h[i0 * 3 + 3 + j] - clip.h[i0 * 3 + j]) * k;
  for (let j = 0; j < 6; j++) out.a[j] = clip.a[i0 * 6 + j] + (clip.a[i0 * 6 + 6 + j] - clip.a[i0 * 6 + j]) * k;
  return out;
}
const S1 = newKick();
function sample(K, mixk, tau, out) {
  sampleKick(K.clips[0], tau, out);
  if (mixk <= 0 || K.clips[1] === K.clips[0]) return out;
  sampleKick(K.clips[1], tau, S1);
  for (let b = 0; b < NB; b++) slerp(out.q, b * 4, out.q, b * 4, S1.q, b * 4, mixk);
  for (let j = 0; j < 3; j++) out.h[j] += (S1.h[j] - out.h[j]) * mixk;
  for (let j = 0; j < 6; j++) out.a[j] += (S1.a[j] - out.a[j]) * mixk;
  return out;
}

const H = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3(), to = new THREE.Vector3(), ax = new THREE.Vector3(), fold = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const qU = new THREE.Quaternion(), qL = new THREE.Quaternion(), qr = new THREE.Quaternion(), qi = new THREE.Quaternion();
// Moves a leg's ankle to `target` (model space) from the pose it is in, keeping the way its knee points: the
// knee is opened or closed in its own plane, then the whole leg is swung from the hip the short way round.
export function nudgeLeg(bn, n, target) {
  const up = bn['upperLeg' + n], lo = bn['lowerLeg' + n], ft = bn['foot' + n], h = bn.hips;
  const L1 = lo.position.length(), L2 = ft.position.length();
  H.copy(up.position).applyQuaternion(h.quaternion).add(h.position);
  qU.copy(h.quaternion).multiply(up.quaternion); qL.copy(qU).multiply(lo.quaternion);
  u.copy(lo.position).applyQuaternion(qU); v.copy(ft.position).applyQuaternion(qL);       // hip to knee, knee to ankle
  to.subVectors(target, H);
  const want = to.length(), D = clamp(want, Math.abs(L1 - L2) + 0.03, L1 + L2 - 0.004);
  const bend = Math.acos(clamp((D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1));
  let now = u.angleTo(v);
  ax.crossVectors(u, v);
  fold.copy(X).applyQuaternion(qU);                              // the way a knee folds
  if (ax.lengthSq() < 1e-8 || ax.dot(fold) < 0) { if (ax.dot(fold) < 0) now = -now; ax.copy(fold); }
  ax.normalize();
  qr.setFromAxisAngle(ax, bend - now); qL.premultiply(qr); v.applyQuaternion(qr);
  if (want > 1e-6) { qr.setFromUnitVectors(u.add(v).normalize(), to.multiplyScalar(1 / want)); qU.premultiply(qr); qL.premultiply(qr); }
  up.quaternion.copy(qi.copy(h.quaternion).invert().multiply(qU)); lo.quaternion.copy(qi.copy(qU).invert().multiply(qL));
}

const nR = new THREE.Vector3(), nL = new THREE.Vector3(), tR = new THREE.Vector3(), tL = new THREE.Vector3(), pt = new THREE.Vector3(), fwd = new THREE.Vector3();
const fR = new THREE.Quaternion(), fL = new THREE.Quaternion(), gR = new THREE.Quaternion(), gL = new THREE.Quaternion(), qb = new THREE.Quaternion(), qk = new THREE.Quaternion(), qh = new THREE.Quaternion();
// which way a foot points in a sampled pose, in the capture's own frame (out)
const footIn = (P, n, out) => out.fromArray(P.q, 0).multiply(qi.fromArray(P.q, IDX['upperLeg' + n] * 4)).multiply(qi.fromArray(P.q, IDX['lowerLeg' + n] * 4)).multiply(qi.fromArray(P.q, IDX['foot' + n] * 4));
// the lowest point of a boot's sole below its ankle when it points as q says (heel, ball of the foot, toe)
const under = q => Math.min(pt.set(0.05, -SOLE, -0.1).applyQuaternion(q).y, pt.set(-0.05, -SOLE, -0.1).applyQuaternion(q).y, pt.set(0.04, -SOLE, 0.2).applyQuaternion(q).y, pt.set(-0.04, -SOLE, 0.2).applyQuaternion(q).y);

// Poses the hips and legs of a kick in progress. s: the model's m.strike (game/strike.js); A: where the ankle
// is with the boot on the ball, qf: how the foot is turned then, turn: where the ball goes off his heading
// (rad), B: the ball, all in model space. Returns how much of a kick the pose is (0..1).
export function poseKick(m, bn, s, A, qf, turn, dt, B) {
  const K = KICKS[s.kind], c0 = K.clips[0], first = !!m.firstPerson, after = s.t - s.wind, pw = s.power ?? 0.5;
  // (a chip is stopped short; a man at a run has his next stride to take, where the man recorded stood and watched)
  const chip = s.kind === 'shot' ? 1 - smooth((pw - 0.15) / 0.12) : 0, follow = K.follow * (1 - 0.5 * chip) * (1 - 0.4 * smooth((m.gait ? m.gait.s : 0) / 6));
  let tau, w;
  if (after < 0) {
    // the wind-up: the end of the downswing, as much of it as the time allows
    const lead = c0.c / c0.hz, span = s.wind > c0.top ? Math.min(s.wind, lead) : Math.min(c0.top, s.wind * K.warp), k = s.t / s.wind;
    tau = -span * (1 - 0.4 * chip) * (1 - k); w = smooth(k / 0.35);             // (a chip's backswing is short)
  } else { tau = after * (1 - 0.7 * chip); w = 1 - smooth((after - follow) / RECOVER); }
  const kk = m.kick || (m.kick = { P: newKick(), s: null, w: 0, wb: 0, live: false, tip: 0, lock: new THREE.Quaternion(), g: {} }), P = kk.P, mixk = smooth((pw - 0.45) / 0.45) * (1 - chip);
  if (kk.s !== s) { kk.s = s; kk.wb = 0; Object.assign(kk.g, { on: false, seen: false, x: 0, z: 0, lx: 0, lz: 0, bx: 0, bz: 0 }); }      // a new strike
  sample(K, mixk, tau, P);
  // the boot has to be on the ball on the contact frame however little warning there was (and the plant foot
  // out of its way); the rest of him (hips, trunk, arms) is eased into the kick over a few frames instead of jumping
  const wb = kk.wb = w < kk.wb ? w : kk.wb + (w - kk.wb) * Math.min(1, dt * EASE);
  const near = 1 - smooth(Math.abs(tau) / NEAR), bt = first ? 0 : clamp(turn * BODY.share, -BODY.max, BODY.max);
  const a0 = c0.a[c0.c * 6 + 1] + (K.clips[1].a[K.clips[1].c * 6 + 1] - c0.a[c0.c * 6 + 1]) * mixk;      // the captured ankle's height at contact
  // where the run has the feet
  const h = bn.hips, g = m.gait;
  ankleOf(bn, 'R', nR); ankleOf(bn, 'L', nL); footOf(bn, 'R', fR); footOf(bn, 'L', fL);
  // the capture stands where its kicking ankle at contact is ours (A), turned with the ball's direction: the
  // kicking leg all the way, the body part of it
  const cb = Math.cos(bt), sb = Math.sin(bt), ck = Math.cos(turn), sk = Math.sin(turn);
  tR.set(A.x + P.a[0] * ck + P.a[2] * sk, P.a[1] + (A.y - a0) * near, A.z - P.a[0] * sk + P.a[2] * ck);
  if (after > 0) tR.y -= (P.a[1] - a0) * chip;                     // a chip's boot stays down: it has gone under the ball, not through it
  // (the plant foot is beside the ball as its path sees it: a pass across him has it behind the ball, not in its way)
  const pl = clamp(turn, PLANT.right, PLANT.left), cp = Math.cos(pl), sp = Math.sin(pl), px = clamp(P.a[3], PLANT.min, PLANT.max), pz = Math.min(P.a[5], PLANT.ahead);
  tL.set(A.x + px * cp + pz * sp, P.a[4], A.z - px * sp + pz * cp);
  qb.setFromAxisAngle(Y, bt); qk.setFromAxisAngle(Y, turn);
  footIn(P, 'R', gR).premultiply(qk).slerp(qf, near); footIn(P, 'L', gL).premultiply(qb);
  // and it stands clear of the ball and of the way the ball leaves (as he sees it leave: he is moving too):
  // moved further out to its own side of that if it isn't
  const ry = m.root.rotation.y, vx = g ? g.s * g.ux : 0, vz = g ? g.s * g.uz : 0;
  const rx = s.dir.x * Math.cos(ry) - s.dir.z * Math.sin(ry) - vx / K.pace, rz = s.dir.x * Math.sin(ry) + s.dir.z * Math.cos(ry) - vz / K.pace, rl = Math.hypot(rx, rz) || 1, dx = rx / rl, dz = rz / rl;
  fwd.set(0, 0, 1).applyQuaternion(gL).setY(0).normalize();
  const side = (tL.x - B.x) * dz - (tL.z - B.z) * dx < 0 ? -1 : 1;
  let push = 0;
  for (const along of [-0.1, 0.05, 0.2]) {
    const ox = tL.x + fwd.x * along - B.x, oz = tL.z + fwd.z * along - B.z, on = ox * dx + oz * dz;
    if (on > -CLEAR && on < 0.7) push = Math.max(push, CLEAR - side * (ox * dz - oz * dx));
  }
  push = side * Math.min(push, 0.35) * smooth(1 - (tL.y - 0.2) / 0.15); tL.x += dz * push; tL.z -= dx * push;
  // The grass under him: the man recorded all but stopped to kick, and he keeps the speed the sim gives him.
  // So the plant foot comes down ahead of its place, where the pitch will have carried it there by the contact
  // (the ball is still coming to its own place then: bv), stays on that spot of the pitch as he goes over it,
  // and once the leg has no more to give is let go to the run.
  const G = kk.g, rt = after < 0 ? s.t - s.wind : after, speed = Math.hypot(vx, vz), gone = smooth((speed * rt - GRASS.hold) / GRASS.let);
  if (dt > 0 && G.seen) { G.bx = (B.x - G.lx) / dt; G.bz = (B.z - G.lz) / dt; }
  G.seen = true; G.lx = B.x; G.lz = B.z;
  if (G.on) { G.x -= vx * dt; G.z -= vz * dt; } else if (after >= 0 || w > 0.9) {
    const k = after < 0 ? Math.min(-rt, GRASS.ahead / (Math.hypot(vx + G.bx, vz + G.bz) || 1)) : 0;
    G.on = true; G.x = tL.x + (vx + G.bx) * k; G.z = tL.z + (vz + G.bz) * k;
    for (const along of [0.2, 0.05, -0.1]) {          // (not onto the ball where it is now, either)
      const ox = G.x + fwd.x * along - B.x, oz = G.z + fwd.z * along - B.z, d = Math.hypot(ox, oz) || 1, short = Math.max(0, CLEAR + 0.02 - d);
      G.x += ox / d * short; G.z += oz / d * short;
    }
  }
  if (G.on) { tL.x = G.x; tL.z = G.z; }
  const wp = w * (1 - gone);
  if (first) h.position.y -= clamp(h.position.y - P.h[1], 0, HIPS.drop) * wb;
  else {
    const ox = A.x + P.h[0] * cb + P.h[2] * sb - h.position.x, oz = A.z - P.h[0] * sb + P.h[2] * cb - h.position.z;
    h.position.x += clamp(ox, -HIPS.x, HIPS.x) * wb; h.position.z += clamp(oz, -HIPS.z, HIPS.z) * wb; h.position.y += (P.h[1] - h.position.y) * wb;
    h.quaternion.slerp(qh.fromArray(P.q, 0).premultiply(qb), wb);
  }
  applyPose(bn, P, wp, LEGL); applyPose(bn, P, w, LEGR);
  // (no part of a sole under the grass; on the contact frame the kicking boot is where the ball says)
  fL.slerp(gL, wp); nL.lerp(tL, wp); nL.y = Math.max(nL.y, -under(fL));
  // (whatever the run had the left boot doing as the strike began, it isn't on the ball: on the ball he now runs
  // on recorded strides, game/dribblecap.js, and the ball is drawn in toward him through the wind-up)
  fwd.set(0, 0, 1).applyQuaternion(fL).setY(0).normalize();
  if (nL.y < 0.3) for (const along of [0.2, 0.05, -0.1, 0.2, 0.05]) {
    const ox = nL.x + fwd.x * along - B.x, oz = nL.z + fwd.z * along - B.z, d = Math.hypot(ox, oz) || 1, short = Math.max(0, CLEAR + 0.03 - d);
    nL.x += ox / d * short; nL.z += oz / d * short;
  }
  fR.slerp(gR, w); nR.lerp(tR, w); if (near * w < 0.99) nR.y = Math.max(nR.y, -under(fR));
  nudgeLeg(bn, 'L', nL); aimFoot(bn, 'L', fL);
  nudgeLeg(bn, 'R', nR); aimFoot(bn, 'R', fR);
  // the ankle stays locked as it met the ball (toes pointed for the laces, turned out for the inside of the
  // foot) well into the follow-through: the people recorded let theirs go slack at once (coaching, not capture)
  if (after <= 0) kk.lock.copy(bn.footR.quaternion);
  else {
    bn.footR.quaternion.slerp(qr.setFromAxisAngle(X, K.point * smooth(after / 0.05)).premultiply(kk.lock), w * (1 - smooth((after - LOCK[0]) / LOCK[1])));
    const low = -under(footOf(bn, 'R', fR));                     // (pointed toes need the ankle higher off the grass)
    if (nR.y < low) { nR.y = low; nudgeLeg(bn, 'R', nR); }
  }
  kk.w = wb; kk.live = !first; kk.tip = K.lean ? LEAN.volley * smooth((A.y - 0.3) / 0.4) : LEAN.chip * chip;
  // the contact frame is held as it is; then time moves on
  if (s.hold) s.hold = false; else s.t += dt;
  if (s.t > s.wind + follow + RECOVER) m.strike = null;
  return w;
}

// The same kick above the hips: the trunk and the arms (hands are left as they were: captured wrists are
// noise). Call it after the upper body is posed, in place of the hand-built strike layer; false: no captured
// kick is on, lay that one on.
export function kickTrunk(m, bn) {
  const kk = m.kick;
  if (!kk || !kk.live) return false;
  kk.live = false;
  applyPose(bn, kk.P, kk.w, TRUNK);
  // what coaching says of the two kicks nobody recorded: over a ball met in the air he leans a little forward,
  // knee high over it, to keep it down; under a chip he leans a little back
  if (kk.tip) bn.spine.quaternion.premultiply(qr.setFromAxisAngle(X, kk.tip * kk.w));
  return true;
}
