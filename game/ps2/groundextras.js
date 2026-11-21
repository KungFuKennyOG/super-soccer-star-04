// What makes one ground look like its city's real one (the recipe fields in game/grounds.js that only
// the '04 look reads): masts with cables holding the roof (masts), red girders over the roof between
// ramp towers (girders), concrete ribs round the outside carrying the roof (ribs), steel arches over
// the roof (arches: 'four' one over each stand, 'long' two along the sides), buildings filling a
// corner (cornerFill: 'block'), and what you see over low stands (skyline: houses, city, park).
import * as THREE from 'three';
import { region } from './groundtex.js';
import { strip } from './ground.js';
import { canvas, hash, smoothTex } from './paint.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const col = h => new THREE.Color(h).toArray();
// which corner meets each end of a stand (its local -x end, then +x)
export const END_CORNER = { end: ['endL', 'endR'], near: ['nearR', 'nearL'], left: ['nearL', 'endL'], right: ['endR', 'nearR'] };
const isCorner = id => id.length > 5;

// G, L: structure and lattice builders; run: the stand's run (ground.js); p: its profile; id: its name
export function extras(G, L, run, p, recipe, id) {
  const r = p.roof, yB = p.wallTop + 0.4, yF = r ? r.y + 0.6 : 0, roofAt = z => yB + (yF - yB) * (z - r.zBack) / (r.zFront - r.zBack);
  // masts behind the stand, cables down to the roof's front edge (Dortmund's yellow pylons, Turin, Munich's tent)
  if (recipe.masts && r && !isCorner(id)) {
    const n = recipe.masts.per || 2, c = col(recipe.masts.color || '#c8ccd2'), top = yF + (recipe.masts.rise || 14), zm = p.back - 3;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, a = run.pt(t, zm, 0), b = run.pt(t, zm, top), w = 0.9, along = V().subVectors(run.pt(t + 0.01, zm, 0), a).normalize().multiplyScalar(w), out = V().subVectors(run.pt(t, zm - 1, 0), a).normalize().multiplyScalar(w);
      for (const d of [along, out]) L.poly([V().subVectors(a, d), V().addVectors(a, d), V().addVectors(b, d).addScaledVector(d, -0.5), V().subVectors(b, d).addScaledVector(d, -0.5)], [[0, 0], [0, 1], [top / 2.4, 1], [top / 2.4, 0]], { reg: region('lattice'), color: c });
      for (const dt of [-0.12, 0.12]) {                               // two cables to the roof's front edge
        const e = run.pt(t + dt / Math.max(1, run.at(r.zFront) / 40), r.zFront, yF), s = V().subVectors(e, b), side = V().crossVectors(s, V(0, 1, 0)).normalize().multiplyScalar(0.06);
        G.quad(V().subVectors(b, side), V().addVectors(b, side), V().addVectors(e, side), V().subVectors(e, side), { reg: region('dark'), color: [0.6, 0.6, 0.62] });
      }
    }
  }
  // red girders over the roof, along it and across it every 12 m (Milan)
  if (recipe.girders && r) {
    const c = col(recipe.girders), zs = [r.zBack + 1, (r.zBack + r.zFront) / 2];
    for (const z of zs) strip(L, run, 0, 1, [z, roofAt(z)], [z, roofAt(z) + 3.2], { reg: region('lattice'), tile: [3.2, 3.2], color: c });
    const n = Math.max(2, Math.round(run.at(r.zFront) / 12));
    for (let k = 0; k <= n; k++) {
      const t = k / n, a = run.pt(t, r.zBack, yB), b = run.pt(t, r.zFront, yF), c2 = run.pt(t, r.zFront, yF + 1.6), d = run.pt(t, r.zBack, yB + 3.2);
      L.quad(a, b, c2, d, { reg: region('lattice'), uv: [0, 0, Math.abs(r.zFront - r.zBack) / 3, 1], color: c });
    }
  }
  // concrete ribs round the outside, rising over the back of the stand to carry the roof (Paris)
  if (recipe.ribs && r) {
    const n = Math.max(2, Math.round(run.at(p.back) / 5.5));
    for (let k = 0; k <= n; k++) {
      const t = k / n, P = (z, y) => run.pt(t, z, y);
      // a fin down the outside of the back wall, and its spine over the top of the roof to the front edge
      const fin = [P(p.back - 0.35, 0), P(p.back - 0.35, yB + 1.5), P(p.back - 3.5, yB - 2), P(p.back - 6, 0)];
      const spine = [P(r.zBack, yB + 0.05), P(r.zFront + 0.4, yF + 0.05), P(r.zFront + 0.4, yF + 1.1), P(r.zBack, yB + 1.6)];
      for (const pts of [fin, spine]) G.poly(pts, pts.map(q => [(q.x + q.z) / 4, q.y / 4]), { reg: region('concrete'), color: [0.9, 0.89, 0.86] });
    }
  }
  // steel arches: one over each stand's roof (Lisbon), or two long ones over the sides (Amsterdam)
  const arch = recipe.arches;
  if (arch && r && !isCorner(id) && (arch.kind === 'four' || id === 'left' || id === 'right')) {
    const long = arch.kind === 'long', z = long ? r.zFront - 1.5 : (r.zBack + r.zFront) / 2, y0 = long ? yF : roofAt(z), peak = long ? 26 : 16, t0 = long ? -0.9 : 0.02, t1 = long ? 1.9 : 0.98, n = 20, c = col(arch.color || '#d8dade');
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const u = k / n, t = t0 + (t1 - t0) * u, y = y0 - 6 + (peak + 6) * Math.sin(Math.PI * u), cur = [run.pt(t, z - 0.7, y), run.pt(t, z + 0.7, y), run.pt(t, z, y - (long ? 3 : 1.4))];
      if (prev) {
        if (long) L.quad(prev[0], cur[0], cur[2], prev[2], { reg: region('lattice'), uv: [0, 0, 1, 1], color: c });
        else { G.quad(prev[0], cur[0], cur[1], prev[1], { reg: region('paint'), color: c, face: V().copy(cur[0]).setY(cur[0].y + 10) }); G.quad(prev[1], cur[1], cur[2], prev[2], { reg: region('paint'), color: c.map(v => v * 0.8), face: V(0, 3, -15) }); G.quad(prev[0], cur[0], cur[2], prev[2], { reg: region('paint'), color: c.map(v => v * 0.7) }); }
      }
      prev = cur;
    }
  }
}

// A corner filled with a building (hotel, flats, offices) instead of seats: a glass front to the pitch.
export function cornerBlock(G, run, p) {
  const h = p.top + 2, zf = -2.5, zb = p.back;
  strip(G, run, 0, 1, [zf, 0], [zf, h], { reg: region('boxes'), tile: [4.5, 3.4], color: [0.95, 0.95, 0.92], glow: 0.3, face: 'pitch' });
  strip(G, run, 0, 1, [zf, h], [zb, h], { reg: region('roofTop'), tile: [6, 6], face: 'up' });
  strip(G, run, 0, 1, [zb, 0], [zb, h], { reg: region('cladding'), tile: [4, 6], face: 'out' });
}

// What shows over the stands: a ring of silhouettes 95 m out (alpha cut), lit a little at night.
export function skyline(SK, kind, plan) {
  const R = 95, cz = -15, n = 28, H = { houses: 14, city: 30, park: 22 }[kind] || 20;
  for (let k = 0; k < n; k++) {
    const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, A = V(Math.sin(a0) * R, 0, cz + Math.cos(a0) * R), B = V(Math.sin(a1) * R, 0, cz + Math.cos(a1) * R);
    SK.quad(A, B, V(B.x, H, B.z), V(A.x, H, A.z), { uv: [k / 3.5, 0, (k + 1) / 3.5, 1], glow: 0.1, face: V(0, H / 2, cz) });
  }
}
export function skylineTex(kind) {
  const c = canvas(1024, 256), x = c.getContext('2d');
  x.clearRect(0, 0, 1024, 256);
  const win = (px, py, w, h, lit) => { x.fillStyle = lit ? '#e8c878' : '#3a4250'; x.fillRect(px, py, w, h); };
  if (kind === 'houses') {
    // terraced streets: brick rows with slate roofs and chimneys, a lit window here and there
    for (let i = 0; i < 1024; i += 64) {
      const top = 120 + hash(i, 1, 3) * 30;
      x.fillStyle = ['#6a3a2c', '#5e3428', '#73442f'][i / 64 % 3]; x.fillRect(i, top, 64, 256 - top);
      x.fillStyle = '#3a3c44'; x.beginPath(); x.moveTo(i - 2, top); x.lineTo(i + 32, top - 26); x.lineTo(i + 66, top); x.fill();
      x.fillStyle = '#4a2a22'; x.fillRect(i + 44, top - 40, 9, 22);
      for (let r = 0; r < 3; r++) for (let q = 0; q < 2; q++) win(i + 12 + q * 26, top + 18 + r * 36, 12, 18, hash(i, r * 2 + q, 4) < 0.3);
    }
  } else if (kind === 'city') {
    // blocks of flats and offices of different heights, window grids
    for (let i = 0; i < 1024;) {
      const w = 60 + hash(i, 2, 5) * 90, top = 20 + hash(i, 3, 5) * 160;
      x.fillStyle = ['#7c7a74', '#8a8478', '#6c7078', '#9a948a'][Math.floor(hash(i, 4, 5) * 4)]; x.fillRect(i, top, w - 4, 256 - top);
      for (let py = top + 8; py < 250; py += 14) for (let px = i + 6; px < i + w - 12; px += 12) win(px, py, 7, 8, hash(px, py, 6) < 0.22);
      i += w;
    }
  } else {
    // a park: rounded tree canopies on rising ground
    for (let i = -40; i < 1060; i += 26) { const r = 30 + hash(i, 5, 7) * 26, cy = 200 - hash(i, 6, 7) * 60; x.fillStyle = ['#2c4a26', '#365a2c', '#24401f'][Math.floor(hash(i, 7, 7) * 3)]; x.beginPath(); x.arc(i, cy, r, 0, 7); x.fill(); x.fillRect(i - r, cy, 2 * r, 256 - cy); }
  }
  return smoothTex(c, { aniso: 4 });
}
