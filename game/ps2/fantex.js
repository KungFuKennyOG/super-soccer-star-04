// The crowd's sprites, made in code once and shared by every ground. A fan is three layers that the
// shader (fanmat.js) lays over each other on his card: his torso (40: eight kinds of top x five builds,
// fanpaint.js BUILDS), his head (2 faces x 9 styles x 3 views: facing you, three-quarters, near profile,
// x 3 mouths: shut, open, a gasp; fanhead.js) and his arms (24 poses x short or long sleeves). So a head
// can look either way whatever his arms do. Colours are put on in the shader: a sprite holds only
// light and shade and six masks (shirt, second colour, skin, hair, beard, glasses).
//   A: RGBA 1024 x 1512 (L x alpha, shirt, accent, alpha), premultiplied so the mips don't darken
//      the edges; B: RGBA (skin, hair, beard, glasses). 12.4 MB, about 16.5 MB with mips.
// Also the seat tile the empty stand is painted with (seats and the stairway's steps).
import * as THREE from 'three';
import { canvas, hash } from './paint.js';
import { painter, paintArms, paintTorso, POSES, TOPS, ARMS, TORSO, BUILDS } from './fanpaint.js';
import { paintHeads, HEAD, STYLES, FACES } from './fanhead.js';

export { POSES, TOPS, STYLES, BUILDS, FACES };
export const P = Object.fromEntries(POSES.map(([n], i) => [n, i]));
export const LAYOUT = {
  W: 1024, H: 1512,
  arms: { w: ARMS.w, h: ARMS.h, per: 9, y: 0, x0: ARMS.x0 },                 // cell = pose * 2 + long sleeves
  head: { w: HEAD.w, h: HEAD.h, per: 25, y: 960, x0: HEAD.x0, y0: HEAD.y0, cm: HEAD.cm, at: 74 },   // cell = (face * styles + style) * 9 + view * 3 + mouth; at: his head's middle, cm above the seat
  torso: { w: TORSO.w, h: TORSO.h, per: 16, y: 1296, x0: TORSO.x0 },       // cell = top + 8 * build
};
const cellAt = (L, c) => [(c % L.per) * L.w, L.y + Math.floor(c / L.per) * L.h];

let fanTex = null;
export function fanAtlas() {
  if (fanTex) return fanTex;
  const t0 = performance.now(), { W, H } = LAYOUT, cv = { alb: canvas(W, H), mask: canvas(W, H), hair: canvas(W, H) };
  for (const [pass, c] of Object.entries(cv)) {
    const x = c.getContext('2d', { willReadFrequently: true });
    if (pass !== 'alb') { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); }
    const p = painter(x, pass);
    const inCell = ([ox, oy], w, h, fn) => { x.save(); x.beginPath(); x.rect(ox, oy, w, h); x.clip(); fn(ox, oy); x.restore(); };
    POSES.forEach(([, pose], pi) => [0, 1].forEach(long => inCell(cellAt(LAYOUT.arms, pi * 2 + long), ARMS.w, ARMS.h, (ox, oy) => paintArms(p, pose, long, ox, oy))));
    TOPS.forEach((t, ti) => BUILDS.forEach((b, bi) => inCell(cellAt(LAYOUT.torso, ti + bi * 8), TORSO.w, TORSO.h, (ox, oy) => paintTorso(p, t, b, ox, oy))));
  }
  const get = k => cv[k].getContext('2d').getImageData(0, 0, W, H).data, A = get('alb'), M = get('mask');
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = (y * W + xx) * 4, al = A[i + 3];
    if (!al) continue;
    // a darker rim round each shape, so an arm reads against the body and one fan against the next
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = xx + dx, Y = y + dy; return X < 0 || Y < 0 || X >= W || Y >= H || A[(Y * W + X) * 4 + 3] < 100; });
    const L = A[i] * (edge ? 0.74 : 1) * (0.97 + 0.06 * hash(xx >> 1, y >> 1, 3));
    a[i] = Math.min(255, Math.round(L * al / 255)); a[i + 1] = M[i]; a[i + 2] = M[i + 1]; a[i + 3] = al;   // (clamped: a lit 255 with grain wrapped round to black)
    b[i] = M[i + 2];
  }
  paintHeads({ a, b }, W, c => cellAt(LAYOUT.head, c));
  // per arms pose: how high (cm above the seat) and how far out (cm) the card must reach, head and body included
  const top = [], hw = [];
  POSES.forEach((_, pi) => {
    let t = 92, w = 33;
    for (const long of [0, 1]) {
      const [ox, oy] = cellAt(LAYOUT.arms, pi * 2 + long);
      for (let y = 0; y < ARMS.h; y++) for (let xx = 0; xx < ARMS.w; xx++) if (a[((oy + y) * W + ox + xx) * 4 + 3] > 60) { t = Math.max(t, ARMS.h - y + 1); w = Math.max(w, Math.abs(xx + 0.5 + ARMS.x0) + 1); }
    }
    top.push(t / 100); hw.push(w / 100);
  });
  const tex = (data, format) => {
    const t = new THREE.DataTexture(data, W, H, format, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.unpackAlignment = 1; t.userData.keep = true; t.needsUpdate = true;
    return t;
  };
  fanTex = { a: tex(a, THREE.RGBAFormat), b: tex(b, THREE.RGBAFormat), top, hw, bytes: W * H * 8, ms: Math.round(performance.now() - t0), raw: { a, b } };
  return fanTex;
}

// The seat tile: one seat (left half) and one stairway step pair (right half), 32 x 32 each.
// R: light and shade, G: how much is the seat's own colour. v runs from the row's front to its back.
let seatTex = null;
export function seatTile() {
  if (seatTex) return seatTex;
  const W = 64, H = 32, d = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4, v = (y + 0.5) / H, n = 0.92 + 0.16 * hash(x, y, 7);
    let L, s = 0;
    if (x < 32) {
      const u = (x + 0.5) / 32, gap = u < 0.08 || u > 0.92;
      if (v < 0.18) L = 0.3;                                        // the tread in front of the seat
      else if (v < 0.3) { L = gap ? 0.18 : 0.42; s = gap ? 0 : 1; }  // the seat's front lip
      else if (v < 0.82) { L = gap ? 0.12 : 0.24 + 0.4 * (v - 0.3); s = gap ? 0 : 1; }   // the seat back, lit toward its top
      else if (v < 0.88) { L = gap ? 0.16 : 0.72; s = gap ? 0 : 1; }   // its rounded top edge
      else L = 0.1;                                                 // the shadow behind it
    } else {
      const f = (v * 2) % 1;                                        // two steps a row
      L = f < 0.15 ? 0.85 : f < 0.7 ? 0.62 : 0.4;
      const u = (x - 32 + 0.5) / 32; if (u < 0.06 || u > 0.94) L = 0.75;   // handrail-side edges
    }
    d[o] = Math.round(255 * L * n); d[o + 1] = Math.round(255 * s); d[o + 2] = 0; d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.userData.keep = true; t.needsUpdate = true;
  seatTex = t;
  return t;
}
