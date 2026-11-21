// Shaders for the '04-look grounds. Everything is unlit in the three.js sense: the light is baked per
// vertex as how much a face takes the sun and how much it faces the floodlit pitch, and the time of
// day (stadium.js) sets three colours (ambient, sun, floodlight) that those weights mix. So a whole
// ground is a handful of draws: structure, lattice, crowd, glows, flags, banners.
import * as THREE from 'three';

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

// The crowd: three tiles (everyone, the home curva, the away block) chosen by aBand, the fans staggered
// row by row, and each fan bounced inside his own cell by who he supports (the table: R = yours).
// uv is in fans (x) and rows (y). aShade: (day, night) brightness; aUltra: bounces all game.
export function crowdMaterial(tiles, table, light, jump) {
  return new THREE.ShaderMaterial({
    fog: true, side: THREE.DoubleSide,
    uniforms: { ...fogU(), ...light, ...jump, uT0: { value: tiles[0] }, uT1: { value: tiles[1] }, uT2: { value: tiles[2] }, uTable: { value: table }, uDay: { value: 1 } },
    vertexShader: `attribute float aBand; attribute vec2 aShade; attribute float aUltra; varying vec2 vUv; varying float vBand; varying vec2 vShade; varying float vUltra;
${FOG_V}
void main() { vUv = uv; vBand = aBand; vShade = aShade; vUltra = aUltra; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
${FOG_VM}
}`,
    fragmentShader: `uniform sampler2D uT0, uT1, uT2; uniform highp sampler2D uTable; uniform vec3 uAmb, uSun, uFlood; uniform float uTime, uJumpOurs, uJumpTheirs, uDay, uWet; varying vec2 vUv; varying float vBand; varying vec2 vShade; varying float vUltra;
${FOG_F}
void main() {
  float row = floor(vUv.y), col = floor(vUv.x + 0.5 * mod(row, 2.0));
  float u = vUv.x + 0.5 * mod(row, 2.0);
  int band = int(vBand + 0.5);
  vec4 who = texelFetch(uTable, ivec2(int(mod(col, 32.0)), band * 12 + int(mod(row, 12.0))), 0);
  float tile = floor(col / 32.0) * 7.0 + floor(row / 12.0) * 3.0, ph = fract(who.g + tile * 0.37) * 6.283;
  float jump = mix(uJumpTheirs, uJumpOurs, step(0.7, who.r));
  float hop = jump * max(0.0, sin(uTime * 9.0 + ph)) * 0.24 + vUltra * (1.0 - jump) * max(0.0, sin(uTime * 7.5 + ph * 0.13)) * 0.12 + 0.015 * sin(uTime * 2.3 + ph * 7.0);
  hop *= step(0.25, abs(who.r - 0.5) * 2.0);                       // the stairway doesn't jump
  vec2 st = vec2(u / 32.0, (row + clamp(fract(vUv.y) - hop, 0.0, 0.999)) / 12.0), gx = dFdx(vUv) / vec2(32.0, 12.0), gy = dFdy(vUv) / vec2(32.0, 12.0);
  vec3 c = band == 0 ? textureGrad(uT0, st, gx, gy).rgb : band == 1 ? textureGrad(uT1, st, gx, gy).rgb : textureGrad(uT2, st, gx, gy).rgb;
  float sh = mix(vShade.y, vShade.x, uDay);
  gl_FragColor = vec4(c * sh * (uAmb + uSun * 0.7 + uFlood * 0.8) * 1.15 * (1.0 - 0.2 * uWet), 1.0);
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

// The ultras' flags: one instanced draw for both ends. The geometry is a pole and a cloth (aCloth 1);
// each copy has a design (0..3 home, 4..7 away), a side (0 home, 1 away) and a phase. The cloth
// swings round its pole and ripples, harder when its side's hype is up (ultras.js did the same).
export function flagMaterial(map, light, hype, W) {
  return new THREE.ShaderMaterial({
    fog: true, side: THREE.DoubleSide,
    uniforms: { ...fogU(), ...light, ...hype, uMap: { value: map } },
    vertexShader: `attribute float aCloth; attribute float aDesign; attribute float aSide; attribute float aPhase; uniform float uTime, uHypeH, uHypeA; varying vec2 vUv; varying float vCloth; varying float vShade;
${FOG_V}
void main() {
  float hype = mix(uHypeH, uHypeA, aSide), along = position.x / ${W.toFixed(2)};
  float swing = sin(uTime * (1.6 + hype * 1.8) + aPhase * 6.283) * (0.45 + 0.4 * hype) * aCloth;
  float wave = uTime * 7.0 - along * 5.0 + aPhase * 20.0, rip = sin(wave) * 0.14 * along * aCloth;
  vec3 p = position; p.z += rip; p.y -= along * along * 0.1 * aCloth;
  float cs = cos(swing), sn = sin(swing);
  p = vec3(p.x * cs - p.z * sn, p.y, p.x * sn + p.z * cs);
  vShade = 0.82 + 0.25 * cos(wave) * along * aCloth;
  vCloth = aCloth;
  vUv = vec2((mod(aDesign, 4.0) + uv.x) * 0.25, 1.0 - (floor(aDesign / 4.0) + 1.0 - uv.y) * 0.5);
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
${FOG_VM}
}`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uAmb, uSun, uFlood; varying vec2 vUv; varying float vCloth; varying float vShade;
${FOG_F}
void main() {
  vec3 c = vCloth > 0.5 ? texture2D(uMap, vUv).rgb * vShade : vec3(0.16);
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
