// The keeper's hands on the ball, and what keeps him on top of the grass. Model space throughout: +z the way he
// faces (toward the ball), +x his left, y up, the origin on the grass under him (game/legik.js).
//
// A grip is where each palm goes round a ball and which way it faces: the ball's centre is the master and
// the palms are put on its surface, so a held ball is drawn where the pose put it (heldBall in
// game/keeperpose.js) and the palms measure against it (tests/unit/keeper.anim.test.js).
// Grips (coaching, see docs/notes-keeper-anim.md):
//   behind  W: both palms behind the ball, fingers up, thumbs close (chest high and above, and the high dive)
//   low     a diving catch near the grass: the bottom hand behind it, the top hand on top, pinning it
//   scoop   a ball along the ground taken standing: palms facing it, fingers down to the grass
//   basket  waist high: palms up under it, elbows in, into the stomach
//   sides   carried: a palm either side
//   parry   the near hand's palm and heel on the inside back of the ball (to push it wide), the other hand short of it
import * as THREE from 'three';
import { reachArm } from './legik.js';

const TURN = 0.4;                                  // the hand hangs turned this far (game/ps2/limbs.js)
// in the hand bone's own space: the palm's normal, the fingers' way, and the gloved palm's middle (the glove is
// about 20% bigger than the bare hand: 7.2 cm down from the wrist, 3.8 cm proud of the bone, as palmPoint in the
// '04 look's game/ps2/gloves.js, branch gloves, so a held ball sits where its gripPoint puts it)
const NL = { L: new THREE.Vector3(-Math.cos(TURN), 0, -Math.sin(TURN)), R: new THREE.Vector3(Math.cos(TURN), 0, -Math.sin(TURN)) };
const FL = new THREE.Vector3(0, -1, 0);
const TH = { L: new THREE.Vector3(-Math.sin(TURN), 0, Math.cos(TURN)), R: new THREE.Vector3(Math.sin(TURN), 0, Math.cos(TURN)) };     // toward the thumb
export const PALM = Object.fromEntries(['L', 'R'].map(n => [n, new THREE.Vector3(0, -0.072, 0).addScaledVector(NL[n], 0.038).addScaledVector(TH[n], 0.008)]));
export const BALL_R = 0.12;
const R = BALL_R + 0.004;

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
const n = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// One hand's place on a ball at c: { palm (point), N (palm normal), F (fingers) }; s: which side the save is on
// (+1 his left), lo: 'L' or 'R'.
function spot(kind, c, side, lo, s) {
  const out = { palm: new THREE.Vector3(), N: new THREE.Vector3(), F: new THREE.Vector3() }, sd = lo === 'L' ? 1 : -1;
  let d, f;                                         // d: from the ball's centre out to the palm; f: fingers
  if (kind === 'behind') { d = n(sd * 0.42, 0.08, -0.9); f = n(sd * 0.25, 1, 0.15); }
  else if (kind === 'low') {
    const bottom = sd === s;                        // the hand on the side he falls on is underneath
    if (bottom) { d = n(sd * 0.35, -0.25, -0.9); f = n(sd * 0.9, 0.35, 0.1); } else { d = n(-sd * 0.1, 1, -0.25); f = n(sd * 0.85, 0, 0.5); }
  } else if (kind === 'scoop') { d = n(sd * 0.4, -0.3, -0.86); f = n(sd * 0.1, -1, 0.5); }
  else if (kind === 'basket') { d = n(sd * 0.55, -0.75, -0.1); f = n(sd * 0.1, 0.05, 1); }
  else if (kind === 'sides') { d = n(sd, -0.15, -0.1); f = n(0, 0.1, 1); }
  else if (kind === 'parry') {
    if (sd === s) { d = n(-s * 0.45, 0.05, -0.9); f = n(s * 0.2, 1, 0.1); }
    else { d = n(-s * 0.45, -0.3, -0.85); f = n(s * 0.2, 1, 0.1); }
  } else throw new Error('grip ' + kind);
  out.palm.copy(c).addScaledVector(d, R);
  out.N.copy(d).negate();                           // the palm faces the ball's centre
  out.F.copy(f).addScaledVector(out.N, -f.dot(out.N)).normalize();
  if (kind === 'parry' && sd !== s) out.palm.addScaledVector(d, 0.1);   // the far hand doesn't get there
  return out;
}
export function grip(kind, c, s) { return { L: spot(kind, c, null, 'L', s), R: spot(kind, c, null, 'R', s) }; }

// The world turn that lays hand `lo`'s palm toward N with the fingers along F (model space).
function handTurn(lo, N, F, out) {
  v1.copy(N); v2.copy(F).addScaledVector(N, -F.dot(N)).normalize(); v3.crossVectors(v1, v2);
  m1.makeBasis(v1, v2, v3);
  const a = NL[lo], b = FL, c = new THREE.Vector3().crossVectors(a, b);
  m2.makeBasis(a, b, c).transpose();
  return out.setFromRotationMatrix(m1.multiply(m2));
}
// the arm's parents' turn in model space, down to the forearm
function forearmTurn(bn, lo, out) {
  return out.copy(bn.hips.quaternion).multiply(bn.spine.quaternion).multiply(bn.chest.quaternion).multiply(bn['clavicle' + lo].quaternion)
    .multiply(bn['upperArm' + lo].quaternion).multiply(bn['foreArm' + lo].quaternion);
}

// Puts each hand's gloved palm on its spot: the wrist where the palm then lands, the arm bent to it (elbow toward
// `pole`, model space), the hand turned. w (0..1) eases it in from the pose the arm already has.
// A wrist only bends so far (WRIST): if the spot asks the hand to stand further off the line of the forearm than
// that, the hand gives (the palm stays on its spot and faces a little off it) and the arm is solved again. Without
// this the palms were always square to the ball and the wrists folded back at right angles (Kenny: "broken wrist").
export const WRIST = 0.5;                          // rad, about 30 degrees
const want = new THREE.Quaternion(), held = {}, fd = new THREE.Vector3(), hd3 = new THREE.Vector3(), ax = new THREE.Vector3(), qf = new THREE.Quaternion();
function solve(bn, lo, sp, pole, lim) {
  const qWant = handTurn(lo, sp.N, sp.F, want);
  for (let it = 0; it < 3; it++) {
    const wrist = v3.copy(PALM[lo]).applyQuaternion(qWant).negate().add(sp.palm);
    reachArm(bn, lo, wrist.clone(), pole);
    fd.copy(FL).applyQuaternion(forearmTurn(bn, lo, q1)); hd3.copy(FL).applyQuaternion(qWant);
    const ang = fd.angleTo(hd3);
    if (ang <= lim + 0.02) break;
    ax.crossVectors(hd3, fd);
    if (ax.lengthSq() < 1e-8) break;
    qWant.premultiply(qf.setFromAxisAngle(ax.normalize(), ang - lim));
  }
  return qWant;
}
// His arms don't go through his body. The trunk is three fat ellipses (hips to spine, spine to chest, chest to neck,
// in each bone's own frame); the arm is sampled at the elbow, down the forearm, the wrist and the hand, and up the
// upper arm. How far the deepest of those is inside (m, 0 if clear), with the way out of the trunk there in `out`.
const TRUNK = [['hips', 'spine', 0.165, 0.12], ['spine', 'chest', 0.165, 0.12], ['chest', 'neck', 0.18, 0.125]];
const fkP = {}, fkQ = {}, tA = new THREE.Vector3(), tB = new THREE.Vector3(), tv = new THREE.Vector3(), tn = new THREE.Vector3(), ti = new THREE.Quaternion();
function fk(bn, lo) {
  const at = (name, parent) => {
    const b = bn[name], P = fkP[name] ??= new THREE.Vector3(), Q = fkQ[name] ??= new THREE.Quaternion();
    if (parent) { P.copy(b.position).applyQuaternion(fkQ[parent]).add(fkP[parent]); Q.copy(fkQ[parent]).multiply(b.quaternion); } else { P.copy(b.position); Q.copy(b.quaternion); }
  };
  at('hips'); at('spine', 'hips'); at('chest', 'spine'); at('neck', 'chest');
  at('clavicle' + lo, 'chest'); at('upperArm' + lo, 'clavicle' + lo); at('foreArm' + lo, 'upperArm' + lo); at('hand' + lo, 'foreArm' + lo);
}
const ARM_PTS = [['upperArm', 'foreArm', 0.55], ['upperArm', 'foreArm', 1], ['foreArm', 'hand', 0.5], ['foreArm', 'hand', 1]];
export function armInside(bn, lo, out = null) {
  fk(bn, lo);
  let worst = 0;
  const test = p => {
    for (const [a, b, rx, rz] of TRUNK) {
      tA.copy(fkP[a]); tB.copy(fkP[b]).sub(tA);
      const t = Math.min(1, Math.max(0, tv.copy(p).sub(tA).dot(tB) / tB.lengthSq()));
      tv.copy(p).sub(tA.addScaledVector(tB, t)); ti.copy(fkQ[b]).invert(); tn.copy(tv).applyQuaternion(ti);
      const k = Math.hypot(tn.x / rx, tn.z / rz, tn.y / 0.12), d = (1 - k) * Math.min(rx, rz);
      if (d > worst) { worst = d; if (out) { out.set(tn.x / (rx * rx), 0, tn.z / (rz * rz) + 0.4 / rz).applyQuaternion(fkQ[b]).normalize(); } }
    }
  };
  for (const [a, b, k] of ARM_PTS) test(tv.copy(fkP[a + lo]).lerp(fkP[b + lo], k).clone());
  test(tv.set(0, -0.09, 0).applyQuaternion(fkQ['hand' + lo]).add(fkP['hand' + lo]).clone());
  return worst;
}
// The arm kept out of the trunk, smoothly (no searching, so nothing can flip from one frame to the next: a search
// for a clear elbow did flip, and the arms flickered). A palm asked to be across his chest or in it is brought to
// the front of the chest, and the elbow of an arm reaching across goes forward, so the arm passes in front of him.
const cq = new THREE.Quaternion(), cqi = new THREE.Quaternion(), cpos = new THREE.Vector3(), lp = new THREE.Vector3(), spT = { palm: new THREE.Vector3(), N: null, F: null }, pl = new THREE.Vector3();
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function placeHand(bn, lo, sp, pole, w = 1, lim = WRIST) {
  const up = bn['upperArm' + lo], fa = bn['foreArm' + lo], hd = bn['hand' + lo], sd = lo === 'L' ? 1 : -1;
  if (w < 1) { held.u = up.quaternion.clone(); held.f = fa.quaternion.clone(); held.h = hd.quaternion.clone(); }
  // the chest's frame (model space)
  cq.copy(bn.hips.quaternion); cpos.copy(bn.spine.position).applyQuaternion(cq).add(bn.hips.position);
  cq.multiply(bn.spine.quaternion); cpos.add(lp.copy(bn.chest.position).applyQuaternion(cq)); cq.multiply(bn.chest.quaternion); cqi.copy(cq).invert();
  lp.copy(sp.palm).sub(cpos).applyQuaternion(cqi);                       // the palm as the chest sees it: x toward this arm's side is sd * x
  const across = sm(0.24, 0.06, sd * lp.x), level = sm(-0.5, -0.36, lp.y) * sm(0.42, 0.3, lp.y);   // how far over his body it is, and whether it is at the trunk's height at all
  const k = across * level, front = 0.17;
  if (k > 0 && lp.z < front) lp.z += (front - lp.z) * k;                  // (by how far over him it is: a palm well clear of him is left exactly where it was asked)
  spT.palm.copy(lp).applyQuaternion(cq).add(cpos); spT.N = sp.N; spT.F = sp.F;
  pl.set(sd * 0.1, -0.15, 1).applyQuaternion(cq).lerp(pole, 1 - k);
  const qWant = solve(bn, lo, spT, pl, lim);
  hd.quaternion.copy(forearmTurn(bn, lo, q1).invert().multiply(qWant));
  if (w < 1) { up.quaternion.copy(held.u.slerp(up.quaternion, w)); fa.quaternion.copy(held.f.slerp(fa.quaternion, w)); hd.quaternion.copy(held.h.slerp(hd.quaternion, w)); }
}
// both hands; poles out to each side and a little down and back, in the hips' frame
export function placeHands(bn, g, w = 1, poleOut = 1, poleDown = 0.4) {
  for (const lo of ['L', 'R']) {
    const sd = lo === 'L' ? 1 : -1, pole = new THREE.Vector3(sd * poleOut, -poleDown, -0.35).applyQuaternion(bn.hips.quaternion);
    placeHand(bn, lo, g[lo], pole, w);
  }
}

// Where a hand's gloved palm is in the world (after updateMatrixWorld).
export function palmWorld(m, lo, out) { return m.bone['hand' + lo].localToWorld(out.copy(PALM[lo])); }

// Nothing under the grass: the lowest each joint may go (m above the grass, from the body's thickness round it)
const FLOOR = { hips: 0.13, spine: 0.13, chest: 0.13, neck: 0.1, head: 0.11, upperArmL: 0.07, upperArmR: 0.07, foreArmL: 0.05, foreArmR: 0.05, handL: 0.035, handR: 0.035,
  lowerLegL: 0.06, lowerLegR: 0.06, footL: 0.07, footR: 0.07, toeL: 0.025, toeR: 0.025 };
// and the corners of the boots' soles (the boot in game/body.js and game/ps2/figure.js, in the foot bone's space)
const SOLE = [[-0.05, -0.085, -0.09], [0.05, -0.085, -0.09], [-0.05, -0.08, 0.19], [0.05, -0.08, 0.19]].map(a => new THREE.Vector3(...a));
const wp = new THREE.Vector3();
// How far the lowest joint or sole is under where it may go (m; 0 or less: clear). The model's matrices must be current.
export function underGrass(m) {
  let worst = -9;
  for (const [k, h] of Object.entries(FLOOR)) { m.bone[k].getWorldPosition(wp); worst = Math.max(worst, h - wp.y); }
  for (const n of ['L', 'R']) for (const c of SOLE) worst = Math.max(worst, -m.bone['foot' + n].localToWorld(wp.copy(c)).y);
  return worst;
}
// how high the ankle must be for a boot turned toes-down by `pitch` (rad) to stand on the grass
export const ankleFor = pitch => Math.max(0.08 * Math.cos(pitch) + 0.19 * Math.sin(pitch), 0.085 * Math.cos(pitch) - 0.09 * Math.sin(pitch)) + 0.002;
// Lifts the whole body (the hips) clear of the grass; settle: he is lying or getting up, so whatever is lowest is put
// down on the grass (lowered as well as lifted: no floating). Returns how far he was moved up (m).
export function keepAboveGrass(m, settle = false, ball = null) {
  m.root.updateMatrixWorld(true);
  let d = underGrass(m);
  if (ball) d = Math.max(d, BALL_R - ball.y);                         // a ball in his hands (model space) stays on the grass too
  if (d > 0 || (settle && d < 0)) { m.bone.hips.position.y += d; m.root.updateMatrixWorld(true); return d; }
  return 0;
}

// Turns the neck and head toward a point (model space), sharing the turn between them; k: how much.
const qc = new THREE.Quaternion(), hp = new THREE.Vector3();
export function lookAt(bn, target, k = 1) {
  qc.copy(bn.hips.quaternion).multiply(bn.spine.quaternion).multiply(bn.chest.quaternion);
  hp.copy(bn.neck.position).applyQuaternion(qc);
  hp.add(v1.copy(bn.chest.position).applyQuaternion(q2.copy(bn.hips.quaternion).multiply(bn.spine.quaternion)));
  hp.add(v1.copy(bn.spine.position).applyQuaternion(bn.hips.quaternion)).add(bn.hips.position).add(new THREE.Vector3(0, 0.12, 0));
  const d = v2.copy(target).sub(hp).normalize().applyQuaternion(qc.invert());
  const yaw = Math.max(-1.2, Math.min(1.2, Math.atan2(d.x, d.z))) * k, pitch = Math.max(-0.9, Math.min(1.1, -Math.asin(Math.max(-1, Math.min(1, d.y))))) * k;
  bn.neck.rotation.set(pitch * 0.45, yaw * 0.45, 0); bn.head.rotation.set(pitch * 0.55, yaw * 0.55, 0);
}

// A smooth path through keys [[t, Vector3], ...] (Catmull-Rom, held at the ends).
export function pathAt(keys, t, out) {
  if (t <= keys[0][0]) return out.copy(keys[0][1]);
  const last = keys.length - 1;
  if (t >= keys[last][0]) return out.copy(keys[last][1]);
  let i = 0; while (keys[i + 1][0] < t) i++;
  const [t1, p1] = keys[i], [t2, p2] = keys[i + 1], p0 = keys[Math.max(0, i - 1)][1], p3 = keys[Math.min(last, i + 2)][1];
  const u = (t - t1) / (t2 - t1), u2 = u * u, u3 = u2 * u;
  for (const c of ['x', 'y', 'z']) out[c] = 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3);
  return out;
}
// A number along keys [[t, v], ...] on a smooth curve that never overshoots a key (monotone cubic, Fritsch-Carlson):
// it runs on through the keys without stopping at each, and without the bounces a plain spline puts in.
export function mono(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (keys[i + 1][0] < t) i++;
  const d = k => (keys[k + 1][1] - keys[k][1]) / (keys[k + 1][0] - keys[k][0]);
  const slope = k => { if (k === 0) return d(0); if (k === n - 1) return d(n - 2); const a = d(k - 1), b = d(k); return a * b <= 0 ? 0 : 2 * a * b / (a + b); };
  const h = keys[i + 1][0] - keys[i][0], u = (t - keys[i][0]) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * keys[i][1] + (u3 - 2 * u2 + u) * h * slope(i) + (-2 * u3 + 3 * u2) * keys[i + 1][1] + (u3 - u2) * h * slope(i + 1);
}
// a number along keys [[t, v], ...], eased between them
export function keyAt(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i], u = (t - a) / (b - a), e = u * u * (3 - 2 * u); return va + (vb - va) * e; }
  return keys[keys.length - 1][1];
}
