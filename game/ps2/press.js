// Press photographers as people (the trophy presentation, game/presscast.js): the '04 body dressed for the job
// (pressfigure.js: long trousers, plain shoes, a jacket with sleeves to the wrist, bare hands closed round the
// camera). The kit sheet is painted as working clothes: a dark jacket, trousers in a cloth of their own, plain
// dark shoes with a pale welt, and over the jacket a hi-vis tabard in one of our own colours with PHOTO across
// the back and a number on the chest. Our words only: no agency's name or mark. Plus what they carry: a camera
// with a long lens and a flash, and a cap for some.
import * as THREE from 'three';
import { canvas, hex, smoothTex, hash } from './paint.js';
import { paintKit, ATLAS, R, SPAN } from './kit.js';
import { headSheet } from './player.js';
import { SKINS } from '../tex.js';
import { figureGeometry } from './figure.js';
import { PRESS_DRESS } from './pressfigure.js';
import { buildSkeleton } from '../body.js';
import { font } from './ui.js';

export const BIBS = ['#c9e23a', '#f28a1e', '#3fc4c0', '#e9e6dc'];
const CLOTH = ['#23272f', '#2b2a28', '#1f2a3a', '#33302c'];                 // the jacket
const LEGS = ['#3a3f4a', '#4a4336', '#2a2c33', '#56524a', '#2f3a52'];       // trousers: charcoal, khaki, black, stone, denim
const SHOES = ['#1a1a1c', '#3a2a20', '#26282e'];
const css = c => `rgb(${c.map(v => Math.round(v)).join(',')})`, tone = (c, k) => css(hex(c).map(v => Math.min(255, v * k)));

// plain cloth on a region: the colour, a little weave, soft folds down it (n of them), creases across it at `at`
function cloth(ctx, r, color, seed, { folds = 4, at = [], hem = 0 } = {}) {
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); ctx.translate(r.x, r.y);
  ctx.fillStyle = color; ctx.fillRect(0, 0, r.w, r.h);
  for (let i = 0; i < folds; i++) {
    const x = (hash(i, seed, 1) + i) / folds * r.w, w = r.w / folds * (0.5 + 0.5 * hash(i, seed, 2)), g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.4, 'rgba(0,0,0,0.2)'); g.addColorStop(0.62, 'rgba(255,255,255,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, 0, w, r.h);
  }
  for (const [v, n] of at) for (let i = 0; i < n; i++) {                                   // creases where a joint bends it
    const y = (v + (hash(i, seed, 3) - 0.5) * 0.09) * r.h, x0 = hash(i, seed, 4) * r.w, l = r.w * (0.25 + 0.3 * hash(i, seed, 5));
    for (const [dy, c] of [[0, 'rgba(0,0,0,0.28)'], [1.6, 'rgba(255,255,255,0.09)']]) { ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, y + dy); ctx.quadraticCurveTo(x0 + l / 2, y + dy + (hash(i, seed, 6) - 0.5) * 7, x0 + l, y + dy + (hash(i, seed, 7) - 0.5) * 4); ctx.stroke(); }
  }
  if (hem) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, r.h - hem, r.w, 1.5); }
  ctx.restore();
}
// a plain shoe on the boot's region (its sole down both edges, the opening and the tongue where the boot has them)
function shoe(ctx, color) {
  const r = R.boot;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); ctx.translate(r.x, r.y);
  ctx.fillStyle = color; ctx.fillRect(0, 0, r.w, r.h);
  ctx.fillStyle = '#101012'; ctx.fillRect(0, 0, 15, r.h); ctx.fillRect(r.w - 15, 0, 15, r.h);                 // the sole: flat, dark, no studs
  ctx.fillStyle = '#8f8a80'; ctx.fillRect(15, 0, 5, r.h); ctx.fillRect(r.w - 20, 0, 5, r.h);                  // its welt
  ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.ellipse(64, 56, 25, 24, 0, 0, 7); ctx.fill();               // the opening (the hem covers it)
  ctx.fillStyle = tone(color, 1.25); ctx.fillRect(56, 76, 16, 40);                                            // the tongue, dark laces
  ctx.strokeStyle = tone(color, 0.5); ctx.lineWidth = 1.6; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(54, 82 + i * 6); ctx.lineTo(74, 82 + i * 6); ctx.stroke(); }
  ctx.strokeStyle = tone(color, 1.5); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(24, 126); ctx.quadraticCurveTo(64, 108, 104, 126); ctx.stroke();   // the toe cap's seam
  ctx.restore();
}

const sheets = new Map();
function clothes(bib, jacket, legs, shoes, skin, num) {
  const key = [bib, jacket, legs, shoes, skin, num].join();
  if (sheets.has(key)) return sheets.get(key);
  const c = canvas(ATLAS.w, ATLAS.h), ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ATLAS.w, ATLAS.h);
  const kit = { pattern: 'solid', shirt: jacket, alt: jacket, shorts: legs, socks: legs, band: legs, trim: jacket, trim2: jacket, number: jacket, cut: 0, hoops: 0 };
  paintKit(ctx, { kit, num: '', skin, boots: 0 });                              // (the jacket's folds, and the hands' skin)
  // trousers: waist to knee on each shorts region, knee to hem on the sock's; a belt's line; the jacket's sleeve
  const kneeAt = 1, seed = num * 13;
  cloth(ctx, R.shortsL, legs, seed + 1, { folds: 5, at: [[kneeAt - 0.06, 4], [0.36, 3]] }); cloth(ctx, R.shortsR, legs, seed + 2, { folds: 5, at: [[kneeAt - 0.06, 4], [0.36, 3]] });
  cloth(ctx, R.sock, legs, seed + 3, { folds: 4, at: [[0.07, 4], [0.86, 5]], hem: 5 });
  cloth(ctx, R.pelvis, legs, seed + 4, { folds: 3 });
  for (const r of [R.shortsL, R.shortsR]) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(r.x, r.y, r.w, 5); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(r.x, r.y + 5, r.w, 1.5); }
  cloth(ctx, R.sleeve, jacket, seed + 5, { folds: 3, at: [[0.5, 5], [0.9, 3]] });
  ctx.fillStyle = tone(jacket, 0.6); ctx.fillRect(R.sleeve.x, R.sleeve.y + R.sleeve.h - 7, R.sleeve.w, 7);    // the cuff
  shoe(ctx, shoes);
  // the tabard: a panel front and back from the shoulders to the hips, straps over the shoulders, open sides
  const row = y => (SPAN.shirt[0] - y) / (SPAN.shirt[0] - SPAN.shirt[1]) * R.shirt.h, top = row(1.46), hem = row(1.03);
  ctx.save(); ctx.beginPath(); ctx.rect(R.shirt.x, R.shirt.y, R.shirt.w, R.shirt.h); ctx.clip();
  // the chest badge under it is painted out first
  ctx.fillStyle = jacket; ctx.fillRect(128 - 80, row(1.5), 160, hem - row(1.5));
  for (const cx of [128, 384]) {
    ctx.globalAlpha = 0.93; ctx.fillStyle = bib;
    ctx.beginPath(); ctx.moveTo(cx - 66, top + 26); ctx.lineTo(cx - 60, top - 12); ctx.lineTo(cx - 34, top - 22); ctx.quadraticCurveTo(cx, top + 16, cx + 34, top - 22); ctx.lineTo(cx + 60, top - 12); ctx.lineTo(cx + 66, top + 26); ctx.lineTo(cx + 68, hem); ctx.lineTo(cx - 68, hem); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(cx - 66, hem - 26, 132, 7);                  // a reflective band
    // soft folds, so it isn't a flat sticker
    for (let i = 0; i < 5; i++) { const g = ctx.createLinearGradient(cx - 60 + i * 26, 0, cx - 44 + i * 26, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.13)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(cx - 60 + i * 26, top + 30, 16, hem - top - 34); }
    ctx.fillStyle = '#14161a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (cx > 256) { ctx.font = font(38, 900); ctx.fillText('PHOTO', cx, top + 62); ctx.font = font(30, 900); ctx.fillText(String(num), cx, top + 104); }
    else { ctx.font = font(26, 900); ctx.fillText(String(num), cx + 34, top + 52); ctx.font = font(13, 900); ctx.fillText('PHOTO', cx - 30, top + 50); }
  }
  ctx.restore();
  const m = new THREE.MeshPhongMaterial({ map: smoothTex(c), vertexColors: true, specular: 0x1c1c1c, shininess: 8, side: THREE.DoubleSide });
  sheets.set(key, m);
  return m;
}

// One photographer: { root, mesh, bone }. i picks his tabard, clothes, face and hair; cap: he wears one (so: cropped hair).
export function buildPressman(i, cap = false) {
  const style = cap ? 1 : [0, 2, 0, 4, 2, 0, 3][i % 7];
  const skinI = [0, 3, 1, 2, 4, 0, 1][i % 7];
  const mats = [clothes(BIBS[i % BIBS.length], CLOTH[i % CLOTH.length], LEGS[(i * 3 + 1) % LEGS.length], SHOES[i % SHOES.length], hex(SKINS[skinI % SKINS.length]).map((v, k) => v * [0.95, 0.9, 0.87][k]), 11 + i * 7), headSheet({ look: i * 3 + 2, style, skinI, hairI: i * 2 + 1 })];
  const { bones, by } = buildSkeleton(), geo = figureGeometry(style, false, PRESS_DRESS);
  if (!geo.attributes.aLoose) geo.setAttribute('aLoose', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
  const mesh = new THREE.SkinnedMesh(geo, mats);
  mesh.add(bones[0]); mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones)); mesh.frustumCulled = false;
  const root = new THREE.Group(); root.add(mesh);
  return { root, mesh, bone: by, tris: geo.index.count / 3 };
}

// Coloured boxes and tubes merged into one geometry (positions, normals, vertex colours).
function parts(list) {
  const P = [], N = [], C = [], I = [], col = new THREE.Color();
  for (const [g, c, m] of list) {
    g.applyMatrix4(m); const n0 = P.length / 3, p = g.attributes.position, nn = g.attributes.normal; col.set(c);
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(nn.getX(i), nn.getY(i), nn.getZ(i)); C.push(col.r, col.g, col.b); }
    for (let i = 0; i < g.index.count; i++) I.push(n0 + g.index.getX(i));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  return g;
}
const at = (x, y, z, rx = 0) => new THREE.Matrix4().makeRotationX(rx).setPosition(x, y, z);

// The camera, in its own frame: the eyepiece at the origin looking along +z, +y up. A body with a grip and a prism
// hump, a long pale lens with a dark hood, a flash on top. HOLD: where the hands go (right on the grip, left under the lens).
export const CAMERA = { grip: [-0.082, -0.035, 0.05], under: [0.0, -0.062, 0.2], flash: [0, 0.135, 0.075], lens: [0, -0.01, 0.34] };
export function cameraGeometry() {
  const tube = (r0, r1, len) => new THREE.CylinderGeometry(r1, r0, len, 12, 1);
  return parts([
    [new THREE.BoxGeometry(0.15, 0.1, 0.065), '#1b1c1f', at(0, -0.015, 0.04)],
    [new THREE.BoxGeometry(0.036, 0.105, 0.085), '#141518', at(-0.078, -0.016, 0.05)],                 // the grip
    [new THREE.BoxGeometry(0.06, 0.035, 0.06), '#1b1c1f', at(0, 0.045, 0.04)],                           // the prism
    [tube(0.04, 0.043, 0.05), '#232428', at(0, -0.012, 0.098, Math.PI / 2)],
    [tube(0.043, 0.05, 0.15), '#d8d6cf', at(0, -0.012, 0.198, Math.PI / 2)],                              // the long barrel, pale
    [tube(0.051, 0.051, 0.02), '#2a2b2f', at(0, -0.012, 0.19, Math.PI / 2)],                              // a rubber ring
    [tube(0.052, 0.058, 0.075), '#17181b', at(0, -0.012, 0.31, Math.PI / 2)],                             // the hood
    [new THREE.CylinderGeometry(0.046, 0.046, 0.004, 12), '#39507a', at(0, -0.012, 0.275, Math.PI / 2)],  // glass
    [new THREE.BoxGeometry(0.03, 0.055, 0.03), '#1b1c1f', at(0, 0.085, 0.045)],                           // the flash's neck
    [new THREE.BoxGeometry(0.075, 0.045, 0.08), '#1b1c1f', at(0, 0.13, 0.05)],
    [new THREE.BoxGeometry(0.066, 0.036, 0.004), '#f4f4ec', at(0, 0.13, 0.092)],                          // and its window
  ]);
}
// A cap, in the head bone's frame: a crown over the skull and a peak.
export function capGeometry() {
  const crown = new THREE.SphereGeometry(0.108, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); crown.scale(0.98, 0.9, 1.16);
  const peak = new THREE.CylinderGeometry(0.1, 0.1, 0.008, 12, 1, false, -Math.PI / 2, Math.PI); peak.scale(0.95, 1, 1.05);
  return parts([[crown, '#ffffff', at(0, 0.165, 0.012)], [peak, '#e8e8e8', at(0, 0.172, 0.085, 0.16)]]);
}
