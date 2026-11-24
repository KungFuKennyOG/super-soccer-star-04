// The brawl's AI: what every man on the pitch who isn't yours does. Pure.
// The side on the ball keeps its shape pushed up, the man on it dribbles at goal, passes when pressed and
// shoots when he sees it; the other side presses the ball with its nearest two, who go in hard, and
// everyone else slides across with the ball. A loose ball is chased by the nearest man of each side.
import { BRAIN, RUN, HIT, FOUL, CHAOS } from './tuning.js';
import { spendOnSuper } from './chaos.js';
import { inBox } from './fouls.js';
import { offsideLine } from './offside.js';
import { dirOf, shapeSpot } from './world.js';
import { bestPass, passTo, shoot, shotChance } from './kicks.js';
import { startLunge, isUp } from './hits.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Who chases what this step: per side, the men nearest the ball (or the carrier). Kept on w.brain.
export function plan(w) {
  const b = w.ball, car = w.owner ? w.byId[w.owner] : null, jobs = {};
  for (const team of ['home', 'away']) {
    const men = w.players.filter(p => p.team === team && p.line !== 'gk' && isUp(p));
    const at = car ? car : { x: b.x + b.vx * 0.35, z: b.z + b.vz * 0.35 };
    men.sort((a, c) => dist(a, at) - dist(c, at));
    if (!car) {
      // a pass on its way: its man goes for it, and the nearest of the other side
      const to = w.pass && w.byId[w.pass.to];
      jobs[team] = to && to.team === team ? [to.id] : men.slice(0, 1).map(p => p.id);
    } else if (car.team !== team) {
      // one man presses; a second joins once the ball is in our half (always, in the brawl)
      const inOurHalf = car.z * dirOf(w, car.team) > 0;
      jobs[team] = men.slice(0, w.brawl || inOurHalf ? BRAIN.press : 1).map(p => p.id);
    }
    else jobs[team] = [];
  }
  w.brain.jobs = jobs;
}

// What p wants to do this step: { x, z } a velocity (m/s), plus actions done straight on the world.
export function think(w, p, dt, ev, rnd = Math.random) {
  const b = w.ball, dir = dirOf(w, p.team), jobs = w.brain.jobs[p.team] || [];
  const car = w.owner ? w.byId[w.owner] : null;
  if (car === p) return carry(w, p, dt, ev, rnd);
  // chasing the ball or pressing the man on it
  if (jobs.includes(p.id)) {
    if (!car) {
      const lead = Math.min(0.6, dist(p, b) / 14), t = { x: b.x + b.vx * lead, z: b.z + b.vz * lead };
      return toward(p, t, RUN.sprint, true);
    }
    const d = dist(p, car);
    // in range: go in (a big one if he's in the mood), from goal-side if there's time
    // (in plain football a defender in his own box is careful: fewer tackles, almost no slides)
    const care = !w.brawl && inBox(w, p.team, car.x, car.z) ? FOUL.boxCare : 1;
    if (d < BRAIN.tackleAt && p.cool <= 0 && rnd() < dt * BRAIN.lungeRate * care) {
      const big = rnd() < (w.brawl ? BRAIN.aggro : 0.2 * care);        // (in plain football a big one is a slide)
      startLunge(p, { x: car.x + car.vx * 0.12 - p.x, z: car.z + car.vz * 0.12 - p.z }, big);
      return { x: p.vx, z: p.vz, sprint: big };
    }
    const t = { x: car.x + car.vx * 0.3, z: car.z + car.vz * 0.3 - dir * (d > 6 ? 1.5 : 0) };
    return toward(p, t, RUN.sprint, true);
  }
  // an off-the-ball hit now and then: a man of the other side right next to you is fair game
  if (w.brawl && p.cool <= 0 && rnd() < dt * 0.25 * w.chaos) {
    const v = w.players.find(o => o.team !== p.team && isUp(o) && o.line !== 'gk' && dist(o, p) < 1.8);
    if (v) { startLunge(p, { x: v.x - p.x, z: v.z - p.z }, rnd() < 0.3); ev.push({ type: 'cheap', id: p.id, on: v.id }); return { x: p.vx, z: p.vz }; }
  }
  // in shape; a forward on his side's ball makes a run beyond the last man
  let s = shapeSpot(w, p);
  if (car && car.team === p.team && p.line === 'fwd') s = { x: s.x, z: s.z + dir * 6 };
  // stay onside: never further up than the second-last man of theirs (or the ball)
  if (car && car.team === p.team) { const line = offsideLine(w, p.team) - 0.6; if (s.z * dir > line && s.z * dir > 0) s = { x: s.x, z: line * dir }; }
  return toward(p, s, dist(p, s) > 8 ? RUN.run : RUN.jog, false);
}

// The man on the ball.
function carry(w, p, dt, ev, rnd) {
  const dir = dirOf(w, p.team), gz = dir * w.L;
  p.think -= dt;
  const foes = w.players.filter(o => o.team !== p.team && isUp(o));
  // the nearest man in front of him (one behind him isn't stopping him going forward)
  const near = foes.reduce((m, o) => ((o.z - p.z) * dir > -0.8 ? Math.min(m, dist(o, p)) : m), 99);
  if (p.think <= 0) {
    p.think = BRAIN.think * (0.7 + 0.6 * rnd());
    const ch = shotChance(w, p);
    if (ch > 0.42 || (ch > 0.2 && rnd() < 0.25)) {
      const gk = w.players.find(o => o.team !== p.team && o.line === 'gk');
      const aim = (gk && gk.x > 0 ? -1 : 1) * (rnd() * 1.2 - 0.25);      // mostly away from the keeper, now and then at him
      // with a favour in hand, sometimes it goes on a super shot
      const sup = w.brawl && rnd() < CHAOS.aiSuper && spendOnSuper(w, p.team);
      shoot(w, p, sup ? 1 : 0.45 + rnd() * 0.55, aim, ev, 0, undefined, sup);
      return { x: p.vx, z: p.vz };
    }
    if (near < BRAIN.pressured) {
      const r = rnd();
      if (r < 0.55) { const q = bestPass(w, p); if (q && (q.z - p.z) * dir > -4) { passTo(w, p, q, ev); return { x: p.vx, z: p.vz }; } }
      if (r > 0.85) p.barge = true;              // straight through him
    } else if (rnd() < BRAIN.passLook * BRAIN.think) {
      const q = bestPass(w, p);
      if (q && (q.z - p.z) * dir > 9 && (gz - q.z) * dir > 8) { passTo(w, p, q, ev); return { x: p.vx, z: p.vz }; }
    }
  }
  // dribble at goal, bending away from the nearest man in front
  let tx = 0 - p.x * 0.3, tz = gz - p.z;
  const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
  for (const o of foes) {
    const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
    if (d > 7 || dx * tx + dz * tz < 0) continue;
    const k = (7 - d) / 7, sx = -tz, sz = tx, side = dx * sx + dz * sz > 0 ? -1 : 1;
    tx += sx * side * k * 1.2; tz += sz * side * k * 1.2;
  }
  const m = Math.hypot(tx, tz) || 1, sprint = near > 2.5;
  const sp = sprint ? RUN.dribbleSprint : RUN.dribble;
  return { x: tx / m * sp, z: tz / m * sp, sprint };
}

// A velocity toward t, easing in as he arrives.
export function toward(p, t, top, sprint) {
  const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.25) return { x: 0, z: 0 };
  const sp = Math.min(top, d * 2.2);
  return { x: dx / d * sp, z: dz / d * sp, sprint: sprint && sp > RUN.run * 0.9 };
}

export const LUNGE_RANGE = HIT.reach + HIT.lunge * HIT.t;
