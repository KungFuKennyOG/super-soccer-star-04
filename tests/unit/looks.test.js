import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TONES, HAIRS, STYLES, GROUPS, LOOKS, DEFAULT_LOOKS, looksOf, stratify, pickSquad, rng, toneWeights, stylePS1, STYLE_PS2 } from '../../rules/looks.js';
import { ALL } from '../../rules/teams.js';

const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

test('every team has looks; weights name real groups and add to 1', () => {
  for (const t of ALL) assert.ok(LOOKS[t.id], t.id);
  assert.equal(Object.keys(LOOKS).length, ALL.length);
  for (const [id, w] of [...Object.entries(LOOKS), ['default', DEFAULT_LOOKS]]) {
    for (const g of Object.keys(w)) assert.ok(GROUPS[g], `${id}: ${g}`);
    assert.ok(Math.abs(sum(w) - 1) < 1e-9, `${id} sums to ${sum(w)}`);
  }
  assert.equal(looksOf('XXX'), DEFAULT_LOOKS);
});

test('groups point at real tones, hair colors and styles', () => {
  for (const [n, g] of Object.entries(GROUPS)) {
    for (const k of Object.keys(g.tone)) assert.ok(TONES[+k], n);
    for (const k of Object.keys(g.hair)) assert.ok(HAIRS[+k], n);
    for (const k of Object.keys(g.style)) assert.ok(STYLES.includes(k), n);
    for (const s of STYLES) { assert.ok(Number.isInteger(STYLE_PS2[s])); assert.ok(Number.isInteger(stylePS1(s, 3))); }
    for (const tab of [g.tone, g.hair, g.style]) assert.ok(Math.abs(sum(tab) - 1) < 1e-9, n);
  }
  for (const c of [...TONES, ...HAIRS]) assert.match(c, /^#[0-9a-f]{6}$/);
  const lum = c => parseInt(c.slice(1, 3), 16) * 0.3 + parseInt(c.slice(3, 5), 16) * 0.59 + parseInt(c.slice(5, 7), 16) * 0.11;
  assert.ok(lum(TONES[0]) <= lum('#efc8a8'), 'the fairest tone stays under the blow-out limit');
});

test('stratified: each group gets floor or ceil of its share, every time', () => {
  const w = { a: 0.9, b: 0.1 };
  for (let s = 0; s < 500; s++) {
    const out = stratify(w, 4, rng(s)), nb = out.filter(x => x === 'b').length;
    assert.ok(nb <= 1, 'never 2 of 4 from the 10%');
  }
  const w3 = { a: 0.5, b: 0.3, c: 0.2 };
  for (let s = 0; s < 300; s++) {
    const out = stratify(w3, 7, rng(s));
    assert.equal(out.length, 7);
    for (const [k, v] of Object.entries(w3)) { const n = out.filter(x => x === k).length; assert.ok(n >= Math.floor(v * 7) && n <= Math.ceil(v * 7), `${k}: ${n}`); }
  }
  // over many draws the shares match the weights
  let nb = 0; for (let s = 0; s < 4000; s++) nb += stratify(w, 4, rng(s)).filter(x => x === 'b').length;
  assert.ok(Math.abs(nb / 16000 - 0.1) < 0.01, nb / 16000);
});

test('pickSquad is deterministic in its seed and varies between seeds', () => {
  const keys = [3, 5, 4, 1];
  assert.deepEqual(pickSquad('NED', keys, 42), pickSquad('NED', keys, 42));
  const seen = new Set();
  for (let s = 0; s < 20; s++) seen.add(JSON.stringify(pickSquad('NED', keys, s)));
  assert.ok(seen.size > 15);
  const sq = pickSquad('JPN', keys, 7);
  assert.deepEqual(Object.keys(sq).map(Number).sort(), [...keys].sort());
});

test('teams differ the way their weights say', () => {
  const dark = id => { const t = toneWeights(id); return t[6] + t[7] + t[8]; };
  const asian = id => { const t = toneWeights(id); return t[3] + t[9]; };
  for (const id of ['NGA', 'CMR', 'SEN', 'GHA']) assert.ok(dark(id) > 0.99, id);
  for (const id of ['JPN', 'KOR']) assert.ok(asian(id) > 0.95, id);
  for (const id of ['SWE', 'DEN', 'NOR', 'ITA', 'CRO', 'KOR']) assert.ok(dark(id) < 0.06, id);
  assert.ok(dark('FRA') > dark('ENG') && dark('ENG') > dark('GER'));
  // over a season of matches, a 4-man Nigerian side is never anything but brown-to-deep, a Korean one never fair-rosy
  for (let s = 0; s < 200; s++) {
    for (const l of Object.values(pickSquad('NGA', [3, 5, 4, 1], s))) assert.ok(l.tone >= 6 && l.tone <= 8);
    for (const l of Object.values(pickSquad('KOR', [3, 5, 4, 1], s))) assert.ok(l.tone === 3 || l.tone === 9);
  }
});
