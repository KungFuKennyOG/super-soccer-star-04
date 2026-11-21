// A defender who has been beaten. The sim takes him out of the play for a moment (p.stun, rules/sim.js and
// rules/skills.js: quarter speed for 0.45 to 1.5 s after a skill move or a drag-back fools him) and says no more.
// This is what he does with that moment, and what he does going in for a ball that isn't there any more.
//
//   wrong-footed   (step-over, drag-back, roulette) he pulls up hard out of his run, off balance: two recorded
//                  hard stops from a run (CMU 127_05, 127_19, baked by tools/build-anim.mjs as stopA / stopB) give
//                  the pelvis (its turn side-on and how low he sits) and everything above it: the arms thrown up
//                  and out, the trunk going on over his feet and coming back. His feet stay the run's own (they
//                  brake in short steps and grip the pitch: game/gait.js), because the sim keeps moving him.
//                  A step-over's fake also throws him half a metre to the side of the fake in one step of the
//                  sim; here he goes there over a fifth of a second, on his outside foot, and opens that way.
//   nutmegged      his knees come together too late, he sits, bends to look down between his legs, then his
//                  head goes round after the ball (built: there is no recording of it)
//   lobbed         (rainbow) his head goes back to follow the ball over him, his weight goes onto his heels,
//                  arms out (built)
//   going in       (p.tackleT counting: he is within reach of the ball) the leg nearer the ball reaches for it,
//                  inside of the foot leading, hips low; if the ball is gone before he wins it, the leg is left
//                  stretching, his trunk goes on over it and he catches himself (built)
//
// Nobody falls: the shortest of these moments is 0.45 s and none is long enough to get up again from the grass.
// Which way he opens, which recording, and how much of it are his own (his seed) and the side he was beaten on.
// Model space: +z the way he faces, +x his left. m.beat = { kind, t, T, ... } while one is on.
import * as THREE from 'three';
import { CLIPS, BONES, applyPose } from './mocap.js';
import { sampleOnce, newOnce } from './keepercap.js';
import { ankleOf, footOf, reachLeg, aimFoot } from './legik.js';
import { gaitOf, smooth, clamp } from './gait.js';

// how much of the recorded stop each kind takes, and how long the sim gives it when nothing says (a replay)
const KINDS = { feint: { clip: 1, T: 0.6 }, drag: { clip: 1, T: 0.6 }, spin: { clip: 0.85, T: 0.45 }, nutmeg: { clip: 0.4, T: 1.1 }, rainbow: { clip: 0.3, T: 1.5 }, miss: { clip: 0.45, T: 0.4 } };
export const BEATS = Object.keys(KINDS);
const SHIFT = 0.2, TURN = 0.55, SINK = 0.2, OUT = [0.2, 0.32];      // s the fake's side-step takes; how much of the recording's pelvis turn he takes; the most he sits (m); the ease back to his run starts this long before the stun ends, and takes this long
const LUNGE = { rise: 0.12, fall: 0.2, reach: 0.72, drop: 0.07, lean: 0.28 };      // s to stretch and to come back; m from under the hip; m; rad
const TRUNK = new Set(['spine', 'chest', 'clavicleL', 'upperArmL', 'foreArmL', 'clavicleR', 'upperArmR', 'foreArmR']);
const NB = BONES.length, HI = BONES.indexOf('hips'), frac = x => x - Math.floor(x);
const PAIR = BONES.map(n => (/[LR]$/.test(n) ? BONES.indexOf(n.slice(0, -1) + (n.endsWith('L') ? 'R' : 'L')) : -1));
const bump = (t, a, b, c, d) => smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)));
const X = new THREE.Vector3(1, 0, 0), ID = new THREE.Quaternion();
const q = new THREE.Quaternion(), q0 = new THREE.Quaternion(), v = new THREE.Vector3(), eul = new THREE.Euler();
const aL = new THREE.Vector3(), aR = new THREE.Vector3(), fL = new THREE.Quaternion(), fR = new THREE.Quaternion(), B = new THREE.Vector3(), H = new THREE.Vector3();

// the pose seen in a mirror down his middle
function mirror(src, out) {
  for (let b = 0; b < NB; b++) { const o = (PAIR[b] < 0 ? b : PAIR[b]) * 4; out.q[o] = src.q[b * 4]; out.q[o + 1] = -src.q[b * 4 + 1]; out.q[o + 2] = -src.q[b * 4 + 2]; out.q[o + 3] = src.q[b * 4 + 3]; }
  out.h[0] = -src.h[0]; out.h[1] = src.h[1]; out.h[2] = src.h[2];
  return out;
}
// each recorded stop: its length, and which way the man recorded turned as he pulled up (+1 to his left)
const STOPS = ['stopA', 'stopB'].map(n => CLIPS[n]).filter(Boolean).map(c => {
  const P = newOnce(), len = (c.n - 1) / c.hz;
  let yaw = 0;
  for (let t = 0; t < len; t += 0.05) { sampleOnce(c, t, P); v.set(0, 0, 1).applyQuaternion(q.fromArray(P.q, HI * 4)); const a = Math.atan2(v.x, v.z); if (Math.abs(a) > Math.abs(yaw)) yaw = a; }
  return { c, len, open: Math.sign(yaw) || 1, first: sampleOnce(c, 0, newOnce()), firstM: mirror(sampleOnce(c, 0, newOnce()), newOnce()) };
});
const P1 = newOnce(), P2 = newOnce();

// He has just been beaten. p: the sim's defender (his speed now is how hard he has to pull up).
export function startBeat(m, p, kind, T = p.stun) {
  if (!KINDS[kind]) kind = 'drag';
  const g = gaitOf(m), v0 = Math.hypot(p.vx, p.vz);
  m.beat = { kind, t: 0, T: T > 0 && T < 5 ? T : KINDS[kind].T, fresh: true, k: clamp(v0 / 3.5, 0.6, 1) * (0.85 + 0.15 * frac(g.seed * 7.1)), stop: STOPS.length ? STOPS[frac(g.seed * 3.7) < 0.5 ? 0 : STOPS.length - 1] : null,
    open: 0, own: frac(g.seed * 5.3) < 0.5 ? 1 : -1, shift: null, w: 0, P: null, reach: null };
  m.stunSeen = p.stun ?? 0;
}
// What game/main.js does with a 'skill' or 'drag' event: every defender the sim has just stunned is beaten that
// way. models: by sim id; defs: the sim's defenders.
const OF = { stepover: 'feint', roulette: 'spin', nutmeg: 'nutmeg', rainbow: 'rainbow' };
// which kind an event of the sim's beats a man with (or null: he read it, or it isn't one)
export const beatKind = e => (e.type === 'drag' ? (e.read ? null : 'drag') : e.type === 'skill' && e.ok ? OF[e.move] || null : null);
export function beaten(models, defs, e) {
  const kind = beatKind(e);
  if (!kind) return 0;
  let n = 0;
  for (const d of defs) { const m = models[d.id]; if (m && d.stun > 0.2 && d.stun < 5 && d.stun > (m.stunSeen || 0) + 0.15) { startBeat(m, d, kind); n++; } }
  return n;
}
// What a replay needs to play one back: 0 nothing, else 1 + the kind's place in BEATS on the frame it began.
export const beatCode = m => (m.beat && m.beat.fresh ? 1 + BEATS.indexOf(m.beat.kind) : 0);

// First thing in his pose (after placeModel): notices what nobody told the page about (a stun with no event, a
// tackle that came to nothing), and for a step-over's fake lets him get to where the sim has put him in his own
// time. Returns the sim player to pose him as (p, or p on his way there).
export function beatWatch(m, p, dt, onBall) {
  let st = m.beat;
  const tk = p.tackleT || 0, r = m.root;
  if (p.stun !== undefined) { if (p.stun > (m.stunSeen || 0) + 0.15 && p.stun < 5) { startBeat(m, p, 'drag'); st = m.beat; } m.stunSeen = p.stun; }
  // going in: the reach grows while the sim counts him in, and comes back when it stops
  const going = tk > (m.lastTk || 0) + 1e-6 && !onBall;      // (counting up: the sim leaves the count standing when the ball runs loose)
  m.lastTk = tk;
  m.lunge = clamp((m.lunge || 0) + (going ? dt / LUNGE.rise : -dt / LUNGE.fall), 0, 1);
  if (m.lungeOn && !going && !onBall && !st && m.lungeT > 0.06) { startBeat(m, p, 'miss'); st = m.beat; }
  m.lungeT = going ? (m.lungeT || 0) + dt : 0; m.lungeOn = going;
  let out = p;
  if (st) {
    if (st.fresh && m.last && dt > 0) {
      // (the fake's half metre: a jump in where he is that his speed doesn't account for)
      const jx = p.x - m.last.x - p.vx * dt, jz = p.z - m.last.z - p.vz * dt, j = Math.hypot(jx, jz);
      if (j > 0.25 && j < 1) { st.shift = { x: -jx, z: -jz }; st.open = Math.sign(jx * Math.cos(r.rotation.y) - jz * Math.sin(r.rotation.y)) || 1; }
    }
    if (st.shift) {
      const u = Math.min(1, st.t / SHIFT), k = 1 - smooth(u), du = u < 1 ? 6 * u * (1 - u) / SHIFT : 0;
      out = Object.create(p); out.x = p.x + st.shift.x * k; out.z = p.z + st.shift.z * k; out.vx = p.vx - st.shift.x * du; out.vz = p.vz - st.shift.z * du;
      r.position.x = out.x; r.position.z = out.z;
    }
    st.fresh = false;
    st.w = smooth(st.t / 0.08) * (1 - smooth((st.t - (st.T - OUT[0])) / OUT[1]));
    st.t += dt;
    if (st.t > st.T - OUT[0] + OUT[1]) m.beat = null;
  }
  m.last = m.last || { x: 0, z: 0 }; m.last.x = p.x; m.last.z = p.z;
  return out;
}

const toModel = (m, o, out) => { const c = Math.cos(m.root.rotation.y), s = Math.sin(m.root.rotation.y), dx = o.x - m.root.position.x, dz = o.z - m.root.position.z; return out.set(dx * c - dz * s, o.y ?? 0.11, dx * s + dz * c); };
// Turns a leg about the line from its hip to its ankle (the ankle stays where it is): + brings the knee in.
function knee(bn, n, a) {
  const up = bn['upperLeg' + n], h = bn.hips;
  ankleOf(bn, n, v); H.copy(up.position).applyQuaternion(h.quaternion).add(h.position);
  v.sub(H).normalize().applyQuaternion(q0.copy(h.quaternion).invert());
  footOf(bn, n, q0);
  up.quaternion.premultiply(q.setFromAxisAngle(v, (n === 'L' ? 1 : -1) * a));
  aimFoot(bn, n, q0);
}

// The pelvis and legs. Call after the stride's legs are posed. ball: the sim ball (or null).
export function beatLegs(m, bn, ball) {
  const st = m.beat, L = m.lunge || 0;
  if (!st && L <= 0) return;
  const h = bn.hips;
  ankleOf(bn, 'L', aL); ankleOf(bn, 'R', aR); footOf(bn, 'L', fL); footOf(bn, 'R', fR);
  if (ball) toModel(m, ball, B);
  let pinch = 0, reach = L, leg = m.lungeLeg || 'R';
  if (ball && !m.lungeHeld && !(st && st.reach)) m.lungeLeg = leg = B.x > 0 ? 'L' : 'R';      // (chosen while no leg is out)
  m.lungeHeld = L > 0;
  if (st) {
    const t = st.t, w = st.w, K = KINDS[st.kind];
    // which way he opens: to the fake (a step-over, set as he is thrown there), else to the side the ball is on, else his own
    if (!st.open) st.open = ball && Math.abs(B.x) > 0.2 ? Math.sign(B.x) : st.own;      // (settled as it begins)
    const open = st.open, S = st.stop;
    if (S) {
      // the recorded stop, a little quicker than life when the sim's moment is short; seen in a mirror if he opens the other way
      const flip = S.open !== open, tc = Math.min(S.len, t * clamp(0.85 / st.T, 1, 1.4));
      st.P = sampleOnce(S.c, tc, P1); if (flip) st.P = mirror(P1, P2);
      const F = flip ? S.firstM : S.first, wk = w * st.k * K.clip;
      // the pelvis: how far it has turned and tipped since the stop began, and how far it has sunk
      q.fromArray(st.P.q, HI * 4).multiply(q0.fromArray(F.q, HI * 4).invert());
      h.quaternion.premultiply(q0.copy(ID).slerp(q, wk * TURN));
      h.position.y += clamp(st.P.h[1] - F.h[1], -SINK, 0.03) * wk;
    }
    if (st.kind === 'feint') h.position.x += 0.06 * open * bump(t, 0, 0.1, 0.25, 0.45) * w;                       // over the outside foot
    if (st.kind === 'nutmeg') { h.position.y -= 0.06 * bump(t, 0.04, 0.2, 0.5, 0.8) * w; pinch = 0.32 * bump(t, 0.03, 0.15, 0.4, 0.65) * w; }
    if (st.kind === 'rainbow') { h.position.z -= 0.07 * bump(t, 0.1, 0.35, 0.8, 1.2) * w; h.position.y -= 0.03 * bump(t, 0.1, 0.35, 0.8, 1.2) * w; }      // back on his heels
    // a tackle that found nothing, or a man spun round: the leg he sent stays out where the ball was a moment longer
    if (st.kind === 'miss' || st.kind === 'spin') {
      if (!st.reach && ball) { st.reach = { x: ball.x, y: 0.11, z: ball.z }; st.l0 = L; }
      const hold = st.kind === 'miss' ? st.l0 * (1 - smooth((t - 0.1) / 0.22)) : Math.max(st.l0 * (1 - smooth(t / 0.1)), bump(t, 0, 0.1, 0.16, 0.36));
      if (st.reach && hold > reach) { reach = hold; toModel(m, st.reach, B); }
    }
  }
  // the reaching leg: the ankle sent toward the ball, low, toes out and up, as far as the leg goes; he sits into it
  if (reach > 0 && (ball || (st && st.reach))) {
    const sd = leg === 'L' ? 1 : -1, a = leg === 'L' ? aL : aR, f = leg === 'L' ? fL : fR;
    h.position.y -= LUNGE.drop * reach; h.position.z += 0.06 * reach;
    H.set(sd * 0.09, 0, 0).applyQuaternion(h.quaternion).add(h.position);
    let ox = B.x - sd * 0.04 - H.x, oz = B.z - 0.13 - H.z;
    const d = Math.hypot(ox, oz) || 1, far = Math.min(d, LUNGE.reach);
    ox *= far / d; oz *= far / d;
    v.set(H.x + ox, 0.14, H.z + oz);      // (the boot clear of the grass: it is poking at the ball, not standing)
    a.lerp(v, reach * 0.9); f.slerp(q.setFromEuler(eul.set(-0.25, sd * 0.7 + Math.atan2(ox, oz), 0, 'YXZ')), reach * 0.9);
  }
  aL.y = Math.max(aL.y, 0.085); aR.y = Math.max(aR.y, 0.085);
  reachLeg(bn, 'L', aL); aimFoot(bn, 'L', fL); reachLeg(bn, 'R', aR); aimFoot(bn, 'R', fR);
  if (pinch > 0) { knee(bn, 'L', pinch); knee(bn, 'R', pinch); }
}

const lean = (bn, a) => { bn.spine.quaternion.premultiply(q.setFromAxisAngle(X, a * 0.55)); bn.chest.quaternion.premultiply(q.setFromAxisAngle(X, a * 0.45)); };
const arm = (bn, n, fwd, out, bend, w) => { const sd = n === 'L' ? 1 : -1; bn['upperArm' + n].quaternion.slerp(q.setFromEuler(eul.set(-fwd, -sd * 0.2, sd * out, 'XYZ')), w); bn['foreArm' + n].quaternion.slerp(q.setFromEuler(eul.set(-bend, 0, 0, 'XYZ')), w); };
// The trunk and arms. Call after the upper body and its layers are posed, before the head is aimed.
export function beatBody(m, bn) {
  const st = m.beat, L = m.lunge || 0;
  if (st) {
    const t = st.t, w = st.w;
    if (st.P) applyPose(bn, st.P, w * st.k * KINDS[st.kind].clip, TRUNK);
    if (st.kind === 'nutmeg') { lean(bn, 0.42 * bump(t, 0.04, 0.2, 0.42, 0.75) * w); const a = 0.7 * bump(t, 0.02, 0.14, 0.5, 0.85) * w; arm(bn, 'L', 0.15, 0.55, 0.5, a); arm(bn, 'R', 0.15, 0.55, 0.5, a); }
    if (st.kind === 'rainbow') { lean(bn, -0.2 * bump(t, 0.05, 0.3, 0.75, 1.15) * w); const a = 0.75 * bump(t, 0.05, 0.3, 0.8, 1.2) * w; arm(bn, 'L', -0.2, 0.85, 0.45, a); arm(bn, 'R', -0.1, 0.7, 0.6, a); }
    if (st.kind === 'miss') lean(bn, 0.3 * bump(t, 0, 0.08, 0.16, 0.38));                // going on over the leg he sent
  }
  if (L > 0) {
    // going in: over the reaching leg, that side's arm out, the other back
    const n = m.lungeLeg || 'R', o = n === 'L' ? 'R' : 'L';
    lean(bn, LUNGE.lean * L); arm(bn, n, 0.2, 0.75, 0.5, 0.7 * L); arm(bn, o, -0.5, 0.35, 0.9, 0.7 * L);
  }
}

// The head, after it has been put on the ball: down between his legs for a nutmeg; back, to follow one over him.
export function beatHead(m, bn, ball) {
  const st = m.beat;
  if (!st) return;
  let a = 0;
  if (st.kind === 'nutmeg') a = 0.3 * bump(st.t, 0.04, 0.18, 0.36, 0.6) * st.w;
  if (st.kind === 'rainbow' && ball) { toModel(m, ball, B); a = -clamp(Math.atan2((ball.y ?? 0) - 1.62, Math.hypot(B.x, B.z) + 0.3), 0, 1.1) * 0.5 * st.w; }
  if (a) { bn.neck.quaternion.multiply(q.setFromAxisAngle(X, a)); bn.head.quaternion.multiply(q.setFromAxisAngle(X, a)); }
}
