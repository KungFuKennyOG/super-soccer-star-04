// The '04 ball: a smooth sphere with a painted cover and a little gloss, and a soft shadow under it.
// The design is invented (a five-pointed star round each of the ball's twelve corners, a thin seam ring
// between them), never a real match ball's. The locker's balls are the same cover in other colors.
// Same thing game/actors.js's old PS1 buildBall returned: { mesh, shadow, setDesign(name), update(ball, dt) }.
import * as THREE from 'three';
import { BALL } from '../../rules/tuning.js';
import { canvas, eachPixel, smoothTex, gauss } from './paint.js';

// [cover, star panels, every other star (optional), seam]: 0..255
export const BALL_DESIGNS = {
  CLASSIC: [[236, 236, 232], [26, 34, 74]],
  ORANGE: [[244, 128, 28], [32, 22, 18]],
  STAR: [[238, 238, 234], [176, 22, 32], [24, 40, 120]],
  RETRO: [[168, 110, 58], [104, 62, 30], [196, 146, 82]],
  GOLD: [[232, 188, 70], [92, 58, 16], [200, 150, 40]],
};

let corners = null;
function cornersOf() {
  if (corners) return corners;
  const ico = new THREE.IcosahedronGeometry(1, 0), ip = ico.attributes.position, v = new THREE.Vector3();
  corners = [];
  for (let i = 0; i < ip.count; i++) { v.fromBufferAttribute(ip, i).normalize(); if (!corners.some(c => c.distanceTo(v) < 1e-3)) corners.push(v.clone()); }
  return corners;
}

// The cover, painted once per design on a 512 x 256 equirectangular sheet (SphereGeometry's uv).
const covers = new Map();
export function coverTex(name) {
  const key = BALL_DESIGNS[name] ? name : 'CLASSIC';
  if (covers.has(key)) return covers.get(key);
  const [base, pan, alt] = BALL_DESIGNS[key], ks = cornersOf();
  const c = canvas(512, 256), ctx = c.getContext('2d');
  const v = new THREE.Vector3(), up = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  eachPixel(ctx, { x: 0, y: 0, w: 512, h: 256 }, (u, t, col) => {
    const th = t * Math.PI, ph = u * Math.PI * 2;
    v.set(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
    let bi = 0, d = -1;
    for (let i = 0; i < ks.length; i++) { const q = ks[i].dot(v); if (q > d) { d = q; bi = i; } }
    const best = ks[bi], p = alt && bi % 2 ? alt : pan;
    up.set(0.3, 1, 0.2).cross(best).normalize(); a.copy(best).cross(up); b.copy(v).sub(best);
    const ang = Math.atan2(b.dot(a), b.dot(up)), r = Math.acos(Math.min(1, d)), star = 0.17 + 0.3 * Math.max(0, Math.cos(ang * 5)) ** 1.5;
    const k = 1 - Math.min(1, Math.max(0, (r - star) / 0.012 + 0.5)), rim = gauss(r, star + 0.035, 0.012) * 0.5;
    const seam = 1 - 0.18 * gauss(r, 0.56, 0.01);
    for (let j = 0; j < 3; j++) col[j] = (base[j] * (1 - k) + p[j] * k) * seam * (1 - rim * [0.5, 0.45, 0.2][j]);
  });
  const tx = smoothTex(c);
  covers.set(key, tx);
  return tx;
}

let shadowMat;
function softShadow() {
  if (!shadowMat) {
    const c = canvas(64, 64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(4,16,8,0.6)'); gr.addColorStop(0.55, 'rgba(4,16,8,0.28)'); gr.addColorStop(1, 'rgba(4,16,8,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    shadowMat = new THREE.MeshBasicMaterial({ map: smoothTex(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), shadowMat);
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return m;
}

export function buildBall04() {
  const mat = new THREE.MeshPhongMaterial({ map: coverTex('CLASSIC'), specular: 0x555555, shininess: 40 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL.r, 20, 14), mat);
  const shadow = softShadow();
  const axis = new THREE.Vector3(), q = new THREE.Quaternion();
  return {
    mesh, shadow,
    setDesign(name) { mat.map = coverTex(name); mat.needsUpdate = true; },
    update(bl, dt) {
      mesh.position.set(bl.x, bl.y, bl.z);
      const h = Math.hypot(bl.vx, bl.vz);
      if (h > 0.05) { axis.set(bl.vz / h, 0, -bl.vx / h); q.setFromAxisAngle(axis, h / BALL.r * dt); mesh.quaternion.premultiply(q); }
      // under the ball, thrown a little along the sun as it rises, softer and smaller the higher it is
      shadow.position.set(bl.x + bl.y * 0.25, 0.021, bl.z - bl.y * 0.12);
      const s = Math.max(0.35, 1 - bl.y * 0.15); shadow.scale.set(s, s, s);
    },
  };
}
