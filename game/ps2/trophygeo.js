// The two cups' shapes for the '04 look (pure three: no DOM, unit tested in Node). Trophy-local: y up
// from the underside of the base, the front (plaque, the star's face) toward -z, which is the way the
// cup faces you on the ceremony plinth; +x is your left as you face it.
//   world: THE STAR CUP, the nations' trophy, gold, 0.60 m. A turned foot over a band of green stone,
//          a slender waist (where the hands go), and one body that opens out of it like a lyre and is
//          cut away front and back into two wings of unequal height, turned a little as they rise, a
//          soft ridge running up each to its tip. A faceted star stands between them.
//   club:  THE CHAMPIONS CUP, the clubs' trophy, silver, 0.72 m. A drum of black marble, a spreading
//          foot, a stem with one knop, a deep bell of a bowl (an S from calyx to lip) with an engraved
//          laurel band, a low domed cover with a star, and two handles that leave the bowl under the
//          lip, rise above it and come down in one long tapering sweep to the bottom of the bowl.
// Each part list is { metal, stone, engraved, plaque... } of geometries, so trophies.js makes one draw
// call per material. The sketches that lost are in trophysketch.js.
import * as THREE from 'three';
import { revolve, band, grid, tube, starGeo, smooth, curveFn, place } from './metal.js';
import { PLATE_UV, FRIEZE_UV } from './trophyuv.js';

// Where the hands go (trophy-local, the middle of the fist), index 0 on +x for your left hand, the
// axis of what they close round (vertical on both) and its diameter (round on both). The nations' cup
// is held round its waist, a fist either side; the clubs' cup by the upright run of each handle.
export const HOLD_D = { world: 0.06, club: 0.032 };
export const GRIPS2 = { world: [[0.07, 0.245, 0], [-0.07, 0.245, 0]], club: [[0.168, 0.47, 0], [-0.168, 0.47, 0]] };
export const HOLDS = Object.fromEntries(Object.entries(GRIPS2).map(([k, g]) => [k, g.map(at => ({ at, axis: [0, 1, 0], d: HOLD_D[k] }))]));

const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- the nations' cup ----------
// The flame, from the collar up. One surface of revolution R(y), its section drawn out to a soft ridge
// down the middle of each tongue (more toward the top), turned round the axis as it rises, and its rim
// cut to H: two tongues of flame, a tall one behind the star and a short one in front of it, the rim
// dropping low at the sides between them. Outside up, over the rim, down the inside, the floor.
export const FLAME = { y0: 0.192, split: 0.325, floor: 0.335, turn: Math.PI / 2, twist: 1.1, wall: 0.0055, tip: 0.63, tip2: 0.43, front: 0.37, back: 0.378, sharp: 1.8 };
const BODY = curveFn([[0.192, 0.031], [0.21, 0.03], [0.245, 0.03], [0.275, 0.0305], [0.3, 0.036], [0.325, 0.048], [0.355, 0.065], [0.39, 0.08], [0.43, 0.09], [0.47, 0.092], [0.51, 0.087], [0.55, 0.077], [0.59, 0.064], [0.63, 0.05]]);
export function flameBody({ seg = 44, peaks = 2, rows = 14, o = FLAME, R = BODY, lens = 0.2 } = {}) {
  const top = Math.max(o.tip, o.tip2);
  const H = a => {                                              // the rim's height round the turn (a before the twist)
    const w = Math.pow(0.5 - 0.5 * Math.cos(peaks * a), o.sharp);
    const tip = (o.tip + o.tip2) / 2 + (o.tip - o.tip2) / 2 * Math.sin(a), low = (o.front + o.back) / 2 - (o.back - o.front) / 2 * Math.cos(a);
    return low + (tip - low) * w;
  };
  const pt = (a, y, inset) => {
    const e = lens * sstep(0.27, 0.46, y), m = 1 + e * (1 - 1.55 * Math.sqrt(Math.cos(peaks * a / 2) ** 2 + 0.012));
    const aa = a + o.turn + o.twist * (sstep(0.26, top, y) - 0.6), r = Math.max(0.001, R(y) * m - inset);
    return [Math.sin(aa) * r, y, -Math.cos(aa) * r];
  };
  const ring = f => { const out = []; for (let i = 0; i < seg; i++) out.push(f((i / seg) * Math.PI * 2)); return out; };
  const rings = [], low = [o.y0, 0.204, 0.245, 0.278, 0.293, 0.309, o.split];
  for (const y of low) rings.push(ring(a => pt(a, y, 0)));
  for (let k = 1; k <= rows; k++) rings.push(ring(a => pt(a, o.split + (H(a) - o.split) * k / rows, 0)));
  rings.push(ring(a => pt(a, H(a) + 0.0022, o.wall * 0.5)));     // the rolled rim
  const inner = 6;
  for (let k = 0; k <= inner; k++) rings.push(ring(a => { const y = o.floor + (H(a) - o.floor) * (1 - k / inner); return pt(a, y, o.wall * (0.9 + 0.5 * k / inner)); }));
  rings.push(ring(a => { const p = pt(a, o.floor, o.wall * 1.4); return [p[0] * 0.92, o.floor - 0.004, p[2] * 0.92]; }));
  rings.push(ring(() => [0, o.floor - 0.004, 0]));
  const outer = low.length + rows + 1, g = grid(rings);
  // shade: the inside a little darker toward the floor (the grid's rings after the rim)
  const shade = new Float32Array(rings.length * seg).fill(1);
  for (let k = outer; k < rings.length; k++) for (let i = 0; i < seg; i++) shade[k * seg + i] = 0.92 - 0.4 * Math.min(1, (k - outer) / inner);
  g.userData.ao = shade;
  return g;
}
const STAR = { R: 0.068, y: 0.497, z: 0.04 };
export function worldFoot() {
  const metal = [], stone = [], engraved = [];
  // the foot ring under the stone, the stone, and the moulding over it
  metal.push(revolve(smooth([[0, 0], [0.093, 0, 1], [0.097, 0.004], [0.098, 0.0095], [0.095, 0.015, 1], [0.0905, 0.0165, 1], [0.0895, 0.02, 1], [0.08, 0.02]], 1), 40, { ao: (x, y) => (y < 0.001 ? 0.35 : 1) }));
  stone.push(band([[0.0885, 0.0195], [0.0885, 0.0765]], 40, { u0: 0, u1: 1 }));
  metal.push(revolve(smooth([[0.08, 0.076], [0.0895, 0.076, 1], [0.0915, 0.0785], [0.0895, 0.081, 1], [0.0868, 0.081, 1], [0.0868, 0.099, 1], [0.089, 0.099, 1], [0.0905, 0.1012], [0.089, 0.1035, 1],
    // the spreading foot: one long hollow sweep up to the collar
    [0.084, 0.1045, 1], [0.0835, 0.1075, 1], [0.07, 0.1115], [0.055, 0.1215], [0.0445, 0.136], [0.038, 0.153], [0.034, 0.17], [0.0325, 0.178, 1],
    [0.036, 0.1795], [0.0395, 0.185], [0.036, 0.1905], [0.032, 0.192, 1], [0.028, 0.193]], 1), 40));
  engraved.push(band([[0.0872, 0.0815], [0.0872, 0.0985]], 40, { u0: 0, u1: 2, ...FRIEZE_UV }));
  // the plaque, let into the front of the stone
  engraved.push(band([[0.0893, 0.03], [0.0893, 0.066]], 10, { a0: -0.44, a1: 0.44, ...PLATE_UV, u0: PLATE_UV.u1, u1: PLATE_UV.u0 }));
  return { metal, stone, engraved };
}
export function worldParts() {
  const { metal, stone, engraved } = worldFoot();
  metal.push(flameBody());
  // the star, set against the tall tongue on a short boss (hidden behind it), facing front
  metal.push(place(revolve([[0.016, 0], [0.011, 0.025], [0.011, 0.046]], 8, { ao: 0.7 }), 0, STAR.y, STAR.z, 0, Math.PI / 2));
  metal.push(place(starGeo(STAR.R, STAR.R * 0.4, 0.02, 0.0045), 0, STAR.y, STAR.z));
  return { metal, stone, engraved };
}

// ---------- the clubs' cup ----------
const BASE = 0.088;                                               // the top of the marble
// the spreading foot (round a wide turn), then the stem and its knop (a narrow one)
const FOOT = [[0, BASE - 0.001], [0.088, BASE - 0.001, 1], [0.0915, BASE + 0.001], [0.0925, BASE + 0.0045], [0.09, BASE + 0.008, 1], [0.085, BASE + 0.0085, 1],
  [0.081, 0.101], [0.068, 0.111], [0.049, 0.123], [0.033, 0.14], [0.023, 0.16], [0.0185, 0.18, 1], [0.014, 0.181]];
const STEM = [[0.014, 0.179], [0.024, 0.18, 1], [0.024, 0.1835, 1], [0.029, 0.186], [0.036, 0.198], [0.029, 0.21], [0.024, 0.2125, 1], [0.024, 0.216, 1], [0.0175, 0.2175, 1],
  [0.016, 0.232], [0.0185, 0.248, 1], [0.027, 0.2495, 1], [0.0285, 0.2518], [0.027, 0.254, 1], [0.02, 0.2555]];
export const BOWL = [[0.02, 0.254], [0.05, 0.266], [0.082, 0.289], [0.102, 0.32], [0.108, 0.354], [0.101, 0.395], [0.09, 0.435], [0.084, 0.475], [0.0865, 0.515], [0.095, 0.547], [0.106, 0.566, 1],
  [0.1072, 0.5685], [0.106, 0.571, 1], [0.1, 0.5715]];
const LID = [[0.103, 0.5705], [0.103, 0.5745, 1], [0.097, 0.576, 1], [0.0925, 0.5785], [0.089, 0.585], [0.081, 0.5945], [0.062, 0.608], [0.04, 0.618], [0.022, 0.6245], [0.014, 0.63, 1],
  [0.0105, 0.6335], [0.012, 0.64], [0.0175, 0.647], [0.019, 0.654], [0.0145, 0.662], [0.0075, 0.668], [0.005, 0.676], [0, 0.6765]];
export const bowlR = curveFn(BOWL.slice(0, 11).map(([r, y]) => [y, r]));
// One handle on the +x side (side -1 mirrors it), an arm of a lyre: it grows out of the belly of the
// bowl, sweeps out and up, stands upright through the hand-hold (3.2 cm, round), and thins as it rises
// past the lip into a small scroll turned outward, a bead on its end. It never comes back to the bowl.
// LOOP is the closed handle that lost (a squared loop from the lip to the belly: it read as a jug's).
const HX = GRIPS2.club[0][0];
export const LOOP = [[0.082, 0.546], [0.112, 0.561], [0.142, 0.57], [HX - 0.007, 0.562], [HX, 0.54], [HX, 0.47], [HX, 0.42], [HX - 0.003, 0.39], [HX - 0.014, 0.36], [0.135, 0.335], [0.113, 0.318], [0.094, 0.31]];
const HANDLE = [[0.092, 0.318], [0.118, 0.333], [0.142, 0.357], [0.159, 0.39], [HX - 0.001, 0.425], [HX, 0.47], [HX, 0.515], [HX + 0.004, 0.548], [HX + 0.013, 0.575], [HX + 0.022, 0.587], [HX + 0.034, 0.594], [HX + 0.046, 0.593], [HX + 0.055, 0.585], [HX + 0.057, 0.574], [HX + 0.052, 0.565], [HX + 0.043, 0.562], [HX + 0.037, 0.566], [HX + 0.037, 0.573]];
const TIP = HANDLE[HANDLE.length - 1];
export function handle(side, keys = HANDLE, thick = HOLD_D.club / 2, lyre = keys === HANDLE) {
  const pts = smooth(keys, 2), ease = v => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, v)));
  // as thick as the hand needs only where the hand goes
  const rad = lyre ? t => thick * (t < 0.3 ? 0.62 + 0.38 * ease(t / 0.3) : t < 0.52 ? 1 : 1 - 0.7 * ease((t - 0.52) / 0.48))
    : t => thick * (t < 0.36 ? 0.5 + 0.5 * ease(t / 0.36) : t < 0.55 ? 1 : 1 - 0.64 * ease((t - 0.55) / 0.45));
  return tube(pts.map(([x, y]) => [side * x, y, 0]), rad, 8, { caps: lyre });
}
export function clubFoot() {
  const metal = [], stone = [], engraved = [];
  // the marble drum, a silver band round its step, the plaque
  stone.push(revolve(smooth([[0, 0], [0.12, 0, 1], [0.12, 0.012, 1], [0.1125, 0.014, 1], [0.1125, 0.021, 1], [0.108, 0.023, 1], [0.105, 0.074, 1], [0.1, 0.0795], [0.096, 0.086], [0.094, BASE, 1], [0, BASE]], 1), 24, { uv: true }));
  metal.push(revolve([[0.112, 0.0135], [0.1146, 0.0148], [0.1146, 0.0202], [0.112, 0.0215]], 24));
  engraved.push(band([[0.1082, 0.031], [0.1062, 0.067]], 10, { a0: -0.42, a1: 0.42, ...PLATE_UV, u0: PLATE_UV.u1, u1: PLATE_UV.u0 }));
  metal.push(revolve(smooth(FOOT, 2), 24), revolve(smooth(STEM, 2), 16));
  return { metal, stone, engraved };
}
export function clubParts() {
  const { metal, stone, engraved } = clubFoot();
  metal.push(revolve(smooth(BOWL, 2), 36));
  // the laurel band round the waist of the bowl, a reed above and below it
  const y0 = 0.46, y1 = 0.49;
  engraved.push(band([[bowlR(y0) + 0.0006, y0], [bowlR((y0 + y1) / 2) + 0.0006, (y0 + y1) / 2], [bowlR(y1) + 0.0006, y1]], 36, { u0: 0, u1: 3, ...FRIEZE_UV }));
  for (const y of [y0, y1]) { const r = bowlR(y); metal.push(revolve([[r - 0.001, y - 0.0024], [r + 0.0018, y], [r - 0.001, y + 0.0024]], 36)); }
  metal.push(revolve(smooth(LID, 1), 24));
  metal.push(place(starGeo(0.031, 0.0125, 0.0105, 0.0032), 0, 0.6765 + 0.031 * 0.78, 0));
  for (const s of [1, -1]) metal.push(handle(s), place(new THREE.IcosahedronGeometry(0.0072, 1), s * TIP[0], TIP[1], 0));
  return { metal, stone, engraved };
}
