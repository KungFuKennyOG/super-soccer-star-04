// Every player's own skull (game/ps2/skull.js): it only moves the head (the body and the base of the neck
// are untouched), the hair shell stays standing off the scalp it sits on, the ears move as one piece, the
// change stays within a couple of centimetres, and the neutral skull changes nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { figureGeometry } from '../../game/ps2/figure.js';
import { skullGeometry, skullOf, warpPoint, NEUTRAL } from '../../game/ps2/skull.js';
import { headPoint } from '../../game/ps2/headgeo.js';

// every setting at the end of its range at once (no man gets all of these)
const extremes = () => ({ len: 1.045, wid: 0.95, back: 1.08, slope: 0.006, brow: 0.0015, cheek: 0.0045, jaw: 1.14, chin: 0.006, drop: 0.01, nose: 1.45, bridge: 0.002, ear: 1.09 });
const shapes = [...Array.from({ length: 40 }, (_, i) => skullOf(i * 7919 + 3, (i % 5) * 0.03)), extremes()];

test('the neutral skull changes nothing', () => {
  for (let i = 0; i < 200; i++) { const p = headPoint((i / 200) * 6 - 3, (i % 17) / 17); const q = warpPoint(NEUTRAL, ...p); for (let c = 0; c < 3; c++) assert.ok(Math.abs(p[c] - q[c]) < 1e-9); }
});

test('only the head moves, by under 2.5 cm, and the base of the neck stays put', () => {
  const base = figureGeometry(2, false), a = base.attributes.position.array;
  for (const s of [...shapes.slice(0, 8), extremes()]) {
    const b = skullGeometry(base, s).attributes.position.array;
    let most = 0;
    for (let i = 0; i < a.length; i += 3) {
      const d = Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]);
      most = Math.max(most, d);
      if (a[i + 1] < 1.56) assert.ok(d < 1e-6, `a vertex at y ${a[i + 1].toFixed(3)} moved ${d}`);
    }
    assert.ok(most < 0.025 && most > 0.002, `moved at most ${most}`);
  }
});

test('hair standing off the scalp still stands off it (the shell never sinks into the skin)', () => {
  for (const s of shapes) for (let i = 0; i < 300; i++) {
    const phi = (i * 0.618 % 1) * 2 * Math.PI - Math.PI, t = 0.05 + (i * 0.377 % 1) * 0.65, off = 0.003 + (i % 4) * 0.004;
    const skin = warpPoint(s, ...headPoint(phi, t)), hair = warpPoint(s, ...headPoint(phi, t, off));
    assert.ok(Math.hypot(hair[0] - skin[0], hair[1] - skin[1], hair[2] - skin[2]) > off * 0.75);
  }
});

test('each ear moves as one piece', () => {
  const base = figureGeometry(0, false), s = extremes(), g = skullGeometry(base, s), a = base.attributes.position.array, b = g.attributes.position.array;
  for (const [from, to] of base.userData.ears) {
    const d0 = [b[from * 3] - a[from * 3], b[from * 3 + 1] - a[from * 3 + 1], b[from * 3 + 2] - a[from * 3 + 2]];
    for (let i = from; i < to; i++) {
      const d = [b[i * 3] - a[i * 3], b[i * 3 + 1] - a[i * 3 + 1], b[i * 3 + 2] - a[i * 3 + 2]];
      assert.ok(Math.hypot(d[0] - d0[0], d[1] - d0[1], d[2] - d0[2]) < 0.006);   // (sizing about the root: under 6 mm across an ear)
    }
  }
});
