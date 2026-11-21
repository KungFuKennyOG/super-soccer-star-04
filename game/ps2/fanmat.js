// Shaders for the crowd: every fan is a card (fans.js) standing on his seat, turned about the upright
// to face you, showing one of the painted sprites (fantex.js) coloured in here: his shirt, his scarf
// or cap, his skin and hair. What he is doing is worked out per fan in the vertex shader from the
// match's moments (uniforms shared with stadium.js): sitting and fidgeting, the ultras standing,
// singing and bouncing all game, everyone up with arms in the air when their side scores, hands on
// heads when it goes close. Alpha test, no blending: no sorting. Also the seats under them.
import * as THREE from 'three';

const FOG_V = THREE.ShaderChunk.fog_pars_vertex, FOG_VM = THREE.ShaderChunk.fog_vertex, FOG_F = THREE.ShaderChunk.fog_pars_fragment, FOG_FM = THREE.ShaderChunk.fog_fragment;
const fogU = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);

// What a fan is doing: returns (pose, lift in metres over sitting, how far up out of his seat 0..1).
// phase: his own 0..1, role: 0 seated, 1 standing (curva, away end, terrace), 3 waves a flag, 4 a big
// one; mine: 1 if he is your fan. The poses are fantex.js's POSES. Flags (ultras2.js) use it too, so
// a flag goes up and down with the fan holding it.
export const FAN_STATE = `
uniform float uTime, uJumpOurs, uJumpTheirs, uOoh, uGoalT, uTheirT;
float fh(float p, float k) { return fract(sin(p * k + 0.37) * 43758.5453); }
float tick(float rate, float off) { return step(0.5, fract(uTime * rate + off)); }
vec3 fanState(float phase, float role, float mine) {
  float h1 = fh(phase, 12.9898), h2 = fh(phase, 78.233), h3 = fh(phase, 37.719), h4 = fh(phase, 93.989), t = uTime;
  bool me = mine > 0.5, standing = role > 0.5;
  float joy = me ? uJumpOurs : uJumpTheirs, woe = me ? uJumpTheirs : uJumpOurs;
  float gt = me ? uGoalT : uTheirT, wt = me ? uTheirT : uGoalT;
  // sitting: now and then he shifts and looks along the row
  float pose = fract(t / (7.0 + 9.0 * h1) + h2) < 0.16 ? 1.0 : h4 > 0.86 ? 13.0 : 0.0, up = standing ? 1.0 : 0.0, hop = 0.0;   // some sit with arms folded
  if (standing) {
    // the end sings a different song every 7 s or so (not all at once); some songs everyone bounces to
    float seg = floor(t / 7.0 + h4 * 0.3), r = fh(seg + phase * 3.1, 4.7), bounce = step(0.45, fh(seg, 9.1));
    pose = r < 0.28 ? mix(6.0, 14.0, tick(1.25, h1 * 0.15))        // clapping over their heads, in time
         : r < 0.5 ? mix(8.0, 7.0, tick(0.6, h1))                  // scarves held up, swaying
         : r < 0.6 ? mix(10.0, 9.0, tick(1.25, h1 * 0.1))          // fists pumped to the beat
         : r < 0.75 ? mix(4.0, 3.0, tick(2.5, h1 * 0.1))           // clapping
         : r < 0.9 ? 2.0 : 13.0;
    if (role > 2.5) pose = 12.0;
    hop = bounce * 0.1 * max(0.0, sin(t * 7.85 + h1 * 0.7));
    if (role > 1.5 && role < 2.5) { pose = h3 < 0.6 ? 2.0 : 13.0; hop = 0.0; }   // just standing (no song)
  }
  // a goal for his side: up out of his seat (a ripple across the stand), arms up, then clapping
  float rise = smoothstep(0.06 + 0.4 * h1, 0.16 + 0.4 * h1, joy);
  up = max(up, rise);
  if (rise > 0.5) {
    bool early = gt < 2.5 + 3.5 * h2;
    if (role < 2.5) pose = early ? (h3 < 0.35 ? mix(5.0, 6.0, tick(2.2, h1)) : h3 < 0.55 ? mix(10.0, 9.0, tick(2.6, h1)) : h3 < 0.75 ? mix(5.0, 15.0, tick(1.6, h1)) : mix(8.0, 7.0, tick(1.1, h1)))
                                 : (h3 < 0.55 ? mix(4.0, 3.0, tick(2.4, h1)) : h3 < 0.8 ? mix(8.0, 7.0, tick(0.7, h1)) : mix(6.0, 14.0, tick(2.0, h1)));
    hop = max(hop, step(h4, early ? 0.6 : 0.2) * 0.16 * abs(sin(t * 6.0 + h1 * 6.283)));
  } else if (woe > 0.05) {
    // a goal against: a moment of hands on heads, then still (sitting) or arms folded (standing)
    hop = 0.0;
    pose = (wt < 1.2 + 2.0 * h2 && h3 < 0.45) ? 11.0 : standing ? (h3 < 0.7 ? 13.0 : 2.0) : 0.0;
    if (role > 2.5) pose = 12.0;
  }
  // a near miss (a save, the woodwork): your fans half out of their seats, hands on heads
  if (me && uOoh > 0.2 + 0.35 * h1 && h3 < 0.8 && rise < 0.5 && role < 2.5) { pose = 11.0; up = max(up, smoothstep(0.2, 0.6, uOoh) * 0.7); }
  if (up < 0.5 && pose > 1.5 && pose != 11.0 && pose != 13.0) pose = 0.0;           // poses that work sitting
  return vec3(pose, up * 0.45 + hop, up);
}`;

const SKINS = ['0.91,0.76,0.62', '0.86,0.68,0.54', '0.78,0.58,0.42', '0.66,0.46,0.3', '0.5,0.33,0.2', '0.35,0.22,0.14'];
const HAIRS = ['0.1,0.08,0.06', '0.2,0.13,0.08', '0.35,0.23,0.13', '0.55,0.4,0.22', '0.82,0.68,0.42', '0.6,0.6,0.58', '0.55,0.25,0.1', '0.05,0.05,0.05'];
const LEGS = '0.5';
const arr = (n, a) => `vec3[${n}](${a.map(c => `vec3(${c})`).join(', ')})`;

// atlas: fanAtlas(). pal: 16 colours (0..4 yours, 5..9 theirs, 10..15 neutral), set per ground.
export function fanMaterial(atlas, light, crowd) {
  return new THREE.ShaderMaterial({
    fog: true, side: THREE.DoubleSide,
    uniforms: { ...fogU(), ...light, ...crowd, uPoses: { value: 0 }, uA: { value: atlas.a }, uB: { value: atlas.b }, uTop: { value: atlas.top }, uHW: { value: atlas.hw }, uPal: { value: Array.from({ length: 16 }, () => new THREE.Color()) }, uDay: { value: 1 } },
    vertexShader: `#define LEGS ${LEGS}
attribute vec4 aSeat; attribute vec4 aFan; attribute vec4 aCol; attribute vec2 aShade;
uniform float uTop[16], uHW[16], uDay, uPoses; uniform vec3 uPal[16];
varying vec2 vUv, vLoc; varying vec3 vShirt, vAcc, vSkin, vHair, vLegs; varying float vSh;
${FAN_STATE}
${FOG_V}
void main() {
  vec3 st = fanState(aFan.z, aFan.w, aFan.y);
  if (uPoses > 0.5) st = vec3(floor(fract(aFan.z * 7.0) * 16.0), 0.45, 1.0);    // the look page's line-up of every pose
  int pose = int(st.x + 0.5);
  float s = aSeat.w, shape = mod(aFan.x, 8.0), mir = aFan.x >= 8.0 ? -1.0 : 1.0, hw = uHW[pose], top = uTop[pose];
  vec3 base = aSeat.xyz + vec3(0.0, 0.2 + st.y, 0.0);
  vec3 d = cameraPosition - base; d.y = 0.0; d = normalize(d + vec3(1e-5, 0.0, 0.0));
  vec3 right = vec3(d.z, 0.0, -d.x);
  float lean = 0.035 * sin(uTime * (0.5 + aFan.z) + aFan.z * 40.0);
  // the card: from his feet (LEGS under the seat or his hips, drawn here, not painted) to the top of the pose
  float ly = mix(-LEGS, top * 1.575, position.y), lx = position.x * 0.9 * max(hw, 0.4);
  vec3 p = base + right * (lx + max(ly, 0.0) / 1.575 * lean) * s + vec3(0.0, ly * s, 0.0);
  vLoc = vec2(lx, ly);
  vUv = vec2((float(pose) + 0.5 + lx / 0.9 * mir) / 16.0, (7.0 - shape + max(ly, 0.004) / 1.575) / 8.0);
  vLegs = fh(aFan.z, 3.3) < 0.55 ? vec3(0.17, 0.2, 0.3) : fh(aFan.z, 5.1) < 0.6 ? vec3(0.1, 0.1, 0.11) : vec3(0.32, 0.31, 0.3);
  SKIN_HAIR
  vShirt = uPal[int(aCol.x)]; vAcc = uPal[int(aCol.y)]; vSkin = SKIN[int(aCol.z)]; vHair = HAIR[int(aCol.w)];
  vSh = mix(aShade.y, aShade.x, uDay);
  vec4 mvPosition = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
${FOG_VM}
}`.replace('SKIN_HAIR', `const vec3 SKIN[6] = ${arr(6, SKINS)}; const vec3 HAIR[8] = ${arr(8, HAIRS)};`),
    fragmentShader: `#define LEGS ${LEGS}
uniform sampler2D uA, uB; uniform vec3 uAmb, uSun, uFlood; uniform float uWet;
varying vec2 vUv, vLoc; varying vec3 vShirt, vAcc, vSkin, vHair, vLegs; varying float vSh;
${FOG_F}
void main() {
  vec4 a = texture2D(uA, vUv);
  vec2 b = texture2D(uB, vUv).rg;
  vec3 c;
  if (vLoc.y < 0.0) {
    // his legs, under the sprite: two trouser legs, shoes at the bottom, in the shade of the row in front
    float k = -vLoc.y / LEGS, leg = abs(abs(vLoc.x) - 0.085);
    if (leg > 0.082 - 0.024 * k) discard;
    c = (k > 0.86 ? vec3(0.08) : vLegs * (1.0 - 0.3 * k)) * (1.1 - leg * 4.0);
  } else {
    if (a.a < 0.5) discard;
    float ia = 1.0 / a.a;
    vec3 tint = vec3(1.0) + a.g * ia * (vShirt - 1.0) + a.b * ia * (vAcc - 1.0) + b.r * ia * (vSkin - 1.0) + b.g * ia * (vHair - 1.0);
    c = a.r * ia * tint * 1.2;
  }
  gl_FragColor = vec4(c * vSh * (uAmb + uSun * 0.7 + uFlood * 0.8) * 1.15 * (1.0 - 0.2 * uWet), 1.0);
${FOG_FM}
}`,
  });
}

// The stand under them: rows of seats in the ground's two seat colours (aSeatK picks), a stairway
// every so often (aAis: along the stand in stairways, aSpa: seats from one to the next).
export function seatMaterial(tile, seats, light) {
  return new THREE.ShaderMaterial({
    fog: true, side: THREE.DoubleSide,
    uniforms: { ...fogU(), ...light, uTile: { value: tile }, uSeatA: { value: new THREE.Color(seats[0]) }, uSeatB: { value: new THREE.Color(seats[1]) }, uDay: { value: 1 } },
    vertexShader: `attribute float aAis; attribute float aSpa; attribute float aSeatK; attribute vec2 aShade; varying vec2 vUv; varying float vAis; varying float vSpa; varying float vK; varying vec2 vShade;
${FOG_V}
void main() { vUv = uv; vAis = aAis; vSpa = aSpa; vK = aSeatK; vShade = aShade; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
${FOG_VM}
}`,
    fragmentShader: `uniform sampler2D uTile; uniform vec3 uSeatA, uSeatB, uAmb, uSun, uFlood; uniform float uDay, uWet; varying vec2 vUv; varying float vAis; varying float vSpa; varying float vK; varying vec2 vShade;
${FOG_F}
void main() {
  float da = abs(fract(vAis + 0.5) - 0.5) * vSpa;
  float aisle = step(da, 0.55);
  vec2 f = fract(vUv), st = vec2(aisle * 0.5 + 0.01 + f.x * 0.48, 0.02 + f.y * 0.96), g = vec2(0.48, 0.96);
  vec4 tx = textureGrad(uTile, st, dFdx(vUv) * g, dFdy(vUv) * g);
  vec3 seat = mix(uSeatA, uSeatB, vK);
  vec3 c = tx.r * mix(vec3(0.85), seat * 1.5, tx.g);
  gl_FragColor = vec4(c * mix(vShade.y, vShade.x, uDay) * (uAmb + uSun * 0.7 + uFlood * 0.8) * 1.15 * (1.0 - 0.2 * uWet), 1.0);
${FOG_FM}
}`,
  });
}
