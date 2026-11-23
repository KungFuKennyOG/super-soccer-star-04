// The throw-in (game/brawl/throwin.js) on a bare skeleton standing at the line: what the Laws ask of it (both
// hands on the ball, from behind and over the head, both feet on the ground) and that it starts from and comes
// back to the standing pose without a jump.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { createBrawl } from '../../rules/brawl/world.js';
import { THROW, poseThrowIn, throwInBall } from '../../game/brawl/throwin.js';

const DT = 1 / 60, R = 0.12, GO = THROW.windup + THROW.release;
function film() {
  const { bones, by } = buildSkeleton(), root = new THREE.Group(); root.add(bones[0]);
  const m = { root, bone: by, shadow: new THREE.Object3D(), phase: 0, strike: null }, w = createBrawl({ n: 6 }), p = w.players[3], rows = [];
  w.ball.x = -6; w.ball.z = 10; p.x = 34; p.z = 10; p.vx = p.vz = 0; p.fx = -1; p.fz = 0;          // on the touchline, facing the pitch
  const at = n => by[n].getWorldPosition(new THREE.Vector3()), all = () => { root.updateMatrixWorld(true); return Object.fromEntries(Object.keys(by).filter(n => n !== 'root').map(n => [n, at(n)])); };
  for (let t = -2; t < -THROW.hold - 0.3; t += DT) { placeModel(m, p); animate(m, p, DT, t, false, false, w.ball, false); }
  for (let i = 0, t = -THROW.hold - 0.3; t < GO + THROW.follow + 0.1; i++, t = -THROW.hold - 0.3 + i * DT) {
    placeModel(m, p); animate(m, p, DT, t, false, false, w.ball, false);
    const stood = all();
    poseThrowIn(m, t);
    const j = all(), ball = throwInBall(m, new THREE.Vector3());
    const palm = s => at('hand' + s).add(new THREE.Vector3(0, -0.09, 0).applyQuaternion(by['hand' + s].getWorldQuaternion(new THREE.Quaternion())));
    rows.push({ t, j, stood, ball, palms: [palm('L'), palm('R')], skull: new THREE.Vector3(0, 0.125, 0.02).applyMatrix4(by.head.matrixWorld), crown: new THREE.Vector3(0, 0.245, 0.02).applyMatrix4(by.head.matrixWorld) });
  }
  return rows;
}
const rows = film(), near = t => rows.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
const apart = (a, b) => Math.max(...Object.keys(a).map(k => a[k].distanceTo(b[k])));
const fwd = v => -v.x;            // he faces -x: how far forward of the line something is

test('both feet stay on the ground where they stood, from start to finish', () => {
  for (const r of rows) for (const n of ['footL', 'footR', 'toeL', 'toeR']) assert.ok(r.j[n].distanceTo(r.stood[n]) < 0.002, `${n} ${(r.j[n].distanceTo(r.stood[n]) * 100).toFixed(2)} cm off its spot at ${r.t.toFixed(2)} s`);
});

test('both hands are on the ball for as long as he has it', () => {
  const held = rows.filter(r => r.ball);
  assert.ok(Math.abs(held[0].t + THROW.hold) < DT * 1.01 && Math.abs(held[held.length - 1].t - GO) < DT * 1.01, `he has it from ${held[0].t.toFixed(2)} to ${held[held.length - 1].t.toFixed(2)} s`);
  for (const r of held) for (const pm of r.palms) assert.ok(Math.abs(pm.distanceTo(r.ball) - R) < 0.015, `a palm ${(pm.distanceTo(r.ball) * 100).toFixed(1)} cm from the ball's middle at ${r.t.toFixed(2)} s`);
  for (const r of held) assert.ok(r.ball.distanceTo(r.skull) > R + 0.1, `the ball ${(r.ball.distanceTo(r.skull) * 100).toFixed(0)} cm from the middle of his head at ${r.t.toFixed(2)} s (not in it)`);
});

test('from behind and over the head, let go above and in front of it', () => {
  const back = near(THROW.windup), go = near(GO - DT), before = near(GO - 2 * DT), over = rows.filter(r => r.ball && r.t > THROW.windup && Math.abs(fwd(r.ball) - fwd(r.skull)) < 0.15);          // (the frames in which it is over his head: it is moving at 10 m/s by then)
  assert.ok(fwd(back.ball) < fwd(back.skull) - 0.12 && back.ball.y < back.crown.y, `wound up, the ball is ${((fwd(back.skull) - fwd(back.ball)) * 100).toFixed(0)} cm behind the middle of his head`);
  assert.ok(over.length && over.every(r => r.ball.y - R > r.crown.y - 0.01), 'it goes over the top of his head');
  assert.ok(fwd(go.ball) > fwd(go.skull) + 0.06 && go.ball.y > go.crown.y + R, `let go ${((fwd(go.ball) - fwd(go.skull)) * 100).toFixed(0)} cm in front of the middle of his head and above it`);
  const v = go.ball.clone().sub(before.ball).multiplyScalar(1 / DT);
  assert.ok(v.length() > 7 && v.length() < 18 && fwd(v) > 5, `the ball leaves his hands at ${v.length().toFixed(1)} m/s, forward`);
  const lean = r => fwd(r.j.neck) - fwd(r.j.hips);            // how far his neck is in front of his hips
  assert.ok(lean(back) < lean(near(0)) - 0.1 && back.j.hips.y < near(0).j.hips.y - 0.04, `wound up, his back is arched (neck ${((lean(near(0)) - lean(back)) * 100).toFixed(0)} cm further back over his hips) and his knees bent`);
  assert.ok(lean(near(GO + 0.19)) > lean(near(0)) + 0.15, 'and he follows through over his feet');
});

test('it starts from the standing pose, returns to it, and nothing jumps', () => {
  assert.equal(apart(rows[0].j, rows[0].stood), 0, 'untouched before he reaches for the ball');
  assert.equal(apart(rows[rows.length - 1].j, rows[rows.length - 1].stood), 0, 'and after the follow-through');
  let fast = 0;
  for (let i = 1; i < rows.length; i++) for (const k in rows[i].j) fast = Math.max(fast, rows[i].j[k].distanceTo(rows[i - 1].j[k]) / DT);
  assert.ok(fast < 16, `fastest joint ${fast.toFixed(1)} m/s (his hands as he lets go)`);
});
