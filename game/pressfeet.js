// The press photographers' feet and a check on their arms (game/presscast.js).
// Feet: a man on his feet keeps each boot where he put it down (stage frame) while his hips sway, lean and turn
// over them; when he has moved far enough that a foot is left behind its place under him it steps after him, one
// foot at a time, never both in the air. Built (how people shuffle sideways along a row: step, close, step).
import * as THREE from 'three';
import { CAMERA } from './ps2/press.js';

const STEP = { far: 0.12, time: 0.3, lift: 0.05, lead: 0.2, wide: 0.16, ahead: 0.1 };
export const createSteps = () => ({ L: { x: 0, z: 0, lift: 0, k: 1, set: false }, R: { x: 0, z: 0, lift: 0, k: 1, set: false } });
const sm = x => x * x * (3 - 2 * x);
// feet: from createSteps. a: his act (px, pz, vx, vz). yaw: the way he faces. sd: which foot is ahead (+1 left).
export function stepFeet(feet, a, yaw, sd, dt) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw), sp = Math.hypot(a.vx, a.vz);
  let worst = null, far = STEP.far * (sp > 0.05 ? 0.75 : 1);
  for (const n of ['L', 'R']) {
    const f = feet[n], s = n === 'L' ? 1 : -1, lx = s * STEP.wide, lz = s * sd * STEP.ahead;
    f.hx = a.px + lx * cs + lz * sn + a.vx * STEP.lead; f.hz = a.pz - lx * sn + lz * cs + a.vz * STEP.lead;      // his place under the man (a little ahead of where he's going)
    if (!f.set) { f.x = f.hx; f.z = f.hz; f.set = true; }
    if (f.k < 1) {
      f.k = Math.min(1, f.k + dt / STEP.time); const k = sm(f.k);
      f.x = f.sx + (f.tx - f.sx) * k; f.z = f.sz + (f.tz - f.sz) * k; f.lift = STEP.lift * Math.sin(Math.PI * f.k);
    } else { f.lift = 0; const d = Math.hypot(f.hx - f.x, f.hz - f.z); if (d > far) { far = d; worst = f; } }
  }
  if (worst && feet.L.k >= 1 && feet.R.k >= 1) { worst.k = 0; worst.sx = worst.x; worst.sz = worst.z; worst.tx = worst.hx + a.vx * STEP.time * 0.5; worst.tz = worst.hz + a.vz * STEP.time * 0.5; }
}

// How far his arms are inside himself or his camera (metres; 0 = clear). The trunk as an oval column from hips to
// neck (0.17 wide, 0.12 deep at the middle of an arm's thickness away), the head as a ball, the camera's body and
// barrel as boxes; the arm as points from the shoulder to just short of the wrist (the hand is on the camera).
const s0 = new THREE.Vector3(), s1 = new THREE.Vector3(), s2 = new THREE.Vector3(), pt = new THREE.Vector3(), ax = new THREE.Vector3(), c0 = new THREE.Vector3(), c1 = new THREE.Vector3(), hd = new THREE.Vector3(), q = new THREE.Quaternion(), rootInv = new THREE.Matrix4(), camInv = new THREE.Matrix4();
const ARM = 0.042;
export function armsClear(bn, camLocal) {
  const root = bn.hips.parent; rootInv.copy(root.matrixWorld).invert(); camInv.copy(camLocal).invert();
  const loc = (b, o) => b.getWorldPosition(o).applyMatrix4(rootInv);
  loc(bn.hips, c0); loc(bn.neck, c1); loc(bn.head, hd); hd.y += 0.1;
  bn.chest.getWorldQuaternion(q); const rq = new THREE.Quaternion().setFromRotationMatrix(rootInv); q.premultiply(rq);
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(q), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  ax.subVectors(c1, c0); const len = ax.length(); ax.normalize();
  let trunk = 0, head = 0, cam = 0;
  for (const n of ['L', 'R']) {
    loc(bn['upperArm' + n], s0); loc(bn['foreArm' + n], s1); loc(bn['hand' + n], s2);
    for (let i = 0; i <= 16; i++) {
      const k = i / 16; if (k < 0.5) pt.lerpVectors(s0, s1, k * 2); else pt.lerpVectors(s1, s2, (k - 0.5) * 2 * 0.9);
      if (k > 0.2) {                                                    // (the top of the arm is the shoulder itself)
        const d = pt.clone().sub(c0), h = d.dot(ax);
        if (h > 0 && h < len) { const x = d.dot(side) / (0.17 + ARM), z = d.dot(fwd) / ((d.dot(fwd) > 0 ? 0.125 : 0.11) + ARM), rr = Math.hypot(x, z); if (rr < 1) trunk = Math.max(trunk, (1 - rr) * 0.17); }
      }
      head = Math.max(head, 0.1 + ARM - pt.distanceTo(hd));
      const c = pt.clone().applyMatrix4(camInv);
      const inBox = (cx, cy, cz, hx, hy, hz) => Math.min(hx + ARM - Math.abs(c.x - cx), hy + ARM - Math.abs(c.y - cy), hz + ARM - Math.abs(c.z - cz));
      if (k < 0.85) cam = Math.max(cam, inBox(0, -0.015, 0.04, 0.075, 0.05, 0.033), inBox(0, -0.012, 0.21, 0.05, 0.05, 0.14), inBox(0, CAMERA.flash[1] - 0.02, 0.05, 0.038, 0.045, 0.04));
    }
  }
  return { trunk: Math.max(0, trunk), head: Math.max(0, head), cam: Math.max(0, cam) };
}
