// Press photographers as people (the trophy presentation, game/presscast.js): the '04 body dressed for the job.
// The kit sheet is painted as dark working clothes: jacket, trousers and shoes all one dark cloth (the body's
// "skin" on that sheet too, so arms are sleeves, knees are trouser legs and hands are gloves), and over it a
// hi-vis tabard in one of our own colours with PHOTO across the back and a number on the chest. Our words only:
// no agency's name or mark. Plus what they carry: a camera with a long lens and a flash, and a cap for some.
import * as THREE from 'three';
import { canvas, hex, smoothTex } from './paint.js';
import { paintKit, ATLAS, R, SPAN } from './kit.js';
import { headSheet } from './player.js';
import { figureGeometry } from './figure.js';
import { buildSkeleton } from '../body.js';
import { font } from './ui.js';

export const BIBS = ['#c9e23a', '#f28a1e', '#3fc4c0', '#e9e6dc'];
const CLOTH = ['#23272f', '#2b2a28', '#1f2a3a', '#33302c'];

const sheets = new Map();
function clothes(bib, cloth, num) {
  const key = bib + cloth + num;
  if (sheets.has(key)) return sheets.get(key);
  const c = canvas(ATLAS.w, ATLAS.h), ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ATLAS.w, ATLAS.h);
  const kit = { pattern: 'solid', shirt: cloth, alt: cloth, shorts: cloth, socks: cloth, band: cloth, trim: cloth, trim2: cloth, number: cloth, cut: 0, hoops: 0 };
  paintKit(ctx, { kit, num: '', skin: hex(cloth).map(v => v * 0.92), boots: 0 });
  // the tabard: a panel front and back from the shoulders to the hips, straps over the shoulders, open sides
  const row = y => (SPAN.shirt[0] - y) / (SPAN.shirt[0] - SPAN.shirt[1]) * R.shirt.h, top = row(1.46), hem = row(1.03);
  ctx.save(); ctx.beginPath(); ctx.rect(R.shirt.x, R.shirt.y, R.shirt.w, R.shirt.h); ctx.clip();
  // the chest badge under it is painted out first
  ctx.fillStyle = cloth; ctx.fillRect(128 - 80, row(1.5), 160, hem - row(1.5));
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
  // (and the badge on the shorts)
  for (const r of [R.shortsL, R.shortsR]) { const y = r.y + (SPAN.shorts[0] - 0.675) / (SPAN.shorts[0] - SPAN.shorts[1]) * r.h; ctx.fillStyle = cloth; ctx.fillRect(r.x + r.w * 0.5 - 4, y - 20, 40, 40); }
  const m = new THREE.MeshPhongMaterial({ map: smoothTex(c), vertexColors: true, specular: 0x1c1c1c, shininess: 8, side: THREE.DoubleSide });
  sheets.set(key, m);
  return m;
}

// One photographer: { root, mesh, bone }. i picks his tabard, clothes, face and hair; cap: he wears one (so: cropped hair).
export function buildPressman(i, cap = false) {
  const style = cap ? 1 : [0, 2, 0, 4, 2, 0, 3][i % 7];
  const mats = [clothes(BIBS[i % BIBS.length], CLOTH[i % CLOTH.length], 11 + i * 7), headSheet({ look: i * 3 + 2, style, skinI: [0, 3, 1, 2, 4, 0, 1][i % 7], hairI: i * 2 + 1 })];
  const { bones, by } = buildSkeleton(), geo = figureGeometry(style, false);
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
