// The crowd (game/ps2/fans.js) laid out on every ground's stands as game/ps2/ground.js lays it: every
// fan is on his own tier, nobody sits in a stairway or on someone else's seat, the flags are held by
// standing fans in the ends, a few and spread out, and the whole bowl stays inside the budget. Also:
// the banners carry generic words only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUNDS } from '../../game/grounds.js';
import { planGround } from '../../game/ps2/groundplan.js';
import { straightRun, cornerRun } from '../../game/ps2/ground.js';
import { Crowd } from '../../game/ps2/fans.js';
import { BANNER_WORDS } from '../../game/ps2/groundtex.js';

// the stands as ground.js gives them to the crowd: the end's lower tier has the curva (band 1) and
// the away block (band 2) unless it's a kop, whose away fans go in the stand behind you
function lay(recipe) {
  const plan = planGround(recipe), cr = new Crowd(['#c8102e', '#ffffff'], ['#1d3f94', '#f0c020'], 0.75, true, 7), tiers = [];
  const T = s => s + 0.5, { curva, block } = plan;
  const add = (run, p, bands, id) => p.tiers.forEach((t, i) => {
    const tier = i === 0 ? { ...t, z0: -0.4, i } : { ...t, z0: t.z0 - 0.4, i };
    const roofFront = p.roof ? Math.max(p.roof.zFront, p.tiers[p.tiers.length - 1].z1) : null;
    for (const [t0, t1, band, ultra] of bands(i)) { const n0 = cr.fans.length; cr.strip(run, t0, t1, tier, band, ultra, roofFront); tiers.push({ id, run, tier, from: n0, to: cr.fans.length, band, ultra }); }
  });
  for (const s of plan.stands) {
    const run = straightRun(s.x, s.z, s.yaw, s.len);
    const endBands = i => i > 0 ? [[0, 1, 0, 0]] : block.on === 'end' ? [[0, T(curva.from), 0, 0], [T(curva.from), T(curva.to), 1, 1], [T(curva.to), T(block.from), 0, 0], [T(block.from), 1, 2, 1]] : [[0, T(curva.from), 0, 0], [T(curva.from), T(curva.to), 1, 1], [T(curva.to), 1, 0, 0]];
    add(run, s.p, s.isEnd ? endBands : () => [[0, 1, 0, 0]], s.id);
  }
  for (const c of plan.corners) if (!c.block) add(cornerRun(c.x, c.z, c.a0, c.a1), c.p, () => [[0, 1, 0, 0]], c.id);
  return { cr, tiers, flags: cr.flags() };
}
const grounds = Object.entries(GROUNDS).map(([id, r]) => [id, lay(r)]);

test('every fan is on his own tier: between its front and back, on its slope', () => {
  for (const [id, { cr, tiers }] of grounds) for (const { run, tier, from, to } of tiers) {
    if (!run.f) continue;                                           // straight stands (corners are swept the same way)
    const o = run.f(0, 0, 0), b = run.f(0, 0, 1).sub(o);
    for (const f of cr.fans.slice(from, to)) {
      const lz = (f.p.x - o.x) * b.x + (f.p.z - o.z) * b.z, k = (lz - tier.z0) / (tier.z1 - tier.z0);
      assert.ok(k > 0 && k < 1.02, `${id}: a fan off his tier (${k.toFixed(2)} of its depth)`);
      assert.ok(Math.abs(f.p.y - (tier.y0 + (tier.y1 - tier.y0) * k)) < 0.01, `${id}: a fan off the slope`);
    }
  }
});

test('nobody on someone else\'s seat: fans in a row are at least 0.3 m apart', () => {
  for (const [id, { cr, tiers }] of grounds) for (const { from, to } of tiers) {
    const row = cr.fans.slice(from, to);
    const byRow = new Map();
    for (const f of row) { const k = Math.round(f.k * 1000); if (!byRow.has(k)) byRow.set(k, []); byRow.get(k).push(f); }
    let close = 0, n = 0;
    for (const fs of byRow.values()) for (let i = 1; i < fs.length; i++) { n++; if (fs[i].p.distanceTo(fs[i - 1].p) < 0.3) close++; }
    assert.ok(close <= n * 0.002, `${id}: ${close} of ${n} neighbours under 0.3 m`);
  }
});

test('the stairways are kept clear in ordinary stands; ends that stand are packed tighter', () => {
  for (const [id, { cr, tiers }] of grounds) {
    let ord = 0, ordLen = 0, packed = 0, packedLen = 0;
    for (const { run, tier, from, to, band, ultra } of tiers) {
      const fans = cr.fans.slice(from, to), nA = Math.max(2, Math.round(run.at(0) / 15));
      if (!fans.length) continue;
      const ts = fans.map(f => f.t), len = (Math.max(...ts) - Math.min(...ts)) * run.at((tier.z0 + tier.z1) / 2) * tier.rows;
      if (ultra && band > 0) { packed += fans.length; packedLen += len; continue; }
      ord += fans.length; ordLen += len;
      for (const f of fans) {
        const z = tier.z0 + (tier.z1 - tier.z0) * f.k, seats = Math.abs(f.t * nA - Math.round(f.t * nA)) * run.at(z) / 0.52 / nA;
        assert.ok(seats > 0.5, `${id}: a fan ${seats.toFixed(2)} seats from a stairway's middle`);
      }
    }
    if (packedLen) assert.ok(packed / packedLen > 1.1 * ord / ordLen, `${id}: standing ${(packed / packedLen).toFixed(2)} a metre of row, seated ${(ord / ordLen).toFixed(2)}`);
  }
});

test('flags: held by standing fans in the ends, a few and spread out, one or two big ones', () => {
  for (const [id, { flags }] of grounds) {
    assert.ok(flags.length >= 3 && flags.length <= 20, `${id}: ${flags.length} flags`);
    const big = flags.filter(f => f.big).length;
    assert.ok(big >= 1 && big <= 3, `${id}: ${big} big flags`);
    for (const f of flags) assert.ok(f.f.role >= 3 && f.f.band > 0, `${id}: a flag held by someone not in an end`);
    for (let i = 0; i < flags.length; i++) for (let j = 0; j < i; j++) assert.ok(flags[i].p.distanceTo(flags[j].p) >= 3.2, `${id}: two flags closer than 3.2 m`);
  }
});

test('budget: no ground has more than 30,000 fans (60,000 triangles, one draw)', () => {
  for (const [id, { cr }] of grounds) assert.ok(cr.fans.length > 4000 && cr.fans.length < 30000, `${id}: ${cr.fans.length} fans`);
});

test('banners carry generic words only', () => {
  for (const w of BANNER_WORDS) assert.ok(!/ALONE|WALK|YNWA/.test(w), w);
});

test('team colours: the shirt colour dominates, white only where the kit is white, few neutral jackets', async () => {
  const { sideWear } = await import('../../game/ps2/fans.js');
  const { byId } = await import('../../rules/teams.js');
  const kitCols = id => { const k = byId(id).kit; return [k.shirt, k.alt, k.shorts, k.trim, '#f2f1ea']; };
  for (const id of ['MRB', 'LIV', 'DOR', 'BAR', 'BRA', 'GER', 'ENG', 'MAD', 'ITA']) {
    const w = sideWear(kitCols(id)), k = byId(id).kit, white = c => c.toLowerCase() === '#f2f1ea';
    assert.equal(w.cols[w.top[0][0]], k.shirt, `${id}: the shirt colour is worn most`);
    assert.ok(w.top[0][1] >= 0.5, id);
    if (!white(k.shirt)) for (const [i] of w.top) assert.ok(!white(w.cols[i]), `${id}: nobody in a white top when the shirt isn't white`);
    if (white(k.shirt)) assert.ok(w.top.some(([i, wt]) => !white(w.cols[i]) && wt > 0.3), `${id}: a white side leans on its other colours`);
  }
  // in the laid-out crowds: neutral jackets (palette 8..) about 5% of ordinary stands, none in the ends
  for (const [id, { cr }] of grounds) {
    const ord = cr.fans.filter(f => f.band === 0);
    const n = ord.filter(f => f.col[0] >= 8).length / ord.length;
    assert.ok(n > 0.02 && n < 0.08, `${id}: ${(n * 100).toFixed(1)}% neutral in ordinary stands`);
    assert.equal(cr.fans.filter(f => f.band > 0 && f.col[0] >= 8).length, 0, `${id}: no neutral jackets in the curva or the away block`);
  }
});
