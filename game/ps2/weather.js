// '04-look rain and snow: a box of streaks or soft flakes that follows your head, wrapped so they
// stay put in the world as you move (as game/weather.js does, same interface: createWeather(scene)
// -> { kind, set(kind), update(t, center) }). One draw each, animated in the vertex shader. Rain is
// thin fading streaks slanting a little with the wind; snow is round, soft-edged flakes drifting.
// The pitch, fog and light are stadium.setWeather (game/ps2/stadium.js).
import * as THREE from 'three';

const KINDS = {
  // count, box (m), fall (m/s), sway (m), half width / half length (m), colour, opacity, wind (m/s)
  rain: { n: 3600, box: [24, 14, 24], fall: 10, sway: 0, w: 0.012, h: 0.42, color: '#dfe6f2', opacity: 0.45, wind: 1.2, soft: 0 },
  snow: { n: 1800, box: [22, 12, 22], fall: 1.0, sway: 0.5, w: 0.03, h: 0.03, color: '#ffffff', opacity: 0.95, wind: 0.3, soft: 1 },
};

function particles(k) {
  const n = k.n, pos = new Float32Array(n * 12), seed = new Float32Array(n * 12), idx = [];
  for (let i = 0; i < n; i++) {
    const s = [Math.random(), Math.random(), Math.random()];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, y], j) => { const o = (i * 4 + j) * 3; pos[o] = x; pos[o + 1] = y; pos[o + 2] = 0; seed.set(s, o); });
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3)); g.setIndex(idx);
  const uniforms = {
    uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...k.box) }, uFall: { value: k.fall }, uSway: { value: k.sway },
    uSize: { value: new THREE.Vector2(k.w, k.h) }, uWind: { value: k.wind }, uColor: { value: new THREE.Color(k.color) }, uOpacity: { value: k.opacity }, uBright: { value: 1 },
  };
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms,
    vertexShader: `attribute vec3 aSeed; uniform float uTime, uFall, uSway, uWind; uniform vec3 uCenter, uBox; uniform vec2 uSize; varying vec2 vC; varying float vFade;
void main() {
  vec3 p = aSeed * uBox;
  float t = uTime * (0.85 + 0.3 * aSeed.x);
  p.y -= t * uFall; p.x += t * uWind;
  p.x += sin(uTime * 0.8 + aSeed.z * 40.0) * uSway; p.z += cos(uTime * 0.6 + aSeed.x * 40.0) * uSway;
  vec3 rel = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
  float r = length(rel.xz);
  vFade = smoothstep(1.2, 2.2, r) * (1.0 - smoothstep(uBox.x * 0.32, uBox.x * 0.5, r));   // none in your face, none popping at the box's edge
  vec3 w = uCenter + rel;
  // streaks hang along the fall (slanted by the wind) and face you side-on; flakes face you
  vec3 fall = normalize(vec3(uWind, -uFall, 0.0));
  ${k.soft ? 'vec4 mv = viewMatrix * vec4(w, 1.0); mv.xy += position.xy * uSize;' : 'vec4 mv = viewMatrix * vec4(w + fall * position.y * uSize.y, 1.0); mv.x += position.x * uSize.x * (1.0 + 0.004 * length(mv.xyz));'}
  vC = position.xy;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uBright; varying vec2 vC; varying float vFade;
void main() {
  float a = ${k.soft ? '1.0 - smoothstep(0.35, 1.0, length(vC))' : '(1.0 - vC.x * vC.x) * smoothstep(-1.0, 0.4, vC.y) * (1.0 - smoothstep(0.6, 1.0, vC.y))'};
  gl_FragColor = vec4(uColor * uBright, a * uOpacity * vFade);
}`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 5;
  return { mesh, uniforms };
}

export function createWeather(scene) {
  const fx = { rain: particles(KINDS.rain), snow: particles(KINDS.snow) };
  for (const f of Object.values(fx)) scene.add(f.mesh);
  let kind = 'clear';
  return {
    get kind() { return kind; },
    set(k) { kind = k; for (const [n, f] of Object.entries(fx)) f.mesh.visible = n === k; },
    // how bright the streaks and flakes are (the time of day: lit by the floodlights at night)
    bright(b) { for (const f of Object.values(fx)) f.uniforms.uBright.value = b; },
    // center: your head in world space
    update(t, center) {
      const f = fx[kind];
      if (!f) return;
      f.uniforms.uTime.value = t;
      f.uniforms.uCenter.value.copy(center);
    },
  };
}
