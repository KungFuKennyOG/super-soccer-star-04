// Goal celebrations: after every goal of yours you pick one of several (or let the default play, or skip it), your teammates join in, the beaten side trudges back.
// Pure: the pick (a short menu with a default, or a pose of your arms), each celebration's timeline, how it
// carries you over the grass, and where everyone else goes. The sim moves the players by it (rules/sim.js)
// and the page poses them from the same timeline (game/cheers.js).
import { PITCH, GOAL } from './tuning.js';

export const CELEBRATE = {
  wait: 0.7,        // s after the goal (or its replay) before the prompt comes up (teammates are on their way over)
  pickTime: 2.5,    // s the prompt stays up; then the highlighted one is played
  hold: 0.45,       // s a pose of your arms must be held to pick by gesture
  bonus: 600,       // style points for a hat trick's celebration, flat (the dance paid 75 or 150 a beat, 1200 at most); other goals: none
};
// T: how long it runs (s). gesture: the pose of your arms that picks it (gestureFromHands). say: what your own arms should do.
export const CELEBRATIONS = [
  { id: 'slide', name: 'Knee slide', say: 'Arms out wide, lean back', T: 4.6 },
  { id: 'plane', name: 'Aeroplane', say: 'Arms out: look where you want to fly', gesture: 'wide', T: 5 },
  { id: 'ears', name: 'Cup your ears', say: 'Hands to your ears', gesture: 'ears', T: 4 },
  { id: 'point', name: 'Point to the sky', say: 'One arm up, look up', gesture: 'sky', T: 4 },
  { id: 'pile', name: 'Pile-on', say: 'Down on your knees: here they come', T: 4.8 },
  { id: 'flip', name: 'Backflip', say: 'Swing your arms up and jump', T: 4 },
];
export const byKind = id => CELEBRATIONS.find(c => c.id === id) || null;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), smooth = x => { const k = clamp(x, 0, 1); return k * k * (3 - 2 * k); };
const TAU = Math.PI * 2, wrap = a => a - TAU * Math.round(a / TAU);

/* ---------- picking ---------- */

// Reads a pose from where your hands are relative to your head, in your body's frame (m: x to your right, y up,
// z forward). 'wide': both arms out to the sides; 'ears': a hand by each ear; 'sky': one hand high over your head,
// the other down. Hands at your sides (how the game is played) read as nothing.
export function gestureFromHands(left, right) {
  if (!left || !right) return null;
  const ear = (h, s) => h.x * s > 0.07 && h.x * s < 0.3 && Math.abs(h.y + 0.02) < 0.16 && h.z > -0.2 && h.z < 0.22;
  if (ear(left, -1) && ear(right, 1)) return 'ears';
  if (left.x < -0.5 && right.x > 0.5 && left.y > -0.5 && right.y > -0.5 && left.y < 0.12 && right.y < 0.12) return 'wide';
  if ((left.y > 0.22 && right.y < -0.25) || (right.y > 0.22 && left.y < -0.25)) return 'sky';
  return null;
}

// The prompt. start: which row is highlighted first (the one played if nothing is picked).
export const createPick = (start = 0) => ({ i: ((start % CELEBRATIONS.length) + CELEBRATIONS.length) % CELEBRATIONS.length, t: 0, pose: null, poseT: 0, by: null });
// One frame of it. nav: { up, down, ok } edges (stick and A / X, never a trigger); gesture: gestureFromHands' answer.
// Returns the id picked on the frame it is picked, else null; pk.by says how ('button', 'gesture', 'default').
export function stepPick(pk, dt, nav = {}, gesture = null) {
  const n = CELEBRATIONS.length;
  pk.t += dt;
  if (nav.up || nav.down) { pk.i = (pk.i + (nav.down ? 1 : n - 1)) % n; pk.t = Math.min(pk.t, CELEBRATE.pickTime - 2); }   // moving buys time to choose
  if (nav.ok) { pk.by = 'button'; return CELEBRATIONS[pk.i].id; }
  if (gesture && gesture === pk.pose) pk.poseT += dt; else { pk.pose = gesture; pk.poseT = 0; }
  const g = gesture && CELEBRATIONS.findIndex(c => c.gesture === gesture);
  if (gesture && g >= 0) {
    pk.i = g;
    if (pk.poseT >= CELEBRATE.hold) { pk.by = 'gesture'; return CELEBRATIONS[g].id; }
  }
  if (pk.t >= CELEBRATE.pickTime) { pk.by = 'default'; return CELEBRATIONS[pk.i].id; }
  return null;
}

/* ---------- the timeline ---------- */

// Where a celebration may take you: inside the lines with a little to spare (the boards and the goal are beyond).
const BOX = { x: PITCH.halfW - 1, z0: GOAL.z + 1.5, z1: PITCH.halfwayZ + 1 };
// How far you can go from (x, z) along the unit direction (dx, dz) before leaving it (0 if already out).
export function roomAlong(x, z, dx, dz) {
  if (Math.abs(x) > BOX.x || z < BOX.z0 || z > BOX.z1) return 0;
  let r = 99;
  if (dx > 1e-6) r = Math.min(r, (BOX.x - x) / dx); else if (dx < -1e-6) r = Math.min(r, (-BOX.x - x) / dx);
  if (dz > 1e-6) r = Math.min(r, (BOX.z1 - z) / dz); else if (dz < -1e-6) r = Math.min(r, (BOX.z0 - z) / dz);
  return Math.max(0, r);
}

// The knee slide. Wet grass holds a sliding player back at about 0.45 g, so from a 6.4 m/s run he goes 4.6 m:
// the slide is as long as the room ahead allows (down to 1.4 m off a few jogged steps), and the run-up takes the rest.
// run: s of run-up; v0: speed as the knees go down (m/s); drop: s to get down; T1: when he stops.
export const SLIDE = { decel: 4.4, drop: 0.22, kneel: 1.1, up: 0.8 };
export function slidePlan(room) {
  const d = clamp(room * 0.55, 1.4, 4.6), v0 = Math.sqrt(2 * SLIDE.decel * d), runD = clamp(room - d, 0.8, 4.5), run = runD / (0.75 * v0);
  return { run, v0, d, runD, stop: run + v0 / SLIDE.decel };
}
// The backflip is a recorded one (CMU 88_01, game/cheers.js): he leaves the grass 0.27 s into it and lands 0.33 s
// later, 0.72 m behind where he stood and 0.2 m to his left. at: when it starts, for you and for the teammate who follows you.
export const FLIP = { at: 0.9, mateAt: 2.0, air: [0.27, 0.6], back: 0.72, left: 0.2, len: 1.17 };
export const PLANE = { speed: 5.4, turn: 1.5 };
export const POINT = { speed: 2.8, stop: 1.4 };
export const PILE = { down: 0.35, mate: 0.5, up: 0.9 };

// A celebration under way. Before one is picked (kind null) teammates come over and the other side trudges off.
// (dx, dz): the way it travels, your facing when you picked. seed: who does what among the others.
export function gatherCelebration(you, rnd = Math.random) {
  return { kind: null, t: 0, T: 0, dx: you.fx, dz: you.fz, a: Math.atan2(you.fx, you.fz), bank: 0, plan: null, from: null, seed: rnd(), age: 0 };
}
export function chooseCelebration(c, kind, you) {
  const def = byKind(kind);
  if (!def || c.kind) return false;
  const f = Math.hypot(you.fx, you.fz) || 1;
  Object.assign(c, { kind, t: 0, T: def.T, dx: you.fx / f, dz: you.fz / f, a: Math.atan2(you.fx, you.fz), bank: 0 });
  if (kind === 'slide') { c.plan = slidePlan(roomAlong(you.x, you.z, c.dx, c.dz)); c.T = c.plan.stop + SLIDE.kneel + SLIDE.up + 0.2; }
  return true;
}
export const celebrationDone = c => !!c.kind && c.t >= c.T;

// Advances it. The aeroplane goes where you look (turning no faster than PLANE.turn), and swings back toward the
// middle of the pitch before it would carry you over a line.
export function stepCelebration(c, dt, you) {
  c.age += dt;
  if (!c.kind) return;
  c.t += dt;
  if (c.kind === 'plane' && dt > 0) {
    let want = Math.atan2(you.fx, you.fz);
    if (roomAlong(you.x, you.z, Math.sin(c.a), Math.cos(c.a)) < 7) want = Math.atan2(-you.x, (GOAL.z + PITCH.halfwayZ) / 2 - you.z);
    const turn = clamp(wrap(want - c.a) * 3, -PLANE.turn, PLANE.turn);
    c.a += turn * dt; c.dx = Math.sin(c.a); c.dz = Math.cos(c.a);
    c.bank += (turn - c.bank) * Math.min(1, dt * 5);
  }
}

// How far the backflip has taken a man back (0..1 of FLIP.back) `t` s into it.
export const flipShift = t => clamp((t - FLIP.air[0]) / (FLIP.air[1] - FLIP.air[0]), 0, 1);

// Your own velocity under it ({ x, z } m/s), or null where you stand still (or nothing is picked yet).
export function carry(c) {
  if (!c.kind) return null;
  const t = c.t, along = s => ({ x: c.dx * s, z: c.dz * s });
  if (c.kind === 'slide') {
    const p = c.plan;
    if (t < p.run) return along(p.v0 * (0.5 + 0.5 * t / p.run));
    return along(Math.max(0, p.v0 - SLIDE.decel * (t - p.run)));
  }
  if (c.kind === 'plane') return along(PLANE.speed * smooth(t / 0.9) * (1 - smooth((t - (c.T - 1.4)) / 0.9)));
  if (c.kind === 'point') return along(POINT.speed * smooth(t / 0.3) * (1 - smooth((t - 0.7) / (POINT.stop - 0.7))));
  if (c.kind === 'flip') {
    const u = t - FLIP.at, T = FLIP.air[1] - FLIP.air[0];
    if (u <= FLIP.air[0] || u >= FLIP.air[1]) return null;
    return { x: (-c.dx * FLIP.back + c.dz * FLIP.left) / T, z: (-c.dz * FLIP.back - c.dx * FLIP.left) / T };      // back, and a little to his left
  }
  return null;
}

// Where a teammate goes. side: -1 the one on your left, +1 on your right (his lane); p: him. Returns { x, z, speed, face
// (unit { x, z } to stand facing, or null: face you), exact (be there to the centimetre: a landing) }.
export function mateTarget(c, you, side, p = null) {
  const rx = -c.dz, rz = c.dx, at = (f, r) => ({ x: you.x + c.dx * f + rx * r * side, z: you.z + c.dz * f + rz * r * side, speed: 6.6, face: null, exact: false });
  const same = { x: c.dx, z: c.dz };
  if (!c.kind) return { ...at(2.4, 2.0), speed: 7.4 };                                   // coming over: either side of the way ahead, leaving it clear
  if (c.kind === 'slide') {
    if (c.t < c.plan.stop - 0.25) return { ...at(-2.4, 1.5), speed: 7.6 };              // chasing him
    return side < 0 ? { ...at(0.15, 1.05), speed: 6.5, face: same } : { ...at(-0.95, 0.75), speed: 6.5, face: same };   // one slides in beside him, one arrives behind
  }
  if (c.kind === 'plane') return { ...at(-2.5, 2.3), speed: c.t > c.T - 0.6 ? 2 : 7.6, face: same };
  if (c.kind === 'point') return { ...at(1.5, 1.5), speed: 7, face: side < 0 ? same : null };
  if (c.kind === 'ears') return { ...at(1.6, 1.5), face: same };
  if (c.kind === 'pile') {
    if (side < 0) return { ...at(0.5, 0.36), speed: 6.8 };            // in front and to your left, on his knees, arms round you
    return c.t < PILE.mate ? at(-2.5, 0.6) : { ...at(-0.56, 0.16), speed: 6.8, face: same };     // then the other, over your back
  }
  if (c.kind === 'flip') {
    if (side > 0 && c.t >= FLIP.mateAt && p) {                         // he follows you over: back from where he stands, the way he faces
      if (!c.from) { const d = Math.hypot(p.fx, p.fz) || 1; c.from = { x: p.x, z: p.z, fx: p.fx / d, fz: p.fz / d }; }
      const { x, z, fx, fz } = c.from, k = flipShift(c.t - FLIP.mateAt);
      return { x: x + (-fx * FLIP.back + fz * FLIP.left) * k, z: z + (-fz * FLIP.back - fx * FLIP.left) * k, speed: 0, exact: true, face: { x: fx, z: fz } };
    }
    return at(1.7, 2.1);
  }
  return at(1, 1.5);
}

// The beaten side: each walks back to where he lines up for the restart (home: { x, z }), in his own time
// (i: 0, 1, 2 ...: some stand a moment first). Slow: 0.7 to 0.95 m/s, the pace of the recorded walks they are drawn with.
export function oppTarget(c, p, home, i = 0) {
  const stood = c.age < 0.6 + 0.9 * ((i * 7 + Math.floor(c.seed * 5)) % 3);
  return { x: home.x, z: home.z, speed: stood ? 0 : 0.7 + 0.12 * (i % 3), face: null, exact: false };
}
