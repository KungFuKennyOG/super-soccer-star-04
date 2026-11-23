// What a press photographer wears that a footballer doesn't (game/ps2/press.js): full-length trousers and plain
// shoes in place of shorts, socks and boots, and (limbs.js, `long`) a jacket's sleeves to the wrist with bare
// hands, the right hand's fingers closed round a camera's grip and the left's cupped under its lens.
// The trousers are one garment from the waist to the crotch (the rings of the footballer's shorts, a little
// closer cut), then two straight legs to a hem that breaks on the shoe. No hem at the knee, no sock top.
// Sheet: the legs from the waist to the knee are on the shorts' regions, from the knee down on the sock's,
// the shoe on the boot's; press.js paints them.
import { P } from '../body.js';
import { R } from './kit.js';
import { out } from './build.js';
import { sstep } from './paint.js';

export const TROUSERS = { top: 1.022, knee: P.kneeY, hem: 0.07 };
// from the waist to the crotch: [height, the whole garment's half width, front, back, the ring's centre out from
// the middle, how square its inner half is, the gap from the middle to its inner side] (as figure.js SH)
const SEAT = [[1.022, 0.151, 0.108, 0.094, 0.05, 16, -0.003], [0.985, 0.156, 0.11, 0.1, 0.054, 16, -0.003], [0.94, 0.163, 0.11, 0.111, 0.06, 16, -0.003],
  [0.895, 0.17, 0.109, 0.12, 0.069, 14, -0.003], [0.85, 0.175, 0.108, 0.122, 0.079, 9, -0.003], [0.8, 0.178, 0.106, 0.117, 0.088, 4.5, 0]];
// each leg below it: [height, outer, inner, front, back, centre out from the middle, forward]
const LEG = [[0.74, 0.087, 0.084, 0.102, 0.108, 0.092, 0.006], [0.66, 0.082, 0.079, 0.096, 0.097, 0.092, 0.009], [0.585, 0.076, 0.073, 0.089, 0.087, 0.091, 0.012],
  [P.kneeY, 0.072, 0.07, 0.085, 0.078, 0.09, 0.013], [0.455, 0.07, 0.068, 0.078, 0.079, 0.09, 0.008], [0.37, 0.069, 0.068, 0.073, 0.085, 0.09, 0.002],
  [0.27, 0.066, 0.065, 0.071, 0.078, 0.09, 0], [0.17, 0.064, 0.063, 0.071, 0.072, 0.09, 0.002], [0.105, 0.063, 0.062, 0.076, 0.07, 0.09, 0.008], [TROUSERS.hem, 0.063, 0.062, 0.078, 0.069, 0.09, 0.01]];

function lower(b, s, n) {
  const up = 'upperLeg' + n, lo = 'lowerLeg' + n, ft = 'foot' + n, toe = 'toe' + n, mirror = s < 0, io = (o, i) => (s > 0 ? [o, i] : [i, o]);
  // the leg takes the cloth with it from the hip down; the middle of the front and the seat stay with the hips
  const w = p => {
    const k = sstep(0.99, 0.79, p[1]) * (1 - sstep(0.77, 0.83, p[1]) * sstep(0.06, 0.005, s * p[0])), kn = sstep(P.kneeY + 0.05, P.kneeY - 0.05, p[1]);
    return { hips: 1 - k, [up]: k * (1 - kn), [lo]: k * kn };
  };
  // a crease down the front of each leg and a few soft folds, deeper toward the knee and the hem (outward only)
  const fold = (a, r) => (r.lip ? null : out(a, 0.004 * (sstep(0.9, 0.6, r.c[1]) * Math.max(0, 0.4 + 0.6 * Math.sin(a * 3 + 2 + s)) + sstep(0.3, 0.1, r.c[1]) * Math.max(0, Math.sin(a * 4 + s)))));
  const vTop = y => (TROUSERS.top - y) / (TROUSERS.top - TROUSERS.knee), vLow = y => (TROUSERS.knee - y) / (TROUSERS.knee - TROUSERS.hem);
  const seat = ([y, hw, f, bk, cx, sq, gap]) => ({ c: [s * cx, y, 0.004], rx: io(hw - cx, cx - gap), rz: [f, bk], n: io(2.3, sq), w });
  const leg = ([y, o, i, f, bk, cx, z]) => ({ c: [s * cx, y, z], rx: io(o, i), rz: [f, bk], n: 2.2, w });
  const upper = [...SEAT.map(seat), ...LEG.slice(0, 4).map(leg)].map(r => ({ ...r, v: vTop(r.c[1]) }));
  b.loft(upper, s > 0 ? R.shortsL : R.shortsR, { seg: 16, a0: Math.PI, mirror, shape: fold });
  const low = LEG.slice(3).map(leg).map(r => ({ ...r, v: vLow(r.c[1]) }));
  low.push({ c: [s * 0.09, TROUSERS.hem + 0.012, 0.004], rx: 0.04, rz: [0.046, 0.044], w, v: 0.995, lip: true });   // the hem, turned in to the ankle
  b.loft(low, R.sock, { seg: 16, a0: Math.PI, mirror, shape: fold });
  // the shoe: lofted heel to toe, a flat sole, a rounder toe than a boot's. [z, half width, half height, centre height]
  const SHOE = [[-0.078, 0.02, 0.024, 0.03], [-0.066, 0.036, 0.044, 0.042], [-0.036, 0.043, 0.049, 0.045], [0.005, 0.046, 0.048, 0.044], [0.045, 0.049, 0.04, 0.037], [0.09, 0.052, 0.033, 0.03],
    [0.14, 0.051, 0.03, 0.027], [0.178, 0.045, 0.027, 0.025], [0.2, 0.032, 0.021, 0.021]];
  const bw = p => { const k = sstep(0.07, 0.12, p[2]); return { [ft]: 1 - k, [toe]: k }; };
  b.loft(SHOE.map(([z, hw, hh, cy], i) => ({ c: [s * P.hipX, cy, z], rx: hw, rz: hh, n: 2.6, v: i / (SHOE.length - 1), w: bw })), R.boot, { seg: 12, a0: Math.PI, mirror, ax: [1, 0, 0], az: [0, 1, 0], capStart: true, capEnd: true,
    shape: (a, r) => (Math.cos(a) < -0.5 ? [0, (-Math.cos(a) - 0.5) * r.rz * 0.5, 0] : null) });
}

// figureGeometry's `dress` for a photographer: how far each hand is closed (the right round the grip, the left
// cupped under the lens)
export const PRESS_DRESS = { key: 'press', lower, arm: { long: true, shut: { L: 0.62, R: 1.42 } } };
