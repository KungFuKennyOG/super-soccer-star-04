// Geometry builders for the '04-look grounds: quads laid down in a stand's own frame (x along it, z
// back from its front wall, see groundplan.js) or swept round a corner, collected into one mesh per
// material. The light each face takes is baked here (aLit), from the sun direction the players'
// shadows use and the direction to the floodlit pitch.
import * as THREE from 'three';
import { LIGHT_DIR } from './player.js';

const PITCH_C = new THREE.Vector3(0, 4, -16);         // the middle of the half pitch, a little up
const v3 = () => new THREE.Vector3();
const N = v3(), T = v3();

// A frame: a straight stand (x, z, yaw) or a corner (centre x, z) at a yaw.
export function frameAt(x, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return (lx, ly, lz, out = v3()) => out.set(x + lx * c + lz * s, ly, z - lx * s + lz * c);
}

export class Geo {
  constructor() { this.pos = []; this.uv = []; this.reg = []; this.col = []; this.lit = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  // four world points a b c d (u0v0, u1v0, u1v1, u0v1). o: { reg: atlas cell, uv: [u0, v0, u1, v1],
  // color: '#hex' or [r, g, b] 0..1, glow: 0..1, face: a world point the face should look toward }
  quad(a, b, c, d, o = {}) {
    N.subVectors(b, a).cross(T.subVectors(d, a));
    if (N.lengthSq() < 1e-12) N.subVectors(c, b).cross(T.subVectors(d, b));
    N.normalize();
    let pts = [a, b, c, d], uv = o.uv || [0, 0, 1, 1];
    let uvs = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
    if (o.face && N.dot(T.subVectors(o.face, a)) < 0) { pts = [a, d, c, b]; uvs = [uvs[0], uvs[3], uvs[2], uvs[1]]; N.negate(); }
    const col = typeof o.color === 'string' ? new THREE.Color(o.color).toArray() : (o.color || [1, 1, 1]), reg = o.reg || [0, 0, 1, 1];
    const i = this.count;
    pts.forEach((p, k) => {
      this.pos.push(p.x, p.y, p.z); this.uv.push(...uvs[k]); this.reg.push(...reg); this.col.push(...col);
      const toP = T.subVectors(PITCH_C, p), dist = toP.length();
      const kp = Math.max(0, N.dot(toP.normalize())) * (0.35 + 0.65 / (1 + (dist / 70) ** 2));
      this.lit.push(Math.max(0, N.dot(LIGHT_DIR)) * (o.shade ?? 1), kp * (o.shade ?? 1), o.glow || 0, N.y);
    });
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  // a fan over a polygon (world points) that is star-shaped from its first point (gables)
  fan(pts, o = {}) { for (let k = 1; k < pts.length - 1; k++) this.quad(pts[0], pts[k], pts[k + 1], pts[k + 1], o); }
  // an axis-aligned-in-frame box: f(frame), centre (lx, ly, lz), size (w, h, d)
  box(f, [lx, ly, lz], [w, h, d], o = {}, faces = 'all') {
    const P = (x, y, z) => f(lx + x * w / 2, ly + y * h / 2, lz + z * d / 2);
    const sides = [[[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [0, 0, 9]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1], [0, 0, -9]],
      [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1], [9, 0, 0]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-9, 0, 0]], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1], [0, 9, 0]]];
    for (const [a, b, c, d, n] of sides) this.quad(P(...a), P(...b), P(...c), P(...d), { ...o, face: P(...n) });
  }
  // a convex-enough polygon (world points, star-shaped from the first) with its own uv per point
  poly(pts, uvs, o = {}) {
    N.subVectors(pts[1], pts[0]).cross(T.subVectors(pts[2], pts[0])).normalize();
    let order = pts.map((_, k) => k);
    if (o.face && N.dot(T.subVectors(o.face, pts[0])) < 0) { order = [0, ...order.slice(1).reverse()]; N.negate(); }
    const col = typeof o.color === 'string' ? new THREE.Color(o.color).toArray() : (o.color || [1, 1, 1]), reg = o.reg || [0, 0, 1, 1], i = this.count;
    for (const k of order) {
      const p = pts[k]; this.pos.push(p.x, p.y, p.z); this.uv.push(...uvs[k]); this.reg.push(...reg); this.col.push(...col);
      const toP = T.subVectors(PITCH_C, p), dist = toP.length();
      this.lit.push(Math.max(0, N.dot(LIGHT_DIR)) * (o.shade ?? 1), Math.max(0, N.dot(toP.normalize())) * (0.35 + 0.65 / (1 + (dist / 70) ** 2)) * (o.shade ?? 1), o.glow || 0, N.y);
    }
    for (let k = 1; k < pts.length - 1; k++) this.idx.push(i, i + k, i + k + 1);
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aReg', new THREE.Float32BufferAttribute(this.reg, 4));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aLit', new THREE.Float32BufferAttribute(this.lit, 4));
    g.setIndex(this.idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false;
    return m;
  }
}

// Glows: billboards (all four corners at the centre, pushed out in the vertex shader).
export class GlowGeo {
  constructor() { this.pos = []; this.corner = []; this.size = []; this.idx = []; }
  add(p, r) {
    const i = this.pos.length / 3;
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { this.pos.push(p.x, p.y, p.z); this.corner.push(x, y); this.size.push(r); }
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aCorner', new THREE.Float32BufferAttribute(this.corner, 2));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(this.size, 1));
    g.setIndex(this.idx);
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 4; m.matrixAutoUpdate = false;
    return m;
  }
}
