// The flat-screen brawl's match (rules/brawl/): sides and shape, a whole match played out by the AI,
// your controls, hits and flying bodies, goals at both ends, restarts and what the commentator says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrawl, side, homeSpot, dirOf } from '../../rules/brawl/world.js';
import { stepBrawl } from '../../rules/brawl/sim.js';
import { newBall, stepBall } from '../../rules/brawl/ball.js';
import { startLunge, launch, stepHits } from '../../rules/brawl/hits.js';
import { startSetPiece } from '../../rules/brawl/setpiece.js';
import { referee, sendOff, inBox, judgeTackle } from '../../rules/brawl/fouls.js';
import { offsideLine } from '../../rules/brawl/offside.js';
import { passTo } from '../../rules/brawl/kicks.js';
import { decided } from '../../rules/brawl/shootout.js';
import { createCup, playUser } from '../../rules/cup.js';
import { CLUBS } from '../../rules/teams.js';
import { refEvents, stepRef, refSignals } from '../../rules/brawl/referee.js';
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
      for (const p of s) assert.ok(p.z * dirOf(w, team) <= 1e-9, `${p.id} in his own half (${p.z})`);
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

test('plain football (the default): a whole match plays out, tackles win the ball, the only men down are fouled', () => {
  for (const n of [6, 11]) {
    const r = rng(7 + n), w = createBrawl({ n, real: 180 }), seen = {};
    let steps = 0;
    while (w.phase !== 'full' && steps++ < 60 * 400) for (const e of stepBrawl(w, { auto: true }, 1 / 60, r)) {
      seen[e.type] = (seen[e.type] || 0) + 1;
      if (e.type === 'launch') assert.equal(e.kind, 'foul');
    }
    assert.equal(w.phase, 'full');
    assert.ok(seen.tackled > 3 && seen.halftime === 1, `${n}: ${JSON.stringify(seen)}`);
    assert.equal(seen.launch || 0, seen.foul || 0);
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

test("a throw-in: the other side's man walks to the line, picks it up, throws it in", () => {
  const w = createBrawl({ n: 6 }); toPlay(w);
  w.owner = null; w.lastTeam = 'home'; Object.assign(w.ball, { x: w.W - 1, y: 0.12, z: 5, vx: 12, vy: 0, vz: 0 });
  const ev = play(w, 0.4, { auto: true });
  const sp = ev.find(e => e.type === 'setpiece');
  assert.equal(sp && sp.kind, 'throw'); assert.equal(sp.team, 'away');
  const later = play(w, 9, { auto: true });
  assert.ok(later.some(e => e.type === 'ready' && e.kind === 'throw'), 'he got there');
  assert.ok(later.some(e => e.type === 'throw'), 'and threw it');
  assert.ok(later.findIndex(e => e.type === 'ready') < later.findIndex(e => e.type === 'throw'));
});

test('your set piece waits for you: a free kick goes when you press, a shot aimed where the stick says', () => {
  const w = createBrawl({ n: 6 }); toPlay(w);
  const ev = [];
  startSetPiece(w, 'free', 'home', { x: 0, z: -w.L + 22 }, ev);
  assert.ok(w.sp.wall.length >= 2, 'a wall in front of goal');
  ev.push(...play(w, 8, {}));
  assert.ok(ev.some(e => e.type === 'ready'));
  assert.equal(w.phase, 'setpiece', 'still waiting for you');
  assert.equal(w.ctrl, w.sp.taker);
  for (const p of w.players) if (p.team === 'away' && p.line !== 'gk') assert.ok(Math.hypot(p.x - w.sp.x, p.z - w.sp.z) > 8.5 || w.sp.wall.includes(p.id), `${p.id} ten yards away`);
  for (let i = 0; i < 30; i++) stepBrawl(w, { move: { x: 1, z: 0 }, shoot: true }, 1 / 60);
  const go = [...stepBrawl(w, { move: { x: 1, z: 0 } }, 1 / 60), ...play(w, 1.5, {})];
  assert.ok(go.some(e => e.type === 'shot'));
  assert.equal(w.phase !== 'setpiece', true);
});

test('a foul: the man goes down, a free kick (or a penalty in the box), cards; a second yellow sends him off', () => {
  const w = createBrawl({ n: 6 }); toPlay(w);
  const car = w.byId[w.owner], foe = side(w, 'away').find(p => p.line === 'fwd') || side(w, 'away')[1];
  const ev = [];
  launch(w, car, 2, 0, 1, foe, ev, 'foul');
  ev.push({ type: 'foul', id: foe.id, on: car.id, big: true, behind: true, x: car.x, z: car.z });
  const call = referee(w, foe, car, true, true, () => 0.2);
  assert.equal(call.card, 'yellow'); assert.equal(foe.yellow, 1);
  const again = referee(w, foe, car, true, true, () => 0.2);
  assert.equal(again.card, 'red2'); assert.ok(again.off);
  sendOff(w, foe);
  assert.equal(foe.state, 'off');
  const left = play(w, 3, { auto: true });
  assert.ok(!left.some(e => e.id === foe.id && e.type === 'received'));
  // home defends the goal at +L in the first half, away the one at -L
  assert.ok(inBox(w, 'home', 0, w.L - 5) && !inBox(w, 'home', 0, 0) && !inBox(w, 'away', 0, w.L - 5) && inBox(w, 'away', 0, -w.L + 5));
});

test('a tackle in plain football is clean, a miss, or a foul, and fouls whistle up a free kick', () => {
  const w = createBrawl({ n: 6 }); toPlay(w);
  const car = w.byId[w.owner], foe = side(w, 'away').find(p => p.line !== 'gk');
  foe.x = car.x; foe.z = car.z + 1.2; foe.fx = 0; foe.fz = -1;          // from behind
  startLunge(foe, { x: 0, z: -1 }, true);
  let k = 0; const ev = play(w, 0.5, {}, () => [0.9, 0.1][k++ % 2]);    // the dice: no win, then a foul
  assert.ok(ev.some(e => e.type === 'foul' && e.on === car.id), ev.map(e => e.type).join(','));
  assert.ok(ev.some(e => e.type === 'setpiece' && e.team === 'home'));
  assert.equal(judgeTackle({ x: 0, z: -1 }, { x: 0, z: 0, fx: 0, fz: -1 }, false, () => 0.1), 'clean');
});

test('offside: a pass to a man beyond the second-last defender, and he is caught when he touches it', () => {
  const w = createBrawl({ n: 6 }); toPlay(w);
  const you = w.byId[w.owner], mate = side(w, 'home').find(p => p.line === 'fwd' && p !== you) || side(w, 'home').find(p => p.line === 'mid');
  you.x = 0; you.z = -5;
  for (const p of side(w, 'away')) if (p.line !== 'gk') { p.x = 15; p.z = -10; }
  mate.x = 0; mate.z = -25;                                            // home attacks -z: well beyond them
  assert.ok(mate.z * dirOf(w, 'home') > offsideLine(w, 'home'));
  passTo(w, you, mate, []);
  assert.ok(w.offside && w.offside.off[mate.id]);
  const ev = play(w, 3, {});
  assert.ok(ev.some(e => e.type === 'offside' && e.id === mate.id), ev.map(e => e.type).join(','));
  assert.equal(w.sp && w.sp.team, 'away');
});

test('half time: the clock stops at 45, the sides change ends, the other side kicks off', () => {
  const w = createBrawl({ n: 6, real: 20 }); toPlay(w);
  const ev = [];
  let k = null;
  for (let i = 0; i < 60 * 16 && !k; i++) { const e = stepBrawl(w, { auto: true }, 1 / 60); ev.push(...e); k = e.find(x => x.type === 'kickoff' && x.half === 2); }
  assert.ok(ev.some(e => e.type === 'halftime'));
  assert.equal(w.half, 2);
  assert.equal(dirOf(w, 'home'), 1);
  assert.equal(k && k.team, 'away');
});

test('a knockout level at full time goes to penalties, and the shoot-out is decided properly', () => {
  assert.equal(decided({ score: { home: 3, away: 0 }, taken: { home: 3, away: 3 } }), 'home');
  assert.equal(decided({ score: { home: 3, away: 2 }, taken: { home: 4, away: 3 } }), null);
  assert.equal(decided({ score: { home: 5, away: 5 }, taken: { home: 5, away: 5 } }), null);
  assert.equal(decided({ score: { home: 6, away: 5 }, taken: { home: 6, away: 6 } }), 'home');
  const w = createBrawl({ n: 6, real: 6, knockout: true });
  let ev = [], steps = 0;
  while (w.phase !== 'full' && steps++ < 60 * 200) {
    if (w.phase === 'play' || w.phase === 'kickoff') w.score.home = w.score.away = 0;     // keep it level
    ev.push(...stepBrawl(w, { auto: true }, 1 / 60));
  }
  assert.ok(ev.some(e => e.type === 'shootout'));
  const pens = ev.filter(e => e.type === 'pen');
  assert.ok(pens.length >= 6, `${pens.length} kicks`);
  const end = ev.find(e => e.type === 'fulltime');
  assert.ok(end.winner === 'home' || end.winner === 'away');
  assert.equal(w.score.home, w.score.away, 'the shoot-out is not added to the score');
});

test('a cup tie won on penalties counts as a win', () => {
  const cup = createCup('champions', CLUBS[0].id, rng(4));
  cup.continues = 0;
  const r = playUser(cup, 1, 1, rng(5), true);
  assert.equal(r.result, 'win');
  assert.ok(r.advanced);
});

test('the commentator: clips for the football, dry lines for the hits', () => {
  const w = createBrawl({ n: 6 }), r = rng(3);
  assert.ok(pickLine({ type: 'goal' }, w, r).id.startsWith('goal'));
  assert.ok(pickLine({ type: 'saved' }, w, r).id.startsWith('saved'));
  const big = pickLine({ type: 'launch', kind: 'big', power: 14 }, w, r);
  assert.ok(big && !big.id && big.text.length > 5);
  assert.equal(pickLine({ type: 'received' }, w, r), null);
});

test('the referee: keeps his distance from the ball, on his diagonal; blows, books and signals', () => {
  const w = createBrawl({ n: 11, real: 60 }), r = rng(9);
  let steps = 0, sum = 0, n = 0, close = 0;
  const sig = {};
  while (w.phase !== 'full' && steps++ < 60 * 120) {
    for (const e of stepBrawl(w, { auto: true }, 1 / 60, r)) if (e.type === 'signal') sig[e.kind] = (sig[e.kind] || 0) + 1;
    if (w.phase === 'play' && steps > 600) { const d = Math.hypot(w.ref.x - w.ball.x, w.ref.z - w.ball.z); sum += d; n++; if (d < 3) close++; }
    assert.ok(Math.abs(w.ref.x) < w.W + 1 && Math.abs(w.ref.z) < w.L + 1, 'on the pitch');
  }
  for (let i = 0; i < 180; i++) for (const e of stepBrawl(w, { auto: true }, 1 / 60, r)) if (e.type === 'signal') sig[e.kind] = (sig[e.kind] || 0) + 1;
  assert.ok(sum / n > 8 && close / n < 0.03, `keeps his distance (${(sum / n).toFixed(1)} m on average, ${(100 * close / n).toFixed(1)}% of the time inside 3 m: a ball going past him)`);
  assert.ok(sig.whistle > 2 && sig.halftime === 1 && sig.fulltime === 1, JSON.stringify(sig));
  // a booking: he turns to the man and holds the card up
  const w2 = createBrawl({ n: 6 }); toPlay(w2);
  const ev = [{ type: 'whistle', kind: 'free', by: 'a1', on: 'h1' }, { type: 'card', id: 'a1', color: 'yellow' }, { type: 'setpiece', kind: 'free', team: 'home', x: 0, z: 0 }];
  refEvents(w2, ev);
  const got = [];
  for (let i = 0; i < 60 * 5; i++) { stepRef(w2, 1 / 60); got.push(...refSignals(w2)); }
  assert.deepEqual(got.map(e => e.kind), ['whistle', 'card', 'free']);
  assert.equal(got[1].color, 'yellow');
});
