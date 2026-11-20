// The keeper's gloves meet the ball: the real sim takes real shots at him and the real poses (game/keeperpose.js,
// game/keepersave.js) are put on a bare skeleton (the PS1 body and the '04 body share it). Measured: the gloved palms
// against the ball when his hands get to it and on the frame the sim says it's saved, how far the ball has to be
// drawn to get there, nothing under the grass, and his feet gripping it as he shuffles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { heldBall } from '../../game/keeperpose.js';
import { PALM, BALL_R, armInside } from '../../game/keeperhands.js';
import { createWorld, stepSim } from '../../rules/sim.js';
import { GOAL } from '../../rules/tuning.js';

const DT = 1 / 72, fixed = () => 0.5;
const v = () => new THREE.Vector3();

// You shoot from `from` m out at (tx, ty) on the goal line, letting go at 0.5 s. kind forces the keeper's catch or parry.
function play({ tx, ty, hold = 0.5, from = 16, fx = 0, kind = null, secs = 3, across = false }) {
  const w = createWorld(fixed);
  if (kind) w.tune = { ...w.tune, ai: { ...w.tune.ai, gkCatchBelow: kind === 'catch' ? 99 : 0, gkCatchAtHim: kind === 'catch' ? 99 : 0 } };
  for (const id of ['d1', 'd2', 'd3', 'm1', 'm2']) { const p = w.byId[id]; p.x += 25; p.z = 20; p.stun = 99; }
  w.you.x = fx; w.you.z = GOAL.z + from; w.ball.x = fx; w.ball.z = GOAL.z + from - 0.6;
  const { bones, by } = buildSkeleton(), root = new THREE.Group();
  root.add(bones[0]);
  const m = { root, bone: by, shadow: new THREE.Object3D(), phase: 0 }, gk = w.byId.gk, rows = [];
  for (let t = 0; t < secs; t += DT) {
    const it = { sprint: across, move: across ? { x: t < secs / 2 ? 1 : -1, z: 0 } : { x: 0, z: 0 }, facing: { x: 0, z: -1 } };
    if (tx !== undefined && Math.abs(t - 0.5) < DT / 2) {
      const eye = { x: w.you.x, y: 1.7, z: w.you.z }, d = new THREE.Vector3(tx - eye.x, ty - eye.y, GOAL.z - eye.z).normalize();
      it.shot = { eye, dir: { x: d.x, y: d.y, z: d.z }, holdT: hold };
    }
    const before = { ...w.ball }, ev = stepSim(w, it, DT, fixed);
    for (const e of ev) if (e.type === 'windup' && e.kind === 'shot') m.split = 0;
    placeModel(m, gk);
    animate(m, gk, DT, t, false, null, w.ball, false);
    m.root.updateMatrixWorld(true);
    for (const b of Object.values(by)) assert.ok(Number.isFinite(b.quaternion.x + b.quaternion.w + b.position.y), `${b.name} finite`);
    const palms = ['L', 'R'].map(n => by['hand' + n].localToWorld(PALM[n].clone()));
    const held = heldBall(m, v());
    rows.push({ t, ev: ev.map(e => e.type), sv: m.sv && { t: m.sv.t, T: m.sv.T, kind: m.sv.kind, stand: m.sv.stand, grip: m.sv.grip }, palms, held, ball: { ...w.ball }, before, arm: Math.max(armInside(by, 'L'), armInside(by, 'R')),
      low: lowest(m), feet: ['L', 'R'].map(n => by['foot' + n].getWorldPosition(v())), owner: w.owner, gkx: gk.x });
  }
  return rows;
}
// the lowest point of him: his joints, less the body round each, and the corners of his boots' soles
const SOLE = [[-0.05, -0.085, -0.06], [0.05, -0.085, -0.06], [-0.05, -0.085, 0.17], [0.05, -0.085, 0.17]].map(a => new THREE.Vector3(...a));
const ROUND = { hips: 0.13, spine: 0.13, chest: 0.13, neck: 0.1, head: 0.11, upperArmL: 0.07, upperArmR: 0.07, foreArmL: 0.05, foreArmR: 0.05, handL: 0.035, handR: 0.035, lowerLegL: 0.06, lowerLegR: 0.06 };
function lowest(m) {
  let lo = 9;
  for (const [k, r] of Object.entries(ROUND)) lo = Math.min(lo, m.bone[k].getWorldPosition(v()).y - r);
  for (const n of ['L', 'R']) for (const s of SOLE) lo = Math.min(lo, m.bone['foot' + n].localToWorld(s.clone()).y);
  return lo;
}
// the gloved palms against a ball at c: each palm's gap to its surface (m)
const gaps = (r, c) => r.palms.map(p => p.distanceTo(c) - BALL_R);
const cm = x => (x * 100).toFixed(1);

const DIVES = [
  ['a low dive to his left, caught', { tx: 2.5, ty: 0.3, kind: 'catch' }], ['a low dive to his right, caught', { tx: -2.5, ty: 0.3, kind: 'catch' }],
  ['a low dive to his left, parried', { tx: 2.6, ty: 0.3, kind: 'parry' }], ['a low dive to his right, parried', { tx: -2.6, ty: 0.3, kind: 'parry' }],
  ['a high dive to his left, caught', { tx: 2.4, ty: 1.9, kind: 'catch' }], ['a high dive to his right, caught', { tx: -2.4, ty: 1.9, kind: 'catch' }],
  ['a high dive to his left, parried', { tx: 2.4, ty: 1.95, kind: 'parry' }], ['a high dive to his right, parried', { tx: -2.4, ty: 1.95, kind: 'parry' }],
  ['a mid-height dive, parried', { tx: 1.7, ty: 1.0, kind: 'parry', hold: 0.8 }],
];
const STANDS = [['a low one at him, scooped', { tx: 0.15, ty: 0.25, hold: 0.4 }], ['one at his waist', { tx: -0.1, ty: 0.85, hold: 0.4 }], ['one at his chest', { tx: 0.15, ty: 1.2, hold: 0.4 }], ['one over his head', { tx: 0.1, ty: 2.15, hold: 0.4 }],
  ['a hard one at his chest, parried', { tx: 0.15, ty: 1.2, hold: 0.8 }]];

export const REPORT = [];
for (const [name, o] of [...DIVES, ...STANDS]) {
  test(`keeper: ${name}: his gloves meet the ball`, () => {
    const rows = play(o), k = rows.findIndex(r => r.sv && r.sv.t >= r.sv.T), s = rows.findIndex(r => r.ev.includes('saved') || r.ev.includes('parried'));
    assert.ok(k > 0, 'he got there'); assert.ok(s > 0, 'the sim saved it');
    const r = rows[k], kind = r.sv.kind, stand = r.sv.stand;
    assert.equal(!!stand, name.includes('one'), `a ${stand ? 'standing save' : 'dive'}`);
    // the frame his hands get there: they are on the ball where the pose drew it; how far that is from the sim's ball then
    const c = r.held || null, at = new THREE.Vector3(r.ball.x, r.ball.y, r.ball.z);
    const g = c ? gaps(r, c) : gaps(r, at), near = Math.min(...g);
    assert.ok(c, 'the ball is drawn in his hands as they meet it');
    if (kind === 'catch') assert.ok(Math.max(...g.map(Math.abs)) < 0.03, `${name}: both palms on the ball (${g.map(cm).join(', ')} cm)`);
    else assert.ok(Math.abs(near) < 0.03, `${name}: the near palm on the ball (${cm(near)} cm)`);
    const jump = c.distanceTo(at);
    // the frame the sim says it's saved: the ball (as drawn) still between his gloves for a catch
    const rs = rows[s], gs = rs.held ? gaps(rs, rs.held) : null;
    if (kind === 'catch') assert.ok(gs && Math.max(...gs.map(Math.abs)) < 0.03, `${name}: on the save frame both palms on it (${gs && gs.map(cm).join(', ')} cm)`);
    const lo = Math.min(...rows.map(x => x.low));
    assert.ok(lo > -0.01, `${name}: nothing under the grass (lowest ${cm(lo)} cm)`);
    assert.ok(s - k >= -1 && s - k <= 6, `${name}: the sim's save comes ${s - k} frames after his hands get there`);
    REPORT.push(`${name.padEnd(36)} ${stand ? 'stand' : 'dive '} ${kind.padEnd(6)} ${r.sv.grip.padEnd(7)} T ${r.sv.T.toFixed(2)} s  palms ${g.map(cm).join(' / ')} cm  ball drawn ${cm(jump)} cm from the sim's  save frame +${s - k}  ${gs ? 'palms then ' + gs.map(cm).join(' / ') + ' cm  ' : ''}lowest ${cm(lo)} cm`);
  });
}

test('keeper: a shot he can\'t reach: his hands come up short of it', () => {
  const rows = play({ tx: 3.4, ty: 2.2, hold: 1.0, from: 14 }), g = rows.find(r => r.ev.includes('goal'));
  assert.ok(g, 'a goal');
  const best = Math.min(...rows.filter(r => r.t < g.t).map(r => Math.min(...gaps(r, new THREE.Vector3(r.ball.x, r.ball.y, r.ball.z)))));
  assert.ok(best > 0.05, `nearest palm ${cm(best)} cm from it`);
  assert.ok(Math.min(...rows.map(r => r.low)) > -0.01, 'nothing under the grass');
  REPORT.push(`beaten (top corner)                   nearest palm ${cm(best)} cm`);
});

test('keeper: his feet grip the grass as he shuffles across', () => {
  const rows = play({ across: true, from: 14, fx: -9, secs: 5 }), speeds = [];
  for (let i = 1; i < rows.length; i++) for (const k of [0, 1]) {
    const a = rows[i - 1].feet[k], b = rows[i].feet[k];
    if (a.y < 0.115 && b.y < 0.115) speeds.push(Math.hypot(b.x - a.x, b.z - a.z) / DT);
  }
  speeds.sort((a, b) => a - b);
  const still = speeds.filter(s => s < 0.02).length / speeds.length, moved = Math.max(...rows.map(r => r.gkx)) - Math.min(...rows.map(r => r.gkx));
  assert.ok(moved > 1.5, `he moved ${moved.toFixed(1)} m across`);
  assert.ok(still > 0.85, `a foot on the grass is still ${(still * 100).toFixed(0)}% of the time`);
  assert.ok(Math.min(...rows.map(r => r.low)) > -0.01, 'nothing under the grass');
  REPORT.push(`shuffle: ${moved.toFixed(1)} m across, foot on the grass still (<2 cm/s) ${(still * 100).toFixed(0)}% of frames, median ${(speeds[speeds.length >> 1] * 100).toFixed(1)} cm/s`);
});

test.after(() => { if (process.env.KEEPER_REPORT) console.log(REPORT.join('\n')); });

// His arms stay out of his body (Kenny: "his arms still go through his body sometimes"): the arm's middle line may
// brush a fat trunk (3 cm) but is never well inside it for long. Before the hands were kept in front of his chest an
// arm reaching across was 10 cm and more inside for up to a second of a save.
for (const [name, o] of [...DIVES, ...STANDS]) {
  test(`keeper: ${name}: his arms don't go through his body`, () => {
    const rows = play({ ...o, secs: 3.4 }), deep = rows.filter(r => r.arm > 0.03), worst = Math.max(...rows.map(r => r.arm));
    assert.ok(worst < 0.1, `an arm ${cm(worst)} cm inside his trunk`);
    assert.ok(deep.length <= 26, `${deep.length} frames with an arm over 3 cm inside (72 a second)`);
  });
}
