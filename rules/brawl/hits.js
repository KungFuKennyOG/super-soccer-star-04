// Hits: lunges, shoulder barges, men sent flying, bodies that flatten whoever they land on, and getting up.
// Pure. A man in the air is p.state 'air' with p.air = { x, y, z, vx, vy, vz } (his middle, about hip height);
// he lands, slides, lies there ('down') and gets up ('getup', then 'up'). The page draws him as a ragdoll
// (game/brawl/ragdoll.js) and only reads this to know where he ends up.
import { HIT, BODY } from './tuning.js';

const up = p => p.state === 'up';
let uid = 0;

// Start a lunge the way he faces (or along dir). big: a sprinting, full-weight hit.
export function startLunge(p, dir = null, big = false) {
  if (!up(p) || p.lunge || p.cool > 0) return false;
  const d = dir || { x: p.fx, z: p.fz }, l = Math.hypot(d.x, d.z) || 1;
  p.lunge = { t: HIT.t, x: d.x / l, z: d.z / l, big, hit: false };
  p.cool = HIT.cool;
  return true;
}

// Send p flying: horizontal velocity (vx, vz), straight up vy. Pushes a 'launch' event.
export function launch(w, p, vx, vz, vy, by, ev, kind = 'hit') {
  if (p.state === 'air') return;
  const c = w.chaos;
  p.state = 'air'; p.lunge = null; p.holding = false; p.save = null;
  p.air = { x: p.x, y: BODY.y, z: p.z, vx: vx * c, vy: vy * (0.6 + 0.4 * c), vz: vz * c, x0: p.x, z0: p.z, id: ++uid };
  if (w.owner === p.id) {
    // the ball comes loose, popped forward off his feet
    w.owner = null; const b = w.ball;
    b.vx = p.vx * 0.5 + vx * 0.25; b.vz = p.vz * 0.5 + vz * 0.25; b.vy = 2.5;
    w.noTouch = { team: null, t: 0 }; p.noBall = 0.8;
  }
  w.stats.hits++;
  ev.push({ type: 'launch', id: p.id, by: by ? by.id : null, power: Math.hypot(vx, vz) * c, up: vy, kind, air: p.air.id });
}

// How hard a hit by `h` sends `v` flying: along the hitter's run, a little away from him.
function hitVel(h, v, big, rnd) {
  const s = Math.hypot(h.vx, h.vz);
  let dx = h.lunge ? h.lunge.x : h.fx, dz = h.lunge ? h.lunge.z : h.fz;
  const ax = v.x - h.x, az = v.z - h.z, al = Math.hypot(ax, az) || 1;
  dx = dx * 0.7 + ax / al * 0.3; dz = dz * 0.7 + az / al * 0.3;
  const l = Math.hypot(dx, dz) || 1, sp = (HIT.base + HIT.k * s) * (big ? HIT.big : HIT.jab) * (0.85 + 0.3 * rnd());
  return { vx: dx / l * sp, vz: dz / l * sp, vy: big ? HIT.up[0] + (HIT.up[1] - HIT.up[0]) * rnd() : 1.2 + 1.5 * rnd() };
}

// Every step: lunges move their man and flatten whoever they reach; the man on the ball barges anyone in
// front of him if he presses tackle (p.barge); bodies fly, bounce, slide and flatten others; the downed get up.
export function stepHits(w, dt, ev, rnd = Math.random) {
  for (const p of w.players) {
    if (p.cool > 0) p.cool -= dt;
    if (p.lunge) {
      const L = p.lunge;
      L.t -= dt;
      const sp = HIT.lunge * (L.big ? 1.15 : 1);
      p.vx = L.x * sp; p.vz = L.z * sp; p.fx = L.x; p.fz = L.z;
      for (const v of w.players) {
        if (v === p || !up(v) || Math.hypot(v.x - p.x, v.z - p.z) > HIT.reach) continue;
        // plain football: only the man on the ball can be tackled, and the tackler comes away with it
        if (!w.brawl) {
          if (v.id === w.owner && !v.holding && !L.tried) {
            // from in front it usually comes off; from behind, or at a man going away at speed, less often
            L.tried = true;
            const front = (p.x - v.x) * v.fx + (p.z - v.z) * v.fz > 0, k = (L.big ? HIT.slideWin : HIT.win) * (front ? 1 : 0.6);
            if (rnd() < k) { tackle(w, p, v, L.big, ev); L.hit = true; L.t = Math.min(L.t, 0.08); }
          }
          continue;
        }
        const k = hitVel(p, v, L.big, rnd);
        launch(w, v, k.vx, k.vz, k.vy, p, ev, L.big ? 'big' : 'hit');
        L.hit = true;
      }
      if (L.t <= 0) {
        // a lunge at nothing: he ends up on the floor for a moment
        if (!L.hit && !w.brawl) { p.stun = L.big ? 0.6 : 0.3; ev.push({ type: 'miss', id: p.id, quiet: true }); }
        else if (!L.hit) { p.state = 'down'; p.downT = HIT.miss; p.getT = 0; p.vx *= 0.3; p.vz *= 0.3; ev.push({ type: 'miss', id: p.id }); }
        p.lunge = null;
      }
    }
    if (p.barge && up(p)) {
      p.barge = false;
      for (const v of w.players) {
        if (v === p || !up(v) || v.team === p.team) continue;
        const dx = v.x - p.x, dz = v.z - p.z, d = Math.hypot(dx, dz);
        if (d > HIT.barge || dx * p.fx + dz * p.fz < -0.3 * d) continue;
        if (!w.brawl) { v.stun = 0.3; ev.push({ type: 'shoved', id: v.id, by: p.id }); continue; }
        const k = hitVel(p, v, false, rnd);
        launch(w, v, k.vx * 0.8, k.vz * 0.8, k.vy * 0.7, p, ev, 'barge');
      }
    }
    if (p.state === 'air') fly(w, p, dt, ev);
    else if (p.state === 'down') {
      p.vx *= Math.exp(-8 * dt); p.vz *= Math.exp(-8 * dt);
      if ((p.downT -= dt) <= 0) { p.state = 'getup'; p.getT = BODY.getup; ev.push({ type: 'getup', id: p.id }); }
    } else if (p.state === 'getup') {
      p.vx = p.vz = 0;
      if ((p.getT -= dt) <= 0) { p.state = 'up'; p.stun = 0.15; }
    }
  }
}

// A clean tackle: the ball is his, and the man who had it stumbles (longer after a slide).
function tackle(w, p, v, big, ev) {
  w.owner = p.id; w.lastTeam = p.team; w.pass = null;
  v.stun = big ? 0.7 : 0.4; v.noBall = 0.6;
  ev.push({ type: 'tackled', id: v.id, by: p.id, slide: big });
}

function fly(w, p, dt, ev) {
  const a = p.air;
  a.vy -= 9.81 * dt;
  a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
  const onGround = a.y <= BODY.rest;
  if (onGround) {
    a.y = BODY.rest;
    if (a.vy < -2.5) { a.vy = -a.vy * BODY.bounce; ev.push({ type: 'thud', id: p.id, hard: Math.min(1, -a.vy / 6) }); }
    else a.vy = 0;
    const h = Math.hypot(a.vx, a.vz), nh = Math.max(0, h - BODY.slide * dt);
    if (h > 1e-6) { a.vx *= nh / h; a.vz *= nh / h; }
  }
  // the boards: bodies stop at the advertising hoardings a little outside the lines (and bounce off them)
  const bx = w.W + 3, bz = w.L + 4;
  if (Math.abs(a.x) > bx) { a.x = Math.sign(a.x) * bx; a.vx = -a.vx * 0.3; ev.push({ type: 'boards', id: p.id }); }
  if (Math.abs(a.z) > bz) { a.z = Math.sign(a.z) * bz; a.vz = -a.vz * 0.3; ev.push({ type: 'boards', id: p.id }); }
  p.x = a.x; p.z = a.z; p.vx = a.vx; p.vz = a.vz;
  // dominoes: a body still going fast flattens whoever it reaches
  const s = Math.hypot(a.vx, a.vz);
  if (s > HIT.domino && a.y < 1.6) for (const v of w.players) {
    if (v === p || !up(v) || Math.hypot(v.x - a.x, v.z - a.z) > HIT.dominoR) continue;
    const k = HIT.dominoKeep / w.chaos;
    launch(w, v, a.vx * k, a.vz * k, 3 + s * 0.2, p, ev, 'domino');
    a.vx *= 0.7; a.vz *= 0.7;
  }
  if (onGround && Math.hypot(a.vx, a.vz) < 0.4 && Math.abs(a.vy) < 0.5) {
    const flown = Math.hypot(a.x - a.x0, a.z - a.z0);
    w.stats.longest = Math.max(w.stats.longest, flown); w.stats.flown += flown;
    p.state = 'down'; p.downT = BODY.down[0] + (BODY.down[1] - BODY.down[0]) * ((a.id * 0.618) % 1); p.vx = p.vz = 0;
    ev.push({ type: 'landed', id: p.id, flown });
  }
}

export const isUp = up;
