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
export const SPLIT = {
  // the split step (pre-jump): a hop only just off the grass, timed to land as the ball leaves the boot. fly: s in
  // the air (a body that rises `up` and falls again takes 2 x sqrt(2 x up / g) = 0.128 s); wide: m wider he lands;
  // sink: m the hips give into the landing over `give` s; held `hold` s, then eased off
  fly: 0.128, up: 0.02, rise: 0.01, wide: 0.08, sink: 0.055, give: 0.14, hold: 0.55,
};
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
  const bn = m.bone, root = m.root, yaw = root.rotation.y, kf = m.kf || plantFeet(m), G = GAIT, S = SPLIT;
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
  const far = ball ? clamp((Math.hypot(ball.x - p.x, ball.z - p.z) - 18) / 10, 0, 1) : 0;
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
  const C = side ? mix(G.cycle[0], G.cycle[1], k) : mix(0.42, 0.5, k), duty = side ? mix(G.duty[0], G.duty[1], k) : mix(0.6, 0.42, k), lag = side ? mix(G.lag[0], G.lag[1], k) : 0.5;
  const width = mix(SET.width, 0.36, hold) + wide + (side ? G.wide * Math.min(sp, 2.2) * (1 - hold) : 0);
  const lift = n => { const f = kf[n]; if (!f.air) f.air = { from: f.p.clone(), yaw0: f.yaw, t: 0, T: g.on ? (1 - duty) * C : G.step.time }; };
  if (!g.on && sp > G.on && !busy) { g.on = true; g.lead = side ? near : g.last; g.ph = lag + duty - 1e-3; }
  else if (g.on && (sp < G.off || busy)) g.on = false;
  if (g.on) {
    if (side && near !== g.lead) { g.lead = near; g.ph = lag + duty - 1e-3; }      // he turns back: as from a standing start, the new near foot first
    const prev = g.ph; g.ph += dt / C;
    for (const n of ['L', 'R']) { const end = (n === g.lead ? lag : 0) + duty; if (Math.floor(g.ph - end) > Math.floor(prev - end)) lift(n); }
  }
  const home = {};
  for (const [n, sd] of [['L', 1], ['R', -1]]) home[n] = toWorldPt(m, V(sd * width / 2, 0, SET.ahead), V(0, 0, 0));
  if (!g.on && !busy && !kf.L.air && !kf.R.air) {
    // standing or creeping: a foot left behind its place, or pointing too far off it, steps (the worse one; in turn when it's close)
    let pick = null, worst = G.step.far * (1 + 0.4 * hold);
    for (const [n, sd] of [['L', 1], ['R', -1]]) {
      const f = kf[n], e = f.p.distanceTo(home[n]) + (G.step.far / G.step.turn) * Math.abs(turnTo(f.yaw, yaw + sd * SET.toeOut, 1) - f.yaw) + (n !== g.last ? 0.015 : 0);
      if (e > worst) { worst = e; pick = n; }
    }
    if (pick) lift(pick);
  }
  // how far from under its hip a foot can be with the hips where they are (the leg's length); whatever the clock
  // says, a foot the body is leaving behind at the end of its leg comes with it
  const hz = SET.ahead * 0.4 - mix(0.09, 0.03, Math.max(hold, far)), maxR = Math.sqrt(Math.max(0.04, 0.85 * 0.85 - ((g.H ?? SET.hips) - 0.1) ** 2));
  const off = (n, sd, w, out) => { toLocal(m, w, out); out.x -= sd * 0.09; out.z -= hz; out.y = 0; return out; };
  if (sp > 0.05) for (const [n, sd] of [['L', 1], ['R', -1]]) {
    const f = kf[n], o = off(n, sd, f.p, tmp);
    if (!f.air && !busy && o.length() > maxR * 0.95 && o.x * lx + o.z * lz < 0) lift(n);
  }
  // the feet: planted, or in the air on the way to where they'll be wanted when they land
  const at = {}, toes = {}, E = g.on ? Math.min(G.reach, sp * duty * C / 2) : 0;
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
      if (sd * (tl.x - ol.x) < G.gap) tl.x = ol.x + sd * G.gap;
      // ...and within reach of the leg
      const dx = tl.x - sd * 0.09, dz = tl.z - hz, dr = Math.hypot(dx, dz), lim = maxR * 0.86;
      if (dr > lim) { tl.x = sd * 0.09 + dx * lim / dr; tl.z = hz + dz * lim / dr; }
      toWorldPt(m, tl, to);
      f.p.copy(a.from).lerp(to, ease(u)); f.yaw = turnTo(a.yaw0, yaw + sd * SET.toeOut, ease(u));
      up = Math.sin(Math.PI * u) * (a.hop ? S.up : G.lift[0] + G.lift[1] * Math.min(sp, 3.5));
      if (u >= 1) { f.air = null; g.last = n; m.phase = (m.phase || 0) + Math.PI; }
    }
    toes[n] = SET.heel * (1 - hold) + (f.air && !f.air.hop ? 0.22 * Math.sin(Math.PI * u) : 0);
    at[n] = toLocal(m, f.p, V(0, 0, 0)); at[n].y = ankleFor(toes[n]) + up;
  }
  // hips: low in the set and level as he moves (no bobbing), sinking into the split step's landing, up and loose
  // when the ball is far; never higher than both legs reach
  const Hset = mix(mix(SET.hips, SET.hipsFar, far), 0.93, hold) - sink - G.low * ease(sp / 2.6) * (1 - hold);
  if (g.H === null) { g.H = m.kLast && m.kState !== 'run' ? m.kLast[m.kLast.length - 2] : Hset; g.Hv = 0; }
  if (dt > 0) { const w = 16; g.Hv += (w * w * (Hset - g.H) - 2 * w * g.Hv) * dt; g.H += g.Hv * dt; }
  // (hz: sat back a little: bent forward, his weight stays over the balls of his feet)
  let H = g.H + S.rise * hop + 0.004 * Math.sin(t * 2.3 + (m.phase || 0) * 0.1);
  for (const [n, sd] of [['L', 1], ['R', -1]]) {
    const dx = at[n].x - sd * 0.09, dz = at[n].z - hz, dh2 = dx * dx + dz * dz;
    H = Math.min(H, at[n].y + Math.sqrt(Math.max(0.01, 0.85 * 0.85 - dh2)));
  }
  bn.hips.position.set(0, H, hz);
  const lean = clamp(lx * 0.012, -0.04, 0.04);                                 // a touch into the way he's going, from the hips
  bn.hips.rotation.set(mix(SET.pitch, 0.08, hold) * mix(1, 0.55, far) + sink * 1.2, 0, -lean);
  bn.spine.rotation.set(mix(0.16, 0.02, hold) * mix(1, 0.5, far), 0, lean * 0.8); bn.chest.rotation.set(mix(0.1, 0.03, Math.max(hold, far)), 0, lean * 0.2);
  for (const [n, sd] of [['L', 1], ['R', -1]]) setLeg(bn, n, at[n], toes[n], kf[n].yaw - yaw, sd * SET.kneeOut * (1 - hold));
  // weight: springs on the trunk and arms (before the hands are put where they go)
  sway(m, bn, p, dt, { mv: 0.6, run: 0 });
  if (p.holding) {
    const b = holdPoint(bn, V(0, 0, 0));
    placeHands(bn, grip('hug', b, 1), 1, 0.6, 1.5, true);
    m.held = b;
    lookAt(bn, V(0, 1.6, 12), 0.6);
    return;
  }
  m.held = null;
  // hands out in front at waist height, palms to the ball, a little alive; lower and looser when it's far away
  const tb = ball ? toLocal(m, ball, V(0, 0, 0)) : V(0, 1, 10), gr = {};
  for (const [n, sd] of [['L', 1], ['R', -1]]) {
    const palm = V(sd * mix(SET.hands[0], 0.24, far), SET.hands[1] - 0.12 * far + 0.01 * Math.sin(t * 3.1 + sd), mix(SET.hands[2], 0.26, far)).applyQuaternion(bn.hips.quaternion).add(bn.hips.position);
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
