// What the press photographers do at the trophy presentation (game/pressact.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESS, ACT, createActs, stepActs } from '../../game/pressact.js';

function run(secs, upFrom, upTo, each) {
  const men = createActs(PRESS, 3), dt = 1 / 60;
  for (let t = 0; t < secs; t += dt) { stepActs(men, dt, t, { up: t >= upFrom && t < upTo }); each(men, t); }
  return men;
}

test('they are alive: every one checks his screen, re-frames and shifts his weight; standing ones lean', () => {
  const did = PRESS.map(() => new Set()), nudges = PRESS.map(() => new Set()), sides = PRESS.map(() => [9, -9]);
  run(60, 99, 99, men => men.forEach((a, i) => { did[i].add(a.act); nudges[i].add(a.nudge[0]); sides[i][0] = Math.min(sides[i][0], a.side); sides[i][1] = Math.max(sides[i][1], a.side); }));
  did.forEach((d, i) => { assert.ok(d.has('chimp'), `man ${i} never checks his screen`); assert.ok(nudges[i].size > 10, `man ${i} never re-frames`); assert.ok(sides[i][1] - sides[i][0] > 1.2, `man ${i} never shifts his weight`); });
  assert.ok(PRESS.some((p, i) => p.kind !== 'kneel' && did[i].has('lean')), 'nobody leans out for an angle');
});

test('nothing snaps: the camera, the knee and the lean move a little at a time, and stay in range', () => {
  const was = [];
  run(60, 20, 30, men => men.forEach((a, i) => {
    for (const k of ['chest', 'down', 'over', 'kneel']) assert.ok(a[k] >= 0 && a[k] <= 1, `${k} out of range`);
    assert.ok(Math.abs(a.lean) <= 1 && Math.abs(a.side) <= 1);
    const w = was[i]; if (w) { assert.ok(Math.abs(a.chest - w.chest) < 0.06 && Math.abs(a.kneel - w.kneel) < 0.03 && Math.abs(a.lean - w.lean) < 0.08 && Math.hypot(a.px - w.px, a.pz - w.pz) < 0.03, `man ${i} jumps`); }
    was[i] = { chest: a.chest, kneel: a.kneel, lean: a.lean, px: a.px, pz: a.pz };
  }));
});

test('when the cup goes up everyone is on it: cameras up within 1.2 s and nobody checks a screen for 3 s', () => {
  run(40, 20, 30, (men, t) => {
    if (t > 21.2 && t < 23) for (const a of men) if (!a.moving) assert.ok(a.act === 'shoot' && a.down === 0 && (a.chest < 0.05 || (a.rises && t < 22.4)),   // (the man getting up has his down until he is on his feet)
      `man ${a.i} is not shooting ${(t - 20).toFixed(1)} s after the lift (${a.act})`);
    if (t > 20.6 && t < 23) for (const a of men) assert.notEqual(a.act, 'chimp');
  });
});

test('the kneeler gets up for the lift and goes down again; the others stay as they are', () => {
  let stood = false, back = false;
  const men = run(60, 20, 30, men => { const a = men.find(m => m.rises); if (a.kneel === 0) stood = true; if (stood && a.kneel === 1) back = true; });
  assert.ok(stood && back);
  for (const a of men) if (!a.rises) assert.equal(a.kneel, a.kind === 'kneel' ? 1 : 0);
});

test('two change places without walking into anyone, cameras down while they go', () => {
  const homes = PRESS.map(p => p.x);
  let moved = false, near = 9;
  const men = run(ACT.swapAt + 8, 99, 99, men => {
    for (const a of men) if (a.moving) { moved = true; if (a.go > 0.4 && a.go < 0.9) assert.ok(a.chest > 0.9, 'walking with the camera at his eye'); }
    for (let i = 0; i < men.length; i++) for (let j = i + 1; j < men.length; j++) near = Math.min(near, Math.hypot(men[i].px - men[j].px, men[i].pz - men[j].pz));
    for (const a of men) assert.ok(a.pz > -3.75 && a.pz < -2.3, 'off the carpet');
  });
  assert.ok(moved);
  const [a, b] = men.filter(m => m.swap !== undefined);
  assert.ok(Math.abs(a.px - homes[b.i]) < 0.02 && Math.abs(b.px - homes[a.i]) < 0.02, 'they did not end in each other\'s place');
  assert.ok(near > 0.45, `two men came within ${near.toFixed(2)} m`);
});
