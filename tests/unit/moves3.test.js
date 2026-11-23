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
const WIN = { m3cut: [1.2, 1.9], m3zig: [1.0, 3.0], m3stop: [1.2, 2.4], m3arrive: [1.0, 2.6], m3side: [0.8, 3.3], m3back: [0.8, 2.4] };
const show = (k, r) => `${k}: planted feet ${r.slide.toFixed(2)} m/s (median), ${r.p90.toFixed(2)} (9 in 10), ${r.worst.toFixed(2)} (worst) over ${r.n} frames; worst joint jump ${(r.jump * 100).toFixed(1)} cm; lowest sole ${(r.low * 100).toFixed(1)} cm`;

test('report', () => {
  for (const [k, [a, b]] of Object.entries(WIN)) console.log(show(k, measure(run(k), a, b)));
});
