// The flat-screen brawl's match (rules/brawl/): sides and shape, a whole match played out by the AI,
// your controls, hits and flying bodies, goals at both ends, restarts and what the commentator says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrawl, side, homeSpot, dirOf } from '../../rules/brawl/world.js';
import { stepBrawl } from '../../rules/brawl/sim.js';
import { newBall, stepBall } from '../../rules/brawl/ball.js';
import { startLunge, launch, stepHits } from '../../rules/brawl/hits.js';
import { pickLine } from '../../rules/brawl/caster.js';
import { rng } from '../../rules/looks.js';

const play = (w, s, input = { auto: true }, r = Math.random) => { const ev = []; for (let i = 0; i < s * 60; i++) ev.push(...stepBrawl(w, input, 1 / 60, r)); return ev; };
const toPlay = w => { while (w.phase !== 'play') stepBrawl(w, {}, 1 / 60); };

test('6 and 11 a side: a keeper each, everyone in his own half at kick-off', () => {
  for (const n of [6, 11]) {
    const w = createBrawl({ n });
    for (const team of ['home', 'away']) {
      const s = side(w, team);
      assert.equal(s.length, n);
      assert.equal(s.filter(p => p.line === 'gk').length, 1);
      for (const p of s) assert.ok(p.z * dirOf(team) <= 1e-9, `${p.id} in his own half (${p.z})`);
      for (const p of s) { const h = homeSpot(w, p); assert.ok(Math.abs(h.x) < w.W && Math.abs(h.z) < w.L); }
    }
  }
});

const fullMatch = (n, chaos, seed) => {
  const r = rng(seed), w = createBrawl({ n, chaos, real: 180 }), seen = {};
  let steps = 0;
  while (w.phase !== 'full' && steps++ < 60 * 400) for (const e of stepBrawl(w, { auto: true }, 1 / 60, r)) seen[e.type] = (seen[e.type] || 0) + 1;
  assert.equal(w.phase, 'full', `${n}: reached full time`);
  for (const p of w.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), p.id);
  assert.ok(Number.isFinite(w.ball.x) && Number.isFinite(w.ball.z));
  assert.ok((seen.pass || 0) + (seen.received || 0) > 10, `${n}: ${JSON.stringify(seen)}`);
  assert.ok((seen.shot || 0) + (seen.goal || 0) > 0, `${n}: someone had a go`);
  return seen;
};

test('plain football (the default): a whole match plays out, tackles win the ball, nobody leaves the ground', () => {
  for (const n of [6, 11]) {
    const seen = fullMatch(n, 0, 7 + n);
    assert.ok(seen.tackled > 3, `${n}: ${JSON.stringify(seen)}`);
    assert.equal(seen.launch || 0, 0);
  }
});

test('the brawl: a whole match plays out with men sent flying, landing and getting up', () => {
  for (const n of [6, 11]) {
    const seen = fullMatch(n, 1, 7 + n);
    assert.ok(seen.launch > 5 && seen.landed > 3 && seen.getup > 3, `${n}: ${JSON.stringify(seen)}`);
  }
});

test('plain football: a tackle takes the ball off him and he stumbles; a miss leaves the tackler slowed', () => {
  const w = createBrawl({ n: 6 }); toPlay(w);
  const car = w.byId[w.owner], foe = side(w, 'away').find(p => p.line !== 'gk');
  foe.x = car.x; foe.z = car.z - 1.2;
  startLunge(foe, { x: 0, z: 1 }, false);
  const ev = play(w, 0.3, {}, () => 0);         // (the dice say it comes off)
  assert.ok(ev.some(e => e.type === 'tackled' && e.id === car.id && e.by === foe.id));
  assert.equal(w.owner, foe.id);
  assert.equal(car.state, 'up');
  assert.ok(!ev.some(e => e.type === 'launch'));
});

test('you: run, shoot from close and it goes in or the keeper deals with it; the clock runs', () => {
  const w = createBrawl({ n: 6 }); toPlay(w);
  const you = w.byId[w.ctrl];
  assert.equal(w.owner, you.id, 'you kick off with the ball');
  // stand everyone else out of the way and walk it in
  for (const p of w.players) if (p !== you && p.line !== 'gk') { p.x = 20; p.z = 30; }
  you.x = 0; you.z = -20;
  const ev = [];
  for (let i = 0; i < 20; i++) ev.push(...stepBrawl(w, { move: { x: 0, z: -1 }, shoot: true }, 1 / 60));
  ev.push(...stepBrawl(w, { move: { x: 0.6, z: -1 }, shoot: false }, 1 / 60));
  assert.ok(ev.some(e => e.type === 'shot'), 'released: shot');
  ev.push(...play(w, 2, {}));
  assert.ok(ev.some(e => e.type === 'goal' || e.type === 'saved' || e.type === 'claim' || e.type === 'post' || e.type === 'out'), ev.map(e => e.type).join(','));
  assert.ok(w.clock > 0.2);           // (it stops while a goal is celebrated)
});

test('a pass goes to the man the stick points at, and you become him', () => {
  const w = createBrawl({ n: 6 }); toPlay(w);
  const you = w.byId[w.ctrl], mates = side(w, 'home').filter(p => p !== you && p.line !== 'gk');
  for (const p of side(w, 'away')) if (p.line !== 'gk') { p.x = -20; p.z = -30; }
  you.x = 0; you.z = 0;
  mates.forEach((p, i) => { p.x = i === 0 ? 0 : 15 + i; p.z = i === 0 ? -12 : 10; });
  const ev = stepBrawl(w, { move: { x: 0, z: -1 }, pass: true }, 1 / 60);
  const pass = ev.find(e => e.type === 'pass');
  assert.equal(pass && pass.to, mates[0].id);
  const later = play(w, 2.5, {});
  assert.ok(later.some(e => e.type === 'received' && e.id === mates[0].id));
  assert.equal(w.ctrl, mates[0].id);
});

test('the brawl: a lunge sends the man on the ball flying and the ball comes loose; he lands, lies there and gets up', () => {
  const w = createBrawl({ n: 6, chaos: 1 }); toPlay(w);
  const car = w.byId[w.owner], foe = side(w, 'away').find(p => p.line !== 'gk');
  foe.x = car.x; foe.z = car.z - 1.2; foe.fx = 0; foe.fz = 1;
  assert.ok(startLunge(foe, { x: 0, z: 1 }, true));
  const ev = play(w, 0.3, {});
  const hit = ev.find(e => e.type === 'launch' && e.id === car.id);
  assert.ok(hit, 'sent flying');
  assert.notEqual(w.owner, car.id);
  const rest = play(w, 6, {});
  assert.ok(rest.some(e => e.type === 'landed' && e.id === car.id));
  assert.ok(rest.some(e => e.type === 'getup' && e.id === car.id));
  assert.equal(car.state, 'up');
});

test('a flying body flattens a man it hits (dominoes); chaos sends everyone further', () => {
  const far = ch => {
    const w = createBrawl({ n: 6, chaos: ch }), a = w.byId.h1, b = w.byId.h2, ev = [];
    w.phase = 'play';
    a.x = 0; a.z = 0; b.x = 0; b.z = -3;
    launch(w, a, 0, -15, 3, null, ev);
    for (let i = 0; i < 400; i++) stepHits(w, 1 / 60, ev, () => 0.5);
    return { ev, a };
  };
  const one = far(1), two = far(1.6);
  assert.ok(one.ev.some(e => e.type === 'launch' && e.kind === 'domino'));
  assert.ok(Math.abs(two.a.z) > Math.abs(one.a.z));
});

test('goals count for the side whose goal it is not, at either end', () => {
  for (const [end, team] of [[-1, 'home'], [1, 'away']]) {
    const w = createBrawl({ n: 6 }); toPlay(w);
    w.owner = null; Object.assign(w.ball, { x: 0, y: 0.5, z: end * (w.L - 2), vx: 0, vy: 0, vz: end * 25 });
    for (const p of w.players) if (p.line === 'gk') { p.x = 30; }
    const ev = play(w, 0.5, {});
    const g = ev.find(e => e.type === 'goal');
    assert.equal(g && g.team, team);
    assert.equal(w.score[team], 1);
    play(w, 4, {});
    assert.ok(w.phase === 'kickoff' || w.phase === 'play');
  }
});

test('ball physics: the posts, the net, the touchline', () => {
  const L = 52.5, W = 34, ev = [];
  const b = Object.assign(newBall(), { x: 3.66, y: 1, z: -50, vz: -20 });
  for (let i = 0; i < 30; i++) stepBall(b, 1 / 60, L, W, ev);
  assert.ok(ev.some(e => e.type === 'post'));
  const c = Object.assign(newBall(), { x: 33, z: 0, vx: 10 }), ev2 = [];
  for (let i = 0; i < 30; i++) stepBall(c, 1 / 60, L, W, ev2);
  assert.ok(ev2.some(e => e.type === 'out' && e.where === 'side'));
});

test('the ball out of play comes back in, and the side that put it out has to wait', () => {
  const w = createBrawl({ n: 6 }); toPlay(w);
  w.owner = null; w.lastTeam = 'home'; Object.assign(w.ball, { x: w.W - 1, y: 0.12, z: 5, vx: 12, vy: 0, vz: 0 });
  const ev = play(w, 0.4, {});
  assert.ok(ev.some(e => e.type === 'out' && e.to === 'away'));
  assert.equal(w.noTouch.team, 'home');
  assert.ok(Math.abs(w.ball.x) < w.W);
});

test('the commentator: clips for the football, dry lines for the hits', () => {
  const w = createBrawl({ n: 6 }), r = rng(3);
  assert.ok(pickLine({ type: 'goal' }, w, r).id.startsWith('goal'));
  assert.ok(pickLine({ type: 'saved' }, w, r).id.startsWith('saved'));
  const big = pickLine({ type: 'launch', kind: 'big', power: 14 }, w, r);
  assert.ok(big && !big.id && big.text.length > 5);
  assert.equal(pickLine({ type: 'received' }, w, r), null);
});
