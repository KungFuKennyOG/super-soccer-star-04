// Skill moves and tricks, the whole body: what the hips, the standing leg, the trunk, the arms and the head
// do while the boot is on the ball (game/strike.js puts it there; the sim says where the ball is and when).
// Each move is a short run of key poses in the order coaching breakdowns of the real move give, laid over
// whatever pose he has. How low he gets, how far he leans and how his head leads a spin are measured from
// captures of the same body mechanics in another sport (CMU mocap subject 78: a feint-and-go, a spin move).
//
//   knock-on   a push with the laces in stride: no planted foot, the other leg carries on as the stance leg,
//              opposite arm forward, the trunk tipping into the sprint
//   nutmeg     the same from a crouch, a toe-poke
//   flick-up   the leg lifting from knee and hip, weight on the standing leg, chest up, arms out
//   drag-back  the standing foot planted beside the ball, knee bent, hips low and back, body over the ball
//              and opening to the dragging side, arms out
//   step-over  the hips drop, the shoulder drops and the trunk goes to the side of the fake while the boot
//              goes over the front of the ball (inside to outside when you fake to your right, outside to
//              inside to your left), then the lean and the chest go the other way and he drives off. The sim
//              bursts him and the ball away as the move begins, so the fake and the go overlap: the boot goes
//              round where the ball was, he drives off the other foot, and the boot lands as his next step
//   roulette   right sole on the ball as he turns left over it, low; the right foot comes down past the
//              ball, the left sole takes it on and rolls it away behind him as he comes round; head leading
//   rainbow    a hop: the left foot, turned out, sweeps the ball back and up the right calf, then lands as
//              the right heel flicks it up; trunk forward
//
// Model space (game/legik.js): +z the way he faces, +x his left. Written right-footed (game/actors.js mirrors).
// m.trick = { kind, t, dir, spin, pin } while one is on. Call trickHips before the boot is sent to the ball,
// trickLegs after it, trickBody before layerLook and trickHead after it.
import * as THREE from 'three';
import { BALL, STRIKE } from '../rules/tuning.js';
import { P } from './body.js';
import { ankleOf, footOf, reachLeg, aimFoot } from './legik.js';
import { gaitOf, smooth, mix, clamp, wrap } from './gait.js';

const TAU = Math.PI * 2, SPIN = 0.5;                 // the roulette's turn takes this long (s)
const LEN = { knock: 0.34, nutmeg: 0.4, flick: 0.6, drag: 0.46, stepover: 0.42, roulette: 0.58, rainbow: 0.5 };
const EASE = { knock: 0.03, nutmeg: 0.03, flick: 0.04, rainbow: 0.04 };            // how fast the body gets into it (s; 0.07 otherwise)
const SOLE = 0.06, REACH = 0.42;                    // the studs' spot ahead of the ankle; how far from under the hips a planted foot can be (m)

// Key poses above the hips: [time, [trunk forward, trunk to his left, chest turned left,
//   left arm: forward, out, elbow bend,  right arm: forward, out, elbow bend]] (rad)
const BODY = {
  knock: [[0, [0.18, 0, -0.2, 0.6, 0.2, 1.3, -0.6, 0.25, 1.1]], [0.14, [0.3, 0, 0, 0.2, 0.2, 1.3, -0.2, 0.2, 1.3]]],
  nutmeg: [[0, [0.28, 0, -0.15, 0.4, 0.35, 1.0, -0.4, 0.4, 0.9]], [0.16, [0.3, 0, 0, 0.1, 0.3, 1.2, -0.1, 0.3, 1.2]]],
  flick: [[0, [-0.03, 0.07, 0, 0.1, 0.5, 0.45, 0.1, 0.5, 0.45]], [0.16, [-0.08, 0.08, 0, 0.05, 0.65, 0.4, 0.15, 0.65, 0.4]], [0.45, [-0.03, 0.03, 0, 0.05, 0.45, 0.4, 0.1, 0.45, 0.4]]],
  drag: [[0.1, [0.3, 0.06, -0.15, 0.35, 0.55, 0.7, -0.35, 0.7, 0.6]], [0.2, [0.26, 0.08, -0.32, 0.25, 0.6, 0.8, -0.45, 0.75, 0.5]], [0.36, [0.15, 0, -0.15, 0.1, 0.4, 0.8, -0.2, 0.5, 0.7]]],
  // (fake to his right; mirrored for a fake to his left) shoulder dropped and arm tucked on the fake's side, the other flung out; then the drive
  stepover: [[0.07, [0.32, -0.3, -0.25, -0.1, 0.85, 0.7, 0.1, 0.25, 0.9]], [0.2, [0.42, 0.12, 0.3, -0.5, 0.35, 1.1, 0.5, 0.3, 1.2]], [0.36, [0.3, 0.05, 0, 0, 0.25, 1.2, 0, 0.25, 1.2]]],
  // low over the ball, the right arm up to hold his man off, both out for balance
  roulette: [[0.08, [0.38, 0.05, 0.25, -0.2, 0.42, 1.0, 0.35, 0.7, 1.15]], [0.25, [0.4, 0, 0.15, 0.1, 0.55, 1.1, -0.1, 0.55, 1.0]], [0.42, [0.3, 0, 0, 0.2, 0.35, 1.2, -0.2, 0.35, 1.2]]],
  rainbow: [[0.04, [0.15, 0, 0, -0.1, 0.5, 0.6, -0.15, 0.55, 0.6]], [STRIKE.rainbow, [0.4, 0, 0, -0.3, 0.6, 0.6, -0.3, 0.65, 0.6]], [0.22, [0.42, 0, 0, -0.2, 0.5, 0.8, -0.2, 0.5, 0.8]], [0.4, [0.25, 0, 0, 0, 0.3, 1.1, 0, 0.3, 1.1]]],
};

const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), q = new THREE.Quaternion(), qf = new THREE.Quaternion(), q0 = new THREE.Quaternion();
const eul = new THREE.Euler(), feul = new THREE.Euler(0, 0, 0, 'YXZ');
const aL = new THREE.Vector3(), aR = new THREE.Vector3(), a0 = new THREE.Vector3(), T = new THREE.Vector3(), B = new THREE.Vector3(), qL = new THREE.Quaternion(), qR = new THREE.Quaternion();
const pose = new Float64Array(9);
// up from a to b, held, down again from c to d
const bump = (t, a, b, c, d) => smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)));
const toward = (b, x, y, z, k) => b.quaternion.slerp(q.setFromEuler(eul.set(x, y, z)), k);
const turn = (b, a) => b.quaternion.premultiply(q.setFromAxisAngle(Y, a));

// Which trick he is in (or null). A skill move comes as m.special, a knock-on or a flick-up as the strike that hits it.
function trickOf(m, dt) {
  const sp = m.special, st = m.strike;
  const src = sp && LEN[sp.kind] ? sp : st && st.hit && (st.kind === 'poke' || st.kind === 'push' || st.kind === 'scoop') ? st : null;
  let tr = m.trick;
  if (src && (!tr || tr.src !== src)) tr = m.trick = { kind: src === sp ? sp.kind : st.kind === 'scoop' ? 'flick' : 'knock', src, t: src === sp ? sp.t : 0, pin: {}, yaw0: null, go: 0, dir: 0, spin: 0, hy: 0 };
  else if (tr) tr.t = tr.src === sp ? sp.t : tr.t + dt;
  if (!tr) return null;
  if (tr.t <= LEN[tr.kind]) return tr;
  if (!src) m.trick = null;                               // (kept while its special lasts, so it isn't begun again)
  return null;
}

// A foot put down: its spot on the pitch is kept while the body goes on over it (out: the ankle, model
// space), as far as a leg reaches; past that it is left behind and comes up off the grass. x, z: where it is put down, the first time (z ahead
// the way he is going, tr.go, which the model's heading is a step or two behind when a skill bursts him off;
// or `go`: the heading x and z are given in).
function plant(m, tr, n, x, z, out, go = tr.go) {
  const r = m.root.position, ry = m.root.rotation.y, c = Math.cos(ry), s = Math.sin(ry), h = m.bone.hips.position, cg = Math.cos(go), sg = Math.sin(go);
  const p = tr.pin[n] || (tr.pin[n] = { x: r.x + x * cg + z * sg, z: r.z - x * sg + z * cg });
  out.set((p.x - r.x) * c - (p.z - r.z) * s, P.ankleY, (p.x - r.x) * s + (p.z - r.z) * c);
  const ox = out.x - h.x, oz = out.z - h.z, d = Math.hypot(ox, oz);
  p.far = Math.max(0, d - REACH);                      // left behind: it peels off the grass and trails (stance)
  if (d > REACH) { out.x = h.x + ox / d * REACH; out.z = h.z + oz / d * REACH; }
  return out;
}
// Sends a leg's ankle to pos with the foot turned yaw (toes to his left) and pitched (toes down), by w.
function leg(bn, n, pos, yaw, pitch, w) {
  if (w <= 0) return;
  ankleOf(bn, n, a0); footOf(bn, n, q0);
  pos.y = Math.max(P.ankleY, pos.y);
  reachLeg(bn, n, a0.lerp(pos, Math.min(1, w))); aimFoot(bn, n, q0.slerp(qf.setFromEuler(feul.set(pitch, yaw, 0)), Math.min(1, w)));
}
// A planted foot bearing his weight: flat, then up on its toes as it is left behind.
function stance(m, tr, n, x, z, yaw, w, go, up = 0) {
  plant(m, tr, n, x, z, T, go);
  const far = tr.pin[n].far, back = clamp((m.bone.hips.position.z - T.z - 0.12) * 3 + far * 3, 0, 0.9);
  T.y += 0.2 * Math.sin(back) - 0.085 * (1 - Math.cos(back)) + Math.min(0.25, far * 0.7) + up;
  leg(m.bone, n, T, yaw, back, w);
}
// Where the ankle is with the studs on top of the ball at b, the foot turned yaw (out).
const onBall = (b, yaw, out) => out.set(b.x - SOLE * Math.sin(yaw), b.y + BALL.r + 0.085, b.z - SOLE * Math.cos(yaw));

// Hips first: how low he sits, where his weight is, which way his pelvis is turned (the roulette's spin, the
// step-over's fake, a drag-back opening out). The feet stay where the run has them. Returns the trick, or null.
export function trickHips(m, bn, p, ball, dt) {
  const st = m.strike, nut = m.special && m.special.kind === 'nutmeg';
  if (st && st.kind === 'poke' && !nut) st.kind = 'push';              // a knock-on is a push with the laces (game/strike.js STYLE)
  const tr = trickOf(m, dt);
  if (!tr) return null;
  const t = tr.t, first = !!m.firstPerson, h = bn.hips, g = gaitOf(m), ry = m.root.rotation.y;
  if (tr.yaw0 === null) tr.yaw0 = first || g.yaw === null ? ry : g.yaw - g.dyaw;        // the way he was facing when it began
  tr.go = Math.hypot(p.vx, p.vz) > 1 ? Math.atan2(p.vx, p.vz) : ry;
  if (t < 0.05 && (tr.kind === 'roulette' || tr.kind === 'stepover')) tr.pin.L = null;  // (the burst starts a step after the move: the foot goes down once he's off)
  if (tr.kind === 'stepover' && !tr.dir) {
    // which way the fake goes: the sim bursts him off the other way (rules/skills.js), a step after the move begins
    const side = p.vx * -p.fz + p.vz * p.fx;
    if (Math.abs(side) > 2) tr.dir = side < 0 ? 1 : -1;
    tr.src.dir = tr.dir || 1;
  }
  if (tr.kind === 'stepover' && ball) {
    // the boot goes round where the ball was as the move began, carried along with him (game/strike.js poseHold)
    const rot = first ? 0 : wrap(tr.yaw0 - ry), c = Math.cos(ry), s = Math.sin(ry), dx = ball.x - m.root.position.x, dz = ball.z - m.root.position.z;
    if (!tr.c) { tr.c = new THREE.Vector3(dx * c - dz * s, 0, dx * s + dz * c).applyAxisAngle(Y, -rot); tr.c.z = Math.min(tr.c.z, 0.34); }   // (no further off than a leg goes round)
    tr.src.c = (tr.src.c || new THREE.Vector3()).copy(tr.c).applyAxisAngle(Y, rot); tr.src.rot = rot;
  }
  const dir = tr.dir || 1;
  let sink = 0, yaw = 0, sx = 0, sz = 0, tip = 0, spin = 0;
  if (tr.kind === 'drag') { const e = bump(t, 0, 0.09, 0.2, 0.42); sink = 0.02 * e; sx = 0.04 * e; sz = -0.14 * e; yaw = -0.3 * bump(t, 0.04, 0.2, 0.26, 0.46); }   // sat back over the standing leg, the other reaching out to the ball
  else if (tr.kind === 'roulette') {
    const u = clamp(t / SPIN, 0, 1), e = bump(t, 0, 0.1, 0.3, 0.52);
    spin = u < 1 ? TAU * mix(u, smooth(u), 0.35) : 0; sink = 0.08 * e; sz = 0.18 * e; tip = 0.08 * e;
    tr.src.yaw = spin - 0.6 * smooth(t / 0.1);                           // the foot on the ball turns with him, toes a little out
  } else if (tr.kind === 'stepover') { sink = 0.08 * bump(t, 0, 0.08, 0.17, 0.38); yaw = -0.3 * dir * bump(t, 0, 0.07, 0.11, 0.24); sx = -0.05 * dir * bump(t, 0, 0.07, 0.11, 0.22); }
  else if (tr.kind === 'nutmeg') sink = 0.05 * bump(t, 0, 0.04, 0.12, 0.3);
  else if (tr.kind === 'flick') sx = 0.04 * bump(t, 0, 0.08, 0.3, 0.6);
  else if (tr.kind === 'rainbow') { const T0 = STRIKE.rainbow; sink = -0.06 * bump(t, 0, T0 * 0.55, T0 + 0.06, T0 + 0.16); tip = 0.1 * bump(t, 0.03, T0, 0.2, 0.45); }      // a hop
  // a skill's burst turns the model at once; his body comes round after it
  if (!first && (tr.kind === 'stepover' || tr.kind === 'roulette')) yaw += wrap(tr.yaw0 - ry) * (1 - smooth(t / 0.3));
  tr.spin = spin + (first ? 0 : yaw);
  tr.hy = h.position.y;
  if (tr.spin) turn(h, tr.spin);
  if (first) sx = sz = tip = 0;                                       // your own boots: the hips stay under you
  if (sink || sx || sz || tip) {
    ankleOf(bn, 'L', aL); ankleOf(bn, 'R', aR); footOf(bn, 'L', qL); footOf(bn, 'R', qR);
    h.position.y -= sink; h.position.x += sx; h.position.z += sz;
    if (tip) h.quaternion.multiply(q.setFromAxisAngle(X, tip));
    aL.y = Math.max(P.ankleY, aL.y); aR.y = Math.max(P.ankleY, aR.y);
    reachLeg(bn, 'L', aL); aimFoot(bn, 'L', qL); reachLeg(bn, 'R', aR); aimFoot(bn, 'R', qR);
  }
  return tr;
}

// The legs, after the boot has been sent to the ball (poseStrike, poseHold): the standing leg, the other
// foot's part in the move, and where the working foot goes when it leaves the ball. ball: the sim ball.
export function trickLegs(m, bn, tr, ball) {
  const t = tr.t, h = bn.hips, st = m.strike, ry = m.root.rotation.y, c = Math.cos(ry), s = Math.sin(ry);
  const dx = ball.x - m.root.position.x, dz = ball.z - m.root.position.z;
  B.set(dx * c - dz * s, ball.y ?? BALL.r, dx * s + dz * c);
  if (tr.kind === 'knock' || tr.kind === 'nutmeg') {
    // in stride: the hips don't drop for it, and the other leg is the one he is running on
    if (tr.kind === 'knock' && st) { ankleOf(bn, 'R', aR); footOf(bn, 'R', qR); h.position.y = tr.hy; reachLeg(bn, 'R', aR); aimFoot(bn, 'R', qR); }
    if (!tr.pin.L) ankleOf(bn, 'L', aL);
    stance(m, tr, 'L', clamp(aL.x, 0.07, 0.16), clamp(aL.z, 0.05, 0.3), 0.1, 1 - smooth((t - 0.08) / 0.12));
    // and the boot that played it comes down ahead of him as his next step
    if (t > 0.07) stance(m, tr, 'R', -0.1, 0.36, 0, smooth((t - 0.07) / 0.07) * (1 - smooth((t - 0.24) / 0.1)), undefined, 0.1 * (1 - smooth((t - 0.07) / 0.07)));
  } else if (tr.kind === 'drag') {
    // planted behind the ball and to its side, under him
    stance(m, tr, 'L', 0.15, clamp(B.z - 0.45, -0.1, 0.1), 0.2, smooth(t / 0.06) * (1 - smooth((t - 0.24) / 0.14)));
  } else if (tr.kind === 'stepover') {
    // he is already going the other way (the sim's burst): the left foot is the one he drives off while the
    // right goes over the front of the ball, and the right comes down as his first step on the new line
    const T1 = 0.15;
    stance(m, tr, 'L', 0.13, 0.05, 0.15, smooth(t / 0.05) * (1 - smooth((t - 0.1) / 0.1)));
    if (t > T1 - 0.03) stance(m, tr, 'R', -0.12, 0.2, 0, smooth((t - T1 + 0.03) / 0.05) * (1 - smooth((t - 0.27) / 0.1)));
  } else if (tr.kind === 'roulette') {
    const sp = tr.spin;
    // the left foot: the one he turns on, then up and onto the ball as the right comes down, rolling it away
    if (t < 0.2) { stance(m, tr, 'L', 0.2, 0.1, Math.max(0, sp - 0.7), smooth(t / 0.04), undefined, 0.12 * (1 - smooth(t / 0.06))); aL.copy(T); }   // (behind where the ball swings round to)
    if (t > 0.15 && t < 0.5) {
      const yaw = sp + 0.5, on = smooth((t - 0.15) / 0.085), off = smooth((t - 0.35) / 0.12);
      onBall(B, yaw, T);
      if (on < 1) { T.lerpVectors(aL, T, on); T.y += 0.08 * Math.sin(Math.PI * on); }
      T.y += 0.1 * smooth(off * 2); T.x += 0.12 * off * Math.cos(yaw); T.z -= 0.12 * off * Math.sin(yaw);     // up off it and out to his left
      leg(bn, 'L', T, yaw, 0, 1 - smooth((t - 0.4) / 0.1));
    }
    // the right foot: off the ball and down past it, under his right hip, his back to his man; then he turns on it
    if (t > 0.19 && t < 0.56) {
      if (!tr.pin.R) aR.set(B.x + 0.23, 0, B.z + 0.2);       // (ahead of the ball: the pitch goes by under him at a run)
      plant(m, tr, 'R', aR.x, aR.z, T, ry); T.y += 0.26 * (1 - smooth((t - 0.205) / 0.035));         // (it comes down past the top of the ball, not through it)
      leg(bn, 'R', T, sp - 0.3, 0, smooth((t - 0.185) / 0.03) * (1 - smooth((t - 0.42) / 0.12)));
    }
  } else if (tr.kind === 'rainbow') {
    // (k: how far through the wind-up; fl: seconds since the heel flicked it; the flick's own frame is held)
    const k = st && !st.hit ? Math.min(1, st.t / st.wind) : 1, fl = st && st.kind === 'rainbow' ? Math.max(0, st.t - st.wind) : 9, gone = fl > 1e-4;
    // the right leg is the one the ball is rolled up: off the ground in the hop, ahead of the ball and outside it, until the heel flicks
    if (k < 1) { T.set(-0.3, 0.14 + 0.07 * k, 0.2 - 0.08 * k); leg(bn, 'R', T, -0.15, 0.2 * k, smooth(k / 0.2) * (1 - smooth((k - 0.6) / 0.4))); }
    // the left foot, turned out, behind the ball: its inside sweeps the ball back and up the calf; then it
    // comes through and lands ahead of him as the heel flicks, and he runs on over it
    if (!gone) { T.set(B.x - 0.016, B.y + 0.035, B.z - 0.18); tr.last = (tr.last || new THREE.Vector3()).copy(T); leg(bn, 'L', T, 1.3, 0.3, smooth(k / 0.3)); } else {
      const down = smooth(fl / 0.08), w = 1 - smooth((fl - 0.2) / 0.12);
      if (down < 1) { T.set(0.09, P.ankleY, 0.28).applyAxisAngle(Y, tr.go - ry); T.lerpVectors(tr.last || T, T, down); T.y += 0.06 * Math.sin(Math.PI * down); const str = 1 - smooth((fl - 0.03) / 0.05); leg(bn, 'L', T, 1.3 * str, 0.3 * str, w); }
      else stance(m, tr, 'L', 0.09, 0.28, 0.1, 1 - smooth((fl - 0.14) / 0.1));
      // and the heel comes down and through for the next step
      if (fl > 0.12) stance(m, tr, 'R', -0.1, 0.36, 0, smooth((fl - 0.12) / 0.09) * (1 - smooth((fl - 0.28) / 0.09)), undefined, 0.12 * (1 - smooth((fl - 0.12) / 0.09)));
    }
  }
}

// Above the hips: the move's key poses for the trunk and arms, eased from one to the next and laid over the
// pose he has. Call before layerLook (it levels the head over whatever the trunk does).
export function trickBody(m, bn, tr) {
  const keys = BODY[tr.kind], t = tr.t, flip = tr.kind === 'stepover' && tr.dir < 0;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[Math.min(keys.length - 1, i + 1)], k = smooth((t - a[0]) / ((b[0] - a[0]) || 1));
  for (let j = 0; j < 9; j++) pose[j] = mix(a[1][j], b[1][j], k);
  if (flip) { pose[1] = -pose[1]; pose[2] = -pose[2]; for (let j = 3; j < 6; j++) { const v = pose[j]; pose[j] = pose[j + 3]; pose[j + 3] = v; } }
  const w = smooth(t / (EASE[tr.kind] || 0.07)) * (1 - smooth((t - LEN[tr.kind] + 0.16) / 0.16));
  toward(bn.spine, pose[0] * 0.6, pose[2] * 0.4, -pose[1] * 0.5, w); toward(bn.chest, pose[0] * 0.4, pose[2] * 0.6, -pose[1] * 0.5, w);
  toward(bn.upperArmL, -pose[3], -0.2, pose[4], w); toward(bn.foreArmL, -pose[5], 0, 0, w);
  toward(bn.upperArmR, -pose[6], 0.2, -pose[7], w); toward(bn.foreArmR, -pose[8], 0, 0, w);
  if (tr.spin) turn(bn.hips, -tr.spin);                 // (the head is turned as if he weren't spinning: trickHead puts the spin back)
}

// The head, after layerLook: in a spin it goes round ahead of the shoulders, eyes down on the ball.
export function trickHead(bn, tr) {
  if (tr.spin) turn(bn.hips, tr.spin);
  if (tr.kind !== 'roulette') return;
  const e = bump(tr.t, 0.02, 0.1, 0.25, 0.42);
  turn(bn.neck, 0.25 * e); turn(bn.head, 0.25 * e);
  bn.neck.quaternion.multiply(q.setFromAxisAngle(X, 0.12 * e)); bn.head.quaternion.multiply(q.setFromAxisAngle(X, 0.12 * e));
}
