// The '04-look grounds' layout (game/ps2/groundplan.js), worked out from every recipe in game/grounds.js:
// nothing stands on the pitch or the ad boards, the gable outline can be filled as a fan, the scoreboard
// hangs where the PS1 ground hangs it, and the extras (pylons, towers, track) are where they belong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUNDS } from '../../game/grounds.js';
import { planGround, profile, gable, FRONT } from '../../game/ps2/groundplan.js';
import { GOAL, PITCH } from '../../rules/tuning.js';

const all = Object.entries(GROUNDS);

test('every ground: the stands stand back from the pitch and the ad boards', () => {
  for (const [id, r] of all) {
    const p = planGround(r);
    assert.ok(p.endZ < p.boards.z - 0.1, `${id}: end stand ${p.endZ} behind the boards ${p.boards.z}`);
    assert.ok(p.sideX > p.boards.x + 0.1, `${id}: side stands outside the boards`);
    assert.ok(p.endZ < GOAL.z - GOAL.depth - 1, `${id}: room behind the net`);
    assert.ok(p.sideX > PITCH.halfW + 1.5 && p.nearZ > 3, id);
    assert.equal(p.stands.length, 4);
    assert.equal(p.corners.length, r.corners ? 4 : 0, id);
  }
});

test('every tier has whole rows and every profile rises as it goes back (so a fan fills the gable)', () => {
  for (const [id, r] of all) for (const tiers of [r.end, r.side, r.near]) {
    const pr = profile(tiers, r.roof);
    for (const t of pr.tiers) { assert.ok(t.rows >= 1 && t.y1 > t.y0 && t.z1 < t.z0, id); }
    const g = gable(pr);
    assert.deepEqual(g[0], [0, 0]); assert.deepEqual(g[1], [0, FRONT]);
    for (let i = 2; i < g.length - 1; i++) {
      assert.ok(g[i][0] <= g[i - 1][0] + 1e-9, `${id}: z goes back at ${i}`);
      assert.ok(g[i][1] >= g[i - 1][1] - 1e-9, `${id}: y never falls at ${i}`);
    }
    if (pr.roof) { assert.ok(pr.roof.y > pr.top && pr.roof.zFront > pr.roof.zBack, id); }
  }
});

test('the scoreboard hangs where game/grounds.js hangs it', () => {
  for (const [id, r] of all) {
    const p = planGround(r), e = p.stands[0].p;
    // grounds.js: under the end roof's edge (top + 3.7 - 4.2, at its front + 0.6), or over an open end's back
    let want;
    if (r.roof !== 'none') { const span = r.roof === 'full' ? e.depth + 2 : e.depth * 0.55; want = { y: e.top - 0.5, z: p.endZ - (e.depth + 0.6) + span + 0.6 }; }
    else want = { y: e.top + 7, z: p.endZ - e.depth - 1 };
    assert.ok(Math.abs(p.board.y - want.y) < 1e-9 && Math.abs(p.board.z - want.z) < 1e-9, `${id}: ${JSON.stringify(p.board)} vs ${JSON.stringify(want)}`);
  }
});

test('pylons and towers stand outside the stands, a track between them and the pitch', () => {
  for (const [id, r] of all) {
    const p = planGround(r);
    assert.equal(p.lights.pylons.length, r.lights === 'pylons' ? 4 : 0, id);
    for (const q of [...p.lights.pylons, ...p.towers]) assert.ok(Math.abs(q.x) > p.sideX + 5 && (q.z < p.endZ - 5 || q.z > p.nearZ + 5), `${id}: ${q.x}, ${q.z}`);
    if (r.track) {
      const t = p.track;
      assert.ok(t.inX > PITCH.halfW + 1.6 && t.outX <= p.sideX && t.inZ0 < GOAL.z - GOAL.depth && t.outZ0 >= p.endZ, id);
    } else assert.equal(p.track, null);
  }
});
