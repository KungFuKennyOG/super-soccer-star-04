// The brawl's keepers: on their line between the ball and the middle of the goal, out to claim a loose ball
// nobody else is near, a dive at shots coming at goal (caught, parried or beaten), and the ball thrown or
// kicked back out. Pure. Sets p.save { id, kind, y, eta } and p.dive (-1 / 0 / 1) the way game/keeperpose.js
// plays them.
import { KEEPER, RUN, GOAL2 } from './tuning.js';
import { dirOf, ownLine } from './world.js';
import { predictLine, speed3 } from './ball.js';
import { isUp } from './hits.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Every step, for each keeper who is on his feet. Returns where he wants to be ({ x, z, speed }).
// goal: the end he's keeping (-1 / 1), when it isn't his side's own (a shoot-out).
export function keeperStep(w, p, dt, ev, rnd = Math.random, goal = null) {
  const b = w.ball, dir = goal ? -goal : dirOf(w, p.team), line = goal ? goal * w.L : ownLine(w, p.team), end = -dir;
  if (p.holding) return { x: p.x, z: p.z, speed: 0 };
  // a shot (or any ball) on its way at his goal
  // (a shot, or anything else hit hard enough to be one; a pass is claimed below instead)
  if (!w.owner && speed3(b) > (w.lastKind === 'shot' ? 7 : 17) && b.vz * end > 0) {
    const c = predictLine(b, end, w.L);
    if (c && Math.abs(c.x) < GOAL2.halfW + 0.8 && c.y < GOAL2.h + 0.5) {
      if (!p.save || p.save.id !== w.lastKick) {
        // can he get there (his reach plus how far he can dive in the time), and if so, does he keep it out
        const dx = c.x - p.x, sp = speed3(b), can = Math.abs(dx) < KEEPER.reach + KEEPER.dive * Math.max(0, c.t - KEEPER.react) * 0.6 && c.y < KEEPER.reachUp;
        const chance = can ? clamp(1.18 - sp / 75 - Math.abs(dx) / 15 - (c.y > 1.9 ? 0.12 : 0), 0.15, 0.9) : 0;
        const ok = rnd() < chance;
        p.save = { id: w.lastKick, kind: ok ? (sp < KEEPER.catchBelow && Math.abs(dx) < 1.6 ? 'catch' : 'parry') : 'beaten', y: c.y, eta: c.t, ok, x: c.x };
        p.dive = Math.abs(dx) > 0.9 ? Math.sign(dx) : 0;      // (game/keepersave.js turns it his way from where the ball really is)
      }
      p.save.eta = c.t;
      // the ball reaches him
      if (p.save.ok && (b.z - p.z) * end > -0.4 && Math.abs(b.x - p.x) < KEEPER.reach + 0.4 && b.y < KEEPER.reachUp + 0.3) saveIt(w, p, ev, rnd, dir);
      // (a penalty: he's already gone the way he guessed)
      return { x: p.save.pen ? p.save.x : clamp(c.x, -GOAL2.halfW, GOAL2.halfW), z: line + dir * KEEPER.line * 0.5, speed: KEEPER.dive };
    }
  }
  // a loose ball near him that he gets to first
  if (!w.owner && b.y < 1.6) {
    const d = Math.hypot(b.x - p.x, b.z - p.z), inBox = Math.abs(b.x) < 20 && (b.z - line) * dir < 16.5;
    const nearest = w.players.every(q => q === p || !isUp(q) || Math.hypot(b.x - q.x, b.z - q.z) > d - 0.5);
    if ((inBox || (w.pass && w.pass.to === p.id)) && d < KEEPER.claim && nearest) {
      if (d < 1.1) { if (w.offside && w.offside.team !== p.team) w.offside = null; p.holding = true; w.owner = p.id; w.lastTeam = p.team; p.holdT = 0; p.save = null; ev.push({ type: 'claim', id: p.id }); }
      return { x: b.x, z: b.z, speed: RUN.sprint };
    }
  }
  if (p.save && w.owner) p.save = null;
  const tx = clamp(b.x * KEEPER.track, -1.6, 1.6);       // on the line from the ball to the middle of the goal, near enough
  return { x: tx, z: line + dir * KEEPER.line, speed: RUN.gk };
}

function saveIt(w, p, ev, rnd, dir) {
  const b = w.ball;
  if (w.offside && w.offside.team !== p.team) w.offside = null;
  if (p.save.kind === 'catch') {
    p.holding = true; w.owner = p.id; w.lastTeam = p.team; p.holdT = 0;
    b.vx = b.vy = b.vz = 0;
    ev.push({ type: 'saved', id: p.id, kind: 'catch' });
  } else {
    const s = Math.hypot(b.vx, b.vz);
    b.vz = dir * s * (0.25 + 0.2 * rnd()); b.vx = (rnd() < 0.5 ? -1 : 1) * s * (0.3 + 0.3 * rnd()); b.vy = Math.abs(b.vy) * 0.4 + 2;
    w.lastTeam = p.team; w.lastKick = ++w.seq;
    ev.push({ type: 'saved', id: p.id, kind: 'parry' });
  }
  p.save = { ...p.save, ok: false, done: true };
}
