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
function play({ tx, ty, hold = 0.5, from = 16, fx = 0, kind = null, secs = 3, across = false, move = null, seed = null, sprint = across }) {
  const w = createWorld(fixed);
  if (kind) w.tune = { ...w.tune, ai: { ...w.tune.ai, gkCatchBelow: kind === 'catch' ? 99 : 0, gkCatchAtHim: kind === 'catch' ? 99 : 0 } };
  for (const id of ['d1', 'd2', 'd3', 'm1', 'm2']) { const p = w.byId[id]; p.x += 25; p.z = 20; p.stun = 99; }
  w.you.x = fx; w.you.z = GOAL.z + from; w.ball.x = fx; w.ball.z = GOAL.z + from - 0.6;
  const { bones, by } = buildSkeleton(), root = new THREE.Group();
  root.add(bones[0]);
  const m = { root, bone: by, shadow: new THREE.Object3D(), phase: 0 }, gk = w.byId.gk, rows = [];
  if (seed !== null) m.kSeed = seed;
  for (let t = 0; t < secs; t += DT) {
    const it = { sprint, move: move ? move(t) : across ? { x: t < secs / 2 ? 1 : -1, z: 0 } : { x: 0, z: 0 }, facing: { x: 0, z: -1 } };
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
    const headC = by.head.localToWorld(new THREE.Vector3(0, 0.09, 0.01));
    rows.push({ t, ev: ev.map(e => e.type), sv: m.sv && { t: m.sv.t, T: m.sv.T, kind: m.sv.kind, stand: m.sv.stand, grip: m.sv.grip, ground: m.sv.ground, v: m.sv.var }, headC, head: by.head.getWorldPosition(v()), hands: ['L', 'R'].map(n => by['hand' + n].getWorldPosition(v())), palms, held, ball: { ...w.ball }, before, arm: Math.max(armInside(by, 'L'), armInside(by, 'R')),
      low: lowest(m), feet: ['L', 'R'].map(n => by['foot' + n].getWorldPosition(v())), owner: w.owner, gkx: gk.x,
      // for the footwork: the balls of his feet, which feet are planted, his hips, the way he faces, how far each wrist is bent
      sole: ['L', 'R'].map(n => by['foot' + n].localToWorld(new THREE.Vector3(0, -0.085, 0.1))), down: ['L', 'R'].map(n => !m.sv && m.kState !== 'run' && m.kf && !m.kf[n].air), hips: by.hips.getWorldPosition(v()), yaw: m.root.rotation.y,
      wrist: Math.max(...['L', 'R'].map(n => by['hand' + n].getWorldPosition(v()).sub(by['foreArm' + n].getWorldPosition(v())).angleTo(by['hand' + n].localToWorld(new THREE.Vector3(0, -1, 0)).sub(by['hand' + n].getWorldPosition(v()))))) });
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
const STANDS = [['a low one at him, scooped', { tx: 0.15, ty: 0.25, hold: 0.4, kind: 'catch' }], ['one at his waist', { tx: -0.1, ty: 0.85, hold: 0.4, kind: 'catch' }], ['one at his chest', { tx: 0.15, ty: 1.2, hold: 0.4, kind: 'catch' }],
  ['one at his head', { tx: 0.1, ty: 1.65, hold: 0.4, kind: 'catch' }], ['one over his head', { tx: 0.1, ty: 2.15, hold: 0.4, kind: 'catch' }], ['one he jumps for', { tx: 0.1, ty: 2.4, hold: 0.4, kind: 'catch' }],
  ['one a step to his left, chest high', { tx: 0.45, ty: 1.2, hold: 0.4, kind: 'catch' }], ['one a step to his right, at his waist', { tx: -0.45, ty: 0.8, hold: 0.4, kind: 'catch' }],
  ['a hard one at his chest, parried', { tx: 0.15, ty: 1.2, hold: 0.8, kind: 'parry' }], ['a hard low one at him, parried', { tx: 0.15, ty: 0.25, hold: 0.9, kind: 'parry' }], ['a hard one over his head, tipped', { tx: 0.1, ty: 2.15, hold: 0.8, kind: 'parry' }]];

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
for (const [name, o] of STANDS) {
  test(`keeper: ${name}: his arms don't go through his body`, () => {
    const rows = play({ ...o, secs: 3.4 }), deep = rows.filter(r => r.arm > 0.03), worst = Math.max(...rows.map(r => r.arm));
    assert.ok(worst < 0.1, `an arm ${cm(worst)} cm inside his trunk`);
    assert.ok(deep.length <= 26, `${deep.length} frames with an arm over 3 cm inside (72 a second)`);
  });
}
// Dives (Nov 2026, branch keeper3): at no frame, from the first step to stood up again, is an arm's middle line more
// than 2 cm inside his trunk, his head or a leg (2.5 cm once he is on the grass); a caught ball never passes through
// his head on its way to his chest; and nothing jumps: no joint changes speed by more than a real limb can in a frame,
// he isn't moved when the save hands over to the stance (he was: 1.4 m in one frame), nor hopped to keep a boot out
// of the grass (he was: 15 cm at take-off).
const MORE = [['a dive at mid height, caught', { tx: 1.6, ty: 0.9, kind: 'catch' }], ['a low one close to him, caught going down', { tx: 1.3, ty: 0.2, kind: 'catch' }],
  ['a low dive at full stretch', { tx: 3.2, ty: 0.4, kind: 'parry', hold: 0.6 }], ['a high dive at full stretch', { tx: 3.1, ty: 1.6, kind: 'parry', hold: 0.6 }]];
for (const [name, o] of [...DIVES, ...MORE]) for (const seed of [0.13, 0.57, 0.91]) {
  test(`keeper: ${name} (keeper ${seed}): arms out of his body and head, the ball round his face, nothing jumps`, () => {
    const rows = play({ ...o, secs: 3.8, seed }), a = rows.findIndex(r => r.sv), b = rows.findLastIndex(r => r.sv);
    assert.ok(a > 0 && b > a && b < rows.length - 8, 'the dive begins and ends');
    let air = 0, down = 0, ball = 9, jump = 0, foot = 0, end = 0, who = '';
    for (let i = a; i <= b + 6; i++) {
      const r = rows[i], q = rows[i - 1], p = rows[i - 2];
      if (r.sv && !r.sv.ground) air = Math.max(air, r.arm); else down = Math.max(down, r.arm);
      if (r.held) ball = Math.min(ball, r.held.distanceTo(r.headC) - 0.115 - BALL_R);
      const dv = (x, y, z) => x.clone().sub(y).sub(y.clone().sub(z)).length() / DT;
      for (const [n, x, y, z] of [['hips', r.hips, q.hips, p.hips], ['head', r.head, q.head, p.head], ['hand', r.hands[0], q.hands[0], p.hands[0]], ['hand', r.hands[1], q.hands[1], p.hands[1]]]) { const d = dv(x, y, z); if (d > jump) { jump = d; who = n; } }
      for (const k of [0, 1]) foot = Math.max(foot, dv(r.feet[k], q.feet[k], p.feet[k]));
      if (i > b) end = Math.max(end, dv(r.hips, q.hips, p.hips));
    }
    assert.ok(air < 0.02, `${name}: an arm ${cm(air)} cm inside him on the way to the ball`);
    assert.ok(down < 0.025, `${name}: an arm ${cm(down)} cm inside him on the grass or getting up`);
    assert.ok(ball > -0.02, `${name}: the ball ${cm(-ball)} cm into his head`);
    assert.ok(jump < 12, `${name}: his ${who} changes speed by ${jump.toFixed(1)} m/s in a frame`);
    assert.ok(foot < 19, `${name}: a foot changes speed by ${foot.toFixed(1)} m/s in a frame`);
    assert.ok(end < 5, `${name}: his hips jump as the save ends (${end.toFixed(1)} m/s in a frame)`);
    if (seed === 0.13) REPORT.push(`${name.padEnd(36)} arm inside: ${cm(air)} cm diving, ${cm(down)} cm on the grass and up; ball to head ${ball > 8 ? '-' : cm(ball)} cm; biggest change of speed in a frame: ${who} ${jump.toFixed(1)} m/s, a foot ${foot.toFixed(1)}`);
  });
}

// Standing saves are one movement: from the pose he was in, no jumps in his body or his hands, wrists within their limit.
for (const [name, o] of STANDS) {
  test(`keeper: ${name}: one smooth movement`, () => {
    const rows = play({ ...o, secs: 3.4 }), a = rows.findIndex(r => r.sv);
    let hip = 0, palm = 0, wrist = 0;
    for (let i = a; i < rows.length; i++) {
      hip = Math.max(hip, rows[i].hips.distanceTo(rows[i - 1].hips) / DT);
      for (const k of [0, 1]) palm = Math.max(palm, rows[i].palms[k].distanceTo(rows[i - 1].palms[k]) / DT);
      wrist = Math.max(wrist, rows[i].wrist);
    }
    assert.ok(hip < 3, `his hips never move faster than 3 m/s (${hip.toFixed(1)})`);
    assert.ok(palm < 8, `a hand never moves faster than 8 m/s (${palm.toFixed(1)})`);
    assert.ok(wrist < 0.72, `a wrist bent ${(wrist * 57.3).toFixed(0)} degrees`);
    REPORT.push(`${name.padEnd(36)} smooth: hips ${hip.toFixed(1)} m/s at most, hands ${palm.toFixed(1)} m/s, wrists ${(wrist * 57.3).toFixed(0)} deg`);
  });
}

// The feet (game/keeperfeet.js). A planted foot doesn't move at all; the feet never cross and never come together;
// his hips stay level; nothing jerks; his arms stay where they were.
const MOVES = [['a quick shuffle across and back', { across: true, from: 14, fx: -9, secs: 5 }, 1.5], ['a long shuffle left, right, left', { from: 15, secs: 7, across: true, move: t => ({ x: t < 1.5 ? 1 : t < 4 ? -1 : t < 6 ? 1 : 0, z: 0 }) }, 1.5],
  ['small steps as the ball drifts across', { from: 17, fx: -3, secs: 6, move: t => ({ x: t < 3 ? 0.3 : -0.3, z: 0 }) }, 0.3], ['off his line and back', { from: 24, fx: -2, secs: 6, move: t => ({ x: 0.1, z: t < 3 ? -0.7 : 0.7 }) }, 0]];
for (const [name, o, far] of MOVES) {
  test(`keeper: ${name}: his feet`, () => {
    const rows = play(o).slice(20);
    let slid = 0, n = 0, gapMin = 9, gapMax = 0, acc = 0, steps = 0;
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i], q = rows[i - 1], c = Math.cos(r.yaw), sn = Math.sin(r.yaw);
      for (const k of [0, 1]) { if (r.down[k] && q.down[k]) { n++; slid = Math.max(slid, Math.hypot(r.sole[k].x - q.sole[k].x, r.sole[k].z - q.sole[k].z) / DT); } if (q.down[k] && !r.down[k]) steps++; }
      const gap = (r.feet[0].x - r.feet[1].x) * c - (r.feet[0].z - r.feet[1].z) * sn;           // his left foot's ankle to the left of his right one, across him
      gapMin = Math.min(gapMin, gap); gapMax = Math.max(gapMax, gap);
      acc = Math.max(acc, r.hips.clone().sub(q.hips).sub(q.hips.clone().sub(rows[i - 2].hips)).length() / DT / DT);
    }
    const ys = rows.map(r => r.hips.y), bob = Math.max(...ys) - Math.min(...ys), moved = Math.max(...rows.map(r => r.gkx)) - Math.min(...rows.map(r => r.gkx));
    assert.ok(moved >= far, `he moved ${moved.toFixed(1)} m across`);
    assert.ok(n > 100 && slid < 0.02, `a planted foot never slides (${cm(slid)} cm/s at most)`);
    assert.ok(gapMin > 0.24, `his feet never cross or come together (${cm(gapMin)} cm apart at the nearest)`);
    assert.ok(gapMax < 1.05, `nor too far apart (${cm(gapMax)} cm)`);
    assert.ok(bob < 0.075, `his hips stay level (${cm(bob)} cm between highest and lowest)`);
    assert.ok(acc < 40, `nothing jerks (his hips ${acc.toFixed(0)} m/s2 at most)`);
    assert.ok(Math.max(...rows.map(r => r.arm)) < 0.02 && Math.max(...rows.map(r => r.wrist)) < 0.4, 'his hands stay set: arms clear of his body, wrists straight');
    assert.ok(Math.min(...rows.map(r => r.low)) > -0.01, 'nothing under the grass');
    REPORT.push(`${name.padEnd(36)} ${moved.toFixed(1)} m across; planted foot ${cm(slid)} cm/s at most; ankles ${cm(gapMin)} to ${cm(gapMax)} cm apart; ${(steps / (rows.length * DT)).toFixed(1)} steps a second; hips ${cm(bob)} cm high to low, ${acc.toFixed(0)} m/s2 at most`);
  });
}

test('keeper: the split step: off the grass as the shot is wound up, down as the ball leaves the boot, sinking into it', () => {
  const rows = play({ tx: 3.4, ty: 2.2, hold: 1.0, from: 22, secs: 1.2 }), kick = rows.findIndex(r => r.ev.includes('kick')), wind = rows.findIndex(r => r.ev.includes('windup'));
  const up = rows.findIndex((r, i) => i >= wind && !r.down[0] && !r.down[1]), dn = rows.findIndex((r, i) => i > up && r.down[0] && r.down[1]);
  assert.ok(up >= wind && up <= wind + 1, 'both feet leave the grass as the shot is wound up');
  assert.ok(dn - kick >= -1 && dn - kick <= 5, `both feet are down ${dn - kick} frames after the ball is struck`);
  const h0 = rows[wind - 1].hips.y, top = Math.max(...rows.slice(wind, dn).map(r => r.hips.y)), low = Math.min(...rows.slice(dn, dn + 16).map(r => r.hips.y));
  assert.ok(top - h0 < 0.02, `a hop only just off the grass (hips up ${cm(top - h0)} cm)`);
  assert.ok(h0 - low > 0.03, `he sinks into the landing (${cm(h0 - low)} cm)`);
  const wide = f => Math.hypot(f[0].x - f[1].x, f[0].z - f[1].z);
  assert.ok(wide(rows[dn].feet) > wide(rows[wind - 1].feet) + 0.04, 'and lands wider');
  REPORT.push(`split step: feet off ${up - wind} frames after the wind-up begins, down ${dn - kick} frames (${((dn - kick) * DT * 1000).toFixed(0)} ms) after the ball is struck; hips up ${cm(top - h0)} cm, then down ${cm(h0 - low)} cm; stance ${cm(wide(rows[wind - 1].feet))} to ${cm(wide(rows[dn].feet))} cm`);
});
