// The brawl's ball: flight, rolling, bounces, two goals (one at each end) with posts, bar and nets, and
// the touchlines. Pure. Same feel as rules/ball.js, which only knows the VR game's one goal.
import { BALL2, GOAL2 } from './tuning.js';

export const newBall = () => ({ x: 0, y: BALL2.r, z: 0, vx: 0, vy: 0, vz: 0, inNet: 0 });
export const groundSpeed = b => Math.hypot(b.vx, b.vz);
export const speed3 = b => Math.hypot(b.vx, b.vy, b.vz);

// Advance a loose ball. L: half the pitch length, W: half its width. Pushes events:
// goal { end: -1 | 1 (which goal line), x, y, speed }, post { end }, out { where: 'side' | 'byline', end, x, z }.
export function stepBall(b, dt, L, W, ev) {
  const r = BALL2.r, px = b.x, py = b.y, pz = b.z;
  if (b.y > r + 1e-3 || b.vy > 0) b.vy -= BALL2.g * dt;
  else {
    const h = groundSpeed(b), nh = Math.max(0, h - (BALL2.rollFric + BALL2.rollDrag * h) * dt);
    if (h > 1e-6) { b.vx *= nh / h; b.vz *= nh / h; }
  }
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.y < r) {
    b.y = r;
    if (b.vy < -1.2) { b.vy = -b.vy * BALL2.bounce; b.vx *= 0.88; b.vz *= 0.88; } else b.vy = 0;
  }
  if (b.inNet) { netStop(b, b.inNet, L); return; }
  for (const end of [-1, 1]) {
    const line = end * L;
    const crossed = end < 0 ? pz >= line && b.z < line : pz <= line && b.z > line;
    if (!crossed) continue;
    const t = (pz - line) / (pz - b.z), cx = px + (b.x - px) * t, cy = py + (b.y - py) * t, reach = r + GOAL2.post;
    if (Math.abs(cy - GOAL2.h) < reach && Math.abs(cx) < GOAL2.halfW + GOAL2.post) { frame(b, line, end, cy > GOAL2.h ? 1 : -1, 0); ev.push({ type: 'post', end, bar: true }); }
    else if (cy < GOAL2.h && Math.abs(Math.abs(cx) - GOAL2.halfW) < reach) { frame(b, line, end, 0, Math.abs(cx) > GOAL2.halfW ? Math.sign(cx) : -Math.sign(cx)); ev.push({ type: 'post', end, bar: false }); }
    else if (cy < GOAL2.h && Math.abs(cx) < GOAL2.halfW) { b.inNet = end; ev.push({ type: 'goal', end, x: cx, y: cy, speed: speed3(b) }); netStop(b, end, L); }
    else ev.push({ type: 'out', where: 'byline', end, x: cx, z: line });
    return;
  }
  if (Math.abs(b.x) > W + r) ev.push({ type: 'out', where: 'side', x: Math.sign(b.x) * W, z: b.z });
}

function frame(b, line, end, ys, xs) {
  b.z = line - end * 0.02;
  b.vz = -end * Math.abs(b.vz) * 0.55;
  if (ys) b.vy = ys * (Math.abs(b.vy) * 0.5 + 1.5);
  if (xs) b.vx = xs * (Math.abs(b.vx) * 0.5 + 1.2);
}

function netStop(b, end, L) {
  const r = BALL2.r, back = end * (L + GOAL2.depth - r), side = GOAL2.halfW - r, top = GOAL2.h - r;
  if (end * b.z > end * back) { b.z = back; b.vz = -b.vz * 0.12; b.vx *= 0.4; b.vy *= 0.4; }
  if (Math.abs(b.x) > side) { b.x = Math.sign(b.x) * side; b.vx *= -0.2; }
  if (b.y > top) { b.y = top; b.vy = -Math.abs(b.vy) * 0.2; }
  const front = end * (L + r);
  if (end * b.z < end * front) { b.z = front; b.vz = -b.vz * 0.2; }
}

// Where (x, y) and when a ball in flight crosses the goal line `end` (-1 / 1), within maxT s, or null.
export function predictLine(b, end, L, maxT = 1.6, dt = 1 / 60) {
  const c = { ...b }, line = end * L;
  for (let t = 0; t < maxT; t += dt) {
    const pz = c.z;
    if (c.y > BALL2.r || c.vy > 0) c.vy -= BALL2.g * dt;
    c.x += c.vx * dt; c.y = Math.max(BALL2.r, c.y + c.vy * dt); c.z += c.vz * dt;
    if (end < 0 ? pz >= line && c.z < line : pz <= line && c.z > line) return { x: c.x, y: c.y, t };
  }
  return null;
}
