// The brawl's favours (rules/brawl/chaos.js): earned by playing, called in by the side that holds one,
// announced before they can touch anyone, the same for both sides; the crowd throwing a man back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrawl, side } from '../../rules/brawl/world.js';
import { stepBrawl } from '../../rules/brawl/sim.js';
import { createChaos, stepChaos, FAVOURS } from '../../rules/brawl/chaos.js';
import { launch, stepHits, startLunge } from '../../rules/brawl/hits.js';
import { CHAOS } from '../../rules/brawl/tuning.js';
import { rng } from '../../rules/looks.js';

// everyone but these lies down out of the way for the length of the test
const park = (w, keep) => { for (const p of w.players) if (!keep.includes(p) && p.line !== 'gk') { p.x = 22; p.z = 20 + p.slot * 2 * (p.team === 'home' ? 1 : -1); p.state = 'down'; p.downT = 99; } };
const toPlay = w => { while (w.phase !== 'play') stepBrawl(w, {}, 1 / 60); };
const hold = (w, team, item) => { const c = w.cx || createChaos(w); c.fav[team].item = item; c.fav[team].ai = 99; return c; };

test('nothing happens by itself: by the book has no favours; in the brawl nothing lands unless a side calls it', () => {
  const book = createBrawl({ n: 6 });
  for (let i = 0; i < 60 * 30; i++) for (const e of stepBrawl(book, { auto: true }, 1 / 60)) assert.ok(e.type !== 'chaos' && e.type !== 'favour');
  // you hold one and never press: it stays held and nothing of yours starts
  const w = createBrawl({ n: 6, chaos: 1 }); toPlay(w);
  hold(w, 'home', 'drop');
  const ev = [];
  for (let i = 0; i < 60 * 8; i++) ev.push(...stepBrawl(w, {}, 1 / 60));
  assert.equal(w.cx.fav.home.item, 'drop');
  assert.ok(!ev.some(e => e.type === 'chaos' && e.team === 'home'));
});

test('you call it: every favour is announced CHAOS.warn before it can touch anyone, and the favour is spent', () => {
  for (const item of FAVOURS) {
    const w = createBrawl({ n: 6, chaos: 1 }); toPlay(w);
    hold(w, 'home', item); w.cx.fav.away.m = -99;
    const first = stepBrawl(w, { call: true }, 1 / 60);
    assert.ok(first.some(e => e.type === 'chaos' && e.what === item && e.stage === 'warn' && e.team === 'home'), item);
    assert.equal(w.cx.fav.home.item, null);
    const t0 = w.t; let hitAt = null;
    for (let i = 0; i < 60 * 14 && hitAt === null; i++) for (const e of stepBrawl(w, {}, 1 / 60)) {
      if ((e.type === 'chaos' && e.stage === 'hit') || (e.type === 'launch' && ['drop', 'buggy', 'invader', 'ref'].includes(e.kind))) hitAt = w.t;
    }
    if (hitAt !== null) assert.ok(hitAt - t0 >= CHAOS.warn - 0.7, `${item}: ${(hitAt - t0).toFixed(2)} s of warning`);
  }
});

test('drops keep clear of the goalmouths and flatten whoever stands there, either side', () => {
  const w = createBrawl({ n: 6, chaos: 1 }); toPlay(w);
  const c = hold(w, 'home', 'drop'); c.fav.away.m = -99;
  const foe = side(w, 'away').find(p => p.line === 'gk');
  w.owner = null; Object.assign(w.ball, { x: 0, z: foe.z, vx: 0, vz: 0 });
  stepChaos(w, 1 / 60, [], rng(1), { call: true });
  assert.equal(c.drops.length, 3);
  for (const d of c.drops) assert.ok(Math.abs(d.z) <= w.L - CHAOS.keepOff + 1e-9);
  // stand one of each side on the first one
  const d = c.drops[0], a = w.byId.h1, b = w.byId.a1, ev = [];
  for (const p of w.players) { p.x = 20; p.z = 0; }
  a.x = d.x + 0.5; a.z = d.z; b.x = d.x - 0.5; b.z = d.z;
  for (let i = 0; i < 60 * 3; i++) { for (const p of [a, b]) if (p.state === 'up' && d.t > 0) { p.vx = p.vz = 0; } stepChaos(w, 1 / 60, ev, rng(2), {}); if (d.t > 0) { a.x = d.x + 0.5; b.x = d.x - 0.5; a.z = b.z = d.z; } }
  assert.ok(ev.some(e => e.type === 'launch' && e.id === a.id && e.kind === 'drop'));
  assert.ok(ev.some(e => e.type === 'launch' && e.id === b.id && e.kind === 'drop'));
});

test('a supporter goes for the other side only, and one of their tackles removes him', () => {
  const w = createBrawl({ n: 6, chaos: 1 }); toPlay(w);
  const c = hold(w, 'home', 'invader'); c.fav.away.m = -99;
  const ev = [...stepBrawl(w, { call: true }, 1 / 60)];
  const m = c.mob.find(q => q.state === 'up');
  assert.equal(m.side, 'home');
  for (let i = 0; i < 60 * 12; i++) ev.push(...stepBrawl(w, { auto: true }, 1 / 60));
  for (const e of ev) if (e.type === 'launch' && e.kind === 'invader') assert.equal(w.byId[e.id].team, 'away');
});

test('the heavy ball only flattens the other side, off the boot of the side that called it', () => {
  const w = createBrawl({ n: 6, chaos: 1 }); toPlay(w);
  const c = createChaos(w); c.heavy = 10; c.heavyTeam = 'home';
  const shoot = (from, at) => {
    for (const p of w.players) { p.x = 22; p.z = 20 + p.slot; p.state = 'up'; p.noBall = 0; }
    at.x = 0; at.z = 0; w.owner = null; w.lastTeam = from; w.phase = 'play';
    Object.assign(w.ball, { x: 0, y: 0.3, z: 4, vx: 0, vy: 0, vz: -15, inNet: 0 });
    const ev = []; for (let i = 0; i < 40; i++) ev.push(...stepBrawl(w, {}, 1 / 60));
    return ev.some(e => e.type === 'launch' && e.kind === 'shot' && e.id === at.id);
  };
  assert.equal(shoot('home', w.byId.a2), true);
  assert.equal(shoot('away', w.byId.h2), false);
  assert.equal(shoot('home', w.byId.h2), false);
});

test('over the boards at speed: into the crowd, and thrown back on a moment later', () => {
  const w = createBrawl({ n: 6, chaos: 1 }), p = w.byId.h2, ev = [];
  w.phase = 'play'; p.x = w.W - 1; p.z = 0;
  launch(w, p, 18, 0, 5, null, ev);
  for (let i = 0; i < 60 * 8; i++) stepHits(w, 1 / 60, ev, rng(3));
  assert.ok(ev.some(e => e.type === 'crowd' && e.id === p.id));
  assert.ok(ev.some(e => e.type === 'launch' && e.kind === 'thrown' && e.id === p.id));
  assert.ok(p.state === 'up' && Math.abs(p.x) <= w.W + 3.01, `${p.state} at ${p.x}`);
});

test('fair over whole matches: both sides earn and call about the same, and matches still finish', () => {
  const used = { home: 0, away: 0 }, r = rng(11);
  for (let k = 0; k < 6; k++) {
    const w = createBrawl({ n: 6, chaos: 1, real: 120 }); let s = 0;
    while (w.phase !== 'full' && s++ < 60 * 400) stepBrawl(w, { auto: true }, 1 / 60, r);
    assert.equal(w.phase, 'full');
    used.home += w.cx.fav.home.used; used.away += w.cx.fav.away.used;
  }
  assert.ok(used.home > 6 && used.away > 6, JSON.stringify(used));
  assert.ok(Math.abs(used.home - used.away) / (used.home + used.away) < 0.3, JSON.stringify(used));
});

test('a super shot: a full bar with a favour in hand spends it, and the shot goes through their men', () => {
  const w = createBrawl({ n: 6, chaos: 1 }); toPlay(w);
  const c = hold(w, 'home', 'buggy'); c.fav.away.m = -99;
  const you = w.byId[w.ctrl], foe = side(w, 'away').find(p => p.line === 'def');
  park(w, [you, foe]);
  you.x = 0; you.z = -6; foe.x = 0; foe.z = -12; foe.stun = 9; foe.cool = 9;
  const ev = [];
  for (let i = 0; i < 58; i++) { you.x = 0; you.z = -6; you.vx = you.vz = 0; ev.push(...stepBrawl(w, { move: { x: 0, z: 0 }, shoot: true }, 1 / 60)); }
  ev.push(...stepBrawl(w, { move: { x: 0, z: 0 } }, 1 / 60));
  assert.ok(ev.some(e => e.type === 'super' && e.id === you.id), 'a super shot');
  assert.equal(c.fav.home.item, null, 'the favour is spent');
  for (let i = 0; i < 40; i++) ev.push(...stepBrawl(w, {}, 1 / 60));
  assert.ok(ev.some(e => e.type === 'launch' && e.id === foe.id && e.kind === 'shot'), 'through their man');
  // without a favour the same shot is just a shot
  const w2 = createBrawl({ n: 6, chaos: 1 }); toPlay(w2); createChaos(w2); park(w2, [w2.byId[w2.ctrl]]);
  const ev2 = [];
  for (let i = 0; i < 58; i++) ev2.push(...stepBrawl(w2, { shoot: true, move: { x: 0, z: 0 } }, 1 / 60));
  ev2.push(...stepBrawl(w2, { move: { x: 0, z: 0 } }, 1 / 60));
  assert.ok(ev2.some(e => e.type === 'shot') && !ev2.some(e => e.type === 'super'));
});

test('a dodge: the tackle goes past, the tackler ends up on the floor, the dodger gets a burst', () => {
  const w = createBrawl({ n: 6, chaos: 1 }); toPlay(w);
  const you = w.byId[w.ctrl], foe = side(w, 'away').find(p => p.line !== 'gk');
  park(w, [you, foe]);
  foe.x = you.x; foe.z = you.z - 1.6;
  startLunge(foe, { x: 0, z: 1 }, true);
  const ev = [...stepBrawl(w, { dodge: true, move: { x: 1, z: 0 } }, 1 / 60)];
  for (let i = 0; i < 40; i++) ev.push(...stepBrawl(w, { move: { x: 1, z: 0 } }, 1 / 60));
  assert.ok(ev.some(e => e.type === 'dodged' && e.id === you.id));
  assert.ok(!ev.some(e => e.type === 'launch' && e.id === you.id));
  assert.ok(ev.some(e => e.type === 'miss' && e.id === foe.id));
  assert.ok(you.boost > 0);
});

test('after the whistle: you can still flatten someone while a goal is celebrated, and it feeds their meter', () => {
  const w = createBrawl({ n: 6, chaos: 1 }); toPlay(w); createChaos(w);
  w.phase = 'goal'; w.phaseT = 3; w.scorers = 'away'; w.scorer = 'a5'; w.late = null;
  const you = w.byId[w.ctrl], sc = w.byId.a5;
  sc.x = you.x; sc.z = you.z - 1.3; sc.state = 'up';
  const before = w.cx.fav.away.m, ev = [];
  for (let i = 0; i < 20; i++) ev.push(...stepBrawl(w, { tackle: i === 0, sprint: true, move: { x: 0, z: -1 } }, 1 / 60));
  assert.ok(ev.some(e => e.type === 'launch' && e.id === sc.id));
  assert.ok(w.cx.fav.away.m > before + 0.15);
});

test('the referee can be flattened: it stops him coming for your man, and he gets up again', () => {
  const w = createBrawl({ n: 6, chaos: 1 }); toPlay(w);
  const c = hold(w, 'away', 'ref'); c.fav.away.ai = 0; c.fav.home.m = -99;
  const ev = [...stepBrawl(w, {}, 1 / 60)];
  assert.ok(w.ref.rage, 'he is coming');
  const you = w.byId[w.ctrl], r = w.ref;
  park(w, [you]); w.owner = null; w.ball.x = 20; w.ball.z = -20;
  you.x = r.x; you.z = r.z - 1.3;
  for (let i = 0; i < 20; i++) ev.push(...stepBrawl(w, { tackle: i === 0, move: { x: 0, z: 1 } }, 1 / 60));
  assert.ok(ev.some(e => e.type === 'launch' && e.id === 'ref'));
  assert.equal(r.rage, null);
  for (let i = 0; i < 60 * 8; i++) ev.push(...stepBrawl(w, {}, 1 / 60));
  assert.equal(r.state, 'up');
});
