// Recorded keeper moves (CMU captures baked by tools/build-anim.mjs as 'once' clips): sampling them.
import * as THREE from 'three';
import { CLIPS, BONES, newPose } from './mocap.js';

const NB = BONES.length, slerp = THREE.Quaternion.slerpFlat, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
for (const c of Object.values(CLIPS)) if (c.a && !(c.a instanceof Float32Array)) c.a = new Float32Array(c.a);
export const newOnce = () => Object.assign(newPose(), { a: new Float32Array(6) });

// The pose `t` seconds into a one-shot clip (held on its last pose after the end).
export function sampleOnce(clip, t, out) {
  const f = clamp(t * clip.hz, 0, clip.n - 1.001), i0 = Math.floor(f), k = f - i0;
  for (let b = 0; b < NB; b++) slerp(out.q, b * 4, clip.q, (i0 * NB + b) * 4, clip.q, ((i0 + 1) * NB + b) * 4, k);
  for (let j = 0; j < 3; j++) out.h[j] = clip.h[i0 * 3 + j] + (clip.h[i0 * 3 + 3 + j] - clip.h[i0 * 3 + j]) * k;
  for (let j = 0; j < 6; j++) out.a[j] = clip.a[i0 * 6 + j] + (clip.a[i0 * 6 + 6 + j] - clip.a[i0 * 6 + j]) * k;
  return out;
}

// Getting up off the grass after a dive (140_03 'get up laying on side', from 2.5 s in: lying on his side, up onto
// his hip and a hand, through a crouch to standing: 4.1 s as recorded, played faster by the caller). He lies as the
// dive left him: the recording is seen in a mirror if he lies on the other side, and turned about so his head points
// the way he dived; that turn is let go as he comes up off his hip, so he stands facing play.
const G = CLIPS.getup, gp = newOnce(), gm = newOnce();
const PAIR = BONES.map(n => (/[LR]$/.test(n) ? BONES.indexOf(n.slice(0, -1) + (n.endsWith('L') ? 'R' : 'L')) : -1));
// the pose seen in a mirror down his middle: left and right change places, every turn is reflected
function mirror(src, out) {
  for (let b = 0; b < NB; b++) {
    const o = (PAIR[b] < 0 ? b : PAIR[b]) * 4;
    out.q[o] = src.q[b * 4]; out.q[o + 1] = -src.q[b * 4 + 1]; out.q[o + 2] = -src.q[b * 4 + 2]; out.q[o + 3] = src.q[b * 4 + 3];
  }
  out.h[0] = -src.h[0]; out.h[1] = src.h[1]; out.h[2] = src.h[2];
  return out;
}
const HI = BONES.indexOf('hips'), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), v = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
// how the recording lies at its start: which way his head points and his chest faces (on the grass's plane)
const lie = G ? (() => {
  q.fromArray(G.q, HI * 4);
  const head = new THREE.Vector3(0, 1, 0).applyQuaternion(q).setY(0).normalize(), chest = new THREE.Vector3(0, 0, 1).applyQuaternion(q).setY(0).normalize();
  return { head: Math.atan2(head.x, head.z), hand: Math.sign(head.z * chest.x - head.x * chest.z) || 1 };
})() : null;
const SIT = 1.25;                                    // s into the recording: sitting up on his hip, about to come up
export const GETUP = { length: G ? (G.n - 1) / G.hz : 0 };
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
// Poses the get-up `t` seconds in (as recorded) over whatever pose he has, by w; s: which way the dive went (+1 his
// left); from: where his hips lie (model space): the recording starts there.
export function getupPose(bn, t, s, from, w = 1) {
  if (!G) return false;
  // lying with his head toward the dive's side and his chest to the pitch: head (s, 0, 0), chest (0, 0, 1)
  const flip = lie.hand !== s;
  let p = sampleOnce(G, t, gp);
  if (flip) p = mirror(p, gm);
  const yaw = (s * Math.PI / 2 - (flip ? -lie.head : lie.head)) * (1 - ease((t - SIT) / Math.max(0.3, GETUP.length - SIT - 0.4)));
  qy.setFromAxisAngle(UP, yaw);
  for (let b = 0; b < NB; b++) { q.fromArray(p.q, b * 4); if (b === HI) q.premultiply(qy); bn[BONES[b]].quaternion.slerp(q, w); }
  v.set(p.h[0] - (flip ? -G.h[0] : G.h[0]), 0, p.h[2] - G.h[2]).applyQuaternion(qy);
  const hp = bn.hips.position;
  hp.x += (v.x + from.x - hp.x) * w; hp.y += (p.h[1] - hp.y) * w; hp.z += (v.z + from.z - hp.z) * w;
  return true;
}
