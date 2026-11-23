// The keeper on his feet: the set position, the shuffle across goal, small steps out and back, the split step as a
// shot is struck, and standing with the ball in his arms. Built from goalkeeping coaching and one recorded slide
// (docs/notes-keeper-anim.md says which number comes from where).
//
//   set       feet shoulder width, heels just up, knees bent, nose over toes, hands in front a ball's width apart
//   shuffle   push off the far foot, the near foot steps out, the far foot closes: never crossing, never together
//             (GAIT.gap), low and quick, hips level, head still, hands where they were. Each foot is planted where it
//             lands, in the world (its place and the way it points), and stays there till it lifts: no sliding. A clock
//             says when each lifts and lands: at speed the far foot is off the grass before the near one is down (the
//             recorded slide is a low bound, both feet off about a third of the time)
//   steps     out, back or on the spot (turning to the ball): one foot at a time when it's been left behind
//   split     as a shot is struck: both feet just off the grass and down a little wider on the balls of the feet as
//             the ball leaves the boot, the hips sinking into the landing: loaded for the save (m.split = 0 starts it)
//   holding   stood up, the ball hugged to his chest: hands wrapped round the front of it, forearms under
import * as THREE from 'three';
import { reachLeg, aimFoot } from './legik.js';
import { sway } from './sway.js';
import { gaitOf } from './gait.js';
import { placeHands, lookAt, grip, ankleFor, chestPoint } from './keeperhands.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), mix = (a, b, k) => a + (b - a) * k;
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z), TAU = Math.PI * 2;
export const SET = {
  // the set position as it is coached (m, rad): feet shoulder width, knees a little bent, on the balls of the feet,
  // weight forward (nose in front of the toes), chest to the ball, elbows narrow and bent, hands in front of the
  // body a ball's width apart, open and relaxed. Not a deep or wide squat.
  hips: 0.85, hipsFar: 0.9, pitch: 0.36, width: 0.44, ahead: 0.05, heel: 0.1, toeOut: 0.12, kneeOut: 0.08,
  hands: [0.15, 0.2, 0.38],                    // palms: out, above the hips, ahead (m, in the hips' own tilted frame)
  recover: 2.2, run: 4.2,                      // m/s back to his spot after a save; faster than this he runs
};
export const GAIT = {
  on: 0.45, off: 0.25,                         // m/s: the shuffle's clock starts above, stops below
  top: 3.5,                                    // m/s: the sim's quickest shuffle; [slow, top] pairs below run between a creep and this
  cycle: [0.36, 0.44],                         // s for both feet to step once (the recorded slide: 0.46 s at 2.7 m/s)
  duty: [0.58, 0.45],                          // share of the cycle a foot is down (at speed under half: there is a flight)
  lag: [0.42, 0.22],                           // the near foot lands this share of a cycle after the far one
  wide: 0.09,                                  // m wider per m/s (to 2.2 m/s): room for the far foot to close without the feet meeting
  gap: 0.28,                                   // m: the ankles are never nearer than this across him (hip width)
  lift: [0.035, 0.02],                         // m an ankle rises in a step, and more per m/s (recorded: 0.10 to 0.15 at 3 m/s; a keeper skims)
  reach: 0.32,                                 // m: the furthest a foot lands ahead of its place under him
  low: 0.06,                                   // m lower at speed (room for the legs to reach; coached: stay low)
  step: { far: 0.1, turn: 0.4, time: 0.2 },    // one-off steps: a foot this far (m) or this turned (rad) off its place steps, in this long
};
export const CROSS = {
  // the crossover step, for a long way across goal quickly (coached: side-steps for short distances, crossover steps
  // for long ones; "turn the hips and run in the direction they want to go", the upper body kept facing the ball; then
  // a few quick shuffles to get set). on / off: m/s across him, held for `after` s before he goes into it; hips: rad
  // they turn to the run; back: the share of that the spine and chest turn back to the ball; feet: rad the boots point
  // into the run; front / behind: m ahead of his line the trailing foot lands (it crosses in front) and the leading
  // one; cycle, duty: s for both feet to step once, and the share of it a foot is down (a run: there is a flight)
  on: 2.5, off: 1.8, after: 0.2, hips: 0.8, back: 0.8, feet: 0.95, front: 0.19, behind: -0.09, cycle: 0.46, duty: 0.42, lift: 0.07, reach: 0.24, low: 0.035,
};
export const SPLIT = {
  // the split step (pre-jump): a hop only just off the grass, timed to land as the ball leaves the boot. fly: s in
  // the air (a body that rises `up` and falls again takes 2 x sqrt(2 x up / g) = 0.128 s); wide: m wider he lands;
  // sink: m the hips give into the landing over `give` s; held `hold` s, then eased off
  fly: 0.128, up: 0.02, rise: 0.01, wide: 0.08, sink: 0.055, give: 0.14, hold: 0.55,
};
export const LIVE = {
  // how alive he is standing (m, rad, Hz, s). From how keepers stand and move while they wait (coaching: stay on
  // the balls of the feet, keep the feet moving with small adjusting steps, relaxed hands, never flat-footed
  // and frozen). Sizes: the first version (23 Nov) was a centimetre or two of everything, which from where the
  // striker stands, 12 to 18 m out, is one or two pixels in the headset: filmed from there it read as a statue.
  // These are about three times that, still inside what a keeper on his toes does (a bounce of a few centimetres,
  // his weight a hand's width from side to side, a foot re-set by a boot's width, hands that open and close).
  near: [11, 22],                              // m to the ball: on his toes and bouncing inside the first, not past the second
  bounce: [0.02, 2.0], heel: 0.035,            // the bounce (m up and down, a second) and how much more the heels lift with it (rad)
  shift: [0.05, 0.9], tilt: 1.3,               // his weight from foot to foot (m, rad/s) and the hips' tilt per m of it
  breath: 0.02,                                // rad the chest rises and falls
  reset: [0.8, 1.9], resetBy: 0.1,             // every so many s he re-sets a foot, by up to this far
  float: 0.035, follow: 11, trail: 0.006,      // hands: m they drift, how quickly they follow (1/s), m left behind per m/s2
  pump: 0.03,                                  // hands: m they ride the bounce, a beat late
  rock: 0.045,                                 // shuffling: rad the shoulders rock a step
};
// Each keeper his own man (from his seed: the same one all match): how wide he stands, how tall, where he carries his
// hands, how bouncy and how restless he is. All inside what is coached (feet about shoulder width, hands between the
// waist and the chest).
const frac = x => x - Math.floor(x);
export const HABIT = { seed: null };            // (the look page sets a seed here: &gk=)
export function habitOf(m) {
  const seed = HABIT.seed ?? m.kSeed ?? gaitOf(m).seed;
  if (!m.kHabit || m.kHabit.seed !== seed) {
    const r = k => frac(Math.sin(seed * 91.7 + k * 37.3) * 43758.5453);
    m.kHabit = { seed, width: mix(-0.04, 0.07, r(1)), hips: mix(-0.025, 0.02, r(2)), handY: mix(-0.06, 0.09, r(3)), handOut: mix(-0.02, 0.05, r(4)), handZ: mix(-0.04, 0.04, r(5)),
      bounce: mix(0.6, 1.3, r(6)), hz: mix(0.88, 1.2, r(7)), shift: mix(0.6, 1.35, r(8)), fid: mix(0.7, 1.5, r(9)), float: mix(0.6, 1.4, r(10)), ph: r(11) * 40 };
  }
  return m.kHabit;
}
const rnd = g => ((g.rs = ((g.rs ?? 12345) * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const tmp = new THREE.Vector3(), tq = new THREE.Quaternion(), te = new THREE.Euler();

export const toLocal = (m, w, out) => { m.root.updateMatrixWorld(true); return m.root.worldToLocal(out.set(w.x, w.y, w.z)); };
export const toWorldPt = (m, v, out) => { m.root.updateMatrixWorld(true); return m.root.localToWorld(out.copy(v)); };
const turnTo = (a, b, k) => { let d = b - a; d -= Math.round(d / TAU) * TAU; return a + d * k; };

// Feet where the set position puts them, planted (world): p the spot under the ankle, yaw the way the boot points.
export function plantFeet(m, width = SET.width) {
  m.kf = {};
  for (const [n, sd] of [['L', 1], ['R', -1]]) m.kf[n] = { p: toWorldPt(m, V(sd * width / 2, 0, SET.ahead), V(0, 0, 0)), yaw: m.root.rotation.y + sd * SET.toeOut, air: null };
  return m.kf;
}
// ...or where his boots are now (after a save: he carries on from where it left him)
const fw = new THREE.Vector3(), fq = new THREE.Quaternion();
export function plantFromPose(m) {
  m.root.updateMatrixWorld(true);
  m.kf = {};
  for (const n of ['L', 'R']) {
    const b = m.bone['foot' + n]; b.getWorldPosition(fw); b.getWorldQuaternion(fq);
    const d = tmp.set(0, 0, 1).applyQuaternion(fq);
    m.kf[n] = { p: V(fw.x, 0, fw.z), yaw: Math.atan2(d.x, d.z), air: null };
  }
  m.kg = null;
}

// Swings a knee out (or in) round the line from hip to ankle, so the foot stays where it is.
const kq = new THREE.Quaternion(), kv = new THREE.Vector3();
export function kneeOut(bn, n, a) {
  const up = bn['upperLeg' + n], lo = bn['lowerLeg' + n], ft = bn['foot' + n];
  kv.copy(ft.position).applyQuaternion(lo.quaternion).add(lo.position).applyQuaternion(up.quaternion).normalize();
  up.quaternion.premultiply(kq.setFromAxisAngle(kv, -a));
}
// One leg: the ankle to `at` (model space), the knee swung out by `out`, the boot pitched toes-down and turned.
export function setLeg(bn, n, at, pitch, yaw, out = 0) {
  reachLeg(bn, n, at);
  if (out) kneeOut(bn, n, out);
  aimFoot(bn, n, tq.setFromEuler(te.set(pitch, yaw, 0, 'YXZ')));
}

export function stance(m, p, dt, t, ball) {
  const bn = m.bone, root = m.root, yaw = root.rotation.y, Hb = habitOf(m), kf = m.kf || plantFeet(m, SET.width + Hb.width), G = GAIT, S = SPLIT;
  t += Hb.ph;                                                          // (no two keepers in step)
  // how he is really moving: his root (the sim's spot, and the way back to it after a save)
  const g = m.kg ??= { on: false, ph: 0, lead: 'L', last: 'R', px: root.position.x, pz: root.position.z, vx: p.vx || 0, vz: p.vz || 0, H: null, Hv: 0, hold: p.holding ? 1 : 0 };
  if (dt > 1e-5) {
    const k = 1 - Math.exp(-dt * 30);
    g.vx += ((root.position.x - g.px) / dt - g.vx) * k; g.vz += ((root.position.z - g.pz) / dt - g.vz) * k;
    g.hold = clamp(g.hold + (p.holding ? dt : -dt) * 3.5, 0, 1);
  }
  g.px = root.position.x; g.pz = root.position.z;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), lx = g.vx * cy - g.vz * sy, lz = g.vx * sy + g.vz * cy;   // across him (+ his left), and forward
  const sp = Math.hypot(g.vx, g.vz), k = clamp(sp / G.top, 0, 1), hold = ease(g.hold);
  const bd = ball ? Math.hypot(ball.x - p.x, ball.z - p.z) : 30, far = clamp((bd - 18) / 10, 0, 1);
  // alive (Kenny: "the goalie looks a bit stiff"): a keeper waiting is never still. His weight drifts from foot to
  // foot, he breathes, his hands float, he re-sets a foot every second or two, and with the ball close he is
  // light on his toes, bouncing a centimetre at about two a second. All of it fades as he moves or holds the ball.
  const L = LIVE, still = (1 - ease(sp / 1.2)) * (1 - hold), close = 1 - clamp((bd - L.near[0]) / (L.near[1] - L.near[0]), 0, 1);
  // (the bounce comes and goes: a few beats on his toes, then a moment settled; never while a split step is on)
  const beat = t * TAU * L.bounce[1] * Hb.hz + 0.6 * Math.sin(t * 0.9), swell = ease(0.55 + 0.75 * Math.sin(t * 0.61 + 1.3) + 0.3 * Math.sin(t * 0.23)) * (m.split !== undefined && m.split < S.hold ? 0 : 1);
  if (dt > 0) g.sw = (g.sw ?? 0) + (swell * still * close - (g.sw ?? 0)) * (1 - Math.exp(-dt * 6));
  const bk = (g.sw ?? 0) * Hb.bounce, bnc = L.bounce[0] * Math.sin(beat) * bk;
  // (eased in and out over about half a second: it must not jerk his hips as he sets off)
  if (dt > 0) g.calm = (g.calm ?? 1) + ((sp < 0.3 ? 1 : 0) - (g.calm ?? 1)) * (1 - Math.exp(-dt * (sp < 0.3 ? 2.5 : 7)));
  const wsh = (L.shift[0] * Math.sin(t * L.shift[1]) + L.shift[0] * 0.5 * Math.sin(t * L.shift[1] * 0.41 + 2)) * ease(g.calm ?? 1) * (1 - 0.5 * hold) * Hb.shift;
  const breath = Math.sin(t * mix(2.1, 2.9, close));
  // the split step
  let hop = 0, wide = 0, sink = 0, busy = false;
  if (m.split !== undefined && m.split < S.hold + 0.5) {
    if (m.split === 0) for (const n of ['L', 'R']) kf[n].air = { from: kf[n].p.clone(), yaw0: kf[n].yaw, t: 0, T: S.fly, hop: true };
    const a = (m.split += dt) || 1e-6; m.split = a;
    hop = a < S.fly ? Math.sin(Math.PI * a / S.fly) : 0;
    const off = 1 - ease((a - S.hold) / 0.45);
    wide = S.wide * off; sink = S.sink * ease((a - S.fly * 0.6) / S.give) * off;
    busy = a < S.fly + 0.12;
  }
  // the shuffle's clock: across goal the near foot leads and the far one closes; out and back the feet take turns
  const side = Math.abs(lx) >= Math.abs(lz) * 0.8, near = lx > 0 ? 'L' : 'R';
  // the crossover: going across quicker than a shuffle can for more than a moment, his hips turn to the run and his
  // feet take turns, the trailing one crossing in front; back to the shuffle as he slows
  const X = CROSS, fast = side && !busy && !hold && Math.abs(lx) > (g.xOn ? X.off : X.on);
  if (dt > 0) {
    g.xT = fast ? (g.xT || 0) + dt : 0;
    if (!g.xOn && g.xT > X.after) { g.xOn = true; g.xDir = Math.sign(lx); } else if (g.xOn && (!fast || Math.sign(lx) !== g.xDir)) g.xOn = false;
    g.cross = clamp((g.cross || 0) + (g.xOn ? dt / 0.16 : -dt / 0.22), 0, 1);
  }
  const cross = ease(g.cross || 0), xd = g.xDir || 1;
  const C = mix(side ? mix(G.cycle[0], G.cycle[1], k) : mix(0.42, 0.5, k), X.cycle, cross), duty = mix(side ? mix(G.duty[0], G.duty[1], k) : mix(0.6, 0.42, k), X.duty, cross), lag = mix(side ? mix(G.lag[0], G.lag[1], k) : 0.5, 0.5, cross);
  const width = mix(SET.width + Hb.width, 0.36, hold) + wide + (side ? G.wide * Math.min(sp, 2.2) * (1 - hold) : 0);
  // (each step is a side-step or a crossover step from the moment the foot lifts, never half of each; a foot that
  // crosses the other one, or comes back from across it, swings out round it: `bow` m ahead of his line or behind)
  const lift = n => {
    const f = kf[n], sd = n === 'L' ? 1 : -1; if (f.air) return;
    const a = f.air = { from: f.p.clone(), yaw0: f.yaw, t: 0, T: g.on ? (1 - duty) * C : G.step.time, x: g.xOn ? 1 : 0, bow: 0 };
    const me = toLocal(m, f.p, V(0, 0, 0)), ot = toLocal(m, kf[n === 'L' ? 'R' : 'L'].p, V(0, 0, 0));
    if (a.x) a.bow = (sd === xd ? -1 : 1) * 0.08; else if (sd * (me.x - ot.x) < 0.12) a.bow = (me.z >= ot.z ? 1 : -1) * 0.1;
  };
  if (!g.on && sp > G.on && !busy) { g.on = true; g.lead = side ? near : g.last; g.ph = lag + duty - 1e-3; }
  else if (g.on && (sp < G.off || busy)) g.on = false;
  if (g.on) {
    if (side && near !== g.lead) { g.lead = near; g.ph = lag + duty - 1e-3; }      // he turns back: as from a standing start, the new near foot first
    const prev = g.ph; g.ph += dt / C;
    for (const n of ['L', 'R']) { const end = (n === g.lead ? lag : 0) + duty; if (Math.floor(g.ph - end) > Math.floor(prev - end)) lift(n); }
  }
  const home = {};
  // (in the crossover the feet land on two lines along his run: the trailing foot's in front of the leading foot's,
  // so the one passes in front of the other and never through it)
  for (const [n, sd] of [['L', 1], ['R', -1]]) { const xk = kf[n].air ? kf[n].air.x || 0 : 0; home[n] = toWorldPt(m, V(sd * width / 2 * (1 - xk), 0, SET.ahead + xk * (sd === xd ? X.behind : X.front)), V(0, 0, 0)); }
  if (!g.on && !busy && !kf.L.air && !kf.R.air) {
    // standing or creeping: a foot left behind its place, or pointing too far off it, steps (the worse one; in turn when it's close)
    let pick = null, worst = G.step.far * (1 + 0.4 * hold);
    for (const [n, sd] of [['L', 1], ['R', -1]]) {
      const f = kf[n], e = f.p.distanceTo(home[n]) + (G.step.far / G.step.turn) * Math.abs(turnTo(f.yaw, yaw + sd * SET.toeOut, 1) - f.yaw) + (n !== g.last ? 0.015 : 0);
      if (e > worst) { worst = e; pick = n; }
    }
    if (pick) lift(pick);
    else if (dt > 0 && (g.fid = (g.fid ?? 0.9) - dt) <= 0) {
      // nothing to correct: he re-sets a foot anyway, a few centimetres, the feet in turn
      const n = g.last === 'L' ? 'R' : 'L';
      g.fid = mix(L.reset[0], L.reset[1], rnd(g)) * (1 + 1.5 * far) * (1 + hold) * Hb.fid;
      if (hold < 0.5) { lift(n); kf[n].air.jit = [(rnd(g) - 0.5) * 2 * L.resetBy, (rnd(g) - 0.5) * 2 * L.resetBy * 0.8]; }
    }
  }
  // how far from under its hip a foot can be with the hips where they are (the leg's length); whatever the clock
  // says, a foot the body is leaving behind at the end of its leg comes with it
  const hz = SET.ahead * 0.4 - mix(0.09, 0.03, Math.max(hold, far)), maxR = Math.sqrt(Math.max(0.04, 0.85 * 0.85 - ((g.H ?? SET.hips) - 0.1) ** 2));
  const off = (n, sd, w, out) => { toLocal(m, w, out); out.x -= sd * 0.09; out.z -= hz; out.y = 0; return out; };
  if (sp > 0.05) for (const [n, sd] of [['L', 1], ['R', -1]]) {
    const f = kf[n], o = off(n, sd, f.p, tmp);
    if (!f.air && !busy && o.length() > maxR * mix(0.95, 0.84, cross) && o.x * lx + o.z * lz < 0) lift(n);
  }
  // the feet: planted, or in the air on the way to where they'll be wanted when they land
  const at = {}, toes = {}, E = g.on ? Math.min(mix(G.reach, X.reach, cross), sp * duty * C / 2) : 0;
  for (const [n, sd] of [['L', 1], ['R', -1]]) {
    const f = kf[n], o = kf[n === 'L' ? 'R' : 'L'];
    let up = 0, u = 0;
    if (f.air) {
      const a = f.air; a.t += dt; u = Math.min(1, a.t / a.T);
      const rem = Math.max(0, a.T - a.t), to = tmp.copy(home[n]);
      to.x += g.vx * rem; to.z += g.vz * rem;
      if (sp > 0.05) { to.x += g.vx / sp * E; to.z += g.vz / sp * E; }
      // feet never cross and never come together: it lands on its own side of the other one
      const tl = toLocal(m, to, V(0, 0, 0)), ol = toLocal(m, o.p, V(0, 0, 0));
      if (a.jit) { tl.x += a.jit[0]; tl.z += a.jit[1]; }
      if (sd * (tl.x - ol.x) < G.gap && Math.abs(tl.z - ol.z) < 0.19) tl.x = ol.x + sd * G.gap;      // (unless it lands clear in front of it or behind: the crossover)
      // ...and within reach of the leg
      const dx = tl.x - sd * 0.09, dz = tl.z - hz, dr = Math.hypot(dx, dz), lim = maxR * 0.86;
      if (dr > lim) { tl.x = sd * 0.09 + dx * lim / dr; tl.z = hz + dz * lim / dr; }
      toWorldPt(m, tl, to);
      f.p.copy(a.from).lerp(to, ease(u)); f.yaw = turnTo(a.yaw0, yaw + (a.x ? xd * X.feet : sd * SET.toeOut), ease(u));
      if (a.bow) { const bow = Math.sin(Math.PI * u) * a.bow; f.p.x += Math.sin(yaw) * bow; f.p.z += Math.cos(yaw) * bow; }
      up = Math.sin(Math.PI * u) * (a.hop ? S.up : a.x ? X.lift : G.lift[0] + G.lift[1] * Math.min(sp, 3.5));
      if (u >= 1) { f.air = null; g.last = n; m.phase = (m.phase || 0) + Math.PI; }
    }
    toes[n] = SET.heel * (1 - hold) + (f.air && !f.air.hop ? 0.22 * Math.sin(Math.PI * u) : 0) + L.heel * bk * (0.5 + 0.5 * Math.sin(beat + sd * 0.7));
    at[n] = toLocal(m, f.p, V(0, 0, 0)); at[n].y = ankleFor(toes[n]) + up;
  }
  // hips: low in the set and level as he moves (no bobbing), sinking into the split step's landing, up and loose
  // when the ball is far; never higher than both legs reach
  const Hset = mix(mix(SET.hips, SET.hipsFar, far) + Hb.hips, 0.93, hold) - sink - (G.low * ease(sp / 2.6) + X.low * cross) * (1 - hold);
  if (g.H === null) { g.H = m.kLast && m.kState !== 'run' ? m.kLast[m.kLast.length - 2] : Hset; g.Hv = 0; }
  if (dt > 0) { const w = 16; g.Hv += (w * w * (Hset - g.H) - 2 * w * g.Hv) * dt; g.H += g.Hv * dt; }
  // (hz: sat back a little: bent forward, his weight stays over the balls of his feet)
  let H = g.H + S.rise * hop + bnc;
  for (const [n, sd] of [['L', 1], ['R', -1]]) {
    const dx = at[n].x - wsh - sd * 0.09, dz = at[n].z - hz, dh2 = dx * dx + dz * dz;
    const top = at[n].y + Math.sqrt(Math.max(0.01, 0.85 * 0.85 - dh2));
    // (held down by a leg at full stretch, he comes back up from there on the spring, not in one frame)
    if (top < H) { H = top; g.H = Math.min(g.H, top - S.rise * hop - bnc); g.Hv = Math.min(g.Hv, 0); }
  }
  bn.hips.position.set(wsh, H, hz);
  const lean = clamp(lx * 0.012, -0.04, 0.04);                                 // a touch into the way he's going, from the hips
  // (his weight over one foot drops that hip's side a little and the spine straightens over it; a shuffle rocks the shoulders)
  const tilt = wsh * L.tilt;
  if (dt > 0) g.rock = (g.rock || 0) + ((g.on ? L.rock * Math.min(1, sp / 1.5) * Math.sin(TAU * g.ph) * (side ? 1 : 0.4) : 0) - (g.rock || 0)) * (1 - Math.exp(-dt * 10));   // (smoothed: the clock jumps when he turns back)
  const rock = g.rock || 0;
  // (the crossover: hips to the run, spine and chest most of the way back to the ball)
  const hy = xd * X.hips * cross;
  bn.hips.rotation.set(mix(SET.pitch, 0.08, hold) * mix(1, 0.55, far) * (1 - 0.35 * cross) + sink * 1.2 - bnc * 0.5, 0, -lean - tilt);
  if (hy) bn.hips.quaternion.premultiply(tq.setFromAxisAngle(tmp.set(0, 1, 0), hy));
  bn.spine.rotation.set(mix(0.16, 0.02, hold) * mix(1, 0.5, far) + L.breath * 0.4 * breath, wsh * 0.6 - hy * X.back * 0.5, lean * 0.8 + tilt * 0.7 + rock);
  bn.chest.rotation.set(mix(0.1, 0.03, Math.max(hold, far)) + L.breath * breath, -hy * X.back * 0.5, lean * 0.2 + tilt * 0.4 + rock * 0.5);
  for (const [n, sd] of [['L', 1], ['R', -1]]) setLeg(bn, n, at[n], toes[n], kf[n].yaw - yaw, sd * SET.kneeOut * (1 - hold));
  // weight: springs on the trunk and arms (before the hands are put where they go)
  sway(m, bn, p, dt, { mv: 0.6, run: 0 });
  if (p.holding) {
    const b = holdPoint(bn, V(0, 0, 0));
    placeHands(bn, grip('hug', b, 1), 1, 0.6, 1.5, true);
    m.held = b; g.hp = null;
    lookAt(bn, V(0, 1.6, 12), 0.6);
    return;
  }
  m.held = null;
  // hands out in front at waist height, palms to the ball, a little alive; lower and looser when it's far away
  const tb = ball ? toLocal(m, ball, V(0, 0, 0)) : V(0, 1, 10), gr = {};
  // (how hard he is starting or stopping, across and along, m/s2, smoothed: the hands are left behind by a few cm)
  const ac = g.ac ??= { x: 0, z: 0, lx, lz };
  if (dt > 1e-5) { const q = 1 - Math.exp(-dt * 10); ac.x += (clamp((lx - ac.lx) / dt, -14, 14) * L.trail - ac.x) * q; ac.z += (clamp((lz - ac.lz) / dt, -14, 14) * L.trail - ac.z) * q; }
  ac.lx = lx; ac.lz = lz;
  for (const [n, sd] of [['L', 1], ['R', -1]]) {
    const palm = V(sd * (mix(SET.hands[0], 0.24, far) + Hb.handOut), SET.hands[1] - 0.12 * far + Hb.handY, mix(SET.hands[2], 0.26, far) + Hb.handZ).applyQuaternion(bn.hips.quaternion).add(bn.hips.position);
    // the hands float (each on its own slow path), trail his body when it starts and stops, and ride his bounce late
    const fl = L.float * Hb.float * (1 - 0.5 * ease(sp / 1.5));
    palm.x += fl * Math.sin(t * 1.3 + sd * 1.1) * sd - ac.x; palm.y += fl * 1.3 * Math.sin(t * 1.7 + sd * 2) + L.breath * 0.3 * breath - L.pump * Math.sin(beat - 0.9) * bk; palm.z += fl * Math.sin(t * 1.1 + sd * 0.7) - ac.z;
    const hp = (g.hp ??= {})[n] ??= palm.clone();
    palm.copy(hp.lerp(palm, dt > 0 ? 1 - Math.exp(-dt * L.follow) : 1));
    // the hands hang ready off bent elbows: fingers forward and a little down, palms turned in toward each other and
    // half to the ball, wrists straight (palms square to the ball with the fingers up folded the wrists right back)
    const N = V(-sd * 0.75, -0.25, 0.6).lerp(V(-sd, -0.1, 0.1), far).normalize(), F = V(sd * 0.12, mix(-0.3, -0.75, far), 1).normalize();
    gr[n] = { palm, N, F: F.addScaledVector(N, -F.dot(N)).normalize() };
  }
  placeHands(bn, gr, 1, 0.55, 0.9);                                     // elbows narrow
  lookAt(bn, tb, 0.9);
}

// Where a ball he has hold of sits: against his chest (carried with the trunk).
export function holdPoint(bn, out) { chestPoint(bn, out); out.y -= 0.05; return out; }
