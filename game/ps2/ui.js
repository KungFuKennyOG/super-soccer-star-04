// The '04 menus and HUD: one shared style for every canvas the game shows on an in-world panel.
// Kenny's reference is a 2003-04 console football front end (taken as a style, never its content): letterbox black
// bands top and bottom, the title heavy and upright in the top one, button hints in the bottom one; a real-looking,
// soft, washed-out stadium and shirt picture in the middle (game/ps2/menuscene.js); a compact stack of near-black
// translucent rows with a thin light outline, plain bold white mixed-case type, the picked row flat maroon with the
// button glyph at its left and small arrows at its right, little gold stars as markers. Restraint: no gloss, no
// glow, no italics, no squeezed type. Type is the system sans (Roboto on the Quest, Inter / Arial elsewhere).
import * as THREE from 'three';
import { paintFlag, FLAGS } from './flags.js';
import { YEAR, NAME } from './brand.js';
export { YEAR, NAME };

export const PAL = {
  ink: '#ffffff', soft: '#dcdcdc', muted: '#a8a8a8', dim: '#707070', deep: '#000000',
  row: 'rgba(10,10,12,0.76)', line: 'rgba(230,230,230,0.9)', sep: 'rgba(205,205,205,0.75)',
  maroonHi: '#962c25', maroonLo: '#6e1c19', gold: '#e2b23e', accent: '#e2b23e', good: '#86d991', bad: '#ff7062', info: '#d6dde8',
};
const STACK = 'Roboto, Inter, "Helvetica Neue", Arial, "Liberation Sans", sans-serif';
export const font = (px, weight = 700) => `${weight} ${Math.round(px)}px ${STACK}`;

// Width of `s` as text() would draw it.
export function measure(ctx, s, size, { weight = 700 } = {}) {
  ctx.font = font(size, weight);
  return ctx.measureText(String(s)).width;
}

// Text centred vertically on y. o: { size, weight, color, align: left|center|right, max (width: narrowed a little,
// then shrunk to fit), shadow (a 1-2 px dark drop, on by default) }. Returns the width drawn.
export function text(ctx, s, x, y, o = {}) {
  const str = String(s), weight = o.weight || 700;
  let size = o.size || 30, sq = 1;
  ctx.font = font(size, weight);
  let w = ctx.measureText(str).width;
  if (o.max && w > o.max) {
    sq = Math.max(0.88, o.max / w);
    if (w * sq > o.max) { size *= o.max / (w * sq); ctx.font = font(size, weight); w = ctx.measureText(str).width; }
  }
  const dw = w * sq, align = o.align || 'left';
  const x0 = align === 'center' ? x - dw / 2 : align === 'right' ? x - dw : x;
  ctx.save();
  ctx.translate(x0, y); ctx.scale(sq, 1);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  if (o.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 2; ctx.shadowOffsetX = ctx.shadowOffsetY = Math.max(1, size * 0.05); }
  ctx.fillStyle = o.color || PAL.ink;
  ctx.fillText(str, 0, size * 0.04);
  ctx.restore();
  return dw;
}

// Splits `s` into lines that fit `max` at this size.
export function wrap(ctx, s, max, size, o = {}) {
  const out = [];
  for (const word of String(s).split(' ')) {
    const last = out[out.length - 1];
    if (last !== undefined && measure(ctx, `${last} ${word}`, size, o) <= max) out[out.length - 1] = `${last} ${word}`;
    else out.push(word);
  }
  return out;
}

// Mixed case for the game's upper-case strings: "SCORE ATTACK" → "Score Attack". Words with a digit, single
// letters (button names: A, B, X) and the words in `keep` (team ids, VR) stay as they are.
const KEEP = new Set(['VR', 'PTS', 'GK', 'PS1']);
const kept = (w, keep) => /\d/.test(w) || w.replace(/[^A-Za-z]/g, '').length === 1 || keep.has(w.replace(/[^A-Z0-9]/g, ''));
export function tc(s, keep = KEEP) {
  return String(s).split(' ').map(w => (kept(w, keep) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(' ');
}
// Sentence case: "THE CROWD ARE ON THEIR FEET!" → "The crowd are on their feet!" (same exceptions as tc).
export function sc(s, keep = KEEP) {
  let first = true;
  return String(s).split(' ').map(w => {
    const out = kept(w, keep) ? w : first ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase();
    first = /[.!?:]$/.test(w);
    return out;
  }).join(' ');
}

// A rounded rectangle path; r may be a number or [tl, tr, br, bl].
export function rr(ctx, x, y, w, h, r) {
  const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + a, y); ctx.lineTo(x + w - b, y); ctx.quadraticCurveTo(x + w, y, x + w, y + b);
  ctx.lineTo(x + w, y + h - c); ctx.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
  ctx.lineTo(x + d, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - d);
  ctx.lineTo(x, y + a); ctx.quadraticCurveTo(x, y, x + a, y);
  ctx.closePath();
}
const vgrad = (ctx, y0, y1, stops) => { const g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach(([k, c]) => g.addColorStop(k, c)); return g; };

// A near-black translucent box with a thin light outline (tables, messages, cards). fill null: outline only.
export function box(ctx, x, y, w, h, { r = 6, fill = PAL.row, line = PAL.line, lw = 2 } = {}) {
  if (fill) { rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
  if (line) { ctx.lineWidth = lw; ctx.strokeStyle = line; rr(ctx, x + lw / 2, y + lw / 2, w - lw, h - lw, r); ctx.stroke(); }
}
// The picked-row maroon: flat, a very slight darkening to the foot.
export function maroon(ctx, x, y, w, h, r = 0) {
  rr(ctx, x, y, w, h, r); ctx.fillStyle = vgrad(ctx, y, y + h, [[0, PAL.maroonHi], [1, PAL.maroonLo]]); ctx.fill();
}

// A round outlined button glyph (A, B, X, Y), or a small outlined key cap for anything else. Returns its width.
export function glyph(ctx, k, x, cy, h) {
  ctx.save();
  ctx.lineWidth = Math.max(2, h * 0.08); ctx.strokeStyle = '#c4c4c4'; ctx.fillStyle = '#111';
  if (k.length === 1) {
    ctx.beginPath(); ctx.arc(x + h / 2, cy, h / 2 - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    text(ctx, k, x + h / 2, cy, { size: h * 0.56, align: 'center', shadow: false });
    return h;
  }
  const w = glyphW(ctx, k, h);
  rr(ctx, x, cy - h / 2 + 1, w, h - 2, h * 0.22); ctx.fill(); ctx.stroke(); ctx.restore();
  text(ctx, k, x + w / 2, cy, { size: h * 0.48, align: 'center', shadow: false });
  return w;
}
const glyphW = (ctx, k, h) => (k.length === 1 ? h : measure(ctx, k, h * 0.48) + h * 0.6);

// Small arrows: up and down stacked, or one pointing left / right.
export function arrowUD(ctx, x, cy, s, col = PAL.gold) {
  ctx.save(); ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x - s * 0.42, cy - s * 0.12); ctx.lineTo(x + s * 0.42, cy - s * 0.12); ctx.lineTo(x, cy - s * 0.72); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - s * 0.42, cy + s * 0.12); ctx.lineTo(x + s * 0.42, cy + s * 0.12); ctx.lineTo(x, cy + s * 0.72); ctx.closePath(); ctx.fill();
  ctx.restore();
}
export function arrowLR(ctx, x, cy, dir, s, col = PAL.gold) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x + dir * s * 0.4, cy); ctx.lineTo(x - dir * s * 0.4, cy - s * 0.5); ctx.lineTo(x - dir * s * 0.4, cy + s * 0.5); ctx.closePath(); ctx.fill(); ctx.restore();
}

// A small flat gold star (a marker), or a grey outline when off.
export function star(ctx, cx, cy, size, on = true) {
  ctx.save(); ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? size * 0.21 : size * 0.5; ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  ctx.closePath();
  if (on) { ctx.fillStyle = PAL.gold; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#5a4210'; ctx.stroke(); }
  else { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(200,200,200,0.5)'; ctx.stroke(); }
  ctx.restore();
}
export function stars(ctx, n, x, cy, size, { align = 'left', of = 5 } = {}) {
  const gap = size * 1.1, span = gap * of - (gap - size), x0 = align === 'center' ? x - span / 2 : align === 'right' ? x - span : x;
  for (let i = 0; i < of; i++) star(ctx, x0 + i * gap + size / 2, cy, size, i < n);
}

// The stack of rows: one bordered box, rows 2 px apart. rows: [{ label, value?, star?, dim?, chip? (a team), stars? }].
// sel: the picked row (maroon, button glyph at its left, arrows at its right: o.arrows 'ud' | 'lr' | null).
// Returns the box's bottom.
export function stack(ctx, x, y, w, rh, rows, sel, { arrows = 'ud', size = rh * 0.54, indent = rh * 1.0, glyphK = 'A', gap = 2 } = {}) {
  const h = rows.length * rh + (rows.length - 1) * gap;
  ctx.save(); rr(ctx, x, y, w, h, 6); ctx.clip();
  rows.forEach((r, i) => {
    const ry = y + i * (rh + gap);
    if (i === sel) maroon(ctx, x, ry, w, rh); else { ctx.fillStyle = r.fill || PAL.row; ctx.fillRect(x, ry, w, rh); }
    if (i > 0) { ctx.fillStyle = PAL.sep; ctx.fillRect(x, ry - gap, w, gap); }
  });
  ctx.restore();
  box(ctx, x, y, w, h, { fill: null });
  rows.forEach((r, i) => {
    const ry = y + i * (rh + gap), cy = ry + rh / 2, on = i === sel;
    if (on && glyphK) glyph(ctx, glyphK, x + rh * 0.2, cy, rh * 0.64);
    let lx = x + indent;
    if (r.chip) lx += teamChip(ctx, r.chip, lx, cy - rh * 0.29, rh * 0.58) + rh * 0.25;
    let right = x + w - (on && arrows === 'ud' ? rh * 0.8 : rh * 0.35);
    if (r.star) { star(ctx, right - rh * 0.3, cy, rh * 0.42); right -= rh * 0.7; }
    if (r.stars !== undefined) { stars(ctx, r.stars, right, cy, rh * 0.42, { align: 'right' }); right -= rh * 2.5; }
    let vw = 0;
    if (r.value !== undefined && r.value !== null && r.value !== '') {
      const lr = on && arrows === 'lr', vx = lr ? right - rh * 0.5 : right;
      vw = text(ctx, r.value, vx, cy, { size, align: 'right', color: on ? PAL.ink : r.vcolor || PAL.soft, max: w * 0.45 });
      if (lr) { arrowLR(ctx, right - rh * 0.12, cy, 1, rh * 0.34); arrowLR(ctx, vx - vw - rh * 0.38, cy, -1, rh * 0.34); vw += rh * 1.0; }
    }
    text(ctx, r.label, lx, cy, { size, color: r.dim && !on ? PAL.muted : r.color || PAL.ink, max: Math.max(20, right - lx - vw - rh * 0.4) });
    if (on && arrows === 'ud') arrowUD(ctx, x + w - rh * 0.42, cy, rh * 0.42);
  });
  return y + h;
}

// The letterbox: the picture (menuscene.js) in the middle band, black bands top and bottom. Returns the bands.
export const BAND = { top: 0.16, bottom: 0.2 };
export function bands(ctx, W, H, back) {
  const t = Math.round(H * BAND.top), b = Math.round(H * BAND.bottom), mh = H - t - b;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (back) {
    const k = Math.max(W / back.width, mh / back.height), bw = back.width * k, bh = back.height * k;
    ctx.save(); ctx.beginPath(); ctx.rect(0, t, W, mh); ctx.clip();
    ctx.drawImage(back, (W - bw) / 2, t + (mh - bh) / 2, bw, bh);
    ctx.restore();
  } else { ctx.fillStyle = vgrad(ctx, t, H - b, [[0, '#8c949c'], [0.55, '#6b7378'], [0.6, '#4b6a3a'], [1, '#3c5a2e']]); ctx.fillRect(0, t, W, mh); }
  return { top: t, bottom: H - b, mid: mh };
}

// Our mark (a star on maroon in a silver ring) and the title, heavy and upright with a faint silver gradient.
export function mark(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = vgrad(ctx, cy - r, cy + r, [[0, '#f4f4f4'], [0.5, '#bdbdbd'], [1, '#8a8a8a']]); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.fillStyle = vgrad(ctx, cy - r, cy + r, [[0, PAL.maroonHi], [1, PAL.maroonLo]]); ctx.fill();
  ctx.restore();
  star(ctx, cx, cy + r * 0.04, r * 1.15);
}
export function title(ctx, s, x, cy, size, max = Infinity) {
  ctx.save();
  ctx.font = font(size, 900); ctx.textBaseline = 'middle';
  const w = ctx.measureText(s).width, k = Math.min(1, max / w);
  ctx.translate(x, cy); ctx.scale(k, 1);
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowOffsetX = ctx.shadowOffsetY = 2;
  ctx.fillStyle = vgrad(ctx, -size * 0.45, size * 0.45, [[0, '#ffffff'], [0.48, '#f0f0f0'], [0.56, '#c9ccd0'], [1, '#ececec']]);
  ctx.fillText(s, 0, size * 0.04);
  ctx.restore();
  return w * k;
}
// The top band: our mark and the title on the left, a grey note on the right.
export function header(ctx, W, top, s, right = null) {
  const cy = top * 0.56, r = top * 0.28;
  mark(ctx, W * 0.075, cy, r);
  const tx = W * 0.075 + r + W * 0.025;
  title(ctx, s, tx, cy, top * 0.42, (right ? W * 0.62 : W * 0.88) - tx);
  if (right) text(ctx, right, W - W * 0.04, cy, { size: top * 0.24, align: 'right', color: PAL.muted, max: W * 0.3 });
}
// The bottom band: button hints in a row (glyph + plain label), a status line under them.
// items: [['A', 'Select'], ['B', 'Back'], ['star', 'New']]
export function hints(ctx, W, H, items, status = null) {
  const bottomY = H - Math.round(H * BAND.bottom), band = H - bottomY, gh = band * 0.22, size = band * 0.18, y = bottomY + band * 0.22;
  const parts = items.map(([k, s]) => ({ k, s, w: (k === 'star' ? gh : k ? glyphW(ctx, k, gh) : 0) + gh * 0.4 + measure(ctx, s, size) }));
  const gap = W * 0.08, total = parts.reduce((a, p) => a + p.w, 0) + gap * (parts.length - 1);
  let x = (W - total) / 2;
  for (const p of parts) {
    if (p.k === 'star') { star(ctx, x + gh / 2, y, gh * 0.8); x += gh; } else if (p.k) x += glyph(ctx, p.k, x, y, gh);
    x += gh * 0.4;
    x += text(ctx, p.s, x, y, { size }) + gap;
  }
  if (status) {
    const sy = bottomY + band * 0.52, gx = W * 0.055;
    ctx.save(); ctx.beginPath(); ctx.arc(gx, sy, gh * 0.36, 0, Math.PI * 2); ctx.lineWidth = Math.max(2, gh * 0.12); ctx.strokeStyle = '#a8382e'; ctx.stroke(); ctx.restore();
    text(ctx, status, gx + gh * 0.85, sy, { size: size * 0.95, max: W * 0.86 });
  }
}

// The invented shield outline (square top, pointed foot), as a path.
function shieldPath(ctx, x, y, w, h) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.5);
  ctx.quadraticCurveTo(x + w, y + h * 0.85, x + w / 2, y + h); ctx.quadraticCurveTo(x, y + h * 0.85, x, y + h * 0.5); ctx.closePath();
}
// A team chip h tall: a nation's flag (thin dark outline), a club's shield in its kit colours with a star. Returns its width.
export function teamChip(ctx, team, x, y, h) {
  const k = team.kit;
  if (FLAGS[team.id]) {
    const w = h * 1.5;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); paintFlag(ctx, team.id, x, y, w, h); ctx.restore();
    ctx.save(); ctx.lineWidth = Math.max(1.5, h * 0.05); ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeRect(x, y, w, h); ctx.restore();
    return w;
  }
  const w = h * 0.82;
  ctx.save();
  shieldPath(ctx, x, y, w, h); ctx.fillStyle = k.shirt; ctx.fill(); ctx.clip();
  ctx.fillStyle = k.alt;
  if (k.pattern === 'halves') ctx.fillRect(x + w / 2, y, w / 2, h);
  else if (k.pattern === 'stripes' || k.pattern === 'checks') for (let i = 1; i < 5; i += 2) ctx.fillRect(x + i * w / 5, y, w / 5, h);
  else if (k.pattern === 'hoops' || k.pattern === 'band') ctx.fillRect(x, y + h * 0.38, w, h * 0.2);
  ctx.restore();
  ctx.save(); shieldPath(ctx, x, y, w, h); ctx.lineWidth = Math.max(1.5, h * 0.07); ctx.strokeStyle = k.trim === k.shirt ? '#111' : k.trim; ctx.stroke(); ctx.restore();
  star(ctx, x + w / 2, y + h * 0.36, h * 0.36);
  return w;
}

// A kit shirt icon in the team's colours (for team select).
export function shirt(ctx, k, cx, y, s) {
  const pts = [[-0.22, 0], [-0.5, 0.12], [-0.62, 0.42], [-0.42, 0.5], [-0.36, 0.36], [-0.36, 1], [0.36, 1], [0.36, 0.36], [0.42, 0.5], [0.62, 0.42], [0.5, 0.12], [0.22, 0], [0, 0.1]];
  ctx.save();
  ctx.beginPath(); pts.forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](cx + px * s, y + py * s)); ctx.closePath();
  ctx.fillStyle = k.shirt; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = k.alt;
  if (k.pattern === 'halves') ctx.fillRect(cx, y, s, s);
  else if (k.pattern === 'stripes' || k.pattern === 'checks') for (let i = -3; i <= 3; i += 2) ctx.fillRect(cx + i * s * 0.09 - s * 0.045, y, s * 0.09, s);
  else if (k.pattern === 'hoops') for (let i = 0; i < 5; i++) ctx.fillRect(cx - s, y + s * (0.18 + i * 0.18), 2 * s, s * 0.09);
  else if (k.pattern === 'band') ctx.fillRect(cx - s, y + s * 0.4, 2 * s, s * 0.16);
  else if (k.pattern === 'sleeves') { ctx.fillRect(cx - s, y, s * 0.64, s); ctx.fillRect(cx + s * 0.36, y, s, s); }
  ctx.restore();
  ctx.lineWidth = Math.max(2, s * 0.03); ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 0.22 * s, y); ctx.quadraticCurveTo(cx, y + 0.2 * s, cx + 0.22 * s, y);
  ctx.lineWidth = s * 0.05; ctx.strokeStyle = k.trim; ctx.stroke();
  ctx.restore();
}

/* ---------- three.js side: a canvas on a plane ---------- */

// A texture for a UI canvas: smooth filtering (the PS1 game drew these with hard pixels), mipmaps when it
// doesn't change every frame.
export function uiTex(canvas, { mips = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = mips; t.anisotropy = 4;
  return t;
}
// Unlit, transparent, no fog, no tone mapping: what the canvas says is what you see.
export function uiMat(map, o = {}) {
  return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false, toneMapped: false, ...o });
}
// { c, ctx, t, m }: a canvas w x h px shown on a plane mw x mh metres.
export function uiPlane(w, h, mw, mh, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'), t = uiTex(c, o);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), uiMat(t, o.mat || {}));
  return { c, ctx, t, m };
}
