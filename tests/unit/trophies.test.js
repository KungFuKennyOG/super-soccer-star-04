// The '04-look trophies (game/ps2/trophygeo.js): within the triangle budget, the size of a cup you lift
// with two hands, and what the hands close round is where, as thick and as round as the hand poses
// expect, with room for the fingers behind the clubs' cup's handles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldParts, clubParts, GRIPS2, HOLD_D, HOLDS, bowlR } from '../../game/ps2/trophygeo.js';
import { worldSketch, clubSketch } from '../../game/ps2/trophysketch.js';
import { merge, tris, smooth, revolve } from '../../game/ps2/metal.js';

const all = parts => merge([...parts.metal, ...parts.stone, ...parts.engraved]);
const verts = g => { const p = g.attributes.position, out = []; for (let i = 0; i < p.count; i++) out.push([p.getX(i), p.getY(i), p.getZ(i)]); return out; };

test('each cup is 4,000 to 7,000 triangles and the size of a real one', () => {
  for (const [parts, lo, hi] of [[worldParts(), 0.58, 0.66], [clubParts(), 0.68, 0.76]]) {
    const g = all(parts), n = tris(g);
    assert.ok(n >= 4000 && n <= 7000, `${n} triangles`);
    g.computeBoundingBox();
    assert.ok(g.boundingBox.min.y > -0.001 && g.boundingBox.max.y > lo && g.boundingBox.max.y < hi, `height ${g.boundingBox.max.y}`);
    for (const v of g.attributes.position.array) assert.ok(Number.isFinite(v));
    for (const v of g.attributes.normal.array) assert.ok(Number.isFinite(v));
  }
});

test("the nations' cup: a round waist 6 cm across where the hands go, nothing in their way", () => {
  const v = verts(all(worldParts())), [, y] = GRIPS2.world[0];
  const r = v.filter(p => Math.abs(p[1] - y) < 0.03).map(p => Math.hypot(p[0], p[2]));
  assert.ok(Math.abs(2 * Math.max(...r) - HOLD_D.world) < 0.003, `waist ${(2 * Math.max(...r) * 100).toFixed(1)} cm across`);
  assert.ok(Math.max(...r) - Math.min(...r) < 0.0015, 'round');
  const fist = v.filter(p => Math.abs(p[1] - y) < 0.045).map(p => Math.hypot(p[0], p[2]));       // a fist is about 9 cm tall
  assert.ok(Math.max(...fist) < HOLD_D.world / 2 + 0.006, `the waist swells ${((Math.max(...fist) - HOLD_D.world / 2) * 1000).toFixed(1)} mm inside the fist`);
});

test("the clubs' cup: each hand-hold is on an upright round run of the handle 3.2 cm thick, 4 cm or more out from the bowl", () => {
  const v = verts(all(clubParts()));
  for (const [x, y] of GRIPS2.club) {
    const bar = v.filter(p => Math.abs(p[1] - y) < 0.04 && Math.sign(p[0]) === Math.sign(x) && Math.abs(p[0]) > 0.14);
    const xs = bar.map(p => Math.abs(p[0])), zs = bar.map(p => p[2]);
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - HOLD_D.club) < 0.003, `handle ${((Math.max(...xs) - Math.min(...xs)) * 100).toFixed(1)} cm`);
    assert.ok(Math.abs((Math.max(...xs) + Math.min(...xs)) / 2 - Math.abs(x)) < 0.002, 'the handle runs through the hand-hold, upright');
    assert.ok(Math.abs(Math.max(...zs) - Math.min(...zs) - HOLD_D.club) < 0.004, 'round, not oval');
    for (const dy of [-0.045, 0, 0.045]) assert.ok(Math.abs(x) - HOLD_D.club / 2 - bowlR(y + dy) >= 0.04, `room behind the handle ${((Math.abs(x) - HOLD_D.club / 2 - bowlR(y + dy)) * 100).toFixed(1)} cm`);
  }
});

test('every hand-hold says where, which way and how thick, inside what the hands are tested on (3.2 to 6.6 cm)', () => {
  for (const k of ['world', 'club']) {
    assert.equal(HOLDS[k].length, 2);
    assert.ok(HOLDS[k][0].at[0] > 0 && HOLDS[k][1].at[0] < 0, 'index 0 is your left hand (+x)');
    for (const h of HOLDS[k]) {
      assert.equal(h.at.length, 3); assert.deepEqual(h.axis, [0, 1, 0]);
      assert.ok(h.d >= 0.032 && h.d <= 0.066, `${k} ${h.d}`);
    }
  }
});

test('the sketches build, and the helpers keep corners and bake shade', () => {
  for (const g of [worldSketch('wings'), worldSketch('comet'), clubSketch('tulip'), clubSketch('amphora')]) assert.ok(tris(all(g)) > 1000);
  const p = smooth([[0, 0], [1, 0, 1], [1, 1], [0.5, 2]], 4);
  assert.ok(p.some(q => q[0] === 1 && q[1] === 0 && q[2] === 1), 'the hard key is still there, and hard');
  assert.ok(p.every(q => q[0] <= 1.2));
  const m = merge([revolve([[0, 0], [1, 0], [1, 1]], 6, { ao: 0.5 }), revolve([[0, 2], [1, 2], [1, 3]], 6)]);
  assert.equal(m.attributes.color.getX(0), 0.5); assert.equal(m.attributes.color.getX(m.attributes.color.count - 1), 1);
});
