// Charging a shot and letting go (game/windup.js, game/inertia.js, game/kickcap.js): the real sim drives the real
// poses on a bare skeleton. Held for 0.1, 0.4 and 1.2 s, standing, at a walk, a jog and a sprint, let go on
// different parts of the stride: the boot is on the ball on the strike frame, and nothing jumps on the way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { startStrike, struck } from '../../game/strike.js';
import { inertialize, settle, remember } from '../../game/inertia.js';
import { createWorld, stepSim } from '../../rules/sim.js';
import { BALL, GOAL } from '../../rules/tuning.js';

const fixed = () => 0.5, DT = 1 / 72, cm = x => (x * 100).toFixed(1), MOVE = { stand: 0, walk: 0.28, jog: 0.62, sprint: 1 };
const BOOT = [];
for (let i = 0; i <= 12; i++) for (let j = 0; j <= 4; j++) for (let k = 0; k <= 4; k++) {
  if (i % 12 && j % 4 && k % 4) continue;
  const f = i / 12, bx = (j / 4 - 0.5) * 0.104, by = (k / 4 - 0.5) * 0.1;
  BOOT.push([f > 0.6 ? bx * (1 - 0.35 * (f - 0.6) / 0.4) : bx, 0.05 - 0.085 + (f > 0.6 && by > 0 ? by - 0.045 * (f - 0.6) / 0.4 : by), 0.05 + (f - 0.5) * 0.3]);
}
const tmp = new THREE.Vector3();
const gap = (m, n, b) => { m.root.updateMatrixWorld(true); const p = m.bone['foot' + n].worldToLocal(tmp.set(b.x, b.y, b.z)); return Math.min(...BOOT.map(q => Math.hypot(q[0] - p.x, q[1] - p.y, q[2] - p.z))) - BALL.r; };
const model = firstPerson => { const { bones, by } = buildSkeleton(), root = new THREE.Group(); root.add(bones[0]); return { root, bone: by, shadow: new THREE.Object3D(), phase: 0, strike: null, firstPerson }; };
const JOINTS = ['hips', 'footL', 'footR', 'handL', 'handR', 'head'];

// You run with the ball, hold the trigger from `at` for `hold` seconds and let go (cancel: nothing is struck).
// charge: whether the page is told of the hold (game/main.js sets m.charge). One row per frame.
function play({ firstPerson = false, speed = 'jog', at = 1, hold = 0.4, cancel = false, charge = true, secs = at + hold + 0.9 }) {
  const w = createWorld(fixed), m = model(firstPerson), rows = [];
  for (const id of ['d1', 'd2', 'd3']) { w.byId[id].x = 20; w.byId[id].z = -1; w.byId[id].stun = 99; }
  let held = 0;
  for (let t = 0; t < secs; t += DT) {
    const it = { move: { x: 0, z: -MOVE[speed] }, facing: { x: 0, z: -1 }, sprint: speed === 'sprint' };
    const down = t >= at - DT / 2 && t < at + hold - DT / 2;
    held = down ? held + DT : 0;
    if (down) it.charging = true;
    if (Math.abs(t - (at + hold)) < DT / 2 && !cancel) { const eye = { x: w.you.x, y: 1.7, z: w.you.z }, d = new THREE.Vector3(2 - eye.x, 0.8 - eye.y, GOAL.z - eye.z).normalize(); it.shot = { eye, dir: { x: d.x, y: d.y, z: d.z }, holdT: hold }; }
    m.charge = down && charge ? { kind: 'shot', t: held } : null;
    const ev = stepSim(w, it, DT, fixed), you = w.you, b = w.ball, hit = ev.find(e => e.type === 'kick' && e.by === 'you');
    for (const e of ev) if (e.type === 'windup') startStrike(m, { kind: e.kind, wind: e.t, dir: e.dir, power: e.power });
    if (hit) { const l = Math.hypot(b.vx, b.vz); struck(m, 'shot', { x: b.vx / l, z: b.vz / l }, hit.power ?? 0.8); }
    placeModel(m, you);
    if (Math.hypot(you.vx, you.vz) > 0.5) m.root.rotation.y = Math.atan2(you.vx, you.vz);
    animate(m, you, DT, t, false, null, b, w.owner === 'you' && !w.dead);
    m.root.updateMatrixWorld(true);
    const J = {};
    for (const n of JOINTS) { J[n] = m.root.worldToLocal(m.bone[n].getWorldPosition(new THREE.Vector3())); assert.ok(Number.isFinite(J[n].x + J[n].y + J[n].z), `${n} is finite`); }
    rows.push({ t, hit: !!hit, wind: ev.some(e => e.type === 'windup'), touch: ev.some(e => e.type === 'dribble'), down, right: gap(m, 'R', b), J, k: m.chargeK || 0, hx: m.bone.hips.position.x, turned: 2 * Math.acos(Math.min(1, Math.abs(m.bone.hips.quaternion.w))) });
  }
  return rows;
}
// the most any of `names` jumps between frames a..b: |x[i+1] - 2 x[i] + x[i-1]| (m)
const jump = (rows, a, b, names) => { let w = 0; for (let i = Math.max(1, a); i < Math.min(rows.length - 1, b); i++) for (const n of names) w = Math.max(w, rows[i + 1].J[n].clone().sub(rows[i].J[n]).sub(rows[i].J[n].clone().sub(rows[i - 1].J[n])).length()); return w; };

for (const firstPerson of [true, false]) {
  const who = firstPerson ? 'your own boots' : 'a whole body';
  test(`${who}: let go after 0.1, 0.4 and 1.2 s of charge, standing to sprinting: boot on the ball, no jump on the way`, () => {
    let worst = 0, after = 0;
    for (const speed of ['stand', 'walk', 'jog', 'sprint']) for (const hold of [0.1, 0.4, 1.2]) for (let j = 0; j < 4; j++) {
      const rows = play({ firstPerson, speed, hold, at: 1 + j * 0.13 }), w0 = rows.findIndex(r => r.wind), k = rows.findIndex(r => r.hit), name = `${speed}, held ${hold} s, let go at ${(1 + j * 0.13 + hold).toFixed(2)}`;
      assert.ok(w0 > 0 && k === w0 + 6, `${name}: struck six frames after it is let go`);
      assert.ok(Math.abs(rows[k].right) < 0.02, `${name}: boot ${cm(rows[k].right)} cm from the ball on the strike frame`);
      assert.ok(Math.min(rows[k + 1].right, rows[k + 2].right) > -0.005 && rows[k + 6].right > 0.15, `${name}: the boot goes through after the ball, not into it, and the ball leaves it (${cm(rows[k + 2].right)}, ${cm(rows[k + 6].right)} cm)`);
      const a = jump(rows, w0 - 1, k + 1, ['footL', 'footR', 'hips']), c = jump(rows, k + 1, k + 36, ['footL', 'footR', 'hips']);
      worst = Math.max(worst, a); after = Math.max(after, c);
      assert.ok(a < 0.3, `${name}: nothing jumps in the wind-up (${cm(a)} cm; it was up to 90 before the release was carried in)`);
      assert.ok(c < 0.3, `${name}: nor in the half second after the strike (${cm(c)} cm)`);
      if (firstPerson) assert.ok(rows.every(r => Math.abs(r.hx) < 1e-6 && r.turned < 1e-6), `${name}: your hips stay centred and unturned`);
    }
    assert.ok(worst > 0.01, `measured (${cm(worst)} cm in the wind-up, ${cm(after)} cm after)`);
  });

  test(`${who}: while the shot charges, every dribbling touch is still the boot on the ball`, () => {
    for (const speed of ['jog', 'sprint']) {
      const t = play({ firstPerson, speed, hold: 1.2 }).filter(r => r.touch && r.down);
      assert.ok(t.length >= 1, `${speed}: touched while charging`);
      for (const r of t) assert.ok(Math.abs(r.right) < 0.03, `${speed}: boot ${cm(r.right)} cm from the ball on a touch`);
    }
  });
}

test('charging shapes him to strike it, in proportion, and letting the charge go undoes it', () => {
  const with_ = play({ speed: 'jog', hold: 1.2 }), without = play({ speed: 'jog', hold: 1.2, charge: false }), w0 = with_.findIndex(r => r.wind);
  const early = with_.findIndex(r => r.down) + 8, late = w0 - 2, d = (i, n) => with_[i].J[n].distanceTo(without[i].J[n]);
  assert.ok(with_[early].k > 0.15 && with_[late].k > 0.9 && with_[late].k > with_[early].k + 0.3, `more of it the longer it is held (${with_[early].k.toFixed(2)} → ${with_[late].k.toFixed(2)})`);
  assert.ok(d(late, 'handL') > 0.15, `the arm opposite the kicking leg is out (${cm(d(late, 'handL'))} cm from where the run has it)`);
  assert.ok(d(late, 'footL') < 0.12, `his standing leg keeps its run (${cm(d(late, 'footL'))} cm)`);
  assert.ok(jump(with_, early - 10, late, JOINTS) < 0.12, `shaping up is smooth (${cm(jump(with_, early - 10, late, JOINTS))} cm)`);
  const fp = play({ firstPerson: true, speed: 'jog', hold: 1.2 }), fp0 = play({ firstPerson: true, speed: 'jog', hold: 1.2, charge: false });
  assert.ok(fp[late].J.footR.distanceTo(fp0[late].J.footR) < 1e-6, 'your own boots run on as they were while it charges');
  const off = play({ speed: 'jog', hold: 0.8, cancel: true, secs: 2.8 }), none = play({ speed: 'jog', hold: 0.8, cancel: true, charge: false, secs: 2.8 });
  assert.ok(!off.some(r => r.hit) && off[off.length - 1].k < 0.01, 'let go of without a strike: it fades');
  assert.ok(off[off.length - 1].J.handL.distanceTo(none[none.length - 1].J.handL) < 0.02, 'and he is back on his run');
});

test('a strike seen coming (a replay): the whole recorded approach, heel up behind him, boot on the ball', () => {
  const m = model(false), p = { x: 0, z: 0, fx: 0, fz: 1, vx: 0, vz: 4, role: 'mate', stride: 0 }, b = { x: 0, y: BALL.r, z: 0 };
  let top = 0, on = 9, plant = 9;
  for (let i = 0; i < 110; i++) {
    p.z = i * DT * 4; p.stride += DT * 8.2; b.z = p.z + 0.55; b.x = 0;
    if (i === 48) startStrike(m, { kind: 'shot', wind: 0.3, dir: { x: 0, z: 1 }, power: 0.9 });
    if (i === 48 + Math.round(0.3 / DT)) { struck(m, 'shot', { x: 0, z: 1 }, 0.9); placeModel(m, p); animate(m, p, DT, i * DT, false, null, b, true); on = gap(m, 'R', b); plant = gap(m, 'L', b); continue; }
    placeModel(m, p); animate(m, p, DT, i * DT, false, null, b, i < 70);
    if (m.strike && !m.strike.hit) top = Math.max(top, m.root.worldToLocal(m.bone.footR.getWorldPosition(new THREE.Vector3())).y);
  }
  assert.ok(top > 0.45, `the kicking ankle comes up to ${top.toFixed(2)} m in the backswing`);
  assert.ok(Math.abs(on) < 0.02, `boot ${cm(on)} cm from the ball when it is struck`);
  assert.ok(plant > 0.02, `the plant boot stands clear of it (${cm(plant)} cm)`);
});

test('carrying one movement into another: no jump at the change, and nothing left of it at the end', () => {
  const m = model(false), bn = m.bone, pose = (i, late) => { for (const n of Object.keys(bn)) if (n !== 'root') bn[n].quaternion.identity(); bn.hips.position.set(0, 0.93, 0); bn.upperArmL.rotation.set(late ? -1.2 : 0.02 * i, 0, 0.3); bn.upperLegR.rotation.set(late ? -0.8 : 0.01 * i, 0, 0); };
  const hand = () => { m.root.updateMatrixWorld(true); return bn.handL.getWorldPosition(new THREE.Vector3()); };
  const at = [];
  for (let i = 0; i < 40; i++) { const late = i >= 20; if (i === 20) inertialize(m, 0.2); pose(i, late); settle(m, bn, DT); remember(m, bn, DT); at.push(hand()); }
  const step = i => at[i].distanceTo(at[i - 1]);
  assert.ok(step(20) < step(19) * 1.5 + 1e-4 && step(21) < step(19) * 3 + 0.01, `the hand carries on at the change (${cm(step(19))}, ${cm(step(20))}, ${cm(step(21))} cm a frame)`);
  pose(39, true); m.root.updateMatrixWorld(true);
  assert.ok(at[39].distanceTo(bn.handL.getWorldPosition(new THREE.Vector3())) < 1e-6, 'and after the time given he is exactly on the new pose');
});
