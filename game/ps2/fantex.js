// The crowd's sprites, painted in code: 8 fans (build, hair or hat, what they wear) in 16 poses each
// (seated, standing, clapping, arms up, a scarf held up, a fist pumped, hands on the head, holding a
// flag pole...), 64 x 112 pixels a fan, upper body from the seat up. Painted once and shared by every
// ground: the colours are put on in the shader (fanmat.js), so a sprite holds only light and shade
// and four masks saying what is the shirt, the second colour (scarf, cap, trim), skin and hair.
//   A: RGBA 1024 x 896 (L x alpha, shirt x alpha, accent x alpha, alpha), premultiplied so the mips
//      don't darken at the edges; B: RG (skin, hair), the same size. About 7.3 MB with mips.
// Also the seat tile the empty stand is painted with (seats and the stairway's steps).
import * as THREE from 'three';
import { canvas, hash } from './paint.js';

export const POSES = ['sit', 'sit2', 'stand', 'clapO', 'clapS', 'armsV', 'armsUp', 'scarfA', 'scarfB', 'fistHi', 'fistLo', 'handsHead', 'pole', 'folded', 'clapHigh', 'armsWide'];
export const P = Object.fromEntries(POSES.map((p, i) => [p, i]));
export const CELL = { w: 64, h: 112, shapes: 8 };
export const CARD = { w: 0.9, h: 1.575 };            // metres: one pixel is 1.4 cm
const CX = 32, SH_Y = 76, HEAD_Y = 57;

// The fans: shoulder half-width, head half-width, hair, what he wears on top, scarf round his neck, trim.
const SHAPES = [
  { sw: 16, hw: 5.8, hair: 'short', top: 'shirt', trim: 'collar' },
  { sw: 14.5, hw: 5.6, hair: 'cap', top: 'shirt', trim: 'cuffs' },
  { sw: 17, hw: 6.2, hair: 'bald', top: 'jacket', scarf: true },
  { sw: 15.5, hw: 5.8, hair: 'beanie', top: 'jacket', scarf: true },
  { sw: 13.5, hw: 5.4, hair: 'long', top: 'shirt', trim: 'collar' },
  { sw: 15, hw: 5.7, hair: 'hood', top: 'hoodie' },
  { sw: 15.5, hw: 6, hair: 'curly', top: 'shirt', trim: 'stripes' },
  { sw: 16, hw: 5.9, hair: 'buzz', top: 'shirt', trim: 'band', scarf: true },
];
// Arms: [elbow, hand] for the arm on the right of the picture (x from the middle, y down the cell);
// l: the other arm when it isn't the mirror. mouth: open when cheering. turn: the head turned.
const ARMS = {
  sit: { r: [[16, 97], [8, 106]] },
  sit2: { r: [[16, 97], [6, 104]], l: [[-16, 96], [-4, 102]], turn: 1.6 },
  stand: { r: [[18, 96], [19, 114]] },
  clapO: { r: [[17, 96], [7, 84]] },
  clapS: { r: [[16, 97], [1.5, 82]] },
  armsV: { r: [[23, 60], [28, 42]], mouth: 1 },
  armsUp: { r: [[18, 56], [13, 34]], mouth: 1 },
  scarfA: { r: [[22, 58], [19, 40]], scarf: [40, 40], mouth: 1 },
  scarfB: { r: [[21, 61], [17, 44]], l: [[-21, 58], [-17, 39]], scarf: [39, 44], mouth: 1 },
  fistHi: { r: [[17, 55], [18, 35]], l: [[-18, 96], [-19, 114]], fist: 1, mouth: 1 },
  fistLo: { r: [[25, 76], [18, 59]], l: [[-18, 96], [-19, 114]], fist: 1, mouth: 1 },
  handsHead: { r: [[22, 60], [6, 50]], mouth: 2, late: 1 },
  pole: { r: [[16, 80], [1, 74]], l: [[-15, 66], [-1, 52]], fist: 1, mouth: 1 },
  folded: { r: [[16, 95], [-8, 88]], l: [[-16, 95], [8, 90]] },
  clapHigh: { r: [[19, 57], [1.5, 38]], mouth: 1 },
  armsWide: { r: [[25, 72], [31, 62]], mouth: 1 },
};

// One painter for three passes: 'alb' (grey light and shade, alpha), 'mask' (R shirt, G accent,
// B skin) and 'hair' (R hair). Every part is painted in every pass, so what hides what is the same.
function painter(x, pass) {
  const col = (kind, L) => {
    if (pass === 'alb') { const v = Math.round(255 * Math.min(1, L)); return `rgb(${v},${v},${v})`; }
    if (pass === 'hair') return kind === 'hair' ? '#fff' : '#000';
    return kind === 'shirt' ? '#f00' : kind === 'acc' ? '#0f0' : kind === 'skin' ? '#00f' : '#000';
  };
  return {
    fill(kind, L, path) { x.fillStyle = col(kind, L); x.beginPath(); path(x); x.fill(); },
    line(kind, L, w, pts, cap = 'round', rim = 0) {
      if (rim && pass === 'alb') { x.strokeStyle = col(kind, L * 0.55); x.lineWidth = w + rim; x.lineCap = cap; x.lineJoin = 'round'; x.beginPath(); x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.stroke(); } x.strokeStyle = col(kind, L); x.lineWidth = w; x.lineCap = cap; x.lineJoin = 'round'; x.beginPath(); x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.stroke(); },
    ell(kind, L, cx, cy, rx, ry, a0 = 0, a1 = 7) { this.fill(kind, L, c => { c.ellipse(cx, cy, rx, ry, 0, a0, a1); }); },
    alb: pass === 'alb',
  };
}

function torso(p, s, ox) {
  const w = s.sw, top = s.top;
  p.fill('shirt', 0.86, c => {
    c.moveTo(ox + CX - w + 4.5, 113); c.lineTo(ox + CX - w + 1, SH_Y + 6); c.quadraticCurveTo(ox + CX - w, SH_Y - 1, ox + CX - w + 6, SH_Y - 3.5);
    c.lineTo(ox + CX - 4, SH_Y - 6.5); c.lineTo(ox + CX + 4, SH_Y - 6.5); c.lineTo(ox + CX + w - 6, SH_Y - 3.5);
    c.quadraticCurveTo(ox + CX + w, SH_Y - 1, ox + CX + w - 1, SH_Y + 6); c.lineTo(ox + CX + w - 4.5, 113); c.closePath();
  });
  if (top === 'jacket') { p.line('fixed', 0.25, 1, [[ox + CX, SH_Y - 4], [ox + CX, 106]]); p.line('shirt', 0.62, 1.2, [[ox + CX - w + 4, 100], [ox + CX + w - 4, 100]]); }
  if (top === 'hoodie') { p.line('shirt', 0.6, 1, [[ox + CX - 7, 97], [ox + CX + 7, 97]]); p.line('fixed', 0.85, 0.8, [[ox + CX - 2, SH_Y - 4], [ox + CX - 2.5, SH_Y + 6]]); p.line('fixed', 0.85, 0.8, [[ox + CX + 2, SH_Y - 4], [ox + CX + 2.5, SH_Y + 6]]); }
  if (s.trim === 'collar') p.line('acc', 0.85, 2, [[ox + CX - 4.5, SH_Y - 6], [ox + CX, SH_Y - 2.5], [ox + CX + 4.5, SH_Y - 6]]);
  if (s.trim === 'stripes') for (const dx of [-8, 0, 8]) p.fill('acc', 0.85, c => { c.rect(ox + CX + dx - 2, SH_Y - 5 + (dx ? 2 : 0), 4, 40); });
  if (s.trim === 'band') p.fill('acc', 0.85, c => { c.rect(ox + CX - s.sw + 1, SH_Y + 6, 2 * s.sw - 2, 5); });
  if (s.scarf) {                                                    // a scarf round the neck, its ends hanging down the front
    p.fill('acc', 0.85, c => { c.ellipse(ox + CX, SH_Y - 5, 7, 3.5, 0, 0, 7); });
    p.line('acc', 0.8, 4, [[ox + CX - 3, SH_Y - 3], [ox + CX - 4, SH_Y + 16]], 'butt');
    p.line('acc', 0.72, 4, [[ox + CX + 2, SH_Y - 3], [ox + CX + 3.5, SH_Y + 13]], 'butt');
  }
}
function head(p, s, a, ox) {
  const hx = ox + CX, hy = HEAD_Y, w = s.hw, turn = a.turn || 0, hair = s.hair;
  p.fill('skin', 0.8, c => { c.rect(hx - 3.6, hy + 5, 7.2, 10); });                                   // neck
  if (hair === 'long') p.fill('hair', 0.7, c => { c.ellipse(hx, hy + 2, w + 1.6, 9, 0, 0, 7); c.rect(hx - w - 1.6, hy, 2 * w + 3.2, 12); });
  if (hair === 'hood') p.fill('shirt', 0.74, c => { c.ellipse(hx, hy + 0.5, w + 3, 9.6, 0, 0, 7); c.rect(hx - w - 3, hy, 2 * w + 6, 13); });
  p.ell('skin', 0.95, hx - w + 0.4 + turn * 0.3, hy + 1.5, 1.4, 2.2);                                // ears
  p.ell('skin', 0.95, hx + w - 0.4 + turn * 0.3, hy + 1.5, 1.4, 2.2);
  p.fill('skin', 0.96, c => { c.ellipse(hx + turn * 0.3, hy, w, 7.4, 0, 0, 7); });                     // the head
  p.fill('skin', 0.9, c => { c.ellipse(hx + turn * 0.4, hy + 3.8, w - 1, 3.4, 0, 0, Math.PI); });    // jaw
  const fx = hx + turn;
  // hair or hat over the top
  if (hair === 'short') p.fill('hair', 0.78, c => { c.ellipse(hx + turn * 0.2, hy - 3.2, w + 0.5, 5, 0, Math.PI, 0); c.rect(hx - w - 0.5, hy - 3.5, 1.8, 4.5); c.rect(hx + w - 1.3, hy - 3.5, 1.8, 4.5); });
  if (hair === 'buzz') p.fill('hair', 0.72, c => { c.ellipse(hx + turn * 0.2, hy - 3.6, w + 0.2, 4.2, 0, Math.PI, 0); });
  if (hair === 'long') p.fill('hair', 0.78, c => { c.ellipse(hx + turn * 0.2, hy - 3.4, w + 1, 5.2, 0, Math.PI, 0); c.rect(hx - w - 1, hy - 3.5, 2.4, 10); c.rect(hx + w - 1.4, hy - 3.5, 2.4, 10); });
  if (hair === 'curly') p.fill('hair', 0.7, c => { for (const [dx, dy, r] of [[0, -6, 6.5], [-4.5, -4, 4.5], [4.5, -4, 4.5], [-6, -1, 3], [6, -1, 3]]) { c.moveTo(hx + dx + r, hy + dy); c.arc(hx + dx, hy + dy, r, 0, 7); } });
  if (hair === 'bald') { p.fill('hair', 0.6, c => { c.rect(hx - w, hy - 1.5, 1.4, 4); c.rect(hx + w - 1.4, hy - 1.5, 1.4, 4); }); if (p.alb) p.ell('skin', 1, hx - 1.5, hy - 4.5, 2.4, 1.4); }
  if (hair === 'cap') { p.fill('hair', 0.75, c => { c.rect(hx - w, hy - 2, 1.6, 4); c.rect(hx + w - 1.6, hy - 2, 1.6, 4); }); p.fill('acc', 0.85, c => { c.ellipse(hx, hy - 3.3, w + 0.8, 5.4, 0, Math.PI, 0); }); p.fill('acc', 0.6, c => { c.ellipse(fx, hy - 3, w + 1.2, 1.6, 0, 0, 7); }); }
  if (hair === 'beanie') { p.fill('acc', 0.82, c => { c.ellipse(hx, hy - 3.2, w + 0.7, 6.4, 0, Math.PI, 0); c.rect(hx - w - 0.7, hy - 3.4, 2 * w + 1.4, 2.6); }); p.fill('acc', 0.6, c => { c.rect(hx - w - 0.7, hy - 3.6, 2 * w + 1.4, 1); }); }
  if (hair === 'hood') p.fill('shirt', 0.66, c => { c.ellipse(hx, hy - 2.2, w + 1.6, 6.4, 0, Math.PI, 0); c.rect(hx - w - 1.6, hy - 2.4, 2, 9); c.rect(hx + w - 0.4, hy - 2.4, 2, 9); });
  // the face: brows, eyes, the nose's shadow, the mouth
  const ey = hy + 0.2;
  if (hair !== 'cap' && hair !== 'beanie' && hair !== 'hood') p.line(hair === 'bald' ? 'fixed' : 'hair', hair === 'bald' ? 0.35 : 0.5, 1, [[fx - 4, ey - 1.6], [fx - 1, ey - 1.8]]);
  if (hair !== 'cap' && hair !== 'beanie' && hair !== 'hood') p.line(hair === 'bald' ? 'fixed' : 'hair', hair === 'bald' ? 0.35 : 0.5, 1, [[fx + 1, ey - 1.8], [fx + 4, ey - 1.6]]);
  p.ell('fixed', 0.12, fx - 2.4, ey, 1, 0.8); p.ell('fixed', 0.12, fx + 2.4, ey, 1, 0.8);
  p.line('skin', 0.72, 1.2, [[fx + 0.4, ey + 0.5], [fx + 0.5, ey + 2.8]]);
  if (a.mouth === 2) p.ell('fixed', 0.2, fx, hy + 4.4, 1, 1.3);
  else if (a.mouth) p.ell('fixed', 0.22, fx, hy + 4.3, 1.5, 1.1);
  else p.line('fixed', 0.35, 1, [[fx - 1.6, hy + 4.6], [fx + 1.6, hy + 4.6]]);
}

// one arm: the sleeve (to the elbow for a shirt, to the wrist for a jacket), forearm and hand
function arm(p, s, [[ex, ey], [hx, hy]], side, ox, fist) {
  const sx = ox + CX + side * (s.sw - 3.5), sy = SH_Y - 1, long = s.top !== 'shirt';
  const E = [ox + CX + ex, ey], H = [ox + CX + hx, hy];
  const fore = [E[0] + (H[0] - E[0]) * 0.86, E[1] + (H[1] - E[1]) * 0.86];
  p.line(long ? 'shirt' : 'skin', long ? 0.78 : 0.86, long ? 6 : 4.6, [E, fore], 'round', 1.6);
  p.line('shirt', 0.8, 7, [[sx, sy], E], 'round', 1.6);
  if (!long) { const k = 0.55, cuff = [sx + (E[0] - sx) * k, sy + (E[1] - sy) * k]; p.line('skin', 0.86, 4.6, [cuff, E]); p.line('shirt', 0.8, 7.2, [[sx, sy], cuff]); if (s.trim === 'cuffs') p.line('acc', 0.8, 7.4, [cuff, [cuff[0] + (E[0] - sx) * 0.06, cuff[1] + (E[1] - sy) * 0.06]], 'butt'); }
  p.ell('skin', 0.92, H[0], H[1], fist ? 2.6 : 2.3, fist ? 2.6 : 3);
}

function fan(p, s, pose, ox) {
  const a = ARMS[pose], l = a.l || a.r.map(([x, y]) => [-x, y]);
  torso(p, s, ox);
  const behind = pose === 'stand' || pose === 'sit' || pose === 'sit2';
  if (behind) { arm(p, s, a.r, 1, ox); arm(p, s, l, -1, ox); }
  if (!a.late) head(p, s, a, ox);
  if (!behind) { arm(p, s, a.r, 1, ox, a.fist); arm(p, s, l, -1, ox, a.fist && (!a.l || pose === 'pole')); }
  if (a.late) head(p, s, a, ox), arm(p, s, a.r, 1, ox), arm(p, s, l, -1, ox);
  if (a.scarf) {                                                    // a scarf stretched between his hands, fringes hanging
    const [yl, yr] = a.scarf, xl = ox + CX + l[1][0], xr = ox + CX + a.r[1][0];
    p.fill('acc', 0.88, c => { c.moveTo(xl, yl - 2.2); c.quadraticCurveTo((xl + xr) / 2, (yl + yr) / 2 + 2.2, xr, yr - 2.2); c.lineTo(xr, yr + 2.2); c.quadraticCurveTo((xl + xr) / 2, (yl + yr) / 2 + 6.4, xl, yl + 2.2); c.closePath(); });
    if (p.alb) for (let k = 1; k < 6; k += 2) { const u = xl + (xr - xl) * k / 6, y = yl + (yr - yl) * k / 6 + 1.5; p.line('acc', 0.55, 2.2, [[u, y - 2.5], [u, y + 3]], 'butt'); }   // bars across it
    p.line('acc', 0.7, 1, [[xl - 1, yl + 2], [xl - 1.5, yl + 9]]); p.line('acc', 0.7, 1, [[xr + 1, yr + 2], [xr + 1.5, yr + 9]]);
  }
}

let fanTex = null;
export function fanAtlas() {
  if (fanTex) return fanTex;
  const t0 = performance.now(), W = CELL.w * POSES.length, H = CELL.h * CELL.shapes, cv = { alb: canvas(W, H), mask: canvas(W, H), hair: canvas(W, H) };
  for (const [pass, c] of Object.entries(cv)) {
    const x = c.getContext('2d', { willReadFrequently: true });
    if (pass !== 'alb') { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); }
    const p = painter(x, pass);
    SHAPES.forEach((s, si) => POSES.forEach((pose, pi) => {
      x.save(); x.translate(0, si * CELL.h); x.beginPath(); x.rect(pi * CELL.w, 0, CELL.w, CELL.h); x.clip();
      fan(p, s, pose, pi * CELL.w);
      if (pass === 'alb') {                                           // light from above, round at the sides
        x.globalCompositeOperation = 'source-atop';
        const ox = pi * CELL.w, g = x.createLinearGradient(ox + CX - s.sw - 4, 0, ox + CX + s.sw + 4, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(0.3, 'rgba(0,0,0,0.02)'); g.addColorStop(0.55, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
        x.fillStyle = g; x.fillRect(ox, 0, CELL.w, CELL.h);
        const v = x.createLinearGradient(0, 70, 0, 112); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
        x.fillStyle = v; x.fillRect(ox, 70, CELL.w, 42);
        x.globalCompositeOperation = 'source-over';
      }
      x.restore();
    }));
  }
  const get = k => cv[k].getContext('2d').getImageData(0, 0, W, H).data, A = get('alb'), M = get('mask'), Hh = get('hair');
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 2);
  const ext = POSES.map(() => ({ top: 0, hw: 0 }));
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = (y * W + xx) * 4, al = A[i + 3];
    if (!al) continue;
    // a darker rim round the figure, so one fan reads against the one behind him
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = xx + dx, Y = y + dy; return X < 0 || Y < 0 || X >= W || Y >= H || A[(Y * W + X) * 4 + 3] < 100; });
    const L = A[i] * (edge ? 0.6 : 1) * (0.97 + 0.06 * hash(xx >> 1, y >> 1, 3));
    const o = ((H - 1 - y) * W + xx) * 4, o2 = ((H - 1 - y) * W + xx) * 2;
    a[o] = Math.round(L * al / 255); a[o + 1] = M[i]; a[o + 2] = M[i + 1]; a[o + 3] = al;
    b[o2] = M[i + 2]; b[o2 + 1] = Hh[i];
    if (al > 60) { const e = ext[Math.floor(xx / CELL.w)], cy = y % CELL.h; e.top = Math.max(e.top, CELL.h - cy); e.hw = Math.max(e.hw, Math.abs(xx % CELL.w + 0.5 - CX)); }
  }
  const tex = (data, format) => {
    const t = new THREE.DataTexture(data, W, H, format, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.unpackAlignment = 1; t.userData.keep = true; t.needsUpdate = true;
    return t;
  };
  fanTex = {
    a: tex(a, THREE.RGBAFormat), b: tex(b, THREE.RGFormat),
    // per pose: how much of the card's height (from the bottom) and half-width it needs (the card is cut to it)
    top: ext.map(e => Math.min(1, (e.top + 2) / CELL.h)), hw: ext.map(e => Math.min(1, (e.hw + 2) / CX)),
    bytes: W * H * 6, ms: 0,
  };
  fanTex.ms = Math.round(performance.now() - t0);
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
