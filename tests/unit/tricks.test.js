// Skill moves and tricks as whole-body moves (game/tricks.js): the real sim drives the real poses on a bare
// skeleton, as in boot.test.js, and what the rest of the body does round the boot on the ball is measured:
// the other foot's part in the move, feet on the grass and out of the ball, the hips.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { startStrike, struck } from '../../game/strike.js';
import { createWorld, stepSim } from '../../rules/sim.js';
import { BALL } from '../../rules/tuning.js';

const fixed = () => 0.5, DT = 1 / 72, tmp = new THREE.Vector3();
// the boot's surface in the foot bone's space (the box in game/body.js boot())
const BOOT = [];
for (let i = 0; i <= 12; i++) for (let j = 0; j <= 4; j++) for (let k = 0; k <= 4; k++) {
  if (i % 12 && j % 4 && k % 4) continue;
  const f = i / 12, bx = (j / 4 - 0.5) * 0.104, by = (k / 4 - 0.5) * 0.1;
  BOOT.push([f > 0.6 ? bx * (1 - 0.35 * (f - 0.6) / 0.4) : bx, 0.05 - 0.085 + (f > 0.6 && by > 0 ? by - 0.045 * (f - 0.6) / 0.4 : by), 0.05 + (f - 0.5) * 0.3]);
}
const gap = (m, n, b) => { const p = m.bone['foot' + n].worldToLocal(tmp.set(b.x, b.y, b.z)); return Math.min(...BOOT.map(q => Math.hypot(q[0] - p.x, q[1] - p.y, q[2] - p.z))) - BALL.r; };
const lowest = (m, n) => Math.min(...BOOT.map(q => m.bone['foot' + n].localToWorld(tmp.set(q[0], q[1], q[2])).y));

const ACTS = { knock: { knock: true }, flick: { knock: true }, drag: { drag: true }, nutmeg: { skill: { move: 'nutmeg', side: 1 } }, rainbow: { skill: { move: 'rainbow', side: 1 } },
  roulette: { skill: { move: 'roulette', side: 1 } }, stepover: { skill: { move: 'stepover', side: 1 } }, stepoverLeft: { skill: { move: 'stepover', side: -1 } } };
// You run with the ball (or stand: the flick-up) and do the move at 1.2 s. One row per frame from then on, t from the move.
function play(name, firstPerson) {
  const w = createWorld(fixed);
  for (const id of ['d1', 'd2', 'd3']) { w.byId[id].x = 20; w.byId[id].z = -1; w.byId[id].stun = 99; }
  const { bones, by } = buildSkeleton(), root = new THREE.Group();
  root.add(bones[0]);
  const m = { root, bone: by, shadow: new THREE.Object3D(), phase: 0, strike: null, firstPerson }, rows = [], unit = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };
  const was = { L: new THREE.Vector3(), R: new THREE.Vector3() }, at = new THREE.Vector3();
  let t0 = null;
  for (let t = 0; t < 2; t += DT) {
    const it = { move: { x: 0, z: name === 'flick' ? 0 : -1 }, facing: { x: 0, z: -1 }, sprint: false, ...(Math.abs(t - 1.2) < DT / 2 ? ACTS[name] : {}) };
    const ev = stepSim(w, it, DT, fixed), you = w.you, b = w.ball;
    for (const e of ev) {
      if (e.type === 'windup') startStrike(m, { kind: e.kind, wind: e.t, dir: e.dir, power: e.power });
      if (e.type === 'launched') struck(m, e.kind, unit(you.fx, you.fz), 0.5);
      if (e.type === 'knock' || e.type === 'flick' || (e.type === 'skill' && e.move === 'nutmeg')) struck(m, e.type === 'flick' ? 'scoop' : 'poke', Math.hypot(b.vx, b.vz) > 0.5 ? unit(b.vx, b.vz) : unit(you.fx, you.fz), 0.4);
      if (e.type === 'drag') m.special = { kind: 'drag', t: 0 };
      if (e.type === 'skill') m.special = { kind: e.move, t: 0, side: 1 };
      if (['knock', 'flick', 'drag', 'skill'].includes(e.type) && t0 === null) t0 = t;
    }
    placeModel(m, you);
    if (Math.hypot(you.vx, you.vz) > 0.5) m.root.rotation.y = Math.atan2(you.vx, you.vz);
    animate(m, you, DT, t, false, null, b, w.owner === 'you' && !w.dead);
    m.root.updateMatrixWorld(true);
    for (const bone of Object.values(by)) assert.ok(Number.isFinite(bone.quaternion.x + bone.quaternion.w + bone.position.y), `${name}: ${bone.name} is finite`);
    const row = { t: t0 === null ? -1 : t - t0, launched: ev.some(e => e.type === 'launched'), hipY: by.hips.getWorldPosition(at).y, dir: m.special && m.special.dir };
    for (const n of 'LR') { row[n] = gap(m, n, b); row['low' + n] = lowest(m, n); by['foot' + n].getWorldPosition(at); row['v' + n] = Math.hypot(at.x - was[n].x, at.z - was[n].z) / DT; was[n].copy(at); }   // v: over the ground
    if (t0 !== null) rows.push(row); else rows.before = row;
  }
  return rows;
}
const cm = x => (x * 100).toFixed(1), during = (rows, a, b) => rows.filter(r => r.t >= a - 1e-6 && r.t <= b + 1e-6);

for (const firstPerson of [true, false]) {
  const who = firstPerson ? 'your own boots' : 'a whole body';

  test(`${who}: in every trick the boots stay on the grass and out of the ball`, () => {
    for (const name of Object.keys(ACTS)) {
      const rows = during(play(name, firstPerson), 0, 0.45);
      assert.ok(rows.length > 25, `${name} happened`);
      const low = Math.min(...rows.map(r => Math.min(r.lowL, r.lowR))), deep = Math.min(...rows.map(r => Math.min(r.L, r.R)));
      assert.ok(low > -0.065, `${name}: no boot under the grass (${cm(low)} cm)`);
      assert.ok(deep > -0.065, `${name}: no boot deep in the ball (${cm(deep)} cm)`);
    }
  });

  test(`${who}: the roulette gives the ball from the right sole to the left`, () => {
    const rows = play('roulette', firstPerson);
    const right = during(rows, 0.06, 0.17), left = during(rows, 0.24, 0.33);
    assert.ok(Math.max(...right.map(r => Math.abs(r.R))) < 0.03, `right studs on it first (worst ${cm(Math.max(...right.map(r => Math.abs(r.R))))} cm)`);
    assert.ok(Math.max(...left.map(r => Math.abs(r.L))) < 0.03, `then the left (worst ${cm(Math.max(...left.map(r => Math.abs(r.L))))} cm)`);
    assert.ok(Math.min(...left.map(r => r.R)) > 0.02, 'and the right boot is off it by then');
    assert.ok(Math.max(...during(rows, 0.25, 0.3).map(r => r.vR)) < 0.5, 'standing on the right foot, which is still on the pitch');
  });

  test(`${who}: the rainbow is swept up by the left boot and flicked by the right heel, above the grass`, () => {
    const rows = play('rainbow', firstPerson), k = rows.findIndex(r => r.launched);
    assert.ok(k > 5, 'it takes a moment');
    const roll = rows.slice(3, k + 1);
    assert.ok(Math.max(...roll.map(r => Math.abs(r.L))) < 0.02, `the left boot is on the ball all the way up (worst ${cm(Math.max(...roll.map(r => Math.abs(r.L))))} cm)`);
    assert.ok(Math.abs(rows[k].R) < 0.04 && rows[k].lowR > -0.02, `the heel is on it as it goes, toes clear of the grass (${cm(rows[k].lowR)} cm)`);
    const land = during(rows, rows[k].t + 0.09, rows[k].t + 0.13);
    assert.ok(Math.max(...land.map(r => r.lowL)) < 0.02 && Math.max(...land.map(r => r.vL)) < 0.5, 'then the left foot lands and holds');
  });

  test(`${who}: a drag-back is done off a planted standing foot`, () => {
    const hold = during(play('drag', firstPerson), 0.07, 0.17);
    assert.ok(Math.max(...hold.map(r => r.vL)) < 0.3 && Math.max(...hold.map(r => r.lowL)) < 0.01, `the left foot is down and still (${Math.max(...hold.map(r => r.vL)).toFixed(2)} m/s)`);
    assert.ok(Math.min(...hold.map(r => r.L)) > 0.03, 'clear of the ball');
  });

  test(`${who}: a knock-on is played in stride and the step-over goes the way of the fake`, () => {
    const rows = play('knock', firstPerson);
    assert.ok(Math.abs(rows[0].R) < 0.03, `boot ${cm(rows[0].R)} cm from the ball as it goes`);
    assert.ok(rows[0].hipY > rows.before.hipY - 0.02, `the hips don't drop for it (${cm(rows[0].hipY - rows.before.hipY)} cm)`);
    const down = during(rows, 0.13, 0.19);
    assert.ok(Math.min(...down.map(r => r.lowR)) < 0.01, 'and the boot comes down as the next step');
    assert.equal(play('stepover', firstPerson)[6].dir, 1, 'a fake to the right');
    assert.equal(play('stepoverLeft', firstPerson)[6].dir, -1, 'a fake to the left');
  });
}
