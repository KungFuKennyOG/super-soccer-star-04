// Poses for your own '04 hand (handgeo.js) and how they're put on its bones.
// A pose is joint angles in degrees: f, per finger index to little, [spread toward the little finger,
// MCP, PIP, DIP flexion]; t, the thumb, [across the palm, out of the palm (palmar abduction), roll (pronation),
// MCP, IP flexion], all from the bind pose (fingers straight and fanned, thumb at rest).
// Ranges (typical adult, the usual clinical tables): MCP 0-90, PIP 0-100 (the little finger least), DIP 0-80;
// thumb MCP 0-55, IP 0-80, its base 40-50 of flexion and about 80 of abduction, with 70-110 of axial rotation
// as it opposes. A resting hand is a cascade: each finger from index to little a little more bent than the last.
// DIP is driven with PIP when a finger is curled (about two-thirds of it), the way the tendons couple them.
import * as THREE from 'three';
import { FINGERS, THUMB, fingerBindQ, handSkeleton, setHalves } from './handgeo.js';

const D = Math.PI / 180;
export const LIMITS = { mcp: 90, pip: [105, 105, 100, 95], dip: 80, tmcp: 55, tip: 80 };

export const POSES = {
  // relaxed: the resting cascade (index least bent), thumb resting beside the index, a little opposed
  open: { f: [[-1, 18, 30, 14], [0, 22, 36, 17], [1, 27, 42, 20], [2, 32, 48, 23]], t: [4, 10, 8, 8, 10] },
  // a fist: fingers rolled tight into the palm, tips converging on the heel of the thumb, the thumb across the
  // middle phalanges of index and middle finger
  fist: { f: [[3, 84, 105, 74], [1, 87, 105, 76], [-3, 89, 100, 74], [-8, 90, 95, 70]], t: [30, 30, 38, 38, 26] },
  // pointing: the index straight out, the rest rolled up, the thumb laid over the middle finger
  point: { f: [[-2, 2, 4, 2], [1, 87, 105, 76], [-3, 89, 100, 74], [-8, 90, 95, 70]], t: [26, 24, 34, 30, 22] },
};

// The thumbs of the fist and the point: the pad laid across the backs of the curled middle phalanges.
function seat(pose, ks) {
  const b = ks.map(k => middleBack(pose, k, 0.55)), p = new THREE.Vector3(), n = new THREE.Vector3();
  for (const q of b) { p.addScaledVector(q.p, 1 / b.length).addScaledVector(q.n, (q.r + 0.0085) / b.length); n.add(q.n); }
  thumbOn(pose, p, n.normalize());
}
const T_LIM = [[-15, 65], [-10, 75], [-15, 80], [0, 55], [-10, 80]];
let seated = false;
export function seatThumbs() {
  if (seated) return;
  seated = true; seat(POSES.fist, [0, 1]); seat(POSES.point, [1, 2]);
  // at rest the thumb lies off the side of the index, a little in front of it, its pad turned toward it
  const ix = middleBack(POSES.open, 0, 0.2);
  thumbOn(POSES.open, ix.p.clone().add(new THREE.Vector3(-0.014, -0.018, -0.02)), new THREE.Vector3(-1, 0, -0.45).normalize(), [10, 10, 15, 15, 18],
    [T_LIM[0], T_LIM[1], [0, 40], [10, 30], [10, 35]]);   // a resting thumb is never straight
}

// The controller's handle lies across the palm, a little diagonal (from the root of the index to the heel
// of the hand): its axis in H, and where it sits for a handle of diameter d (the back of it on the palm).
export const HANDLE_DIR = new THREE.Vector3(1, -0.3, 0).normalize();
export const PALM_Z = 0.0145;                             // palm skin under the handle, in from the bone plane
export const handleAt = d => new THREE.Vector3(-0.005, 0.071, -(PALM_Z + d / 2));
export const CONTROLLER_D = 0.038;                        // a Quest Touch handle, about

// A hand closed round a handle of diameter d (a bar, a trophy's stem): each finger is closed joint by joint until
// that segment's pad touches it, the way a grasp closes, within each joint's range.
const holdCache = new Map();
export function holdPose(d) {
  seatThumbs();
  const key = d.toFixed(4);
  if (holdCache.has(key)) return holdCache.get(key);
  const R = d / 2, c0 = handleAt(d), f = FINGERS.map((fg, k) => {
    const inv = new THREE.Matrix4().compose(new THREE.Vector3(...fg.at), fingerBindQ(fg), new THREE.Vector3(1, 1, 1)).invert();
    const t = (fg.at[0] - c0.x) / HANDLE_DIR.x, c = c0.clone().addScaledVector(HANDLE_DIR, t).applyMatrix4(inv);   // the handle's axis where it crosses this finger's plane
    const cy = c.y, cz = c.z, pad = fg.d * 0.95, lim = [LIMITS.mcp, LIMITS.pip[k], LIMITS.dip], ang = [0, 0, 0];
    let jy = 0, jz = 0, phi = 0;
    for (let j = 0; j < 3; j++) {
      const L = fg.len[j] - (j === 2 ? 0.004 : 0);
      for (let a = 0; a <= lim[j]; a += 1) {
        const p = phi + a * D, ey = jy + L * Math.cos(p), ez = jz - L * Math.sin(p);
        if (segDist(cy, cz, jy, jz, ey, ez) <= R + pad) break;
        ang[j] = a;
      }
      phi += ang[j] * D; jy += fg.len[j] * Math.cos(phi); jz -= fg.len[j] * Math.sin(phi);
    }
    return [[2, 0, -3, -7][k] * Math.min(1, 0.03 / R), ang[0], ang[1], ang[2]];
  });
  // the thumb comes round the other way and lies along the handle's far side, its tip toward the fingers;
  // on a thick stem it can only reach part way round (the pose lerps between the two sizes measured by eye)
  // the thumb: round the far side of the handle from the radial end, its pad on the handle (or, on a thin bar,
  // on the back of the index finger wrapped round it)
  const pose = { f, t: [20, 30, 30, 25, 20] };
  const a = c0.clone().addScaledVector(HANDLE_DIR, (-0.03 - c0.x) / HANDLE_DIR.x), out = new THREE.Vector3(0, 0.45, -1).normalize();
  const onBar = middleBack(pose, 0, 0.6), k = Math.max(0, Math.min(1, (d - 0.026) / 0.02));
  const target = onBar.p.clone().addScaledVector(onBar.n, onBar.r + 0.008).lerp(a.clone().addScaledVector(out, R + 0.008), k);
  thumbOn(pose, target, onBar.n.clone().lerp(out, k).normalize(), pose.t, T_LIM, { c: c0, dir: HANDLE_DIR, R });
  holdCache.set(key, pose);
  return pose;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
}

export const newPose = () => ({ f: FINGERS.map(() => [0, 0, 0, 0]), t: [0, 0, 0, 0, 0] });
export const copyPose = (out, p) => { p.f.forEach((r, i) => r.forEach((v, j) => { out.f[i][j] = v; })); p.t.forEach((v, j) => { out.t[j] = v; }); return out; };
// out = sum of w_i pose_i (weights should add to 1)
export function mixPoses(out, list) {
  out.f.forEach(r => r.fill(0)); out.t.fill(0);
  for (const [p, w] of list) { if (!w) continue; p.f.forEach((r, i) => r.forEach((v, j) => { out.f[i][j] += v * w; })); p.t.forEach((v, j) => { out.t[j] += v * w; }); }
  return out;
}
// eases cur toward target (rate: 1 / seconds); joints that close quickly open a little slower, as hands do
export function easePose(cur, target, dt, rate = 22) {
  const k = 1 - Math.exp(-rate * dt), ko = 1 - Math.exp(-rate * 0.7 * dt);
  const step = (a, b) => a + (b - a) * (b > a ? k : ko);
  cur.f.forEach((r, i) => r.forEach((v, j) => { r[j] = step(v, target.f[i][j]); }));
  cur.t.forEach((v, j) => { cur.t[j] = step(v, target.t[j]); });
  return cur;
}

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
// puts a pose on a skeleton from handSkeleton()
export function applyPose(by, p) {
  FINGERS.forEach((fg, i) => {
    const [s, m, pi, di] = p.f[i];
    by[fg.name + '1'].quaternion.copy(by[fg.name + '1'].userData.bind).multiply(qa.setFromAxisAngle(Z, -s * D)).multiply(qb.setFromAxisAngle(X, -m * D));
    by[fg.name + '2'].quaternion.setFromAxisAngle(X, -pi * D);
    by[fg.name + '3'].quaternion.setFromAxisAngle(X, -di * D);
  });
  const [c1, c2, c3, tm, ti] = p.t, t1 = by.t1;
  // the base turns in the palm's frame (across it, out of it), then the thumb rolls on its own axis
  t1.quaternion.setFromAxisAngle(Z, -c1 * D).multiply(qa.setFromAxisAngle(X, -c2 * D)).multiply(t1.userData.bind).multiply(qb.setFromAxisAngle(Y, c3 * D));
  by.t2.quaternion.setFromAxisAngle(X, -tm * D);
  by.t3.quaternion.setFromAxisAngle(X, -ti * D);
  setHalves(by);
}

// The thumb placed by its pad: the five thumb angles (within their ranges) that put the pad of its tip on a spot,
// pressing toward it (n: the surface's outward normal there), staying as near `from` as it can. Coordinate search.
let SK;
export function thumbOn(pose, target, n, from = pose.t, lim = T_LIM, avoid = null) {
  SK = SK || handSkeleton();
  const by = SK.by, pad = new THREE.Vector3(), pn = new THREE.Vector3(), q = new THREE.Vector3(), t = from.slice(), m = new THREE.Matrix4();
  const cost = tt => {
    pose.t = tt; applyPose(by, pose); by.t1.updateMatrixWorld(true);
    m.copy(by.t3.matrixWorld);
    pad.set(0, THUMB.len[2] - 0.011, -0.0075).applyMatrix4(m);
    pn.set(0, 0, -1).transformDirection(m);
    let reg = 0, hit = 0; for (let j = 0; j < 5; j++) reg += ((tt[j] - from[j]) / 90) ** 2;
    if (avoid) for (const [b, y] of [['t1', THUMB.len[0] * 0.7], ['t2', 0], ['t2', THUMB.len[1] * 0.5], ['t3', 0], ['t3', THUMB.len[2] * 0.5], ['t3', THUMB.len[2] - 0.006]]) {
      q.set(0, y, 0).applyMatrix4(by[b].matrixWorld).sub(avoid.c);
      const e = avoid.R + 0.0095 - q.addScaledVector(avoid.dir, -q.dot(avoid.dir)).length();     // a thumb is about 2 cm through
      if (e > 0) hit += (e / 0.002) ** 2;
    }
    return pad.distanceToSquared(target) / 1e-4 + 0.4 * (1 + pn.dot(n)) + 0.02 * reg + hit;
  };
  let best = cost(t);
  for (let step = 16; step > 0.4; step /= 2) {
    for (let it = 0, moved = true; moved && it < 40; it++) {
      moved = false;
      for (let j = 0; j < 5; j++) for (const sg of [1, -1]) {
        const tt = t.slice(); tt[j] = Math.max(lim[j][0], Math.min(lim[j][1], tt[j] + sg * step));
        const c = cost(tt);
        if (c < best - 1e-9) { best = c; t.splice(0, 5, ...tt); moved = true; }
      }
    }
  }
  pose.t = t;
  return Math.sqrt(Math.max(0, best)) ;
}
// where a curled finger's middle phalanx is, with the way its back faces (for the thumb to lie on)
export function middleBack(pose, k, along = 0.5) {
  SK = SK || handSkeleton();
  applyPose(SK.by, pose); SK.by.root.updateMatrixWorld(true);
  const f = FINGERS[k], m = SK.by[f.name + '2'].matrixWorld;
  return { p: new THREE.Vector3(0, f.len[1] * along, 0).applyMatrix4(m), n: new THREE.Vector3(0, 0, 1).transformDirection(m), r: f.d * 0.85 };
}
export { THUMB };
