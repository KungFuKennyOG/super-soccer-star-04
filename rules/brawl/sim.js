// The brawl's match: one step of everything. Pure.
//   const w = createBrawl({ n: 11 });  each frame: const ev = stepBrawl(w, input, dt);
// input (yours, for w.ctrl, a home player): { move: { x, z } world direction, length 0..1, sprint,
// pass (pressed this frame), shoot (held), tackle (pressed), switch (pressed) }.
// Events: kickoff, pass, shot, received, launch, landed, thud, boards, miss, getup, saved, claim, post,
// goal { team, by }, out, restart, fulltime, switch. input.auto: the AI plays your man too (a demo, the tests).
import { RUN, KICK, HIT, CLOCK, BRAIN } from './tuning.js';
import { dirOf, kickoff, other, ownLine } from './world.js';
import { stepBall, groundSpeed } from './ball.js';
import { stepHits, startLunge, launch, isUp } from './hits.js';
import { keeperStep } from './keeper.js';
import { plan, think, toward } from './ai.js';
import { passTo, bestPass, shoot, kickBall } from './kicks.js';
import { strideRate, dribbleLead } from '../dribble.js';

const NONE = { move: { x: 0, z: 0 } };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function stepBrawl(w, input = NONE, dt = 1 / 60, rnd = Math.random) {
  const ev = [];
  w.t += dt;
  if (w.phase === 'kickoff') {
    if ((w.phaseT -= dt) <= 0) {
      w.phase = 'play';
      const tk = w.byId[w.taker];
      if (tk) { w.owner = tk.id; w.lastTeam = tk.team; }
      if (w.kickoffTeam === 'home' && tk) w.ctrl = tk.id;
      ev.push({ type: 'kickoff', team: w.kickoffTeam });
    }
  } else if (w.phase === 'goal' || w.phase === 'restart') {
    if ((w.phaseT -= dt) <= 0) {
      if (w.phase === 'goal') kickoff(w, w.next); else { w.phase = 'play'; ev.push({ type: 'restart' }); }
    }
  } else if (w.phase === 'play') {
    w.clock += dt;
    if (w.clock >= w.real) { w.phase = 'full'; w.owner = null; ev.push({ type: 'fulltime', score: { ...w.score } }); }
  }
  if (w.noTouch.t > 0) w.noTouch.t -= dt;
  if (w.pass) { w.pass.t += dt; if (w.pass.t > 3) w.pass = null; }

  const live = w.phase === 'play' || w.phase === 'restart';
  pickCtrl(w, input, ev);
  if (live) plan(w);
  if ((w.brain.t -= dt) <= 0) w.brain.t = BRAIN.think;

  for (const p of w.players) {
    if (p.noBall > 0) p.noBall -= dt;
    if (p.stun > 0) p.stun -= dt;
    if (p.kicked) { p.kicked.t += dt; if (p.kicked.t > 0.5) p.kicked = null; }
    if (!isUp(p)) { p.stride += dt * strideRate(Math.hypot(p.vx, p.vz)); continue; }
    let want = { x: 0, z: 0 };
    if (p.lunge) want = { x: p.vx, z: p.vz };
    else if (!live) want = w.phase === 'goal' ? celebrate(w, p) : { x: 0, z: 0 };
    else if (p.line === 'gk') {
      const k = keeperStep(w, p, dt, ev, rnd);
      if (p.holding) distribute(w, p, dt, ev, rnd);
      want = toward(p, k, k.speed, false);
    } else if (p.id === w.ctrl && !input.auto) want = yours(w, p, input, dt, ev);
    else want = think(w, p, dt, ev, rnd);
    p.sprint = !!want.sprint;
    move(p, want, dt);
  }

  stepHits(w, dt, ev, rnd);
  ball(w, dt, ev, rnd);
  separate(w);
  return ev;
}

// You: the stick runs, sprint runs faster, pass goes to the man the stick points at, shoot charges while
// held and goes on release, tackle lunges (or barges, on the ball).
function yours(w, p, it, dt, ev) {
  const mv = it.move || NONE.move, m = Math.min(1, Math.hypot(mv.x, mv.z)), onBall = w.owner === p.id;
  const top = onBall ? (it.sprint ? RUN.dribbleSprint : RUN.dribble) : (it.sprint ? RUN.sprint : RUN.run);
  const aim = m > 0.2 ? { x: mv.x, z: mv.z } : { x: p.fx, z: p.fz };
  if (onBall && it.pass) { const q = bestPass(w, p, aim); if (q) passTo(w, p, q, ev); else kickBall(w, p, aim.x * 18, 2, aim.z * 18, 'pass', ev, null, 0.6); }
  if (onBall && it.shoot) w.charge = (w.charge || 0) + dt;
  else if (w.charge) {
    if (onBall) {
      const held = w.charge, power = Math.min(1, held / KICK.maxHold);
      shoot(w, p, power, mv.x * 1.3, ev, held);
    }
    w.charge = 0;
  }
  if (it.tackle) {
    if (onBall) p.barge = true;
    else startLunge(p, aim, !!it.sprint);
  }
  return { x: mv.x / (m || 1) * top * m, z: mv.z / (m || 1) * top * m, sprint: it.sprint && m > 0.3 };
}

// Which home man you are: the one on the ball, the one a pass is going to, or (switch) the nearest the ball.
function pickCtrl(w, it, ev) {
  const car = w.owner && w.byId[w.owner], cur = w.byId[w.ctrl];
  let to = null;
  if (car && car.team === 'home' && car.line !== 'gk') to = car;
  else if (w.pass && w.byId[w.pass.to].team === 'home') to = w.byId[w.pass.to];
  else if (it.switch || !cur || !isUp(cur) && cur.state !== 'getup' || cur.line === 'gk') {
    const men = w.players.filter(p => p.team === 'home' && p.line !== 'gk' && isUp(p) && (!it.switch || p !== cur));
    men.sort((a, b) => dist(a, w.ball) - dist(b, w.ball));
    to = men[0] || null;
  }
  if (to && to.id !== w.ctrl) { w.ctrl = to.id; ev.push({ type: 'switch', id: to.id }); }
}

function move(p, want, dt) {
  const ax = want.x - p.vx, az = want.z - p.vz, a = Math.hypot(ax, az), k = Math.min(1, RUN.accel * dt / (a || 1));
  if (!p.lunge) { p.vx += ax * k; p.vz += az * k; }
  if (p.stun > 0) { p.vx *= 0.5; p.vz *= 0.5; }
  p.x += p.vx * dt; p.z += p.vz * dt;
  const s = Math.hypot(p.vx, p.vz);
  if (s > 0.4) {
    // facing turns toward the way he runs
    const tx = p.vx / s, tz = p.vz / s, t = Math.min(1, RUN.turn * dt);
    p.fx += (tx - p.fx) * t; p.fz += (tz - p.fz) * t;
    const l = Math.hypot(p.fx, p.fz) || 1; p.fx /= l; p.fz /= l;
  }
  p.stride += dt * strideRate(s);
}

// After a goal: the scorers run off, everyone else trots back.
function celebrate(w, p) {
  if (p.team === w.scorers) return p.id === w.scorer ? { x: Math.sign(p.x || 1) * 5, z: 0 } : { x: 0, z: 0 };
  return { x: 0, z: 0 };
}

// The keeper with the ball in his hands: out to the best man after a moment, or a big kick upfield.
function distribute(w, p, dt, ev, rnd) {
  p.holdT = (p.holdT || 0) + dt;
  if (p.holdT < BRAIN.keepHold) return;
  const q = bestPass(w, p);
  if (q && rnd() < 0.85) passTo(w, p, q, ev);
  else {
    // a big kick that comes down around halfway, whatever the size of the pitch
    const d = dirOf(p.team), vy = 12, vh = (w.L * 0.9) / (2 * vy / 9.81);
    kickBall(w, p, (rnd() - 0.5) * 6, vy, d * vh, 'clear', ev, null, 0.9);
  }
  p.holding = false; p.holdT = 0;
}

// The ball: at the feet of whoever has it, or loose (flying, rolling, picked up, deflected, out, in).
function ball(w, dt, ev, rnd) {
  const b = w.ball;
  if (w.owner) {
    const p = w.byId[w.owner];
    if (!p || (!isUp(p) && !p.holding)) { w.owner = null; return; }
    if (p.holding) { b.x = p.x + p.fx * 0.35; b.z = p.z + p.fz * 0.35; b.y = 1.0; b.vx = b.vy = b.vz = 0; return; }
    const s = Math.hypot(p.vx, p.vz), d = s > 0.6 ? { x: p.vx / s, z: p.vz / s } : { x: p.fx, z: p.fz }, lead = dribbleLead(p.stride, s);
    b.x = p.x + d.x * lead; b.z = p.z + d.z * lead; b.y = 0.12; b.vx = p.vx; b.vy = 0; b.vz = p.vz;
    return;
  }
  const out = [];
  stepBall(b, dt, w.L, w.W, out);
  for (const e of out) {
    if (w.phase !== 'play') continue;
    if (e.type === 'goal') {
      const team = e.end === dirOf('home') ? 'home' : 'away';
      w.score[team]++; w.phase = 'goal'; w.phaseT = CLOCK.goal; w.next = other(team); w.scorers = team;
      const by = w.lastKickBy && w.byId[w.lastKickBy];
      w.scorer = by && by.team === team ? by.id : null;
      ev.push({ type: 'goal', team, by: w.scorer, own: !(by && by.team === team), speed: e.speed, score: { ...w.score } });
    } else if (e.type === 'post') ev.push(e);
    else if (e.type === 'out') restart(w, e, ev);
  }
  if (b.inNet || w.phase !== 'play') return;
  // someone takes it: the nearest man on his feet close enough, the ball low and slow enough to control
  let best = null, bd = 1e9;
  const sp = Math.hypot(b.vx, b.vy, b.vz);
  for (const p of w.players) {
    // the man a pass is meant for reaches further for it, and takes it on his chest
    const meant = w.pass && w.pass.to === p.id;
    if (!isUp(p) || p.noBall > 0 || p.line === 'gk' || b.y > (meant ? 1.6 : KICK.pickupUp)) continue;
    if (w.noTouch.t > 0 && w.noTouch.team === p.team) continue;
    const d = Math.hypot(b.x - p.x, b.z - p.z);
    if (d > (meant ? 1.4 : KICK.pickup) || d >= bd) continue;
    best = p; bd = d;
  }
  if (!best) return;
  if (sp > KICK.control && !(w.pass && w.pass.to === best.id && sp < KICK.control + 6)) {
    // too hot to handle: off him, and a real thunderbolt takes him with it
    if (w.brawl && sp > HIT.shotLaunch) launch(w, best, b.vx * 0.45, b.vz * 0.45, 4, null, ev, 'shot');
    const s = groundSpeed(b) || 1;
    b.vx = -b.vx * 0.25 + (rnd() - 0.5) * s * 0.5; b.vz = -b.vz * 0.25; b.vy = Math.abs(b.vy) * 0.3 + 1.5;
    best.noBall = 0.3; w.lastTeam = best.team; w.lastKick = ++w.seq;
    ev.push({ type: 'block', id: best.id, speed: sp });
    return;
  }
  w.owner = best.id; w.lastTeam = best.team; w.pass = null; w.noTouch.t = 0; best.think = 0.3 + rnd() * 0.3;      // a touch before he decides
  ev.push({ type: 'received', id: best.id });
}

// Out of play: the ball goes back on, and the side that put it out can't touch it for a moment.
function restart(w, e, ev) {
  const b = w.ball, against = w.lastTeam || 'home', to = other(against);
  Object.assign(b, { vx: 0, vy: 0, vz: 0, y: 0.12, inNet: 0 });
  if (e.where === 'side') { b.x = Math.sign(e.x) * (w.W - 0.4); b.z = Math.max(-w.L + 1, Math.min(w.L - 1, e.z)); }
  else {
    // over a goal line: a goal kick if the attackers put it out, a corner if the defenders did
    const defending = ownLine(w, 'home') * e.end > 0 ? 'home' : 'away';
    if (against === defending) { b.x = Math.sign(e.x || 1) * (w.W - 0.5); b.z = e.end * (w.L - 0.5); }
    else {
      const gk = w.players.find(p => p.team === defending && p.line === 'gk');
      b.x = 0; b.z = e.end * (w.L - 6);
      if (gk && isUp(gk)) { gk.x = b.x; gk.z = b.z - e.end * 0.4; gk.holding = true; w.owner = gk.id; gk.holdT = 0; }
    }
  }
  w.noTouch = { team: against, t: CLOCK.restart + 0.6 };
  w.phase = 'restart'; w.phaseT = CLOCK.restart; w.pass = null;
  ev.push({ type: 'out', where: e.where, to });
}

// Men on their feet don't stand inside each other.
function separate(w) {
  const ps = w.players.filter(isUp);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], c = ps[j], dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
    if (d > 0.62 || d < 1e-4) continue;
    const k = (0.62 - d) / 2 / d;
    a.x -= dx * k; a.z -= dz * k; c.x += dx * k; c.z += dz * k;
  }
  for (const p of ps) { p.x = Math.max(-w.W - 2, Math.min(w.W + 2, p.x)); p.z = Math.max(-w.L - 2.5, Math.min(w.L + 2.5, p.z)); }
}
