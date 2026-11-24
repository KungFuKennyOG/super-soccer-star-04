// The ball in the brawl's match: at the feet of whoever has it (or over a thrower's head, or in a keeper's
// gloves), or loose: flying, rolling, picked up (offside judged then), deflected, out of play, in the net.
// Pure. ballStep returns what happened to a shoot-out kick this step: 'goal', 'saved' or null.
import { KICK, HIT, CLOCK, CHAOS } from './tuning.js';
import { dirOf, other } from './world.js';
import { stepBall, groundSpeed } from './ball.js';
import { launch, isUp } from './hits.js';
import { touched } from './offside.js';
import { outOfPlay, startSetPiece } from './setpiece.js';
import { dribbleLead } from '../dribble.js';

export function ballStep(w, dt, ev, rnd) {
  const b = w.ball, so = w.phase === 'shootout';
  if (w.owner) {
    const p = w.byId[w.owner];
    if (!p || (!isUp(p) && !p.holding)) { w.owner = null; return null; }
    if (p.throwing) { b.x = p.x + p.fx * 0.05; b.z = p.z + p.fz * 0.05; b.y = 2.25; b.vx = b.vy = b.vz = 0; return null; }
    if (p.holding) { b.x = p.x + p.fx * 0.35; b.z = p.z + p.fz * 0.35; b.y = 1.0; b.vx = b.vy = b.vz = 0; return null; }
    const s = Math.hypot(p.vx, p.vz), d = s > 0.6 ? { x: p.vx / s, z: p.vz / s } : { x: p.fx, z: p.fz }, lead = dribbleLead(p.stride, s);
    b.x = p.x + d.x * lead; b.z = p.z + d.z * lead; b.y = 0.12; b.vx = p.vx; b.vy = 0; b.vz = p.vz;
    return null;
  }
  // a dead ball waiting for its taker stays where it is
  if (w.sp && w.sp.stage !== 'flight') return null;
  const out = [];
  stepBall(b, dt, w.L, w.W, out);
  let outcome = so && ev.some(e => e.type === 'saved') ? 'saved' : null;
  for (const e of out) {
    if (so) { if (e.type === 'goal') { outcome = 'goal'; ev.push({ type: 'net', end: e.end, x: e.x, y: e.y }); } else if (e.type === 'post') ev.push(e); continue; }
    if (w.phase !== 'play') continue;
    if (e.type === 'goal') goal(w, e, ev, rnd);
    else if (e.type === 'post') ev.push(e);
    else if (e.type === 'out') { ev.push({ type: 'out', where: e.where, to: other(w.lastTeam || 'home'), byShot: w.lastKind === 'shot' }); outOfPlay(w, e, ev); }
  }
  if (b.inNet || w.phase !== 'play') return outcome;
  pickup(w, ev, rnd);
  return outcome;
}

function goal(w, e, ev, rnd) {
  const team = e.end === dirOf(w, 'home') ? 'home' : 'away';
  w.score[team]++; w.phase = 'goal'; w.phaseT = CLOCK.goal; w.next = other(team); w.scorers = team; w.offside = null;
  const by = w.lastKickBy && w.byId[w.lastKickBy];
  w.scorer = by && by.team === team ? by.id : null;
  // the brawl: now and then one of theirs goes for the scorer after the whistle
  w.late = null;
  if (w.brawl && w.scorer && rnd() < CHAOS.late) {
    const sc = w.byId[w.scorer], men = w.players.filter(p => p.team !== team && p.line !== 'gk' && isUp(p));
    men.sort((a, c) => Math.hypot(a.x - sc.x, a.z - sc.z) - Math.hypot(c.x - sc.x, c.z - sc.z));
    if (men[0]) w.late = { id: men[0].id, on: sc.id };
  }
  ev.push({ type: 'goal', team, by: w.scorer, own: !(by && by.team === team), speed: e.speed, end: e.end, score: { ...w.score } });
}

// Someone takes it: the nearest man on his feet close enough, the ball low and slow enough to control.
// The man a pass is meant for reaches further for it and takes it on his chest.
function pickup(w, ev, rnd) {
  const b = w.ball, sp = Math.hypot(b.vx, b.vy, b.vz);
  let best = null, bd = 1e9;
  for (const p of w.players) {
    const meant = w.pass && w.pass.to === p.id;
    if (!isUp(p) || p.noBall > 0 || p.line === 'gk' || b.y > (meant ? 1.6 : KICK.pickupUp)) continue;
    if (w.noTouch.t > 0 && w.noTouch.team === p.team) continue;
    const d = Math.hypot(b.x - p.x, b.z - p.z);
    if (d > (meant ? 1.4 : KICK.pickup) || d >= bd) continue;
    best = p; bd = d;
  }
  if (!best) return;
  // offside: he was beyond the line when it was played to him
  const off = touched(w, best);
  if (off) {
    ev.push({ type: 'offside', id: best.id, x: off.x, z: off.z });
    startSetPiece(w, 'free', other(best.team), { x: Math.max(-w.W + 0.5, Math.min(w.W - 0.5, off.x)), z: off.z }, ev);
    return;
  }
  // a super shot goes straight through the other side's men
  if (w.super && w.super.kick === w.lastKick && sp > 14) {
    if (best.team !== w.super.team) { launch(w, best, b.vx * 0.4 / w.chaos, b.vz * 0.4 / w.chaos, 5, null, ev, 'shot'); b.vx *= 0.93; b.vz *= 0.93; }
    best.noBall = 0.4;
    return;
  }
  // (a side's heavy ball, rules/brawl/chaos.js: only off its own boot, only into the other side)
  const heavy = w.cx && w.cx.heavy > 0 && w.lastTeam === w.cx.heavyTeam && best.team !== w.cx.heavyTeam;
  if ((sp > KICK.control || (heavy && sp > CHAOS.heavyAt)) && !(w.pass && w.pass.to === best.id && sp < KICK.control + 6)) {
    // too hot to handle: off him, and in the brawl a real thunderbolt takes him with it
    if (w.brawl && sp > (heavy ? CHAOS.heavyAt : HIT.shotLaunch)) launch(w, best, b.vx * 0.45, b.vz * 0.45, 4, null, ev, 'shot');
    const s = groundSpeed(b) || 1;
    b.vx = -b.vx * 0.25 + (rnd() - 0.5) * s * 0.5; b.vz = -b.vz * 0.25; b.vy = Math.abs(b.vy) * 0.3 + 1.5;
    best.noBall = 0.3; w.lastTeam = best.team; w.lastKick = ++w.seq;
    ev.push({ type: 'block', id: best.id, speed: sp });
    return;
  }
  w.owner = best.id; w.lastTeam = best.team; w.pass = null; w.noTouch.t = 0; best.think = 0.3 + rnd() * 0.3;      // a touch before he decides
  ev.push({ type: 'received', id: best.id });
}
