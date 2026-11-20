// The painted sheet for your own '04 hand (handgeo.js regions): skin in the face's manner (face.js: never flat,
// blotchy, warmer and redder where blood is near the surface, the shade painted only where the shape can't make
// it), with the hand's own marks: knuckle wrinkles, the palm's creases and the fingers' flexion creases, nails
// with their cuticle, lunula and free edge, tendons and veins faint on the back, a little hair on the forearm.
// The sweatband is towelling in the kit color with a trim stripe near each edge (two, never three).
import { REG, A0, FINGERS, THUMB, PALM, BAND, knuckleY, SHEET } from './handgeo.js';
import { sstep, gauss, hash, vnoise, clamp01, mix } from './paint.js';

const spow = (v, e) => Math.sign(v) * Math.abs(v) ** e;
function palmRing(s) {                                     // the palm's section at s, interpolated from PALM
  let i = 0; while (i < PALM.length - 2 && PALM[i + 1][0] < s) i++;
  const a = PALM[i], b = PALM[i + 1], t = clamp01((s - a[0]) / (b[0] - a[0]));
  return a.map((v, k) => mix(v, b[k], t));
}
// a soft line: 1 on it, falling off over w (m)
const line = (d, w) => Math.exp(-((d / w) ** 2));

// skin, band, trim: [r, g, b]
export function paintHand(ctx, { skin, band, trim }) {
  const img = ctx.createImageData(SHEET.w, SHEET.h), px = img.data;
  const dk = sstep(0.45, 0.78, 1 - (skin[0] + skin[1] + skin[2]) / 765);           // 0 fair, 1 darkest
  // palms and the pads have little pigment: lighter, pinker, yellower in the creases (much more so on dark skin)
  const palmC = [mix(skin[0], 236, 0.18 + 0.4 * dk), mix(skin[1], 186, 0.12 + 0.42 * dk), mix(skin[2], 160, 0.1 + 0.4 * dk)];
  const vein = [skin[0] * 0.78, skin[1] * 0.84, skin[2] * 0.98 + 14];
  const put = (i, c, m, red) => {
    const r = c[0], g = c[1], b = c[2];
    px[i] = r * m * (1 + 0.07 * red); px[i + 1] = g * m * (1 - 0.06 * red); px[i + 2] = b * m * (1 - 0.08 * red); px[i + 3] = 255;
  };
  const C = [0, 0, 0];
  const each = (reg, a0, fn) => {
    for (let y = 0; y < reg.h; y++) {
      const s = reg.s0 + (y + 0.5) / reg.h * (reg.s1 - reg.s0);
      for (let x = 0; x < reg.w; x++) {
        const a = a0 + (x - 0.5) / (reg.w - 2) * Math.PI * 2, gx = reg.x + x, gy = reg.y + y;
        fn(s, a, Math.cos(a), Math.sin(a), ((gy * SHEET.w) + gx) * 4, gx, gy);
      }
    }
  };
  // the base: skin from back to palm, blotched at two scales, a fine grain
  const skinAt = (cs, gx, gy, k = 1) => {
    const palm = sstep(0.15, -0.45, cs) * k, n = vnoise(gx / 18, gy / 18, 3) - 0.5, n2 = vnoise(gx / 5, gy / 5, 9) - 0.5, gr = hash(gx, gy, 4) - 0.5;
    for (let j = 0; j < 3; j++) C[j] = mix(skin[j], palmC[j], palm);
    return 1 + 0.06 * n + 0.035 * n2 + 0.025 * gr;
  };

  // ---- forearm, band, wrist, palm and back of the hand ----
  each(REG.arm, A0.arm, (s, a, cs, sn, i, gx, gy) => {
    if (s < -BAND[0] && s > -BAND[1]) {                    // the sweatband: towelling loops, rolled edges, a trim stripe near each
      const e = Math.min(s + BAND[1], -BAND[0] - s), t = (s + BAND[1]) / (BAND[1] - BAND[0]);
      const loop = 0.86 + 0.14 * hash(gx >> 1, gy >> 1, 7) + 0.08 * (vnoise(gx / 3, gy / 2, 8) - 0.5);
      const stripe = Math.abs(t - 0.16) < 0.055 || Math.abs(t - 0.84) < 0.055;
      const c = stripe ? trim : band, m = loop * (0.8 + 0.2 * sstep(0, 0.006, e)) * (1 + 0.04 * Math.cos(a * 3 + t * 9));
      px[i] = c[0] * m; px[i + 1] = c[1] * m; px[i + 2] = c[2] * m; px[i + 3] = 255;
      return;
    }
    let m = skinAt(cs, gx, gy, s < 0 ? 0.35 : 1), red = 0.25;
    if (s < 0) {                                           // the forearm: hair on the back, veins faint on the inside
      const hair = cs > -0.2 && hash(gx, gy >> 1, 11) > 0.93 && hash(gx, (gy + 1) >> 1, 11) > 0.5 ? 0.16 * sstep(-0.2, 0.4, cs) : 0;
      m *= 1 - hair;
      if (s > -BAND[0]) {                                  // the wrist between band and hand: two creases on the inside
        const k = sstep(0, -0.6, cs);
        m *= 1 - k * 0.18 * (line(s + 0.004, 0.0006) + 0.7 * line(s + 0.0105, 0.0005));
      } else m *= 1 - 0.05 * sstep(-0.3, -0.9, cs) * line(Math.sin(a * 2 + s * 90) * 0.01, 0.0015);
      put(i, C, m, red);
      return;
    }
    const r = palmRing(s), e = 2 / r[5], x = sn > 0 ? spow(sn, e) * r[2] : spow(sn, e) * r[1];   // where across the hand this pixel is
    if (cs > 0) {                                          // the back: tendons from each knuckle toward the wrist, veins, the knuckles
      const ky = knuckleY(x), kk = sstep(0.02, 0.07, s);
      let tend = 0;
      for (const f of FINGERS) {
        const tx = mix(-0.006 + f.at[0] * 0.35, f.at[0], sstep(0.01, 0.08, s));
        tend += line(x - tx, 0.0016) * kk;
      }
      m *= 1 + 0.05 * tend - 0.025 * (1 - Math.min(1, tend * 2)) * kk;
      // a vein or two across the back: wavy, bluish, low
      const v1 = line(x - (0.012 + 0.006 * Math.sin(s * 120)) + (s - 0.03) * 0.25, 0.0011) * sstep(0.015, 0.03, s) * sstep(0.07, 0.05, s);
      const v2 = line(x + 0.014 - 0.004 * Math.sin(s * 150 + 1) - (s - 0.02) * 0.3, 0.001) * sstep(0.01, 0.03, s) * sstep(0.06, 0.045, s);
      const vk = (v1 + v2 * 0.8) * (0.55 - 0.35 * dk);
      for (let j = 0; j < 3; j++) C[j] = mix(C[j], vein[j], vk * 0.6);
      // over the knuckles: redder, a little darker, fine curved wrinkles
      let near = 0; for (const f of FINGERS) near = Math.max(near, line(x - f.at[0], 0.006));
      const kn = near * line(s - (ky - 0.0035), 0.006);
      red += 0.5 * kn; m *= 1 - 0.07 * kn * (0.5 + 0.5 * Math.sin((s - ky) * 2600 + x * 300));
    } else {                                               // the palm: its three big creases and the heel's pads
      const ap = -cs, u = x;
      const distal = Math.abs(s - (0.073 + 0.06 * (0.028 - u) * (u < 0.028 ? 1 : 0) * sstep(0.03, -0.012, u) - 0.12 * Math.max(0, u - 0.02) ** 1.4));
      const proximal = Math.abs(s - (0.06 - 0.22 * (u + 0.035) * (u + 0.035) * 3 + 0.004));
      const tc = Math.abs(u - (-0.03 + 0.024 * sstep(0.065, 0.012, s) - 0.007 * Math.sin((s - 0.012) / 0.054 * Math.PI)));
      const k = sstep(0.1, 0.6, ap);
      const crease = line(distal, 0.0007) * sstep(-0.022, -0.012, u) + 0.85 * line(proximal, 0.0007) * sstep(0.032, 0.012, u) * sstep(-0.042, -0.03, u)
        + 0.9 * line(tc, 0.0007) * sstep(0.012, 0.022, s) * sstep(0.07, 0.06, s);
      m *= 1 - k * (0.22 * crease - 0.03 * (1 - crease) * gauss(s, 0.03, 0.02));
      red += 0.25 * gauss(s, 0.03, 0.015) * sstep(0, 0.03, u) + 0.2 * gauss(s, 0.078, 0.01);
      // the finger roots: the pads under them, the creases where each finger starts
      for (const f of FINGERS) if (Math.abs(u - f.at[0]) < 0.011) m *= 1 - k * 0.12 * line(s - (knuckleY(f.at[0]) + 0.0015), 0.0008);
    }
    put(i, C, m, red);
  });

  // ---- fingers and thumb ----
  const digit = (reg, a0, lens, w, isThumb) => {
    const tip = lens[0] + lens[1] + lens[2], j1 = lens[0], j2 = lens[0] + lens[1];
    each(reg, a0, (s, a, cs, sn, i, gx, gy) => {
      let m = skinAt(cs, gx, gy, s < (isThumb ? 0.03 : 0) ? 0.6 : 1), red = 0.3 + 0.35 * sstep(tip - 0.02, tip, s);
      const across = Math.atan2(sn, cs);                   // 0 on the back, ±pi on the pad
      if (cs > 0.15) {                                     // the back: wrinkles over each knuckle, a few hairs on the first segment
        const wr = (c, n, span) => {
          const d = s - c, k = line(d, span) * sstep(0.95, 0.3, Math.abs(across));
          return k * (0.5 + 0.5 * Math.cos(d / span * n * Math.PI + across * across * 1.2));
        };
        m *= 1 - 0.14 * wr(j1 + 0.001, 3, 0.0055) - 0.08 * wr(j2 + 0.001, 2, 0.0035);
        red += 0.35 * line(s - j1, 0.006) + 0.2 * line(s - j2, 0.004);
        if (!isThumb && s > 0.008 && s < j1 - 0.01 && hash(gx, gy >> 1, 12) > 0.965) m *= 0.86;
        // the nail: plate, cuticle, the white crescent at its root, the free edge, darker at its sides
        const n0 = tip - (isThumb ? 0.0145 : 0.0125), n1 = tip - 0.0012, half = 0.82 - 0.12 * sstep(n0, n1, s);
        if (s > n0 - 0.0012 && s < n1 && Math.abs(across) < half + 0.12) {
          const inN = s > n0 && Math.abs(across) < half;
          if (inN) {
            const t = (s - n0) / (n1 - n0), side = Math.abs(across) / half;
            const lun = (isThumb ? 0.8 : 0.3) * sstep(0.2, 0.1, t + 0.12 * side * side);
            const free = sstep(0.9, 0.96, t);
            let c = [mix(C[0], 236, 0.32), mix(C[1], 176, 0.32), mix(C[2], 168, 0.3)];
            c = c.map((v, j) => mix(v, [240, 222, 210][j], Math.max(lun * 0.55, free * 0.7)));
            const mm = (1.05 + 0.1 * line(across + 0.15, 0.18) * (1 - free)) * (1 - 0.18 * sstep(0.75, 1, side)) * (1 + 0.03 * (vnoise(gx / 2, gy / 6, 5) - 0.5));
            px[i] = c[0] * mm; px[i + 1] = c[1] * mm; px[i + 2] = c[2] * mm; px[i + 3] = 255;
            return;
          }
          m *= 0.86;                                       // cuticle and nail folds
          red += 0.3;
        }
      } else if (cs < -0.1) {                              // the pad side: flexion creases at the root (double), at the middle joint (double), at the last (single)
        const k = sstep(-0.1, -0.5, cs) * sstep(1.0, 0.5, Math.abs(Math.abs(across) - Math.PI) / Math.PI * 2);
        const base = isThumb ? line(s - (j1 - 0.002), 0.0007) : line(s - 0.014, 0.0007) + 0.8 * line(s - 0.0175, 0.0006);
        const cr = base + line(s - (isThumb ? j2 : j1 - 0.001), 0.0007) + (isThumb ? 0 : 0.8 * line(s - (j1 + 0.002), 0.0006)) + (isThumb ? 0 : 0.85 * line(s - (j2 + 0.0005), 0.0007));
        m *= 1 - 0.2 * k * cr;
        red += 0.3 * line(s - (tip - 0.007), 0.005) + 0.15 * line(s - (j1 + j2) / 2, 0.006);
      }
      if (s > tip - 0.003) m *= 1 - 0.06 * sstep(tip - 0.003, tip, s);
      put(i, C, m, red);
    });
  };
  FINGERS.forEach(f => digit(REG[f.name], A0.finger, f.len, f.w, false));
  digit(REG.thumb, A0.thumb, THUMB.len, 0.011, true);
  ctx.putImageData(img, 0, 0);
}
