// Shaders for the '04-look grounds. Everything is unlit in the three.js sense: the light is baked per
// vertex as how much a face takes the sun and how much it faces the floodlit pitch, and the time of
// day (stadium.js) sets three colours (ambient, sun, floodlight) that those weights mix. So a whole
// ground is a handful of draws: structure, lattice, crowd, glows, flags, banners.
import * as THREE from 'three';
import { FAN_STATE } from './fanmat.js';

const FOG_V = THREE.ShaderChunk.fog_pars_vertex, FOG_VM = THREE.ShaderChunk.fog_vertex, FOG_F = THREE.ShaderChunk.fog_pars_fragment, FOG_FM = THREE.ShaderChunk.fog_fragment;
const fogU = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);

// The light every ground material shares (one object, so setting it once lights the lot).
export function groundLight() {
  return {
    uAmb: { value: new THREE.Color(0.6, 0.6, 0.6) }, uSun: { value: new THREE.Color(0.5, 0.5, 0.5) }, uFlood: { value: new THREE.Color(0, 0, 0) },
    uLamp: { value: 0 }, uSnow: { value: 0 }, uWet: { value: 0 }, uTime: { value: 0 },
  };
}

// Structure: the atlas (groundtex.js), tiled inside a cell with fract() and sampled with the gradient
// of the untiled coordinates, so the mip level doesn't jump at a tile's edge. aLit: (sun, pitch,
// glow, up). alpha: the lattice and railings, drawn as their own mesh so the big one never discards.
export function structureMaterial(map, light, alpha = false) {
  return new THREE.ShaderMaterial({
    fog: true, side: THREE.DoubleSide,
    uniforms: { ...fogU(), ...light, uMap: { value: map } },
    vertexShader: `attribute vec4 aReg; attribute vec4 aLit; attribute vec3 color; varying vec2 vUv; varying vec4 vReg; varying vec4 vLit; varying vec3 vCol; varying vec3 vW;
${FOG_V}
void main() { vUv = uv; vReg = aReg; vLit = aLit; vCol = color; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
${FOG_VM}
}`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uAmb, uSun, uFlood; uniform float uLamp, uSnow, uWet; varying vec2 vUv; varying vec4 vReg; varying vec4 vLit; varying vec3 vCol; varying vec3 vW;
${FOG_F}
void main() {
  vec2 t = 0.012 + fract(vUv) * 0.976, g = vReg.zw * 0.976;
  vec4 tx = textureGrad(uMap, vReg.xy + t * vReg.zw, dFdx(vUv) * g, dFdy(vUv) * g);
  ${alpha ? 'if (tx.a < 0.5) discard;' : ''}
  vec3 alb = tx.rgb * vCol;
  vec3 col = alb * (uAmb + uSun * vLit.x + uFlood * vLit.y) * (1.0 - 0.25 * uWet) + alb * vLit.z * (0.25 + 1.6 * uLamp);
  float n = fract(sin(dot(floor(vW.xz * 3.0), vec2(12.9898, 78.233))) * 43758.5453);
  col = mix(col, vec3(0.92, 0.94, 1.0) * (uAmb + uSun * 0.8 + uFlood * 0.6), uSnow * smoothstep(0.55, 0.9, vLit.w) * (0.75 + 0.25 * n));
  gl_FragColor = vec4(col, 1.0);
${FOG_FM}
}`,
  });
}

// Glows: soft additive billboards round each lamp (aCorner: -1..1, aSize: radius in metres).
export function glowMaterial(light) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { ...light },
    vertexShader: `attribute vec2 aCorner; attribute float aSize; varying vec2 vC;
void main() { vC = aCorner; vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.xy += aCorner * aSize; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uLamp; varying vec2 vC;
void main() { float r = length(vC); float k = exp(-r * r * 9.0) * 0.9 + exp(-r * r * 2.2) * 0.25; k *= 1.0 - smoothstep(0.75, 1.0, r); gl_FragColor = vec4(vec3(1.0, 0.96, 0.85) * k * uLamp, 1.0); }`,
  });
}

// The ultras' flags: one instanced draw for both ends. The geometry is a pole (its foot at the fan's
// lower hand, the origin) and a cloth at its top (aCloth 1). Each copy has a design (0..3 home, 4..7
// away), a side, its holder's phase and whether he's yours (so it rises and bounces with him:
// FAN_STATE), and aBig. The holder sweeps the pole from side to side about his hands; the cloth
// trails the sweep, sags and ripples. Harder when that side's hype is up.
export function flagMaterial(map, light, uniforms) {
  return new THREE.ShaderMaterial({
    fog: true, side: THREE.DoubleSide,
    uniforms: { ...fogU(), ...light, ...uniforms, uMap: { value: map } },
    vertexShader: `attribute float aCloth; attribute float aDesign; attribute float aSide; attribute float aPhase; attribute float aMine; attribute float aBig; attribute float aAlong;
uniform float uHypeH, uHypeA; varying vec2 vUv; varying float vCloth; varying float vShade;
${FAN_STATE}
${FOG_V}
void main() {
  vec3 st = fanState(aPhase, aBig > 0.5 ? 4.0 : 3.0, aMine);
  float hype = mix(uHypeH, uHypeA, aSide), w = aBig > 0.5 ? 1.5 + 0.6 * hype : 2.3 + 1.6 * hype, ph = aPhase * 6.283 + uTime * w;
  float amp = (aBig > 0.5 ? 0.32 : 0.42) + 0.3 * hype;
  float ang = amp * sin(ph) - aCloth * aAlong * amp * 0.9 * cos(ph);     // the cloth comes round behind the pole
  float wave = uTime * (6.0 + 3.0 * hype) - aAlong * 5.0 + aPhase * 20.0;
  vec3 p = position;
  p.z += sin(wave) * 0.16 * aAlong * aCloth;
  p.y -= aAlong * aAlong * (0.22 - 0.12 * hype) * aCloth * (aBig > 0.5 ? 2.2 : 1.0);
  float c = cos(ang), s = sin(ang);
  p = vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
  vShade = 0.82 + 0.25 * cos(wave) * aAlong * aCloth;
  vCloth = aCloth;
  vUv = vec2((mod(aDesign, 4.0) + uv.x) * 0.25, 1.0 - (floor(aDesign / 4.0) + 1.0 - uv.y) * 0.5);
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0); wp.y += st.y - 0.45;
  vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
${FOG_VM}
}`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uAmb, uSun, uFlood; varying vec2 vUv; varying float vCloth; varying float vShade;
${FOG_F}
void main() {
  vec3 c = vCloth > 0.5 ? texture2D(uMap, vUv).rgb * vShade : vec3(0.55, 0.5, 0.42);
  gl_FragColor = vec4(c * (uAmb + uSun * 0.7 + uFlood * 0.8) * 1.1, 1.0);
${FOG_FM}
}`,
  });
}

// Banners over the front wall: lit like the crowd, with a slow sag-and-billow (aSag: 0 at the ties).
export function bannerMaterial(map, light) {
  return new THREE.ShaderMaterial({
    fog: true, side: THREE.DoubleSide,
    uniforms: { ...fogU(), ...light, uMap: { value: map } },
    vertexShader: `attribute float aSag; uniform float uTime; varying vec2 vUv; varying float vS;
${FOG_V}
void main() { vUv = uv; vec3 p = position; float w = sin(uTime * 1.3 + position.x * 0.7) * 0.06 * aSag; p.z += w; vS = 0.9 + w * 2.0;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
${FOG_VM}
}`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uAmb, uSun, uFlood; varying vec2 vUv; varying float vS;
${FOG_F}
void main() { gl_FragColor = vec4(texture2D(uMap, vUv).rgb * vS * (uAmb + uSun * 0.8 + uFlood * 0.9), 1.0);
${FOG_FM}
}`,
  });
}
