// The brawl's match: one step of everything. Pure.
//   const w = createBrawl({ n: 11 });  each frame: const ev = stepBrawl(w, input, dt);
// input (yours, for w.ctrl, a home player): { move: { x, z } world direction, length 0..1, sprint,
// pass (pressed this frame), shoot (held), tackle (pressed), switch (pressed) }. input.auto: the AI plays
// your side too (a demo, the tests).
// Phases: kickoff → play ⇄ setpiece, goal, half (half time), shootout, full.
// Events: kickoff, halftime, pass, shot, throw, clear, received, tackled, foul, card, offside, setpiece,
// ready, taking, taken, launch, landed, thud, boards, miss, getup, saved, claim, post, goal { team, by },
// out, shootout, pen, fulltime, switch, crowd, chaos (rules/brawl/chaos.js), signal (the referee's: rules/brawl/referee.js).
import { RUN, KICK, CLOCK, BRAIN } from './tuning.js';
import { dirOf, kickoff, other } from './world.js';
import { stepHits, startLunge, startDodge, isUp } from './hits.js';
import { keeperStep } from './keeper.js';
import { plan, think, toward } from './ai.js';
import { passTo, bestPass, shoot, kickBall } from './kicks.js';
import { stepSetPiece, setPieceSpot, startSetPiece } from './setpiece.js';
import { referee, sendOff } from './fouls.js';
import { startShootout, stepShootout } from './shootout.js';
import { ballStep } from './play.js';
import { createRef, refEvents, stepRef, refSignals } from './referee.js';
import { stepChaos, dodge, spendOnSuper } from './chaos.js';
import { CHAOS } from './tuning.js';
import { strideRate } from '../dribble.js';

const NONE = { move: { x: 0, z: 0 } };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function stepBrawl(w, input = NONE, dt = 1 / 60, rnd = Math.random) {
  const ev = [];
  if (!w.ref) createRef(w);
  w.t += dt;
  clock(w, dt, ev, rnd);
  if (w.noTouch.t > 0) w.noTouch.t -= dt;
  if (w.pass) { w.pass.t += dt; if (w.pass.t > 3) w.pass = null; }

  const live = w.phase === 'play' || w.phase === 'setpiece';
  if (w.phase !== 'shootout') pickCtrl(w, input, ev);
  if (live) plan(w);
  if (w.sp) stepSetPiece(w, dt, input, ev, rnd);

  for (const p of w.players) {
    if (p.noBall > 0) p.noBall -= dt;
    if (p.stun > 0) p.stun -= dt;
    if (p.kicked) { p.kicked.t += dt; if (p.kicked.t > 0.5) p.kicked = null; }
    if (!isUp(p)) { p.stride += dt * strideRate(Math.hypot(p.vx, p.vz)); continue; }
    p.sprint = false;
    move(p, wantOf(w, p, input, dt, ev, rnd, live), dt);
  }

  stepHits(w, dt, ev, rnd);
  if (w.brawl) stepChaos(w, dt, ev, rnd, input);
  if (w.phase === 'play') for (const e of ev) if (e.type === 'foul') { whistle(w, e, ev, rnd); break; }
  const outcome = ballStep(w, dt, ev, rnd);
  if (w.phase === 'shootout') stepShootout(w, dt, ev, outcome);
  separate(w);
  refEvents(w, ev);
  stepRef(w, dt);
  ev.push(...refSignals(w));
  return ev;
}

// The match clock and the phases that wait on it.
function clock(w, dt, ev, rnd) {
  if (w.phase === 'kickoff') {
    if ((w.phaseT -= dt) > 0) return;
    w.phase = 'play';
    const tk = w.byId[w.taker];
    if (tk) { w.owner = tk.id; w.lastTeam = tk.team; }
    if (w.kickoffTeam === 'home' && tk) w.ctrl = tk.id;
    ev.push({ type: 'kickoff', team: w.kickoffTeam, half: w.half });
  } else if (w.phase === 'goal') {
    if ((w.phaseT -= dt) <= 0) kickoff(w, w.next);
  } else if (w.phase === 'half') {
    if ((w.phaseT -= dt) <= 0) { w.half = 2; kickoff(w, other(w.firstKick)); }
  } else if (w.phase === 'play' || w.phase === 'setpiece') {
    w.clock += dt;
    if (w.half === 1 && w.clock >= w.real / 2) {
      w.clock = w.real / 2; w.phase = 'half'; w.phaseT = CLOCK.half; w.sp = null; w.owner = null;
      ev.push({ type: 'halftime', score: { ...w.score } });
    } else if (w.clock >= w.real) {
      w.clock = w.real; w.sp = null; w.owner = null;
      if (w.knockout && w.score.home === w.score.away) startShootout(w, ev, rnd);
      else { w.phase = 'full'; ev.push({ type: 'fulltime', score: { ...w.score } }); }
    }
  }
}

// What each man on his feet wants to do this step: a velocity.
function wantOf(w, p, input, dt, ev, rnd, live) {
  if (p.lunge) return { x: p.vx, z: p.vz };
  if (w.sp && p.id === w.sp.taker) return w.sp.want || { x: 0, z: 0 };
  if (w.phase === 'shootout') {
    if (p.line === 'gk' && w.sp && p.team !== w.sp.team && w.sp.stage === 'flight') { const k = keeperStep(w, p, dt, ev, rnd, -1); return toward(p, k, k.speed, false); }
    return { x: 0, z: 0 };
  }
  if (p.dodge) return { x: p.dodge.x * CHAOS.dodge.v, z: p.dodge.z * CHAOS.dodge.v, sprint: true };
  if (!live) {
    if (w.phase !== 'goal') return { x: 0, z: 0 };
    // the brawl: the whistle has gone and it isn't over. You can still move and hit; one of theirs may go
    // for the scorer
    if (w.brawl && p.id === w.ctrl && !input.auto && p.line !== 'gk') return yours(w, p, input, dt, ev);
    if (w.brawl && w.late && w.late.id === p.id) {
      const sc = w.byId[w.late.on];
      if (!isUp(sc)) { w.late = null; return { x: 0, z: 0 }; }
      if (dist(p, sc) < 2.2) { startLunge(p, { x: sc.x - p.x, z: sc.z - p.z }, true); w.late = null; }
      return toward(p, sc, RUN.sprint, true);
    }
    return celebrate(w, p);
  }
  // the AI sees a tackle coming, sometimes
  if (!(p.id === w.ctrl && !input.auto) && p.line !== 'gk' && !p.dodge && (p.dodgeCool || 0) <= 0) {
    const t = w.players.find(o => o.lunge && o.team !== p.team && dist(o, p) < 2.2 && (p.x - o.x) * o.lunge.x + (p.z - o.z) * o.lunge.z > 0);
    if (t && rnd() < 0.05) startDodge(p, { x: -t.lunge.z, z: t.lunge.x });
  }
  const sp = w.phase === 'setpiece' ? setPieceSpot(w, p) : null;
  if (p.line === 'gk') {
    if (sp) return toward(p, sp, RUN.gk, false);
    const k = keeperStep(w, p, dt, ev, rnd);
    if (p.holding && w.phase === 'play') distribute(w, p, dt, ev, rnd);
    return toward(p, k, k.speed, false);
  }
  if (p.id === w.ctrl && !input.auto) return yours(w, p, input, dt, ev);
  const dg = w.brawl && dodge(w, p);
  if (dg) return dg;
  if (sp) return toward(p, sp, RUN.run, false);
  return think(w, p, dt, ev, rnd);
}

// You: the stick runs, sprint runs faster, pass goes to the man the stick points at, shoot charges while
// held and goes on release, tackle lunges (sprinting: a slide; on the ball: a shoulder). Only the movement
// while the other side has a set piece.
function yours(w, p, it, dt, ev) {
  const mv = it.move || NONE.move, m = Math.min(1, Math.hypot(mv.x, mv.z)), onBall = w.owner === p.id && w.phase === 'play';
  const top = (onBall ? (it.sprint ? RUN.dribbleSprint : RUN.dribble) : (it.sprint ? RUN.sprint : RUN.run)) * (p.boost > 0 ? CHAOS.dodge.by : 1);
  const aim = m > 0.2 ? { x: mv.x, z: mv.z } : { x: p.fx, z: p.fz };
  if (w.phase === 'play') {
    if (onBall && it.pass) { const q = bestPass(w, p, aim); if (q) passTo(w, p, q, ev); else kickBall(w, p, aim.x * 18, 2, aim.z * 18, 'pass', ev, null, 0.6); }
    if (onBall && it.shoot) w.charge = (w.charge || 0) + dt;
    else if (w.charge) {
      if (onBall) {
        // let go on a full bar (and before it's overcooked) with a favour in hand: it goes on a super shot
        const held = w.charge, sup = w.brawl && held >= KICK.maxHold && held <= KICK.overHold && spendOnSuper(w, p.team);
        shoot(w, p, Math.min(1, held / KICK.maxHold), mv.x * 1.3, ev, held, undefined, sup);
      }
      w.charge = 0;
    }
    if (it.tackle) { if (onBall) p.barge = true; else startLunge(p, aim, !!it.sprint); }
  } else if (w.brawl && w.phase === 'goal' && it.tackle) startLunge(p, aim, !!it.sprint);        // after the whistle
  if (it.dodge) startDodge(p, m > 0.2 ? { x: mv.x, z: mv.z } : null);
  if (p.dodge) return { x: p.dodge.x * CHAOS.dodge.v, z: p.dodge.z * CHAOS.dodge.v, sprint: true };
  return { x: mv.x / (m || 1) * top * m, z: mv.z / (m || 1) * top * m, sprint: it.sprint && m > 0.3 };
}

// Which home man you are: the one on the ball, the one a pass is going to, or (switch) the nearest the ball.
function pickCtrl(w, it, ev) {
  if (w.sp && w.sp.team === 'home' && w.sp.kind !== 'goalkick') return;       // the set piece's taker (setpiece.js)
  const car = w.owner && w.byId[w.owner], cur = w.byId[w.ctrl];
  let to = null;
  if (car && car.team === 'home' && car.line !== 'gk') to = car;
  else if (w.pass && w.byId[w.pass.to].team === 'home' && w.byId[w.pass.to].line !== 'gk') to = w.byId[w.pass.to];
  else if (it.switch || !cur || (!isUp(cur) && cur.state !== 'getup') || cur.line === 'gk') {
    const men = w.players.filter(p => p.team === 'home' && p.line !== 'gk' && isUp(p) && (!it.switch || p !== cur));
    men.sort((a, b) => dist(a, w.ball) - dist(b, w.ball));
    to = men[0] || null;
  }
  if (to && to.id !== w.ctrl) { w.ctrl = to.id; ev.push({ type: 'switch', id: to.id }); }
}

// A foul: the referee blows. A card (a second yellow or a red sends him off), then a free kick, or a
// penalty if it was in the box.
function whistle(w, e, ev, rnd) {
  const by = w.byId[e.id], on = w.byId[e.on], call = referee(w, by, on, e.big, e.behind, rnd);
  ev.push({ type: 'whistle', kind: call.kind, by: by.id, on: on.id });
  if (call.card) {
    ev.push({ type: 'card', id: by.id, color: call.card === 'yellow' ? 'yellow' : 'red', second: call.card === 'red2' });
    if (call.off) sendOff(w, by);
  }
  w.fouls[by.team]++;
  const spot = call.kind === 'penalty' ? { x: 0, z: dirOf(w, on.team) * (w.L - 11) } : { x: Math.max(-w.W + 0.5, Math.min(w.W - 0.5, e.x)), z: e.z };
  startSetPiece(w, call.kind, on.team, spot, ev);
}

function move(p, want, dt) {
  p.sprint = !!want.sprint;
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

// After a goal: the scorer runs off, everyone else stands.
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
    const d = dirOf(w, p.team), vy = 12, vh = (w.L * 0.9) / (2 * vy / 9.81);
    kickBall(w, p, (rnd() - 0.5) * 6, vy, d * vh, 'clear', ev, null, 0.9);
  }
  p.holding = false; p.holdT = 0;
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
