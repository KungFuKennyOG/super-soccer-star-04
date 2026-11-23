// Going sideways and backwards on recorded strides (CMU motion capture, baked by tools/build-anim.mjs), the way
// game/mocap.js strideLegs puts recorded strides under a man going forward.
//
//   shuffle   78_30, a basketball defender's slide: the trailing foot closes and lands, the lead foot reaches out,
//             the feet never cross, the hips stay low. Recorded going to his left; going right is its mirror.
//   back      141_31, a walk backwards (1.3 m/s): toes down first, the body upright. Nobody in the library backs
//             off at a defender's pace, so this is that walk turned over quicker (the gait's own cadence), with the
//             hips sat a little lower: built, not recorded.
//
// Recorded: the pelvis (how low he sits, its turn and tip through the push) and how the thighs and shins are carried.
// Not recorded: the feet. They are the gait's own (game/gait.js), which grip the pitch: the recorded slide has both feet
// off the floor between steps, and at the sim's speeds a pinned copy of it slipped a frame in ten (tried first, Nov 2026:
// planted feet 1.57 m/s nine frames in ten against the gait's 0.06). So the legs are bent from the recorded pelvis to
// the gait's feet, and the hips keep the recording's sit and a third of its rise and fall. The trunk and arms are the
// game's too (the basketball stance is bent double with the hands up; game/carriage.js already has him).
// Not for your own first-person legs, nor a man on the ball.
import * as THREE from 'three';
import { CLIPS, BONES, sampleStride, mixPose, applyPose, newPose } from './mocap.js';
import { ankleOf, footOf, reachLeg, aimFoot } from './legik.js';

const SIDE = CLIPS.shuffle, BACK = CLIPS.back, NB = BONES.length, REACH = 0.835;
const LEGS = new Set(['hips', 'upperLegL', 'lowerLegL', 'footL', 'toeL', 'upperLegR', 'lowerLegR', 'footR', 'toeR']);
const PAIR = BONES.map(n => (/[LR]$/.test(n) ? BONES.indexOf(n.slice(0, -1) + (n.endsWith('L') ? 'R' : 'L')) : -1));
const RISE = { side: 0, back: -0.03 }, HOP = 0.35;      // m the hips sit above (below) the recording's: the slide is a basketball crouch, the walk stands tall
const smooth = x => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const A = newPose(), B = newPose(), M = newPose(), pt = new THREE.Vector3();
// each recording's hips at their lowest and highest (m)
const range = c => { let lo = 9, hi = 0; if (c) for (let i = 0; i < c.n; i++) { lo = Math.min(lo, c.h[i * 3 + 1]); hi = Math.max(hi, c.h[i * 3 + 1]); } return [lo, hi]; };
const SIT = { side: range(SIDE), back: range(BACK) };
const AV = { L: new THREE.Vector3(), R: new THREE.Vector3() }, AQ = { L: new THREE.Quaternion(), R: new THREE.Quaternion() };

// the pose seen in a mirror down his middle
function mirror(src, out) {
  for (let b = 0; b < NB; b++) { const o = (PAIR[b] < 0 ? b : PAIR[b]) * 4; out.q[o] = src.q[b * 4]; out.q[o + 1] = -src.q[b * 4 + 1]; out.q[o + 2] = -src.q[b * 4 + 2]; out.q[o + 3] = src.q[b * 4 + 3]; }
  out.h[0] = -src.h[0]; out.h[1] = src.h[1]; out.h[2] = src.h[2];
  return out;
}

// How much of his legs are the slide and the backward walk (0..1 each): g is the gait's state.
export function shuffleWeights(m, g, out) {
  const free = (1 - (m.onBallK || 0)) * (m.firstPerson || m.plain ? 0 : 1) * g.mv;      // (m.plain: the look page's before / after switch)
  out.side = SIDE ? free * smooth((Math.abs(g.ux) - 0.55) / 0.3) : 0;
  out.back = BACK ? free * smooth((-g.uz - 0.55) / 0.3) : 0;
  return out;
}

// Call after strideLegs. Returns the weight it took.
const W = { side: 0, back: 0 };
export function shuffleLegs(m, bn, g, dt) {
  const S = m.shuf || (m.shuf = { side: 0, back: 0, dir: 1 });
  shuffleWeights(m, g, W);
  const e = Math.min(1, dt * 12);
  S.side += (W.side - S.side) * e; S.back += (W.back - S.back) * e;
  const w = Math.min(1, S.side + S.back);
  if (w < 0.01) return 0;
  if (Math.abs(g.ux) > 0.3) S.dir = Math.sign(g.ux);
  const ph = g.ph ?? m.phase, kb = S.back / (S.side + S.back);
  // the slide as recorded goes to his left; to his right it is the mirror, half a turn on (so the same foot is down)
  let P = null, rise = 0;
  if (kb < 1) { P = S.dir > 0 ? sampleStride(SIDE, ph, A) : mirror(sampleStride(SIDE, ph + Math.PI, B), A); rise = RISE.side; }
  if (kb > 0) { const Q = sampleStride(BACK, ph, B); P = P ? mixPose(P, Q, kb, M) : Q; rise += (RISE.back - rise) * kb; }
  // The feet stay the gait's own (game/gait.js: a planted foot goes back under him at his own speed, so it grips): where
  // they are is kept, the recording is put on the pelvis and legs, and the legs are bent again to those feet.
  for (const n of 'LR') { ankleOf(bn, n, AV[n]); footOf(bn, n, AQ[n]); }
  const h = bn.hips.position, y0 = h.y;
  applyPose(bn, P, w, LEGS);
  // the recording's hop has both feet off the floor; with the feet on the grass the hips keep its sit and only part of its
  // rise and fall (HOP), and never sit higher than both legs reach
  const sit = Math.min(...(kb < 0.5 ? SIT.side : SIT.back)), bob = P.h[1] - sit;
  h.y = y0 + (sit + bob * HOP + rise - y0) * w;
  let top = 9;
  for (const n of 'LR') {
    pt.set(n === 'L' ? 0.09 : -0.09, -0.02, 0).applyQuaternion(bn.hips.quaternion);
    const dx = AV[n].x - h.x - pt.x, dz = AV[n].z - h.z - pt.z;
    top = Math.min(top, AV[n].y - pt.y + Math.sqrt(Math.max(0.01, REACH * REACH - dx * dx - dz * dz)));
  }
  h.y = Math.min(h.y, top);
  for (const n of 'LR') { reachLeg(bn, n, AV[n]); aimFoot(bn, n, AQ[n]); }
  return w;
}
