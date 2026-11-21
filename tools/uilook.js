// Every '04 menu and HUD canvas painted flat with made-up data, for checking the look without playing
// (tools/uilook.html; node tools/uishots.mjs out/dir writes each one as a PNG, full size and at the size
// it has in the headset). HEADSET_PX: how wide each canvas is in a Quest 3 eye at framebuffer scale 0.7,
// taken as 11 px per degree (conservative: the lens centre is sharper).
import { MW, MH, paintMode, paintSettings, paintTeam, paintHub, paintMessage } from '../game/ps2/menudraw.js';
import { BW, BH, paintBug, SW, SH, paintBoard, NW, NH, paintBanner, TW, TH, paintTag, UW, UH, paintSubtitle, CW, CH, paintTraining, RW, RH, RMAP, paintRadar } from '../game/ps2/hudpaint.js';
import { MODES, ROWS } from '../game/menus.js';
import { NATIONS, CLUBS, byId } from '../rules/teams.js';
import { createCup, playUser } from '../rules/cup.js';
import { STEPS } from '../rules/tutorial.js';
import { attackLines, cupLines } from '../game/results.js';
import { YEAR } from '../game/ps2/ui.js';
import * as THREE from 'three';
import { renderBackdrop } from '../game/ps2/menuscene.js';

const deg = (w, d) => 2 * Math.atan(w / 2 / d) * 180 / Math.PI;
const PPD = 11, px = (w, d) => Math.round(deg(w, d) * PPD);
// seeded random so the cup tables are the same every run
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const settings = { difficulty: 1, length: 1, wobble: 1, commentary: 2, replays: 1, juice: 1, skills: 1, weather: 0, ball: 0, boots: 0, heads: 0 };
const world = createCup('world', 'BRA', rnd);
playUser(world, 2, 1, rnd);
const ko = createCup('world', 'ENG', rnd);
for (let i = 0; i < 3; i++) playUser(ko, 3, 0, rnd);
playUser(ko, 2, 1, rnd);                                // into the quarter-finals
const club = createCup('club', 'MAD', rnd);
const fakeWorld = { players: [
  { x: 0, z: -20, role: 'you', team: 'home' }, { x: -8, z: -24, role: 'mate', team: 'home' }, { x: 9, z: -14, role: 'mate', team: 'home' },
  { x: 1, z: -27, role: 'def', team: 'away' }, { x: -5, z: -30, role: 'def', team: 'away' }, { x: 6, z: -31, role: 'def', team: 'away' }, { x: 0, z: -41, role: 'gk', team: 'away' },
], ball: { x: 0.2, z: -20.6 } };
const GZ = -42;
// the picture behind the menus, as the game renders it (?kit=TEAM for another team's shirt)
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true });
const kitTeam = byId(new URLSearchParams(location.search).get('kit') || 'MUN');
const t0 = performance.now();
const back = renderBackdrop(renderer, kitTeam.kit, kitTeam.id);
const backMs = performance.now() - t0;
const step = STEPS[3];

// name: [w, h, paint(ctx), headset px across]
export const SCREENS = {
  title: null,
  mode: [MW, MH, c => paintMode(c, { back, modes: MODES, sel: 1 }), px(2.2, 2.6)],
  settings: [MW, MH, c => paintSettings(c, { back, rows: ROWS, settings, sel: 2 }), px(2.2, 2.6)],
  settingsLocker: [MW, MH, c => paintSettings(c, { back, rows: ROWS, settings, sel: 9 }), px(2.2, 2.6)],
  worldmap: [MW, MH, c => paintTeam(c, { back, mode: 'world', teams: NATIONS, sel: NATIONS.findIndex(t => t.id === 'NED'), blink: 0.1, cupName: `WORLD CUP ${YEAR}` }), px(2.2, 2.6)],
  worldmapFar: [MW, MH, c => paintTeam(c, { back, mode: 'world', teams: NATIONS, sel: NATIONS.findIndex(t => t.id === 'BRA'), blink: 0.4, cupName: `WORLD CUP ${YEAR}` }), px(2.2, 2.6)],
  club: [MW, MH, c => paintTeam(c, { back, mode: 'club', teams: CLUBS, sel: 0, blink: 0.6, cupName: 'CHAMPIONS CUP' }), px(2.2, 2.6)],
  clubHalves: [MW, MH, c => paintTeam(c, { back, mode: 'club', teams: CLUBS, sel: CLUBS.findIndex(t => t.kit.pattern === 'halves'), blink: 0.1, cupName: 'CHAMPIONS CUP' }), px(2.2, 2.6)],
  group: [MW, MH, c => paintHub(c, { back, cup: world, blink: 0.6, cupName: `WORLD CUP ${YEAR}` }), px(2.2, 2.6)],
  bracket: [MW, MH, c => paintHub(c, { back, cup: ko, blink: 0.6, cupName: `WORLD CUP ${YEAR}` }), px(2.2, 2.6)],
  bracketClub: [MW, MH, c => paintHub(c, { back, cup: club, blink: 0.1, cupName: 'CHAMPIONS CUP' }), px(2.2, 2.6)],
  fulltime: [MW, MH, c => paintMessage(c, { back, title: 'FULL TIME', lines: attackLines({ goals: 7, shots: 12, points: 14350 }, 12000, true), ok: 'PRESS A FOR THE MENU', blink: 0.6 }), px(2.2, 2.6)],
  cupResult: [MW, MH, c => { const cp = createCup('club', 'MAD', rnd); const r = playUser(cp, 1, 2, rnd); paintMessage(c, { back, title: 'FULL TIME', lines: cupLines(cp, r, byId('MAD'), byId('MUN'), 1, 2, 'r16').lines, ok: 'PRESS A TO TRY AGAIN', blink: 0.1 }); }, px(2.2, 2.6)],
  bugCup: [BW, BH, c => paintBug(c, { home: byId('ENG'), away: byId('ARG'), us: 1, them: 2, goals: 1, points: 2400, clock: '1:42' }), px(0.3, 0.72)],
  bugAttack: [BW, BH, c => paintBug(c, { home: byId('MAD'), away: byId('BAR'), goals: 4, points: 8250, clock: '0:57' }), px(0.3, 0.72)],
  bugGoal: [BW, BH, c => paintBug(c, { home: byId('LIV'), away: byId('TUR'), us: 2, them: 2, goals: 2, points: 5100, clock: '0:31', flash: 'GOAL!' }), px(0.3, 0.72)],
  board: [SW, SH, c => paintBoard(c, { goals: 3, clock: '1:12', points: 6200, flash: '', score: '' }), px(18, 40)],
  bannerKickoff: [NW, NH, c => paintBanner(c, { text: 'KICK OFF!', sub: 'V MUNICH\n2:00 - SCORE ALL YOU CAN\nHOME - MADRID', tone: 'info', big: true }), px(2.4, 3)],
  bannerGoal: [NW, NH, c => paintBanner(c, { text: 'GOAL!', sub: 'VOLLEY +600', tone: 'good' }), px(2.4, 3)],
  bannerBad: [NW, NH, c => paintBanner(c, { text: 'INTERCEPTED', sub: 'THEY BREAK...', tone: 'bad' }), px(2.4, 3)],
  bannerScenario: [NW, NH, c => paintBanner(c, { text: "71' ENG 0-1 ARG", sub: 'QUARTER-FINAL\n1 DOWN - SCORE 2 TO WIN\nNATIONAL STADIUM', tone: 'info', big: true }), px(2.4, 3)],
  tag: [TW, TH, c => paintTag(c, { num: 9, lob: false }), px(0.8, 8)],
  tagLob: [TW, TH, c => paintTag(c, { num: 7, lob: true }), px(0.8, 8)],
  subtitle: [UW, UH, c => paintSubtitle(c, 'AND THE CROWD ARE ON THEIR FEET!'), px(0.64, 0.72)],
  subtitleLong: [UW, UH, c => paintSubtitle(c, 'HE HAS LEFT THE DEFENDER FOR DEAD THERE AND THE KEEPER HAD NO CHANCE WHATSOEVER WITH THAT ONE'), px(0.64, 0.72)],
  training: [CW, CH, c => paintTraining(c, { i: 4, total: STEPS.length, title: step.title, lines: step.vr, need: step.need, n: step.need * 0.6, unit: step.unit, vr: true }), px(0.64, 0.72)],
  trainingDone: [CW, CH, c => paintTraining(c, { i: 4, total: STEPS.length, title: step.title, lines: step.pc, need: step.need, n: step.need, done: true, vr: false }), px(0.64, 0.72)],
  radar: [RW, RH, c => paintRadar(c, fakeWorld, 3, 6200, x => RW / 2 + x / 22 * (RW / 2 - 6), z => 5 + (z - GZ) / -GZ * (RMAP - 8), { box: GZ + 16.5 }), px(0.16, 0.42)],
};
delete SCREENS.title;

const out = document.getElementById('out'), canvases = {};
for (const [name, [w, h, paint, hp]] of Object.entries(SCREENS)) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t0 = performance.now(); paint(c.getContext('2d')); const ms = performance.now() - t0;
  const f = document.createElement('figure'), cap = document.createElement('figcaption');
  cap.textContent = `${name} ${w}x${h} -> ${hp}px in the headset, ${ms.toFixed(1)} ms`;
  f.append(cap, c); out.append(f); canvases[name] = { c, hp, ms };
}
// the canvas at its headset width, smoothed down in halving steps like a mipmapped texture would be
function shrink(name, w) {
  let src = canvases[name].c;
  while (src.width / 2 >= w) { const d = document.createElement('canvas'); d.width = src.width / 2; d.height = src.height / 2; const x = d.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, d.width, d.height); src = d; }
  const d = document.createElement('canvas'); d.width = w; d.height = Math.round(src.height * w / src.width);
  const x = d.getContext('2d'); x.fillStyle = '#2a3a2a'; x.fillRect(0, 0, d.width, d.height); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, d.width, d.height);
  return d.toDataURL();
}
window.__ui = {
  ready: true, names: Object.keys(canvases),
  full: n => canvases[n].c.toDataURL(), headset: n => shrink(n, canvases[n].hp),
  backMs: () => +backMs.toFixed(0),
  info: () => Object.fromEntries(Object.entries(canvases).map(([n, v]) => [n, { hp: v.hp, ms: +v.ms.toFixed(1) }])),
};
