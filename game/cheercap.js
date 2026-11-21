// Recorded celebrating for the squad at the trophy presentation (game/ceremonycast.js): stretches of CMU
// captures of people being happy, baked as loops by tools/build-anim.mjs --set cheer into
// game/assets/anim/cheer.js. Which take is which:
//   clap    80_43 'happy': fast applause with the hands at the chin
//   giddy   80_43 'happy': bouncing on the toes with the hands together at the chest
//   yes     79_69 'very happy': both arms thrown wide overhead, twice, then fists pumped
//   armsUp  14_07 'jump up to grab, reach for, tiptoe': both arms overhead, on the toes, small jumps
//   reach   13_10 the same from another person
//   jump    49_03 'jump up and down': three jumps in place, arms at the sides (used for the legs)
//   bounce  49_02 'jump up and down': small quick hops (used for the legs)
// Wrists are never taken from a capture (noise: they read as broken).
import * as THREE from 'three';
import { BONES, CLIPS } from './assets/anim/cheer.js';

const NB = BONES.length, slerp = THREE.Quaternion.slerpFlat;
for (const c of Object.values(CLIPS)) { c.q = new Float32Array(c.q); c.h = new Float32Array(c.h); }
export const CHEER = CLIPS;
export const newPose = () => ({ q: new Float32Array(NB * 4), h: new Float32Array(3) });

const PAIR = BONES.map(n => (/[LR]$/.test(n) ? BONES.indexOf(n.slice(0, -1) + (n.endsWith('L') ? 'R' : 'L')) : -1));
const tmp = newPose();
// The clip's pose `t` seconds in, round and round (out). mirror: seen in a mirror down his middle.
export function cheerPose(name, t, out, mirror = false) {
  const clip = CLIPS[name], f = ((t / clip.period) % 1 + 1) % 1 * clip.n, i0 = Math.floor(f) % clip.n, i1 = (i0 + 1) % clip.n, k = f - Math.floor(f), to = mirror ? tmp : out;
  for (let b = 0; b < NB; b++) slerp(to.q, b * 4, clip.q, (i0 * NB + b) * 4, clip.q, (i1 * NB + b) * 4, k);
  for (let j = 0; j < 3; j++) to.h[j] = clip.h[i0 * 3 + j] + (clip.h[i1 * 3 + j] - clip.h[i0 * 3 + j]) * k;
  if (!mirror) return out;
  for (let b = 0; b < NB; b++) {
    const o = (PAIR[b] < 0 ? b : PAIR[b]) * 4;
    out.q[o] = tmp.q[b * 4]; out.q[o + 1] = -tmp.q[b * 4 + 1]; out.q[o + 2] = -tmp.q[b * 4 + 2]; out.q[o + 3] = tmp.q[b * 4 + 3];
  }
  out.h[0] = -tmp.h[0]; out.h[1] = tmp.h[1]; out.h[2] = tmp.h[2];
  return out;
}

// Parts of the body a pose can be laid on (game/mocap.js applyPose takes one of these).
const names = re => new Set(BONES.filter(n => re.test(n)));
export const PART = {
  legs: names(/^(hips|upperLeg|lowerLeg|foot|toe)/),
  trunk: names(/^(spine|chest)/),
  arms: names(/^(clavicle|upperArm|foreArm)/),
  upper: names(/^(spine|chest|clavicle|upperArm|foreArm)/),
  body: names(/^(?!hand|neck|head)/),          // everything but the wrists and the head (the head watches the cup)
};
