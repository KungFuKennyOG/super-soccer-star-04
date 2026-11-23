// Falling over and getting up (game/brawl/ragdoll.js, game/brawl/getup.js) on a bare skeleton, as the brawl's
// page runs them: he runs, is knocked over, lies there as a ragdoll, and gets up into the standing animation.
// Measured: he starts on the ragdoll's pose and ends on the animation's, nothing goes under the grass, pinned
// hands and feet stay on their spots, and nothing jumps. (No mesh: this runs in Node.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { createBrawl } from '../../rules/brawl/world.js';
import { startRagdoll, stepRagdoll, poseRagdoll } from '../../game/brawl/ragdoll.js';
import { GETUP_TIME, startGetUp, poseGetUp } from '../../game/brawl/getup.js';

const DT = 1 / 60;
// every joint's place on the pitch
function joints(m) {
  m.root.updateMatrixWorld(true);
  const o = {};
  for (const [n, b] of Object.entries(m.bone)) if (n !== 'root') o[n] = b.getWorldPosition(new THREE.Vector3());
  return o;
}
const apart = (a, b) => Math.max(...Object.keys(a).map(k => a[k].distanceTo(b[k])));

// A man knocked over at `vel`, down for `down` s, then getting up to face `face` (rad; null: the way the get-up
// leaves him). Returns the fall's and the get-up's frames and what startGetUp said.
export function knockOver(vel, face = null, seed = 1, down = 2.2) {
  const rnd = Math.random; let s = seed;
  Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  try {
    const { bones, by } = buildSkeleton(), root = new THREE.Group(); root.add(bones[0]);
    const m = { root, bone: by, shadow: new THREE.Object3D(), phase: 0, strike: null }, w = createBrawl({ n: 6 }), p = w.players[3];
    const sp = Math.hypot(vel.x, vel.z) || 1;
    p.x = 3; p.z = 5; p.vx = vel.x / sp * Math.min(6, sp); p.vz = vel.z / sp * Math.min(6, sp); p.fx = vel.x / sp; p.fz = vel.z / sp;
    let t = 0;
    for (; t < 0.6; t += DT) { p.x += p.vx * DT; p.z += p.vz * DT; p.stride += DT * 6; placeModel(m, p); animate(m, p, DT, t, false, false, w.ball, false); }
    startRagdoll(m, vel);
    const fall = [];
    p.vx *= 0.5; p.vz *= 0.5;
    for (let k = 0; k < down; k += DT, t += DT) {
      p.x += p.vx * DT; p.z += p.vz * DT; p.vx *= 1 - 2.5 * DT; p.vz *= 1 - 2.5 * DT;
      stepRagdoll(m, DT, p); poseRagdoll(m);
      fall.push({ t: k, j: joints(m) });
    }
    p.vx = p.vz = 0;
    const lying = joints(m), natural = startGetUp(m), kind = m.getUp.kind;
    if (face === null) { p.fx = natural.fx; p.fz = natural.fz; } else { p.fx = Math.sin(face); p.fz = Math.cos(face); }
    const up = [];
    for (let k = 0; k <= GETUP_TIME + 3 * DT; k += DT, t += DT) {
      placeModel(m, p); animate(m, p, DT, t, false, false, w.ball, false);
      const stood = joints(m), on = !!m.getUp;
      if (on) poseGetUp(m, p, k);
      const pins = m.getUp ? Object.fromEntries(Object.entries(m.getUp.pins).filter(([, q]) => q.on && q.step >= 1).map(([n, q]) => [n, q.pos.clone()])) : {};
      for (const b of Object.values(by)) assert.ok(Number.isFinite(b.quaternion.x + b.quaternion.w + b.position.y), `${b.name} is finite`);
      up.push({ t: k, j: joints(m), stood, pins, done: !m.getUp });
    }
    return { fall, up, lying, natural, kind, p };
  } finally { Math.random = rnd; }
}

// the falls looked at: [name, velocity, seed]
const FALLS = [['tripped', { x: 0, y: 0.6, z: 3 }, 2], ['still rolling', { x: 4, y: 4, z: 1 }, 2, 1], ['clattered', { x: 4, y: 3, z: -3 }, 1], ['sent flying', { x: 5, y: 5, z: 6 }, 3], ['a brawl hit', { x: -5, y: 5, z: 2 }, 1], ['bundled over', { x: 0, y: 2, z: 5 }, 1]];
const stats = up => {
  let fast = 0, low = 9, miss = 0;
  for (let i = 1; i < up.length; i++) for (const k in up[i].j) {
    fast = Math.max(fast, up[i].j[k].distanceTo(up[i - 1].j[k]) / DT); low = Math.min(low, up[i].j[k].y);
    if (up[i].pins[k]) miss = Math.max(miss, up[i].j[k].distanceTo(up[i].pins[k]));
  }
  return { fast, low, miss };
};

test('a get-up starts on the pose the ragdoll lay in and ends on the standing animation', () => {
  const kinds = new Set();
  for (const [name, vel, seed, down] of FALLS) {
    const r = knockOver(vel, null, seed, down), last = r.up.findIndex(f => f.done);
    kinds.add(r.kind);
    assert.ok(apart(r.up[0].j, r.lying) < 0.002, `${name}: first frame ${(apart(r.up[0].j, r.lying) * 100).toFixed(2)} cm from the ragdoll's pose`);
    assert.ok(apart(r.up[1].j, r.lying) < 0.03, `${name}: and no jump off it (${(apart(r.up[1].j, r.lying) * 100).toFixed(1)} cm a frame later)`);
    assert.ok(last > 0 && Math.abs(r.up[last].t - GETUP_TIME) < DT * 1.01, `${name}: over at GETUP_TIME`);
    assert.equal(apart(r.up[last].j, r.up[last].stood), 0, `${name}: the frame it ends is the animation's own pose`);
    assert.ok(apart(r.up[last - 1].j, r.up[last - 1].stood) < 0.02, `${name}: ${(apart(r.up[last - 1].j, r.up[last - 1].stood) * 100).toFixed(1)} cm from the standing pose a frame before`);
    assert.ok(r.up[Math.round(last * 0.5)].j.head.y < 1.3 && r.up[Math.round(last * 0.5)].j.hips.y > 0.12, `${name}: half way he is part way up (head ${r.up[Math.round(last * 0.5)].j.head.y.toFixed(2)} m)`);
  }
  assert.deepEqual([...kinds].sort(), ['back', 'front', 'side'], 'these falls end on his back, his front and his side');
});

test('nothing under the grass, pinned hands and feet stay put, nothing jumps', () => {
  for (const [name, vel, seed, down] of FALLS) {
    const r = knockOver(vel, null, seed, down), s = stats(r.up);
    assert.ok(s.low > 0.015, `${name}: lowest joint ${(s.low * 100).toFixed(1)} cm over the grass`);
    assert.ok(s.miss < 0.03, `${name}: a pinned hand or foot is never more than ${(s.miss * 100).toFixed(1)} cm off its spot`);
    assert.ok(s.fast < 18, `${name}: fastest joint ${s.fast.toFixed(1)} m/s`);
    const d = Math.hypot(r.natural.x - r.p.x, r.natural.z - r.p.z);
    if (!down) assert.ok(d < 0.6, `${name}: the recording alone would stand him ${d.toFixed(2)} m from the sim's spot`);       // (a man called up while he is still rolling hasn't slid onto it yet)
  }
});

test('made to face any way he still gets there without a jump', () => {
  for (const [name, vel, seed, down] of FALLS.slice(0, 4)) for (const face of [0, 1.6, 3.1, -1.6]) {
    const r = knockOver(vel, face, seed, down), s = stats(r.up), last = r.up.findIndex(f => f.done);
    assert.ok(s.fast < 24 && s.low > 0.015, `${name} facing ${face}: fastest joint ${s.fast.toFixed(1)} m/s, lowest ${(s.low * 100).toFixed(1)} cm`);
    assert.ok(apart(r.up[last - 1].j, r.up[last - 1].stood) < 0.02, `${name} facing ${face}: on the standing pose at the end`);
  }
});

test('a tripped man puts his hands down first and does not go head over heels', () => {
  let front = 0;
  for (const seed of [1, 2, 3, 4]) for (const v of [2.2, 3, 4]) {
    const r = knockOver({ x: 0, y: 0.6, z: v }, null, seed), f = r.fall;
    const hand = f.findIndex(x => Math.min(x.j.handL.y, x.j.handR.y) < 0.08), head = f.findIndex(x => x.j.head.y < 0.2), chest = f.findIndex(x => x.j.chest.y < 0.2);
    assert.ok(hand > 0 && hand < chest && (head < 0 || hand < head + 6), `${v} m/s: a hand is down at ${f[hand]?.t.toFixed(2)} s, his chest at ${f[chest]?.t.toFixed(2)} s, his head at ${f[head]?.t.toFixed(2)} s`);
    assert.ok(f[hand].j.handL.z > f[hand].j.chest.z || f[hand].j.handR.z > f[hand].j.chest.z, `${v} m/s: out in front of him`);
    if (r.kind === 'front') front++;
    assert.ok(Math.max(...f.map(x => Math.max(x.j.footL.y, x.j.footR.y))) < 1.0, `${v} m/s: his feet never go over his head (${Math.max(...f.map(x => Math.max(x.j.footL.y, x.j.footR.y))).toFixed(2)} m)`);
  }
  assert.ok(front >= 8, `${front} of 12 end on their front (the rest roll over onto their back)`);
});

test('a man sent flying still flies, and comes to rest', () => {
  const r = knockOver({ x: 5, y: 6, z: 6 }, null, 3), f = r.fall;
  assert.ok(Math.max(...f.map(x => x.j.hips.y)) > 1.6, `hips up to ${Math.max(...f.map(x => x.j.hips.y)).toFixed(2)} m`);
  const end = f[f.length - 1], before = f[f.length - 7];
  assert.ok(Math.max(...Object.values(end.j).map(q => q.y)) < 0.6 && apart(end.j, before.j) < 0.06, `all but still by the time he gets up (${(apart(end.j, before.j) * 10).toFixed(2)} m/s: the slide to the sim's spot)`);
});
