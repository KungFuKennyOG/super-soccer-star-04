// Where the celebration prompt goes in your view (game/hudslot.js): never on the banner, the subtitle or the bug.
import test from 'node:test';
import assert from 'node:assert/strict';
import { slot, overlap } from '../../game/hudslot.js';

// what the headset shows, in degrees (measured in the real game by tools/promptshots.mjs)
const SUB = { y0: -24.1, y1: 24.1, e0: -13.1, e1: -7.2 }, BUG = { y0: -36, y1: -13, e0: 15, e1: 23 };
const banner = pitch => { const c = Math.max(-20, Math.min(6.9, pitch)) + 5.7 - pitch; return { y0: -23.1, y1: 23.1, e0: c - 7.8, e1: c + 7.8 }; };
const W = 22, H = 16.8, rectOf = s => ({ y0: s.yaw - W / 2, y1: s.yaw + W / 2, e0: s.top - H, e1: s.top });

test('alone it sits just under the middle of the view', () => {
  const s = slot([], W, H);
  assert.deepEqual([s.yaw, s.top, s.ok], [0, -3, true]);
});

test('it goes under the subtitle, and under the banner when that is lower', () => {
  const s = slot([SUB, banner(0), BUG], W, H, { gap: 2.5 });
  assert.equal(s.yaw, 0); assert.ok(Math.abs(s.top - (SUB.e0 - 2.5)) < 1e-9);
});

test('whatever way you look it touches nothing, and stays in view', () => {
  for (let pitch = -80; pitch <= 80; pitch += 1) for (const withSub of [true, false]) for (const yawOff of [-12, 0, 12]) {
    const b = banner(pitch); b.y0 += yawOff; b.y1 += yawOff;                       // (the banner trails your head as you turn)
    const rects = [b, BUG, ...(withSub ? [SUB] : [])], s = slot(rects, W, H, { gap: 2.5, low: -44, side: 50 });
    assert.ok(s.ok, `no room looking ${pitch} deg`);
    const r = rectOf(s);
    for (const o of rects) assert.ok(!overlap(r, o), `covers something looking ${pitch} deg (${JSON.stringify(s)})`);
    assert.ok(r.e0 >= -44 && Math.abs(s.yaw) + W / 2 <= 50, `out of view looking ${pitch} deg`);
  }
});

test('with no room anywhere it says so', () => {
  assert.equal(slot([{ y0: -60, y1: 60, e0: -60, e1: 60 }], W, H).ok, false);
});
