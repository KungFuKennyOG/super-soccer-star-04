// The size of the pitch the '04-look ground is built round. Pure numbers, no three.js (groundplan.js is
// tested in Node). The default is the VR game's half pitch, exactly as it always was (rules/tuning.js
// PITCH and GOAL): one goal at z = -34, halfway at z = 0, a stand behind you at z = 7.
// The flat-screen brawl (brawl.html) calls setFullPitch() before it builds the stadium: a whole pitch with
// a goal at each end (z = -halfL and +halfL), stands all round, centred on the centre spot.
import { GOAL, PITCH } from '../../rules/tuning.js';

export const ARENA = {
  full: false,
  halfW: PITCH.halfW,     // half the pitch's width (touchline at x = +-halfW)
  goalZ: GOAL.z,          // the (far) goal line
  nearZ: 7,               // where the near stand starts (before the recipe's gap)
  centreZ: -15,           // what the stands and fans face
};

export function setFullPitch(halfW, halfL) {
  Object.assign(ARENA, { full: true, halfW, goalZ: -halfL, nearZ: halfL + 3.4, centreZ: 0 });
}
