// The '04-look trophies (game/ps2/trophygeo.js): within the triangle budget, the size of a cup you lift
// with two hands, and what the hands close round is as thick as the hand poses expect, with room for the
// fingers behind the clubs' cup's bars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldParts, clubParts, GRIPS2, HOLD_D, HOLDS } from '../../game/ps2/trophygeo.js';
import { merge, tris } from '../../game/ps2/metal.js';

const all = parts => merge([...parts.metal, ...parts.stone, ...parts.dark]);
const verts = g => { const p = g.attributes.position, out = []; for (let i = 0; i < p.count; i++) out.push([p.getX(i), p.getY(i), p.getZ(i)]); return out; };

test('each cup is 4,000 to 8,000 triangles and the size of a real one', () => {
  for (const [parts, lo, hi] of [[worldParts(), 0.5, 0.58], [clubParts(), 0.6, 0.66]]) {
    const g = all(parts), n = tris(g) + 12;
    assert.ok(n >= 4000 && n <= 8000, `${n} triangles`);
    g.computeBoundingBox();
    assert.ok(g.boundingBox.min.y > -0.001 && g.boundingBox.max.y > lo && g.boundingBox.max.y < hi, `height ${g.boundingBox.max.y}`);
  }
});

test("the nations' cup: a round grip 6.6 cm across where the palms go", () => {
  const v = verts(all(worldParts())), [, y] = GRIPS2.world[0];
  const near = v.filter(p => Math.abs(p[1] - y) < 0.035);
  const r = Math.max(...near.map(p => Math.hypot(p[0], p[2])));
  assert.ok(Math.abs(2 * r - HOLD_D.world) < 0.004, `grip ${(2 * r * 100).toFixed(1)} cm across`);
});

test("the clubs' cup: each hand-hold is on a round vertical bar 3.2 cm thick, 4 cm or more out from the body", () => {
  const v = verts(all(clubParts()));
  for (const [x, y] of GRIPS2.club) {
    const bar = v.filter(p => Math.abs(p[1] - y) < 0.07 && Math.sign(p[0]) === Math.sign(x) && Math.abs(p[0]) > 0.16);
    const xs = bar.map(p => Math.abs(p[0]));
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - HOLD_D.club) < 0.003, `bar ${((Math.max(...xs) - Math.min(...xs)) * 100).toFixed(1)} cm`);
    assert.ok(Math.abs((Math.max(...xs) + Math.min(...xs)) / 2 - Math.abs(x)) < 0.002, 'bar through the hand-hold');
    const zs = bar.map(p => p[2]);
    assert.ok(Math.abs(Math.max(...zs) - Math.min(...zs) - HOLD_D.club) < 0.003, 'round, not oval');
    const body = v.filter(p => Math.abs(p[1] - y) < 0.05 && Math.abs(p[0]) < 0.16).map(p => Math.hypot(p[0], p[2]));
    assert.ok(Math.abs(x) - HOLD_D.club / 2 - Math.max(...body) >= 0.04, `room behind the bar ${((Math.abs(x) - HOLD_D.club / 2 - Math.max(...body)) * 100).toFixed(1)} cm`);
  }
});

test('every hand-hold says where, which way and how thick, inside what the hands are tested on (3.2 to 6.6 cm)', () => {
  for (const k of ['world', 'club']) for (const h of HOLDS[k]) {
    assert.equal(h.at.length, 3); assert.deepEqual(h.axis, [0, 1, 0]);
    assert.ok(h.d >= 0.032 && h.d <= 0.066, `${k} ${h.d}`);
  }
});
