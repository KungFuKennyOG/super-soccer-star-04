// Shaders for the crowd: every fan is a card (fans.js) standing on his seat, turned about the upright
// to face you, his torso, head and arms (fantex.js) laid over each other and coloured in here: his
// shirt, his scarf or cap, his skin and hair; his head turned to where the play is. What he is doing is worked out per fan in the vertex shader from the
// match's moments (uniforms shared with stadium.js): sitting and fidgeting, the ultras standing,
// singing and bouncing all game, everyone up with arms in the air when their side scores, hands on
// heads when it goes close. Alpha test, no blending: no sorting. Also the seats under them.
import * as THREE from 'three';

const FOG_V = THREE.ShaderChunk.fog_pars_vertex, FOG_VM = THREE.ShaderChunk.fog_vertex, FOG_F = THREE.ShaderChunk.fog_pars_fragment, FOG_FM = THREE.ShaderChunk.fog_fragment;
const fogU = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);

import { POSES, LAYOUT } from './fantex.js';

const DEF = POSES.map(([n], i) => `#define P_${n} ${i}.0`).join('\n');
// What a fan is doing: returns (arms pose + 32 if the arms are mirrored, lift in metres over sitting,
// how far up out of his seat 0..1, mouth 0 shut / 1 open / 2 a gasp). phase: his own 0..1, role: 0
// seated, 1 standing (curva, away end, terrace), 2 standing (no song), 3 waves a flag, 4 a big one;
// mine: 1 if he is your fan. Actions run through 3 or 4 frames (a b c b), not a hard flip of two.
// Flags (groundmat.js) use it too, so a flag goes up and down with the fan holding it.
export const FAN_STATE = `
${DEF}
uniform float uTime, uJumpOurs, uJumpTheirs, uOoh, uGoalT, uTheirT;
float fh(float p, float k) { return fract(sin(p * k + 0.37) * 43758.5453); }
float tick(float rate, float off) { return step(0.5, fract(uTime * rate + off)); }
float cyc(float a, float b, float c, float rate, float off) { float f = floor(fract(uTime * rate + off) * 4.0); return f < 1.0 ? a : f < 2.0 ? b : f < 3.0 ? c : b; }
vec4 fanState(float phase, float role, float mine) {
  float h1 = fh(phase, 12.9898), h2 = fh(phase, 78.233), h3 = fh(phase, 37.719), h4 = fh(phase, 93.989), t = uTime;
  bool me = mine > 0.5, standing = role > 0.5;
  float joy = me ? uJumpOurs : uJumpTheirs, woe = me ? uJumpTheirs : uJumpOurs;
  float gt = me ? uGoalT : uTheirT, wt = me ? uTheirT : uGoalT;
  // sitting: most with hands in the lap, some leaning on their knees or arms folded, a few talking
  float pose = h4 > 0.86 ? P_folded : h4 > 0.74 ? P_sitLean : P_sit, up = standing ? 1.0 : 0.0, hop = 0.0, mouth = 0.0;
  if (h2 < 0.1) { float talk = tick(0.35, h1); pose = mix(pose, P_sitChat, talk); mouth = talk * tick(3.0, h3); }
  if (standing) {
    // the end sings a different song every 7 s or so (not all at once); some songs everyone bounces to
    float seg = floor(t / 7.0 + h4 * 0.3), r = fh(seg + phase * 3.1, 4.7), bounce = step(0.45, fh(seg, 9.1));
    pose = r < 0.26 ? mix(P_clapHiO, P_clapHiS, tick(1.25, h1 * 0.15))                    // clapping over their heads, in time
         : r < 0.48 ? cyc(P_scarfTilt, P_scarf, P_scarfTilt + 32.0, 0.55, h1)            // scarves held up, swaying
         : r < 0.58 ? cyc(P_fistLo, P_fistMid, P_fistHi, 1.25, h1 * 0.1)                // fists pumped to the beat
         : r < 0.73 ? cyc(P_clapO, P_clapM, P_clapS, 2.5, h1 * 0.1)                      // clapping
         : r < 0.8 ? P_point : r < 0.92 ? P_stand : P_folded;
    mouth = r < 0.73 ? tick(2.5, h1 * 0.2) : 0.0;
    if (role > 2.5) pose = P_pole;
    hop = bounce * 0.1 * max(0.0, sin(t * 7.85 + h1 * 0.7));
    if (role > 1.5 && role < 2.5) { pose = h3 < 0.6 ? P_stand : P_folded; hop = 0.0; mouth = 0.0; }
  }
  // a goal for his side: up out of his seat (a ripple across the stand), arms up, then clapping
  float rise = smoothstep(0.06 + 0.4 * h1, 0.16 + 0.4 * h1, joy);
  up = max(up, rise);
  if (rise > 0.5) {
    bool early = gt < 2.5 + 3.5 * h2;
    if (role < 2.5) pose = early ? (h3 < 0.32 ? cyc(P_vLow, P_vMid, P_up, 1.7, h1) : h3 < 0.5 ? cyc(P_fistLo, P_fistMid, P_fistHi, 2.2, h1) : h3 < 0.68 ? cyc(P_wide, P_vMid, P_up, 1.2, h1) : h3 < 0.8 ? cyc(P_wave, P_fistHi, P_wave, 1.6, h1) : cyc(P_scarfTilt, P_scarf, P_scarfTilt + 32.0, 0.9, h1))
                                 : (h3 < 0.55 ? cyc(P_clapO, P_clapM, P_clapS, 2.4, h1) : h3 < 0.8 ? cyc(P_scarfTilt, P_scarf, P_scarfTilt + 32.0, 0.6, h1) : mix(P_clapHiO, P_clapHiS, tick(2.0, h1)));
    mouth = early ? 1.0 : tick(2.0, h1);
    hop = max(hop, step(h4, early ? 0.6 : 0.2) * 0.16 * abs(sin(t * 6.0 + h1 * 6.283)));
  } else if (woe > 0.05) {
    // a goal against: a moment of hands on heads, then still (sitting) or arms folded (standing)
    hop = 0.0; mouth = 0.0;
    bool shock = wt < 1.2 + 2.0 * h2 && h3 < 0.45;
    pose = shock ? (h4 < 0.7 ? P_handsHead : P_handsFace) : standing ? (h3 < 0.7 ? P_folded : P_stand) : (h3 < 0.75 ? P_sit : P_sitLean);
    mouth = shock ? 2.0 : 0.0;
    if (role > 2.5) pose = P_pole;
  }
  // a near miss (a save, the woodwork): your fans half out of their seats, hands on heads
  if (me && uOoh > 0.2 + 0.35 * h1 && h3 < 0.8 && rise < 0.5 && role < 2.5) { pose = h4 < 0.75 ? P_handsHead : P_handsFace; mouth = 2.0; up = max(up, smoothstep(0.2, 0.6, uOoh) * 0.7); }
  float base = mod(pose, 32.0);
  if (up < 0.5 && !(base <= P_folded || base == P_handsHead || base == P_handsFace)) pose = P_sit;   // poses that work sitting
  return vec4(pose, up * 0.45 + hop, up, mouth);
}`;

const SKINS = ['0.91,0.76,0.62', '0.86,0.68,0.54', '0.78,0.58,0.42', '0.66,0.46,0.3', '0.5,0.33,0.2', '0.35,0.22,0.14'];
const HAIRS = ['0.1,0.08,0.06', '0.2,0.13,0.08', '0.35,0.23,0.13', '0.55,0.4,0.22', '0.82,0.68,0.42', '0.6,0.6,0.58', '0.55,0.25,0.1', '0.05,0.05,0.05'];
const LEGS = '0.5', NP = POSES.length;
const arr = (n, a) => `vec3[${n}](${a.map(c => `vec3(${c})`).join(', ')})`;
const f1 = v => v.toFixed(1);
const L = LAYOUT, LAY = `#define ATL vec2(${f1(L.W)}, ${f1(L.H)})
#define ARM_W ${f1(L.arms.w)}
#define ARM_H ${f1(L.arms.h)}
#define ARM_PER ${f1(L.arms.per)}
#define HEAD_W ${f1(L.head.w)}
#define HEAD_H ${f1(L.head.h)}
#define HEAD_PER ${f1(L.head.per)}
#define HEAD_Y ${f1(L.head.y)}
#define HEAD_CM ${L.head.cm}
#define HEAD_TOP ${f1(L.head.at + L.head.y0 + L.head.h * L.head.cm)}
#define TORSO_W ${f1(L.torso.w)}
#define TORSO_H ${f1(L.torso.h)}
#define TORSO_Y ${f1(L.torso.y)}
#define LEGS ${LEGS}`;

// atlas: fanAtlas(). pal: 16 colours (fans.js), set per ground. Per fan: aFan (torso + 16 x long sleeves,
// mine, phase, role), aCol (shirt, second colour, skin + 8 x hair, head style), aLook (mirrored or
// not, where he looks relative to the play x and z, 1 / 2: talks to the neighbour on his left / right).
// crowd: the match-moment uniforms plus uBall (where the play is; uBallOn 0: use the viewer).
export function fanMaterial(atlas, light, crowd) {
  return new THREE.ShaderMaterial({
    fog: true, side: THREE.DoubleSide,
    uniforms: { ...fogU(), ...light, ...crowd, uPoses: { value: 0 }, uA: { value: atlas.a }, uB: { value: atlas.b }, uTop: { value: atlas.top }, uHW: { value: atlas.hw }, uPal: { value: Array.from({ length: 16 }, () => new THREE.Color()) }, uDay: { value: 1 } },
    vertexShader: `${LAY}
attribute vec4 aSeat; attribute vec4 aFan; attribute vec4 aCol; attribute vec4 aLook; attribute vec2 aShade;
uniform float uTop[${NP}], uHW[${NP}], uDay, uPoses, uBallOn; uniform vec3 uPal[16], uBall;
varying vec2 vLoc; varying vec4 vCell; varying vec3 vMir; varying vec3 vShirt, vAcc, vSkin, vHair, vLegs; varying float vSh;
${FAN_STATE}
${FOG_V}
void main() {
  vec4 st = fanState(aFan.z, aFan.w, aFan.y);
  if (uPoses > 0.5) st = vec4(floor(fract(aFan.z * 7.0) * ${NP}.0), 0.45, 1.0, step(0.5, fract(aFan.z * 3.0)));   // the look page's line-up of every pose
  float pose = mod(st.x, 32.0), armMir = st.x >= 32.0 ? -1.0 : 1.0;
  int pi = int(pose + 0.5);
  float s = aSeat.w, bodyMir = aLook.x, hw = uHW[pi], top = uTop[pi];
  vec3 base = aSeat.xyz + vec3(0.0, 0.2 + st.y, 0.0);
  vec3 d = cameraPosition - base; d.y = 0.0; d = normalize(d + vec3(1e-5, 0.0, 0.0));
  vec3 right = vec3(d.z, 0.0, -d.x);
  // where he looks: at the play (near the ball, each his own bit of it) or, now and then, at a neighbour
  vec3 tgt = (uBallOn > 0.5 ? uBall : cameraPosition) + vec3(aLook.y, 0.0, aLook.z);
  vec3 dir = tgt - base;
  float ang = atan(dot(dir, right), dot(dir, d));
  if (aLook.w > 0.5 && fract(uTime / 9.0 + aFan.z) < 0.4) ang = (aLook.w > 1.5 ? 1.25 : -1.25);
  float aa = abs(ang), view = aa < 0.13 ? 0.0 : aa < 0.8 ? 1.0 : 2.0, headMir = ang < 0.0 ? -1.0 : 1.0;
  vCell = vec4(pose * 2.0 + floor(aFan.x / 16.0), aCol.w * 9.0 + view * 3.0 + st.w, mod(aFan.x, 16.0), 0.0);
  vMir = vec3(bodyMir * armMir, headMir, bodyMir);
  float lean = 0.035 * sin(uTime * (0.5 + aFan.z) + aFan.z * 40.0);
  float ly = mix(-LEGS, top, position.y), lx = position.x * 2.0 * hw;
  vec3 p = base + right * (lx + max(ly, 0.0) / 1.6 * lean) * s + vec3(0.0, ly * s, 0.0);
  vLoc = vec2(lx, ly);
  SKIN_HAIR
  vShirt = uPal[int(aCol.x)]; vAcc = uPal[int(aCol.y)]; vSkin = SKIN[int(mod(aCol.z, 8.0))]; vHair = HAIR[int(floor(aCol.z / 8.0))];
  vLegs = fh(aFan.z, 3.3) < 0.55 ? vec3(0.17, 0.2, 0.3) : fh(aFan.z, 5.1) < 0.6 ? vec3(0.1, 0.1, 0.11) : vec3(0.32, 0.31, 0.3);
  vSh = mix(aShade.y, aShade.x, uDay);
  vec4 mvPosition = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
${FOG_VM}
}`.replace('SKIN_HAIR', `const vec3 SKIN[6] = ${arr(6, SKINS)}; const vec3 HAIR[8] = ${arr(8, HAIRS)};`),
    fragmentShader: `${LAY}
uniform sampler2D uA, uB; uniform vec3 uAmb, uSun, uFlood; uniform float uWet;
varying vec2 vLoc; varying vec4 vCell; varying vec3 vMir; varying vec3 vShirt, vAcc, vSkin, vHair, vLegs; varying float vSh;
${FOG_F}
vec2 gX, gY;
// one layer: the cell's top-left (px), where this fragment is in it (px from its top-left), its size and
// px per cm. False if outside it or clear there.
bool layer(vec2 cell, vec2 q, vec2 size, float k, out vec4 a, out vec2 b) {
  if (q.x < 0.0 || q.y < 0.0 || q.x > size.x || q.y > size.y) return false;
  vec2 uv = (cell + q) / ATL, dx = gX * k / ATL, dy = gY * k / ATL;
  a = textureGrad(uA, uv, dx, dy);
  if (a.a < 0.5) return false;
  b = textureGrad(uB, uv, dx, dy).rg;
  return true;
}
void main() {
  vec2 cm = vLoc * 100.0;
  gX = dFdx(cm); gY = dFdy(cm);
  vec4 a = vec4(0.0); vec2 b = vec2(0.0);
  vec3 c;
  if (vLoc.y < 0.0) {
    // his legs, under the sprite: two trouser legs, shoes at the bottom, in the shade of the row in front
    float k = -vLoc.y / LEGS, leg = abs(abs(vLoc.x) - 0.085);
    if (leg > 0.082 - 0.024 * k) discard;
    c = (k > 0.86 ? vec3(0.08) : vLegs * (1.0 - 0.3 * k)) * (1.1 - leg * 4.0);
  } else {
    float ac = floor(vCell.x + 0.5), hc = floor(vCell.y + 0.5), tc = floor(vCell.z + 0.5);
    bool hit = layer(vec2(mod(ac, ARM_PER) * ARM_W, floor(ac / ARM_PER) * ARM_H), vec2(cm.x * vMir.x + ARM_W * 0.5, ARM_H - cm.y), vec2(ARM_W, ARM_H), 1.0, a, b);
    if (!hit) hit = layer(vec2(mod(hc, HEAD_PER) * HEAD_W, HEAD_Y + floor(hc / HEAD_PER) * HEAD_H), vec2(cm.x * vMir.y / HEAD_CM + HEAD_W * 0.5, (HEAD_TOP - cm.y) / HEAD_CM), vec2(HEAD_W, HEAD_H), 1.0 / HEAD_CM, a, b);
    if (!hit) hit = layer(vec2(mod(tc, 16.0) * TORSO_W, TORSO_Y), vec2(cm.x * vMir.z + TORSO_W * 0.5, TORSO_H - cm.y), vec2(TORSO_W, TORSO_H), 1.0, a, b);
    if (!hit) discard;
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
