// The keeper's saves: dives and standing saves, built from goalkeeping coaching and one biomechanics study
// (docs/notes-keeper-anim.md).
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
//             drawn up; then up from the grass on the pendulum leg, without his hands
//   standing  a ball at him: scooped from the grass (stoop, palms to it, fingers down), a basket at the waist
//             (palms up, into the stomach), W at the chest (thumbs together, behind it), or overhead off both
//             feet; feet first: a quick step across behind the line of the ball
import * as THREE from 'three';
import { stepBall } from '../rules/ball.js';
import { reachLeg, aimFoot } from './legik.js';
import { grip, diveGrip, turnToReach, placeHand, lookAt, keyAt, mono, ankleFor, BALL_R, readyGrip, lerpGrip, chestPoint } from './keeperhands.js';
import { standing, STAND, standMode, standGrip } from './keeperstand.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), mix = (a, b, k) => a + (b - a) * k;
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ZD = 0.26, ZS = 0.36;                  // the plane he meets the ball in, in front of where he stood: diving, standing
export const SAVE = { zDive: ZD, zStand: ZS, hold: { catch: 0.66, parry: 0.25, beaten: 0.3, wide: 0.3 } };

// world ↔ the save's frame (origin O, turned Y): x his left, z the way he faced
export const toModel = (sv, x, y, z, out) => { const dx = x - sv.O.x, dz = z - sv.O.z, c = Math.cos(sv.Y), s = Math.sin(sv.Y); return out.set(dx * c - dz * s, y, dx * s + dz * c); };
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

const frac = x => x - Math.floor(x);
export const FORCE = { var: null };          // (the look page and the tests pick a version: &var=)
export const variantOf = (id, seed = 0) => { const x = Math.sin((typeof id === 'number' ? id : 1.37) * 127.1 + seed * 311.7 + 1.3) * 43758.5453; return Math.floor(frac(x) * 60); };

// A save begins. m.kf: where his feet are (world), set by the stance. now: s.
export function startSave(m, p, ball, root) {
  const sv = { id: p.save.id, kind: p.save.kind, y: p.save.y, stand: !p.dive, s: p.dive || 1, t: 0, O: root.position.clone(), Y: root.rotation.y, dt0: 0 };
  // which version of the save this one is: from the save's own id and the keeper's seed, so a replay shows the same one
  sv.var = FORCE.var ?? m.kVar ?? variantOf(p.save.id, m.kHabit ? m.kHabit.seed : 0);
  sv.r1 = frac(sv.var * 0.6180339887); sv.r2 = frac(sv.var * 0.7548776662);
  sv.feet = { L: m.kf.L.p.clone(), R: m.kf.R.p.clone() };
  sv.yaws = { L: m.kf.L.yaw ?? root.rotation.y, R: m.kf.R.yaw ?? root.rotation.y };
  // (a standing save: which technique by the height it comes at, and each meets the ball its own distance in front of him)
  if (sv.stand) { sv.mode = standMode(contact(sv, ball, p.save.eta, ZS).c.y, sv.kind); sv.zc = STAND.z[sv.mode === 'w' && sv.kind !== 'catch' ? 'block' : sv.mode]; } else sv.zc = ZD;
  const k = contact(sv, ball, p.save.eta, sv.zc);
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
  if (sv.stand) sv.grip = standGrip(sv);
  // a dive's hands, chosen once (docs/notes-keeper-anim.md, "Variety"): a catch near the grass is pinned to it, one
  // off the grass is taken in a W; a parry is with the bottom hand for a low ball and the top hand come over for a
  // high one (it reaches further), and with both palms now and then when he isn't at full stretch
  else sv.grip ??= sv.kind === 'catch' ? (r.y < 0.75 ? 'dlow' : 'dw')
    : Math.abs(c.x) < 1.7 && sv.kind === 'parry' && sv.var % 3 === 0 ? 'dboth' : r.y > 1.25 || (r.y > 0.7 && sv.var % 2) ? 'dtop' : 'dnear';
}

// Plays the save on. Returns false once he's done with it (standing again, or the ball in his arms).
export function poseSave(m, p, dt, ball) {
  const sv = m.sv;
  sv.t += dt;
  // until the hands are nearly there, keep reading the ball's path (a frame of the sim's own timing at most)
  if (ball && sv.t < sv.T * 0.8 && sv.t > 0) {
    const k = contact(sv, ball, p.save && p.save.id === sv.id ? p.save.eta : sv.T - sv.t + 0.03, sv.zc);
    if (k.t > 0) { sv.T = sv.t + k.t; sv.c.copy(k.c); shape(sv); }
  }
  return sv.stand ? standing(m, sv, dt, ball) : dive(m, sv, dt, ball);
}

/* ---------- the dive ---------- */

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), e1 = new THREE.Euler(), hp = new THREE.Vector3(), w1 = new THREE.Vector3();
const LEGS = ['upperLeg', 'lowerLeg', 'foot'], LEG = 0.845;      // (m: hip to ankle with the knee all but straight)
function dive(m, sv, dt, ball) {
  const bn = m.bone, s = sv.s, T = sv.T, r = sv.reach, h = sv.h, t = sv.t;
  const near = s > 0 ? 'L' : 'R', far = s > 0 ? 'R' : 'L';
  // timing: loaded on the stepped-out near foot, far foot off, near foot off (take-off), contact, landing, settled.
  // He falls from the contact as a body falls (Tl); the hips' path runs smoothly through its keys and never past
  // them: down into the load, out and (for a high ball) up through the take-off, then down onto his side.
  // (L: hips to palms at full stretch, so his arms are long to the ball, not cocked at the elbow; for a low ball he is
  // all but down on his side as he gets to it: left at 0.3 m and above he hung in the air flat as a plank)
  // (u: the way he is stretched at the ball: along his body and a little toward the shooter, so his arms pass in front of
  // his face, not through his head, and he meets it in front of his line as he is coached to)
  const th = mix(0.02, 0.7, h), L = 1.06, u = V(s * Math.cos(th), Math.sin(th), 0.15).normalize();
  const pc = V(r.x - s * Math.cos(th) * L, clamp(r.y - Math.sin(th) * L, 0.22, 1.45), r.z - 0.3);
  if (s * pc.x < 0.45) pc.x = s * 0.45;                    // (he goes down beside his near foot at the least: nearer than that his arms are bent to it)
  const tP = 0.38 * T, tF = 0.5 * T, tN = 0.66 * T, Tl = clamp(Math.sqrt(2 * Math.max(0.005, pc.y - 0.19) / 9.8), 0.07, 0.5), tL = T + Tl, tG = tL + SAVE.hold[sv.kind] + (sv.grip === 'low' ? 0.1 : 0);
  const ax = Math.abs(pc.x), xN = Math.min(0.62, ax * 0.5), yP = Math.min(sv.h0.y - 0.06, mix(0.62, 0.66, h)), yN = Math.max(Math.min(pc.y, yP), mix(0.58, 0.84, h));
  const land = V(pc.x + s * mix(0.1, 0.24, h), 0.14, pc.z - 0.04);
  const tt = Math.min(t, tG);
  sv.ground = t >= tL;                                     // landed: something of him is on the grass from now till he stands
  bn.hips.position.set(
    s * mono([[0, s * sv.h0.x], [tP, Math.min(0.3, ax * 0.3)], [tN, xN], [T, ax], [tL, s * land.x], [tL + 0.3, s * land.x + 0.03]], tt),
    mono([[0, sv.h0.y], [tP, yP], [tN, yN], [T, pc.y], [tL, land.y]], tt),
    mono([[0, sv.h0.z], [tP, mix(sv.h0.z, pc.z, 0.4)], [tN, mix(sv.h0.z, pc.z, 0.75)], [T, pc.z], [tL, land.z]], tt));
  const roll = mono([[0, 0], [tP, 0.3], [tN, 0.8], [T, Math.min(1.45, Math.PI / 2 - th)], [tL, 1.5]], tt);   // on his side, chest to the pitch: never past it onto his front
  const pitch = mono([[0, sv.p0], [tP, 0.4], [tN, 0.25], [T, 0.05], [tL, 0.1]], tt);
  bn.hips.quaternion.setFromAxisAngle(w1.set(0, 0, 1), -s * roll).multiply(qa.setFromAxisAngle(w1.set(1, 0, 0), pitch));
  const reachK = ease((tt - tP) / (T - tP)) * (1 - ease((tt - T) / 0.25));
  const curl = sv.kind === 'catch' ? ease((tt - T) / 0.3) : 0;
  // (bent toward the ball from the first step: he goes with his whole side. Only while he is upright: once he is laid
  // out the same bend put his head under his bottom arm and into the grass, so there his shoulders are held up off it)
  const upK = 1 - ease(roll / 1.25), side = -s * ((0.12 * reachK + 0.14 * ease(tt / tP) * (1 - ease((tt - T) / 0.2))) * upK - 0.09 * ease((roll - 0.8) / 0.6));
  bn.spine.rotation.set(keyAt([[0, 0.12], [tN, 0.04], [T, 0], [tL, 0.1]], tt) + 0.22 * curl, 0, side);
  bn.chest.rotation.set(0.04 + 0.12 * curl, 0, -s * (0.08 * reachK * upK - 0.07 * ease((roll - 0.8) / 0.6)));

  // legs: on the grass the feet are where they are (the near one steps out first), then each leaves in turn
  const step = ease((tt - 0.04 * T) / (tP - 0.04 * T));
  for (const n of [near, far]) {
    const isN = n === near, foot = sv.feet[n], at = toModel(sv, foot.x, 0, foot.z, V(0, 0, 0));
    if (isN) { at.x += s * clamp(ax - 0.4, 0.05, 0.3) * step; at.z += 0.16 * step; }   // the step toward the ball: his stance opens to about 90% of leg length between the two pushes (Ibrahim et al. 2019)
    const down = ease((tt - (T + Tl * 0.4)) / (Tl * 0.7));
    if (isN) {
      // the take-off leg: its foot stays where it stepped while the leg can reach it (close to him he never leaves it:
      // he goes down over that leg, a collapse dive); when his hips have gone further than the leg is long it has pushed
      // him away, and it trails behind him at full stretch, toes pointed, coming into line with his body
      const hj = w1.copy(bn['upperLeg' + n].position).applyQuaternion(bn.hips.quaternion).add(bn.hips.position);
      // (the heel comes up as his hips go out past it)
      const heel = 0.5 * ease((Math.hypot(at.x - hj.x, at.z - hj.z) - 0.3) / 0.35);
      at.y = ankleFor(heel) + Math.sin(Math.PI * step) * 0.05;
      const d = at.sub(hj), dist = d.length(), drag = ease((dist - (LEG - 0.015)) / 0.04), fl = ease((tt - tN) / Math.max(0.05, T - tN));
      if (dist > LEG && sv.flew === undefined) sv.flew = tt;
      d.multiplyScalar(1 / dist).lerp(hp.set(0, -1, 0).applyQuaternion(bn.hips.quaternion), sv.flew === undefined ? 0 : 0.5 * fl * ease((tt - sv.flew) / 0.14)).normalize();
      // (the knee to the front whichever way his hips are tipped: the game's leg IK bends it the way the hips face, and
      // can't put a foot out to the side of hips rolled over as far as his are)
      reachLegPole(bn, n, w2.copy(hj).addScaledVector(d, Math.min(dist, LEG)), hp.set(s * 0.25, 0.2, 1));
      aimFoot(bn, n, qa.setFromEuler(e1.set(heel, s * 0.5 * step, 0)));
      // (a boot that has left the grass points its toes; one still on it as he lies there lies on its side with the shin)
      bn['foot' + n].quaternion.slerp(qb.setFromEuler(e1.set(0.9, 0, 0)), drag).slerp(qb.setFromEuler(e1.set(0.35, 0, 0)), ease((roll - 0.8) / 0.5) * (1 - drag));
    } else {
      const toes = ease((tt - 0.6 * tF) / (0.4 * tF));
      reachLeg(bn, n, at.setY(ankleFor(toes * 0.7) + toes * 0.03));
      aimFoot(bn, n, qa.setFromEuler(e1.set(toes * 0.7, 0, 0)));
    }
    // in the air: the other leg drives its knee up (high) or trails (low);
    // landed: the bottom leg a little bent, the top knee up and its foot down in front, ready to rock up
    const off = isN ? (sv.flew === undefined ? 0 : down * ease((tt - sv.flew) / 0.1)) : ease((tt - tF) / 0.08);
    if (off <= 0) continue;
    // (folded as it leaves the grass so it clears it, then trailing long behind him by the time he is at the ball)
    const fl = ease((tt - tN) / Math.max(0.05, T - tN));
    const kd = mix(0.55, 1, sv.r2);                           // (how hard the trailing knee is driven up: no two dives alike)
    const air = [[mix(mix(-0.35, -1.05 * kd, h), mix(-0.25, -1.05 * kd, h), fl), 0, -s * 0.05], [mix(mix(1.35, 1.45 * kd, h), mix(0.6, 1.45 * kd, h), fl)], [0.5]];
    const land = isN ? [[-0.3, 0, s * 0.05], [0.65], [0.3]] : [[sv.kind === 'catch' ? -0.6 : -1.0, 0, -s * 0.15], [sv.kind === 'catch' ? 1.1 : 1.35], [0.2]];   // (with the ball hugged the top knee stays lower: his forearm is there)
    LEGS.forEach((b, i) => {
      const a = isN ? land[i] : air[i], l = land[i];
      qb.setFromEuler(e1.set(mix(a[0], l[0], down), 0, mix(a[2] ?? 0, l[2] ?? 0, down)));
      bn[b + n].quaternion.slerp(qb, off);
    });
  }

  // hands: from the ready position (carried with the body) out to the ball, leading; then the grip's follow-up
  const ready = readyGrip(bn), top = ease((tt - 0.7 * T) / (0.3 * T + Tl * 0.6)), both = sv.grip === 'dlow' ? top : sv.var % 2 ? 1 : 0.15 + 0.3 * sv.r2, G = diveGrip(sv.grip, r, s, u, both);   // (one parry in two is with one arm, the other left short)
  // (they stay in front of him through the step and the load and go to the ball as he drives off: thrown out at
  // once, his arms stood out sideways from an upright body while he was still squatting. Kenny: "what the hell is this")
  const u0 = mix(0.3, 0.22, sv.r1), uu = clamp((tt - u0 * T) / ((1 - u0) * T), 0, 1), wk = uu * uu * (3 - 2 * uu);
  let g = lerpGrip(ready, G, wk), free = false, hug = 0;
  // (thrown out round in front of him, the far hand most: straight from his chest to a ball beyond his far shoulder it went through his face)
  g[far].palm.z += 0.2 * Math.sin(Math.PI * wk); g[near].palm.z += 0.07 * Math.sin(Math.PI * wk);
  m.held = null;
  if (tt >= T) {
    const a = tt - T, ug = w1.copy(u).lerp(hp.set(s, 0, 0.15), ease(a / Tl)).normalize();
    if (sv.kind === 'catch') {
      // the ball is his. It goes to the grass with him, beyond his head, the bottom hand behind it and the top hand on
      // top (the ball lands first: "the third hand"); then he draws it in to his chest, round in front of his face,
      // before he thinks of getting up
      const b = sv.ballAt ??= new THREE.Vector3(), k1 = ease(a / Tl), k2 = ease((tt - tL - 0.14) / 0.42);
      b.copy(r).lerp(hp.set(land.x + s * 0.97, BALL_R + 0.005, land.z + 0.21), k1);
      g = sv.grip === 'dlow' ? diveGrip('dlow', b, s, ug, top) : lerpGrip(diveGrip('dw', b, s, ug), diveGrip('dlow', b, s, ug, 1), k1);
      if (k2 > 0) {
        const c1 = trunkTurn(bn, qT), home = chestPoint(bn, w2), q = 1 - k2;
        hp.copy(b).lerp(home, 0.5).add(tmp.set(0, 0.05, 0.62).applyQuaternion(c1));         // round in front of his face
        b.set(q * q * b.x + 2 * q * k2 * hp.x + k2 * k2 * home.x, q * q * b.y + 2 * q * k2 * hp.y + k2 * k2 * home.y, q * q * b.z + 2 * q * k2 * hp.z + k2 * k2 * home.z);
        // (by way of a palm either side of it: straight from the one to the other the hands had half a turn to make, and flipped)
        g = lerpGrip(lerpGrip(diveGrip('dlow', b, s, ug, 1), grip('sides', b, s, c1), ease(k2 / 0.5)), grip('hug', b, s, c1), ease((k2 - 0.4) / 0.6));
        hug = k2;
      }
      free = true;
      m.held = b.clone();
    } else {
      // pushed on and wide (a parry) or past the hands (beaten). Then his arms come down with him: the bottom one
      // long on the grass beyond his head, the top hand flat on the grass in front of his chest (it will push him up)
      const push = hp.copy(u).multiplyScalar(0.26).add(tmp.set(0, 0.03, 0.1)).multiplyScalar(sv.kind === 'parry' ? ease(a / 0.12) : 0), drop = ease((a - 0.08) / Math.max(0.1, Tl - 0.02));
      g = diveGrip(sv.grip, push.add(r), s, ug, both);
      const rest = {};
      rest[near] = { palm: V(land.x + s * 0.93, 0.03, land.z + 0.2), N: V(0, -0.35, 1).normalize(), F: V(s, 0, 0.12).normalize() };   // (lying on its edge, as a hand does)
      rest[far] = { palm: V(land.x + s * 0.52, 0.006, land.z + 0.44), N: V(0, -1, 0), F: V(s * 0.75, 0, 0.66).normalize() };
      g = lerpGrip(g, rest, drop);
      if (sv.kind === 'parry' && a < 0.05 && ball && ball.vz !== undefined) m.held = r.clone();
    }
  }
  // his chest turns to the ball as he goes for it (the far arm can't lie across his chest: it turns him)
  // (and his shoulders come up by his ears as his arms go out past his head, as shoulders do)
  if (!free) { const up = 0.32 * wk * (1 - ease((tt - T - 0.1) / 0.3)) * clamp((ax - 0.5) / 0.4, 0, 1); bn.clavicleL.rotation.z = up; bn.clavicleR.rotation.z = -up; bn['clavicle' + near].rotation.y = -s * 0.4 * wk * (1 - clamp((ax - 0.5) / 0.4, 0, 1)) * (1 - ease((tt - T - 0.1) / 0.3)); }   // (close to him, arms bent: the near shoulder comes forward instead)
  if (!free) turnToReach(bn, g);
  // (elbows: out to each side of him and a little down while he is upright; as he lies down the bottom one would then
  // point into the grass, so it comes round to the front. A hand flat on the grass under him: the wrist is bent well back)
  const lim = sv.kind === 'catch' ? 0.5 : mix(0.5, 0.85, ease((tt - T - 0.08) / 0.15));
  // (...and with the ball hugged as he lies there it points along the grass toward his feet)
  const arms = (g, lie, free, down, out = 0) => {
    for (const lo of [near, far]) {
      const sd = lo === 'L' ? 1 : -1, pole = hp.set(sd * ((free ? 0.9 : 1) + (lo === far ? out : 0.5)), -down, lo === far ? -0.35 : -0.1).applyQuaternion(bn.hips.quaternion);
      if (lo === near) pole.lerp(tmp.set(0, 0.35, 1).lerp(w2.set(-s * 0.5, 0.1, 1), hug), lie);
      placeHand(bn, lo, g[lo], pole.clone(), 1, lim, free);
    }
  };
  if (t <= tG) arms(g, ease((roll - 0.5) / 0.7), free, free ? 1.1 : 0.35);
  for (const n of ['L', 'R']) clearLeg(bn, n);
  // eyes on the ball: into his hands, or after it when it has gone on
  const eye = m.held && tt > T ? m.held : tt < T + 0.12 || !ball ? r : toModel(sv, ball.x, ball.y, ball.z, w2);
  lookAt(bn, eye, 0.8);

  // up off the grass, the way keepers are coached to (no hands, so the ball can stay in them): the "pendulum leg"
  if (t > tG) {
    // (posed on the last frame too: what comes next starts from where his hips and feet are)
    const gt = Math.min(t - tG, UP.T);
    poseUp(bn, gt, s, land);
    const kneel = ease(gt / UP.post) * (1 - ease((gt - 0.68) / (UP.T - 0.68)));
    if (sv.kind === 'catch') {
      // (carried high on his chest while his knee comes up under it)
      const b = chestPoint(bn, hp).clone().add(tmp.set(0, 0.09, 0.04).multiplyScalar(kneel).applyQuaternion(trunkTurn(bn, qT)));
      b.y -= 0.03 * ease(gt / UP.T);
      arms(grip('hug', b, s, trunkTurn(bn, qT)), 1 - ease(gt / UP.post), true, mix(1.1, 1.3, ease(gt / UP.post)) - 0.8 * kneel, 1.2 * kneel);   // (the far elbow out over the knee he has posted)
      m.held = b;
    } else {
      const rd = readyGrip(bn);
      for (const lo of ['L', 'R']) rd[lo].palm.add(tmp.set(0, 0.12, 0.06).multiplyScalar(kneel).applyQuaternion(trunkTurn(bn, qT)));
      arms(lerpGrip(g, rd, ease(gt / 0.5)), 1 - ease(gt / UP.post), false, mix(0.35, 0.75, ease(gt / UP.post)));
    }
    lookAt(bn, m.held && gt < 0.4 ? m.held : V(pc.x, 1.5, 9), 0.8);
    return t - tG <= UP.T;
  }
  return true;
}
const qT = new THREE.Quaternion(), w2 = new THREE.Vector3();
// Two-bone IK for a leg with the knee toward `pole` (model space), whatever the hips are doing.
const kx = new THREE.Vector3(), ky = new THREE.Vector3(), kz = new THREE.Vector3(), kt = new THREE.Vector3(), km = new THREE.Matrix4(), kq = new THREE.Quaternion();
function reachLegPole(bn, n, target, pole) {
  const U = bn['upperLeg' + n], Lo = bn['lowerLeg' + n], L1 = Lo.position.length(), L2 = bn['foot' + n].position.length();
  kt.copy(U.position).applyQuaternion(bn.hips.quaternion).add(bn.hips.position);
  kt.subVectors(target, kt);
  const want = kt.length(), D = Math.min(L1 + L2 - 0.004, Math.max(Math.abs(L1 - L2) + 0.03, want));
  kt.multiplyScalar(1 / (want || 1));
  kz.copy(pole).addScaledVector(kt, -pole.dot(kt)).normalize();                   // the pole, square to the reach
  const a = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1)), knee = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
  ky.copy(kt).multiplyScalar(-Math.cos(a)).addScaledVector(kz, -Math.sin(a));     // up the thigh (the bone runs down its -y)
  kz.addScaledVector(ky, -kz.dot(ky)).normalize(); kx.crossVectors(ky, kz);
  U.quaternion.copy(kq.copy(bn.hips.quaternion).invert()).multiply(kq.setFromRotationMatrix(km.makeBasis(kx, ky, kz)));
  Lo.rotation.set(knee, 0, 0);
}
// A leg in the air stays out of the grass: if its boot is under it the whole leg is swung up from the hip, just far
// enough (smooth: no solving again, so the knee can't flip). Before this the body was lifted instead, and he hopped
// 15 cm as the take-off foot left the grass.
const SOLE = [[-0.05, -0.085, -0.09], [0.05, -0.085, -0.09], [-0.05, -0.08, 0.19], [0.05, -0.08, 0.19]].map(a => new THREE.Vector3(...a));
const cq = new THREE.Quaternion(), cq2 = new THREE.Quaternion(), cp = new THREE.Vector3(), cj = new THREE.Vector3(), cl = new THREE.Vector3(), cb = new THREE.Vector3(), ca = new THREE.Vector3();
function clearLeg(bn, n) {
  const U = bn['upperLeg' + n], Lo = bn['lowerLeg' + n], F = bn['foot' + n];
  for (let it = 0; it < 2; it++) {
    cq.copy(bn.hips.quaternion); cj.copy(U.position).applyQuaternion(cq).add(bn.hips.position);
    cq.multiply(U.quaternion); cp.copy(Lo.position).applyQuaternion(cq).add(cj);
    cq.multiply(Lo.quaternion); cp.add(cl.copy(F.position).applyQuaternion(cq)); cq.multiply(F.quaternion);
    let low = cp.y - 0.07; cb.copy(cp);
    for (const c of SOLE) { cl.copy(c).applyQuaternion(cq).add(cp); if (cl.y < low) { low = cl.y; cb.copy(cl); } }
    if (low >= 0) return;
    cb.sub(cj); const hz = Math.hypot(cb.x, cb.z);
    if (hz < 0.12) return;
    ca.set(cb.z / hz, 0, -cb.x / hz);
    cq2.copy(bn.hips.quaternion).invert().multiply(cq.setFromAxisAngle(ca, -Math.min(0.7, (-low + 0.004) / hz))).multiply(bn.hips.quaternion);
    U.quaternion.premultiply(cq2);
  }
}
const trunkTurn = (bn, out) => out.copy(bn.hips.quaternion).multiply(bn.spine.quaternion);

/* ---------- getting up: the pendulum leg ---------- */

// Coaching: "use the momentum of the dive like a pendulum and rock and explode back up": the top leg swings up and
// forward and is driven down to post its foot on the grass in front of him, the bottom leg is shot underneath his
// seat, and he rocks up over that bottom knee and drives off the posted foot to standing, without his hands (so a
// ball he has caught stays in them). swing: the top leg up; post: its foot down, on his bottom knee; T: standing.
export const UP = { swing: 0.2, post: 0.45, T: 0.9 };
const uq = new THREE.Quaternion(), ue = new THREE.Euler(), up0 = new THREE.Vector3(), keep = {};
const slerpTo = (bone, x, y, z, k) => bone.quaternion.slerp(uq.setFromEuler(ue.set(x, y, z)), k);
function poseUp(bn, gt, s, land) {
  const near = s > 0 ? 'L' : 'R', far = s > 0 ? 'R' : 'L', sdF = -s;                 // lying on his near side: the far leg is the top one
  const a = ease(gt / UP.swing), b = ease((gt - UP.swing) / (UP.post - UP.swing)), c = ease((gt - UP.post) / (UP.T - UP.post));
  // hips: from lying on his side, rocked up onto the bottom knee (still tipped a little, bent well forward), then up
  const stand = V(land.x - s * 0.16, 0.85, land.z + 0.02);
  bn.hips.quaternion.slerp(uq.setFromEuler(ue.set(0.42, 0, -s * 0.3)), b).slerp(uq.setFromEuler(ue.set(0.36, 0, 0)), c);
  up0.copy(bn.hips.position).lerp(V(stand.x, 0.35, stand.z), b).lerp(stand, c);
  bn.hips.position.copy(up0);
  bn.spine.rotation.x += 0.12 * b * (1 - c); bn.chest.rotation.x += 0.06 * b * (1 - c);
  // the top leg: swung up and forward (the pendulum), then its foot posted on the grass in front of him
  slerpTo(bn['upperLeg' + far], -0.6, 0, sdF * 0.6, a); slerpTo(bn['lowerLeg' + far], 0.5, 0, 0, a);
  // the bottom leg: shot underneath him, knee on the grass, shin back under his seat; then it steps out under him
  slerpTo(bn['upperLeg' + near], -0.95, 0, 0, b); slerpTo(bn['lowerLeg' + near], 2.05, 0, 0, b); slerpTo(bn['foot' + near], 0.7, 0, 0, b);
  for (const [n, k, x, z0, z1] of [[far, b, stand.x - s * 0.27, 0.34, 0.07], [near, c, stand.x + s * 0.22, 0.05, 0.05]]) {
    if (k <= 0) continue;
    const U = bn['upperLeg' + n], L = bn['lowerLeg' + n], F = bn['foot' + n];
    keep.u = U.quaternion.clone(); keep.l = L.quaternion.clone(); keep.f = F.quaternion.clone();
    reachLeg(bn, n, V(x, ankleFor(0) + Math.sin(Math.PI * k) * 0.06, land.z + mix(z0, z1, c)));
    aimFoot(bn, n, qa.setFromEuler(e1.set(0, (n === 'L' ? 1 : -1) * 0.12, 0)));
    U.quaternion.copy(keep.u.slerp(U.quaternion, k)); L.quaternion.copy(keep.l.slerp(L.quaternion, k)); F.quaternion.copy(keep.f.slerp(F.quaternion, k));
  }
}
