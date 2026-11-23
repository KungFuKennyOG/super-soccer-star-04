// Going sideways and backwards on recorded strides (CMU motion capture, baked by tools/build-anim.mjs), the way
// game/mocap.js strideLegs puts recorded strides under a man going forward.
//
//   shuffle   78_30, a basketball defender's slide: the trailing foot closes and lands, the lead foot reaches out,
//             the feet never cross, the hips stay low. Recorded going to his left; going right is its mirror.
//   back      141_31, a walk backwards (1.3 m/s): toes down first, the body upright. Nobody in the library backs
//             off at a defender's pace, so this is that walk turned over quicker (the gait's own cadence), with the
//             hips sat a little lower: built, not recorded.
//
// Recorded: the pelvis and both legs. Not recorded: the trunk and arms (the basketball stance is bent double with
// the hands up: a footballer jockeying is more upright, and game/carriage.js already has him), how far the feet
// reach (scaled to the ground the gait covers in a turn of its cycle), and the foot on the grass (pinned to its
// spot on the pitch while it bears weight, as strideLegs pins it).
// Not for your own first-person legs, nor a man on the ball.
import * as THREE from 'three';
import { CLIPS, BONES, sampleStride, mixPose, applyPose, newPose } from './mocap.js';
import { ankleOf, footOf, reachLeg, aimFoot } from './legik.js';

const SIDE = CLIPS.shuffle, BACK = CLIPS.back, NB = BONES.length, SOLE = 0.085, REACH = 0.835;
const LEGS = new Set(['hips', 'upperLegL', 'lowerLegL', 'footL', 'toeL', 'upperLegR', 'lowerLegR', 'footR', 'toeR']);
const PAIR = BONES.map(n => (/[LR]$/.test(n) ? BONES.indexOf(n.slice(0, -1) + (n.endsWith('L') ? 'R' : 'L')) : -1));
const RISE = { side: 0, back: -0.03 };      // m the hips sit above (below) the recording's: the slide is a basketball crouch, the walk stands tall
const smooth = x => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); }, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const A = newPose(), B = newPose(), M = newPose(), pt = new THREE.Vector3();
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
  const S = m.shuf || (m.shuf = { side: 0, back: 0, dir: 1, L: { on: false, wx: 0, wz: 0, ox: 0, oz: 0, oy: 0, pu: null }, R: { on: false, wx: 0, wz: 0, ox: 0, oz: 0, oy: 0, pu: null } });
  shuffleWeights(m, g, W);
  const e = Math.min(1, dt * 12);
  S.side += (W.side - S.side) * e; S.back += (W.back - S.back) * e;
  const w = Math.min(1, S.side + S.back);
  if (w < 0.01) { for (const n of 'LR') { S[n].on = false; S[n].ox = S[n].oz = S[n].oy = 0; S[n].pu = null; } return 0; }
  if (Math.abs(g.ux) > 0.3) S.dir = Math.sign(g.ux);
  const ph = g.ph ?? m.phase, kb = S.back / (S.side + S.back);
  // the slide as recorded goes to his left; to his right it is the mirror, half a turn on (so the same foot is down)
  let P = null, len = 0, rise = 0;
  if (kb < 1) { P = S.dir > 0 ? sampleStride(SIDE, ph, A) : mirror(sampleStride(SIDE, ph + Math.PI, B), A); len = SIDE.speed * SIDE.period; rise = RISE.side; }
  if (kb > 0) { const Q = sampleStride(BACK, ph, B); P = P ? mixPose(P, Q, kb, M) : Q; len += (BACK.speed * BACK.period - len) * kb; rise += (RISE.back - rise) * kb; }
  applyPose(bn, P, w, LEGS);
  const h = bn.hips.position, ux = g.ux, uz = g.uz, k = (clamp((g.cover || len) / len, 0.45, 1.35) - 1) * w;
  // at less than the recording's pace the hop between steps is smaller (hs), and the hips ride nearer its low point
  const hs = kb + (1 - kb) * clamp(g.s / 3.2, 0.45, 0.8);
  h.y += rise * w;
  const rp = m.root.position, ry = m.root.rotation.y, c = Math.cos(ry), sn = Math.sin(ry), fade = Math.exp(-dt * 14);
  let top = 9;
  for (const n of 'LR') {
    const a = ankleOf(bn, n, AV[n]), L = S[n];
    footOf(bn, n, AQ[n]);
    // reached as far along his way as the ground he covers in a turn of the cycle
    const rel = (a.x - h.x) * ux + (a.z - h.z) * uz;
    a.x += ux * rel * k; a.z += uz * rel * k;
    a.y -= Math.max(0, a.y - 0.11) * (1 - hs) * w;
    if (n === 'L') h.y -= Math.max(0, h.y - 0.8) * (1 - hs) * 0.8 * w;      // (and the hips bob less)
    // a foot bearing weight keeps its spot on the pitch (the ball of the foot down and going back under him)
    const ball = pt.set(0, -SOLE, 0.1).applyQuaternion(AQ[n]), bx = a.x + ball.x, bz = a.z + ball.z, by = a.y + ball.y, along = bx * ux + bz * uz;
    const back = dt > 0 && L.pu !== null ? (along - L.pu) / dt : 0;
    L.pu = along;
    const down = w > 0.9 && dt > 0 && (L.on ? by < 0.075 && back < -0.15 * g.s : by < 0.045 && back < -0.4 * g.s);
    if (down) {
      if (!L.on) { L.on = true; const mx = bx + L.ox, mz = bz + L.oz; L.wx = rp.x + mx * c + mz * sn; L.wz = rp.z - mx * sn + mz * c; }
      const dx = L.wx - rp.x, dz = L.wz - rp.z;
      L.ox = dx * c - dz * sn - bx; L.oz = dx * sn + dz * c - bz;
      if (Math.hypot(L.ox, L.oz) > 0.22) L.on = false;
    } else if (dt > 0) L.on = false;
    if (!L.on) { L.ox *= fade; L.oz *= fade; }
    a.x += L.ox; a.z += L.oz;
    const low = Math.min(ball.y, pt.set(0, -SOLE, -0.09).applyQuaternion(AQ[n]).y, pt.set(0, -0.04, 0.2).applyQuaternion(AQ[n]).y);
    L.oy += ((L.on ? -low - a.y : 0) - L.oy) * Math.min(1, dt * 30);
    a.y = Math.max(-low, a.y + L.oy);
    pt.set(n === 'L' ? 0.09 : -0.09, -0.02, 0).applyQuaternion(bn.hips.quaternion);
    const dx = a.x - h.x - pt.x, dz = a.z - h.z - pt.z;
    top = Math.min(top, a.y - pt.y + Math.sqrt(Math.max(0.01, REACH * REACH - dx * dx - dz * dz)));
  }
  // the slide's feet close up but never touch or cross: at least a foot's width between the ankles across his way
  if (S.side > 0.3) { const gap = ((AV.L.x - AV.R.x) * ux + (AV.L.z - AV.R.z) * uz) * S.dir, lack = Math.max(0, 0.27 - gap) * 0.5 * S.side * S.dir; AV.L.x += ux * lack; AV.L.z += uz * lack; AV.R.x -= ux * lack; AV.R.z -= uz * lack; }
  h.y = Math.min(h.y, top);
  for (const n of 'LR') { reachLeg(bn, n, AV[n]); aimFoot(bn, n, AQ[n]); }
  return w;
}
