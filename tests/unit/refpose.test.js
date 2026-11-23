// The referee's signals (game/brawl/refpose.js) on a bare skeleton, standing and walking: each is the signal the
// Laws describe, his legs stay the animation's, and it comes and goes without a jump.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { createBrawl } from '../../rules/brawl/world.js';
import { REF_SIGNALS, poseRefSignal, cardTransform } from '../../game/brawl/refpose.js';

const DT = 1 / 60, LEGS = ['hips', 'upperLegL', 'lowerLegL', 'footL', 'toeL', 'upperLegR', 'lowerLegR', 'footR', 'toeR'];
// He faces +z; the signal points `deg` to his left of that. walk: m/s.
function film(kind, deg = 0, walk = 0, extra = {}) {
  const { bones, by } = buildSkeleton(), root = new THREE.Group(); root.add(bones[0]);
  const m = { root, bone: by, shadow: new THREE.Object3D(), phase: 0, strike: null }, w = createBrawl({ n: 6 }), p = w.players[3], rows = [];
  w.ball.x = 0; w.ball.z = 400; p.x = 0; p.z = 0; p.vx = 0; p.vz = walk; p.fx = 0; p.fz = 1;      // (the ball far off the way he faces: a standing man turns to it)
  const sig = { kind, dir: { x: Math.sin(deg * Math.PI / 180), z: Math.cos(deg * Math.PI / 180) }, ...extra };
  const all = () => { root.updateMatrixWorld(true); return Object.fromEntries(Object.keys(by).filter(n => n !== 'root').map(n => [n, by[n].getWorldPosition(new THREE.Vector3())])); };
  const step = t => { p.z += p.vz * DT; p.stride += DT * (walk ? 2.4 + 1.45 * walk : 0); placeModel(m, p); animate(m, p, DT, t, false, false, w.ball, false); };
  for (let t = -1; t < 0; t += DT) step(t);
  const T = sig.hold || REF_SIGNALS[kind];
  for (let i = 0; i * DT < T + 0.1; i++) {
    const t = i * DT; step(t);
    const stood = all(), on = poseRefSignal(m, sig, t), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), card = cardTransform(m, pos, quat);
    rows.push({ t, on, j: all(), stood, card: card && { pos, face: new THREE.Vector3(0, 0, 1).applyQuaternion(quat) }, mouth: new THREE.Vector3(0, 0.04, 0.105).applyMatrix4(by.head.matrixWorld), crown: new THREE.Vector3(0, 0.245, 0.02).applyMatrix4(by.head.matrixWorld) });
  }
  return { rows, sig, T, at: t => rows[Math.round(t / DT)] };
}
// which way an arm points: degrees above level, and degrees to his left of straight ahead
const arm = (r, s) => { const d = r.j['hand' + s].clone().sub(r.j['upperArm' + s]); return { up: Math.asin(d.y / d.length()) * 180 / Math.PI, left: Math.atan2(d.x, d.z) * 180 / Math.PI, len: d.length() }; };

test('every signal leaves his legs to the animation, comes and goes without a jump, and says when it is over', () => {
  for (const kind of Object.keys(REF_SIGNALS)) for (const walk of [0, 1.6, 5]) {
    const { rows, T } = film(kind, 35, walk);
    let fast = 0;
    for (const [i, r] of rows.entries()) {
      for (const n of LEGS) assert.equal(r.j[n].distanceTo(r.stood[n]), 0, `${kind}: ${n} is the animation's at ${r.t.toFixed(2)} s`);
      assert.equal(r.on, r.t < T, `${kind}: ${r.on ? 'on' : 'over'} at ${r.t.toFixed(2)} s`);
      // (how fast the signal itself moves him: his own walking is taken out)
      if (i) for (const k in r.j) fast = Math.max(fast, r.j[k].clone().sub(r.stood[k]).sub(rows[i - 1].j[k]).add(rows[i - 1].stood[k]).length() / DT);
    }
    assert.ok(rows[0].j.handR.distanceTo(rows[0].stood.handR) < 1e-9 && rows[rows.length - 1].j.handL.distanceTo(rows[rows.length - 1].stood.handL) === 0, `${kind}: starts and ends on the animation's pose`);
    assert.ok(fast < (walk ? 13 : 9), `${kind} at ${walk} m/s: fastest joint ${fast.toFixed(1)} m/s`);       // (on the move that includes his arm's own swing being taken away)
  }
});

test('a direct free kick: an arm out a little above level, the way the kick goes', () => {
  for (const deg of [50, -60, 10, 120]) {
    const a = arm(film('free', deg).at(1), deg > 20 ? 'L' : 'R');
    assert.ok(a.up > 12 && a.up < 32 && Math.abs(a.left - deg) < 12 && a.len > 0.53, `pointing ${deg}: arm ${a.up.toFixed(0)} deg up, ${a.left.toFixed(0)} deg to his left, ${a.len.toFixed(2)} m long`);
  }
});

test('an indirect free kick: an arm straight up above his head, for as long as it is held', () => {
  const f = film('indirect', 0, 0, { hold: 3.5 });
  for (const t of [0.6, 1.5, 3]) { const r = f.at(t), a = arm(r, 'R'); assert.ok(a.up > 80 && r.j.handR.y > r.crown.y + 0.12, `at ${t} s: ${a.up.toFixed(0)} deg up, the wrist ${((r.j.handR.y - r.crown.y) * 100).toFixed(0)} cm over his head`); }
});

test('a penalty: pointing down at the mark', () => {
  for (const deg of [-30, 45]) { const a = arm(film('penalty', deg, 1.6).at(1), deg > 20 ? 'L' : 'R'); assert.ok(a.up < -12 && a.up > -32 && Math.abs(a.left - deg) < 12 && a.len > 0.53, `mark ${deg}: arm ${a.up.toFixed(0)} deg, ${a.left.toFixed(0)} deg to his left`); }
});

test('a card: out of the pocket, then straight up at full stretch, facing the player', () => {
  const f = film('card', 15), up = f.at(1.2);
  assert.ok(!f.at(0.1).card && !f.at(f.T - 0.05).card && !f.at(f.T + 0.05).card, 'no card before he has reached for it or once his arm is down');
  assert.ok(up.card && up.card.pos.y > up.crown.y + 0.25 && arm(up, 'R').up > 80, `the card ${((up.card.pos.y - up.crown.y) * 100).toFixed(0)} cm over his head`);
  assert.ok(up.card.face.dot(new THREE.Vector3(f.sig.dir.x, 0, f.sig.dir.z)) > 0.98, 'its face to the player');
  const out = f.at(0.3); assert.ok(out.j.handR.distanceTo(out.j.chest) < 0.3, 'his hand goes to his chest for it first');
  const red = film('card', -20, 0, { red: true }).at(1.5), a = arm(red, 'L');
  assert.ok(a.up > -5 && a.up < 25 && Math.abs(Math.abs(a.left - (-20)) - 180) < 15, `a red: the other arm points him off (${a.left.toFixed(0)} deg)`);
});

test('advantage: both arms swept forward and up the way play goes', () => {
  const r = film('advantage', 20, 4).at(0.6), l = arm(r, 'L'), rt = arm(r, 'R');
  for (const a of [l, rt]) assert.ok(a.up > 20 && a.up < 45 && Math.abs(a.left - 20) < 22 && a.len > 0.53, `an arm ${a.up.toFixed(0)} deg up, ${a.left.toFixed(0)} deg to his left`);
});

test('the whistle: a hand at his mouth; full time: an arm up, then pointing', () => {
  const w = film('whistle').at(0.25); assert.ok(w.j.handL.distanceTo(w.mouth) < 0.14 && w.j.handL.y < w.mouth.y, `wrist ${(w.j.handL.distanceTo(w.mouth) * 100).toFixed(0)} cm under his lips`);
  const f = film('fulltime', 70), a = f.at(0.6), b = f.at(1.6);
  assert.ok(arm(a, 'R').up > 80 && a.j.handL.distanceTo(a.mouth) < 0.14, 'blowing with an arm straight up');
  assert.ok(arm(b, 'R').up > 12 && arm(b, 'R').up < 35 && Math.abs(arm(b, 'R').left - 70) < 15, `then pointing (${arm(b, 'R').left.toFixed(0)} deg to his left)`);
});
