// The '04-look ultras behind the goal: flags on poles waving over the home curva (centre-left of the
// end stand's lower tier) and the away block (its right end), and banners draped over the front wall
// with generic words. Laid out as game/ultras.js lays them; two draws (flags instanced, banners).
import * as THREE from 'three';
import { FRONT } from './groundplan.js';
import { flagAtlas, bannerAtlas, bannerUV } from './groundtex.js';
import { flagMaterial, bannerMaterial } from './groundmat.js';

const FLAG_W = 1.8, FLAG_H = 1.15, POLE = 2.8;

function seeded(s) { let r = (s * 16807 + 11) % 2147483647 || 1; return () => (r = (r * 16807) % 2147483647) / 2147483647; }
const pal = cols => { const c = cols.filter(Boolean); return [c[0], c.find(x => x !== c[0]) || '#f2f1ea', c[2] || c[0]]; };

// A flag: the cloth (8 x 3 quads, pole edge at x = 0) and the pole as two crossed strips.
function flagGeo() {
  const pos = [], uv = [], cloth = [], idx = [], nx = 8, ny = 3;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { pos.push(i / nx * FLAG_W, (j / ny - 0.5) * FLAG_H, 0); uv.push(i / nx, j / ny); cloth.push(1); }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
  const y0 = -(POLE - FLAG_H / 2), y1 = FLAG_H / 2 + 0.05, w = 0.03;
  for (const [dx, dz] of [[w, 0], [0, w]]) {
    const b = pos.length / 3;
    pos.push(-dx, y0, -dz, dx, y0, dz, dx, y1, dz, -dx, y1, -dz); uv.push(0, 0, 1, 0, 1, 1, 0, 1); cloth.push(0, 0, 0, 0);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aCloth', new THREE.Float32BufferAttribute(cloth, 1));
  g.setIndex(idx);
  return g;
}

// end: { f: the end stand's frame, len, tier: its lower tier (groundplan profile) }. home: the curva's
// colours, away: the block's. light, hype: shared uniforms (hype: { uHypeH, uHypeA }).
export function buildUltras2(end, home, away, light, hype, seed = 1) {
  const group = new THREE.Group(), rand = seeded(seed), { f, len, tier } = end, depth = tier.z0 - tier.z1;
  const yAt = d => tier.y0 + (tier.y1 - tier.y0) * d / depth;
  const H = pal(home), A = pal(away);
  const spots = [];
  for (let d = 1.2; d < depth - 0.8; d += 1.7) {
    for (let x = -len * 0.34; x < len * 0.08; x += 2.3) if (rand() < 0.42) spots.push([x + (rand() - 0.5), d, 0]);
    for (let x = len * 0.24; x < len * 0.46; x += 3.0) if (rand() < 0.4) spots.push([x + (rand() - 0.5), d, 1]);
  }
  const geo = flagGeo(), n = spots.length;
  const design = new Float32Array(n), side = new Float32Array(n), phase = new Float32Array(n);
  const mesh = new THREE.InstancedMesh(geo, flagMaterial(flagAtlas([H[0], H[1], H[2]], [A[0], A[1], A[2]]), light, hype, FLAG_W), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const yaw = Math.atan2(f(1, 0, 0).x - f(0, 0, 0).x, f(1, 0, 0).z - f(0, 0, 0).z) - Math.PI / 2;
  spots.forEach(([x, d, s], i) => {
    f(x, yAt(d) + POLE - FLAG_H / 2 + 0.2, -d - 0.4, p);
    q.setFromAxisAngle(up, yaw + (rand() - 0.5) * 0.6);
    mesh.setMatrixAt(i, m4.compose(p, q, one));
    design[i] = s * 4 + (i % 4); side[i] = s; phase[i] = rand();
  });
  geo.setAttribute('aDesign', new THREE.InstancedBufferAttribute(design, 1));
  geo.setAttribute('aSide', new THREE.InstancedBufferAttribute(side, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  mesh.frustumCulled = false;
  group.add(mesh);
  // banners over the front wall, facing the pitch, tied at their ends and sagging a little between
  const spans = [[-0.36, -0.18, 0], [-0.16, 0.06, 1], [0.25, 0.44, 4]], bp = [], buv = [], sag = [], bidx = [], segs = 12, h = 1.15;
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
    update(dt, t, hypeHome, hypeAway) { hype.uHypeH.value = hypeHome; hype.uHypeA.value = hypeAway; },
  };
}
