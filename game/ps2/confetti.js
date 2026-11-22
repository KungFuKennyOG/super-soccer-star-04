// What goes off when the cup goes up (game/trophy.js), each one draw call, all moved in the vertex shader:
//   confetti: foil strips in your colours blown from a cannon either side of the stage, fluttering down,
//     lying where they land, then more falling from above for as long as it lasts; lit by the scene's lights.
//   jets: spark fountains at the stage's corners for a few seconds.
//   flashes: camera flashes in the stands and from the photographers in front of the stage.
// Everything is in the stage's frame (game/ps2/stage.js).
import * as THREE from 'three';
import { STAGE, CANNONS, JETS } from './stage.js';

const rnd = (() => { let s = 12345; return () => ((s = Math.imul(s, 1664525) + 1013904223 | 0) >>> 0) / 4294967296; })();

// colors: css colours (your kit's and a little white and gold). fire() sets it off; update(t, sun) every frame.
export function buildConfetti(colors, n = 1100) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const a = new Float32Array(n * 4), b = new Float32Array(n * 4), c = new Float32Array(n * 3), col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    a.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    b.set([rnd(), rnd(), rnd(), i % 2], i * 4);                                  // (w: which cannon)
    col.set(colors[Math.floor(rnd() * colors.length)]); c.set([col.r, col.g, col.b], i * 3);
  }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('aB', new THREE.InstancedBufferAttribute(b, 4)); g.setAttribute('aCol', new THREE.InstancedBufferAttribute(c, 3));
  const uniforms = {
    uT: { value: -1 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uKey: { value: new THREE.Color(1, 1, 1) }, uAmb: { value: new THREE.Color(0.5, 0.5, 0.5) },
    uC0: { value: new THREE.Vector3(...CANNONS[0]) }, uC1: { value: new THREE.Vector3(...CANNONS[1]) },
    uStage: { value: new THREE.Vector4(STAGE.halfW, STAGE.front, STAGE.back, STAGE.h) }, uRiser: { value: new THREE.Vector3(STAGE.riserHalfW, STAGE.riserBack, STAGE.riser) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, fog: false,
    vertexShader: `uniform float uT; uniform vec3 uSun, uKey, uAmb, uC0, uC1, uRiser; uniform vec4 uStage;
attribute vec4 aA, aB; attribute vec3 aCol; varying vec3 vCol;
mat3 rot(vec3 ax, float an) { float s = sin(an), c = cos(an), o = 1.0 - c; return mat3(o*ax.x*ax.x+c, o*ax.x*ax.y+ax.z*s, o*ax.z*ax.x-ax.y*s, o*ax.x*ax.y-ax.z*s, o*ax.y*ax.y+c, o*ax.y*ax.z+ax.x*s, o*ax.z*ax.x+ax.y*s, o*ax.y*ax.z-ax.x*s, o*ax.z*ax.z+c); }
void main() {
  // three blasts in the first three seconds, then each strip comes round again from above
  float t0 = floor(aA.x * 3.0) * 1.15 + aA.y * 0.35, L = 13.0 + aA.z * 5.0, tt = uT - t0;
  float n = floor(tt / L), tau = tt - n * L, fall = 0.75 + aA.w * 0.7, k = 1.1 + aB.x * 0.9;
  vec3 vt = vec3(0.0, -fall, 0.0), p0, v0;
  if (n < 0.5) {
    vec3 c = aB.w < 0.5 ? uC0 : uC1; float sd = aB.w < 0.5 ? 1.0 : -1.0;
    p0 = c; v0 = vec3(sd * (2.0 + aB.y * 9.0), 11.0 + aB.z * 9.0, (aA.w - 0.5) * 9.0 - 1.0);
  } else {
    p0 = vec3((aB.y - 0.5) * 17.0, 8.5 + aB.z * 4.0, (aA.w - 0.5) * 12.0 - 0.5); v0 = vt;
  }
  vec3 p = p0 + vt * tau + (v0 - vt) * (1.0 - exp(-k * tau)) / k;
  float sw = min(tau, 3.0) / 3.0;
  p.x += sin(tau * (1.3 + aB.x) + aA.x * 40.0) * 0.35 * sw; p.z += cos(tau * (1.1 + aA.y) + aB.y * 40.0) * 0.3 * sw;
  // the floor under it: the riser, the platform or the grass
  float fl = 0.0;
  if (abs(p.x) < uStage.x && p.z > uStage.y && p.z < uStage.z) fl = uStage.w;
  if (abs(p.x) < uRiser.x && p.z >= uStage.z && p.z < uRiser.y) fl = uStage.w + uRiser.z;
  float down = step(p.y, fl + 0.012);
  p.y = max(p.y, fl + 0.012 + aA.x * 0.006);
  // tumbling about its long axis while it falls; flat on the floor
  vec3 ax = normalize(vec3(aA.x - 0.5, 0.25, aB.z - 0.5));
  mat3 R = rot(ax, tau * (5.0 + aA.z * 9.0) + aA.w * 30.0) * rot(vec3(0.0, 1.0, 0.0), aB.y * 6.28 + tau * 1.3);
  if (down > 0.5) R = rot(vec3(0.0, 1.0, 0.0), aB.y * 6.28) * rot(vec3(1.0, 0.0, 0.0), 1.5708);
  float life = (uT < 0.0 || tt < 0.0) ? 0.0 : smoothstep(L, L - 0.6, tau);
  vec3 q = R * (position * vec3(0.045, 0.11 + aB.x * 0.05, 1.0) * life);
  vec3 nrm = R * vec3(0.0, 0.0, 1.0);
  float d = abs(dot(nrm, uSun)), sp = pow(d, 24.0);
  vCol = aCol * (uAmb + uKey * (0.25 + 0.75 * d)) + uKey * sp * 0.55;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p + q, 1.0);
}`,
    fragmentShader: 'varying vec3 vCol; void main() { gl_FragColor = vec4(vCol, 1.0); }',
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.name = 'confetti';
  let t0 = -1;
  return {
    mesh, tris: n * 2,
    fire(t) { if (t0 < 0) { t0 = t; mesh.visible = true; } },
    stop() { t0 = -1; mesh.visible = false; },
    // sun: direction to the key light; key, amb: its colour and the fill, as the scene's lights have them
    update(t, sun, key, amb) { if (t0 < 0) return; uniforms.uT.value = t - t0; uniforms.uSun.value.copy(sun); uniforms.uKey.value.copy(key); uniforms.uAmb.value.copy(amb); },
  };
}

// Spark fountains: streaks thrown up from each unit, falling back. fire(t, secs) burns them for secs.
export function buildJets(per = 110) {
  const n = per * JETS.length, g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const a = new Float32Array(n * 4), o = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a.set([rnd(), rnd(), rnd(), rnd()], i * 4); o.set(JETS[i % JETS.length], i * 3); }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('aAt', new THREE.InstancedBufferAttribute(o, 3));
  const uniforms = { uT: { value: -1 }, uBurn: { value: 5 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    vertexShader: `uniform float uT, uBurn; attribute vec4 aA; attribute vec3 aAt; varying vec3 vCol;
void main() {
  float life = 0.75 + aA.x * 0.5, tau = mod(uT + aA.y * life, life), born = uT - tau;
  float on = step(0.0, born) * step(born, uBurn) * step(0.0, uT);
  float an = aA.z * 6.2832, sp = 0.5 + aA.w * 0.8;
  vec3 v0 = vec3(cos(an) * sp, 6.2 + aA.x * 3.6, sin(an) * sp);
  vec3 p = aAt + v0 * tau + vec3(0.0, -4.9 * tau * tau, 0.0), v = v0 + vec3(0.0, -9.8 * tau, 0.0);
  vec4 a = viewMatrix * modelMatrix * vec4(p, 1.0), b = viewMatrix * modelMatrix * vec4(p - v * 0.045, 1.0);
  vec2 d = normalize(b.xy - a.xy + vec2(1e-5)), s = vec2(-d.y, d.x);
  vec4 mv = mix(a, b, position.y); mv.xy += s * position.x * 0.035;
  float k = tau / life;
  vCol = mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.5, 0.12), k) * (1.0 - k * k) * on * 1.3;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: 'varying vec3 vCol; void main() { gl_FragColor = vec4(vCol, 1.0); }',
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 6; mesh.name = 'jets';
  let t0 = -1;
  return {
    mesh, tris: n * 2,
    fire(t, secs = 5) { t0 = t; uniforms.uBurn.value = secs; mesh.visible = true; },
    stop() { t0 = -1; mesh.visible = false; },
    get burning() { return t0 >= 0; },
    update(t) { if (t0 < 0) return; uniforms.uT.value = t - t0; if (t - t0 > uniforms.uBurn.value + 1.4) { t0 = -1; mesh.visible = false; } },
  };
}

// Camera flashes: points (stage frame) that each pop white for a few hundredths of a second now and then.
// near: how many of the first points are the photographers' (they fire more often and look bigger).
export function buildFlashes(points, near = 0) {
  const n = points.length, g = new THREE.BufferGeometry(), a = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) a.set([rnd(), i < near ? 1 : 0], i * 2);
  g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3)); g.setAttribute('aA', new THREE.BufferAttribute(a, 2));
  const uniforms = { uT: { value: 0 }, uRate: { value: 0.1 }, uPx: { value: 600 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `uniform float uT, uRate, uPx; attribute vec2 aA; varying float vK;
void main() {
  float slot = uT * 9.0 + aA.x * 31.0, i = floor(slot), f = slot - i;
  float h = fract(sin(i * 12.9898 + aA.x * 4321.7) * 43758.5453);
  vK = step(h, uRate * (0.35 + aA.y * 0.9)) * (1.0 - smoothstep(0.25, 0.75, f));
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = vK > 0.0 ? clamp(uPx * (0.5 + aA.y * 0.25) / -mv.z, 2.5, 46.0) : 0.0;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `varying float vK; void main() { vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
  float k = (1.0 - smoothstep(0.0, 1.0, r)); k = k * k + 0.6 * max(0.0, 1.0 - abs(c.y) * 14.0) * (1.0 - r) + 0.6 * max(0.0, 1.0 - abs(c.x) * 14.0) * (1.0 - r);
  gl_FragColor = vec4(vec3(0.92, 0.96, 1.0) * k * vK, 1.0); }`,
  });
  const mesh = new THREE.Points(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 7; mesh.name = 'flashes';
  return {
    mesh,
    // rate: 0..1, how busy (0.06 waiting, 0.5 when the cup goes up); px: the drawing buffer's height
    update(t, rate, px) { uniforms.uT.value = t; uniforms.uRate.value = rate; uniforms.uPx.value = px * 0.55; },
  };
}
