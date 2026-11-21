// Beaten defenders (game/beaten.js): the real sim plays you running at a man and beating him (the runs the look
// page films: tools/anim2look.js beatLog), and the real poses on a bare skeleton are measured through the moment
// the sim has him out of the play: something happens, it is over when he is back in it, his planted feet grip
// the pitch as well as they do in his ordinary run, and nothing jumps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { beaten, beatKind, startBeat, BEATS } from '../../game/beaten.js';
import { beatLog } from '../../tools/anim2look.js';

const DT = 1 / 72, cm = x => (x * 100).toFixed(1), JOINTS = ['hips', 'head', 'handL', 'handR', 'footL', 'footR'];
const model = foot => { const { bones, by } = buildSkeleton(), root = new THREE.Group(); root.add(bones[0]); return { root, bone: by, shadow: new THREE.Object3D(), phase: 0, strike: null, foot }; };
const median = a => [...a].sort((x, y) => x - y)[a.length >> 1] ?? 0;

// One run. Returns a row per frame: is a reaction on, where his joints are (his own space), the balls of his feet
// and his ankles on the pitch, his knees' gap, how far his head is tipped, where the model stands.
function run(move, n = 1, foot = 'R') {
  const log = beatLog(new Map([['move', move], ['n', String(n)]])), m = model(foot), rows = [], f = new THREE.Vector3();
  log.forEach((row, i) => {
    let began = null;
    for (const e of row.ev) if ((e.type === 'skill' || e.type === 'drag') && beaten({ d1: m }, [{ id: 'd1', ...row.def }], e)) began = m.beat.kind;
    placeModel(m, row.def); animate(m, row.def, DT, i * DT, false, null, row.ball, !!row.defOwn);
    m.root.updateMatrixWorld(true);
    const J = {}, W = {};
    for (const b of JOINTS) { J[b] = m.root.worldToLocal(m.bone[b].getWorldPosition(new THREE.Vector3())); assert.ok(Number.isFinite(J[b].x + J[b].y + J[b].z), `${b} is finite`); }
    for (const b of ['footL', 'footR']) W[b] = { ball: m.bone[b].localToWorld(new THREE.Vector3(0, -0.085, 0.1)), ankle: m.bone[b].getWorldPosition(new THREE.Vector3()) };
    f.set(0, 0, 1).applyQuaternion(m.bone.head.getWorldQuaternion(new THREE.Quaternion()));
    rows.push({ began, kind: m.beat ? m.beat.kind : null, on: !!m.beat || (m.lunge || 0) > 0, lunge: m.lunge || 0, J, W, knees: m.bone.lowerLegL.getWorldPosition(new THREE.Vector3()).distanceTo(m.bone.lowerLegR.getWorldPosition(new THREE.Vector3())), headUp: f.y,
      at: m.root.position.clone(), sim: { x: row.def.x, z: row.def.z }, stun: row.def.stun });
  });
  return rows;
}
// planted feet's speed over the grass (the ball of the foot down on this frame and the last), and the worst jump of any joint
function measure(rows, pick) {
  const slide = []; let jump = 0;
  for (let i = 2; i < rows.length - 1; i++) {
    if (!pick(rows[i])) continue;
    for (const b of ['footL', 'footR']) { const a = rows[i - 1].W[b], c = rows[i].W[b]; if (a.ball.y < 0.02 && c.ball.y < 0.02 && a.ankle.y < 0.13) slide.push(c.ball.distanceTo(a.ball) / DT); }
    for (const b of JOINTS) jump = Math.max(jump, rows[i + 1].J[b].clone().sub(rows[i].J[b]).sub(rows[i].J[b].clone().sub(rows[i - 1].J[b])).length());
  }
  return { slide: median(slide), n: slide.length, jump };
}

const WANT = { stepover: 'feint', stepoverin: 'feint', roulette: 'spin', nutmeg: 'nutmeg', rainbow: 'rainbow', drag: 'drag' };
test('every way of beating him: he reacts for the time the sim has him out of it, feet gripping, nothing jumping', () => {
  for (const [move, kind] of Object.entries(WANT)) for (const n of [1, 2, 3]) {
    const rows = run(move, n), i0 = rows.findIndex(r => r.began), name = `${move}, run ${n}`;
    assert.ok(i0 > 0 && rows[i0].began === kind, `${name}: begins as ${kind}`);
    const T = rows[i0].stun, last = rows.findLastIndex(r => r.kind === kind);
    assert.ok(T > 0.4 && T < 1.6, `${name}: the sim has him for ${T.toFixed(2)} s`);
    assert.ok((last - i0) * DT > T - 0.25 && (last - i0) * DT < T + 0.2, `${name}: his reaction lasts ${((last - i0) * DT).toFixed(2)} s`);
    const during = measure(rows, r => r.on), plain = measure(rows, r => !r.on);
    assert.ok(during.n >= 5, `${name}: his feet are on the grass through it (${during.n} planted frames)`);
    assert.ok(during.slide < 1, `${name}: planted feet move ${during.slide.toFixed(2)} m/s over the grass (${plain.slide.toFixed(2)} in his ordinary run)`);
    assert.ok(during.jump < 0.3, `${name}: no joint jumps (${cm(during.jump)} cm; his ordinary run's worst is ${cm(plain.jump)})`);
    // he ends on the run he goes on with: the frames either side of the end are no rougher than the run
    assert.ok(measure(rows.slice(last - 6, last + 10), () => true).jump < Math.max(0.2, plain.jump * 1.2), `${name}: no pop as it ends`);
    const low = Math.min(...rows.slice(i0, last).map(r => r.J.hips.y)), before = rows[i0 - 3].J.hips.y;
    if (kind !== 'rainbow') assert.ok(low < before - 0.05, `${name}: he sits ${cm(before - low)} cm as he pulls up`);
    assert.ok(Math.min(...rows.slice(i0, last).flatMap(r => [r.W.footL.ankle.y, r.W.footR.ankle.y])) > 0.07, `${name}: no ankle under the grass`);
  }
});

test('a step-over throws him half a metre in one step of the sim: he gets there in his own time, either footed', () => {
  for (const foot of ['R', 'L']) for (const move of ['stepover', 'stepoverin']) {
    const rows = run(move, 1, foot), i0 = rows.findIndex(r => r.began);
    const simJump = Math.hypot(rows[i0].sim.x - rows[i0 - 1].sim.x, rows[i0].sim.z - rows[i0 - 1].sim.z);
    assert.ok(simJump > 0.45, `the sim moves him ${simJump.toFixed(2)} m in a frame`);
    let most = 0; for (let i = i0 - 2; i < i0 + 30; i++) most = Math.max(most, rows[i].at.distanceTo(rows[i - 1].at));
    assert.ok(most < 0.16, `${foot}-footed, ${move}: on the page he never moves more than ${cm(most)} cm in a frame`);
    assert.ok(Math.hypot(rows[i0 + 20].at.x - rows[i0 + 20].sim.x, rows[i0 + 20].at.z - rows[i0 + 20].sim.z) < 0.01, 'and is where the sim has him a quarter of a second on');
  }
});

test('nutmegged: his knees come together and his head goes down; lobbed: his head goes back', () => {
  const nut = run('nutmeg'), i0 = nut.findIndex(r => r.began), k = nut.slice(i0, i0 + 30);
  const plain = Math.min(...nut.slice(i0 - 40, i0).map(r => r.knees));
  assert.ok(Math.min(...k.map(r => r.knees)) < Math.min(0.17, plain - 0.03), `knees ${cm(Math.min(...k.map(r => r.knees)))} cm apart (never under ${cm(plain)} in his run)`);
  assert.ok(Math.min(...k.map(r => r.headUp)) < -0.5, `he looks down (${Math.min(...k.map(r => r.headUp)).toFixed(2)})`);
  const lob = run('rainbow'), j0 = lob.findIndex(r => r.began);
  assert.ok(Math.max(...lob.slice(j0, j0 + 50).map(r => r.headUp)) > 0.25, `he looks up after it (${Math.max(...lob.slice(j0, j0 + 50).map(r => r.headUp)).toFixed(2)})`);
});

test('going in for the ball and finding it gone: the leg reaches, then he catches himself', () => {
  for (const n of [1, 2, 3]) {
    const rows = run('miss', n), i0 = rows.findIndex(r => r.lunge > 0), miss = rows.findIndex(r => r.kind === 'miss'), end = rows.findLastIndex(r => r.on);
    assert.ok(i0 > 0 && miss > i0, `run ${n}: he goes in (${((miss - i0) * DT).toFixed(2)} s), and misses`);
    assert.ok(Math.max(...rows.map(r => r.lunge)) > 0.4, 'the leg goes out');
    assert.ok((end - miss) * DT < 0.7, `he is back on his run ${((end - miss) * DT).toFixed(2)} s after`);
    assert.ok(measure(rows, r => r.on).jump < 0.3, `nothing jumps (${cm(measure(rows, r => r.on).jump)} cm)`);
  }
});

test('what does not beat him: a move he read, a training drill\'s pinned defender, a man already being posed for one', () => {
  assert.equal(beatKind({ type: 'skill', move: 'stepover', ok: false }), null);
  assert.equal(beatKind({ type: 'drag', read: true }), null);
  assert.equal(beatKind({ type: 'drag', read: false }), 'drag');
  assert.deepEqual(['stepover', 'roulette', 'nutmeg', 'rainbow'].map(move => beatKind({ type: 'skill', move, ok: true })), ['feint', 'spin', 'nutmeg', 'rainbow']);
  const m = model(), p = { id: 'd1', x: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: 1, stun: 99, tackleT: 0, role: 'def', stride: 0 };
  assert.equal(beaten({ d1: m }, [p], { type: 'drag', read: false }), 0, 'pinned (stun 99): nothing');
  placeModel(m, p); animate(m, p, DT, 0, false, null, { x: 0, y: 0.11, z: 3 }, false);
  assert.equal(m.beat ?? null, null);
  p.stun = 0; animate(m, p, DT, DT, false, null, { x: 0, y: 0.11, z: 3 }, false);
  p.stun = 0.6; assert.equal(beaten({ d1: m }, [p], { type: 'drag', read: false }), 1);
  assert.equal(beaten({ d1: m }, [p], { type: 'drag', read: false }), 0, 'not begun twice');
  for (const kind of BEATS) { startBeat(m, p, kind, 0); assert.ok(m.beat.T > 0.3 && m.beat.T < 1.6, `${kind}: a replay's has its length`); }
});
