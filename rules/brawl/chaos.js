// Chaos: what the brawl adds to football besides the hits. Pure. Nothing here happens by itself: each side
// earns FAVOURS by playing (passes, shots, hits given and taken, saves; a side that is behind earns quicker),
// holds one at a time, and calls it in when it likes (you: the call button; the AI: a moment after it gets
// one). A favour is aimed at the other side, but it is never a sure thing: it is announced (a 'warn' event,
// a shadow or a lane on the grass) CHAOS.warn seconds before it can touch anyone, it keeps clear of the
// goalmouths, it flattens whoever is there (your own men too, for the ones that land on a place), it never
// takes a goal away, and the AI gets out of the way late, as a person would.
//   - drop: things come out of the upper tier (a fridge, a sofa...) round their man on or nearest the ball
//   - buggy: the medical buggy crosses the pitch at speed, level with the ball, through whoever is in its lane
//   - invader: one of your supporters runs on and goes for their men; a tackle removes him
//   - heavy: your side's ball is a heavy one for a while: hit hard, it takes their men with it
//   - ref: the referee has a word with their last man to flatten one of yours. At a sprint.
//   - the crowd: a man knocked over the boards is passed about and thrown back (rules/brawl/hits.js)
// Hits also send men further as the clock runs (CHAOS.ramp).
//   w.cx = { base, drops, buggy, mob, heavy, heavyTeam, heavyWarn, fav: { home: { m, item, last, ai }, away }, lastHit }
// Events: favour { team, item }, chaos { what, team, stage: 'warn' | 'hit' | 'end', ... }.
import { CHAOS, HIT, BODY } from './tuning.js';
import { launch, fly, isUp } from './hits.js';
import { other } from './world.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const THINGS = ['fridge', 'sofa', 'vending', 'loo', 'wardrobe'];
export const FAVOURS = ['drop', 'buggy', 'invader', 'heavy', 'ref'];

export function createChaos(w) {
  const mob = [0, 1].map(i => ({ id: `m${i}`, mob: true, team: 'mob', side: null, role: 'mate', line: 'mob', num: 0, state: 'gone', x: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: 1, stride: 0, air: null, cool: 0, life: 0, leaving: false, downT: 0, getT: 0 }));
  const f = () => ({ m: 0, item: null, last: null, ai: 0, used: 0 });
  w.cx = { base: w.chaos, drops: [], buggy: null, mob, heavy: 0, heavyTeam: null, heavyWarn: 0, fav: { home: f(), away: f() }, lastHit: { home: null, away: null } };
  return w.cx;
}

const level = w => clamp(w.clock / w.real, 0, 1);

// input: yours (input.call: pressed this frame; input.auto: the AI calls the home side's too).
export function stepChaos(w, dt, ev, rnd = Math.random, input = {}) {
  const cx = w.cx || createChaos(w);
  w.chaos = cx.base * (CHAOS.ramp[0] + (CHAOS.ramp[1] - CHAOS.ramp[0]) * level(w));
  earn(w, cx, dt, ev, rnd);
  if (w.phase === 'play') for (const team of ['home', 'away']) {
    const f = cx.fav[team];
    if (!f.item) continue;
    const human = team === 'home' && !input.auto;
    if (human ? input.call : (f.ai -= dt) <= 0) {
      if (START[f.item](w, cx, team, ev, rnd)) { ev.push({ type: 'favour', team, item: f.item, used: true }); f.last = f.item; f.item = null; f.used++; }
      else if (!human) f.ai = 1;          // can't just now (one's already going): try again in a moment
    }
  }
  drops(w, cx, dt, ev);
  buggy(w, cx, dt, ev);
  mob(w, cx, dt, ev, rnd);
  if (cx.heavyWarn > 0 && (cx.heavyWarn -= dt) <= 0) { cx.heavy = CHAOS.heavyT; ev.push({ type: 'chaos', what: 'heavy', team: cx.heavyTeam, stage: 'hit' }); }
  else if (cx.heavy > 0 && (cx.heavy -= dt) <= 0) ev.push({ type: 'chaos', what: 'heavy', team: cx.heavyTeam, stage: 'end' });
  rage(w, cx, dt, ev);
  refDown(w, cx, dt, ev);
}

// A held favour can go on a super shot instead: is one there to spend? (spends it)
export function spendOnSuper(w, team) {
  const f = w.cx && w.cx.fav[team];
  if (!f || !f.item) return false;
  f.last = f.item; f.item = null; f.used++; f.supers = (f.supers || 0) + 1;
  return true;
}

// Favours are earned by playing. A side that is behind earns quicker; a full meter is a favour (never the
// one it had last), and the meter waits while one is held.
function earn(w, cx, dt, ev, rnd) {
  const add = { home: 0, away: 0 }, E = CHAOS.earn;
  if (w.phase === 'play') { add.home += E.tick * dt; add.away += E.tick * dt; }
  for (const e of ev) {
    const p = w.byId[e.id];
    if (e.type === 'pass' && p) add[p.team] += E.pass;
    else if (e.type === 'shot' && p) add[p.team] += E.shot;
    else if (e.type === 'saved' && p) add[p.team] += E.save;
    else if (e.type === 'goal') add[other(e.team)] += E.conceded;
    else if (e.type === 'dodged' && p) add[p.team] += E.dodged;
    else if (e.type === 'launch' && p) {
      const by = w.byId[e.by];
      add[p.team] += E.taken + (w.phase === 'goal' && by ? E.late : 0);        // (a late hit feeds the side that took it)
      if (by && by.team !== p.team) { add[by.team] += e.kind === 'big' ? E.big : E.hit; cx.lastHit[p.team] = by.id; }
    }
  }
  for (const team of ['home', 'away']) {
    const f = cx.fav[team];
    if (f.item) continue;
    const behind = Math.max(0, w.score[other(team)] - w.score[team]);
    f.m += add[team] * (1 + Math.min(2, behind) * E.behind);
    if (f.m < 1) continue;
    const kinds = FAVOURS.filter(k => k !== f.last);
    f.item = kinds[Math.floor(rnd() * kinds.length) % kinds.length]; f.m = 0; f.ai = CHAOS.aiCall[0] + rnd() * (CHAOS.aiCall[1] - CHAOS.aiCall[0]);
    ev.push({ type: 'favour', team, item: f.item });
  }
}

// Everyone a hazard can reach: the players on their feet and any supporter on the pitch.
const standing = (w, cx) => [...w.players, ...cx.mob].filter(isUp);
// Their man a favour is aimed at: the one on the ball, or their outfield man nearest it.
function mark(w, team) {
  const car = w.owner && w.byId[w.owner];
  if (car && car.team !== team && car.line !== 'gk') return car;
  const men = w.players.filter(p => p.team !== team && p.line !== 'gk' && isUp(p));
  men.sort((a, c) => Math.hypot(a.x - w.ball.x, a.z - w.ball.z) - Math.hypot(c.x - w.ball.x, c.z - w.ball.z));
  return men[0] || null;
}

// Each returns false if it can't start just now (the favour is kept).
const START = {
  // three things, one after another, round where their man is going; never near a goal
  drop(w, cx, team, ev, rnd) {
    const t = mark(w, team);
    if (!t) return false;
    for (let i = 0; i < 3; i++) {
      const lead = (CHAOS.warn + i * 0.7) * 0.5;
      const d = {
        x: clamp(t.x + t.vx * lead + (rnd() - 0.5) * 7, -w.W + 2, w.W - 2), z: clamp(t.z + t.vz * lead + (rnd() - 0.5) * 7, -w.L + CHAOS.keepOff, w.L - CHAOS.keepOff),
        t: CHAOS.warn + i * 0.7, r: CHAOS.dropR, what: THINGS[Math.floor(rnd() * THINGS.length) % THINGS.length], id: `${team[0]}${cx.fav[team].used}-${i}`, team,
      };
      cx.drops.push(d);
      ev.push({ type: 'chaos', what: 'drop', team, stage: 'warn', id: d.id, x: d.x, z: d.z, r: d.r, thing: d.what, t: d.t });
    }
    return true;
  },
  // across the pitch, touchline to touchline, level with the ball; never through a penalty area
  buggy(w, cx, team, ev, rnd) {
    if (cx.buggy) return false;
    const b = w.ball, dir = rnd() < 0.5 ? -1 : 1, keep = Math.min(w.L - 6, 18);
    cx.buggy = { z: clamp(b.z + b.vz * 1.2, -w.L + keep, w.L - keep), dir, x: -dir * (w.W + 8), t: CHAOS.warn + 0.3, team };
    ev.push({ type: 'chaos', what: 'buggy', team, stage: 'warn', z: cx.buggy.z, dir });
    return true;
  },
  invader(w, cx, team, ev, rnd) {
    const m = cx.mob.find(q => q.state === 'gone');
    if (!m) return false;
    const b = w.ball, side = rnd() < 0.5 ? -1 : 1;
    Object.assign(m, { state: 'up', side: team, x: side * (w.W + 3), z: clamp(b.z + (rnd() - 0.5) * 16, -w.L + 4, w.L - 4), vx: 0, vz: 0, fx: -side, fz: 0, air: null, cool: CHAOS.warn, life: CHAOS.mobLife, leaving: false });
    ev.push({ type: 'chaos', what: 'invader', team, stage: 'warn', id: m.id, x: m.x, z: m.z });
    return true;
  },
  heavy(w, cx, team, ev) {
    if (cx.heavy > 0 || cx.heavyWarn > 0) return false;
    cx.heavyWarn = CHAOS.warn; cx.heavyTeam = team;
    ev.push({ type: 'chaos', what: 'heavy', team, stage: 'warn' });
    return true;
  },
  // the referee goes for their last man to flatten one of yours (or their man nearest the ball)
  ref(w, cx, team, ev) {
    const r = w.ref, last = w.byId[cx.lastHit[team]], t = last && last.state !== 'off' ? last : mark(w, team);
    if (!r || r.rage || !t) return false;
    r.rage = { id: t.id, t: 0, warn: CHAOS.warn - 0.6, team };
    // he blows and shows him a red card. Then he puts it away
    const l = Math.hypot(t.x - r.x, t.z - r.z) || 1, dir = { x: (t.x - r.x) / l, z: (t.z - r.z) / l };
    r.sig = null; r.queue = [{ kind: 'whistle', dir, t: 0 }, { kind: 'card', dir, color: 'red', t: 0 }];
    ev.push({ type: 'chaos', what: 'ref', team, stage: 'warn', id: t.id });
    return true;
  },
};

function drops(w, cx, dt, ev) {
  for (const d of cx.drops) {
    if ((d.t -= dt) > 0) continue;
    for (const p of standing(w, cx)) {
      const dx = p.x - d.x, dz = p.z - d.z, dist = Math.hypot(dx, dz);
      if (dist > d.r) continue;
      const u = dist > 0.05 ? 1 / dist : 0, sp = (6 + (d.r - dist) * 2.5) / w.chaos;
      launch(w, p, dx * u * sp, dz * u * sp, 6.5, null, ev, 'drop');
    }
    ev.push({ type: 'chaos', what: 'drop', team: d.team, stage: 'hit', id: d.id, x: d.x, z: d.z, thing: d.what });
  }
  cx.drops = cx.drops.filter(d => d.t > 0);
}

function buggy(w, cx, dt, ev) {
  const g = cx.buggy;
  if (!g) return;
  if (g.t > 0) { g.t -= dt; return; }
  g.x += g.dir * CHAOS.buggy * dt;
  for (const p of standing(w, cx)) {
    if (Math.abs(p.z - g.z) > 1.2 || Math.abs(p.x - g.x) > 1.6) continue;
    launch(w, p, g.dir * 10 / w.chaos, Math.sign(p.z - g.z || 1) * 3 / w.chaos, 5.5, null, ev, 'buggy');
    ev.push({ type: 'chaos', what: 'buggy', team: g.team, stage: 'hit', id: p.id });
  }
  if (g.x * g.dir > w.W + 8) { cx.buggy = null; ev.push({ type: 'chaos', what: 'buggy', team: g.team, stage: 'end' }); }
}

// The supporters: after the ball, into whoever they reach; a lunge sends them flying, and then they leave.
function mob(w, cx, dt, ev, rnd) {
  for (const m of cx.mob) {
    if (m.state === 'gone') continue;
    if (m.cool > 0) m.cool -= dt;
    if (m.state === 'air') { fly(w, m, dt, ev); continue; }
    if (m.state === 'down') { if ((m.downT -= dt) <= 0) { m.state = 'getup'; m.getT = BODY.getup; ev.push({ type: 'getup', id: m.id }); } continue; }
    if (m.state === 'getup') { m.vx = m.vz = 0; if ((m.getT -= dt) <= 0) { m.state = 'up'; m.leaving = true; } continue; }
    if ((m.life -= dt) <= 0) m.leaving = true;
    // a player's lunge takes him out
    const hitter = w.players.find(p => p.team !== m.side && p.lunge && Math.hypot(p.x - m.x, p.z - m.z) < HIT.reach + 0.15);
    if (hitter) {
      hitter.lunge.hit = true;
      launch(w, m, hitter.lunge.x * 9 / w.chaos, hitter.lunge.z * 9 / w.chaos, 5, hitter, ev, 'mobhit');
      continue;
    }
    const t = m.leaving ? { x: Math.sign(m.x || 1) * (w.W + 4), z: m.z } : mark(w, m.side) || w.ball;
    const dx = t.x - m.x, dz = t.z - m.z, d = Math.hypot(dx, dz) || 1, k = Math.min(1, 10 * dt);
    m.vx += (dx / d * CHAOS.mobRun - m.vx) * k; m.vz += (dz / d * CHAOS.mobRun - m.vz) * k;
    m.x += m.vx * dt; m.z += m.vz * dt;
    const s = Math.hypot(m.vx, m.vz) || 1; m.fx = m.vx / s; m.fz = m.vz / s; m.stride += dt * 2.6;
    if (m.leaving) { if (Math.abs(m.x) > w.W + 3) { m.state = 'gone'; ev.push({ type: 'chaos', what: 'invader', team: m.side, stage: 'end', id: m.id }); } continue; }
    if (m.cool > 0) continue;
    const v = w.players.find(p => p.team !== m.side && isUp(p) && !p.dodge && p.line !== 'gk' && Math.hypot(p.x - m.x, p.z - m.z) < 0.95);
    if (v) {
      launch(w, v, m.fx * 7 / w.chaos, m.fz * 7 / w.chaos, 4.5, m, ev, 'invader');
      m.cool = CHAOS.mobCool + rnd() * 0.4;
    }
  }
}

// The referee, called in: he blows, stares at the man for a moment, then goes for him. He gives up after
// CHAOS.rage seconds, so a man who sees it coming and runs can get away with it.
function rage(w, cx, dt, ev) {
  const r = w.ref;
  if (!r || !r.rage) return;
  const g = r.rage, p = w.byId[g.id];
  g.t += dt;
  if (g.t > g.warn && !g.off) { g.off = true; r.sig = null; r.queue = []; }
  const dx = p.x - r.x, dz = p.z - r.z, d = Math.hypot(dx, dz) || 1;
  if (g.t > g.warn && isUp(p) && !p.dodge && d < 1.25) {
    launch(w, p, dx / d * 11 / w.chaos, dz / d * 11 / w.chaos, 6, r, ev, 'ref');
    ev.push({ type: 'chaos', what: 'ref', team: g.team, stage: 'hit', id: p.id });
    r.queue.push({ kind: 'advantage', dir: { x: r.fx, z: r.fz }, t: 0 });
    r.rage = null;
  } else if (g.t > CHAOS.rage || p.state === 'off' || w.phase === 'full' || w.phase === 'shootout') { r.rage = null; ev.push({ type: 'chaos', what: 'ref', team: g.team, stage: 'end', id: p.id }); }
}

// The referee can be flattened like anyone else (any lunge that reaches him). It stops him coming for your
// man, and it feeds the other side's meter. He gets up and carries on as if nothing happened.
function refDown(w, cx, dt, ev) {
  const r = w.ref;
  if (!r) return;
  r.stay = true;
  if (r.state === 'air') return fly(w, r, dt, ev);
  if (r.state === 'down') { if ((r.downT -= dt) <= 0) { r.state = 'getup'; r.getT = BODY.getup; ev.push({ type: 'getup', id: r.id }); } return; }
  if (r.state === 'getup') { r.vx = r.vz = 0; if ((r.getT -= dt) <= 0) r.state = 'up'; return; }
  const h = w.players.find(p => p.lunge && Math.hypot(p.x - r.x, p.z - r.z) < HIT.reach);
  if (!h) return;
  h.lunge.hit = true;
  launch(w, r, h.lunge.x * 8 / w.chaos, h.lunge.z * 8 / w.chaos, 5, h, ev, 'refhit');
  if (r.rage) { ev.push({ type: 'chaos', what: 'ref', team: r.rage.team, stage: 'end', id: r.rage.id, floored: true }); r.rage = null; }
  r.queue = []; r.sig = null;
  const f = cx.fav[other(h.team)]; if (!f.item) f.m += CHAOS.earn.refhit;
}

// The AI getting out of the way: a velocity, or null. Late on purpose (CHAOS.react before it lands).
export function dodge(w, p) {
  const cx = w.cx;
  if (!cx) return null;
  for (const d of cx.drops) {
    const dx = p.x - d.x, dz = p.z - d.z, dist = Math.hypot(dx, dz);
    if (d.t < CHAOS.react && dist < d.r + 0.6) { const u = dist > 0.05 ? 1 / dist : 1; return { x: (dist > 0.05 ? dx * u : 1) * 7.5, z: dz * u * 7.5, sprint: true }; }
  }
  const g = cx.buggy;
  if (g && g.t < CHAOS.react && Math.abs(p.z - g.z) < 2.2 && (p.x - g.x) * g.dir > -2) return { x: 0, z: Math.sign(p.z - g.z || 1) * 7.5, sprint: true };
  return null;
}
