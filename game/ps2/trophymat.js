// What the '04-look trophies are made of, with no downloads and no post-processing. Polished metal is
// only ever a picture of what is round it, so most of this file is that picture: a stadium painted in
// code as lit values (a sky that brightens to the horizon, the sun behind thin cloud, black stands with a
// lit roof edge and strings of lamps, four floodlight banks far past white, a pitch that is dark under the stands and pale nearer you), which MeshStandardMaterial reflects (three turns the equirect into a PMREM itself, once). The
// contrast is the point: near-black next to near-white is what reads as silver, and gold is the same
// picture multiplied by gold. Then the stones (malachite, black marble), and the engraved sheet: one
// texture per cup with its plaque and a laurel band.
import * as THREE from 'three';
import { canvas, fbm, hash, mix, clamp01, sstep } from './paint.js';

let ENV = null;
const SUN = new THREE.Vector3(-0.42, 0.74, -0.52).normalize();
// The stadium seen from the centre circle at chest height: direction (unit x, y, z) -> lit rgb in out.
export function stadiumAt(x, y, z, out) {
  const az = Math.atan2(z, x), el = Math.asin(Math.max(-1, Math.min(1, y))), sa = Math.abs(Math.sin(az)), ca = Math.abs(Math.cos(az));
  const dWall = 1 / Math.hypot(ca / 78, sa / 54), dFront = 1 / Math.hypot(ca / 60, sa / 40);   // an oval ground: the roof line dips gently toward the ends
  const roof = Math.atan(27 / dWall), boards = Math.atan(0.1 / dFront) + 0.012, long = sa > 0.6;
  let r, g, b;
  if (el > roof) {
    // sky: deep overhead, brightening to a pale band over the roofs; thin cloud; the sun behind it
    const k = Math.pow(1 - (el - roof) / (Math.PI / 2 - roof), 2.2);
    r = mix(0.2, 1.02, k); g = mix(0.36, 1.08, k); b = mix(0.7, 1.18, k);
    const cl = sstep(0.5, 0.78, fbm(az * 2.2 + 9, el * 5, 3, 0) + 0.12 * Math.sin(az * 3)) * 0.75;
    r = mix(r, 1.45, cl); g = mix(g, 1.45, cl); b = mix(b, 1.5, cl);
    const d = Math.acos(Math.max(-1, Math.min(1, x * SUN.x + y * SUN.y + z * SUN.z)));
    const s = 26 * Math.exp(-d * d / 0.0035) + 3.2 * Math.exp(-d * d / 0.05) + 0.8 * Math.exp(-d * d / 0.4);
    r += s; g += s * 0.96; b += s * 0.86;
  } else if (el > boards) {
    // the stands: black under the roof, a faint crowd, the lit fascia along the roof edge, lamps under it
    const t = (el - boards) / (roof - boards), k = 0.02 + 0.07 * t * (0.6 + 0.8 * fbm(az * 30, t * 12, 5, 0));
    r = k * 1.1; g = k; b = k * 1.05;
    const f = sstep(0.88, 0.95, t) * (long ? 1.4 : 1.0); r += f; g += f; b += f * 1.04;
    const ad = sstep(0.09, 0.03, t) * 0.5; r += ad; g += ad; b += ad;                    // the ad boards: one pale line on the horizon
  } else {
    // the pitch as polished metal wants it: dark under the stands so the horizon is one clean line, lifting
    // to a pale ground bounce further down (mown stripes across it), a little darker at your feet. Greyer
    // than grass: a green mirror reads as painted, not polished.
    const d = 1.3 / Math.tan(Math.max(0.02, boards - el)), ux = x / Math.hypot(x, z), dn = -el;
    const stripe = 1 + 0.22 * sstep(30, 10, d) * sstep(0.6, 3, d) * Math.max(-1, Math.min(1, 3 * Math.sin(ux * d * Math.PI / 5.5)));
    const k = (0.035 + 0.7 * sstep(0.0, 0.42, dn) - 0.3 * sstep(0.9, 1.5, dn)) * stripe;
    r = k * 0.94; g = k * 0.97; b = k * 0.9;
  }
  // the four floodlight banks over the corners: a block of lamps, hot, and its glare
  for (let c = 0; c < 4; c++) {
    const fa = (c < 2 ? 1 : -1) * (c % 2 ? 0.62 : Math.PI - 0.62); let da = az - fa; da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
    const de = el - 0.5, grid = Math.abs(da) < 0.07 && Math.abs(de) < 0.036 ? 1 : 0;
    const s = grid * 20 + 0.9 * Math.exp(-(da * da + de * de) / 0.02);
    r += s; g += s * 0.98; b += s * 0.93;
  }
  out[0] = r; out[1] = g; out[2] = b;
}
// 1024 x 512 half-float equirect (half floats filter on every WebGL2 device; 32-bit float filtering is
// an extension the Quest may lack). Row 0 is straight down.
export function stadiumEnv() {
  if (ENV) return ENV;
  const W = 1024, H = 512, h16 = new Uint16Array(W * H * 4), c = [0, 0, 0], one = THREE.DataUtils.toHalfFloat(1);
  for (let py = 0; py < H; py++) {
    const el = ((py + 0.5) / H - 0.5) * Math.PI, y = Math.sin(el), ce = Math.cos(el);
    for (let px = 0; px < W; px++) {
      const az = ((px + 0.5) / W - 0.5) * 2 * Math.PI, i = (py * W + px) * 4;
      stadiumAt(Math.cos(az) * ce, y, Math.sin(az) * ce, c);
      h16[i] = THREE.DataUtils.toHalfFloat(c[0]); h16[i + 1] = THREE.DataUtils.toHalfFloat(c[1]); h16[i + 2] = THREE.DataUtils.toHalfFloat(c[2]); h16[i + 3] = one;
    }
  }
  const t = new THREE.DataTexture(h16, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  t.mapping = THREE.EquirectangularReflectionMapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  ENV = t;
  return t;
}

// ---------- materials ----------
const std = o => new THREE.MeshStandardMaterial({ envMap: stadiumEnv(), ...o });
// gold: the reflectance of the metal itself, a little deeper; its darks come out umber, its lights pale yellow
// (and where it reflects something dark it goes deeper and redder, as gold does when it mostly reflects itself)
export const goldMat = (o = {}) => {
  const m = std({ color: '#ffcf7a', metalness: 1, roughness: 0.1, emissive: '#140902', envMapIntensity: 1.15, vertexColors: true, ...o });
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <output_fragment>', 'outgoingLight = mix( outgoingLight * vec3( 1.06, 0.9, 0.6 ), outgoingLight, smoothstep( 0.0, 0.5, dot( outgoingLight, vec3( 0.3, 0.6, 0.1 ) ) ) );\n#include <output_fragment>'); };
  return m;
};
// silver: almost white and sharper still, so black stands sit against white sky in it
export const silverMat = (o = {}) => std({ color: '#f7f8fb', metalness: 1, roughness: 0.055, envMapIntensity: 1.1, vertexColors: true, ...o });

const texOf = (c, repeat) => { const t = new THREE.CanvasTexture(c); t.anisotropy = 8; if (repeat) t.wrapS = THREE.RepeatWrapping; return t; };
// Malachite: botryoidal rings round a handful of eyes, each ring its own green, thin near-black lines
// between them, the whole thing warped; polished like glass.
export function malachiteMat() {
  const W = 1024, H = 128, c = canvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), L = 9;
  const eyes = []; for (let i = 0; i < 11; i++) eyes.push([hash(i, 1, 4) * L, -0.5 + hash(i, 2, 4) * 2, 0.7 + hash(i, 3, 4) * 0.9]);
  const dark = [3, 30, 22], mid = [14, 112, 76], light = [86, 204, 150];
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const u = px / W * L, v = py / H, wx = (fbm(px / W * 36, v * 4, 4, 36) - 0.5) * 0.5, wy = (fbm(px / W * 36, v * 4, 12, 36) - 0.5) * 0.5;
    let d1 = 9, d2 = 9;
    for (const [ex, ey, es] of eyes) { let du = Math.abs(u + wx - ex); du = Math.min(du, L - du); const d = Math.hypot(du, (v + wy - ey) * 1.0) / es; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    const w = d1 * 15, ring = Math.floor(w), f = w - ring, tone = hash(ring, 7, 2) * 0.75 + 0.25 * f;
    const line = Math.max(Math.exp(-(f * f) / 0.006), Math.exp(-((1 - f) ** 2) / 0.006)) * 0.7 + sstep(0.06, 0, d2 - d1) * 0.8;   // ring edges, and the seam where two eyes' rings meet
    const grain = 0.88 + 0.24 * fbm(px / W * 180, v * 22, 9, 180), i = (py * W + px) * 4;
    for (let k = 0; k < 3; k++) { const base = tone < 0.5 ? mix(dark[k], mid[k], tone * 2) : mix(mid[k], light[k], tone * 2 - 1); img.data[i + k] = clamp01(mix(base, dark[k] * 0.5, clamp01(line)) * grain / 255) * 255; }
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return std({ map: texOf(c, true), metalness: 0, roughness: 0.05, envMapIntensity: 0.9 });
}
// Black marble: almost black, a few thin pale veins, polished.
export function marbleMat() {
  const W = 512, H = 128, c = canvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const u = px / W, v = py / H, n = fbm(u * 10 + 0.6 * fbm(u * 24, v * 5, 5, 24), v * 2.4, 2, 10), n2 = fbm(u * 22, v * 6, 8, 22);
    const vein = Math.exp(-((n - 0.5) ** 2) / 0.00012) * 0.5 * sstep(0.4, 0.6, n2) + Math.exp(-((n2 - 0.42) ** 2) / 0.00005) * 0.22;
    const k = 12 + 7 * fbm(u * 40, v * 10, 6, 40) + vein * 150, i = (py * W + px) * 4;
    img.data[i] = k * 1.02; img.data[i + 1] = k; img.data[i + 2] = k * 0.96 + 2; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return std({ map: texOf(c, true), metalness: 0, roughness: 0.06, envMapIntensity: 1.0 });
}

// The engraved sheet, 1024 x 256: the plaque (PLATE, top left) and a laurel band with stars (FRIEZE,
// the full width, repeats). Cuts are dark with a bright lower lip where the edge catches the light.
export function engravedMat(lines, tint) {
  const c = canvas(1024, 256), x = c.getContext('2d'), CUT = '#34312c', LIP = '#ffffff';
  x.fillStyle = '#e9e9e9'; x.fillRect(0, 0, 1024, 256);
  for (let py = 0; py < 256; py++) { x.fillStyle = `rgba(255,255,255,${0.5 * hash(1, py, 3)})`; x.fillRect(0, py, 1024, 1); }   // brushed along it
  const twice = draw => { x.save(); x.translate(0.8, 1.3); x.fillStyle = x.strokeStyle = LIP; draw(); x.restore(); x.fillStyle = x.strokeStyle = CUT; draw(); };
  // the plaque: a double rule, the words letter-spaced, a star between rules
  x.lineWidth = 3; twice(() => x.strokeRect(9, 9, 622, 150)); x.lineWidth = 1.2; twice(() => x.strokeRect(16, 16, 608, 136));
  x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach(([text, px, y, sp = 6]) => {
    if (text === '*') { twice(() => { star2d(x, 320, y, px); x.fill(); x.fillRect(150, y - 1, 140, 2); x.fillRect(350, y - 1, 140, 2); }); return; }
    x.font = `${px}px Georgia, 'Times New Roman', serif`; x.letterSpacing = sp + 'px';
    twice(() => x.fillText(text, 320 + sp / 2, y));
  });
  x.letterSpacing = '0px';
  // the laurel band: pairs of leaves along a stem, a star every eighth of the way
  x.lineWidth = 2; twice(() => { x.fillRect(0, 186, 1024, 2); x.fillRect(0, 240, 1024, 2); });
  for (let i = 0; i < 32; i++) {
    const cx = i * 32 + 16;
    if (i % 4 === 0) { twice(() => { star2d(x, cx, 214, 11); x.fill(); }); continue; }
    twice(() => { for (const s of [-1, 1]) { x.save(); x.translate(cx, 214 + s * 2); x.rotate(s * -0.5); x.beginPath(); x.ellipse(6, s * 7, 13, 4.6, 0, 0, Math.PI * 2); x.fill(); x.restore(); } x.fillRect(cx - 16, 213.2, 32, 1.6); });
  }
  return (tint === 'gold' ? goldMat : silverMat)({ map: texOf(c, true), roughness: 0.3, vertexColors: false });
}
function star2d(x, cx, cy, r) {
  x.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, rr = i % 2 ? r * 0.42 : r; x[i ? 'lineTo' : 'moveTo'](cx + Math.sin(a) * rr, cy - Math.cos(a) * rr); } x.closePath();
}
// the ceremony plinth: black lacquer, and velvet that only catches light at a glancing angle
export const lacquerMat = () => std({ color: '#0a0b0e', metalness: 0, roughness: 0.12, envMapIntensity: 0.9 });
export const velvetMat = color => { const m = new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 1, vertexColors: true }); return m; };
