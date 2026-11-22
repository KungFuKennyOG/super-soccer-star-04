// The presentation stage for the trophy ceremony (game/trophy.js), as cup finals of the 2000s staged it: a low
// carpeted platform on the pitch, a riser behind for the squad's back row, a step-and-repeat backdrop board
// with wings, a fascia along the front, a carpet apron, a line of boards holding back a huddle of photographers,
// confetti cannons at the sides and pyro units at the corners. One mesh, one painted sheet, one draw call.
// Its own frame: you stand at the origin on the platform top (y = STAGE.h) facing -z; the squad is behind you (+z).
// Only the game's own invented marks and words are painted: no real competition's name, logo or sponsor.
import * as THREE from 'three';
import { canvas, hash } from './paint.js';
import { YEAR, NAME } from './brand.js';
import { mark, star, text, font } from './ui.js';

export const STAGE = { h: 0.5, halfW: 4.5, front: -1.7, back: 2.0, riser: 0.4, riserBack: 3.3, riserHalfW: 3.3, wallTop: 4.3, boards: -3.3 };
export const CUP_NAME = { world: `WORLD CUP ${YEAR}`, club: `CHAMPIONS CUP ${YEAR}` };
// where things fire from (stage frame): confetti cannons either side, spark jets at the four corners
export const CANNONS = [[-5.2, 0.75, 0.2], [5.2, 0.75, 0.2]];
export const JETS = [[-4.2, STAGE.h + 0.22, -1.45], [4.2, STAGE.h + 0.22, -1.45], [-4.0, STAGE.h + STAGE.riser + 0.22, 3.0], [4.0, STAGE.h + STAGE.riser + 0.22, 3.0]];
// the photographers' lenses (stage frame), for the flashes
export const LENSES = [];

const LOOKS = {
  world: { carpet: '#8d1620', carpet2: '#6e1018', edge: '#e2b23e', wall: '#0f1c3f', wall2: '#172a5c', ink: '#f1d27a', skirt: '#0b1022' },
  club: { carpet: '#15233f', carpet2: '#0f1a30', edge: '#cfd6de', wall: '#0c0d12', wall2: '#1b1e28', ink: '#e8ecf2', skirt: '#08090c' },
};
// regions of the sheet (px): x, y, w, h
const R = {
  carpet: [0, 0, 512, 256], riser: [512, 0, 256, 128], dark: [772, 4, 120, 120], steel: [900, 4, 120, 120],
  fascia: [0, 256, 1024, 64], wall: [0, 320, 1024, 384], board: [0, 704, 512, 64], boardBack: [512, 704, 512, 64],
  press: i => [i * 128, 768, 128, 256], wing: [640, 768, 128, 256], pressBack: [768, 768, 128, 256], apron: [896, 768, 128, 256],
};
const S = 1024;

function weave(ctx, [x, y, w, h], base, seed) {
  ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
  const im = ctx.getImageData(x, y, w, h), d = im.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (j * w + i) * 4, n = 0.86 + 0.2 * hash(i, j, seed) + 0.05 * Math.sin(i * 1.6) * Math.sin(j * 1.6); d[k] *= n; d[k + 1] *= n; d[k + 2] *= n; }
  ctx.putImageData(im, x, y);
}
// a photographer seen from the front: bib over dark clothes, the camera at his face, its lens toward you
function pressman(ctx, [x, y, w, h], i, kneel) {
  const cx = x + w / 2, skin = ['#c99673', '#8a5a3c', '#e0b08c', '#a87552'][i % 4], bib = ['#d8d23a', '#e8e6de', '#4f7fd0', '#d8d23a'][i % 4], dark = ['#39414f', '#5a5046', '#2f4866', '#44464c'][i % 4];
  const top = y + (kneel ? h * 0.42 : h * 0.07), hr = w * 0.11, sh = top + hr * 2.5, hip = kneel ? y + h * 0.8 : y + h * 0.55;
  ctx.fillStyle = dark;
  if (kneel) { ctx.fillRect(cx - w * 0.26, hip - 4, w * 0.24, h - (hip - y) + 4); ctx.fillRect(cx + 2, hip - 4, w * 0.3, (y + h - hip) * 0.55); ctx.fillRect(cx + w * 0.1, hip + (y + h - hip) * 0.4, w * 0.24, (y + h - hip) * 0.6); }
  else { ctx.fillRect(cx - w * 0.2, hip - 4, w * 0.17, y + h - hip + 4); ctx.fillRect(cx + w * 0.03, hip - 4, w * 0.17, y + h - hip + 4); }
  ctx.beginPath(); ctx.moveTo(cx - w * 0.3, sh + 6); ctx.quadraticCurveTo(cx, sh - 8, cx + w * 0.3, sh + 6); ctx.lineTo(cx + w * 0.24, hip); ctx.lineTo(cx - w * 0.24, hip); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bib; ctx.fillRect(cx - w * 0.19, sh + 10, w * 0.38, (hip - sh) * 0.72);
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.font = font(w * 0.15, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(11 + i * 17), cx, sh + 10 + (hip - sh) * 0.4);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(cx, top + hr * 1.2, hr, hr * 1.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ['#1a1410', '#0c0c0c', '#5a4630', '#2a2018'][i % 4]; ctx.beginPath(); ctx.ellipse(cx, top + hr * 0.65, hr * 1.05, hr * 0.75, 0, Math.PI, Math.PI * 2); ctx.fill();
  // arms up to the camera, the body of it across his face, the lens a dark ring with a glint
  const cy = top + hr * 1.35;
  ctx.strokeStyle = dark; ctx.lineWidth = w * 0.11; ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * w * 0.27, sh + 12); ctx.lineTo(cx + s * w * 0.3, sh + (hip - sh) * 0.42); ctx.lineTo(cx + s * w * 0.13, cy + 4); ctx.stroke(); }
  ctx.fillStyle = skin; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * w * 0.13, cy + 4, w * 0.055, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#101012'; ctx.fillRect(cx - w * 0.15, cy - hr * 0.75, w * 0.3, hr * 1.5);
  ctx.fillStyle = '#26262a'; ctx.beginPath(); ctx.arc(cx, cy, hr * 0.78, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#07080c'; ctx.beginPath(); ctx.arc(cx, cy, hr * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(190,210,255,0.8)'; ctx.beginPath(); ctx.arc(cx - hr * 0.2, cy - hr * 0.2, hr * 0.14, 0, Math.PI * 2); ctx.fill();
  return (cy - y) / h;                               // how far down the card the lens is
}

// the same man from behind (what the stands see): hair, jacket, the bib's back, legs
function pressBack(ctx, [x, y, w, h]) {
  const cx = x + w / 2, top = y + h * 0.07, hr = w * 0.11, sh = top + hr * 2.5, hip = y + h * 0.55;
  ctx.fillStyle = '#39414f'; ctx.fillRect(cx - w * 0.2, hip - 4, w * 0.17, y + h - hip + 4); ctx.fillRect(cx + w * 0.03, hip - 4, w * 0.17, y + h - hip + 4);
  ctx.beginPath(); ctx.moveTo(cx - w * 0.32, sh + 6); ctx.quadraticCurveTo(cx, sh - 8, cx + w * 0.32, sh + 6); ctx.lineTo(cx + w * 0.25, hip); ctx.lineTo(cx - w * 0.25, hip); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d8d23a'; ctx.fillRect(cx - w * 0.19, sh + 10, w * 0.38, (hip - sh) * 0.72);
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.font = font(w * 0.13, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PRESS', cx, sh + 10 + (hip - sh) * 0.36);
  ctx.fillStyle = '#c99673'; ctx.fillRect(cx - hr * 0.5, top + hr * 1.8, hr, hr);
  ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.ellipse(cx, top + hr * 1.15, hr, hr * 1.2, 0, 0, Math.PI * 2); ctx.fill();
}

const lensAt = [];
function sheet(kind) {
  const L = LOOKS[kind], c = canvas(S, S), ctx = c.getContext('2d'), name = CUP_NAME[kind];
  weave(ctx, R.carpet, L.carpet, 3);
  { const [x, y, w, h] = R.carpet; ctx.strokeStyle = L.edge; ctx.lineWidth = 5; ctx.strokeRect(x + 12, y + 12, w - 24, h - 24); ctx.lineWidth = 1.5; ctx.strokeRect(x + 21, y + 21, w - 42, h - 42); }
  weave(ctx, R.riser, L.carpet2, 5);
  { const [x, y, w, h] = R.riser; ctx.fillStyle = L.edge; ctx.fillRect(x, y + h - 7, w, 4); }
  ctx.fillStyle = L.skirt; ctx.fillRect(768, 0, 128, 128);
  ctx.fillStyle = '#8f959c'; ctx.fillRect(896, 0, 128, 128);
  // the fascia along the platform's front: the cup's name and CHAMPIONS, over and over, between stars
  { const [x, y, w, h] = R.fascia; ctx.fillStyle = L.wall; ctx.fillRect(x, y, w, h); ctx.fillStyle = L.edge; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 3);
    for (let i = 0; i < 4; i++) { const cx = x + (i + 0.5) * w / 4; text(ctx, i % 2 ? 'CHAMPIONS' : name, cx, y + h / 2 + 1, { size: 30, weight: 900, align: 'center', color: L.ink, max: w / 4 - 44, shadow: false }); star(ctx, x + i * w / 4 + 2, y + h / 2, 22); } star(ctx, x + w - 2, y + h / 2, 22); }
  // the backdrop: a step-and-repeat of our mark and the game's name, the cup's name large across the middle
  { const [x, y, w, h] = R.wall, g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, L.wall2); g.addColorStop(1, L.wall); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    for (let j = 0; j < 6; j++) for (let i = 0; i < 13; i++) {
      const cx = x + (i + (j % 2 ? 0.5 : 0)) * 82 + 16, cy = y + 30 + j * 64;
      if (cy > y + 120 && cy < y + 270 && cx > x + 170 && cx < x + w - 170) continue;
      if ((i + j) % 2) { ctx.globalAlpha = 0.9; mark(ctx, cx, cy, 15); ctx.globalAlpha = 1; } else { text(ctx, NAME, cx, cy - 6, { size: 9.5, weight: 900, align: 'center', color: L.ink, shadow: false }); text(ctx, YEAR, cx, cy + 8, { size: 13, weight: 900, align: 'center', color: L.ink, shadow: false }); }
    }
    ctx.fillStyle = L.edge; ctx.fillRect(x + 176, y + 128, w - 352, 3); ctx.fillRect(x + 176, y + 262, w - 352, 3);
    text(ctx, name, x + w / 2, y + 168, { size: 54, weight: 900, align: 'center', color: '#ffffff', max: w - 400 });
    text(ctx, 'CHAMPIONS', x + w / 2, y + 226, { size: 62, weight: 900, align: 'center', color: L.ink, max: w - 400 });
    ctx.fillStyle = L.edge; ctx.fillRect(x, y, w, 6); ctx.fillRect(x, y + h - 5, w, 5); }
  // the boards in front (our name, facing the stands) and their plain backs with a frame (what you see)
  { const [x, y, w, h] = R.board; ctx.fillStyle = '#f2f1ea'; ctx.fillRect(x, y, w, h); text(ctx, `${NAME} ${YEAR}`, x + w / 2, y + h / 2, { size: 34, weight: 900, align: 'center', color: L.wall, max: w - 30, shadow: false }); }
  { const [x, y, w, h] = R.boardBack; ctx.fillStyle = '#4a4f58'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#8a9099'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) ctx.strokeRect(x + i * w / 4 + 3, y + 3, w / 4 - 6, h - 6); ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(x + i * w / 4 + 3, y + h - 3); ctx.lineTo(x + (i + 1) * w / 4 - 3, y + 3); } ctx.stroke(); }
  for (let i = 0; i < 5; i++) lensAt[i] = pressman(ctx, R.press(i), i, i >= 3);
  pressBack(ctx, R.pressBack);
  { const [x, y, w, h] = R.wing; ctx.fillStyle = L.wall; ctx.fillRect(x, y, w, h); ctx.fillStyle = L.edge; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); mark(ctx, x + w / 2, y + 60, 34); for (let i = 0; i < 3; i++) star(ctx, x + w / 2, y + 130 + i * 40, 26); }
  weave(ctx, R.apron, L.carpet2, 9);
  { const [x, y, w, h] = R.apron; ctx.strokeStyle = L.edge; ctx.lineWidth = 4; ctx.strokeRect(x + 8, y + 8, w - 16, h - 16); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// kind: 'world' | 'club'. Returns { mesh, tris }.
const sheets = {};
export function buildStage(kind = 'world') {
  const P = [], U = [], C = [], I = [], { h: H, halfW: W, front: F, back: B, riser: RH, riserBack: RB, riserHalfW: RW, wallTop: WT } = STAGE;
  // a quad from its corners (bottom left, bottom right, top right, top left as seen from its front), a region, a shade
  const quad = (a, b, c, d, [x, y, w, h], shade = 1, shadeTop = shade) => {
    const n = P.length / 3, e = 0.5;
    P.push(...a, ...b, ...c, ...d);
    U.push((x + e) / S, 1 - (y + h - e) / S, (x + w - e) / S, 1 - (y + h - e) / S, (x + w - e) / S, 1 - (y + e) / S, (x + e) / S, 1 - (y + e) / S);
    C.push(shade, shade, shade, shade, shade, shade, shadeTop, shadeTop, shadeTop, shadeTop, shadeTop, shadeTop);
    I.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  // a box's walls and top: regions for the top, the -z face (toward the stands in front), the rest
  const box = (x0, x1, y0, y1, z0, z1, top, front, side = R.dark, k = 0.55) => {
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], front, k, 1);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], side, k, 0.9);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side, k, 0.9);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side, k, 0.9);
  };
  box(-W, W, 0, H, F, B, R.carpet, R.fascia, R.dark, 0.8);                                     // the platform
  box(-RW, RW, H, H + RH, B, RB, R.riser, R.riser, R.dark, 0.75);                              // the riser
  for (const s of [-1, 1]) {                                                                   // a step up at each front corner, and a way up at each side
    box(s > 0 ? 2.7 : -4.1, s > 0 ? 4.1 : -2.7, 0, H / 2, F - 0.34, F, R.riser, R.dark, R.dark, 0.7);
    box(s > 0 ? W : -W - 0.34, s > 0 ? W + 0.34 : -W, 0, H / 2, -0.6, 0.8, R.riser, R.dark, R.dark, 0.7);
  }
  // the backdrop behind the riser (its face toward you, a plain back), and a wing angled in at each end
  quad([W, 0, RB], [-W, 0, RB], [-W, H + RH, RB], [W, H + RH, RB], R.dark, 0.5, 0.7);
  quad([W, H + RH, RB], [-W, H + RH, RB], [-W, WT, RB], [W, WT, RB], R.wall, 0.9, 1);
  quad([-W, 0, RB + 0.02], [W, 0, RB + 0.02], [W, WT, RB + 0.02], [-W, WT, RB + 0.02], R.dark, 0.5, 0.8);
  for (const s of [-1, 1]) {
    const a = [s * W, 0, RB], b = [s * (W + 0.95), 0, RB - 1.15], at = [a[0], WT, a[2]], bt = [b[0], WT, b[2]];
    if (s > 0) { quad(b, a, at, bt, R.wing, 0.8, 1); quad(a, b, bt, at, R.dark, 0.5, 0.8); } else { quad(a, b, bt, at, R.wing, 0.8, 1); quad(b, a, at, bt, R.dark, 0.5, 0.8); }
  }
  quad([W, 0.012, F - 1.5], [-W, 0.012, F - 1.5], [-W, 0.012, F], [W, 0.012, F], R.apron, 0.9);          // the carpet apron on the grass
  // the boards: five 2.4 m panels in a shallow arc in front, their printed side to the stands
  const BZ = STAGE.boards, bh = 0.86;
  for (let i = -2; i <= 2; i++) {
    const x0 = i * 2.44 - 1.2, x1 = x0 + 2.4;
    const za = BZ - 0.07 * (x0 / 2.44) ** 2 * 1.2, zb = BZ - 0.07 * (x1 / 2.44) ** 2 * 1.2;
    const [bx, by, bw, bhh] = R.boardBack, part = [bx + ((i + 2) % 4) * bw / 4, by, bw / 4, bhh];
    quad([x0, 0, za], [x1, 0, zb], [x1, bh, zb], [x0, bh, za], part, 0.75, 1);
    quad([x1, 0, zb - 0.03], [x0, 0, za - 0.03], [x0, bh, za - 0.03], [x1, bh, zb - 0.03], R.board, 0.8, 1);
  }
  // the photographers behind the boards: a kneeling row at the boards and a standing row behind it, cards toward you
  LENSES.length = 0;
  const card = (x, z, i, sc) => {
    const kneel = i >= 3, w = 0.86 * sc, hh = 1.78 * sc, y0 = kneel ? -0.62 * sc : 0;      // (a kneeling card's top 58% holds the figure)
    quad([x - w / 2, y0, z], [x + w / 2, y0, z], [x + w / 2, y0 + hh, z], [x - w / 2, y0 + hh, z], R.press(i), 0.82, 1);
    if (kneel) quad([x + w / 2, 0, z - 0.01], [x - w / 2, 0, z - 0.01], [x - w / 2, hh * 0.58, z - 0.01], [x + w / 2, hh * 0.58, z - 0.01], [R.pressBack[0], R.pressBack[1], 128, 148], 0.8, 1);
    else quad([x + w / 2, y0, z - 0.01], [x - w / 2, y0, z - 0.01], [x - w / 2, y0 + hh, z - 0.01], [x + w / 2, y0 + hh, z - 0.01], R.pressBack, 0.8, 1);
    LENSES.push([x, y0 + hh * (1 - lensAt[i]), z + 0.05]);
  };
  [-3.6, -2.5, -1.5, -0.55, 0.5, 1.45, 2.4, 3.5].forEach((x, k) => card(x + 0.12 * Math.sin(k * 5.1), BZ - 0.5 - 0.07 * x * x * 0.2 - 0.1 * (k % 2), 3 + (k % 2), 0.97 + 0.05 * Math.sin(k * 2.3)));
  [-3.1, -2.0, -1.0, 0.05, 1.0, 1.95, 3.0].forEach((x, k) => card(x + 0.1 * Math.sin(k * 3.7), BZ - 1.15 - 0.014 * x * x - 0.12 * (k % 2), k % 3, 0.98 + 0.05 * Math.sin(k * 1.9 + 1)));
  // the hardware: confetti cannons (a barrel on a base, tipped inward) and the pyro units at the corners
  for (const [x, y, z] of CANNONS) { box(x - 0.3, x + 0.3, 0, 0.3, z - 0.3, z + 0.3, R.steel, R.dark, R.dark, 0.6); box(x - 0.14, x + 0.14, 0.3, y, z - 0.14, z + 0.14, R.dark, R.steel, R.steel, 0.7); }
  for (const [x, y, z] of JETS) box(x - 0.11, x + 0.11, y - 0.22, y, z - 0.11, z + 0.11, R.dark, R.steel, R.steel, 0.7);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I); geo.computeVertexNormals();
  const map = sheets[kind] || (sheets[kind] = sheet(kind));
  const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map, vertexColors: true, alphaTest: 0.5, shininess: 6, specular: 0x111111 }));
  mesh.name = 'stage';
  return { mesh, tris: I.length / 3 };
}
