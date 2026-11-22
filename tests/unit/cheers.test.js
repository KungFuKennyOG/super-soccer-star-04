// Goal celebrations on bare skeletons (game/cheers.js), moved by the real sim (rules/celebrate.js): what can be
// measured is: feet that are down stay where they are (except in the knee slide), nothing is under the grass, the
// hands in the pile-on are on you, heads are not inside each other, and your own view moves smoothly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { cheerOf, viewDrop } from '../../game/cheers.js';
import { createWorld, stepSim, resetPlay, startCelebration, pickCelebration } from '../../rules/sim.js';
import { CELEBRATIONS, FLIP } from '../../rules/celebrate.js';

const DT = 1 / 72, IDS = ['you', 'm1', 'm2', 'd1', 'd2', 'd3'], at = new THREE.Vector3();
const POINTS = ['head', 'handL', 'handR', 'lowerLegL', 'lowerLegR', 'footL', 'footR', 'toeL', 'toeR', 'upperArmL', 'upperArmR', 'hips'];
// Plays a celebration. Returns one row a frame: { t, drop, [id]: { [bone]: Vector3 (world) } }.
function play(kind, x = 4, z = -18) {
  const w = createWorld(() => 0.5); resetPlay(w, () => 0.5);
  Object.assign(w.you, { x, z, fx: 0, fz: -1 }); w.dead = true; w.owner = null;
  const ms = Object.fromEntries(IDS.map(id => { const { bones, by } = buildSkeleton(), root = new THREE.Group(); root.add(bones[0]); return [id, { root, bone: by, shadow: new THREE.Object3D(), phase: 0, strike: null }]; }));
  startCelebration(w, () => 0.3);
  const rows = [];
  let t = 0;
  const frame = () => {
    stepSim(w, { move: { x: 0, z: 0 }, facing: { x: 0, z: -1 } }, DT); t += DT;
    const c = w.celebrate, row = { t: c.kind ? c.t : -1, drop: viewDrop(c), c };
    for (const id of IDS) {
      const m = ms[id], p0 = w.byId[id];
      let p = p0;
      if (id === 'you') { p = Object.create(p0); p.role = 'mate'; if (c.kind) { p.fx = c.dx; p.fz = c.dz; } }
      cheerOf(m, p0, c, w.you); placeModel(m, p);
      animate(m, p, DT, t, false, true, null, false);
      m.root.updateMatrixWorld(true);
      row[id] = Object.fromEntries(POINTS.map(n => [n, m.bone[n].getWorldPosition(new THREE.Vector3())]));
      for (const b of Object.values(m.bone)) assert.ok(Number.isFinite(b.quaternion.x + b.quaternion.w + b.position.y), `${kind}: ${id} ${b.name} is finite`);
    }
    rows.push(row);
  };
  for (let i = 0; i < 72 * 4; i++) frame();
  assert.ok(pickCelebration(w, kind));
  while (w.celebrate.t < w.celebrate.T) frame();
  return rows.filter(r => r.t >= 0);
}
const cm = v => (v * 100).toFixed(1);
// how fast a point goes over the ground between two rows
const over = (a, b) => Math.hypot(b.x - a.x, b.z - a.z) / DT;

test('nobody is ever under the grass', () => {
  for (const { id } of CELEBRATIONS) {
    let low = 9, who = '';
    for (const r of play(id)) for (const p of ['you', 'm1', 'm2']) for (const n of POINTS) if (r[p][n].y < low) { low = r[p][n].y; who = `${p} ${n} at ${r.t.toFixed(2)}`; }
    assert.ok(low > 0.005, `${id}: lowest joint ${cm(low)} cm (${who})`);
  }
});

test('the knee slide: knees on the grass while you slide and kneel, then up onto your feet', () => {
  const rows = play('slide'), c = rows[0].c, mid = rows.filter(r => r.t > c.plan.run + 0.3 && r.t < c.T - 1.0);
  for (const r of mid) for (const n of 'LR') {
    const knee = r.you['lowerLeg' + n].y;
    assert.ok(knee > 0.04 && knee < 0.075, `knee ${cm(knee)} cm off the grass at ${r.t.toFixed(2)}`);
    assert.ok(r.you['foot' + n].y < 0.2, 'the shin lies behind you');
  }
  assert.ok(Math.min(...mid.map(r => r.you.head.y)) > 0.95 && Math.max(...mid.map(r => r.you.head.y)) < 1.32, 'kneeling height');
  const end = rows[rows.length - 1];
  assert.ok(end.you.hips.y > 0.88 && end.you.footL.y < 0.12 && end.you.footR.y < 0.12, 'standing again at the end');
});

test('the backflip: feet still on the grass before take-off and after landing, over at 1.4 m', () => {
  for (const [who, t0] of [['you', FLIP.at], ['m2', FLIP.mateAt]]) {
    const rows = play('flip');
    let worst = 0, top = 0, upside = false;
    for (let i = 1; i < rows.length; i++) {
      const u = rows[i].t - t0;
      if (u < 0.16 || u > FLIP.len) continue;                       // (he is still settling into the recording's stance before that)
      top = Math.max(top, rows[i][who].hips.y);
      if (rows[i][who].head.y < rows[i][who].hips.y) upside = true;
      if (u > FLIP.air[0] - 0.02 && u < FLIP.air[1] + 0.03) continue;   // in the air
      // the ball of the foot (the ankle travels as his heels come up: that is the recording)
      for (const n of 'LR') if (rows[i][who]['toe' + n].y < 0.05 && rows[i - 1][who]['toe' + n].y < 0.05) { const sp = over(rows[i - 1][who]['toe' + n], rows[i][who]['toe' + n]); if (process.env.DBG && sp > 0.3) console.log(who, n, u.toFixed(3), sp.toFixed(2)); worst = Math.max(worst, sp); }
    }
    assert.ok(top > 1.3, `${who}: hips reach ${top.toFixed(2)} m`);
    assert.ok(upside, `${who} goes over`);
    assert.ok(worst < 0.7, `${who}: a planted foot moves at ${worst.toFixed(2)} m/s`);
  }
});

test('the pile-on: their hands are on you, and no head is inside another', () => {
  const rows = play('pile'), c = rows[0].c, hold = rows.filter(r => r.t > 2.2 && r.t < c.T - 1.4);
  assert.ok(hold.length > 20);
  for (const r of hold) {
    for (const [a, b] of [['you', 'm1'], ['you', 'm2'], ['m1', 'm2']]) assert.ok(r[a].head.distanceTo(r[b].head) > 0.24, `${a} and ${b}: heads ${cm(r[a].head.distanceTo(r[b].head))} cm apart at ${r.t.toFixed(2)}`);
    for (const m of ['m1', 'm2']) for (const n of 'LR') {
      const d = Math.min(r[m]['hand' + n].distanceTo(r.you.upperArmL), r[m]['hand' + n].distanceTo(r.you.upperArmR));
      assert.ok(d < 0.36, `${m}'s hand${n} is ${cm(d)} cm from your shoulder at ${r.t.toFixed(2)}`);
    }
  }
});

test('standing celebrations: your feet do not move', () => {
  for (const id of ['ears', 'pile']) {
    const rows = play(id).filter(r => r.t > 1.2 && r.t < rows0(id) - 1.2);
    let worst = 0;
    for (let i = 1; i < rows.length; i++) for (const n of 'LR') worst = Math.max(worst, over(rows[i - 1].you['foot' + n], rows[i].you['foot' + n]));
    assert.ok(worst < 0.05, `${id}: ${worst.toFixed(3)} m/s`);
  }
});
const rows0 = id => CELEBRATIONS.find(c => c.id === id).T;

test('your own view: down on your knees and up through the flip without a jump, level again at the end', () => {
  for (const { id } of CELEBRATIONS) {
    const rows = play(id);
    let step = 0, lo = 0, hi = 0;
    for (let i = 1; i < rows.length; i++) { step = Math.max(step, Math.abs(rows[i].drop - rows[i - 1].drop)); lo = Math.min(lo, rows[i].drop); hi = Math.max(hi, rows[i].drop); }
    assert.ok(step < (id === 'flip' ? 0.14 : id === 'slide' ? 0.07 : 0.045), `${id}: the view moves ${cm(step)} cm in a frame`);
    assert.ok(Math.abs(rows[rows.length - 1].drop) < 0.02, `${id}: ends ${cm(rows[rows.length - 1].drop)} cm off`);
    if (id === 'slide' || id === 'pile') assert.ok(lo < -0.45 && hi === 0);
    if (id === 'flip') assert.ok(hi > 0.45 && lo < -0.2);
  }
});
