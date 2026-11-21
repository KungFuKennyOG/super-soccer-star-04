// The '04-look ultras behind the goal: flags on poles waved by fans in the home curva (centre-left of
// the end stand's lower tier, or the whole end for a kop) and the away block, a dozen or so small ones
// and one or two big ones, and banners draped over the front wall with generic words. Two draws
// (flags instanced, banners). Which fans hold flags is fans.js's choice.
import * as THREE from 'three';
import { FRONT } from './groundplan.js';
import { flagAtlas, bannerAtlas, bannerUV } from './groundtex.js';
import { flagMaterial, bannerMaterial } from './groundmat.js';

const FLAG_W = 1.35, FLAG_H = 0.9, POLE = 2.5, HANDS = 0.65 + 0.53, BIG = 2.1;
const PITCH = new THREE.Vector3(0, 0, -16);

function seeded(s) { let r = (s * 16807 + 11) % 2147483647 || 1; return () => (r = (r * 16807) % 2147483647) / 2147483647; }
const pal = cols => { const c = cols.filter(Boolean); return [c[0], c.find(x => x !== c[0]) || '#f2f1ea', c[2] || c[0]]; };

// A flag: the pole (two crossed strips, from a little under the lower hand to its top) and the cloth
// (8 x 3 quads) at the top, its pole edge at x = 0. aAlong: how far along the cloth (0 at the pole).
function flagGeo() {
  const pos = [], uv = [], cloth = [], along = [], idx = [], nx = 8, ny = 3;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { pos.push(i / nx * FLAG_W, POLE - FLAG_H + j / ny * FLAG_H, 0); uv.push(i / nx, j / ny); cloth.push(1); along.push(i / nx); }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
  const w = 0.022;
  for (const [dx, dz] of [[w, 0], [0, w]]) {
    const b = pos.length / 3;
    pos.push(-dx, -0.35, -dz, dx, -0.35, dz, dx, POLE + 0.04, dz, -dx, POLE + 0.04, -dz); uv.push(0, 0, 1, 0, 1, 1, 0, 1); cloth.push(0, 0, 0, 0); along.push(0, 0, 0, 0);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCloth', new THREE.Float32BufferAttribute(cloth, 1)); g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  g.setIndex(idx);
  return g;
}

// end: { f: the end stand's frame, len, curva, block }. holders: fans.js Crowd.flags() (the fans who
// hold the flags). home: the curva's colours, away: the block's. uniforms: the light, the hype
// ({ uHypeH, uHypeA }) and the crowd's match moments, shared with the fans.
export function buildUltras2(end, holders, home, away, light, uniforms, seed = 1) {
  const group = new THREE.Group(), rand = seeded(seed), { f, len, block = { from: 0.15, to: 0.5, on: 'end' } } = end;
  const H = pal(home), A = pal(away);
  const geo = flagGeo(), n = holders.length;
  const design = new Float32Array(n), side = new Float32Array(n), phase = new Float32Array(n), mine = new Float32Array(n), big = new Float32Array(n);
  const mesh = new THREE.InstancedMesh(geo, flagMaterial(flagAtlas([H[0], H[1], H[2]], [A[0], A[1], A[2]]), light, uniforms), Math.max(1, n));
  mesh.count = n;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), p = new THREE.Vector3();
  holders.forEach((h, i) => {
    const to = new THREE.Vector3().subVectors(PITCH, h.p).setY(0).normalize();
    p.copy(h.p).addScaledVector(to, 0.14).setY(h.p.y + HANDS);                // in front of him, at his lower hand
    q.setFromAxisAngle(up, Math.atan2(to.x, to.z) + (rand() - 0.5) * 0.5);
    const k = h.big ? BIG : 1;
    mesh.setMatrixAt(i, m4.compose(p, q, sc.set(rand() < 0.5 ? -k : k, k, k)));
    design[i] = h.side * 4 + (h.big ? 3 - (i % 2) : i % 4); side[i] = h.side; phase[i] = h.phase; mine[i] = h.mine; big[i] = h.big ? 1 : 0;
  });
  geo.setAttribute('aDesign', new THREE.InstancedBufferAttribute(design, 1));
  geo.setAttribute('aSide', new THREE.InstancedBufferAttribute(side, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.setAttribute('aMine', new THREE.InstancedBufferAttribute(mine, 1));
  geo.setAttribute('aBig', new THREE.InstancedBufferAttribute(big, 1));
  mesh.frustumCulled = false;
  group.add(mesh);
  // banners over the front wall, facing the pitch, tied at their ends and sagging a little between
  const spans = block.on === 'end' ? [[-0.36, -0.18, 0], [-0.16, 0.06, 1], [0.25, 0.44, 4]] : [[-0.4, -0.16, 0], [-0.12, 0.12, 1], [0.16, 0.4, 3]], bp = [], buv = [], sag = [], bidx = [], segs = 12, h = 1.15;
  spans.forEach(([a, b, row], k) => {
    const [u0, v0, u1, v1] = bannerUV(row + (k === 1 ? Math.floor(rand() * 3) : 0)), base = bp.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, x = (a + (b - a) * t) * len, s = Math.sin(Math.PI * t);
      for (const [y, vv] of [[FRONT - h + 0.95 - 0.08 * s, v0], [FRONT + 0.95, v1]]) { f(x, y, 0.14, p); bp.push(p.x, p.y, p.z); buv.push(u0 + (u1 - u0) * t, vv); sag.push(s); }
    }
    for (let i = 0; i < segs; i++) { const o = base + i * 2; bidx.push(o, o + 2, o + 3, o, o + 3, o + 1); }
  });
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2)); bg.setAttribute('aSag', new THREE.Float32BufferAttribute(sag, 1));
  bg.setIndex(bidx);
  const banners = new THREE.Mesh(bg, bannerMaterial(bannerAtlas(H, A, seed), light));
  group.add(banners);
  return {
    group, flags: n, draws: 2, tris: n * geo.index.count / 3 + bidx.length / 3,
    // hypeHome / hypeAway: 0..1, how wildly each end waves (the uniforms are shared, so this is all)
    update(dt, t, hypeHome, hypeAway) { uniforms.uHypeH.value = hypeHome; uniforms.uHypeA.value = hypeAway; },
  };
}
