// The keeper's standing saves: a shot at him or just to one side (the sim: p.dive 0). Built from how handling is
// coached (docs/notes-keeper-anim.md lists the sources): which technique by the height the ball comes at.
//
//   scoop   under the knee: the foot nearest the ball steps beside its line, the other knee turns in and down behind
//           it (the "K": no gap for the ball), hands down in front, palms to it, little fingers together, arms inside
//           the knees; it runs up the forearms into the chest and he folds over it. With no time (a hard one) he only
//           stoops behind it
//   cup     knee to stomach: feet planted, knees bent so his midriff is behind it, elbows tucked, palms up, little
//           fingers together; he gives with it (hips back) and the chest closes over it
//   w       chest to head: hands early into its line, thumbs behind it, fingers spread over its top half, elbows bent,
//           met about 40 cm in front of his face; the arms give, then it comes down into the chest
//   over    above his head: taken at the top of his reach, off one foot with the other knee up when he has to jump;
//           then down into the chest as he lands
//   parry   too hot to hold: both open palms behind it, wrists stiff, pushed down and wide; over his head, one palm
//           under it, up over the bar
// Feet first, always: a side-step so his body is behind the ball (the near foot, then the far one), and every foot
// stays where it is planted (the save's own frame is fixed on the pitch).
import * as THREE from 'three';
import { setLeg } from './keeperfeet.js';
import { grip, placeHands, lookAt, mono, ankleFor, readyGrip, lerpGrip, chestPoint } from './keeperhands.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), mix = (a, b, k) => a + (b - a) * k;
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const STAND = {
  scoop: 0.5, cup: 1.15, over: 1.8,                    // m: under each height, that technique (little fingers together below the chest, thumbs together from it up)
  z: { scoop: 0.42, cup: 0.38, w: 0.5, block: 0.42, over: 0.3 },   // m in front of where he stood that he meets it (the W: 15 to 18 inches in front of his face)
  reach: 2.02,                                         // m: the highest his palms get without leaving the grass
  after: { scoop: 1.1, cup: 0.8, w: 0.75, over: 1.0, parry: 0.5 },   // s from the ball in his hands to stood with it (or set again)
};
export const standMode = (y, kind) => (y < STAND.scoop ? 'scoop' : y >= STAND.over ? 'over' : kind === 'catch' && y < STAND.cup ? 'cup' : 'w');
export const standGrip = sv => (sv.kind === 'catch' ? { scoop: 'scoop', cup: 'basket', w: 'w', over: 'over' } : { scoop: 'lowblock', cup: 'block', w: 'block', over: 'tip' })[sv.mode];

// keys [[t, v], ...] with times that may run together: kept strictly rising for mono()
const run = (keys, t) => { const k = [keys[0]]; for (let i = 1; i < keys.length; i++) if (keys[i][0] > k[k.length - 1][0] + 1e-3) k.push(keys[i]); else k[k.length - 1] = [k[k.length - 1][0], keys[i][1]]; return mono(k, t); };
const belly = new THREE.Quaternion(), hp = new THREE.Vector3(), tiltQ = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
// where a ball taken in the basket ends up: against his stomach
function bellyPoint(bn, out) { belly.copy(bn.hips.quaternion).multiply(bn.spine.quaternion); return out.set(0, 0.2, 0.26).applyQuaternion(belly).add(bn.hips.position); }

// Plays a standing save on. sv: the latched save (game/keepersave.js startSave: mode, kind, reach, T, feet, h0, p0).
// Returns false once he's done with it.
export function standing(m, sv, dt, ball) {
  const bn = m.bone, T = sv.T, r = sv.reach, mode = sv.mode, held = sv.kind === 'catch', A = held ? STAND.after[mode] : STAND.after.parry;
  // Which version of it (sv.var, from the save's id and the keeper: game/keepersave.js): all of them coached ones.
  //   scoop  a ball straight at him: he kneels on either leg; one time in three he stays on his feet and stoops for
  //          it, legs together behind the ball (the standing scoop, for one that isn't going anywhere)
  //   W, overhead  no two catches square: one hand a little higher round the ball than the other; how far his arms give
  //   cup    how far he gives with it
  const v = sv.var ?? 0, r1 = sv.r1 ?? 0.5, r2 = sv.r2 ?? 0.5;
  const s = mode === 'scoop' && held && Math.abs(r.x) < 0.2 && v % 2 ? -sv.s : sv.s, stoop = mode === 'scoop' && held && v % 3 === 0;
  const giveK = mix(0.7, 1.3, r2), tilt = mode === 'w' || mode === 'over' ? tiltQ.setFromAxisAngle(zAxis, (r1 - 0.5) * 0.34) : null;
  // (posed on the last frame too: what comes next starts from where his hips and feet are, and unposed they were back
  // where the save began, up to half a metre away)
  const end = T + A, t = Math.min(sv.t, end), a = t - T;
  const F = sv.f0 ??= feetIn(sv);                                   // where his feet were when it began (the save's frame)
  // feet first: his body goes behind the ball, a side-step if it's wide of him (never more than the sim lets a standing save be)
  const hx = clamp(r.x, -0.5, 0.5) * 0.92, mid = (F.L.x + F.R.x) / 2, shift = hx - mid, stepK = ease((Math.abs(shift) - 0.04) / 0.06);
  const lead = s > 0 ? 'L' : 'R';
  const J = mode === 'over' ? Math.max(0, r.y - STAND.reach) : 0, tU = Math.sqrt(2 * J / 9.8), tTO = T - tU;   // a jump: how high, how long going up, when he leaves the grass
  const deep = mode === 'scoop' ? ease((T - 0.26) / 0.2) * (held ? 1 : 0.3) * clamp((0.66 - r.y) / 0.25, 0.3, 1) * (stoop ? 0.3 : 1) : 0;   // how far down into the K he gets
  // hips: where and how high at the ball, the give after it, and stood up at the end (with the ball: taller)
  const yEnd = held ? 0.93 : 0.85, pEnd = held ? 0.08 : 0.36;
  let hy, hz, pitch, spine, yawH = 0;
  if (mode === 'scoop') {
    const y1 = mix(0.66, 0.47, deep), up = T + mix(0.25, 0.5, deep) * (held ? 1 : 0.4);
    hy = run([[0, sv.h0.y], [0.9 * T, y1], [up, y1 - 0.01], [end, yEnd]], t);
    hz = run([[0, sv.h0.z], [0.9 * T, mix(-0.12, -0.2, deep)], [up, mix(-0.08, -0.12, deep)], [end, -0.01]], t);
    pitch = run([[0, sv.p0], [0.9 * T, mix(0.8, 0.62, deep)], [up, mix(0.85, 0.7, deep)], [end, pEnd]], t);
    spine = run([[0, 0.16], [0.9 * T, 0.26], [up, 0.3], [end, 0.03]], t);
    yawH = -s * 0.3 * deep * ease(t / (0.8 * T)) * (1 - ease((t - up) / (end - up)));
  } else if (mode === 'cup') {
    const y1 = clamp(r.y - 0.17, 0.64, 0.86);
    hy = run([[0, sv.h0.y], [0.8 * T, y1 + 0.015], [T, y1], [T + 0.16, y1 - 0.03], [T + 0.4, y1], [end, yEnd]], t);
    hz = run([[0, sv.h0.z], [T, -0.08], [T + 0.16, -0.15], [T + 0.4, -0.12], [end, -0.01]], t);
    pitch = run([[0, sv.p0], [T, 0.36], [T + 0.16, 0.44], [T + 0.4, 0.38], [end, pEnd]], t);
    spine = run([[0, 0.16], [T, 0.14], [T + 0.16, 0.22], [T + 0.4, 0.18], [end, 0.03]], t);
  } else if (mode === 'w') {
    const y1 = mix(0.85, 0.92, clamp((r.y - 1.15) / 0.6, 0, 1));
    hy = run([[0, sv.h0.y], [0.8 * T, y1], [T + 0.12, y1 - 0.02], [end, yEnd]], t);
    hz = run([[0, sv.h0.z], [T, -0.03], [T + 0.14, -0.07], [end, -0.01]], t);
    pitch = run([[0, sv.p0], [T, 0.14], [T + 0.14, 0.1], [end, pEnd]], t);
    spine = run([[0, 0.16], [T, 0.05], [end, held ? 0.03 : 0.16]], t);
  } else {
    const dip = Math.max(0.3 * T, tTO - 0.17), yDip = mix(0.84, 0.74, clamp(J / 0.25, 0, 1)), tDn = T + tU;
    hy = run([[0, sv.h0.y], [dip, Math.min(sv.h0.y, yDip)], [tTO, 0.955], [T, 0.955 + J], [tDn, 0.94], [tDn + 0.16, 0.83], [end, yEnd]], t);
    hz = run([[0, sv.h0.z], [T, 0.0], [end, -0.01]], t);
    pitch = run([[0, sv.p0], [dip, 0.3], [T, 0.0], [tDn + 0.16, held ? 0.22 : 0.3], [end, pEnd]], t);
    spine = run([[0, 0.16], [T, -0.04], [tDn + 0.16, 0.1], [end, held ? 0.03 : 0.16]], t);
  }
  const hxNow = run([[0, sv.h0.x], [0.75 * T, hx], [end, hx]], t);
  bn.hips.position.set(hxNow - s * 0.03 * deep, hy, hz);
  bn.hips.rotation.set(pitch, yawH, 0);
  bn.spine.rotation.set(spine, -yawH * 0.6, 0); bn.chest.rotation.set(spine * 0.5, -yawH * 0.4, 0);

  // legs
  const air = Math.max(0, hy - 0.955);                               // off the grass (a jump)
  for (const n of ['L', 'R']) {
    const sd = n === 'L' ? 1 : -1, isLead = n === lead, f = F[n];
    // the side-step: the near foot first, then the far one closes; each lands where the stance wants it
    const w = mode === 'scoop' ? 0.4 : mode === 'cup' ? 0.48 : 0.42, u = ease((t - (isLead ? 0.04 : 0.4) * T) / (0.48 * T)) * stepK;
    const at = V(mix(f.x, hx + sd * w / 2, u), 0, mix(f.z, 0.05, u));
    let lift = Math.sin(Math.PI * u) * 0.04 * stepK, toes = 0.1, yaw = mix(f.yaw, sd * 0.12, u), out = sd * 0.08;
    if (mode === 'scoop') {
      const k = ease(t / (0.85 * T)), upT = T + mix(0.25, 0.5, deep) * (held ? 1 : 0.4), back = ease((t - upT) / ((end - upT) * 0.8));
      if (isLead) {
        // the near foot beside the ball's line, turned out, flat
        at.lerp(V(hx + s * 0.17, 0, 0.1), k * deep); yaw = mix(yaw, s * 0.3, k * deep); toes = mix(0.1, 0, k * deep); out = sd * 0.06;
        lift += Math.sin(Math.PI * k) * 0.03 * deep;
      } else {
        // the far knee turns in and down behind the ball, its foot back on its toes; then it steps up under him
        const kk = k * (1 - back);
        at.lerp(V(hx - s * 0.2, 0, -0.7), kk * deep); toes = mix(0.1, 1.15, kk * deep); yaw = mix(yaw, s * 0.5, kk * deep); out = -sd * kk * deep;
        lift += (Math.sin(Math.PI * k) * 0.03 + Math.sin(Math.PI * back) * 0.05) * deep;
      }
    }
    if (mode === 'over') {
      // up on his toes; a jump goes off the near foot with the far knee driven up, and he lands on the near foot first
      const tip = ease((t - (tTO - 0.12)) / 0.12) * (1 - ease((t - (T + tU)) / 0.12));
      toes = mix(0.1, J > 0 ? 0.8 : 0.45, tip);
      if (J > 0.02 && !isLead) {
        const kn = ease((t - (tTO - 0.08)) / 0.16) * (1 - ease((t - (T + tU * 0.5)) / (tU * 0.5 + 0.08))) * clamp(J / 0.12, 0, 1);
        at.y += 0.32 * kn; at.z += 0.22 * kn; toes = mix(toes, 0.5, kn);
      }
    }
    at.y += ankleFor(toes) + lift + air;
    setLeg(bn, n, at, toes, yaw, out);
    (sv.fNow ??= {})[n] = at;
  }

  // hands: from where he carries them to the ball, early (they are in its line before it gets there), then the
  // technique's own finish
  const ready = readyGrip(bn), G = grip(sv.grip, r, sv.s, held ? tilt : null), early = mode === 'over' ? 1 : 0.85;
  let g = lerpGrip(ready, G, ease(t / (early * T)));
  m.held = null;
  if (a >= 0) {
    if (held) {
      // the ball is his: the arms give with it, and it comes into the body and stays there
      const b = sv.ballAt ??= new THREE.Vector3();
      const home = mode === 'cup' ? bellyPoint(bn, hp) : chestPoint(bn, hp);
      const give = mode === 'w' ? V(0, -0.04, -0.15) : mode === 'over' ? V(0, -0.08, -0.03) : mode === 'scoop' ? V(0, 0.06, -0.08) : V(0, -0.02, -0.1);
      const k1 = ease(a / 0.12), k2 = ease((a - (mode === 'cup' ? 0 : 0.1)) / (mode === 'over' ? 0.6 : mode === 'cup' ? 0.16 : 0.32));
      b.copy(r).addScaledVector(give, k1 * (1 - k2) * giveK).lerp(home, k2);
      if (mode === 'over') b.z += 0.1 * Math.sin(Math.PI * k2);                  // down in front of his face, not through it
      if (mode === 'cup') { const up = ease((a - 0.4) / (A - 0.45)); chestPoint(bn, hp); hp.y -= 0.05; b.lerp(hp, up); }
      else if (k2 >= 1) b.y -= 0.05 * ease((a - 0.45) / 0.25);
      g = lerpGrip(grip(sv.grip, b, sv.s, tilt), grip('hug', b, sv.s), mode === 'cup' ? ease((a - 0.05) / 0.3) : mode === 'over' ? ease((a - 0.2) / 0.55) : ease((a - 0.12) / 0.3));
      m.held = b.clone();
    } else {
      // pushed away, wrists stiff: down and wide (over his head: up and back over the bar); then the hands come back
      const push = mode === 'over' ? V(0, 0.12, -0.14) : mode === 'scoop' ? V(s * 0.12, 0.02, 0.12) : V(s * 0.12, -0.05, 0.09);
      const c2 = r.clone().addScaledVector(push, ease(a / 0.09));
      // (round in front of him on the way back: straight down from over his head, the hands went past his ears)
      const back = ease((a - 0.14) / 0.32);
      g = lerpGrip(grip(sv.grip, c2, sv.s), ready, back);
      for (const lo of ['L', 'R']) g[lo].palm.z += 0.22 * Math.sin(Math.PI * back) * (mode === 'over' ? 1 : 0.3);
      if (a < 0.05 && ball) m.held = r.clone();
    }
  }
  // elbows: in for the low ones, out a little for the W, and down by his ribs once the ball is hugged
  const hug = held ? ease((a - 0.1) / 0.3) : 0;
  const wide = mix(mode === 'scoop' ? 0.35 : mode === 'cup' ? 0.45 : held ? 0.9 : 0.55, 0.6, hug), down = mix(mode === 'over' ? 0.2 : mode === 'w' ? 1.5 : 0.9, 1.5, hug);
  // (palms square behind a ball at chest height, fingers up: the wrists give a little more than they do anywhere else, about 40 degrees)
  placeHands(bn, g, 1, wide, down, true, mode === 'w' ? mix(0.7, 0.5, hug) : 0.5);
  // eyes on it into his hands, then up the pitch
  const eye = (m.held || r).clone().lerp(V(hxNow, 1.55, 8), held ? ease((a - 0.3) / 0.35) : ease((a - 0.2) / 0.3));
  lookAt(bn, eye, 0.9);
  return sv.t <= end;
}

// his planted feet in the save's own frame, with the way each points
function feetIn(sv) {
  const out = {}, c = Math.cos(sv.Y), s = Math.sin(sv.Y);
  for (const n of ['L', 'R']) {
    const f = sv.feet[n], dx = f.x - sv.O.x, dz = f.z - sv.O.z;
    out[n] = { x: dx * c - dz * s, z: dx * s + dz * c, yaw: (sv.yaws ? sv.yaws[n] : sv.Y) - sv.Y };
  }
  return out;
}
