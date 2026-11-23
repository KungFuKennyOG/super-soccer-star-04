// Settings (saved in localStorage) and the display side of them: the browser's resolution. The PS1 vertex
// wobble setting is gone (the '04 look has nothing it could wobble); the few ps1() materials still in
// the game are kept still.
import { PS1 } from './ps1.js';

const SETTINGS_KEY = 'sss96.settings';

// difficulty (0 normal, 1 hard, 2 legend: DIFFICULTY in rules/tuning.js; HARD by default since Kenny found
// the first defence too easy), match length (index into LENGTHS), commentary (0 off, 1 text,
// 2 voice), goal replays and hit effects (0 off, 1 on), skill gestures (0 off, 1 on, 2 only with the right grip held),
// weather (0 random, 1 clear, 2 rain, 3 snow), and the locker (LOCKER option indices)
const DEFAULTS = { difficulty: 1, length: 1, commentary: 2, replays: 1, juice: 1, skills: 1, weather: 0, ball: 0, boots: 0, heads: 0 };
// The locker: your ball, boots and big heads, picked in SETTINGS.
export const LOCKER = {
  ball: { name: 'BALL', options: ['CLASSIC', 'STAR', 'RETRO', 'GOLD'] },
  boots: { name: 'BOOTS', options: ['BLACK', 'WHITE', 'RED', 'GOLD'] },
  heads: { name: 'BIG HEADS', options: ['OFF', 'ON'] },
};
export function loadSettings() {
  try {
    const s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    delete s.wobble;                                  // saved by older versions (the PS1 WOBBLE setting)
    return s;
  } catch (e) { return { ...DEFAULTS }; }
}
export function saveSettings(settings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} }

// The PS1 materials' vertex snap and texture warp: off everywhere (the grid out of reach, perspective-correct
// textures). Kept as a function because main.js calls it after settings change and on resize.
export function applyWobble() {
  PS1.snap.value.set(8192, 8192);
  PS1.affine.value = 0;
}

// The browser renders at the screen's own resolution (up to 2x pixel density). It was 480 lines scaled up
// with hard pixels for the PS1 look; Kenny asked for more resolution with the '04 one.
export function lowRes(renderer, settings) {
  if (renderer.xr.isPresenting) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  applyWobble();
}
