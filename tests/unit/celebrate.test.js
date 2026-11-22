import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CELEBRATIONS, CELEBRATE, createPick, stepPick, gestureFromHands, slidePlan, roomAlong, carry, FLIP, SLIDE } from '../../rules/celebrate.js';
import { createWorld, stepSim, startCelebration, pickCelebration, resetPlay } from '../../rules/sim.js';
import { PITCH, GOAL } from '../../rules/tuning.js';

const DT = 1 / 72;
const hands = (l, r) => gestureFromHands({ x: l[0], y: l[1], z: l[2] }, { x: r[0], y: r[1], z: r[2] });

test('the prompt: the stick moves it, A picks, and doing nothing plays the highlighted one', () => {
  let pk = createPick(0);
  assert.equal(stepPick(pk, DT, { down: true }), null);
  assert.equal(pk.i, 1);
  assert.equal(stepPick(pk, DT, { ok: true }), CELEBRATIONS[1].id);
  assert.equal(pk.by, 'button');
  pk = createPick(2);
  let got = null, t = 0;
  while (!got && t < 10) { got = stepPick(pk, DT); t += DT; }
  assert.equal(got, CELEBRATIONS[2].id);
  assert.equal(pk.by, 'default');
  assert.ok(Math.abs(t - CELEBRATE.pickTime) < 0.05, `default after ${t.toFixed(2)} s`);
  pk = createPick(0); stepPick(pk, DT, { up: true });
  assert.equal(pk.i, CELEBRATIONS.length - 1, 'up from the top wraps');
});

test('poses of your arms: wide, ears, one hand to the sky; hands at your sides are nothing', () => {
  assert.equal(hands([-0.25, -0.75, 0.05], [0.25, -0.75, 0.05]), null);
  assert.equal(hands([-0.7, -0.2, 0], [0.7, -0.15, 0]), 'wide');
  assert.equal(hands([-0.16, -0.03, 0.03], [0.17, 0, 0.02]), 'ears');
  assert.equal(hands([-0.2, -0.7, 0], [0.2, 0.4, 0.1]), 'sky');
  assert.equal(hands([-0.2, 0.4, 0], [0.2, 0.4, 0.1]), null, 'both hands up is not a pick');
  assert.equal(gestureFromHands(null, { x: 0.7, y: 0, z: 0 }), null);
  // held for CELEBRATE.hold it picks; a flash of it doesn't
  const pk = createPick(0);
  assert.equal(stepPick(pk, 0.1, {}, 'wide'), null);
  assert.equal(stepPick(pk, 0.1, {}, null), null);
  let got = null;
  for (let i = 0; i < 40 && !got; i++) got = stepPick(pk, DT, {}, 'ears');
  assert.equal(got, 'ears'); assert.equal(pk.by, 'gesture');
});

test('a knee slide fits the room ahead and stops by friction', () => {
  for (const room of [0, 2, 5, 9, 30]) {
    const p = slidePlan(room);
    assert.ok(p.d >= 1.4 && p.d <= 4.6);
    assert.ok(Math.abs(p.v0 * p.v0 / (2 * SLIDE.decel) - p.d) < 1e-9);
    if (room >= 3) assert.ok(p.d + p.runD <= room + 1e-9, `room ${room}: ${p.d + p.runD}`);
  }
  assert.ok(Math.abs(roomAlong(0, -20, 0, -1) - (-20 - (GOAL.z + 1.5))) < 1e-9);
  assert.equal(roomAlong(PITCH.halfW + 3, -20, 1, 0), 0);
});

// Runs a whole celebration in the real sim from a goal scored at (x, z) facing (fx, fz).
function run(kind, x = 2, z = -22, fx = 0, fz = -1, each = null) {
  const w = createWorld(() => 0.5);
  resetPlay(w, () => 0.5);
  Object.assign(w.you, { x, z, fx, fz }); w.dead = true; w.owner = null;
  startCelebration(w, () => 0.3);
  const it = () => ({ move: { x: 0, z: 0 }, facing: { x: fx, z: fz } });
  for (let i = 0; i < 72 * 4; i++) stepSim(w, it(), DT);      // (a replay, or the prompt: the far man has time to come over)
  assert.ok(pickCelebration(w, kind));
  const c = w.celebrate; let n = 0;
  while (c.t < c.T && n++ < 2000) { const prev = w.players.map(p => ({ x: p.x, z: p.z })); stepSim(w, it(), DT); if (each) each(w, c, prev); }
  return w;
}

test('every celebration: you stay on the pitch, nobody ends up inside anybody, speeds never jump', () => {
  for (const { id } of CELEBRATIONS) for (const [x, z, fx, fz] of [[2, -22, 0, -1], [-15, -28, -0.8, -0.6], [0, -8, 0, 1], [20, -12, 1, 0]]) {
    let last = null;
    const w = run(id, x, z, fx, fz, (w, c) => {
      const y = w.you, v = Math.hypot(y.vx, y.vz);
      assert.ok(Math.abs(y.x) <= PITCH.halfW + 1 && y.z >= GOAL.z - 0.5 && y.z <= PITCH.halfwayZ + 2, `${id}: you left the pitch`);
      if (last !== null && id !== 'flip') assert.ok(Math.abs(v - last) < 0.6, `${id}: your speed jumped ${last.toFixed(2)} -> ${v.toFixed(2)} at ${c.t.toFixed(2)}`);
      last = v;
    });
    const home = w.players.filter(p => p.team === 'home');
    for (const a of home) for (const b of home) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.5, `${id}: ${a.id} and ${b.id} are ${Math.hypot(a.x - b.x, a.z - b.z).toFixed(2)} m apart`);
    assert.ok(Math.hypot(w.you.vx, w.you.vz) < 0.05, `${id}: you are still moving at the end`);
    for (const m of home) if (m !== w.you) assert.ok(Math.hypot(m.x - w.you.x, m.z - w.you.z) < 4.5, `${id}: ${m.id} never got to you`);
  }
});

test('the backflip takes you back by what the recorded one travels, only while you are in the air', () => {
  const w = createWorld(() => 0.5); resetPlay(w, () => 0.5);
  Object.assign(w.you, { x: 0, z: -20, fx: 0, fz: -1 }); w.dead = true; startCelebration(w); pickCelebration(w, 'flip');
  const c = w.celebrate, z0 = w.you.z, x0 = w.you.x;
  while (c.t < c.T) {
    stepSim(w, { facing: { x: 0, z: -1 } }, DT);
    const u = c.t - FLIP.at, moving = !!carry(c);
    assert.equal(moving, u > FLIP.air[0] && u < FLIP.air[1]);
  }
  assert.ok(Math.abs(w.you.z - z0 - FLIP.back) < 0.05, `went back ${(w.you.z - z0).toFixed(2)} m`);
  assert.ok(Math.abs(Math.abs(w.you.x - x0) - FLIP.left) < 0.05);
});

test('the other side walks back toward its places, slowly', () => {
  run('ears', 2, -22, 0, -1, (w, c, prev) => {
    w.players.forEach((p, i) => { if (p.role === 'def') assert.ok(Math.hypot(p.x - prev[i].x, p.z - prev[i].z) / DT < 1.2, 'a defender ran'); });
  });
});

test('the restart clears it', () => {
  const w = run('point');
  resetPlay(w);
  assert.equal(w.celebrate, null);
});
