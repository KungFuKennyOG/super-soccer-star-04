// Cuts, stops, side-steps and backing off (game/footwork.js, game/shuffle.js): a man moved the way the sim moves one
// (tools/moves3look.js moveLog) and the real poses on a bare skeleton. Measured: how fast a planted foot moves over
// the grass, the worst jump of any joint between frames, nothing under the grass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { moveLog } from '../../tools/moves3look.js';

const DT = 1 / 72, JOINTS = ['hips', 'head', 'handL', 'handR', 'footL', 'footR'];
const model = foot => { const { bones, by } = buildSkeleton(), root = new THREE.Group(); root.add(bones[0]); return { root, bone: by, shadow: new THREE.Object3D(), phase: 0, strike: null, foot }; };
const pct = (a, k) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * k))] ?? 0;

export function run(kind, opt = {}, foot = 'R') {
  const log = moveLog(kind, new Map(Object.entries(opt).map(([k, v]) => [k, String(v)]))), m = model(foot), rows = [];
  m.plain = !!opt.old;
  log.forEach((row, i) => {
    placeModel(m, row.p); animate(m, row.p, DT, i * DT, false, null, row.ball, false);
    m.root.updateMatrixWorld(true);
    const J = {}, W = {};
    for (const b of JOINTS) { J[b] = m.bone[b].getWorldPosition(new THREE.Vector3()).sub(m.root.position); assert.ok(Number.isFinite(J[b].x + J[b].y + J[b].z), `${b} is finite`); }
    for (const b of ['footL', 'footR']) { const ball = m.bone[b].localToWorld(new THREE.Vector3(0, -0.085, 0.1)), heel = m.bone[b].localToWorld(new THREE.Vector3(0, -0.085, -0.07)), toe = m.bone[b].localToWorld(new THREE.Vector3(0, -0.04, 0.2)); W[b] = { ball, heel, low: Math.min(ball.y, heel.y, toe.y), ankle: m.bone[b].getWorldPosition(new THREE.Vector3()) }; }
    rows.push({ t: i * DT, J, W, p: row.p, fw: m.fw ? { mode: m.fw.mode, k: m.fw.k, L: m.fw.L.lock ? 'lock' : m.fw.L.step ? 'step' : '', R: m.fw.R.lock ? 'lock' : m.fw.R.step ? 'step' : '' } : null, hipY: J.hips.y, yaw: m.root.rotation.y });
  });
  return rows;
}
// between t0 and t1: planted feet's speed over the grass (some part of the sole down: heel, ball or toe) (median, nine frames in ten, worst), the worst jump of a joint, the lowest sole
export function measure(rows, t0, t1) {
  const slide = []; let jump = 0, low = 9;
  for (let i = 2; i < rows.length - 2; i++) {
    if (rows[i].t < t0 || rows[i].t > t1) continue;
    for (const b of ['footL', 'footR']) { const z = rows[i - 2].W[b], a = rows[i - 1].W[b], c = rows[i].W[b], d = rows[i + 1].W[b]; if (z.low < 0.02 && a.low < 0.02 && c.low < 0.02 && d.low < 0.02 && rows[i + 2].W[b].low < 0.02) slide.push(Math.hypot(c.ball.x - a.ball.x, c.ball.z - a.ball.z) / DT); low = Math.min(low, c.low); }      // (down on the frame before and the frame after too: not the frame it lands or leaves on)
    for (const b of JOINTS) jump = Math.max(jump, rows[i + 1].J[b].clone().sub(rows[i].J[b]).sub(rows[i].J[b].clone().sub(rows[i - 1].J[b])).length());
  }
  return { slide: pct(slide, 0.5), p90: pct(slide, 0.9), worst: pct(slide, 1), n: slide.length, jump, low };
}
const WIN = { m3cut: [1.2, 1.9], m3zig: [1.0, 3.0], m3stop: [1.2, 2.4], m3arrive: [1.0, 2.6], m3side: [0.9, 1.95], m3back: [0.8, 2.4] };
const show = (k, r) => `${k}: planted feet ${r.slide.toFixed(2)} m/s (median), ${r.p90.toFixed(2)} (9 in 10), ${r.worst.toFixed(2)} (worst) over ${r.n} frames; worst joint jump ${(r.jump * 100).toFixed(1)} cm; lowest sole ${(r.low * 100).toFixed(1)} cm`;

const M = (k, old) => measure(run(k, old ? { old: 1 } : {}), ...WIN[k]);

test('a stop: braking steps and a settling step, and no planted foot slides', () => {
  for (const k of ['m3stop', 'm3arrive']) {
    const now = M(k), was = M(k, true);
    console.log(show(k, now)); console.log(show(k + ' before', was));
    assert.ok(now.p90 < 0.05, `${k}: nine planted frames in ten are still (${now.p90.toFixed(2)} m/s; before: ${was.p90.toFixed(2)})`);
    assert.ok(now.jump < 0.16 && now.low > -0.01, `${k}: nothing jumps (${(now.jump * 100).toFixed(1)} cm), nothing under the grass`);
  }
  assert.ok(M('m3stop').worst < 0.3 && M('m3stop', true).p90 > 1, 'a hard stop: the worst planted frame is under 0.3 m/s where the feet used to slide at over 1');
  // a foot comes down ahead of his hips while he is still moving fast
  const rows = run('m3stop'), brake = rows.filter(r => r.t > 1.25 && r.t < 1.5 && r.fw && r.fw.mode === 'stop');
  const ahead = Math.max(...brake.map(r => Math.max(...['footL', 'footR'].map(b => (r.W[b].low < 0.02 ? r.W[b].ankle.x - (r.J.hips.x + r.p.x) : -9)))));
  assert.ok(brake.length > 8 && ahead > 0.25, `a braking foot is down ${(ahead * 100).toFixed(0)} cm ahead of his hips`);
  const end = rows.filter(r => r.t > 3);
  assert.ok(end.every(r => !r.fw.mode), 'and it is over once he stands');
});

test('a cut: the outside foot is planted wide and held while he is turned, hips down, then he goes', () => {
  for (const [ang, out] of [[80, 'R'], [-80, 'L'], [50, 'R'], [120, 'R']]) {
    const rows = run('m3cut', { ang }), cut = rows.filter(r => r.fw && r.fw.mode === 'cut'), held = cut.filter(r => r.fw[out] === 'lock'), other = out === 'R' ? 'L' : 'R', name = `a cut of ${ang} degrees`;
    assert.ok(cut.length >= 6 && cut[0].t > 1.2 && cut[0].t < 1.36, `${name}: begins as his velocity is turned (${cut[0]?.t.toFixed(2)} s)`);
    assert.ok(held.length >= 4 && cut.every(r => !r.fw[other]), `${name}: the ${out} foot is the one planted (${held.length} frames)`);
    const b = 'foot' + out, still = held.slice(2), slide = Math.max(...still.slice(1).map((r, i) => Math.hypot(r.W[b].ball.x - still[i].W[b].ball.x, r.W[b].ball.z - still[i].W[b].ball.z) / DT));      // (after the two frames it lands over)
    assert.ok(still.length >= 3 && slide < 0.05, `${name}: it stays where it is put (${slide.toFixed(3)} m/s over ${still.length} frames)`);
    // wide of his body, on the side away from where he is going (he runs along +x: his left is -z)
    const r = still[0], wide = (r.W[b].ankle.z - (r.p.z + r.J.hips.z)) * (out === 'R' ? 1 : -1);
    assert.ok(wide > 0.2 && wide < 0.5, `${name}: ${(wide * 100).toFixed(0)} cm outside his hips`);
    const before = rows.filter(q => q.t > 0.9 && q.t < 1.2), base = before.reduce((s, q) => s + q.hipY, 0) / before.length, low = Math.min(...cut.map(q => q.hipY));
    assert.ok(base - low > 0.04 && base - low < 0.22, `${name}: his hips drop ${((base - low) * 100).toFixed(0)} cm`);
    const m = measure(rows, 1.2, 1.9);
    assert.ok(m.jump < 0.3 && m.low > -0.01, `${name}: no joint jumps (${(m.jump * 100).toFixed(0)} cm), nothing under the grass`);
    if (ang === 80) console.log(show('m3cut', m), `| hips drop ${((base - low) * 100).toFixed(0)} cm, the foot ${(wide * 100).toFixed(0)} cm outside his hips, held ${held.length} frames (${(held.length / 72).toFixed(2)} s)`);
  }
  console.log(show('m3cut before', measure(run('m3cut', { old: 1 }), 1.2, 1.9)));
  assert.ok(run('m3cut', { ang: 12 }).every(r => !r.fw || r.fw.mode !== 'cut'), 'a gentle change of direction is not a cut');
});

// how near his ankles come to each other, and how many frames in a hundred have neither foot on the grass
function feet(rows, t0, t1) {
  let gap = 9, air = 0, n = 0;
  for (const r of rows) { if (r.t < t0 || r.t > t1) continue; n++; gap = Math.min(gap, Math.hypot(r.W.footL.ankle.x - r.W.footR.ankle.x, r.W.footL.ankle.z - r.W.footR.ankle.z)); if (r.W.footL.low > 0.02 && r.W.footR.low > 0.02) air++; }
  return { gap, air: 100 * air / n };
}
test('side-steps and backing off: the recorded pelvis over feet that grip, never floating, never together', () => {
  for (const k of ['m3side', 'm3back']) for (const v of k === 'm3side' ? [1.2, 2.4, 3] : [1.2, 2.4, 2.7]) {      // (a defender backs off at up to 2.7 m/s; faster, he turns and runs)
    const rows = run(k, { v }), now = measure(rows, ...WIN[k]), was = measure(run(k, { v, old: 1 }), ...WIN[k]), f = feet(rows, ...WIN[k]), name = `${k} at ${v} m/s`;
    console.log(show(name, now), `| ankles never nearer than ${(f.gap * 100).toFixed(0)} cm, both feet off the grass ${f.air.toFixed(0)}% of frames`); if (v === 2.4) console.log(show(name + ' before', was));
    assert.ok(now.p90 < 0.1 && now.worst < 0.5, `${name}: planted feet ${now.p90.toFixed(2)} m/s nine frames in ten, ${now.worst.toFixed(2)} at worst`);
    assert.ok(f.air < 10, `${name}: he is not floating (neither foot down on ${f.air.toFixed(0)}% of frames)`);
    assert.ok(f.gap > (k === 'm3side' ? 0.27 : 0.14), `${name}: his ankles are never nearer than ${(f.gap * 100).toFixed(0)} cm`);
    assert.ok(now.jump < 0.15 && now.low > -0.012, `${name}: nothing jumps (${(now.jump * 100).toFixed(1)} cm), nothing under the grass`);
    // and he does sit: lower than the same man standing tall
    if (k === 'm3side') { const mid = rows.filter(r => r.t > 1 && r.t < 1.9), y = mid.reduce((a, r) => a + r.hipY, 0) / mid.length; assert.ok(y < 0.88 && y > 0.74, `${name}: hips at ${(y * 100).toFixed(0)} cm (standing 95)`); }
  }
  const z = M('m3zig'); console.log(show('m3zig', z));
  assert.ok(z.slide < 0.05 && z.jump < 0.3 && z.low > -0.012);
});

test('a left-footed man, and your own first-person legs', () => {
  for (const k of ['m3stop', 'm3cut', 'm3side']) { const r = measure(run(k, {}, 'L'), ...WIN[k]); assert.ok(r.jump < 0.3 && r.low > -0.012, `${k}, left-footed: ${show(k, r)}`); }
});
