// The keeper's saves: dives and standing saves, built from goalkeeping coaching and one biomechanics study
// (docs/notes-keeper-anim.md), with getting up off the grass from a motion capture (game/keepercap.js).
// The sim says a shot is coming his way (p.save { y, kind, id, eta }, p.dive -1 / 0 / 1); the save is latched
// and played out here in a frame of its own (where he stood and the way he faced when it began), so the body
// goes where the hands need it whatever the sim does with his spot in the meantime.
//
//   dive      power step: the near foot steps out at an angle toward the ball and the hips sink; the far leg
//             pushes first and the near one last (elite keepers, no crossover); in flight the body lays out along
//             a line to the ball (flatter for a low one, up across for a high one) with the hands leading; low
//             catch: the bottom hand behind it, the top hand on top, and the ball pinned to the grass; high
//             catch: palms behind it, then into the chest; parry: the near palm's heel on the inside of the ball,
//             pushed on, wide; landing on the side (calf, thigh, hip, then the side of the trunk), the top knee
//             drawn up; then up from the grass (captured)
//   standing  a ball at him: scooped from the grass (stoop, palms to it, fingers down), a basket at the waist
//             (palms up, into the stomach), W at the chest (thumbs together, behind it), or overhead off both
//             feet; feet first: a quick step across behind the line of the ball
import * as THREE from 'three';
import { stepBall } from '../rules/ball.js';
import { reachLeg, aimFoot } from './legik.js';
import { grip, placeHands, lookAt, pathAt, keyAt, mono, ankleFor, BALL_R } from './keeperhands.js';
import { getupPose, GETUP } from './keepercap.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), mix = (a, b, k) => a + (b - a) * k;
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ZD = 0.12, ZS = 0.36;                  // the plane he meets the ball in, in front of where he stood: diving, standing
export const SAVE = { zDive: ZD, zStand: ZS, getupRate: 2.1, hold: { catch: 0.45, parry: 0.25, beaten: 0.3, wide: 0.3 } };

// world ↔ the save's frame (origin O, turned Y): x his left, z the way he faced
const toModel = (sv, x, y, z, out) => { const dx = x - sv.O.x, dz = z - sv.O.z, c = Math.cos(sv.Y), s = Math.sin(sv.Y); return out.set(dx * c - dz * s, y, dx * s + dz * c); };
export const toWorld = (sv, v, out) => { const c = Math.cos(sv.Y), s = Math.sin(sv.Y); return out.set(sv.O.x + v.x * c + v.z * s, v.y, sv.O.z - v.x * s + v.z * c); };

// When and where the ball meets his hands: where it crosses the plane `zc` in front of him, or where it is when the
// sim says it's saved (eta), whichever is first. Returns { t (s from now), c (save frame) }.
const probe = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }, tmp = new THREE.Vector3();
function contact(sv, ball, eta, zc) {
  const limit = eta === undefined || eta === null ? 0.6 : Math.max(0, eta - 0.03);
  if (!ball) return { t: limit || 0.35, c: V(sv.s * 1.4, sv.y ?? 0.8, zc) };
  Object.assign(probe, ball); probe.inNet = false;
  const h = 1 / 240;
  let t = 0, prev = toModel(sv, probe.x, probe.y, probe.z, V(0, 0, 0));
  if (prev.z <= zc) return { t: 0, c: prev };
  while (t < limit + 1e-9) {
    stepBall(probe, h, []); t += h;
    const now = toModel(sv, probe.x, probe.y, probe.z, tmp);
    if (now.z <= zc) { const k = (prev.z - zc) / Math.max(1e-6, prev.z - now.z); return { t: t - h * (1 - k), c: prev.lerp(now, k) }; }
    prev.copy(now);
  }
  return { t: limit, c: prev };
}

// A save begins. m.kf: where his feet are (world), set by the stance. now: s.
export function startSave(m, p, ball, root) {
  const sv = { id: p.save.id, kind: p.save.kind, y: p.save.y, stand: !p.dive, s: p.dive || 1, t: 0, O: root.position.clone(), Y: root.rotation.y, dt0: 0 };
  sv.feet = { L: m.kf.L.p.clone(), R: m.kf.R.p.clone() };
  const zc = sv.stand ? ZS : ZD, k = contact(sv, ball, p.save.eta, zc);
  sv.T = Math.max(sv.stand ? 0.12 : 0.18, k.t); sv.c = k.c;
  if (!sv.stand && Math.sign(sv.c.x) && Math.abs(sv.c.x) > 0.25) sv.s = Math.sign(sv.c.x);       // the way the ball really is
  if (sv.stand) sv.s = sv.c.x >= 0 ? 1 : -1;
  // from where his hips were a frame ago (the bones have just been put back to rest: starting from there he jumped up 10 cm)
  const L = m.kLast, nb = L ? (L.length - 3) / 4 : 0;
  sv.h0 = L ? V(L[nb * 4], L[nb * 4 + 1], L[nb * 4 + 2]) : m.bone.hips.position.clone(); sv.p0 = L ? 2 * Math.asin(clamp(L[0], -1, 1)) : m.bone.hips.rotation.x;
  shape(sv);
  return sv;
}
// what the body does for this contact (redone as the ball's path comes clear)
function shape(sv) {
  const c = sv.c, s = sv.s;
  if (sv.kind === 'beaten') { sv.reach = c.clone(); sv.reach.x -= s * 0.38; sv.reach.y = mix(sv.reach.y, 0.9, 0.15); } else sv.reach = c;
  const r = sv.reach;
  sv.h = clamp((r.y - 0.25) / 1.6, 0, 1);
  if (sv.stand) sv.grip = r.y < 0.45 ? 'scoop' : r.y < 1.05 ? 'basket' : 'behind';
  else sv.grip = sv.kind === 'catch' ? (r.y < 0.75 ? 'low' : 'behind') : 'parry';
  if (sv.kind !== 'catch' && sv.stand) sv.grip = r.y < 0.45 ? 'scoop' : 'behind';
}

// Plays the save on. Returns false once he's done with it (standing again, or the ball in his arms).
export function poseSave(m, p, dt, ball) {
  const sv = m.sv;
  sv.t += dt;
  // until the hands are nearly there, keep reading the ball's path (a frame of the sim's own timing at most)
  if (ball && sv.t < sv.T * 0.8 && sv.t > 0) {
    const k = contact(sv, ball, p.save && p.save.id === sv.id ? p.save.eta : sv.T - sv.t + 0.03, sv.stand ? ZS : ZD);
    if (k.t > 0) { sv.T = sv.t + k.t; sv.c.copy(k.c); shape(sv); }
  }
  return sv.stand ? standing(m, sv, dt, ball) : dive(m, sv, dt, ball);
}

/* ---------- the dive ---------- */

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), e1 = new THREE.Euler(), hp = new THREE.Vector3(), w1 = new THREE.Vector3();
const LEGS = ['upperLeg', 'lowerLeg', 'foot'];
function dive(m, sv, dt, ball) {
  const bn = m.bone, s = sv.s, T = sv.T, r = sv.reach, h = sv.h, t = sv.t;
  const near = s > 0 ? 'L' : 'R', far = s > 0 ? 'R' : 'L';
  // timing: loaded on the stepped-out near foot, far foot off, near foot off (take-off), contact, landing, settled.
  // He falls from the contact as a body falls (Tl); the hips' path runs smoothly through its keys and never past
  // them: down into the load, out and (for a high ball) up through the take-off, then down onto his side.
  // (L: hips to palms at full stretch, so his arms are long to the ball, not cocked at the elbow; for a low ball he is
  // all but down on his side as he gets to it: left at 0.3 m and above he hung in the air flat as a plank)
  const th = mix(0.02, 0.7, h), L = 1.06;
  const pc = V(r.x - s * Math.cos(th) * L, clamp(r.y - Math.sin(th) * L, 0.22, 1.45), r.z - 0.06);
  if (s * pc.x < 0.3) pc.x = s * 0.3;
  const tP = 0.38 * T, tF = 0.5 * T, tN = 0.66 * T, Tl = clamp(Math.sqrt(2 * Math.max(0.005, pc.y - 0.19) / 9.8), 0.07, 0.5), tL = T + Tl, tG = tL + SAVE.hold[sv.kind] + (sv.grip === 'low' ? 0.1 : 0);
  const ax = Math.abs(pc.x), xN = Math.min(0.62, ax * 0.5), yP = Math.min(sv.h0.y - 0.06, mix(0.62, 0.66, h)), yN = Math.max(Math.min(pc.y, yP), mix(0.58, 0.84, h));
  const land = V(pc.x + s * mix(0.1, 0.24, h), 0.19, pc.z - 0.04);
  const tt = Math.min(t, tG);
  sv.ground = t >= tL;                                     // landed: something of him is on the grass from now till he stands
  bn.hips.position.set(
    s * mono([[0, s * sv.h0.x], [tP, Math.min(0.3, ax * 0.3)], [tN, xN], [T, ax], [tL, s * land.x], [tL + 0.3, s * land.x + 0.03]], tt),
    mono([[0, sv.h0.y], [tP, yP], [tN, yN], [T, pc.y], [tL, land.y]], tt),
    mono([[0, sv.h0.z], [tP, 0.02], [tN, 0.08], [T, pc.z], [tL, land.z]], tt));
  const roll = mono([[0, 0], [tP, 0.3], [tN, 0.8], [T, Math.min(1.45, Math.PI / 2 - th)], [tL, 1.5]], tt);   // on his side, chest to the pitch: never past it onto his front
  const pitch = mono([[0, sv.p0], [tP, 0.4], [tN, 0.25], [T, 0.05], [tL, 0.1]], tt);
  bn.hips.quaternion.setFromAxisAngle(w1.set(0, 0, 1), -s * roll).multiply(qa.setFromAxisAngle(w1.set(1, 0, 0), pitch));
  const reachK = ease((tt - tP) / (T - tP)) * (1 - ease((tt - T) / 0.25));
  const curl = sv.kind === 'catch' ? ease((tt - T) / 0.3) : 0;
  bn.spine.rotation.set(keyAt([[0, 0.12], [tN, 0.04], [T, 0], [tL, 0.1]], tt) + 0.22 * curl, 0, -s * (0.12 * reachK + 0.14 * ease(tt / tP) * (1 - ease((tt - T) / 0.2))));   // bent toward the ball from the first step: he goes with his whole side
  bn.chest.rotation.set(0.04 + 0.12 * curl, 0, -s * 0.08 * reachK);

  // legs: on the grass the feet are where they are (the near one steps out first), then each leaves in turn
  const step = ease((tt - 0.04 * T) / (tP - 0.04 * T));
  for (const n of [near, far]) {
    const isN = n === near, foot = sv.feet[n], at = toModel(sv, foot.x, 0, foot.z, V(0, 0, 0));
    if (isN) { at.x += s * 0.3 * step; at.z += 0.16 * step; }   // the step toward the ball: his stance opens to about 90% of leg length between the two pushes (Ibrahim et al. 2019)
    const lift = isN ? Math.sin(Math.PI * step) * 0.05 : 0, toes = isN ? 0 : ease((tt - 0.6 * tF) / (0.4 * tF));
    reachLeg(bn, n, at.setY(ankleFor(toes * 0.7) + lift + toes * 0.03));
    aimFoot(bn, n, qa.setFromEuler(e1.set(toes * 0.7, isN ? s * 0.5 * step : 0, 0)));
    // in the air: the take-off leg long and pointed, the other drives its knee up (high) or trails (low);
    // landed: the bottom leg a little bent, the top knee up and its foot down in front, ready to rock up
    const off = ease((tt - (isN ? tN : tF)) / 0.08), down = ease((tt - (T + Tl * 0.4)) / (Tl * 0.7));
    if (off <= 0) continue;
    // (folded as they leave the grass so they clear it, then trailing long behind him by the time he is at the ball)
    const fl = ease((tt - tN) / Math.max(0.05, T - tN));
    const air = isN ? [[mix(mix(0.5, 0.12, h), 0.1, fl), 0, s * 0.06], [mix(mix(1.0, 0.18, h), 0.25, fl)], [0.55]]
      : [[mix(mix(-0.35, -1.05, h), mix(-0.25, -1.05, h), fl), 0, -s * 0.05], [mix(mix(1.35, 1.45, h), mix(0.6, 1.45, h), fl)], [0.5]];
    const land = isN ? [[-0.3, 0, s * 0.05], [0.65], [0.3]] : [[-1.0, 0, -s * 0.15], [1.35], [0.2]];
    LEGS.forEach((b, i) => {
      const a = air[i], l = land[i];
      qb.setFromEuler(e1.set(mix(a[0], l[0], down), 0, mix(a[2] ?? 0, l[2] ?? 0, down)));
      bn[b + n].quaternion.slerp(qb, off);
    });
  }

  // hands: from the ready position (carried with the body) out to the ball, leading; then the grip's follow-up
  const ready = readyGrip(bn), G = grip(sv.grip, r, s);
  // (they stay in front of him through the step and the load and go to the ball as he drives off: thrown out at
  // once, his arms stood out sideways from an upright body while he was still squatting. Kenny: "what the hell is this")
  const u = clamp((tt - 0.3 * T) / (0.7 * T), 0, 1), wk = u * u * (3 - 2 * u);
  let g = lerpGrip(ready, G, wk);
  m.held = null;
  if (tt >= T) {
    const a = tt - T;
    if (sv.kind === 'catch') {
      // the ball is his: a low one is put down onto the grass under the top hand, a high one comes into the chest
      const b = sv.ballAt ??= new THREE.Vector3();
      if (sv.grip === 'low') { b.copy(r).lerp(V(r.x + s * 0.12, BALL_R + 0.005, r.z - 0.02), ease(a / Tl)); g = grip('low', b, s); }
      else { chestPoint(bn, hp); b.copy(r).lerp(hp, ease(a / 0.25)); g = lerpGrip(grip('behind', b, s), grip('sides', b, s), ease(a / 0.2)); }
      m.held = b.clone();
    } else {
      // pushed on and wide (a parry) or past the hands (beaten); then the arms give, toward the grass
      const push = V(s * 0.28, 0.05, 0.1).multiplyScalar(ease(a / 0.12)), drop = ease((a - 0.08) / Math.max(0.1, Tl - 0.1));   // down by the time he lands
      // (and down onto the grass in front of his chest as he lands, to take his weight)
      const c2 = r.clone().add(push).lerp(V(land.x + s * 0.42, 0.14, pc.z + 0.34), drop);
      g = grip(sv.grip, c2, s);
      if (sv.kind === 'parry' && a < 0.05 && ball && ball.vz !== undefined) m.held = r.clone();
    }
  }
  placeHands(bn, g, 1, 1, 0.35);
  lookAt(bn, tt < T + 0.3 ? r : m.held || V(pc.x + s * 2, 0.4, 2), 0.8);

  // up off the grass: a recorded get-up (game/keepercap.js), sped up; the ball, if he has it, held to his chest.
  // While he lies there he comes round to the recording's first pose (propped on his hip), so the get-up starts
  // from where he is and not across a blend of two different bodies (that blend threw him 30 cm into the air).
  if (t > tL + 0.06) {
    const gt = Math.max(0, t - tG) * SAVE.getupRate;
    if (gt > GETUP.length) return false;
    getupPose(bn, gt, s, land, ease((t - tL - 0.06) / Math.max(0.15, tG - tL - 0.06)));
    if (sv.kind === 'catch') {
      chestPoint(bn, hp);
      const b = sv.ballAt.clone().lerp(hp, ease((t - tG) / 0.4));
      bn.clavicleL.quaternion.identity(); bn.clavicleR.quaternion.identity();   // (the recording rolls a shoulder in: with the ball in his arms that put an upper arm inside his chest)
      placeHands(bn, grip('sides', b, s), 1, 1.8, 0.05);    // elbows well out: tucked in, his upper arms sat in his sides
      m.held = b;
    }
  }
  return true;
}

/* ---------- standing saves ---------- */

function standing(m, sv, dt, ball) {
  const bn = m.bone, s = sv.s, T = sv.T, r = sv.reach, t = sv.t, kind = sv.grip;
  const end = T + (sv.kind === 'catch' ? 0.42 : 0.45);
  if (t > end) return false;
  const hx = clamp(r.x * 0.85, -0.38, 0.38), over = r.y > 1.75;
  const P = { scoop: [0.8, 0.95, 0.25], basket: [0.82, 0.45, 0.2], behind: [over ? 0.95 : 0.86, 0.12, 0.04] }[kind];
  const jump = over ? Math.max(0, r.y - 1.95) * 0.9 + 0.12 : 0;
  const keys = over ? [[0, sv.h0], [0.5 * T, V(hx * 0.5, 0.74, 0)], [T, V(hx, P[0] + jump, 0.02)], [T + 0.3, V(hx, 0.86, 0)], [end, V(hx, 0.9, 0)]]
    : [[0, sv.h0], [0.85 * T, V(hx, P[0], -0.03)], [T + 0.15, V(hx, P[0] + 0.02, -0.03)], [end, V(hx, 0.88, 0)]];
  pathAt(keys, t, bn.hips.position);
  const pitch = keyAt([[0, sv.p0], [0.8 * T, P[1]], [T + 0.12, P[1]], [end, 0.12]], t);
  bn.hips.rotation.set(pitch, 0, 0);
  bn.spine.rotation.set(keyAt([[0, 0.1], [0.8 * T, P[2]], [T + 0.15, P[2]], [end, 0.06]], t), 0, 0);
  // feet: a quick step across behind the ball (the near foot first), closer together for a scoop; off the grass for a high one
  const lift = Math.max(0, bn.hips.position.y - 0.9);
  for (const n of ['L', 'R']) {
    const sd = n === 'L' ? 1 : -1, nearFoot = sd === s, f = sv.feet[n], at = toModel(sv, f.x, 0, f.z, V(0, 0, 0));
    const u = ease((t - (nearFoot ? 0.05 : 0.3) * T) / (0.45 * T));
    const want = V(hx + sd * (kind === 'scoop' ? 0.1 : 0.2), 0, 0.04);
    at.lerp(want, u * (Math.abs(at.x - want.x) > 0.05 ? 1 : 0.5));
    const toes = lift > 0.02 ? 0.5 : 0.1;
    reachLeg(bn, n, at.setY(ankleFor(toes) + Math.sin(Math.PI * u) * 0.04 + lift));
    aimFoot(bn, n, qa.setFromEuler(e1.set(toes, sd * 0.12, 0)));
  }
  // hands: ready → the grip on the ball at the moment it arrives → (a catch) into his chest, or pushed away
  const ready = readyGrip(bn), G = grip(kind, r, s);
  const u = clamp((t - 0.05 * T) / (0.95 * T), 0, 1), wk = 1 - (1 - u) ** 3;
  let g = lerpGrip(ready, G, wk);
  m.held = null;
  if (t >= T) {
    const a = t - T;
    if (sv.kind === 'catch') {
      chestPoint(bn, hp);
      const b = r.clone().lerp(hp, ease(a / 0.3));
      g = lerpGrip(grip(kind, b, s), grip('sides', b, s), ease(a / 0.25));
      m.held = b;
    } else {
      const c2 = r.clone().add(V(0, 0.08, 0.15).multiplyScalar(ease(a / 0.1)));
      g = lerpGrip(grip(kind, c2, s), ready, ease((a - 0.12) / 0.3));
      if (a < 0.05) m.held = r.clone();
    }
  }
  placeHands(bn, g, 1, 1, kind === 'behind' ? 0.6 : 0.2);
  lookAt(bn, m.held || r, 0.9);
  return true;
}

/* ---------- shared ---------- */

// where his hands are carried through a save before they go to the ball: in front of his chest off bent elbows,
// fingers forward, palms turned in and half to the ball, wrists straight. Carried with the chest, not the hips: as
// he sinks into the load his thighs come up, and hands hung off the hips went into his lap and his stomach.
const rq = new THREE.Quaternion(), rI = new THREE.Quaternion(), rp = new THREE.Vector3();
function readyGrip(bn) {
  const out = {};
  rq.copy(bn.hips.quaternion); rp.copy(bn.spine.position).applyQuaternion(rq).add(bn.hips.position);
  rq.multiply(bn.spine.quaternion); rp.add(w1.copy(bn.chest.position).applyQuaternion(rq)); rq.multiply(bn.chest.quaternion);
  // (hung from the chest but only a third turned with it: bent well forward, hands that followed the chest all the
  // way came down onto his knees)
  rq.slerp(rI, 0.65);
  for (const [lo, sd] of [['L', 1], ['R', -1]]) {
    const palm = V(sd * 0.17, -0.2, 0.36).applyQuaternion(rq).add(rp);
    const N = V(-sd * 0.75, -0.25, 0.6).normalize().applyQuaternion(rq), F = V(sd * 0.12, -0.3, 1).normalize().applyQuaternion(rq);
    out[lo] = { palm, N, F: F.addScaledVector(N, -F.dot(N)).normalize() };
  }
  return out;
}
function lerpGrip(a, b, k) {
  const out = {};
  for (const lo of ['L', 'R']) out[lo] = { palm: a[lo].palm.clone().lerp(b[lo].palm, k), N: a[lo].N.clone().lerp(b[lo].N, k).normalize(), F: a[lo].F.clone().lerp(b[lo].F, k).normalize() };
  return out;
}
// in front of his chest, where a caught ball is held (carried with the trunk)
export function chestPoint(bn, out) {
  qa.copy(bn.hips.quaternion).multiply(bn.spine.quaternion);
  out.set(0, 0.34, 0.26).applyQuaternion(qa).add(bn.hips.position);
  return out;
}
