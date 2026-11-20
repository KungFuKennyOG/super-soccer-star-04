// Running with the ball (game/dribblecap.js): the real sim drives the real poses on a bare skeleton, from a
// walk to a sprint. Every touch is the working boot on the ball, the boots miss it in between, the legs take
// short quick steps when slow, and a planted foot stays where it was put.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { createWorld, stepSim } from '../../rules/sim.js';
import { BALL } from '../../rules/tuning.js';

const fixed = () => 0.5, DT = 1 / 72, TAU = Math.PI * 2, cm = x => (x * 100).toFixed(1);
// the boot's surface (the box in game/body.js boot(), lower and narrower toward the toe), in the foot bone's space
const BOOT = [];
for (let i = 0; i <= 12; i++) for (let j = 0; j <= 4; j++) for (let k = 0; k <= 4; k++) {
  if (i % 12 && j % 4 && k % 4) continue;
  const f = i / 12, bx = (j / 4 - 0.5) * 0.104, by = (k / 4 - 0.5) * 0.1;
  BOOT.push([f > 0.6 ? bx * (1 - 0.35 * (f - 0.6) / 0.4) : bx, 0.05 - 0.085 + (f > 0.6 && by > 0 ? by - 0.045 * (f - 0.6) / 0.4 : by), 0.05 + (f - 0.5) * 0.3]);
}
const tmp = new THREE.Vector3();
// metres between a boot and the ball's surface (negative: the boot is inside the ball)
function gap(m, n, ball) {
  const p = m.bone['foot' + n].worldToLocal(tmp.set(ball.x, ball.y, ball.z));
  return Math.min(...BOOT.map(q => Math.hypot(q[0] - p.x, q[1] - p.y, q[2] - p.z))) - BALL.r;
}

// You bring the ball up the pitch. pace: how far the stick is pushed at time t (0..1, or 2 to sprint).
// Returns one row per frame.
function dribble({ firstPerson = false, foot = 'R', pace, secs = 5, curve = 0 }) {
  const w = createWorld(fixed);
  for (const id of ['d1', 'd2', 'd3']) { w.byId[id].x = 20; w.byId[id].z = -1; w.byId[id].stun = 99; }
  w.you.x = w.ball.x = -12; w.you.z = 32; w.ball.z = 31.4;
  const { bones, by } = buildSkeleton(), root = new THREE.Group();
  root.add(bones[0]);
  const m = { root, bone: by, shadow: new THREE.Object3D(), phase: 0, strike: null, firstPerson, foot }, rows = [], was = { L: new THREE.Vector3(), R: new THREE.Vector3() };
  for (let t = 0; t < secs; t += DT) {
    const ml = typeof pace === 'function' ? pace(t) : pace, a = t * curve;
    const ev = stepSim(w, { move: { x: Math.sin(a) * Math.min(1, ml), z: -Math.cos(a) * Math.min(1, ml) }, facing: { x: 0, z: -1 }, sprint: ml > 1 }, DT, fixed), you = w.you, b = w.ball;
    placeModel(m, you);
    if (Math.hypot(you.vx, you.vz) > 0.5) m.root.rotation.y = Math.atan2(you.vx, you.vz);
    animate(m, you, DT, t, false, null, b, w.owner === 'you' && !w.dead);
    m.root.updateMatrixWorld(true);
    for (const bone of Object.values(by)) assert.ok(Number.isFinite(bone.quaternion.x + bone.quaternion.w + bone.position.y), `${bone.name} is finite`);
    const r = { t, v: Math.hypot(you.vx, you.vz), touch: ev.some(e => e.type === 'dribble'), right: gap(m, 'R', b), left: gap(m, 'L', b), ph: m.gait.ph, own: w.owner === 'you' };
    for (const n of 'LR') {           // the ball of each foot: is it pinned to the pitch (game/mocap.js), and how fast is it moving over the grass
      by['foot' + n].localToWorld(tmp.set(0, -0.085, 0.1));
      r['pin' + n] = !!(m.lock && m.lock[n].on); r['slip' + n] = Math.hypot(tmp.x - was[n].x, tmp.z - was[n].z) / DT; r['y' + n] = tmp.y; was[n].copy(tmp);
    }
    rows.push(r);
  }
  return rows;
}
const PACES = [['a walk', 0.3], ['a slow jog', 0.45], ['a run', 1], ['a sprint', 2]];

for (const firstPerson of [true, false]) {
  const who = firstPerson ? 'your own boots' : 'a whole body';
  test(`${who}: from a walk to a sprint every touch is the right boot on the ball, and the boots miss it in between`, () => {
    for (const [name, pace] of PACES) {
      const rows = dribble({ firstPerson, pace }).filter(r => r.t > 0.8), touches = rows.filter(r => r.touch);
      assert.ok(rows.every(r => r.own), `${name}: the ball stays his`);
      assert.ok(touches.length >= 3, `${name} (${rows[0].v.toFixed(1)} m/s): ${touches.length} touches`);
      for (const r of touches) assert.ok(Math.abs(r.right) < 0.03, `${name}: boot ${cm(r.right)} cm from the ball on a touch`);
      assert.ok(Math.min(...rows.map(r => r.right)) > -0.02, `${name}: right boot never in the ball (${cm(Math.min(...rows.map(r => r.right)))} cm)`);
      assert.ok(Math.min(...rows.map(r => r.left)) > 0.02, `${name}: left boot runs clear of it (${cm(Math.min(...rows.map(r => r.left)))} cm)`);
      // a touch is a boot arriving and leaving, not one parked on the ball
      const far = Math.round(0.2 / DT), k = rows.findIndex((r, i) => r.touch && i >= far);
      assert.ok(rows[k - far].right > 0.08 && rows[k + far].right > 0.08, `${name}: the boot comes to the ball and leaves it (${cm(rows[k - far].right)} cm before, ${cm(rows[k + far].right)} after)`);
    }
  });

  test(`${who}: slow on the ball the legs take short quick steps, two turns to a touch; at pace one`, () => {
    for (const [name, pace, turns] of [['a walk', 0.3, 2], ['a slow jog', 0.45, 2], ['a run', 1, 1], ['a sprint', 2, 1]]) {
      const rows = dribble({ firstPerson, pace }).filter(r => r.t > 0.8), at = rows.filter(r => r.touch);
      const per = (at[at.length - 1].ph - at[0].ph) / TAU / (at.length - 1);
      assert.ok(Math.abs(per - turns) < 0.05, `${name}: ${per.toFixed(2)} turns of the legs per touch`);
    }
  });

  test(`${who}: through changes of pace and a curve the touches stay on the ball`, () => {
    const pace = t => (t < 2 ? 0.3 : t < 3.5 ? 0.6 : t < 5 ? 2 : t < 6.5 ? 0.45 : t < 8 ? 1 : 0.3);
    const rows = dribble({ firstPerson, pace, secs: 9.5, curve: 0.3 }).filter(r => r.t > 0.8), touches = rows.filter(r => r.touch);
    assert.ok(rows.every(r => r.own) && touches.length >= 10, `${touches.length} touches`);
    assert.ok(Math.max(...touches.map(r => Math.abs(r.right))) < 0.03, `worst touch ${cm(Math.max(...touches.map(r => Math.abs(r.right))))} cm`);
    assert.ok(Math.min(...rows.map(r => r.right)) > -0.02 && Math.min(...rows.map(r => r.left)) > 0.01, `boots stay out of the ball (right ${cm(Math.min(...rows.map(r => r.right)))}, left ${cm(Math.min(...rows.map(r => r.left)))} cm)`);
  });
}

test('a whole body on the ball: a planted boot stays put on the grass', () => {
  for (const [name, pace] of PACES) {
    const rows = dribble({ pace }).filter(r => r.t > 0.8);
    for (const n of 'LR') {
      const down = rows.filter((r, i) => r['pin' + n] && rows[i - 1]?.['pin' + n] && r['y' + n] < 0.04).map(r => r['slip' + n]).sort((a, b) => a - b);
      assert.ok(down.length > rows.length * 0.18, `${name}: the ${n} boot is planted ${(down.length / rows.length * 100).toFixed(0)}% of the time`);
      assert.ok(down[down.length >> 1] < 0.005, `${name}: planted, the ${n} boot's median speed over the grass is ${down[down.length >> 1].toFixed(3)} m/s`);
      assert.ok(down[Math.floor(down.length * 0.9)] < 0.02, `${name}: and it is still nine frames in ten (${down[Math.floor(down.length * 0.9)].toFixed(3)} m/s)`);
    }
    assert.ok(Math.min(...rows.map(r => Math.min(r.yL, r.yR))) > -0.01, `${name}: no sole under the grass`);
  }
});

test('a left-footed player walks and runs the ball with his left boot', () => {
  for (const [name, pace] of PACES) {
    const rows = dribble({ foot: 'L', pace }).filter(r => r.t > 0.8), touches = rows.filter(r => r.touch);
    assert.ok(touches.length >= 3, `${name}: ${touches.length} touches`);
    for (const r of touches) assert.ok(Math.abs(r.left) < 0.03, `${name}: left boot ${cm(r.left)} cm from the ball on a touch`);
    assert.ok(Math.min(...rows.map(r => r.right)) > 0.02, `${name}: the right boot never reaches it`);
  }
});
