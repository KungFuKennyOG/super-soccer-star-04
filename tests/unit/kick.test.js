// Recorded kicks (game/kickcap.js): the baked clips are what the player expects, the leg IK that corrects
// them does what it says, and through a whole shot, pass or volley the boots behave: the plant boot never in
// the ball, no sole under the grass, your own first-person hips centred and unturned.
// (tests/unit/boot.test.js has the boot on the ball on the strike frame.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { startStrike, struck } from '../../game/strike.js';
import { CLIPS, BONES } from '../../game/mocap.js';
import { isKick, sampleKick, nudgeLeg } from '../../game/kickcap.js';
import { ankleOf } from '../../game/legik.js';
import { createWorld, stepSim } from '../../rules/sim.js';
import { perfectTime } from '../../rules/pass.js';
import { BALL, GOAL } from '../../rules/tuning.js';

const fixed = () => 0.5, DT = 1 / 72, cm = x => (x * 100).toFixed(1);
const KICKS = Object.entries(CLIPS).filter(([, c]) => c.kind === 'kick');
const model = (firstPerson = false, foot = 'R') => { const { bones, by } = buildSkeleton(), root = new THREE.Group(); root.add(bones[0]); return { root, bone: by, shadow: new THREE.Object3D(), phase: 0, strike: null, firstPerson, foot }; };

test('the baked kicks: a shot and a pass, each placed from the kicking ankle at its contact', () => {
  assert.deepEqual(KICKS.map(([n]) => n).sort(), ['kickPass', 'kickPassB', 'kickShot', 'kickShotB']);
  for (const kind of ['shot', 'pass', 'volley']) assert.ok(isKick(kind), `${kind} is a recorded kick`);
  for (const kind of ['poke', 'scoop', 'rainbow']) assert.ok(!isKick(kind), `${kind} is not`);
  const P = { q: new Float32Array(BONES.length * 4), h: new Float32Array(3), a: new Float32Array(6) };
  for (const [name, c] of KICKS) {
    assert.equal(c.q.length, c.n * BONES.length * 4); assert.equal(c.h.length, c.n * 3); assert.equal(c.a.length, c.n * 6);
    assert.ok(c.c / c.hz >= c.top && c.top > 0.1 && c.top < 0.25, `${name}: the backswing's top (${c.top} s before) is inside the clip`);
    assert.ok((c.n - 1 - c.c) / c.hz > 0.25, `${name}: a quarter of a second or more of follow-through`);
    sampleKick(c, 0, P);
    assert.ok(Math.hypot(P.a[0], P.a[2]) < 1e-3 && P.a[1] > 0.1 && P.a[1] < 0.35, `${name}: the kicking ankle is the origin at contact, ${cm(P.a[1])} cm up`);
    assert.ok(P.a[3] > 0.15 && P.a[3] < 0.45 && P.a[4] < 0.15, `${name}: the plant foot is down, ${cm(P.a[3])} cm to its left`);
    sampleKick(c, -c.top, P);
    assert.ok(P.a[2] < -0.5 && P.a[1] > 0.4, `${name}: at the top of the backswing the boot is behind him and up (${P.a[2].toFixed(2)}, ${P.a[1].toFixed(2)})`);
    sampleKick(c, 0.1, P);
    assert.ok(P.a[2] > 0.3, `${name}: a tenth of a second on it has gone through (${P.a[2].toFixed(2)} m)`);
    sampleKick(c, 9, P); sampleKick(c, -9, P);        // past either end: the end poses, not garbage
    assert.ok(P.q.every(Number.isFinite));
  }
});

test('nudging a leg puts the ankle on its target and keeps the way the knee points', () => {
  const m = model(), bn = m.bone, a = new THREE.Vector3(), knee = new THREE.Vector3();
  const thigh = () => { m.root.updateMatrixWorld(true); return knee.setFromMatrixPosition(bn.lowerLegR.matrixWorld).sub(a.setFromMatrixPosition(bn.upperLegR.matrixWorld)).normalize().x; };
  const out = [];
  for (const wide of [-0.35, 0.35]) {                 // a thigh lifted and held out to his right, then one held in across him
    for (const t of [[-0.2, 0.3, 0.35], [-0.05, 0.3, 0.4], [-0.3, 0.5, -0.2], [-0.25, 0.3, 0.3]]) {
      bn.upperLegR.rotation.set(-0.6, 0.3, wide); bn.lowerLegR.rotation.set(0.9, 0, 0);
      const target = new THREE.Vector3(...t);
      nudgeLeg(bn, 'R', target);
      assert.ok(ankleOf(bn, 'R', a).distanceTo(target) < 1e-4, `ankle on ${t}`);
    }
    out.push(thigh());
  }
  assert.ok(out[0] < out[1] - 0.08, `the same ankle, and the knee is still further out for the leg that came from out wide (${out.map(v => v.toFixed(2))})`);
  nudgeLeg(bn, 'R', new THREE.Vector3(0, -3, 0));
  assert.ok(Number.isFinite(bn.upperLegR.quaternion.x + bn.lowerLegR.quaternion.x), 'a target out of reach is a straight leg toward it');
});

// the boot's surface as tests/unit/boot.test.js has it
const BOOT = [];
for (let i = 0; i <= 12; i++) for (let j = 0; j <= 4; j++) for (let k = 0; k <= 4; k++) {
  if (i % 12 && j % 4 && k % 4) continue;
  const f = i / 12, bx = (j / 4 - 0.5) * 0.104, by = (k / 4 - 0.5) * 0.1;
  BOOT.push([f > 0.6 ? bx * (1 - 0.35 * (f - 0.6) / 0.4) : bx, 0.05 - 0.085 + (f > 0.6 && by > 0 ? by - 0.045 * (f - 0.6) / 0.4 : by), 0.05 + (f - 0.5) * 0.3]);
}
const tmp = new THREE.Vector3();
const gap = (m, n, b) => { m.root.updateMatrixWorld(true); const p = m.bone['foot' + n].worldToLocal(tmp.set(b.x, b.y, b.z)); return Math.min(...BOOT.map(q => Math.hypot(q[0] - p.x, q[1] - p.y, q[2] - p.z))) - BALL.r; };
const sole = (m, n) => { m.root.updateMatrixWorld(true); return Math.min(...BOOT.map(q => m.bone['foot' + n].localToWorld(tmp.set(...q)).y)); };

// You sprint with the ball and let go of a shot or a pass at 1.2 s (the real sim). One row per frame of the strike.
function play({ firstPerson, foot = 'R', shot = null, pass = null }) {
  const w = createWorld(fixed), m = model(firstPerson, foot), rows = [], P = foot === 'L' ? 'R' : 'L';
  for (const id of ['d1', 'd2', 'd3']) { w.byId[id].x = 20; w.byId[id].z = -1; w.byId[id].stun = 99; }
  for (let t = 0; t < 2; t += DT) {
    const it = { move: { x: 0, z: -1 }, facing: { x: 0, z: -1 }, sprint: true };
    if (Math.abs(t - 1.2) < DT / 2) {
      const eye = { x: w.you.x, y: 1.7, z: w.you.z };
      if (shot) { const d = new THREE.Vector3(shot.x - eye.x, shot.y - eye.y, GOAL.z - eye.z).normalize(); it.shot = { eye, dir: { x: d.x, y: d.y, z: d.z }, holdT: shot.hold }; }
      if (pass) it.pass = { holdT: perfectTime(), targetId: pass };
    }
    const ev = stepSim(w, it, DT, fixed), you = w.you, b = w.ball, hit = ev.some(e => (e.type === 'kick' || e.type === 'pass') && e.by === 'you');
    for (const e of ev) if (e.type === 'windup') startStrike(m, { kind: e.kind, wind: e.t, dir: e.dir, power: e.power });
    if (hit) { const l = Math.hypot(b.vx, b.vz); struck(m, ev.some(e => e.type === 'pass') ? 'pass' : 'shot', { x: b.vx / l, z: b.vz / l }, 0.8); }
    placeModel(m, you); m.root.rotation.y = Math.atan2(you.vx, you.vz);
    animate(m, you, DT, t, false, null, b, w.owner === 'you' && !w.dead);
    if (m.strike) rows.push({ hit, kick: gap(m, foot, b), plant: gap(m, P, b), soles: Math.min(sole(m, 'L'), sole(m, 'R')), hx: m.bone.hips.position.x, turned: 2 * Math.acos(Math.min(1, Math.abs(m.bone.hips.quaternion.w))) });
  }
  return rows;
}
const STRIKES = [['a low shot', { shot: { x: 3, y: 0.5, hold: 0.8 } }], ['a shot across goal', { shot: { x: -3.2, y: 2, hold: 0.9 } }], ['a chip', { shot: { x: 0, y: 1.5, hold: 0.1 } }], ['a pass left', { pass: 'm1' }], ['a pass right', { pass: 'm2' }]];

for (const [who, o] of [['your own boots', { firstPerson: true }], ['a whole body', { firstPerson: false }], ['a left-footed player', { firstPerson: false, foot: 'L' }]]) {
  test(`${who}: through a recorded kick the plant boot stays out of the ball and the soles out of the grass`, () => {
    for (const [name, s] of STRIKES) {
      const rows = play({ ...o, ...s }), k = rows.findIndex(r => r.hit);
      assert.ok(k > 1 && rows.length > k + 10, `${name}: wound up, struck, followed through (${rows.length} frames)`);
      assert.ok(Math.abs(rows[k].kick) < 0.02, `${name}: boot ${cm(rows[k].kick)} cm from the ball when it's struck`);
      assert.ok(Math.min(...rows.map(r => r.plant)) > 0.02, `${name}: the plant boot is never nearer the ball than ${cm(Math.min(...rows.map(r => r.plant)))} cm`);
      assert.ok(Math.min(...rows.map(r => r.kick)) > -0.005, `${name}: the kicking boot never goes into it (${cm(Math.min(...rows.map(r => r.kick)))} cm)`);
      assert.ok(Math.min(...rows.map(r => r.soles)) > -0.025, `${name}: lowest sole ${cm(Math.min(...rows.map(r => r.soles)))} cm`);
      if (o.firstPerson) assert.ok(rows.every(r => Math.abs(r.hx) < 1e-6 && r.turned < 1e-6), `${name}: your hips stay centred and unturned`);
      else assert.ok(Math.max(...rows.map(r => Math.abs(r.hx))) > 0.1, `${name}: his hips go over toward the plant foot (${cm(Math.max(...rows.map(r => Math.abs(r.hx))))} cm)`);
    }
  });
}

test('a volley: the boot is on a ball in the air the frame it is struck, with no wind-up', () => {
  for (const firstPerson of [true, false]) for (const y of [0.3, 0.6, 0.9]) {
    const m = model(firstPerson), p = { x: 0, z: 0, fx: 0, fz: 1, vx: 0, vz: 3, role: 'mate', stride: 0 }, b = { x: 0.05, y, z: 0 };
    let at = 9;
    for (let i = 0; i < 60; i++) {
      p.z = i * DT * 3; p.stride += DT * 8; b.z = p.z + 0.6;
      if (i === 40) struck(m, 'volley', { x: 0, z: 1 }, 0.8);
      placeModel(m, p); animate(m, p, DT, i * DT, false, null, b, false);
      if (i === 40) at = gap(m, 'R', b);
    }
    assert.ok(Math.abs(at) < 0.03, `${firstPerson ? 'your boots' : 'a whole body'}, ball ${y} m up: boot ${cm(at)} cm from it`);
  }
});

test('shots and passes are not all one take: which recorded kick a strike is goes by its power and its own dice', async () => {
  const { kickOf, strikeDice } = await import('../../game/kickcap.js');
  const take = s => kickOf(s).clips[0], n = { shot: new Map(), pass: new Map(), hard: new Map(), soft: new Map() };
  for (let i = 0; i < 400; i++) {
    const a = i * 0.37, dir = { x: Math.sin(a), z: -Math.cos(a) }, pw = 0.3 + 0.7 * ((i * 0.618) % 1);
    for (const [k, s] of [['shot', { kind: 'shot', power: pw, dir }], ['pass', { kind: 'pass', power: 0.5, dir }], ['hard', { kind: 'shot', power: 0.95, dir }], ['soft', { kind: 'shot', power: 0.32, dir }]]) n[k].set(take(s), (n[k].get(take(s)) || 0) + 1);
    const s = { kind: 'shot', power: pw, dir };
    assert.equal(take(s), take({ ...s }), 'the same strike is the same take (a replay shows the kick that was played)');
    assert.ok(strikeDice(s) >= 0 && strikeDice(s) < 1);
  }
  assert.equal(n.shot.size, 2); assert.equal(n.pass.size, 2);
  assert.ok(Math.min(...n.shot.values()) > 80 && Math.min(...n.pass.values()) > 120, `both takes turn up: shots ${[...n.shot.values()]}, passes ${[...n.pass.values()]}`);
  assert.equal(n.hard.size, 1, 'a shot at full power is always the driven one (11_01)');
  assert.equal(n.soft.size, 1, 'a soft placed shot is always the side-foot one (10_06)');
  assert.equal(take({ kind: 'shot', power: 0.1, dir: { x: 0, z: -1 } }), take({ kind: 'shot', power: 0.95, dir: { x: 0, z: -1 } }), 'a chip is built on the driven take');
});
