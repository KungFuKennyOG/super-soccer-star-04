// Textures for the '04-look grounds, painted in code: the structure atlas (concrete, roof sheeting,
// lattice, executive boxes, lamp faces, ad boards), the crowd (one tile per block: everyone, the home
// curva, the away block, with a little table saying who supports whom so the shader can make the
// right fans jump), the ultras' flags and banners, the net and the clouds.
import * as THREE from 'three';
import { AD_WORDS, SKINS, HAIRS } from '../tex.js';
import { canvas, hex, css, hash, vnoise, fbm, eachPixel, smoothTex } from './paint.js';

// The atlas: a 4 x 3 grid of 256-pixel cells over a strip of eight 512 x 64 ad boards.
export const CELL = { concrete: 0, roofTop: 1, roofUnder: 2, lattice: 3, paint: 4, boxes: 5, helix: 6, lamp: 7, dark: 8, cladding: 9, steps: 10, rail: 11 };
export function region(name) {
  const i = CELL[name];
  return [(i % 4) * 0.25, 1 - (Math.floor(i / 4) + 1) * 0.25, 0.25, 0.25];
}
export const adRegion = i => [(i % 2) * 0.5, 1 - (768 + ((i % 8 >> 1) + 1) * 64) / 1024, 0.5, 0.0625];
export const ADS = AD_WORDS.map(w => w.replace(' 96', ''));

const word = (x, s, cx, cy, w, color, size, style = '900 italic') => { x.fillStyle = color; x.font = `${style} ${size}px Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, cx, cy, w); };

let atlas = null;
export function structureAtlas() {
  if (atlas) return atlas;
  const c = canvas(1024, 1024), x = c.getContext('2d');
  const cell = (name, fn) => { const i = CELL[name], ox = (i % 4) * 256, oy = Math.floor(i / 4) * 256; x.save(); x.translate(ox, oy); x.beginPath(); x.rect(0, 0, 256, 256); x.clip(); fn(x, ox, oy); x.restore(); };
  const noise = (ox, oy, base, amp, seed, f = 16) => eachPixel(x, { x: ox, y: oy, w: 256, h: 256 }, (u, v, col, px, py) => {
    const n = fbm(px / f, py / f, seed, 256 / f) - 0.5, g = hash(px, py, seed) - 0.5, k = 1 + amp * n + 0.06 * g;
    col[0] = base[0] * k; col[1] = base[1] * k; col[2] = base[2] * k;
  });
  // concrete: pale grey, cloudy, with stains running down and a joint every half tile
  cell('concrete', (x, ox, oy) => {
    noise(ox, oy, [178, 176, 170], 0.32, 1);
    x.fillStyle = 'rgba(40,38,36,0.35)'; x.fillRect(0, 126, 256, 3); x.fillRect(126, 0, 2, 256);
    for (let i = 0; i < 9; i++) { const sx = hash(i, 2, 3) * 256, g = x.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, 'rgba(60,55,50,0.25)'); g.addColorStop(1, 'rgba(60,55,50,0)'); x.fillStyle = g; x.fillRect(sx, (i % 2) * 128, 3 + hash(i, 3, 3) * 6, 150); }
  });
  // roof sheeting from above: silvery ribs
  cell('roofTop', (x, ox, oy) => { noise(ox, oy, [168, 172, 176], 0.15, 2); for (let i = 0; i < 256; i += 16) { x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(i, 0, 3, 256); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(i + 3, 0, 2, 256); } });
  // roof underside: dark ribs and purlins
  cell('roofUnder', (x, ox, oy) => { noise(ox, oy, [92, 94, 100], 0.2, 3); for (let i = 0; i < 256; i += 16) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(i, 0, 4, 256); } x.fillStyle = 'rgba(20,20,26,0.8)'; for (let i = 0; i < 256; i += 64) x.fillRect(0, i, 256, 7); });
  // lattice: a steel truss, transparent between the members (used with alpha test)
  cell('lattice', x => {
    x.clearRect(0, 0, 256, 256); x.strokeStyle = '#d8dade'; x.lineCap = 'square';
    x.lineWidth = 22; x.beginPath(); x.moveTo(0, 11); x.lineTo(256, 11); x.moveTo(0, 245); x.lineTo(256, 245); x.stroke();
    x.lineWidth = 12; x.beginPath(); x.moveTo(0, 245); x.lineTo(128, 11); x.lineTo(256, 245); x.moveTo(128, 11); x.lineTo(128, 245); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 20); x.lineTo(256, 20); x.moveTo(0, 254); x.lineTo(256, 254); x.stroke();
  });
  cell('paint', (x, ox, oy) => noise(ox, oy, [236, 236, 234], 0.06, 4, 32));
  // executive boxes: a band of tinted glass, lit inside, with mullions and a few people
  cell('boxes', (x) => {
    x.fillStyle = '#2a2f38'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) {
      const g = x.createLinearGradient(0, 40, 0, 210); g.addColorStop(0, '#7a8ea0'); g.addColorStop(0.5, '#d9c48a'); g.addColorStop(1, '#4c4a44');
      x.fillStyle = g; x.fillRect(i * 64 + 4, 40, 56, 170);
      for (let k = 0; k < 2; k++) if (hash(i, k, 5) > 0.4) { const px = i * 64 + 12 + k * 26; x.fillStyle = '#20232a'; x.fillRect(px, 120, 14, 90); x.beginPath(); x.arc(px + 7, 112, 8, 0, 7); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(i * 64 + 4, 40, 56, 14);
    }
    x.fillStyle = '#e6e6e2'; x.fillRect(0, 0, 256, 30); x.fillRect(0, 216, 256, 40);
  });
  // a spiral ramp tower: concrete with the ramp's parapet running round it
  cell('helix', (x, ox, oy) => { noise(ox, oy, [170, 168, 160], 0.25, 6); x.fillStyle = '#e8e6e0'; x.strokeStyle = 'rgba(0,0,0,0.5)'; for (let i = -2; i < 4; i++) { x.save(); x.translate(0, i * 90); x.transform(1, -0.35, 0, 1, 0, 0); x.fillRect(0, 60, 256, 18); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 78, 256, 6); x.fillStyle = '#e8e6e0'; x.restore(); } });
  // a floodlight's face: rows of round lamps
  cell('lamp', x => {
    x.fillStyle = '#1a1c22'; x.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const g = x.createRadialGradient(32 + i * 64, 32 + j * 64, 2, 32 + i * 64, 32 + j * 64, 28); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#fff6d8'); g.addColorStop(0.85, '#c9c2a8'); g.addColorStop(1, '#3a3a40');
      x.fillStyle = g; x.beginPath(); x.arc(32 + i * 64, 32 + j * 64, 27, 0, 7); x.fill();
    }
  });
  cell('dark', (x, ox, oy) => noise(ox, oy, [40, 40, 46], 0.3, 7));
  // cladding: vertical metal panels for the backs of the stands
  cell('cladding', (x, ox, oy) => { noise(ox, oy, [150, 156, 164], 0.12, 8, 64); for (let i = 0; i < 256; i += 32) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(i, 0, 3, 256); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(i + 3, 0, 2, 256); } });
  // steps (the gable walls and stairways): concrete with step edges
  cell('steps', (x, ox, oy) => { noise(ox, oy, [150, 148, 144], 0.25, 9); for (let i = 0; i < 256; i += 32) { x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0, i, 256, 4); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, i + 4, 256, 3); } });
  // a railing: top rail and uprights (alpha test)
  cell('rail', x => { x.clearRect(0, 0, 256, 256); x.fillStyle = '#d6d8dc'; x.fillRect(0, 0, 256, 26); x.fillRect(0, 120, 256, 12); for (let i = 0; i < 256; i += 64) x.fillRect(i, 0, 12, 256); });
  // the ad boards: bright panels with the game's own invented words
  const bgs = ['#f3f3f0', '#0d2a8c', '#c4122c', '#111318', '#f0c020', '#f3f3f0', '#1b7a3a', '#e05a10'], fgs = ['#0d2a8c', '#ffffff', '#ffffff', '#f0c020', '#111318', '#c4122c', '#ffffff', '#ffffff'];
  for (let i = 0; i < 8; i++) {
    const ox = (i % 2) * 512, oy = 768 + (i >> 1) * 64;
    x.save(); x.translate(ox, oy); x.beginPath(); x.rect(0, 0, 512, 64); x.clip();
    const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, bgs[i]); g.addColorStop(1, css(hex(bgs[i]).map(v => v * 0.8)));
    x.fillStyle = g; x.fillRect(0, 0, 512, 64);
    if (i % 3 === 1) { x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.moveTo(380, 0); x.lineTo(512, 0); x.lineTo(512, 64); x.lineTo(330, 64); x.fill(); }
    word(x, ADS[i], 256, 34, 470, fgs[i], 44);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 60, 512, 4); x.fillRect(0, 0, 3, 64);
    x.restore();
  }
  atlas = smoothTex(c, { aniso: 8 });
  return atlas;
}

// The crowd. Each block is one tile of 32 fans by 12 rows (32 x 48 pixels a fan), staggered in the
// shader. block: { ours: share of fans supporting you, packed: ultras (fewer gaps, more scarves up),
// seats: [a, b] seat colours }. Returns the textures and a table (32 x 12 per block, R = yours,
// G = a phase) that the crowd shader reads with texelFetch.
export const FAN = { cols: 32, rows: 12, w: 32, h: 36 };
export function crowdTiles(blocks, ours, theirs) {
  const { cols, rows, w, h } = FAN, data = new Uint8Array(cols * rows * blocks.length * 4);
  const tex = blocks.map((b, bi) => {
    const c = canvas(cols * w, rows * h), x = c.getContext('2d');
    const seatA = hex(b.seats[0]), seatB = hex(b.seats[1]);
    x.fillStyle = '#121016'; x.fillRect(0, 0, c.width, c.height);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const r = (k) => hash(i + bi * 97, j, k), px = i * w, py = j * h, cx = px + w / 2;
      const mine = r(1) < b.ours, o = (j * cols + i + bi * cols * rows) * 4;
      data[o] = mine ? 255 : 0; data[o + 1] = Math.floor(r(2) * 255); data[o + 3] = 255;
      // the seat behind: its back shows above everyone's shoulders
      const seat = ((i >> 2) + j) % 2 ? seatA : seatB;
      x.fillStyle = css(seat.map(v => v * 0.5)); x.fillRect(px + 2, py + 1, w - 4, 7);
      if (i === 0 && !b.packed) { x.fillStyle = j % 2 ? '#8d8f96' : '#6f7178'; x.fillRect(px, py, w, h); x.fillStyle = '#3a3b42'; x.fillRect(px, py + h - 5, w, 5); data[o] = 128; continue; }   // a stairway
      if (r(3) < (b.packed ? 0.01 : 0.07)) {          // an empty seat
        x.fillStyle = css(seat); x.fillRect(px + 3, py + 9, w - 6, 14); x.fillStyle = css(seat.map(v => v * 0.7)); x.fillRect(px + 3, py + 23, w - 6, 9); continue;
      }
      const pal = mine ? ours : theirs, plain = r(4) < (b.packed ? 0.08 : 0.24);
      const shirtC = plain ? hex(['#22242a', '#e8e6e0', '#5a5e66', '#2a3550', '#7a2a2a'][Math.floor(r(5) * 5)]) : hex(pal[Math.floor(r(6) * pal.length)]);
      const lit = 0.75 + 0.3 * r(7), shirt = shirtC.map(v => v * lit);
      const skin = hex(SKINS[Math.floor(r(8) * SKINS.length)]), hair = hex(HAIRS[Math.floor(r(9) * HAIRS.length)]);
      const dx = (r(10) - 0.5) * 6, hy = py + 11 + r(11) * 2.5, up = r(12) < (b.packed ? 0.35 : 0.14);
      // body: shoulders and chest, shaded at the sides
      const g = x.createLinearGradient(px, 0, px + w, 0); g.addColorStop(0, css(shirt.map(v => v * 0.6))); g.addColorStop(0.45, css(shirt)); g.addColorStop(1, css(shirt.map(v => v * 0.55)));
      x.fillStyle = g; x.beginPath(); x.ellipse(cx + dx, hy + 16, 12.5, 8, 0, Math.PI, 0); x.lineTo(cx + dx + 13, py + h); x.lineTo(cx + dx - 13, py + h); x.fill();
      if (!plain && r(13) < 0.4) { x.fillStyle = css(hex(pal[(Math.floor(r(6) * pal.length) + 1) % pal.length]).map(v => v * lit)); x.fillRect(cx + dx - 12, hy + 20, 24, 3); }   // a band across the shirt
      if (up) {                                          // arms up: a scarf held over the head
        x.fillStyle = css(skin.map(v => v * 0.85)); x.fillRect(cx + dx - 10, hy - 8, 3, 18); x.fillRect(cx + dx + 7, hy - 8, 3, 18);
        const sc = hex(pal[Math.floor(r(14) * pal.length)]); x.fillStyle = css(sc); x.fillRect(cx + dx - 11, hy - 10, 22, 4); x.fillStyle = css(sc.map(v => v * 0.6)); for (let k = 0; k < 22; k += 5) x.fillRect(cx + dx - 11 + k, hy - 10, 2, 4);
      }
      // head: skin with a lit side, hair on top (or a hat)
      const hg = x.createRadialGradient(cx + dx - 2, hy - 2, 1, cx + dx, hy, 7); hg.addColorStop(0, css(skin.map(v => v * 1.08))); hg.addColorStop(1, css(skin.map(v => v * 0.62)));
      x.fillStyle = hg; x.beginPath(); x.ellipse(cx + dx, hy + 1, 5.6, 6.6, 0, 0, 7); x.fill();
      x.fillStyle = r(15) < 0.12 ? css(shirtC) : css(hair); x.beginPath(); x.ellipse(cx + dx, hy - 2, 6, 4.4, 0, Math.PI, 0); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(cx + dx - 3, hy + 7, 6, 2);   // the shadow of the chin
    }
    // the row behind is darker at its foot (in the shade of the one in front)
    for (let j = 0; j < rows; j++) { const g = x.createLinearGradient(0, j * h + h - 10, 0, j * h + h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); x.fillStyle = g; x.fillRect(0, j * h + h - 10, c.width, 10); }
    return smoothTex(c, { repeat: [1, 1], aniso: 8 });
  });
  const table = new THREE.DataTexture(data, cols, rows * blocks.length, THREE.RGBAFormat);
  table.magFilter = table.minFilter = THREE.NearestFilter; table.needsUpdate = true;
  return { tex, table };
}

// The ultras' flags: four designs per side, 128 x 96 each (home on the top row), and their banners:
// six 1024 x 64 strips (four home, two away) with a word on each.
export function flagAtlas(home, away) {
  const c = canvas(512, 192), x = c.getContext('2d');
  [home, away].forEach((cols, s) => {
    const [a, b, k] = cols;
    for (let d = 0; d < 4; d++) {
      x.save(); x.translate(d * 128, s * 96); x.beginPath(); x.rect(0, 0, 128, 96); x.clip();
      x.fillStyle = a; x.fillRect(0, 0, 128, 96); x.fillStyle = b;
      if (d === 0) x.fillRect(64, 0, 64, 96);
      if (d === 1) for (let i = 0; i < 128; i += 32) x.fillRect(i + 16, 0, 16, 96);
      if (d === 2) { x.fillRect(43, 0, 42, 96); x.fillStyle = k || a; x.fillRect(85, 0, 43, 96); }
      if (d === 3) { x.beginPath(); x.moveTo(0, 70); x.lineTo(100, 0); x.lineTo(128, 0); x.lineTo(128, 26); x.lineTo(28, 96); x.lineTo(0, 96); x.fill(); x.fillStyle = b; x.beginPath(); x.arc(30, 30, 12, 0, 7); x.fill(); }
      x.restore();
    }
  });
  eachPixel(x, { x: 0, y: 0, w: 512, h: 192 }, (u, v, col, px, py) => { const k = 0.9 + 0.12 * (vnoise(px / 9, py / 9, 11) - 0.5) + ((px % 128) < 3 ? -0.3 : 0); col[0] *= k; col[1] *= k; col[2] *= k; });
  return smoothTex(c, { aniso: 4 });
}
export const BANNER_WORDS = ['FORZA', 'ULTRAS', 'CURVA', 'ALLEZ', 'VAMOS', 'SEMPRE', 'NEVER ALONE', 'ALE ALE'];
// banner i (0..3 home, 4..5 away) is 512 x 64 at column i % 2, row i >> 1 (bannerUV gives its uvs)
export const bannerUV = i => [(i % 2) * 0.5, 1 - ((i >> 1) + 1) / 3, (i % 2) * 0.5 + 0.5, 1 - (i >> 1) / 3];
export function bannerAtlas(home, away, seed = 1) {
  const c = canvas(1024, 192), x = c.getContext('2d');
  for (let i = 0; i < 6; i++) {
    const [a, b] = i < 4 ? home : away, ox = (i % 2) * 512, oy = (i >> 1) * 64, wd = BANNER_WORDS[Math.floor(hash(i, seed, 13) * BANNER_WORDS.length)];
    x.save(); x.translate(ox, oy); x.beginPath(); x.rect(0, 0, 512, 64); x.clip();
    x.fillStyle = a; x.fillRect(0, 0, 512, 64); x.fillStyle = b;
    if (i % 3 === 0) { x.fillRect(0, 4, 512, 7); x.fillRect(0, 53, 512, 7); }
    else if (i % 3 === 1) for (let s = 0; s < 512; s += 64) x.fillRect(s, 0, 32, 64);
    else for (let s = 0; s < 512; s += 32) x.fillRect(s, (s / 32) % 2 ? 0 : 48, 32, 16);
    x.fillStyle = a; x.fillRect(60, 12, 392, 40);
    word(x, wd, 256, 33, 380, b === a ? '#f1efe6' : b, 38, '900');
    x.restore();
  }
  eachPixel(x, { x: 0, y: 0, w: 1024, h: 192 }, (u, v, col, px, py) => { const k = 0.92 + 0.1 * (vnoise(px / 14, py / 6, 12) - 0.5); col[0] *= k; col[1] *= k; col[2] *= k; });
  return smoothTex(c, { aniso: 8 });
}

// The net: knotted square mesh, 12 cm a hole; one texture repeat is a metre (alpha is the thread).
let net = null;
export function netTexture() {
  if (net) return net;
  const c = canvas(256, 256), x = c.getContext('2d'), n = 8, s = 256 / n;
  x.clearRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(245,245,240,0.9)'; x.lineWidth = 2;
  x.beginPath(); for (let i = 0; i <= n; i++) { x.moveTo(i * s, 0); x.lineTo(i * s, 256); x.moveTo(0, i * s); x.lineTo(256, i * s); } x.stroke();
  x.fillStyle = '#ffffff'; for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) x.fillRect(i * s - 2, j * s - 2, 4, 4);
  net = smoothTex(c, { repeat: [1, 1], aniso: 8 });
  return net;
}

// Clouds for the sky dome: soft cumulus, tiling round the dome (alpha in the red channel).
let clouds = null;
export function cloudTexture() {
  if (clouds) return clouds;
  const c = canvas(512, 128), x = c.getContext('2d');
  eachPixel(x, { x: 0, y: 0, w: 512, h: 128 }, (u, v, col, px, py) => {
    const n = fbm(px / 40, py / 22, 21, 512 / 40) * 0.7 + fbm(px / 12, py / 8, 22, 512 / 12) * 0.3;
    const k = Math.max(0, Math.min(1, (n - 0.48) * 4)) * Math.min(1, py / 30) * Math.min(1, (128 - py) / 20);
    col[0] = col[1] = col[2] = k * 255;
  });
  clouds = smoothTex(c, { repeat: [1, 1] });
  return clouds;
}
