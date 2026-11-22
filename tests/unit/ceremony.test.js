// The squad's recorded celebrating (game/cheercap.js): every take is a closed loop, stands on the floor, and a
// mirrored pose mirrored again is the pose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHEER, cheerPose, newPose, PART } from '../../game/cheercap.js';
import { BONES } from '../../game/assets/anim/cheer.js';
import { BONES as GAME } from '../../game/assets/anim/clips.js';

test('the takes are on the game skeleton, in its bone order', () => { assert.deepEqual(BONES, GAME); });

test('every take loops: the pose at the end is the pose at the start, and no frame jumps', () => {
  const a = newPose(), b = newPose();
  for (const [name, c] of Object.entries(CHEER)) {
    let worst = 0;
    for (let i = 0; i <= c.n; i++) {
      cheerPose(name, i / c.n * c.period, a); cheerPose(name, (i + 1) / c.n * c.period, b);
      for (let k = 0; k < BONES.length; k++) { let d = 0; for (let j = 0; j < 4; j++) d += a.q[k * 4 + j] * b.q[k * 4 + j]; worst = Math.max(worst, 2 * Math.acos(Math.min(1, Math.abs(d)))); }
      assert.ok(Math.abs(a.h[1] - b.h[1]) < 0.12, `${name}: hips jump ${Math.abs(a.h[1] - b.h[1]).toFixed(3)} m in a frame`);
    }
    assert.ok(worst < 1.2, `${name}: a bone turns ${worst.toFixed(2)} rad in one frame`);
    cheerPose(name, 0, a);
    assert.ok(a.h[1] > 0.75 && a.h[1] < 1.15, `${name}: hips at ${a.h[1].toFixed(2)} m`);
    assert.ok(Math.hypot(a.h[0], a.h[2]) < 0.3, `${name}: he stands on his spot`);
  }
});

test('a pose mirrored twice is itself, and the parts leave wrists and head alone', () => {
  const a = newPose(), m = newPose();
  cheerPose('yes', 1.3, a); cheerPose('yes', 1.3, m, true);
  const l = BONES.indexOf('upperArmL') * 4, r = BONES.indexOf('upperArmR') * 4;
  assert.ok(Math.abs(m.q[r] - a.q[l]) < 1e-6 && Math.abs(m.q[r + 1] + a.q[l + 1]) < 1e-6 && Math.abs(m.h[0] + a.h[0]) < 1e-6);
  for (const n of ['handL', 'handR', 'head', 'neck']) assert.ok(!PART.body.has(n));
});
