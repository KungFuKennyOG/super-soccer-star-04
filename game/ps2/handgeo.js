// Your own hand in the '04 look: its skeleton and its skinned mesh, built in code at real size.
// Built in the hand's own frame H (a right hand): the wrist joint at the origin, +y toward the
// fingertips, +x toward the little finger (ulnar), +z out of the back of the hand (dorsal), so the palm
// faces -z. hands.js turns H into WebXR grip space. Bind pose: fingers straight, thumb at rest.
// Sizes are an adult man's (hand length wrist crease to middle tip about 19 cm, breadth across the
// knuckles 8.8 cm; segment lengths from the usual phalanx proportions, joint to joint).
import * as THREE from 'three';
import { sstep } from './paint.js';

const D = Math.PI / 180;
// Fingers, index to little. at: the MCP joint (H). len: proximal, middle, distal (to the tip). w: half width of
// the proximal phalanx; d: its half depth. spread: how far it fans toward the little finger at rest (deg).
export const FINGERS = [
  { name: 'i', at: [-0.0305, 0.087, -0.001], len: [0.043, 0.0255, 0.021], w: 0.0098, d: 0.0090, spread: -5 },
  { name: 'm', at: [-0.0095, 0.0905, -0.001], len: [0.047, 0.029, 0.0235], w: 0.0101, d: 0.0093, spread: -0.5 },
  { name: 'r', at: [0.0105, 0.0865, -0.001], len: [0.0445, 0.028, 0.0225], w: 0.0094, d: 0.0087, spread: 4 },
  { name: 'l', at: [0.0285, 0.0775, -0.001], len: [0.0355, 0.0205, 0.0195], w: 0.0083, d: 0.0077, spread: 10 },
];
// The thumb from its base (the CMC joint at the trapezium, deep in the heel of the hand): metacarpal,
// proximal phalanx, distal (to the tip). dir: where the metacarpal points at rest; nail: which way its nail faces.
export const THUMB = { at: [-0.0265, 0.021, -0.007], len: [0.046, 0.031, 0.0285], dir: [-0.6, 0.75, -0.27], nail: [-0.62, -0.2, 0.75] };
// The forearm leaves the wrist bent back a little (the hand a touch extended on the grip) and toward the thumb.
export const FOREARM = new THREE.Vector3(-0.1, -0.95, 0.27).normalize();
export const BAND = [0.016, 0.072];          // the sweatband: from and to, along the forearm from the wrist (m)

// Sheet regions (256 x 256: a PS2-era hand, Kenny): the arm and palm in one loft, the thumb, then the four fingers.
export const SHEET = { w: 256, h: 256 };
export const REG = {
  arm: { x: 0, y: 0, w: 256, h: 112, s0: -0.135, s1: 0.097 },    // s: along the forearm (negative) and up the hand (y)
  thumb: { x: 0, y: 112, w: 64, h: 144, s0: -0.012, s1: 0.1055 },
  ...Object.fromEntries(FINGERS.map((f, i) => [f.name, { x: 64 + 48 * i, y: 112, w: 48, h: 144, s0: -0.014, s1: f.len[0] + f.len[1] + f.len[2] }])),
};
// Round each ring the angle a runs from the seam: 0 = dorsal (+z), a quarter turn = ulnar (+x), half = palmar.
export const A0 = { arm: Math.PI * 0.75, thumb: Math.PI * 0.5, finger: Math.PI * 0.5 };

// Each joint also has a half bone: it sits on the joint and turns half as far as the joint does, and the ring of
// skin over the joint goes with it alone, so a bent knuckle keeps its thickness (plain blending pinches it).
const CHAINS = [...FINGERS.map(f => [f.name + '1', f.name + '2', f.name + '3']), ['t1', 't2', 't3']];
export const BONES = ['root', ...CHAINS.flat(), ...CHAINS.flat().map(n => n + 'h')];
const IDX = Object.fromEntries(BONES.map((n, i) => [n, i]));

export function thumbBindQ() {
  const y = new THREE.Vector3(...THUMB.dir).normalize(), z = new THREE.Vector3(...THUMB.nail);
  z.addScaledVector(y, -z.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
export const fingerBindQ = f => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -f.spread * D);

// A fresh skeleton in its bind pose; every bone's bind rotation is kept in userData.bind.
export function handSkeleton() {
  const bones = BONES.map(n => { const b = new THREE.Bone(); b.name = n; return b; }), by = Object.fromEntries(bones.map(b => [b.name, b]));
  const chain = (names, at, q, len) => {
    by[names[0]].position.set(...at); by[names[0]].quaternion.copy(q); by.root.add(by[names[0]]);
    for (let k = 1; k < 3; k++) { by[names[k]].position.set(0, len[k - 1], 0); by[names[k - 1]].add(by[names[k]]); }
    names.forEach((n, k) => { const h = by[n + 'h']; h.position.copy(by[n].position); h.quaternion.copy(by[n].quaternion); (k ? by[names[k - 1]] : by.root).add(h); });
  };
  for (const f of FINGERS) chain([f.name + '1', f.name + '2', f.name + '3'], f.at, fingerBindQ(f), f.len);
  chain(['t1', 't2', 't3'], THUMB.at, thumbBindQ(), THUMB.len);
  for (const b of bones) b.userData.bind = b.quaternion.clone();
  by.root.updateMatrixWorld(true);
  return { root: by.root, bones, by };
}
// the half bones after a pose: halfway between the joint's bind and its posed turn
export function setHalves(by) {
  for (const c of CHAINS) for (const n of c) by[n + 'h'].quaternion.copy(by[n].userData.bind).slerp(by[n].quaternion, 0.5);
}

const spow = (v, e) => Math.sign(v) * Math.abs(v) ** e;
class Mesher {
  constructor() { this.pos = []; this.uv = []; this.si = []; this.sw = []; this.idx = []; }
  vert(p, u, v, w) {
    this.pos.push(p.x, p.y, p.z); this.uv.push(u / SHEET.w, 1 - v / SHEET.h);
    const e = Object.entries(w).filter(k => k[1] > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4), sum = e.reduce((s, k) => s + k[1], 0) || 1;
    for (let i = 0; i < 4; i++) { this.si.push(e[i] ? IDX[e[i][0]] : 0); this.sw.push(e[i] ? e[i][1] / sum : 0); }
    return this.pos.length / 3 - 1;
  }
  // rings: { c: [x, y, z] local, rx: [toward +x, toward -x], rz: [dorsal, palmar], n: squareness, s: along (for v), w: weights or fn(world p) }
  // xf: local → H. shape(a, ring, p): a nudge to the point (local). The angle runs from a0 (see A0).
  loft(rings, reg, { seg, a0, xf = new THREE.Matrix4(), capEnd = false, capStart = false, shape }) {
    const start = this.pos.length / 3, n = seg + 1, p = new THREE.Vector3();
    const V = s => reg.y + reg.h * Math.min(0.995, Math.max(0.005, (s - reg.s0) / (reg.s1 - reg.s0)));
    const W = (r, q) => (typeof r.w === 'function' ? r.w(q) : r.w);
    for (const r of rings) for (let i = 0; i <= seg; i++) {
      const a = a0 + i / seg * Math.PI * 2, sn = Math.sin(a), cs = Math.cos(a), e = 2 / (r.n || 2);
      p.set(r.c[0] + spow(sn, e) * r.rx[sn > 0 ? 0 : 1], r.c[1], r.c[2] + spow(cs, e) * r.rz[cs > 0 ? 0 : 1]);
      if (shape) shape(a, r, p);
      p.applyMatrix4(xf);
      this.vert(p, reg.x + 1 + (reg.w - 2) * i / seg, V(r.s), W(r, p));
    }
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < seg; i++) {
      const a = start + j * n + i, b = a + n;
      this.idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const cap = (j, flip) => {
      const r = rings[j]; p.set(...r.c).applyMatrix4(xf);
      const c = this.vert(p, reg.x + reg.w / 2, V(r.s), W(r, p));
      for (let i = 0; i < seg; i++) { const a = start + j * n + i; if (flip) this.idx.push(c, a + 1, a); else this.idx.push(c, a, a + 1); }
    };
    if (capStart) cap(0, true);
    if (capEnd) cap(rings.length - 1, false);
  }
}

// Weights for a ring of a chain at s: the bone it sits on, and over each joint (within hw) its half bone.
// joints: [the base (0), the next two]; base: what the chain grows out of; keep: how much of the base the first
// joint keeps (the thumb's root is deep in the heel of the hand and mostly stays with it).
function chainW(names, joints, s, base, hw = 0.0045, keep = 0) {
  for (let k = 0; k < 3; k++) {
    const t = (s - joints[k]) / (k ? hw : hw * 1.4);
    if (Math.abs(t) < 1) {
      const h = 1 - sstep(0.15, 1, Math.abs(t)), other = t < 0 ? (k ? names[k - 1] : base) : names[k];
      const w = { [names[k] + 'h']: h * (1 - (k ? 0 : keep)) };
      w[other] = (w[other] || 0) + 1 - h;
      if (!k && keep) w[base] = (w[base] || 0) + h * keep;
      return w;
    }
  }
  return { [s < joints[0] ? base : s < joints[1] ? names[0] : s < joints[2] ? names[1] : names[2]]: 1 };
}

// The forearm, wrist and palm in one loft, up to the knuckles. [s, toward thumb, toward little finger, back, palm, squareness]
// (s < 0: along the forearm from the wrist; s > 0: up the hand). The band stands 4 mm proud of the arm.
export const ARM = [[-0.135, 0.034, 0.034, 0.03, 0.031, 2], [-0.1, 0.032, 0.032, 0.028, 0.029, 2], [-BAND[1] - 0.0008, 0.031, 0.031, 0.027, 0.028, 2], [-BAND[1], 0.0352, 0.0352, 0.0312, 0.0322, 2.1],
  [-BAND[0], 0.0335, 0.0335, 0.0292, 0.0302, 2.1], [-BAND[0] + 0.0008, 0.0295, 0.0295, 0.0252, 0.0262, 2], [-0.004, 0.0285, 0.029, 0.0215, 0.023, 2.1]];
export const PALM = [[0.012, 0.031, 0.0305, 0.0185, 0.0215, 2.3], [0.026, 0.0345, 0.035, 0.0158, 0.0215, 2.5], [0.042, 0.039, 0.0405, 0.0142, 0.0185, 2.7], [0.057, 0.0425, 0.0425, 0.0132, 0.0158, 2.8],
  [0.069, 0.0438, 0.0435, 0.0128, 0.0142, 2.8], [0.079, 0.0432, 0.0418, 0.0128, 0.0125, 2.7], [0.0875, 0.036, 0.034, 0.0108, 0.009, 2.5], [0.093, 0.026, 0.024, 0.006, 0.004, 2.3]];
// where each knuckle sits across the hand (its MCP joint): the knuckle line is an arc, the middle one furthest out
export const knuckleY = x => 0.0905 - (x + 0.008) ** 2 * (x > -0.008 ? 11.5 : 5.5);

function armPalm(m, sk) {
  const tb = sk.by.t1, tA = new THREE.Vector3().setFromMatrixPosition(tb.matrixWorld), tB = new THREE.Vector3(0, THUMB.len[0], 0).applyMatrix4(tb.matrixWorld);
  const seg = new THREE.Line3(tA, tB), cp = new THREE.Vector3();
  // palm skin near the thumb's metacarpal goes some way with it (the web of the thumb and the thenar side of the palm);
  // the knuckle edge goes with the fingers
  const palmW = p => {
    const w = { root: 1 };
    seg.closestPointToPoint(p, true, cp);
    const kt = 0.45 * sstep(0.026, 0.01, cp.distanceTo(p)) * sstep(0.0, 0.03, p.y) * sstep(-0.018, -0.034, p.x) * sstep(0.085, 0.06, p.y);
    if (kt > 0) { w.t1 = kt; w.root -= kt; }
    // the knuckles on the back are the heads of the hand's own bones and stay with it; on the palm side the skin from
    // the last crease to the fingers' roots is over the fingers' first bones and folds with them
    const palmar = sstep(0.002, -0.006, p.z), xc = Math.max(FINGERS[0].at[0], Math.min(FINGERS[3].at[0], p.x));
    for (let i = 0; i < 4; i++) {
      const f = FINGERS[i], gap = Math.abs((FINGERS[i === 3 ? 2 : i + 1].at[0] - FINGERS[i === 3 ? 3 : i].at[0]));
      const near = Math.max(0, 1 - Math.abs(xc - f.at[0]) / gap), ky = knuckleY(f.at[0]);
      if (near <= 0) continue;
      const kd = sstep(ky - 0.004, ky + 0.0015, p.y) * near * (1 - palmar);   // past the knuckle it is inside the finger's root
      const kp = sstep(0.062, 0.082, p.y) * near * palmar, full = sstep(0.074, 0.087, p.y);
      if (kd > 0) { w[f.name + '1h'] = kd; w.root -= kd; }
      if (kp > 0) { w[f.name + '1h'] = (w[f.name + '1h'] || 0) + kp * (1 - full); w[f.name + '1'] = kp * full; w.root -= kp; }
    }
    w.root = Math.max(0, w.root);
    return w;
  };
  const rings = [
    ...ARM.map(([s, rr, ru, dd, dp, n]) => {
      const c = FOREARM.clone().multiplyScalar(-s);
      return { c: [0, 0, 0], at: c, rx: [ru, rr], rz: [dd, dp], n, s, w: { root: 1 } };
    }),
    ...PALM.map(([y, rr, ru, dd, dp, n]) => ({ c: [-0.001, y, 0.0], rx: [ru, rr], rz: [dd, dp], n, s: y, w: palmW })),
  ];
  // forearm rings lie square across the forearm, then turn to lie square across the hand over the wrist
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion().setFromUnitVectors(up, FOREARM.clone().negate()), qi = new THREE.Quaternion();
  const shape = (a, r, p) => {
    const y = r.s;
    if (y < 0.006) {                                       // the forearm: turn the ring onto the forearm's axis
      const k = sstep(0.004, -0.02, y); qi.identity().slerp(q, k);
      p.sub(new THREE.Vector3(...r.c)).applyQuaternion(qi).add(r.at);
      if (y > -BAND[0] && y < 0) p.z -= 0.0015 * Math.max(0, -Math.cos(a));   // the wrist's palm side a little flat
      return;
    }
    const x = p.x, k = sstep(0.064, 0.0875, y);
    p.y += (knuckleY(x) - 0.0905) * k;                     // the knuckle line arcs
    if (Math.cos(a) > 0) {                                 // the back: knuckles stand up, the tendons' valleys between them
      let bump = 0;
      for (const f of FINGERS) bump += Math.exp(-(((x - f.at[0]) / 0.006) ** 2));
      p.z += Math.cos(a) * (0.0046 * bump - 0.0016) * sstep(0.07, 0.086, y);
      p.z -= 0.0016 * Math.cos(a) * sstep(0.02, 0.05, y) * sstep(0.075, 0.06, y) * Math.exp(-(((x + 0.004) / 0.03) ** 2)) * 0.6;   // the back of the hand is gently domed, a little hollow in from the wrist
    } else {
      const cp = -Math.cos(a);
      p.z += cp * 0.0026 * sstep(0.065, 0.03, y) * sstep(0.01, 0.045, x) * sstep(0.008, 0.03, y);   // the heel under the little finger (hypothenar)
      p.z += cp * 0.0024 * Math.exp(-(((y - 0.05) / 0.017) ** 2)) * Math.exp(-(((x + 0.004) / 0.014) ** 2)) * -1;   // the hollow of the palm
      p.z += cp * 0.0018 * Math.exp(-(((y - 0.077) / 0.008) ** 2)) * sstep(0.04, 0.0, Math.abs(x + 0.002));   // the pads under the finger roots
      p.z -= cp * 0.0095 * Math.exp(-(((y - 0.036) / 0.022) ** 2) - ((x + 0.022) / 0.015) ** 2);                   // the ball of the thumb (thenar)
    }
  };
  m.loft(rings, REG.arm, { seg: 10, a0: A0.arm, shape });   // open at the elbow end: it has faded out by there
}

// A finger as a straight chain along local +y from its MCP joint. [s, width, back, palm side, squareness] as shares of w
function finger(m, sk, f, k) {
  const [l1, l2, l3] = f.len, tip = l1 + l2 + l3, w = f.w, names = [f.name + '1', f.name + '2', f.name + '3'], joints = [l1, l1 + l2];
  // a PS2-era finger: a ring at the root, the knuckle, each joint and two for the tip (Kenny: no more detail than that)
  const R = [[-0.014, 1.1, 1.15, 1.0, 2.2], [-0.002, 1.12, 1.28, 1.0, 2.2], [l1, 1.0, 1.0, 0.94, 2.15], [l1 + l2, 0.9, 0.86, 0.86, 2.15], [tip - 0.007, 0.82, 0.66, 0.92, 2.1], [tip - 0.0012, 0.45, 0.34, 0.46, 2.0]];
  const rings = R.map(([s, rx, dd, dp, n]) => ({ c: [0, s, (s < 0.005 ? 0.0015 : 0) + (s > tip - 0.012 ? -0.0006 : 0)], rx: [rx * w, rx * w], rz: [dd * w * 0.92, dp * w * 0.98], n, s,
    w: chainW(names, [0, ...joints], s, 'root') }));
    const shape = (a, r, p) => { if (r.s < 0.004 && Math.cos(a) < 0) p.y += 0.006 * -Math.cos(a) * sstep(0.004, -0.012, r.s); };   // the palm side starts further up: the web
  m.loft(rings, REG[f.name], { seg: 6, a0: A0.finger, xf: sk.by[names[0]].matrixWorld, shape, capEnd: true });
}

// The thumb with its base: the ball of the thumb (thenar) is the fat first part, on the palm side of the metacarpal.
function thumb(m, sk) {
  const [lm, lp, ld] = THUMB.len, tip = lm + lp + ld, names = ['t1', 't2', 't3'], joints = [lm, lm + lp];
  // [s, toward x, toward -x, nail side, pad side, palm-ward shift of the centre, squareness]
  const R = [[-0.012, 0.0125, 0.012, 0.0105, 0.0125, 0.001, 2.2], [0.004, 0.0148, 0.0142, 0.0105, 0.0158, 0.002, 2.2], [0.035, 0.0128, 0.0124, 0.0102, 0.0128, 0.0012, 2.3],
    [lm, 0.0122, 0.0122, 0.0114, 0.0102, 0, 2.3], [lm + lp, 0.011, 0.011, 0.0098, 0.0092, 0, 2.3], [tip - 0.008, 0.0098, 0.0098, 0.0075, 0.0096, -0.0005, 2.4], [tip - 0.0014, 0.006, 0.006, 0.0042, 0.0052, -0.0008, 2.2]];
  // the base goes with the heel of the hand, the ball of the thumb partly; from its middle it's all thumb
  const rings = R.map(([s, ra, rb, dd, dp, sh, n]) => ({ c: [0.0, s, -sh], rx: [ra, rb], rz: [dd, dp], n, s,
    w: s < 0.03 ? { root: 1 - sstep(-0.012, 0.03, s) * 0.85, t1h: sstep(-0.012, 0.03, s) * 0.35, t1: sstep(-0.012, 0.03, s) * 0.5 } : chainW(names, [-1, ...joints], s, 'root') }));
  m.loft(rings, REG.thumb, { seg: 6, a0: A0.thumb, xf: sk.by.t1.matrixWorld, capEnd: true });
}

let GEO;
export function handGeometry() {
  if (GEO) return GEO;
  const sk = handSkeleton(), m = new Mesher();
  armPalm(m, sk);
  FINGERS.forEach((f, k) => finger(m, sk, f, k));
  thumb(m, sk);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(m.si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(m.sw, 4));
  g.setIndex(m.idx);
  g.computeVertexNormals();
  smoothSeams(g);
  occlusion(g);
  return (GEO = g);
}
// vertices at the same spot (texture seams) share one normal
function smoothSeams(g) {
  const p = g.attributes.position.array, n = g.attributes.normal.array, groups = new Map();
  for (let i = 0; i < p.length / 3; i++) {
    const key = `${Math.round(p[i * 3] * 1e4)},${Math.round(p[i * 3 + 1] * 1e4)},${Math.round(p[i * 3 + 2] * 1e4)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    let x = 0, y = 0, z = 0;
    for (const i of ids) { x += n[i * 3]; y += n[i * 3 + 1]; z += n[i * 3 + 2]; }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of ids) { n[i * 3] = x / l; n[i * 3 + 1] = y / l; n[i * 3 + 2] = z / l; }
  }
}
// Baked shade in the vertex colors: only what holds in every pose (between the fingers' roots, the web, the
// band's lip); the rest of the light is the material's.
function occlusion(g) {
  const p = g.attributes.position.array, si = g.attributes.skinIndex.array, col = new Float32Array(p.length / 3 * 4);
  for (let i = 0; i < p.length / 3; i++) {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    let ao = 1;
    const bone = BONES[si[i * 4]];
    if (bone && bone[1] === '1' && bone !== 't1') {               // the sides of a finger's root, where it meets the next
      const f = FINGERS.find(q => q.name === bone[0]), dx = Math.abs(x - f.at[0]);
      ao -= 0.18 * sstep(0.006, 0.0105, dx) * sstep(f.at[1] + 0.02, f.at[1] - 0.004, y);
    }
    ao -= 0.12 * Math.exp(-(((y - 0.062) / 0.012) ** 2)) * sstep(-0.018, -0.034, x) * sstep(0.004, -0.01, z);   // the fold between thumb and palm
    col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = Math.max(0.6, ao);
    // the forearm fades out over its last few cm, so you never see where it's cut (alpha to coverage, no sorting)
    const back = x * FOREARM.x + y * FOREARM.y + z * FOREARM.z;
    col[i * 4 + 3] = sstep(0.124, 0.076, back);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
}
