// The crowd's heads, rendered once in code: a head modelled as a few blended ellipsoids (skull, face,
// jaw, brow, nose, ears, neck, eye sockets carved in), with hair, a cap, a beanie or a hood as a
// shell over it, ray-marched from the front, a three-quarter view and a near profile, lit from above
// and to the left with the creases (sockets, under the nose and jaw) darkened. Eyes, brows and the
// mouth (shut, open, an O) are painted on where the ray lands. 0.6 cm a pixel, 40 x 48 a head;
// 2 faces (FACES: lean, and rugged with a wider jaw, a bigger nose and a heavier brow) x 9 styles x
// 3 views x 3 mouths. Two masks go with every face for the shader to use per fan: where a beard grows
// (graded: chin and upper lip 1, jaw 0.6, up the cheeks 0.35, so one mask gives stubble, a goatee and
// moustache, or a full beard) and where glasses sit (frames 1, lenses 0.5). Written straight into the
// atlas's arrays (fantex.js).
import { hash } from './paint.js';

export const STYLES = ['short', 'buzz', 'bald', 'cap', 'beanie', 'long', 'curly', 'hood', 'receding'];
// jaw: its half width, nose: its size, brow: the ridge's height, cheek: the cheekbones' width
export const FACES = [{ jaw: 5.0, nose: 1, brow: 1.5, cheek: 6.3 }, { jaw: 6.0, nose: 1.22, brow: 1.85, cheek: 6.7 }];
export const HEAD = { w: 40, h: 48, cm: 0.6, x0: -12, y0: -13, styles: STYLES.length, faces: FACES.length, views: [0, 0.6, 1.05], mouths: 3 };

const ell = (x, y, z, cx, cy, cz, rx, ry, rz) => {
  const X = (x - cx) / rx, Y = (y - cy) / ry, Z = (z - cz) / rz, k0 = Math.sqrt(X * X + Y * Y + Z * Z), k1 = Math.sqrt(X * X / (rx * rx) + Y * Y / (ry * ry) + Z * Z / (rz * rz));
  return k1 < 1e-6 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
};
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// the head and neck (skin), for face F
let F = FACES[0];
function skin(x, y, z) {
  const bound = ell(x, y, z, 0, -0.5, 0.6, 9.6, 13, 11.6);                            // far off: the distance to a box round it all
  if (bound > 1.5) return bound;
  let d = smin(ell(x, y, z, 0, 2.4, -0.8, 7.5, 9.3, 9.6), ell(x, y, z, 0, -2.6, 1.6, F.cheek, 7.6, 7.4), 2.5);
  d = smin(d, ell(x, y, z, 0, -6.9, 2.3, F.jaw, 3.7, 5.5), 2);                        // jaw and chin
  d = smin(d, ell(x, y, z, 0, 3.1, 6.5, 6.1, F.brow, 2.4), 1.2);                       // brow
  const n = F.nose; d = smin(d, ell(x, y + (z - 8) * 0.25, z, 0, -0.9, 8.5 + (n - 1) * 1.2, 1.25 * n, 2.8 * n, 1.9 * n), 1.0);     // nose, its tip forward and down
  const ex = Math.abs(x);
  d = smax(d, -ell(ex, y, z, 2.9, 0.9, 7.5, 1.9, 1.25, 1.5), 0.8);                    // eye sockets
  d = smin(d, ell(ex, y, z, 7.4, 0.2, -0.6, 1.3, 3, 2.1), 0.6);                       // ears
  const neck = Math.max(Math.hypot(x, z + 1) - 5.3, y + 4, -11 - y);
  return smin(d, neck, 1.5);
}
// the hair, hat or hood for a style; returns [distance, kind] (kind: 'hair' | 'acc' | 'shirt')
// the hair, hat or hood for a style: its distance, and what it is in KIND ('hair' | 'acc' | 'shirt')
let KIND = 'hair';
function hairAt(style, x, y, z) {
  const bound = ell(x, y, z, 0, 0.5, -0.5, 11.5, 15, 13.5);
  if (bound > 1.5) { KIND = 'hair'; return bound; }
  const ax = Math.abs(x), above = h => h - y;                                         // > 0 below the line
  const line = Math.max(-5.5 + 10.3 * sstep(-3, 5, z), ax > 6 && z > -2.5 && z < 3.5 ? 1.8 : -99);
  const shell = (t, lift = 0) => ell(x, y, z, 0, 2.4 + lift, -0.8, 7.5 + t, 9.3 + t, 9.6 + t);
  switch (style) {
    case 'short': KIND = 'hair'; return Math.max(shell(1.1 - 0.5 * sstep(5, 8, ax) - 0.4 * sstep(0, -6, z), 0.6), above(line + 0.3 + (x > 2 ? 0.4 : 0)));
    case 'receding': { KIND = 'hair'; const back = -5 + 11.5 * sstep(-5, 3, z) + 2.2 * sstep(2, 5.5, ax) * sstep(0, 4, z); return Math.max(shell(0.7 - 0.3 * sstep(5, 8, ax), 0.3), above(Math.max(line, back) + 0.4)); }
    case 'buzz': KIND = 'hair'; return Math.max(shell(0.35), above(line + 0.6));
    case 'bald': KIND = 'hair'; return Math.max(shell(0.3), above(-5), y - 1.2, z - 2);
    case 'long': KIND = 'hair'; return smin(Math.max(shell(1.2, 0.4), above(line)), Math.max(ell(x, y, z, 0, -3.5, -2.6, 9, 12, 8.6), z - 2.5 - (ax - 5.5) * 3, -14 - y), 1.5);
    case 'curly': KIND = 'hair'; return Math.max(shell(2.4, 0.6) + 0.45 * Math.sin(x * 1.7) * Math.sin(y * 1.9) * Math.sin(z * 1.6), above(line + 0.2));
    case 'cap': {
      const crown = Math.max(shell(0.9, 0.3), above(3.6)), brim = ell(x, y - (z - 8) * 0.12, z, 0, 4.2, 9.8, 6.4, 0.6, 5.4);
      KIND = 'acc'; return Math.min(crown, brim);
    }
    case 'beanie': KIND = 'acc'; return Math.max(shell(1.5, 0.9), above(3.4));
    case 'hood': {
      const outer = ell(x, y, z, 0, 0.8, -1.6, 10.6, 13.2, 11.6), opening = ell(x, y, z, 0, -1.2, 9.5, 6.6, 9.6, 6);
      KIND = 'shirt'; return Math.max(outer, -(outer + 1.6), -opening, -15 - y);
    }
  }
  KIND = 'hair'; return 99;
}

// out: { a: Uint8Array RGBA (L premultiplied, shirt, acc, alpha), b: RG (skin, hair) }, W: atlas width,
// at(cell): its top-left pixel. cell = style * 9 + view * 3 + mouth.
// March one ray (view x, y) through f (the head turned by yaw); the hit with its view depth, normal,
// light and how open the space round it is (creases darker).
function march(f, isHair, vx, vy, c, s, Lv, zMin = -16) {
  const r2 = vx * vx + (vy - 1) * (vy - 1);                                           // inside a 16 cm ball round the head, or nothing
  if (r2 > 256) return null;
  let z = Math.sqrt(256 - r2);
  for (let k = 0; k < 56 && z > zMin; k++) {
    const hx = vx * c - z * s, hz = vx * s + z * c, d = f(hx, vy, hz), kind = isHair ? KIND : 'skin';
    if (d < 0.04) {
      const e = 0.12, g = f;
      let nx = g(hx + e, vy, hz) - g(hx - e, vy, hz), ny = g(hx, vy + e, hz) - g(hx, vy - e, hz), nz = g(hx, vy, hz + e) - g(hx, vy, hz - e);
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const vnx = nx * c + nz * s, vnz = -nx * s + nz * c;                             // the normal in the view
      return { x: hx, y: vy, z: hz, vz: z, kind, dif: Math.max(0, vnx * Lv[0] + ny * Lv[1] + vnz * Lv[2]), ao: Math.max(0, Math.min(1, g(hx + nx * 0.9, vy + ny * 0.9, hz + nz * 0.9) / 0.9)), rim: vnz };
    }
    z -= Math.max(d * 0.9, 0.03);
  }
  return null;
}

// out: { a: Uint8Array RGBA (L premultiplied, shirt, acc, alpha), b: RGBA (skin, hair, beard, glasses) },
// W: atlas width, at(cell): its top-left pixel. cell = (face * styles + style) * 9 + view * 3 + mouth. Each
// face is marched once a view and each style's hair once a view (hair doesn't depend on the face); the
// nearer of the two is kept.
export const headCell = (face, style, view, mouth) => (face * STYLES.length + style) * 9 + view * 3 + mouth;
export function paintHeads(out, W, at) {
  const { w, h, cm } = HEAD, SS = 2, light = [-0.36, 0.55, 0.75], ln = Math.hypot(...light), Lv = light.map(v => v / ln);
  const ray = (px, py) => [HEAD.x0 + (px + 0.5) * cm / SS, HEAD.y0 + (h * SS - py - 0.5) * cm / SS];
  const N = w * SS * h * SS;
  HEAD.views.forEach((yaw, vi) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const faces = FACES.map(f => { F = f; const out2 = []; for (let i = 0; i < N; i++) out2.push(march(skin, false, ...ray(i % (w * SS), Math.floor(i / (w * SS))), c, s, Lv)); return out2; });
    STYLES.forEach((style, si) => {
      const hair = [];
      for (let i = 0; i < N; i++) hair.push(march((X, Y, Z) => hairAt(style, X, Y, Z), true, ...ray(i % (w * SS), Math.floor(i / (w * SS))), c, s, Lv));
      faces.forEach((face, fi) => {
        const hits = face.map((Fh, i) => { const H = hair[i]; return !H ? Fh : !Fh ? H : H.vz > Fh.vz ? H : Fh; });
        for (let mi = 0; mi < 3; mi++) {
          const [ox, oy] = at(headCell(fi, si, vi, mi));
          for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
            let L = 0, sh = 0, ac = 0, sk = 0, hr = 0, al = 0, bd = 0, gl = 0;
            for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
              const H = hits[(py * SS + sy) * w * SS + px * SS + sx];
              if (!H) continue;
              const [l, kind, beard, glass] = shade(H, style, mi, si);
              al += 1; L += l; bd += beard; gl += glass;
              if (kind === 'skin') sk += 1; else if (kind === 'hair') hr += 1; else if (kind === 'acc') ac += 1; else if (kind === 'shirt') sh += 1;
            }
            if (!al) continue;
            const n = SS * SS, i = ((oy + py) * W + ox + px);
            out.a[i * 4] = Math.round(255 * L / n); out.a[i * 4 + 1] = Math.round(255 * sh / n); out.a[i * 4 + 2] = Math.round(255 * ac / n); out.a[i * 4 + 3] = Math.round(255 * al / n);
            out.b[i * 4] = Math.round(255 * sk / n); out.b[i * 4 + 1] = Math.round(255 * hr / n); out.b[i * 4 + 2] = Math.round(255 * bd / n); out.b[i * 4 + 3] = Math.round(255 * gl / n);
          }
        }
      });
    });
  });
}

// Where a beard grows on the skin (graded, see the top) and where glasses sit, in the head's own frame.
function beardAt(x, y, z) {
  const ax = Math.abs(x);
  if (z < -1.2 || y > -2 || y < -10.2) return 0;
  const fade = sstep(-10.2, -9.2, y) * sstep(-1.2, 0.8, z);
  if (y > -5.0 && y < -4.1 && ax < 2.5 && z > 5) return fade;               // the upper lip
  if (y < -6.0 && ax < 2.6 && z > 3) return fade;                            // the chin
  if (y < -4.6 && ax < 7.2) return 0.6 * fade;                                // round the jaw
  return 0.35 * fade * sstep(-2, -3, y) * sstep(2.6, 4, ax);                  // up the cheeks to the sideburns
}
function glassesAt(x, y, z) {
  const ax = Math.abs(x);
  if (z > 4.8) {
    const e = ((ax - 2.9) / 1.75) ** 2 + ((y - 0.8) / 1.2) ** 2;
    if (e < 1.32 && e > 0.88) return 1;                                      // the rims
    if (e <= 0.88) return 0.5;                                                // the lenses
    if (ax < 1.25 && Math.abs(y - 1.15) < 0.22) return 1;                     // the bridge
  }
  if (ax > 4.3 && z > -0.5 && z < 5.4 && Math.abs(y - 1.3 + (5.4 - z) * 0.04) < 0.24) return 1;   // the arms back to the ears
  return 0;
}

// light and what it is at a hit: eyes, brows and mouth painted on the skin
function shade(H, style, mouth, si) {
  const r = shade0(H, style, mouth, si);
  if (H.kind !== 'skin') return [r[0], r[1], 0, 0];
  return [r[0], r[1], r[1] === 'fixed' ? 0 : beardAt(H.x, H.y, H.z), glassesAt(H.x, H.y, H.z)];
}
function shade0(H, style, mouth, si) {
  const { x, y, z, dif, ao, rim } = H, ax = Math.abs(x);
  const lit = (0.42 + 0.68 * dif) * (0.55 + 0.45 * ao) * (0.78 + 0.22 * Math.max(0, rim));
  if (H.kind !== 'skin') {
    const strand = H.kind === 'hair' ? 0.86 + 0.22 * hash(Math.round(x * 3), Math.round(y * 1.2), si) : 1;
    const part = style === 'short' && Math.abs(x - 2.4) < 0.35 && y > 6 ? 0.6 : 1;      // a side parting
    return [Math.min(1, lit * strand * part * (H.kind === 'hair' ? 0.95 : 0.92)), H.kind];
  }
  if (z > 4) {
    // eyes: a white with a dark iris, a lid line over it
    const ex = (ax - 2.9) / 1.0, ey = (y - 0.7) / 0.42;
    if (ex * ex + ey * ey < 1 && z > 5.5) { const ir = ((ax - 2.9) / 0.5) ** 2 + ((y - 0.68) / 0.45) ** 2 < 1; return [ir ? 0.1 : 0.58 * (0.6 + 0.4 * dif), 'fixed']; }
    if (Math.abs(ax - 2.9) < 1.2 && y > 1.05 && y < 1.45 && z > 5.5) return [0.25, 'fixed'];
    // brows
    if (ax > 0.9 && ax < 4.9 && Math.abs(y - (2.75 - 0.06 * ax * ax / 4)) < 0.42 && z > 5) return [0.5 * lit, 'hair'];
    // the mouth: shut (lips), open (shouting), O (a gasp)
    const my = y + 5.4;
    if (mouth === 1 && (x / 2.1) ** 2 + ((my + 0.3) / 1.25) ** 2 < 1) return [my > 0.55 ? 0.75 : 0.1, 'fixed'];
    if (mouth === 2 && (x / 1.2) ** 2 + ((my + 0.4) / 1.6) ** 2 < 1) return [0.1, 'fixed'];
    if (mouth === 0 && ax < 2.2 && Math.abs(my) < 0.25) return [0.28, 'fixed'];
    if (ax < 2.0 && my < -0.2 && my > -1.1) return [lit * 0.88, 'skin'];               // the lower lip
  }
  return [Math.min(1, lit * 0.95), 'skin'];
}
