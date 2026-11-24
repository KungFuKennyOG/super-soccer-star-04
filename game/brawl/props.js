// The things the favours bring on (rules/brawl/chaos.js), modelled and painted to sit beside the '04 players:
// rounded bodies, parts that are their own pieces (doors, handles, cushions, wheels), surfaces painted in
// code (wood grain, cloth, a lit vending window), a driver who is a real player body sat at the wheel.
// Everything is invented: no real makes or marks.
import * as THREE from 'three';
import { buildPlayer2 } from '../ps2/player.js';
import { smoothTex } from '../ps2/paint.js';

// ---- helpers
// a box with rounded edges and corners: [w, h, d] in metres, r the rounding. UVs are in metres.
export function rbox(w, h, d, r, material) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const x = w / 2 - r, y = h / 2 - r, c = r * 0.6, s = new THREE.Shape();
  s.moveTo(-x + c, -y); s.lineTo(x - c, -y); s.quadraticCurveTo(x, -y, x, -y + c); s.lineTo(x, y - c); s.quadraticCurveTo(x, y, x - c, y);
  s.lineTo(-x + c, y); s.quadraticCurveTo(-x, y, -x, y - c); s.lineTo(-x, -y + c); s.quadraticCurveTo(-x, -y, -x + c, -y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 4, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  // smooth normals: each point's normal runs from the nearest point of the box inside the rounding
  const P = g.attributes.position, N = g.attributes.normal, z = d / 2 - r, cl = (v, m) => Math.max(-m, Math.min(m, v));
  for (let i = 0; i < P.count; i++) { const nx = P.getX(i) - cl(P.getX(i), x), ny = P.getY(i) - cl(P.getY(i), y), nz = P.getZ(i) - cl(P.getZ(i), z), l = Math.hypot(nx, ny, nz); if (l > 1e-5) N.setXYZ(i, nx / l, ny / l, nz / l); }
  return new THREE.Mesh(g, material);
}
const phong = (color, shininess = 20, extra = {}) => new THREE.MeshPhongMaterial({ color, shininess, specular: new THREE.Color(shininess > 40 ? '#555555' : '#1c1c1c'), ...extra });
const at = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; };
const cyl = (r, len, material, seg = 14) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), material);
const cache = {};
// a painted sheet, made once: fn(ctx, w, h)
function sheet(key, w, h, fn, repeat) {
  if (!cache[key]) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); cache[key] = smoothTex(c, repeat ? { repeat } : {}); }
  return cache[key];
}
// a painted panel laid just proud of a face
function decal(w, h, tex, shininess = 25, glow = 0) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhongMaterial({ map: tex, shininess, ...(glow ? { emissive: new THREE.Color(glow, glow, glow), emissiveMap: tex } : {}), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
}
const rnd = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
// dirt and shading toward the edges of a panel, so nothing is a flat colour
function wear(g, w, h, a = 0.35) {
  const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,255,255,0.10)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a})`);
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  const e = g.createLinearGradient(0, 0, w, 0); e.addColorStop(0, `rgba(0,0,0,${a * 0.6})`); e.addColorStop(0.12, 'rgba(0,0,0,0)'); e.addColorStop(0.88, 'rgba(0,0,0,0)'); e.addColorStop(1, `rgba(0,0,0,${a * 0.6})`);
  g.fillStyle = e; g.fillRect(0, 0, w, h);
}
function speckle(g, w, h, n, seed, lo = 0.05) { const r = rnd(seed); for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${lo})` : `rgba(255,255,255,${lo})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } }
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

// ---- painted surfaces
const woodTex = (base, dark) => sheet('wood' + base, 256, 256, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const r = rnd(7);
  for (let i = 0; i < 150; i++) { const x = r() * w, a = 0.05 + r() * 0.16, wob = r() * 6; g.strokeStyle = r() < 0.7 ? dark : '#c79a66'; g.globalAlpha = a; g.lineWidth = 0.6 + r() * 2.2; g.beginPath(); for (let y = 0; y <= h; y += 16) g.lineTo(x + Math.sin(y * 0.03 + i) * wob, y); g.stroke(); }
  g.globalAlpha = 1;
}, [1.4, 0.7]);
const clothTex = base => sheet('cloth' + base, 128, 128, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < w; i += 2) { g.fillStyle = `rgba(0,0,0,${i % 4 ? 0.07 : 0.02})`; g.fillRect(i, 0, 1, h); g.fillStyle = `rgba(255,255,255,${i % 4 ? 0.02 : 0.05})`; g.fillRect(0, i, w, 1); }
  speckle(g, w, h, 900, 3, 0.07);
}, [5, 5]);
const grainTex = (key, base, n = 500) => sheet('grain' + key + base, 128, 128, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); speckle(g, w, h, n, 11, 0.035); }, [2, 2]);

// ---- the furniture
function fridge(g) {
  const white = phong('#ffffff', 70, { map: grainTex('f', '#eceef0', 200) });
  g.add(at(rbox(0.8, 1.74, 0.7, 0.05, white), 0, 0.93, -0.025), at(rbox(0.74, 0.08, 0.6, 0.02, phong('#2a2d32', 10)), 0, 0.04, -0.03));
  // freezer door over the fridge door, a dark seam between them, long chrome handles
  const chrome = phong('#c9ced6', 110);
  for (const [y, h] of [[1.5, 0.56], [0.63, 1.12]]) { g.add(at(rbox(0.78, h, 0.06, 0.028, white), 0, y, 0.345)); g.add(at(cyl(0.016, h * 0.62, chrome), -0.3, y, 0.4)); for (const e of [-1, 1]) g.add(at(cyl(0.011, 0.04, chrome, 8), -0.3, y + e * h * 0.27, 0.385, Math.PI / 2)); }
  g.add(at(decal(0.6, 0.9, sheet('fridgeDoor', 192, 288, (c, w, h) => {
    c.fillStyle = '#eceef0'; c.fillRect(0, 0, w, h); speckle(c, w, h, 300, 5, 0.03); wear(c, w, h, 0.12);
    // what's stuck to it: a shopping list, a child's drawing, a few magnets
    c.save(); c.translate(70, 60); c.rotate(-0.05); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(3, 3, 62, 80); c.fillStyle = '#fbf6dc'; c.fillRect(0, 0, 62, 80); c.fillStyle = '#56607a'; for (let i = 0; i < 6; i++) c.fillRect(8, 14 + i * 10, 22 + ((i * 37) % 26), 2); c.fillStyle = '#c8322c'; c.beginPath(); c.arc(31, 4, 5, 0, 7); c.fill(); c.restore();
    c.save(); c.translate(112, 170); c.rotate(0.08); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(3, 3, 60, 48); c.fillStyle = '#ffffff'; c.fillRect(0, 0, 60, 48); c.fillStyle = '#4c9a3c'; c.fillRect(0, 36, 60, 12); c.fillStyle = '#f3c318'; c.beginPath(); c.arc(46, 12, 7, 0, 7); c.fill(); c.strokeStyle = '#2c4fa0'; c.lineWidth = 2; c.strokeRect(14, 20, 16, 16); c.fillStyle = '#2f6fcf'; c.beginPath(); c.arc(30, 2, 5, 0, 7); c.fill(); c.restore();
    for (const [x, y, col] of [[30, 150, '#e0862a'], [150, 110, '#7a3fb0'], [40, 230, '#2a9a8a']]) { c.fillStyle = 'rgba(0,0,0,0.2)'; rr(c, x + 2, y + 2, 20, 14, 4); c.fill(); c.fillStyle = col; rr(c, x, y, 20, 14, 4); c.fill(); }
  }), 70), 0.04, 0.63, 0.376));
  g.add(at(decal(0.7, 1.5, sheet('fridgeBack', 128, 256, (c, w, h) => { c.fillStyle = '#1d2024'; c.fillRect(0, 0, w, h); c.strokeStyle = '#5b6068'; c.lineWidth = 2; for (let y = 30; y < h - 60; y += 9) { c.beginPath(); c.moveTo(14, y); c.lineTo(w - 14, y); c.stroke(); } c.fillStyle = '#34383e'; rr(c, 20, h - 52, w - 40, 40, 6); c.fill(); wear(c, w, h, 0.3); }), 8), 0, 0.9, -0.377, 0, Math.PI));
  return { h: 1.8, d: 0.75 };
}
function sofa(g) {
  const cloth = phong('#ffffff', 5, { map: clothTex('#74503a') }), dark = phong('#ffffff', 5, { map: clothTex('#60402d') }), wood = phong('#3a2616', 30);
  g.add(at(rbox(2.0, 0.26, 0.9, 0.06, dark), 0, 0.25, 0), at(rbox(1.7, 0.62, 0.24, 0.1, dark), 0, 0.62, -0.34, -0.1));
  for (const s of [-1, 1]) {
    g.add(at(rbox(0.8, 0.2, 0.68, 0.085, cloth), s * 0.41, 0.46, 0.08), at(rbox(0.78, 0.44, 0.2, 0.09, cloth), s * 0.41, 0.74, -0.2, -0.2));
    g.add(at(rbox(0.26, 0.52, 0.95, 0.11, cloth), s * 0.94, 0.42, 0));
    for (const z of [-0.36, 0.36]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.12, 10), wood), s * 0.88, 0.06, z));
  }
  g.add(at(rbox(0.4, 0.4, 0.13, 0.06, phong('#ffffff', 5, { map: clothTex('#c79a2e') })), -0.6, 0.72, 0.02, -0.5, 0.3, 0.2));
  return { h: 0.95, d: 0.95, upright: true };
}
function vending(g) {
  const red = phong('#ffffff', 45, { map: grainTex('v', '#c62a22', 300) });
  g.add(at(rbox(1.0, 1.82, 0.85, 0.045, red), 0, 0.99, 0), at(rbox(0.94, 0.08, 0.78, 0.02, phong('#17191c', 10)), 0, 0.04, 0));
  g.add(at(decal(0.92, 1.72, sheet('vendFront', 256, 480, (c, w, h) => {
    c.fillStyle = '#8f1a15'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f4f1e6'; rr(c, 10, 10, w - 20, 54, 8); c.fill(); c.fillStyle = '#b3241d'; c.font = 'italic 900 34px Arial'; c.textAlign = 'center'; c.fillText('KENNY COLA', w / 2, 49);
    // the window: shelves of cans and bags, lit from the top, a streak of glare across the glass
    c.fillStyle = '#0c1118'; rr(c, 12, 76, 164, 300, 6); c.fill();
    const lit = c.createLinearGradient(0, 80, 0, 372); lit.addColorStop(0, '#5a6c7c'); lit.addColorStop(1, '#1c242d'); c.fillStyle = lit; c.fillRect(18, 82, 152, 288);
    const r = rnd(5), cols = ['#d8322a', '#2f6fcf', '#f3c318', '#3aa657', '#e87a1f', '#f4f1e6', '#7a3fb0'];
    for (let row = 0; row < 5; row++) {
      const y = 92 + row * 56;
      for (let i = 0; i < 6; i++) { const x = 23 + i * 24.5, col = cols[Math.floor(r() * cols.length)]; c.fillStyle = col; if (row < 3) { rr(c, x, y + 4, 19, 38, 4); c.fill(); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + 3, y + 7, 3, 32); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + 20, 19, 7); } else { rr(c, x, y + 8, 20, 34, 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(x + 10, y + 25, 6, 0, 7); c.fill(); } }
      c.fillStyle = '#9aa3ad'; c.fillRect(18, y + 44, 152, 4); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(18, y + 48, 152, 5);
    }
    c.save(); c.beginPath(); c.rect(18, 82, 152, 288); c.clip(); c.fillStyle = 'rgba(255,255,255,0.10)'; c.beginPath(); c.moveTo(60, 82); c.lineTo(110, 82); c.lineTo(40, 370); c.lineTo(-10, 370); c.fill(); c.restore();
    // the paying side: a little screen, keys, a coin slot, where the notes go
    c.fillStyle = '#17191c'; rr(c, 186, 76, 58, 300, 6); c.fill(); c.fillStyle = '#10301a'; c.fillRect(193, 88, 44, 22); c.fillStyle = '#5cf07c'; c.font = '700 13px monospace'; c.fillText('1.50', 215, 104);
    for (let i = 0; i < 12; i++) { c.fillStyle = '#c9ced6'; rr(c, 194 + (i % 3) * 15, 124 + Math.floor(i / 3) * 15, 11, 11, 2); c.fill(); }
    c.fillStyle = '#c9ced6'; rr(c, 200, 200, 30, 44, 4); c.fill(); c.fillStyle = '#0c0d0f'; c.fillRect(213, 208, 4, 26); c.fillStyle = '#c9ced6'; rr(c, 196, 262, 38, 26, 3); c.fill(); c.fillStyle = '#0c0d0f'; c.fillRect(201, 273, 28, 4);
    // the flap at the bottom
    c.fillStyle = '#0c0d0f'; rr(c, 30, 396, 196, 56, 8); c.fill(); c.fillStyle = '#2a2d32'; rr(c, 38, 402, 180, 40, 5); c.fill(); c.fillStyle = '#8b9199'; c.font = '700 15px Arial'; c.fillText('PUSH', w / 2, 428);
    wear(c, w, h, 0.25);
  }), 60, 0.55), 0, 0.99, 0.427));
  const side = sheet('vendSide', 128, 256, (c, w, h) => { c.fillStyle = '#b3241d'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f1e6'; c.fillRect(0, 150, w, 44); c.fillStyle = '#f3c318'; c.fillRect(0, 198, w, 8); c.fillStyle = '#b3241d'; c.font = 'italic 900 22px Arial'; c.textAlign = 'center'; c.fillText('KENNY', 64, 180); c.fillStyle = '#f4f1e6'; for (const [x, y, r] of [[30, 60, 9], [58, 96, 6], [92, 52, 12], [80, 118, 4], [40, 112, 5]]) { c.globalAlpha = 0.5; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } c.globalAlpha = 1; speckle(c, w, h, 300, 9, 0.04); wear(c, w, h, 0.3); });
  for (const s of [-1, 1]) g.add(at(decal(0.76, 1.7, side, 40), s * 0.502, 0.99, 0, 0, s * Math.PI / 2));
  return { h: 1.9, d: 0.85 };
}
function loo(g) {
  const blue = phong('#ffffff', 28, { map: grainTex('l', '#2b5cae', 300) }), grey = phong('#dfe3e6', 30);
  g.add(at(rbox(1.2, 2.06, 1.2, 0.05, blue), 0, 1.15, 0), at(rbox(1.3, 0.12, 1.3, 0.04, phong('#30343a', 8)), 0, 0.06, 0));
  // a shallow domed roof with a lip, and the vent pipe up the back corner
  g.add(at(rbox(1.32, 0.1, 1.32, 0.045, grey), 0, 2.2, 0));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 8, 0, 6.2832, 0, 1.0), grey); dome.scale.set(1, 0.3, 1); g.add(at(dome, 0, 2.11, 0));
  g.add(at(cyl(0.05, 2.5, phong('#22262b', 20), 12), -0.47, 1.3, -0.5), at(cyl(0.07, 0.06, phong('#22262b', 20), 12), -0.47, 2.56, -0.5));
  const ribs = (c, w, h) => { c.fillStyle = '#2b5cae'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 22) { const v = c.createLinearGradient(x, 0, x + 22, 0); v.addColorStop(0, 'rgba(0,0,0,0.28)'); v.addColorStop(0.25, 'rgba(255,255,255,0.14)'); v.addColorStop(0.6, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.2)'); c.fillStyle = v; c.fillRect(x, 0, 22, h); } };
  const vents = (c, w, y) => { c.fillStyle = '#0d1a33'; for (let i = 0; i < 4; i++) { rr(c, 40, y + i * 11, w - 80, 5, 2); c.fill(); } };
  const wall = sheet('looWall', 256, 440, (c, w, h) => { ribs(c, w, h); vents(c, w, 24); speckle(c, w, h, 500, 13, 0.05); wear(c, w, h, 0.4); });
  for (const [x, z, ry] of [[-0.602, 0, -Math.PI / 2], [0.602, 0, Math.PI / 2], [0, -0.602, Math.PI]]) g.add(at(decal(1.1, 1.96, wall), x, 1.15, z, 0, ry));
  g.add(at(decal(1.1, 1.96, sheet('looDoor', 256, 440, (c, w, h) => {
    ribs(c, w, h); vents(c, w, 24);
    // the door: a pale frame, hinges, the latch with its red "engaged" half, a sign
    c.strokeStyle = '#d9dee2'; c.lineWidth = 7; rr(c, 34, 74, w - 68, h - 96, 8); c.stroke(); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2; rr(c, 39, 79, w - 78, h - 106, 6); c.stroke();
    c.fillStyle = '#8b9199'; for (const y of [110, 230, 350]) { rr(c, 26, y, 16, 34, 3); c.fill(); }
    c.fillStyle = '#e9ecef'; rr(c, 176, 214, 36, 52, 6); c.fill(); c.fillStyle = '#c8322c'; c.beginPath(); c.arc(194, 232, 10, 0, 7); c.fill(); c.fillStyle = '#17191c'; rr(c, 186, 248, 16, 10, 2); c.fill();
    c.fillStyle = '#e9ecef'; rr(c, 96, 104, 64, 64, 8); c.fill(); c.fillStyle = '#2b5cae'; c.beginPath(); c.arc(128, 122, 8, 0, 7); c.fill(); rr(c, 118, 132, 20, 30, 5); c.fill();
    speckle(c, w, h, 500, 17, 0.05); wear(c, w, h, 0.4);
  })), 0, 1.15, 0.602));
  g.add(at(rbox(0.05, 0.14, 0.05, 0.015, phong('#e9ecef', 60)), 0.33, 1.1, 0.63));
  return { h: 2.3, d: 1.2 };
}
function wardrobe(g) {
  const wood = phong('#ffffff', 26, { map: woodTex('#7b5a39', '#3d2814') }), dark = phong('#ffffff', 20, { map: woodTex('#5e4329', '#2c1b0d') }), brass = phong('#c8a04a', 100);
  g.add(at(rbox(1.2, 1.82, 0.58, 0.02, wood), 0, 1.0, -0.01), at(rbox(1.28, 0.09, 0.66, 0.03, dark), 0, 1.955, 0), at(rbox(1.24, 0.1, 0.6, 0.015, dark), 0, 0.05, 0));
  const door = sheet('wardDoor', 160, 512, (c, w, h) => {
    c.fillStyle = '#7b5a39'; c.fillRect(0, 0, w, h);
    const r = rnd(21); for (let i = 0; i < 90; i++) { const x = r() * w, wob = r() * 5; c.strokeStyle = r() < 0.7 ? '#3d2814' : '#c79a66'; c.globalAlpha = 0.06 + r() * 0.16; c.lineWidth = 0.6 + r() * 2; c.beginPath(); for (let y = 0; y <= h; y += 16) c.lineTo(x + Math.sin(y * 0.02 + i) * wob, y); c.stroke(); } c.globalAlpha = 1;
    // two sunk panels: dark along the top and left edge, light along the bottom and right
    for (const [y, hh] of [[26, 150], [200, 286]]) { c.fillStyle = 'rgba(0,0,0,0.12)'; rr(c, 22, y, w - 44, hh, 5); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(22, y + hh); c.lineTo(22, y); c.lineTo(w - 22, y); c.stroke(); c.strokeStyle = 'rgba(255,225,180,0.35)'; c.beginPath(); c.moveTo(w - 22, y); c.lineTo(w - 22, y + hh); c.lineTo(22, y + hh); c.stroke(); }
    wear(c, w, h, 0.3);
  });
  for (const s of [-1, 1]) {
    g.add(at(rbox(0.575, 1.74, 0.035, 0.012, wood), s * 0.295, 1.0, 0.295), at(decal(0.55, 1.71, door, 30), s * 0.295, 1.0, 0.3135));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), brass), s * 0.05, 1.0, 0.335), at(cyl(0.01, 0.03, brass, 8), s * 0.05, 1.0, 0.318, Math.PI / 2));
  }
  return { h: 2.0, d: 0.6 };
}
const THINGS = { fridge, sofa, vending, loo, wardrobe };

// One of the things that gets thrown on, its middle at the origin. userData: h (height), rest { y, rx } how it
// lies once it has landed (on its back with its face up; the sofa on its feet), stain(k) reddens it.
export function buildThing(kind) {
  const g = new THREE.Group(), inner = new THREE.Group(), T = (THINGS[kind] || fridge)(inner);
  inner.position.y = -T.h / 2; g.add(inner);
  g.userData.h = T.h;
  g.userData.rest = T.upright ? { y: T.h / 2 + 0.03, rx: 0.07 } : { y: T.d / 2 + 0.07, rx: -Math.PI / 2 + 0.1 };
  const blood = new THREE.Color('#6d0c0c');
  g.userData.stain = k => g.traverse(o => { if (o.material && o.material.color) { o.material = o.material.clone(); o.material.color.lerp(blood, k); } });
  return g;
}

// ---- the medical buggy: forward is +x. userData: light (the flashing lamp), wheels (spin them about z).
export function buildBuggy() {
  const g = new THREE.Group(), white = phong('#f2f4f5', 80), black = phong('#1b1d20', 12), vinyl = phong('#262a30', 45), chrome = phong('#c9ced6', 110);
  // the tub, cut from its side view: a rounded nose, the cowl, the footwell, the deck behind the seat
  const s = new THREE.Shape();
  s.moveTo(-1.55, 0.4); s.lineTo(1.1, 0.4); s.quadraticCurveTo(1.38, 0.42, 1.4, 0.66); s.quadraticCurveTo(1.4, 0.98, 1.05, 1.06); s.lineTo(0.9, 1.06); s.quadraticCurveTo(0.8, 0.9, 0.78, 0.62);
  s.lineTo(0.0, 0.62); s.lineTo(-0.02, 0.9); s.lineTo(-1.5, 0.9); s.quadraticCurveTo(-1.58, 0.88, -1.58, 0.8); s.lineTo(-1.55, 0.4);
  const livery = sheet('buggySide', 512, 128, (c, w, h) => {
    c.fillStyle = '#f2f4f5'; c.fillRect(0, 0, w, h);
    // a band of yellow and green blocks along the side, and a green cross on the nose
    for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#1f9a52' : '#e8e22a'; c.fillRect(i * 32, 62, 32, 26); }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 88, w, 3); c.fillStyle = '#1f9a52'; c.fillRect(452, 22, 12, 34); c.fillRect(441, 33, 34, 12);
    speckle(c, w, h, 500, 4, 0.03); const d = c.createLinearGradient(0, 0, 0, h); d.addColorStop(0, 'rgba(0,0,0,0)'); d.addColorStop(0.75, 'rgba(0,0,0,0)'); d.addColorStop(1, 'rgba(60,45,20,0.45)'); c.fillStyle = d; c.fillRect(0, 0, w, h);
  });
  livery.wrapS = livery.wrapT = THREE.ClampToEdgeWrapping; livery.repeat.set(1 / 3, -1 / 0.75); livery.offset.set(1.58 / 3, 1 + 0.36 / 0.75);
  const tub = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.94, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3, curveSegments: 24 }), [phong('#ffffff', 80, { map: livery }), white]);
  tub.position.z = -0.47; g.add(tub);
  g.add(at(rbox(0.1, 0.14, 1.12, 0.04, black), 1.42, 0.5, 0), at(rbox(0.1, 0.14, 1.12, 0.04, black), -1.6, 0.5, 0));
  for (const z of [-0.33, 0.33]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), new THREE.MeshPhongMaterial({ color: '#fff6c8', emissive: '#bfae6a', shininess: 120 })); l.scale.x = 0.45; g.add(at(l, 1.38, 0.8, z)); }
  // the bench and its back, and the stretcher on the deck with a kit bag
  g.add(at(rbox(0.52, 0.13, 0.96, 0.05, vinyl), -0.3, 0.96, 0), at(rbox(0.13, 0.5, 0.96, 0.05, vinyl), -0.6, 1.26, 0, 0, 0, 0.14));
  g.add(at(rbox(0.82, 0.07, 0.56, 0.03, phong('#e8eaec', 30)), -1.1, 0.95, 0.12), at(rbox(0.2, 0.09, 0.4, 0.04, phong('#c9d2dc', 20)), -0.85, 1.0, 0.12));
  for (const z of [-0.18, 0.42]) g.add(at(cyl(0.018, 0.95, phong('#e8742a', 50), 8), -1.1, 0.93, z, 0, 0, Math.PI / 2));
  g.add(at(rbox(0.34, 0.24, 0.24, 0.05, phong('#1f9a52', 20)), -1.2, 1.03, -0.3), at(decal(0.2, 0.16, sheet('kitBag', 64, 48, (c, w, h) => { c.fillStyle = '#1f9a52'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2f4f5'; c.fillRect(26, 8, 12, 32); c.fillRect(16, 18, 32, 12); })), -1.2, 1.03, -0.42, 0, Math.PI));
  // roof on four posts (the front pair raked back), a windscreen, the lamp bar
  g.add(at(rbox(2.0, 0.07, 1.14, 0.03, white), -0.3, 2.02, 0));
  for (const z of [-0.5, 0.5]) { g.add(at(cyl(0.024, 1.03, black, 8), 0.82, 1.52, z, 0, 0, 0.37), at(cyl(0.024, 1.1, black, 8), -1.2, 1.45, z)); }
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.92), new THREE.MeshPhongMaterial({ color: '#bfe0ef', transparent: true, opacity: 0.22, shininess: 140, side: THREE.DoubleSide, depthWrite: false })), 0.84, 1.52, 0));
  g.children[g.children.length - 1].rotation.set(-0.37, Math.PI / 2, 0, 'YXZ');
  g.add(at(rbox(0.16, 0.05, 0.7, 0.02, black), -0.1, 2.08, 0));
  const light = at(rbox(0.14, 0.1, 0.62, 0.04, new THREE.MeshBasicMaterial({ color: '#ffb020' })), -0.1, 2.14, 0), off = at(rbox(0.13, 0.09, 0.6, 0.04, phong('#8a5a10', 90)), -0.1, 2.14, 0);
  g.add(off, light);
  // steering: a column out of the cowl to a wheel
  g.add(at(cyl(0.02, 0.42, black, 8), 0.74, 1.2, 0.2, 0, 0, 0.95), at(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 20), black), 0.57, 1.33, 0.2));
  g.children[g.children.length - 1].rotation.set(0, Math.PI / 2, 0.6, 'YXZ');
  // wheels: a fat tyre, a pale hub with its nuts; mudguards over them
  const wheels = [], tyre = phong('#141518', 6), hub = phong('#d5d9de', 70);
  for (const [x, z] of [[0.92, 0.6], [0.92, -0.6], [-1.02, 0.6], [-1.02, -0.6]]) {
    const wg = new THREE.Group(); wg.add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.115, 10, 22), tyre), at(cyl(0.17, 0.17, hub, 16), 0, 0, 0, Math.PI / 2));
    for (let i = 0; i < 5; i++) wg.add(at(cyl(0.018, 0.19, chrome, 6), Math.cos(i * 1.2566) * 0.09, Math.sin(i * 1.2566) * 0.09, 0, Math.PI / 2));
    g.add(at(wg, x, 0.355, z)); wheels.push(wg);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 6, 14, Math.PI), black); guard.scale.z = 4.2; g.add(at(guard, x, 0.36, z));
  }
  // the driver: a player body in hi-vis, sat at the wheel
  const d = buildPlayer2({ pattern: 'solid', shirt: '#d6ee2c', alt: '#d6ee2c', shorts: '#1c2533', socks: '#1c2533', band: '#1c2533', trim: '#9aa3ad', trim2: '#d6ee2c', number: '#d6ee2c' }, '', 5);
  d.root.remove(d.root.children[1]);
  const b = d.bone;
  for (const n of ['L', 'R']) { const k = n === 'L' ? 1 : -1; b['upperLeg' + n].rotation.x = -1.42; b['upperLeg' + n].rotation.z = k * 0.1; b['lowerLeg' + n].rotation.x = 1.25; b['upperArm' + n].rotation.x = -1.05; b['upperArm' + n].rotation.z = n === 'L' ? 0.32 : -0.32; b['foreArm' + n].rotation.x = -0.5; }
  b.spine.rotation.x = 0.1;
  g.add(at(d.root, -0.4, 0.07, 0.2, 0, Math.PI / 2));
  // its shadow on the grass
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.3), new THREE.MeshBasicMaterial({ map: sheet('soft', 64, 64, (c, w) => { const r = c.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(0.6, 'rgba(0,0,0,0.4)'); r.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = r; c.fillRect(0, 0, w, w); }), transparent: true, depthWrite: false }));
  sh.renderOrder = 4; g.add(at(sh, -0.1, 0.03, 0, -Math.PI / 2));
  g.userData.light = light; g.userData.wheels = wheels; g.userData.driver = d;
  return g;
}
