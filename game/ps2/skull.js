// Every '04 player's own head shape. headgeo.js builds one skull for everyone; this reshapes it per
// look, inside the range real adult men span, so a line-up reads as different men and not one head
// with different paint. It is a smooth warp of the head's vertices in the head's own (phi, t) frame,
// applied to a copy of the built figure: the scalp, the hair shell standing off it, the cards and the
// ponytail all sit at the same (phi, t) and move together, so the hair still ends inside the painted
// hairline; the sheet's uvs are untouched, so face.js's paint lands where it always did; the warp fades
// out down the neck (by the head bone's weight), so the neck joins as before. Ears move with the skull
// under them as one piece and are sized about their root.
//
// Ranges: the extremes are about +-2.5 standard deviations of adult male anthropometry (head length
// 197 mm SD 7, breadth 152 SD 6, bigonial (jaw) 107 SD 7, face height SD about 6 mm, nose protrusion SD
// about 10%, ear length 63 SD 4), drawn from a triangular spread so most men are near the middle: length
// +-4.5%, breadth +-5%, jaw +-14%, face +-10 mm, nose +-28%, ears +-9%. (At +-2 SD from the front a line-up
// still read as one head.) Features that run right across the face (the brow) stay
// gentle: under the top light a broad ledge shades as a dark band.
import * as THREE from 'three';
import { HEAD, F, NOSE, headPoint } from './headgeo.js';
import { smoothNormals, BONE } from './build.js';
import { hash, gauss as g, sstep } from './paint.js';

const HEADBONE = BONE.head;

// The shape for a seed (a look's face number). nose: rules/looks.js's paint-only nose width (-0.08..0.14),
// so a broad painted nose also stands off the face a little more. Each is a triangular spread in -1..1.
export function skullOf(seed, nose = 0) {
  const n = k => hash(seed | 0, k, 41) + hash(seed | 0, k + 50, 43) - 1;
  return {
    len: 1 + 0.045 * n(1),                 // face forward and back of the head back: head length
    wid: 1 + 0.05 * n(2),                  // the cranium's breadth
    back: 1 + 0.08 * n(3),                 // the occiput: flat (under 1) or rounded out
    slope: 0.006 * n(4),                  // the forehead swept back (+) or upright (-), metres at the hairline
    brow: 0.0015 * n(5),                   // the brow ridge (gentle)
    cheek: 0.0045 * n(6),                  // cheekbones out to the sides
    jaw: 1 + 0.14 * n(7),                  // the jaw's breadth at its corners
    chin: 0.006 * n(8),                   // the chin forward
    drop: 0.01 * n(9),                    // the chin lower (a longer face)
    nose: 1 + 0.28 * n(10) + 1.2 * nose,    // how far the nose stands off the face
    bridge: 0.002 * n(11),                // a high or low bridge between the eyes
    ear: 1 + 0.09 * n(12),
  };
}
export const NEUTRAL = { len: 1, wid: 1, back: 1, slope: 0, brow: 0, cheek: 0, jaw: 1, chin: 0, drop: 0, nose: 1, bridge: 0, ear: 1 };
const key = s => Object.values(s).map(v => v.toFixed(3)).join(',');

// Where a point of the bind-pose head goes for skull s.
export function warpPoint(s, x, y, z) {
  const t = (HEAD.top - y) / HEAD.h, zc = z - HEAD.cz, phi = Math.atan2(x, zc), ap = Math.abs(phi), front = Math.max(0, Math.cos(phi));
  // breadth: the cranium's down to the cheeks, then the jaw's toward its corners; length front and back
  const jawK = sstep(0.66, 0.86, t), xs = (s.wid + (s.jaw - s.wid) * jawK * sstep(0.2, 0.9, ap));
  let X = x * xs, Z = zc >= 0 ? zc * s.len : zc * (1 + (s.len - 1) * 0.6 + (s.back - 1) * g(t, 0.42, 0.22));
  let Y = y;
  // the forehead swept back toward the hairline; the brow; the bridge and the nose; the chin forward and down
  Z -= s.slope * sstep(0.42, 0.12, t) * front * front;
  Z += s.brow * g(phi, 0, 0.7) * g(t, F.brow - 0.004, 0.035);
  Z += s.bridge * g(phi, 0, 0.1) * g(t, 0.52, 0.04);
  if (t > 0.455 && t < 0.72) Z += (s.nose - 1) * NOSE(t) * g(phi, 0, 0.06 + 0.035 * sstep(0.5, 0.64, t));
  Z += s.chin * g(phi, 0, 0.45) * sstep(0.8, 0.92, t);
  Y -= s.drop * sstep(0.68, 0.95, t) * sstep(1.6, 0.6, ap);
  // the cheekbones, out along the surface
  const dr = s.cheek * g(ap, 0.8, 0.3) * g(t, 0.575, 0.07);
  X += Math.sin(phi) * dr; Z += Math.cos(phi) * dr;
  return [X, Y, Z + HEAD.cz];
}

const cache = new Map();
// A copy of a figure's geometry (figure.js) with its head reshaped to skull s. Index, uvs, skin and the
// baked shade are shared with the original; positions and normals are its own. Cached per figure and shape.
export function skullGeometry(geo, s) {
  if (!s) return geo;
  const k = geo.uuid + key(s);
  if (cache.has(k)) return cache.get(k);
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geo.attributes)) out.setAttribute(name, name === 'position' ? a.clone() : a);
  out.setIndex(geo.index); for (const gr of geo.groups) out.addGroup(gr.start, gr.count, gr.materialIndex);
  out.userData = geo.userData;
  const p = out.attributes.position.array, si = geo.attributes.skinIndex.array, sw = geo.attributes.skinWeight.array, n = p.length / 3;
  const inEar = new Uint8Array(n);
  for (const [a, z] of geo.userData.ears || []) for (let i = a; i < z; i++) inEar[i] = 1;
  for (let i = 0; i < n; i++) {
    if (inEar[i]) continue;
    let w = 0; for (let j = 0; j < 4; j++) if (si[i * 4 + j] === HEADBONE) w += sw[i * 4 + j];
    if (w <= 0) continue;
    w = sstep(0.3, 0.9, w);                                  // all of it on the head, fading out down the neck
    const q = warpPoint(s, p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    for (let c = 0; c < 3; c++) p[i * 3 + c] += (q[c] - p[i * 3 + c]) * w;
  }
  // each ear: carried with the skin at its root, then sized about it
  for (const [a, z, side] of geo.userData.ears || []) {
    const root = headPoint(side * 1.5, 0.557), moved = warpPoint(s, ...root);
    for (let i = a; i < z; i++) for (let c = 0; c < 3; c++) p[i * 3 + c] = moved[c] + (p[i * 3 + c] - root[c]) * s.ear;
  }
  out.setAttribute('normal', geo.attributes.normal.clone());
  smoothNormals(out);
  cache.set(k, out);
  return out;
}
