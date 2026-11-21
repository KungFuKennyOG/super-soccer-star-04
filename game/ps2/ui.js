// The '04 menus and HUD: one shared style for every canvas the game shows on an in-world panel.
// A 2003-04 console football look taken as a style only (no real logos, layouts, sponsors or competitions):
// bold condensed sans-serif headings, glossy gradient bars, rounded tabs, dark glass panels over a soft
// floodlit backdrop, a glowing highlighted row, team chips (a nation's flag, a club's invented shield).
// Type comes from system fonts (Roboto on the Quest, Inter / Arial elsewhere) squeezed sideways in code,
// so it reads as condensed whatever font the browser has. Everything here is plain 2D canvas.
import * as THREE from 'three';
import { paintFlag, FLAGS } from './flags.js';
import { YEAR, NAME } from './brand.js';
export { YEAR, NAME };

export const PAL = {
  ink: '#ffffff', soft: '#d6e0f2', muted: '#97a9cc', dim: '#55658a', line: 'rgba(160,190,240,0.28)',
  accent: '#ffc933', hot: '#ff8a1c', good: '#5be37c', bad: '#ff5a4e', info: '#5cc8ff',
  navy: '#0a1426', deep: '#050b18', blueHi: '#5b92f0', blueLo: '#14378c', amberHi: '#ffd75a', amberLo: '#e56f0f',
  greyHi: '#4a5674', greyLo: '#1a2236',
};
export const TONE = { good: PAL.accent, bad: PAL.bad, info: PAL.info };
const STACK = 'Roboto, Inter, "Helvetica Neue", Arial, "Liberation Sans", sans-serif';
export const font = (px, weight = 800, italic = false) => `${italic ? 'italic ' : ''}${weight} ${Math.round(px)}px ${STACK}`;

// Width of `s` as text() would draw it (squash included).
export function measure(ctx, s, size, { weight = 800, italic = false, squash = 0.86 } = {}) {
  ctx.font = font(size, weight, italic);
  return ctx.measureText(String(s)).width * squash;
}

// Text centred vertically on y. o: { size, weight, italic, color, align: left|center|right, squash (sideways
// scale, 0.86 = condensed), max (width: squeezed down to 0.62, then shrunk), shadow (soft drop, on by default),
// glow (a colour) }. Returns the width drawn.
export function text(ctx, s, x, y, o = {}) {
  const str = String(s);
  let size = o.size || 32, sq = o.squash || 0.86;
  const weight = o.weight || 800, italic = !!o.italic;
  ctx.font = font(size, weight, italic);
  let w = ctx.measureText(str).width;
  if (o.max && w * sq > o.max) {
    sq = Math.max(0.62, o.max / w);
    if (w * sq > o.max) { size *= o.max / (w * sq); ctx.font = font(size, weight, italic); w = ctx.measureText(str).width; }
  }
  const dw = w * sq, align = o.align || 'left';
  const x0 = align === 'center' ? x - dw / 2 : align === 'right' ? x - dw : x;
  ctx.save();
  ctx.translate(x0, y); ctx.scale(sq, 1);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = size * 0.45; }
  else if (o.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = size * 0.12; ctx.shadowOffsetY = size * 0.06; }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeW || size * 0.14; ctx.strokeStyle = o.stroke; ctx.strokeText(str, 0, size * 0.04); }
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

// Dark glass: a slightly lighter top, a hairline of light along the top edge and a soft rim.
export function panel(ctx, x, y, w, h, { r = 16, alpha = 0.86, rim = true } = {}) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = vgrad(ctx, y, y + h, [[0, `rgba(34,48,78,${alpha})`], [0.5, `rgba(14,24,44,${alpha})`], [1, `rgba(6,12,26,${alpha})`]]);
  ctx.fill();
  if (rim) { ctx.lineWidth = 3; ctx.strokeStyle = PAL.line; ctx.stroke(); }
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x, y, w, 3);
  ctx.restore();
}

// The glossy bar: a vertical gradient with a bright upper half, like a bevelled plastic button.
// kind: 'blue' | 'amber' (selected) | 'grey' | [hi, lo] colours. glow: soft light round it.
export function gloss(ctx, x, y, w, h, { r = h / 2.6, kind = 'blue', glow = null, corners = null } = {}) {
  const [hi, lo] = Array.isArray(kind) ? kind : kind === 'amber' ? [PAL.amberHi, PAL.amberLo] : kind === 'grey' ? [PAL.greyHi, PAL.greyLo] : [PAL.blueHi, PAL.blueLo];
  ctx.save();
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = h * 0.55; }
  rr(ctx, x, y, w, h, corners || r);
  ctx.fillStyle = vgrad(ctx, y, y + h, [[0, hi], [0.48, mix(hi, lo, 0.45)], [0.52, lo], [1, mix(lo, hi, 0.25)]]);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  // the shine on the top half, and a dark lip at the bottom
  ctx.fillStyle = vgrad(ctx, y, y + h * 0.5, [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0.08)']]);
  rr(ctx, x + 3, y + 2, w - 6, h * 0.48, [Math.min(r, h * 0.4), Math.min(r, h * 0.4), 4, 4]); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + h - 3, w, 3);
  ctx.restore();
  ctx.save(); rr(ctx, x, y, w, h, corners || r); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke(); ctx.restore();
}

// A rounded tab (top corners only), lit when on.
export function tab(ctx, x, y, w, h, label, on, size = h * 0.56) {
  gloss(ctx, x, y, w, h, { kind: on ? 'amber' : 'grey', corners: [h * 0.4, h * 0.4, 0, 0], glow: on ? 'rgba(255,190,60,0.6)' : null });
  text(ctx, label, x + w / 2, y + h / 2, { size, align: 'center', italic: true, color: on ? PAL.deep : PAL.soft, shadow: !on, max: w - 16 });
}

// A row that's picked: a soft amber glow behind a glossy bar, plus a pointer on the left.
export function rowHighlight(ctx, x, y, w, h) {
  gloss(ctx, x, y, w, h, { kind: 'amber', glow: 'rgba(255,170,40,0.75)', r: h * 0.3 });
  ctx.save(); ctx.fillStyle = PAL.ink; ctx.beginPath();
  ctx.moveTo(x - h * 0.42, y + h * 0.22); ctx.lineTo(x - h * 0.08, y + h / 2); ctx.lineTo(x - h * 0.42, y + h * 0.78); ctx.closePath();
  ctx.shadowColor = 'rgba(255,200,80,0.9)'; ctx.shadowBlur = 10; ctx.fill(); ctx.restore();
}

// The full-panel backdrop: night sky, blurred floodlights, a soft crowd band and mown stripes, then
// darkened so panels and type sit over it. Painted once per size and kept.
const backdrops = new Map();
export function backdrop(ctx, W, H, { r = 26 } = {}) {
  const key = `${W}x${H}`;
  if (!backdrops.has(key)) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const b = c.getContext('2d');
    b.fillStyle = vgrad(b, 0, H, [[0, '#0b1838'], [0.42, '#1a2d55'], [0.55, '#20364a'], [0.62, '#1f5a2c'], [1, '#123a1c']]);
    b.fillRect(0, 0, W, H);
    // crowd band: speckles of shirt colours
    for (let i = 0; i < 900; i++) {
      const x = rnd(i) * W, y = H * (0.36 + rnd(i + 0.5) * 0.2);
      b.fillStyle = ['#c9d4ea', '#8292b8', '#b23a3a', '#e4c25a', '#3b5aa8'][i % 5]; b.globalAlpha = 0.35;
      b.fillRect(x, y, W / 160, W / 160);
    }
    b.globalAlpha = 1;
    // mown stripes in perspective
    for (let i = 0; i < 9; i++) { b.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'; b.fillRect(0, H * (0.6 + i * 0.05 + i * i * 0.004), W, H * (0.05 + i * 0.008)); }
    // floodlights
    for (const [fx, fy] of [[0.12, 0.1], [0.88, 0.1], [0.36, 0.05], [0.64, 0.05]]) {
      const g = b.createRadialGradient(fx * W, fy * H, 0, fx * W, fy * H, W * 0.22);
      g.addColorStop(0, 'rgba(255,250,225,0.75)'); g.addColorStop(0.15, 'rgba(220,235,255,0.25)'); g.addColorStop(1, 'rgba(120,150,220,0)');
      b.fillStyle = g; b.fillRect(0, 0, W, H);
    }
    // soften it all in one blur pass (a filter on every speck above would be hundreds of passes)
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
    const b2 = c2.getContext('2d'); b2.filter = `blur(${Math.round(W / 90)}px)`; b2.drawImage(c, 0, 0); b2.filter = 'none';
    b.clearRect(0, 0, W, H); b.drawImage(c2, 0, 0);
    b.fillStyle = 'rgba(4,8,20,0.42)'; b.fillRect(0, 0, W, H);
    const v = b.createRadialGradient(W / 2, H * 0.45, W * 0.2, W / 2, H * 0.5, W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    b.fillStyle = v; b.fillRect(0, 0, W, H);
    backdrops.set(key, c);
  }
  ctx.save(); rr(ctx, 0, 0, W, H, r); ctx.clip();
  ctx.drawImage(backdrops.get(key), 0, 0);
  ctx.restore();
  ctx.save(); rr(ctx, 2, 2, W - 4, H - 4, r); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(170,200,255,0.45)'; ctx.stroke(); ctx.restore();
}
const rnd = i => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

// The title strip across the top of a screen: a glossy blue bar with a slanted amber flash at the left.
export function header(ctx, W, title, { y = 18, h = 74, sub = null } = {}) {
  gloss(ctx, 18, y, W - 36, h, { kind: 'blue', r: 14 });
  ctx.save(); ctx.beginPath();
  ctx.moveTo(18, y + 14); ctx.quadraticCurveTo(18, y, 32, y); ctx.lineTo(64, y); ctx.lineTo(44, y + h); ctx.lineTo(32, y + h); ctx.quadraticCurveTo(18, y + h, 18, y + h - 14); ctx.closePath();
  ctx.fillStyle = PAL.accent; ctx.fill(); ctx.restore();
  text(ctx, title, 72, y + h / 2, { size: h * 0.58, italic: true, weight: 900, max: W - (sub ? 380 : 120) });
  if (sub) text(ctx, sub, W - 40, y + h / 2, { size: h * 0.42, align: 'right', color: PAL.accent, italic: true, max: 300 });
}

// The hint line along the bottom: button chips (A green, B red, X blue, Y yellow, others grey keys) and words.
// items: [['A', 'PICK'], ['B', 'BACK'], [null, 'STICK MOVES']] ...
const BTN = { A: ['#5fe07e', '#17803a'], B: ['#ff7a6a', '#a91c1c'], X: ['#7ab8ff', '#1f4fb0'], Y: ['#ffe066', '#b88a0e'] };
export function hints(ctx, W, H, items, { h = 50, y = H - h - 14 } = {}) {
  const size = h * 0.56, parts = items.map(([k, s]) => ({ k, s, w: (k ? chipW(ctx, k, h) + 10 : 0) + measure(ctx, s, size, { weight: 700 }) }));
  const gap = 34, total = parts.reduce((a, p) => a + p.w, 0) + gap * (parts.length - 1);
  let x = (W - total) / 2;
  for (const p of parts) {
    if (p.k) x += button(ctx, p.k, x, y + h / 2, h) + 10;
    x += text(ctx, p.s, x, y + h / 2, { size, weight: 700, color: PAL.soft }) + gap;
  }
}
const chipW = (ctx, k, h) => (BTN[k] ? h * 0.9 : measure(ctx, k, h * 0.48, { weight: 800 }) + h * 0.55);
// A controller button (a glossy disc) or a key cap; returns its width.
export function button(ctx, k, x, cy, h) {
  const d = h * 0.9;
  if (BTN[k]) {
    gloss(ctx, x, cy - d / 2, d, d, { kind: BTN[k], r: d / 2 });
    text(ctx, k, x + d / 2, cy, { size: d * 0.62, align: 'center', weight: 900, color: PAL.ink, squash: 1 });
    return d;
  }
  const w = chipW(ctx, k, h);
  gloss(ctx, x, cy - d / 2, w, d, { kind: 'grey', r: d * 0.25 });
  text(ctx, k, x + w / 2, cy, { size: h * 0.48, align: 'center', weight: 800 });
  return w;
}

// Five stars, filled for the team's strength.
export function stars(ctx, n, x, cy, size, { align = 'left', of = 5 } = {}) {
  const gap = size * 1.12, x0 = align === 'center' ? x - (gap * of - (gap - size)) / 2 : x;
  for (let i = 0; i < of; i++) {
    const sx = x0 + i * gap + size / 2;
    ctx.save(); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? size * 0.22 : size * 0.52; ctx[k ? 'lineTo' : 'moveTo'](sx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    ctx.closePath();
    if (i < n) { ctx.shadowColor = 'rgba(255,190,40,0.8)'; ctx.shadowBlur = size * 0.3; ctx.fillStyle = PAL.accent; } else ctx.fillStyle = 'rgba(150,170,210,0.28)';
    ctx.fill(); ctx.restore();
  }
}

// The invented shield outline (square top, pointed foot), as a path.
function shieldPath(ctx, x, y, w, h) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.5);
  ctx.quadraticCurveTo(x + w, y + h * 0.85, x + w / 2, y + h); ctx.quadraticCurveTo(x, y + h * 0.85, x, y + h * 0.5); ctx.closePath();
}
// A team chip h tall: a nation's flag on a rounded card, a club's shield in its kit colours with a star.
// Returns its width.
export function teamChip(ctx, team, x, y, h) {
  const k = team.kit, isNation = !!FLAGS[team.id];
  if (isNation) {
    const w = h * 1.5;
    ctx.save(); rr(ctx, x, y, w, h, h * 0.14); ctx.clip();
    paintFlag(ctx, team.id, x, y, w, h);
    ctx.fillStyle = vgrad(ctx, y, y + h, [[0, 'rgba(255,255,255,0.35)'], [0.5, 'rgba(255,255,255,0.05)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.2)']]);
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.save(); rr(ctx, x, y, w, h, h * 0.14); ctx.lineWidth = Math.max(2, h * 0.06); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke(); ctx.restore();
    return w;
  }
  const w = h * 0.82;
  ctx.save();
  shieldPath(ctx, x, y, w, h); ctx.fillStyle = k.shirt; ctx.fill(); ctx.clip();
  if (k.pattern === 'halves') { ctx.fillStyle = k.alt; ctx.fillRect(x + w / 2, y, w / 2, h); }
  else if (k.pattern === 'stripes' || k.pattern === 'checks') { ctx.fillStyle = k.alt; for (let i = 1; i < 5; i += 2) ctx.fillRect(x + i * w / 5, y, w / 5, h); }
  else if (k.pattern === 'hoops' || k.pattern === 'band') { ctx.fillStyle = k.alt; ctx.fillRect(x, y + h * 0.38, w, h * 0.2); }
  ctx.fillStyle = vgrad(ctx, y, y + h, [[0, 'rgba(255,255,255,0.35)'], [0.45, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.25)']]);
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save(); shieldPath(ctx, x, y, w, h); ctx.lineWidth = Math.max(2, h * 0.07); ctx.strokeStyle = k.trim === k.shirt ? '#111' : k.trim; ctx.stroke(); ctx.restore();
  stars(ctx, 1, x + w / 2 - h * 0.15, y + h * 0.18, h * 0.3, { of: 1 });
  return w;
}

// A kit shirt icon in the team's colours (for team select).
export function shirt(ctx, k, cx, y, s) {
  const pts = [[-0.22, 0], [-0.5, 0.12], [-0.62, 0.42], [-0.42, 0.5], [-0.36, 0.36], [-0.36, 1], [0.36, 1], [0.36, 0.36], [0.42, 0.5], [0.62, 0.42], [0.5, 0.12], [0.22, 0], [0, 0.1]];
  ctx.save();
  ctx.beginPath(); pts.forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](cx + px * s, y + py * s)); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = s * 0.08; ctx.shadowOffsetY = s * 0.03;
  ctx.fillStyle = k.shirt; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); ctx.clip();
  ctx.fillStyle = k.alt;
  if (k.pattern === 'halves') ctx.fillRect(cx, y, s, s);
  else if (k.pattern === 'stripes' || k.pattern === 'checks') for (let i = -3; i <= 3; i += 2) ctx.fillRect(cx + i * s * 0.09 - s * 0.045, y, s * 0.09, s);
  else if (k.pattern === 'hoops') for (let i = 0; i < 5; i++) ctx.fillRect(cx - s, y + s * (0.18 + i * 0.18), 2 * s, s * 0.09);
  else if (k.pattern === 'band') ctx.fillRect(cx - s, y + s * 0.4, 2 * s, s * 0.16);
  else if (k.pattern === 'sleeves') { ctx.fillRect(cx - s, y, s * 0.64, s); ctx.fillRect(cx + s * 0.36, y, s, s); }
  ctx.fillStyle = vgrad(ctx, y, y + s, [[0, 'rgba(255,255,255,0.28)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.25)']]);
  ctx.fillRect(cx - s, y, 2 * s, s);
  ctx.restore();
  ctx.lineWidth = Math.max(2, s * 0.03); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 0.22 * s, y); ctx.quadraticCurveTo(cx, y + 0.2 * s, cx + 0.22 * s, y);
  ctx.lineWidth = s * 0.05; ctx.strokeStyle = k.trim; ctx.stroke();
  ctx.restore();
}

// The logo: SUPER SOCCER over a big chrome STAR, the year on an amber tag. h: the logo's height.
export function logo(ctx, cx, y, h) {
  const big = h * 0.62, small = h * 0.27;
  // swoosh behind
  ctx.save(); ctx.beginPath();
  ctx.moveTo(cx - big * 2.1, y + h * 0.95); ctx.quadraticCurveTo(cx, y + h * 0.55, cx + big * 2.2, y + h * 0.78);
  ctx.quadraticCurveTo(cx, y + h * 0.72, cx - big * 2.1, y + h * 0.95); ctx.fillStyle = PAL.hot; ctx.shadowColor = 'rgba(255,140,40,0.8)'; ctx.shadowBlur = h * 0.12; ctx.fill(); ctx.restore();
  text(ctx, 'SUPER SOCCER', cx, y + small * 0.6, { size: small, align: 'center', italic: true, weight: 900, color: PAL.soft, squash: 1.02 });
  ctx.save();
  ctx.font = font(big, 900, true);
  const sq = 1.0, w = ctx.measureText('STAR').width * sq, x0 = cx - w / 2 - h * 0.2, ty = y + small * 1.15 + big * 0.5;
  ctx.translate(x0, ty); ctx.scale(sq, 1); ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = big * 0.12; ctx.strokeStyle = '#0a1a48';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = big * 0.12; ctx.shadowOffsetY = big * 0.05;
  ctx.strokeText('STAR', 0, 0); ctx.shadowColor = 'transparent';
  ctx.fillStyle = vgrad(ctx, -big * 0.45, big * 0.45, [[0, '#ffffff'], [0.45, '#dfe8f8'], [0.5, '#7f95c4'], [0.56, '#2c4483'], [0.8, '#b8c8ea'], [1, '#ffffff']]);
  ctx.fillText('STAR', 0, 0);
  ctx.restore();
  const tw = h * 0.62, th = h * 0.34, tx = x0 + w + h * 0.04, tyy = ty - big * 0.42;
  gloss(ctx, tx, tyy, tw, th, { kind: 'amber', r: th * 0.3, glow: 'rgba(255,160,40,0.6)' });
  text(ctx, YEAR, tx + tw / 2, tyy + th / 2, { size: th * 0.74, align: 'center', italic: true, weight: 900, color: PAL.deep, shadow: false, squash: 0.95 });
}

// Mixes two #rrggbb colours.
export function mix(a, b, k) {
  const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = p(a), B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
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
