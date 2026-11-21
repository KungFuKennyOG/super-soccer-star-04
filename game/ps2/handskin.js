// The painted sheet for your own '04 hand (handgeo.js regions), at a PS2-era level of detail (Kenny: "just a normal
// PS2 era hands is fine"): shaded round, nails, soft knuckles, the palm's creases; no veins, hairs or wrinkles. Painted the way the '04 players' limbs are
// (cloth.js limbs): the form is in the paint, strongly: each finger and the hand are shaded round, the shade
// between the fingers, under the knuckles and in every crease is painted in, raised things (knuckles, tendons,
// pads, the nails' plates) are lit, and skin goes warmer and redder in the shade (shadeSkin). Never one flat tone:
// blotched, redder over the joints and fingertips, the palm and pads paler and pinker.
// The sweatband is towelling in the kit color with a trim stripe near each edge (two, never three).
import { REG, A0, FINGERS, THUMB, PALM, BAND, knuckleY, SHEET } from './handgeo.js';
import { sstep, hash, vnoise, clamp01, mix, shadeSkin } from './paint.js';

const spow = (v, e) => Math.sign(v) * Math.abs(v) ** e;
function palmRing(s) {                                     // the palm's section at s, interpolated from PALM
  let i = 0; while (i < PALM.length - 2 && PALM[i + 1][0] < s) i++;
  const a = PALM[i], b = PALM[i + 1], t = clamp01((s - a[0]) / (b[0] - a[0]));
  return a.map((v, k) => mix(v, b[k], t));
}
// a soft line or spot: 1 on it, falling off over w; nothing (and no exp) beyond 3 w
const line = (d, w) => { const k = d / w; return k > 3 || k < -3 ? 0 : Math.exp(-k * k); };
const spot = (dx, wx, dy, wy) => line(dx, wx) * line(dy, wy);

// Blotches at quarter size, looked up (a noise call per pixel was most of the painting time).
let BL;
function blotches() {
  if (BL) return BL;
  const n = 128, a = new Float32Array(n * n), b = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { a[y * n + x] = vnoise(x / 5, y / 5, 3) - 0.5; b[y * n + x] = vnoise(x / 7, y / 7, 21) - 0.5; }
  return (BL = { n, a, b });
}

// skin, band, trim: [r, g, b]
// Painting in steps (a generator: about eight even pieces), so a kit change in the headset can spread it over
// frames; the sheet is written to the canvas at the end. paintHand does it all at once.
export function paintHand(ctx, o) { for (const _ of paintSteps(ctx, o)); }   // eslint-disable-line no-unused-vars
export function* paintSteps(ctx, { skin, band, trim }) {
  const img = ctx.createImageData(SHEET.w, SHEET.h), px = img.data, bl = blotches();
  const deep = 1 - (skin[0] * 0.3 + skin[1] * 0.59 + skin[2] * 0.11) / 255;
  const C = [0, 0, 0];
  // m: light (1 = as it is). red: flushed. pale: little pigment (palm, pads). hi: a sheen. blue: a vein under it.
  const put = (i, gx, gy, m, red, pale, hi, blue) => {
    const q = (gy >> 1) * bl.n + (gx >> 1), n1 = bl.a[q], n2 = bl.b[q];
    C[0] = skin[0]; C[1] = skin[1]; C[2] = skin[2];
    if (pale > 0) { const p = pale * (0.3 + 0.7 * deep) * 0.6; C[0] += (238 - C[0]) * p; C[1] += (188 - C[1]) * p; C[2] += (168 - C[2]) * p; }
    if (blue > 0) { const b = blue * (0.5 - 0.3 * deep); C[0] *= 1 - 0.2 * b; C[1] *= 1 - 0.1 * b; C[2] *= 1 + 0.06 * b; }
    shadeSkin(C, m * (1 + 0.1 * n1 + 0.03 * (hash(gx, gy, 4) - 0.5)));
    red += 0.7 * n2;
    C[0] *= 1 + 0.09 * red; C[1] *= 1 - 0.09 * red; C[2] *= 1 - 0.11 * red;
    const h = Math.max(0, hi) * (24 + 44 * deep);
    px[i] = C[0] + h; px[i + 1] = C[1] + h * 0.94; px[i + 2] = C[2] + h * 0.9; px[i + 3] = 255;
  };
  const each = (reg, a0, fn, y0 = 0, y1 = reg.h) => {
    for (let y = y0; y < y1; y++) {
      const s = reg.s0 + (y + 0.5) / reg.h * (reg.s1 - reg.s0);
      for (let x = 0; x < reg.w; x++) {
        const a = a0 + (x - 0.5) / (reg.w - 2) * Math.PI * 2, gx = reg.x + x, gy = reg.y + y;
        fn(s, Math.cos(a), Math.sin(a), ((gy * SHEET.w) + gx) * 4, gx, gy, a);
      }
    }
  };

  // ---- forearm, band, wrist, palm and back of the hand ----
  const FX = FINGERS.map(f => f.at[0]), KY = FX.map(knuckleY);
  const armPx = (s, cs, sn, i, gx, gy, a) => {
    if (s < -BAND[0] && s > -BAND[1]) {                    // the sweatband: towelling loops, rolled edges, a trim stripe near each
      const e = Math.min(s + BAND[1], -BAND[0] - s), t = (s + BAND[1]) / (BAND[1] - BAND[0]);
      const loop = 0.84 + 0.16 * hash(gx >> 1, gy >> 1, 7) + 0.3 * bl.a[(gy >> 1) * bl.n + (gx >> 1)];
      const stripe = Math.abs(t - 0.17) < 0.05 || Math.abs(t - 0.83) < 0.05;
      const c = stripe ? trim : band, m = loop * (0.72 + 0.28 * sstep(0, 0.007, e)) * (0.9 + 0.1 * cs) * (1 + 0.05 * Math.cos(a * 5 + t * 7));
      px[i] = c[0] * m; px[i + 1] = c[1] * m; px[i + 2] = c[2] * m; px[i + 3] = 255;
      return;
    }
    if (s < 0) {                                           // the forearm and the wrist
      let m = 0.9 + 0.1 * cs - 0.1 * sn * sn, red = 0.1, pale = 0.35 * sstep(-0.2, -0.8, cs), hi = 0, blue = 0;
      if (s > -BAND[0]) {                                  // the wrist: the band's shadow, creases inside, the bone on the little finger's side
        m -= 0.2 * sstep(-BAND[0] + 0.006, -BAND[0], s);
        m -= sstep(-0.2, -0.7, cs) * 0.25 * (line(s + 0.0035, 0.0007) + 0.7 * line(s + 0.009, 0.0006));
        const bone = spot(cs - 0.5, 0.35, s + 0.006, 0.006) * (sn > 0 ? 1 : 0);
        m += 0.12 * bone; hi += 0.4 * bone;
      } else {
        m -= 0.16 * sstep(-BAND[1] - 0.008, -BAND[1], s);    // under the band's other edge
      }
      put(i, gx, gy, m, red, pale, hi, blue);
      return;
    }
    const r = palmRing(s), e = 2 / r[5], x = sn > 0 ? spow(sn, e) * r[2] : spow(sn, e) * r[1];   // where across the hand this pixel is
    let m, red = 0.15, pale = 0, hi = 0, blue = 0;
    if (cs > 0) {                                          // the back of the hand
      m = 0.92 + 0.08 * cs - 0.12 * (1 - cs) * (1 - cs);
      m -= 0.14 * sstep(0.006, 0, s);                      // out of the wrist
      const fan = sstep(0.012, 0.08, s), body = sstep(0.018, 0.04, s) * sstep(0.084, 0.07, s);
      for (let k = 0; k < 4; k++) {
        const tx = mix(-0.004 + FX[k] * 0.3, FX[k], fan), dx = x - tx;
        m += 0.05 * line(dx, 0.0025) * body;                                   // a tendon to each knuckle
        
        if (k < 3) m -= 0.05 * line(x - (tx + mix(-0.004 + FX[k + 1] * 0.3, FX[k + 1], fan)) / 2, 0.0035) * body * fan;   // the valley between two
        const kn = spot(x - FX[k], 0.0055, s - (KY[k] - 0.004), 0.0055);     // the knuckle: lit, red, wrinkled across
        m += 0.1 * kn; red += 0.6 * kn; hi += 0.25 * kn;
        m -= 0.16 * spot(x - FX[k], 0.007, s - (KY[k] - 0.0125), 0.0022);    // the shade behind it
        if (k < 3) m -= 0.2 * spot(x - (FX[k] + FX[k + 1]) / 2, 0.0035, s - (Math.min(KY[k], KY[k + 1]) - 0.001), 0.007);   // the dimple between two knuckles
      }
      m -= 0.18 * spot(x + 0.034, 0.009, s - 0.055, 0.016);                  // the hollow of the thumb's web
    } else {                                               // the palm
      const ap = -cs, u = x, k = sstep(0.05, 0.5, ap);
      m = 0.9 + 0.06 * ap - 0.14 * (1 - ap) * (1 - ap);
      pale = 0.95 * k;
      m += k * (0.1 * spot(u + 0.022, 0.014, s - 0.036, 0.02) + 0.08 * spot(u - 0.024, 0.012, s - 0.035, 0.022));   // the ball of the thumb, the heel under the little finger
      m -= k * 0.12 * spot(u + 0.002, 0.014, s - 0.05, 0.016);                                                    // the hollow of the palm
      const distal = s - (0.0725 + 0.05 * Math.max(0, 0.02 - u) * sstep(0.03, -0.012, u) - 0.12 * Math.max(0, u - 0.02) ** 1.4);
      const proximal = s - (0.064 - 0.66 * (u + 0.035) * (u + 0.035));
      const tc = u - (-0.03 + 0.024 * sstep(0.065, 0.012, s) - 0.007 * Math.sin((s - 0.012) / 0.054 * Math.PI));
      const crease = line(distal, 0.0008) * sstep(-0.024, -0.012, u) + 0.9 * line(proximal, 0.0008) * sstep(0.032, 0.012, u) * sstep(-0.042, -0.03, u)
        + line(tc, 0.0008) * sstep(0.012, 0.022, s) * sstep(0.07, 0.06, s);
      m -= k * 0.3 * Math.min(1, crease);
      m -= k * 0.05 * (line(distal + 0.004, 0.003) + line(tc - 0.004, 0.003));    // each crease's soft shade
      for (let j = 0; j < 4; j++) {                        // the pads under the fingers' roots, the creases where the fingers start
        m += k * 0.07 * spot(u - FX[j], 0.006, s - 0.079, 0.005);
        if (j < 3) m -= k * 0.12 * spot(u - (FX[j] + FX[j + 1]) / 2, 0.002, s - 0.084, 0.007);
      }
      red += 0.5 * spot(u - 0.024, 0.014, s - 0.03, 0.02) + 0.4 * spot(u + 0.022, 0.014, s - 0.034, 0.02) + 0.35 * line(s - 0.079, 0.008);
      m -= 0.12 * sstep(0.006, 0, s);
    }
    put(i, gx, gy, m, red, pale, hi, blue);
  };
  for (let k = 0; k < 3; k++) { each(REG.arm, A0.arm, armPx, Math.round(REG.arm.h * k / 3), Math.round(REG.arm.h * (k + 1) / 3)); yield; }

  // ---- fingers and thumb ----
  const digit = (reg, a0, lens, isThumb) => {
    const tip = lens[0] + lens[1] + lens[2], j1 = lens[0], j2 = lens[0] + lens[1], c1 = isThumb ? j1 - 0.002 : 0.016;
    const n0 = tip - (isThumb ? 0.0155 : 0.013), n1 = tip - 0.0012;
    each(reg, a0, (s, cs, sn, i, gx, gy) => {
      const across = Math.atan2(sn, cs), aa = Math.abs(across);          // 0 on the back, pi on the pad
      // round: lit along the back, darker down the sides, the pad side a little lit again
      let m = 0.93 + 0.07 * cs - 0.2 * sn * sn * (cs > 0 ? 1 : 0.55), red = 0.2 + 0.5 * sstep(tip - 0.02, tip, s), pale = 0, hi = 0;
      if (!isThumb) m -= 0.26 * sstep(0.012, -0.004, s) * sstep(0.35, 0.9, Math.abs(sn));      // between the fingers at their roots
      else m -= 0.12 * sstep(0.02, 0, s);
      if (cs > 0.1) {                                      // the back
        const w = sstep(1.25, 0.5, aa);
        // each knuckle: a lit bump, red, ringed by wrinkles that curve round it; a shade either side of it along the finger
        const kn = (c, span, rings, amt) => {
          const d = s - c, r = Math.hypot(d / span, across / 0.9);
          if (r > 2.2) return;
          const g = Math.exp(-r * r);
          m += w * amt * (0.06 * g - 0.1 * g * (0.5 + 0.5 * Math.cos(r * 2 * Math.PI)));   // one soft fold
          m -= w * amt * 0.09 * (line(d - span * 1.5, span * 0.5) + line(d + span * 1.5, span * 0.5));
          red += 0.6 * amt * g; hi += 0.2 * amt * g;
        };
        kn(j1 + 0.0005, 0.0055, 3.2, 1); kn(j2 + 0.0005, 0.004, 2.4, 0.75);
        // the nail: its plate lit and pink, a white crescent at the root, the free edge, dark folds round it
        const half = 0.9 - 0.16 * sstep(n0, n1, s) - 0.25 * sstep(n0 + 0.002, n0, s);
        if (s > n0 - 0.0016 && s < n1 + 0.0006 && aa < half + 0.16) {
          if (s > n0 && s < n1 && aa < half) {
            const t = (s - n0) / (n1 - n0), side = aa / half;
            const lun = (isThumb ? 0.85 : 0.45) * sstep(0.24, 0.12, t + 0.14 * side * side), free = sstep(0.86, 0.93, t);
            const base = [mix(skin[0], 232, 0.5), mix(skin[1], 170, 0.45), mix(skin[2], 160, 0.42)], white = Math.max(lun * 0.6, free * 0.8);
            const mm = (1.02 + 0.16 * line(across + 0.2, 0.22) * (1 - free) - 0.14 * sstep(0.7, 1, side) - 0.06 * sstep(0.2, 0, t)) * (0.96 + 0.08 * cs);
            px[i] = mix(base[0], 246, white) * mm; px[i + 1] = mix(base[1], 230, white) * mm; px[i + 2] = mix(base[2], 216, white) * mm; px[i + 3] = 255;
            return;
          }
          m -= 0.2; red += 0.45;                           // the folds of skin round it
        }
      } else if (cs < -0.05) {                             // the pad side: paler, a fat pad on each bone, the creases between them
        const k = sstep(-0.05, -0.45, cs);
        pale = 0.9 * k;
        const cr = line(s - c1, 0.0008) + (isThumb ? 0 : 0.8 * line(s - c1 - 0.0032, 0.0007)) + line(s - (isThumb ? j2 : j1 - 0.0005), 0.0008)
          + (isThumb ? 0 : 0.75 * line(s - (j1 + 0.0028), 0.0007) + 0.9 * line(s - (j2 + 0.0005), 0.0008));
        m -= 0.3 * k * Math.min(1, cr);
        const pads = line(s - (c1 + j1) / 2, 0.007) + line(s - (j1 + j2) / 2 - 0.001, 0.006) + line(s - (tip - 0.009), 0.007);
        m += 0.07 * k * pads * (-cs); hi += 0.12 * k * pads * (-cs);
        red += 0.5 * line(s - (tip - 0.007), 0.006) + 0.2 * pads;
      }
      m -= 0.1 * sstep(tip - 0.003, tip, s);
      put(i, gx, gy, m, red, pale, hi, 0);
    });
  };
  for (const f of FINGERS) { digit(REG[f.name], A0.finger, f.len, false); yield; }
  digit(REG.thumb, A0.thumb, THUMB.len, true);
  ctx.putImageData(img, 0, 0);
}
