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

// Getting up off the grass after a dive (140_03 'get up laying on side', from sitting on his hip with his legs to one
// side, up through a crouch to standing: 3.2 s as recorded, played faster by the caller). Recorded with his legs
// off to his right (the side a dive to his left lands him on); for a dive to his right it is seen in a mirror.
const G = CLIPS.getup, gp = newOnce(), gm = newOnce();
export const GETUP = { length: G ? (G.n - 1) / G.hz : 0, side: G ? Math.sign(G.h[0] - (G.a[0] + G.a[3]) / 2) || 1 : 1 };
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
// Poses the get-up `t` seconds in (as recorded) over whatever pose he has, by w; s: which way the dive went (+1 his
// left); from: where his hips were lying (model space): the recording is moved to start there.
const q = new THREE.Quaternion();
export function getupPose(bn, t, s, from, w = 1) {
  if (!G) return false;
  let p = sampleOnce(G, t, gp);
  if (Math.sign(s) !== GETUP.side) p = mirror(p, gm);
  const x0 = p === gm ? -G.h[0] : G.h[0], z0 = G.h[2];
  for (let b = 0; b < NB; b++) { q.fromArray(p.q, b * 4); bn[BONES[b]].quaternion.slerp(q, w); }
  const hp = bn.hips.position;
  hp.x += (p.h[0] - x0 + from.x - hp.x) * w; hp.y += (p.h[1] - hp.y) * w; hp.z += (p.h[2] - z0 + from.z - hp.z) * w;
  return true;
}
