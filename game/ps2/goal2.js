// The '04-look goal: round white posts and bar, thin grey stanchions holding a box net, corner flags
// (one lit mesh), and the net (one mesh): a painted 12 cm mesh, alpha blended so it stays a grey veil
// far off rather than vanishing, that bulges where the ball hits it (in its vertex shader).
import * as THREE from 'three';
import { GOAL, PITCH } from '../../rules/tuning.js';
import { netTexture } from './groundtex.js';

const P = GOAL.post, H = GOAL.h, HW = GOAL.halfW, Z = GOAL.z, ZB = GOAL.z - GOAL.depth, HB = H * 0.82;

// a tube from a to b (radius r, n sides), coloured
function tube(parts, a, b, r, color, n = 12) {
  const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), n, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(b, a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  parts.push([g, new THREE.Color(color)]);
}
function merge(parts) {
  const pos = [], nor = [], col = [], idx = [];
  for (const [g0, c] of parts) {
    const g = g0.index ? g0 : g0, b = pos.length / 3, p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
    if (g.index) for (const i of g.index.array) idx.push(b + i); else for (let i = 0; i < p.count; i++) idx.push(b + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// A grid panel of the net: corner(u, v) gives the rest position, dir its push when hit, uv in metres.
function panel(out, nu, nv, corner, dir, fixed) {
  const b = out.pos.length / 3, p = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv; corner(u, v, p);
    out.pos.push(p.x, p.y, p.z); out.dir.push(...dir); out.free.push(fixed(u, v));
    out.uv.push(p.x + p.z * (dir[0] !== 0 ? 1 : 0), p.y + (dir[1] > 0.3 ? p.z : 0));
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = b + j * (nu + 1) + i; out.idx.push(a, a + 1, a + nu + 2, a, a + nu + 2, a + nu + 1); }
}

export function buildGoal2(light) {
  const group = new THREE.Group(), parts = [], V = (x, y, z) => new THREE.Vector3(x, y, z), X = HW + P;
  // posts and bar (the goal is 7.32 x 2.44 inside them), round, white
  tube(parts, V(-X, 0, Z), V(-X, H + P, Z), P, '#f4f4f2', 14); tube(parts, V(X, 0, Z), V(X, H + P, Z), P, '#f4f4f2', 14);
  tube(parts, V(-X - P, H + P, Z), V(X + P, H + P, Z), P, '#f4f4f2', 14);
  // stanchions: the rear frame that holds the net out
  for (const s of [-1, 1]) {
    tube(parts, V(s * X, H + P, Z - 0.05), V(s * X, HB, ZB), 0.022, '#9ea2a8', 6);
    tube(parts, V(s * X, HB, ZB), V(s * X, 0, ZB - 0.2), 0.022, '#9ea2a8', 6);
    tube(parts, V(s * X, 0.02, Z - 0.05), V(s * X, 0.02, ZB - 0.2), 0.022, '#9ea2a8', 6);
  }
  tube(parts, V(-X, HB, ZB), V(X, HB, ZB), 0.022, '#9ea2a8', 6);
  // corner flags at the two corners on the goal line
  for (const s of [-1, 1]) {
    tube(parts, V(s * PITCH.halfW, 0, Z), V(s * PITCH.halfW, 1.55, Z), 0.018, '#f2d21a', 6);
    const f = new THREE.PlaneGeometry(0.42, 0.3); f.translate(s * (PITCH.halfW - 0.21), 1.4, Z); parts.push([f, new THREE.Color('#d81a2a')]);
  }
  const frame = new THREE.Mesh(merge(parts), new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x444444, shininess: 30, emissive: 0x4a4a4a, side: THREE.DoubleSide }));
  group.add(frame);

  // the net: top, back and sides; fixed where it's tied to the frame and the ground
  const net = { pos: [], uv: [], dir: [], free: [], idx: [] }, mid = (u, v) => Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
  panel(net, 18, 9, (u, v, p) => p.set(-X + 2 * X * u, HB * (1 - v), ZB - 0.2 * v), [0, 0, -1], mid);                            // back, top to ground
  panel(net, 18, 4, (u, v, p) => p.set(-X + 2 * X * u, H + P - (H + P - HB) * v, Z - 0.05 - (Z - 0.05 - ZB) * v), [0, 0.5, -0.8], (u, v) => Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 0.5 + 0.5)) * 0.6);   // roof
  for (const s of [-1, 1]) panel(net, 5, 9, (u, v, p) => { const top = H + P - (H + P - HB) * u; p.set(s * X, top * (1 - v), Z - 0.05 - (Z - 0.05 - ZB) * u - 0.2 * v * u); }, [s * 1, 0, -0.4], mid);   // sides
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(net.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(net.uv, 2));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(net.dir, 3)); g.setAttribute('aFree', new THREE.Float32BufferAttribute(net.free, 1));
  g.setIndex(net.idx);
  const hitU = { uHit: { value: new THREE.Vector3(0, 1, ZB) }, uAge: { value: 9 } };
  const mat = new THREE.ShaderMaterial({
    fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...light, ...hitU, uMap: { value: netTexture() } },
    vertexShader: `attribute vec3 aDir; attribute float aFree; uniform vec3 uHit; uniform float uAge; varying vec2 vUv;
${THREE.ShaderChunk.fog_pars_vertex}
void main() { vUv = uv; vec3 p = position;
  float k = uAge - 0.06, amp = uAge < 1.6 ? 0.6 * (k < 0.0 ? uAge / 0.06 : exp(-k * 4.0) * cos(k * 8.0)) : 0.0, d2 = dot(p.xy - uHit.xy, p.xy - uHit.xy);
  p += normalize(aDir) * amp * exp(-d2 * 0.9) * aFree * 1.4;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
${THREE.ShaderChunk.fog_vertex}
}`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uAmb, uSun, uFlood; varying vec2 vUv;
${THREE.ShaderChunk.fog_pars_fragment}
void main() { float a = texture2D(uMap, vUv).a; if (a < 0.04) discard; gl_FragColor = vec4(vec3(0.92) * (uAmb + uSun * 0.6 + uFlood * 0.9), min(1.0, a * 1.15));
${THREE.ShaderChunk.fog_fragment}
}`,
  });
  const netMesh = new THREE.Mesh(g, mat); netMesh.renderOrder = 2;
  group.add(netMesh);
  return {
    group, tris: frame.geometry.index.count / 3 + net.idx.length / 3,
    hit(x, y) { hitU.uHit.value.set(x, y, ZB); hitU.uAge.value = 0; },
    update(dt) { if (hitU.uAge.value < 2) hitU.uAge.value += dt; },
  };
}
