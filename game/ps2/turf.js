// The '04-look pitch for the grounds: one quad, the grass from game/ps2/pitch.js's texture, mown in
// the recipe's pattern (stripes 6 m, wide 12 m, checks 12 m squares, bands starting on the goal line),
// a worn goalmouth, the stands' shadow on a sunny day, a pool of floodlight at night, a running track
// where the recipe has one, wet and snowed-over looks. And the white lines of the half pitch.
import * as THREE from 'three';
import { ARENA } from './arena.js';
import { canvas, hash, vnoise, eachPixel, smoothTex } from './paint.js';

const FOG = [THREE.ShaderChunk.fog_pars_vertex, THREE.ShaderChunk.fog_vertex, THREE.ShaderChunk.fog_pars_fragment, THREE.ShaderChunk.fog_fragment];
export const MOW = { stripes: [0, 6], wide: [0, 12], checks: [1, 12] };

let grass = null;
function grassTex() {
  if (grass) return grass;
  const c = canvas(256, 256), ctx = c.getContext('2d');
  eachPixel(ctx, { x: 0, y: 0, w: 256, h: 256 }, (u, v, col, px, py) => {
    const blade = vnoise(px * 0.8, py * 0.3, 1, 0) * 0.6 + vnoise(px * 0.4 + 40, py * 0.16, 2, 0) * 0.4;
    const clump = (vnoise(px / 32 * 4, py / 32 * 4, 3, 32) + vnoise(px / 64 * 4, py / 64 * 4, 4, 16)) * 0.5;
    col[0] = col[1] = col[2] = 128 + 104 * (blade - 0.5) + 44 * (clump - 0.5) + 22 * (hash(px, py, 5) - 0.5);
  });
  grass = smoothTex(c, { repeat: [1, 1], aniso: 8 });
  return grass;
}

// light: the shared ground light uniforms (groundmat.js groundLight)
export function buildTurf(light) {
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...light, uGrass: { value: grassTex() },
    uMow: { value: new THREE.Vector2(0, 6) }, uGoalZ: { value: ARENA.goalZ }, uFull: { value: ARENA.full ? 1 : 0 },
    uShade: { value: new THREE.Vector4(-99, 99, 0, 0) },     // in the stands' shadow: x below .x, z above .y; .z how dark
    uTrackIn: { value: new THREE.Vector4(0, 0, 0, 0) },       // a track: inner half-sizes (x, z), centre z, width (0: none)
    uBox: { value: new THREE.Vector3(99, -99, 99) },          // the grass ends at the stands: half-width, far z, near z
  };
  const mat = new THREE.ShaderMaterial({
    fog: true, uniforms,
    vertexShader: `varying vec3 vW; varying vec3 vV;
${FOG[0]}
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vV = cameraPosition - w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
${FOG[1]}
}`,
    fragmentShader: `uniform sampler2D uGrass; uniform vec2 uMow; uniform float uGoalZ, uFull, uWet, uSnow, uTime; uniform vec4 uShade, uTrackIn; uniform vec3 uBox; uniform vec3 uAmb, uSun, uFlood; varying vec3 vW; varying vec3 vV;
${FOG[2]}
float sq(float x, float e) { return clamp((abs(fract(x * 0.5) - 0.5) * 4.0 - 1.0) / e, -1.0, 1.0); }   // a soft square wave, -1 / 1 a band
void main() {
  vec2 p = vW.xz;
  float bz = (p.y - uGoalZ) / uMow.y, bx = p.x / uMow.y + 0.5, e = fwidth(bz) * 3.0 + 0.04;
  float k = uMow.x < 0.5 ? sq(bz, e) : sq(bz, e) * sq(bx, e);
  vec3 col = mix(vec3(0.235, 0.36, 0.15), vec3(0.29, 0.43, 0.17), 0.5 + 0.5 * k);
  float d = length(vV), near = 0.5 * (texture2D(uGrass, p * 0.45).r + texture2D(uGrass, p.yx * 0.39 + 0.3).r), far = texture2D(uGrass, p.yx * 0.06).r;
  col *= 0.36 + 0.9 * mix(near, 0.5, smoothstep(5.0, 28.0, d)) + 0.36 * far;
  // the goalmouth and the penalty spot, worn
  float wy = uFull > 0.5 ? -abs(p.y) : p.y;     // a whole pitch: both goalmouths worn
  float wear = exp(-pow((p.x) / 3.2, 2.0) - pow((wy - uGoalZ - 2.2) / 2.0, 2.0)) * 0.7 + exp(-pow(p.x / 1.0, 2.0) - pow((wy - uGoalZ - 11.0) / 1.0, 2.0)) * 0.5;
  wear *= 0.6 + 0.4 * far;
  col = mix(col, vec3(0.36, 0.32, 0.22) * (0.7 + 0.6 * near), clamp(wear, 0.0, 0.8));
  // a running track: a rounded oval round the pitch, red with lanes
  if (uTrackIn.w > 0.0) {
    vec2 q = abs(vec2(p.x, p.y - uTrackIn.z)) - uTrackIn.xy + 8.0;
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 8.0;
    if (sd > 0.0 && sd < uTrackIn.w) {
      float lane = fract(sd / 1.22), lw = fwidth(sd / 1.22) * 1.5 + 0.03;
      col = vec3(0.6, 0.24, 0.16) * (0.8 + 0.3 * near);
      col = mix(col, vec3(0.9), (1.0 - smoothstep(0.0, lw, lane)) * step(0.3, sd) + (1.0 - smoothstep(0.0, 0.08, sd)));
    }
  }
  // outside the stands: a concourse of grey concrete
  if (abs(p.x) > uBox.x || p.y < uBox.y || p.y > uBox.z) col = vec3(0.34, 0.34, 0.35) * (0.7 + 0.5 * far);
  float shade = (1.0 - smoothstep(uShade.x - 0.8, uShade.x + 0.8, p.x)) + smoothstep(uShade.y - 0.8, uShade.y + 0.8, p.y);
  float sunK = 1.0 - uShade.z * clamp(shade, 0.0, 1.0);
  float pool = 1.0 - 0.45 * (uFull > 0.5 ? smoothstep(30.0, 90.0, length(vec2(p.x, p.y * 0.7))) : smoothstep(18.0, 55.0, length(vec2(p.x, p.y + 16.0))));
  vec3 light = uAmb + uSun * 0.87 * sunK + uFlood * pool;
  col *= light;
  // wet: darker, and a glossy sheen toward the horizon; snow: white, worn through in the goalmouth
  float graze = pow(1.0 - abs(normalize(vV).y), 5.0);
  col *= 1.0 - 0.28 * uWet;
  col = mix(col, vec3(0.5, 0.63, 0.4) * (light * 0.9), (0.3 + 0.35 * uWet) * graze);
  float flake = 0.82 + 0.18 * near;
  vec3 snow = vec3(0.86, 0.89, 0.95) * flake * light;
  col = mix(col, snow, uSnow * clamp(1.0 - wear * 1.4 + 0.2 * (far - 0.5), 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
${FOG[3]}
}`,
  });
  mat.extensions = { derivatives: true };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.full ? 300 : 220, ARENA.full ? 320 : 200), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.z = ARENA.full ? 0 : -20;
  return {
    mesh, uniforms,
    // recipe: mowing pattern; plan: groundplan.js (track, and the stands that throw shadow on a sunny day)
    set(recipe, plan, sunK) {
      uniforms.uMow.value.set(...(MOW[recipe.mow] || MOW.stripes));
      uniforms.uBox.value.set(plan.sideX + 1, plan.endZ - 1, plan.nearZ + 1);
      const t = plan.track;
      uniforms.uTrackIn.value.set(t ? t.inX : 0, t ? (t.inZ1 - t.inZ0) / 2 : 0, t ? (t.inZ1 + t.inZ0) / 2 : 0, t ? Math.min(t.outX - t.inX, t.inZ0 - t.outZ0) : 0);
      // the left stand and the one behind you are between the sun and the pitch (LIGHT_DIR: from -x, +z)
      const edge = s => (s.p.roof ? [s.p.roof.zFront, s.p.roof.y + 0.6] : [s.p.back, s.p.wallTop]);
      const [lz, lh] = edge(plan.stands[1]), [nz, nh] = edge(plan.stands[3]);
      uniforms.uShade.value.set(-plan.sideX + lz + lh * 0.45, plan.nearZ - nz - nh * 0.35, sunK, 0);
    },
  };
}

// The white lines of the half pitch (as game/stadium.js marks them), each a soft-edged strip.
export function buildMarkings(light) {
  const pos = [], uv = [], idx = [];
  const seg = (x1, z1, x2, z2, W = 0.12) => {
    const dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz) || 1, nx = -dz / l * W, nz = dx / l * W, ex = dx / l * W / 2, ez = dz / l * W / 2, b = pos.length / 3;
    pos.push(x1 - ex + nx, 0.008, z1 - ez + nz, x1 - ex - nx, 0.008, z1 - ez - nz, x2 + ex + nx, 0.008, z2 + ez + nz, x2 + ex - nx, 0.008, z2 + ez - nz);
    uv.push(1, 0, -1, 0, 1, 1, -1, 1);
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  };
  const arc = (cx, cz, r, a0, a1, n = 16, w) => { for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n, b = a0 + (a1 - a0) * (i + 1) / n; seg(cx + Math.sin(a) * r, cz + Math.cos(a) * r, cx + Math.sin(b) * r, cz + Math.cos(b) * r, w); } };
  const X = ARENA.halfW;
  // one end (s = 1: the goal line at goalZ; s = -1 the other end of a whole pitch)
  const end = s => {
    const G = ARENA.goalZ * s, k = s;
    seg(-X, G, X, G); seg(-X, G, -X, 0); seg(X, G, X, 0);
    seg(-16, G, -16, G + 16.5 * k); seg(16, G, 16, G + 16.5 * k); seg(-16, G + 16.5 * k, 16, G + 16.5 * k);
    seg(-9.16, G, -9.16, G + 5.5 * k); seg(9.16, G, 9.16, G + 5.5 * k); seg(-9.16, G + 5.5 * k, 9.16, G + 5.5 * k);
    arc(0, G + 11 * k, 0.06, 0, Math.PI * 2, 8, 0.07);
    if (k > 0) { arc(0, G + 11, 9.15, -0.93, 0.93, 14); arc(-X, G, 1, 0, Math.PI / 2, 5); arc(X, G, 1, -Math.PI / 2, 0, 5); }
    else { arc(0, G - 11, 9.15, Math.PI - 0.93, Math.PI + 0.93, 14); arc(-X, G, 1, Math.PI / 2, Math.PI, 5); arc(X, G, 1, Math.PI, Math.PI * 1.5, 5); }
  };
  end(1); if (ARENA.full) end(-1);
  seg(-X, 0, X, 0);
  arc(0, 0, 0.06, 0, Math.PI * 2, 8, 0.07);       // the centre spot
  if (ARENA.full) arc(0, 0, 9.15, 0, Math.PI * 2, 40); else arc(0, 0, 9.15, Math.PI / 2, Math.PI * 1.5, 24);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    fog: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...light },
    vertexShader: `varying vec2 vUv;
${FOG[0]}
void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
${FOG[1]}
}`,
    fragmentShader: `uniform vec3 uAmb, uSun, uFlood; uniform float uSnow; varying vec2 vUv;
${FOG[2]}
void main() { float a = 1.0 - smoothstep(0.35, 1.0, abs(vUv.x)); vec3 c = vec3(0.93, 0.95, 0.9) * (uAmb + uSun * 0.87 + uFlood) * 0.95;
  gl_FragColor = vec4(mix(c, vec3(0.2, 0.34, 0.14) * (uAmb + uSun * 0.87 + uFlood), uSnow), a * 0.9);   // under snow the lines are swept clear to the grass
${FOG[3]}
}`,
  });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 1;
  return m;
}
