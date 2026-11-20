// The two cups' shapes for the '04 look (pure three: no DOM, unit tested in Node). Trophy-local: y up
// from the underside of the base, the front (plate, the star's face) toward -z, which is the way the
// cup faces you on the ceremony plinth; +x is your left as you face it.
//   world: THE STAR CUP, the nations' trophy. Solid gold. An octagonal foot with a band of green stone,
//          a faceted taper, a round waisted grip, and a crown of upright flame-leaves cradling a big
//          faceted five-pointed star.
//   club:  THE CHAMPIONS CUP, the clubs' trophy. Polished silver on a black stepped plinth: a fluted
//          amphora with a ring of small stars at the shoulder, a stepped lid with a star finial, and two
//          slim straight-sided bracket handles.
// Each part list is { metal: [geometries], stone, dark, plate: { w, h, y, z } } so trophies.js makes one
// draw call per material. Sketches (variant): world 'flame' (chosen), 'spire', 'wreath'; club
// 'amphora' (chosen), 'tulip', 'hex'.
import * as THREE from 'three';
import { revolve, tube, starGeo } from './metal.js';

// Where the hands go (trophy-local, the middle of the fist), index 0 on +x for your left hand. The same
// on the nations' cup the hands close either side of a round grip 6.6 cm across (the same points and
// thickness as game/trophy.js); on the clubs' cup each fist closes round a round vertical bar 3.2 cm
// across (trophy.js: 3 cm boxes; 3.2 is the thinnest the new hands' grip pose is tested on), 38 cm apart (trophy.js: 50 cm, round its big ears; moved in so the
// handles stay slim and close to the body: 4 cm of room for the fingers behind the bar).
export const GRIPS2 = { world: [[0.07, 0.24, 0], [-0.07, 0.24, 0]], club: [[0.19, 0.37, 0], [-0.19, 0.37, 0]] };
export const HOLD_D = { world: 0.066, club: 0.032 };
// Per hand-hold, for the hands' grip pose (buildHand(side, 'hold', kit, skin, { d, at })): where the middle
// of the fist goes, the handle's axis (both vertical) and the diameter of the round section it closes on.
export const HOLDS = Object.fromEntries(Object.entries(GRIPS2).map(([k, g]) => [k, g.map(at => ({ at, axis: [0, 1, 0], d: HOLD_D[k] }))]));

const lerpKeys = (keys, s) => {
  for (let i = 1; i < keys.length; i++) if (s <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i], t = (s - a) / (b - a), e = t * t * (3 - 2 * t); return va + (vb - va) * (0.5 * t + 0.5 * e); }
  return keys[keys.length - 1][1];
};

// An octagonal prism with uvs round it (the stone band): n facets, a flat one facing front.
function prism(r, y0, y1, n = 8) {
  const pos = [], uv = [], a0 = Math.PI / n;
  for (let k = 0; k < n; k++) {
    const a = -a0 + k * 2 * a0, b = a + 2 * a0, p = [Math.sin(a) * r, -Math.cos(a) * r], q = [Math.sin(b) * r, -Math.cos(b) * r], u0 = k / n, u1 = (k + 1) / n;
    pos.push(p[0], y0, p[1], q[0], y0, q[1], p[0], y1, p[1], q[0], y0, q[1], q[0], y1, q[1], p[0], y1, p[1]);
    uv.push(u0, 0, u1, 0, u0, 1, u1, 0, u1, 1, u0, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return g;
}

// A leaf or tongue of flame standing up round the axis at angle a: its middle line keys (radius, height)
// over s = 0..1, half-width w(s) round the turn, half-thickness t(s), the edges cupped outward.
function blade(a, { R, Y, W, T, lean = 0 }, rows = 16, cols = 10) {
  const pos = [], idx = [], c = new THREE.Vector3(), c2 = new THREE.Vector3(), tg = new THREE.Vector3(), side = new THREE.Vector3(), out = new THREE.Vector3();
  const at = (s, v) => { const r = lerpKeys(R, s), aa = a + lean * s; return v.set(Math.sin(aa) * r, lerpKeys(Y, s), -Math.cos(aa) * r); };
  for (let i = 0; i <= rows; i++) {
    const s = i / rows, aa = a + lean * s;
    at(s, c); at(Math.min(1, s + 0.01), c2); tg.subVectors(c2, c); if (s >= 1) { at(s - 0.01, c2); tg.subVectors(c, c2); }
    tg.normalize(); side.set(Math.cos(aa), 0, Math.sin(aa)); side.addScaledVector(tg, -side.dot(tg)).normalize();
    out.crossVectors(tg, side).normalize(); if (out.x * Math.sin(aa) - out.z * Math.cos(aa) < 0) out.negate();
    const w = lerpKeys(W, s), t = lerpKeys(T, s);
    for (let j = 0; j < cols; j++) {
      const f = (j / cols) * Math.PI * 2, cs = Math.cos(f), sn = Math.sin(f);
      const o = (sn > 0 ? t * 1.25 * Math.pow(sn, 0.6) : t * 0.55 * sn) + cs * cs * w * 0.3;   // a ridge down the outside, the edges turned out
      pos.push(c.x + side.x * w * cs + out.x * o, c.y + side.y * w * cs + out.y * o, c.z + side.z * w * cs + out.z * o);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const p = i * cols + j, q = i * cols + (j + 1) % cols;
    idx.push(p, q, p + cols, q, q + cols, p + cols);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const place = (g, x, y, z, ry = 0, rx = 0) => { g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); return g; };

// ---------- the nations' cup ----------
export function worldParts(variant = 'flame') {
  const metal = [], stone = [], O = Math.PI / 8;
  // the octagonal foot, the stone band, the rim over it and the faceted taper to the round column
  metal.push(revolve([[0, 0], [0.094, 0, 1], [0.097, 0.004, 1], [0.097, 0.012, 1], [0.09, 0.017, 1], [0, 0.017]], 8, { flat: true, a0: O }));
  stone.push(prism(0.089, 0.017, 0.073));
  metal.push(revolve([[0, 0.073], [0.092, 0.073, 1], [0.097, 0.077, 1], [0.097, 0.086, 1], [0.084, 0.092, 1], [0.074, 0.094, 1], [0.064, 0.118, 1], [0.054, 0.142, 1], [0.05, 0.15]], 8, { flat: true, a0: O }));
  // round from here: bead, collar, the waisted grip (3.3 cm radius where the palms go), the upper collar
  const col = [[0.05, 0.149], [0.057, 0.153], [0.058, 0.158], [0.053, 0.162, 1], [0.046, 0.164], [0.045, 0.17], [0.038, 0.178], [0.0345, 0.19], [0.033, 0.215],
    [0.0335, 0.24], [0.033, 0.265], [0.0345, 0.285], [0.04, 0.293], [0.047, 0.297], [0.049, 0.302], [0.045, 0.306, 1], [0.038, 0.309]];
  if (variant === 'flame') {
    // a calyx the leaves grow from: a shallow bowl, open, its rim rolled
    metal.push(revolve([...col, [0.04, 0.33], [0.048, 0.36], [0.054, 0.378], [0.057, 0.383], [0.052, 0.385], [0.044, 0.38], [0, 0.36]], 32));
    // five broad tongues of flame, symmetric (they rise, swell and flick out at the tip, no spiral), a gap
    // at the front for the star's face, and five short ones between them, the front one under the star
    const big = { R: [[0, 0.036], [0.35, 0.058], [0.72, 0.064], [1, 0.092]], Y: [[0, 0.305], [0.35, 0.365], [0.72, 0.44], [1, 0.505]],
      W: [[0, 0.012], [0.3, 0.027], [0.62, 0.026], [0.86, 0.013], [1, 0.0006]], T: [[0, 0.006], [0.5, 0.007], [1, 0.0014]] };
    for (let k = 0; k < 5; k++) metal.push(blade(Math.PI / 5 + k * 2 * Math.PI / 5, big, 18, 12));
    const small = { R: [[0, 0.04], [0.45, 0.06], [0.8, 0.064], [1, 0.08]], Y: [[0, 0.33], [0.45, 0.37], [0.8, 0.405], [1, 0.43]],
      W: [[0, 0.01], [0.35, 0.02], [0.75, 0.013], [1, 0.0006]], T: [[0, 0.005], [1, 0.001]] };
    for (let k = 0; k < 5; k++) metal.push(blade(k * 2 * Math.PI / 5, small, 12, 10));
    metal.push(revolve([[0.009, 0.36], [0.008, 0.42], [0.012, 0.44], [0, 0.445]], 10));      // the post the star stands on
    metal.push(place(starGeo(0.08, 0.034, 0.026, 0.0065), 0, 0.472, 0));
  } else if (variant === 'spire') {
    metal.push(revolve([...col, [0.05, 0.33], [0.06, 0.34, 1], [0.052, 0.36], [0.03, 0.44], [0.012, 0.47], [0, 0.48]], 6, { flat: true }));
    metal.push(place(starGeo(0.05, 0.022, 0.016, 0.005), 0, 0.53, 0));
  } else {
    metal.push(revolve([...col, [0.03, 0.33], [0.02, 0.37], [0, 0.375]], 24));
    const ring = []; for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; ring.push([Math.sin(a) * 0.085, 0.455 + Math.cos(a) * 0.085, 0]); }
    metal.push(tube(ring, ring.map((_, i) => 0.009 + 0.004 * Math.abs(Math.sin(i * 1.3))), 8, { up: [0, 0, 1], caps: false }));
    metal.push(place(starGeo(0.07, 0.03, 0.022, 0.006), 0, 0.455, 0));
  }
  return { metal, stone, dark: [], plate: { w: 0.058, h: 0.038, y: 0.045, z: -0.089 * Math.cos(O) - 0.0016, d: 0.003 } };
}

// ---------- the clubs' cup ----------
// One bracket handle on the +x side (side -1 mirrors it): a straight strut out from the body, the
// vertical grip bar (3.2 cm, round, through the hand-hold), a strut back in to the neck, and a small spike on
// the top corner. Corners are kept sharp by points either side of them.
function bracket(side, top = 0.468, neck = 0.074, low = [0.118, 0.29]) {
  const X = GRIPS2.club[0][0], b0 = 0.306, b1 = 0.44, e = 0.006;
  const pts = [[low[0] - 0.01, low[1]], [X - e, b0 - e * 0.15], [X, b0 + e * 0.4], [X, b0 + e * 1.2], [X, b1 - e * 1.2], [X, b1 - e * 0.4], [X - e, b1 + e * 0.1], [neck - 0.01, top + 0.004]];
  const rad = [0.007, 0.0095, 0.012, 0.016, 0.016, 0.012, 0.0095, 0.0065];
  const g = tube(pts.map(([x, y]) => [side * x, y, 0]), rad, 12, { up: [0, 0, 1] });
  const spike = revolve([[0.012, 0], [0.013, 0.005], [0.007, 0.011], [0, 0.022]], 8);
  return [g, place(spike, side * X, b1 + 0.004, 0)];
}
export function clubParts(variant = 'amphora') {
  const metal = [], dark = [], Q = Math.PI / 4;
  // the black stepped plinth (square) with a thin silver band, then the silver foot plate
  dark.push(revolve([[0, 0], [0.142, 0, 1], [0.142, 0.024, 1], [0.126, 0.028, 1], [0.126, 0.09, 1], [0.108, 0.094, 1], [0.108, 0.106, 1], [0, 0.106]], 4, { flat: true, a0: Q }));
  metal.push(revolve([[0.131, 0.024], [0.131, 0.03, 1], [0.126, 0.03]], 4, { flat: true, a0: Q }));
  let body;
  if (variant === 'amphora' || variant === 'hex') {
    body = [[0, 0.106], [0.076, 0.106, 1], [0.076, 0.113, 1], [0.066, 0.12], [0.044, 0.132], [0.027, 0.15], [0.02, 0.168], [0.026, 0.177], [0.033, 0.184], [0.034, 0.19], [0.029, 0.197], [0.02, 0.205],
      [0.022, 0.214], [0.04, 0.228], [0.07, 0.25], [0.1, 0.278], [0.122, 0.31], [0.133, 0.345], [0.132, 0.375], [0.124, 0.398, 1], [0.127, 0.402], [0.127, 0.41], [0.119, 0.414, 1], [0.104, 0.432], [0.086, 0.452],
      [0.073, 0.468], [0.069, 0.482], [0.072, 0.496], [0.083, 0.508, 1], [0.089, 0.512, 1], [0.089, 0.518, 1], [0.08, 0.521, 1],
      [0.078, 0.524], [0.07, 0.53, 1], [0.06, 0.534], [0.04, 0.545], [0.022, 0.552, 1], [0.022, 0.558], [0.012, 0.562], [0.008, 0.572], [0.006, 0.59], [0.0075, 0.598], [0.006, 0.603], [0, 0.604]];
  } else {
    body = [[0, 0.106], [0.07, 0.106, 1], [0.07, 0.114, 1], [0.04, 0.13], [0.022, 0.16], [0.018, 0.21], [0.024, 0.23], [0.045, 0.26], [0.07, 0.32], [0.085, 0.4], [0.1, 0.48], [0.115, 0.54, 1], [0.108, 0.545, 1], [0.098, 0.5], [0.08, 0.42], [0, 0.4]];
  }
  if (variant === 'hex') metal.push(revolve(body, 6, { flat: true }));
  else {
    // flutes on the lower body: sixteen channels with sharp ridges, deepest in the middle, fading out at both ends
    const fl = (a, y) => { const d = 0.075 * Math.max(0, Math.min(1, (y - 0.222) / 0.04)) * Math.max(0, Math.min(1, (0.392 - y) / 0.05)); return 1 - d * Math.abs(Math.sin(8 * a)); };
    metal.push(revolve(body, 64, { mod: variant === 'amphora' ? fl : null }));
  }
  if (variant === 'amphora') {
    // a ring of eight small stars standing out from the band at the shoulder
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; metal.push(place(starGeo(0.011, 0.0048, 0.004, 0.0015), Math.sin(a) * 0.129, 0.406, -Math.cos(a) * 0.129, -a)); }
    metal.push(place(starGeo(0.032, 0.014, 0.011, 0.004), 0, 0.613, 0));
    for (const s of [1, -1]) metal.push(...bracket(s));
  } else if (variant === 'hex') {
    metal.push(place(starGeo(0.032, 0.014, 0.011, 0.004), 0, 0.613, 0));
    for (const s of [1, -1]) metal.push(...bracket(s));
  } else {
    for (const s of [1, -1]) metal.push(...bracket(s, 0.52, 0.11, [0.06, 0.25]));
  }
  return { metal, stone: [], dark, plate: { w: 0.15, h: 0.04, y: 0.059, z: -0.126 * Math.cos(Q) - 0.0016, d: 0.003 } };
}
