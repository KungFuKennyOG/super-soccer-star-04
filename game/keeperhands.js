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
//   w       the contour catch, chest to head high: thumbs behind it, fingers spread up over its top half
//   over    the same above his head; tip: one open palm under and behind it, pushing it up over the bar
//   hug     held to the chest: hands wrapped round the front of it from below; block / lowblock: both palms behind
//           it and turned to push it wide (fingers up / down)
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
  } else if (kind === 'w') { d = n(sd * 0.42, 0.25, -0.87); f = n(sd * 0.22, 1, 0.3); }
  else if (kind === 'over') { d = n(sd * 0.42, 0.3, -0.86); f = n(sd * 0.2, 0.85, -0.45); }
  else if (kind === 'hug') { d = n(sd * 0.5, -0.5, 0.7); f = n(-sd * 0.75, 0.6, 0.25); }
  else if (kind === 'block') { d = n(sd * 0.4 - s * 0.22, -0.05, -0.9); f = n(sd * 0.22, 1, 0.15); }
  else if (kind === 'lowblock') { d = n(sd * 0.4 - s * 0.2, -0.1, -0.9); f = n(sd * 0.12, -1, 0.3); }
  else if (kind === 'tip') {
    if (sd === s) { d = n(0, -0.5, -0.87); f = n(s * 0.1, 0.9, -0.4); } else { d = n(sd * 0.5, -0.6, -0.6); f = n(sd * 0.2, 0.9, -0.2); }
  } else throw new Error('grip ' + kind);
  out.palm.copy(c).addScaledVector(d, R);
  out.N.copy(d).negate();                           // the palm faces the ball's centre
  out.F.copy(f).addScaledVector(out.N, -f.dot(out.N)).normalize();
  if (kind === 'parry' && sd !== s) out.palm.addScaledVector(d, 0.1);   // the far hand doesn't get there
  if (kind === 'tip' && sd !== s) out.palm.addScaledVector(d, 0.3).y -= 0.25;
  return out;
}
// q: the grip turned with his trunk (a ball hugged while he lies on his side or gets up: `d` and `f` above are for a
// man stood up)
export function grip(kind, c, s, q = null) {
  const g = { L: spot(kind, c, null, 'L', s), R: spot(kind, c, null, 'R', s) };
  if (q) for (const lo of ['L', 'R']) { const o = g[lo]; o.palm.sub(c).applyQuaternion(q).add(c); o.N.applyQuaternion(q); o.F.applyQuaternion(q); }
  return g;
}
// Diving: his hands on a ball at c at the end of his reach. u: the way he is stretched (unit, from his hips to the
// ball); the fingers point on along it, so the hand is in line with the arm (fingers up, as in a standing catch,
// folded his wrists and elbows double). Across the reach: z toward the shooter, w the top side of him as he lies.
//   dlow     the bottom hand behind it, the top hand on top: pinned to the grass (coached: "the ball is the third hand")
//   dw       both palms behind it, thumbs together: a W on its side (a catch off the grass)
//   dnear    a parry with the bottom hand, the heel of the palm behind the inside of the ball, the top hand short of it
//   dtop     a parry with the top hand come over (the higher ones: it reaches further), the bottom hand under and short
//   dboth    a parry with both palms behind it
// k: for dlow, how far on top the top hand has come (0: beside the other one, as dw); for dnear and dtop, how nearly
// the other hand gets there too (1: both arms long together; 0: one arm at full stretch, the other left well short)
const du = new THREE.Vector3(), dz = new THREE.Vector3(), dw = new THREE.Vector3();
export function diveGrip(kind, c, s, u, k = 1) {
  const g = {};
  du.copy(u).normalize(); dw.set(0, 0, 1).cross(du).multiplyScalar(s).normalize(); dz.crossVectors(du, dw).multiplyScalar(s);   // (dz: square to the reach, toward the shooter)
  for (const lo of ['L', 'R']) {
    const sd = lo === 'L' ? 1 : -1, bottom = sd === s, t = bottom ? -1 : 1;
    let a, b, e, fu = 1, fz = 0.12, fw = 0, back = 0, fwd = 0;          // d = a u + b z + e w; f = fu u + fz z + fw w
    if (kind === 'dlow') { if (bottom) { a = -0.3; b = -0.9; e = -0.28; } else { a = -0.12 - 0.15 * (1 - k); b = -0.3 - 0.55 * (1 - k); e = 0.42 + 0.55 * k; fz = 0.35 * k; } }
    else if (kind === 'dw') { a = -0.28; b = -0.86; e = t * 0.42; fw = t * 0.2; }
    else if (kind === 'dboth') { a = -0.42; b = -0.82; e = t * 0.38; fw = t * 0.2; }
    else if (kind === 'dnear') { if (bottom) { a = -0.5; b = -0.84; e = -0.05; } else { a = -0.45; b = -0.78; e = 0.32 + 0.5 * (1 - k); back = 0.12 + 0.3 * (1 - k); fwd = 0.16 * (1 - k); } }
    else if (kind === 'dtop') { if (!bottom) { a = -0.5; b = -0.84; e = 0.1; } else { a = -0.45; b = -0.6; e = -0.6; back = 0.2 + 0.25 * (1 - k); } }
    else throw new Error('grip ' + kind);
    const d = new THREE.Vector3().addScaledVector(du, a).addScaledVector(dz, b).addScaledVector(dw, e).normalize();
    const f = new THREE.Vector3().addScaledVector(du, fu).addScaledVector(dz, fz).addScaledVector(dw, fw);
    const o = g[lo] = { palm: new THREE.Vector3().copy(c).addScaledVector(d, R), N: d.clone().negate(), F: f };
    o.F.addScaledVector(o.N, -f.dot(o.N)).normalize();
    if (back) o.palm.addScaledVector(du, -back).addScaledVector(dz, fwd);   // the other hand doesn't get there (and is kept in front of his face)
  }
  return g;
}
// His chest turns to what he reaches for. An upper arm only comes so far across the chest (about 35 degrees inside
// straight ahead: REACH.in); asked for more, the trunk turns toward it (spine and chest share it, REACH.turn at
// most) and the shoulder comes forward with it. Smooth in the target, so nothing can flip. Call before placeHands.
export const REACH = { in: 0.46, turn: 0.85, share: 1 };
const rs = new THREE.Vector3(), rc = new THREE.Vector3(), rcq = new THREE.Quaternion(), ry = new THREE.Vector3(0, 1, 0);
export function turnToReach(bn, g, w = 1) {
  rcq.copy(bn.hips.quaternion); rc.copy(bn.spine.position).applyQuaternion(rcq).add(bn.hips.position);
  rcq.multiply(bn.spine.quaternion); rc.add(rs.copy(bn.chest.position).applyQuaternion(rcq)); rcq.multiply(bn.chest.quaternion).invert();
  let turn = 0;
  for (const lo of ['L', 'R']) {
    const sd = lo === 'L' ? 1 : -1;
    rs.copy(g[lo].palm).sub(rc).applyQuaternion(rcq).sub(bn['clavicle' + lo].position).sub(bn['upperArm' + lo].position);   // shoulder to palm, as the chest sees it
    const flat = Math.hypot(rs.x, rs.z), inw = Math.atan2(-sd * rs.x, Math.max(rs.z, 0.02 * flat)), ex = Math.max(0, inw - REACH.in);
    turn += -sd * Math.min(REACH.turn, ex * REACH.share) * sm(0.25, 0.6, flat / (rs.length() || 1));
  }
  turn *= w;
  bn.spine.quaternion.multiply(q2.setFromAxisAngle(ry, turn * 0.45)); bn.chest.quaternion.multiply(q2.setFromAxisAngle(ry, turn * 0.55));
  return turn;
}

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
const fkP = {}, fkQ = {}, tA = new THREE.Vector3(), tB = new THREE.Vector3(), tv = new THREE.Vector3(), tn = new THREE.Vector3(), ti = new THREE.Quaternion(), hC = new THREE.Vector3();
function fk(bn, lo) {
  const at = (name, parent) => {
    const b = bn[name], P = fkP[name] ??= new THREE.Vector3(), Q = fkQ[name] ??= new THREE.Quaternion();
    if (parent) { P.copy(b.position).applyQuaternion(fkQ[parent]).add(fkP[parent]); Q.copy(fkQ[parent]).multiply(b.quaternion); } else { P.copy(b.position); Q.copy(b.quaternion); }
  };
  at('hips'); at('spine', 'hips'); at('chest', 'spine'); at('neck', 'chest'); at('head', 'neck');
  at('clavicle' + lo, 'chest'); at('upperArm' + lo, 'clavicle' + lo); at('foreArm' + lo, 'upperArm' + lo); at('hand' + lo, 'foreArm' + lo);
  for (const n of ['L', 'R']) { at('upperLeg' + n, 'hips'); at('lowerLeg' + n, 'upperLeg' + n); at('foot' + n, 'lowerLeg' + n); }
}
const ARM_PTS = [['upperArm', 'foreArm', 0.55], ['upperArm', 'foreArm', 1], ['foreArm', 'hand', 0.5], ['foreArm', 'hand', 1]];
export const insideWhat = { part: '', pt: -1 };            // what the deepest point was in (for the tests' messages)
export function armInside(bn, lo, out = null) {
  fk(bn, lo);
  let worst = 0, cur = -1;
  const test = p => {
    for (const [a, b, rx, rz] of TRUNK) {
      tA.copy(fkP[a]); tB.copy(fkP[b]).sub(tA);
      const t = Math.min(1, Math.max(0, tv.copy(p).sub(tA).dot(tB) / tB.lengthSq()));
      tv.copy(p).sub(tA.addScaledVector(tB, t)); ti.copy(fkQ[b]).invert(); tn.copy(tv).applyQuaternion(ti);
      const k = Math.hypot(tn.x / rx, tn.z / rz, tn.y / 0.12), d = (1 - k) * Math.min(rx, rz);
      if (d > worst) { worst = d; insideWhat.part = b; insideWhat.pt = cur; if (out) { out.set(tn.x / (rx * rx), 0, tn.z / (rz * rz) + 0.4 / rz).applyQuaternion(fkQ[b]).normalize(); } }
    }
  };
  // and his legs: the forearm, wrist and hand against each thigh (8.5 cm round its line) and shin (6 cm)
  const leg = p => {
    for (const n of ['L', 'R']) for (const [a, b, r] of [['upperLeg', 'lowerLeg', 0.085], ['lowerLeg', 'foot', 0.06]]) {
      tA.copy(fkP[a + n]); tB.copy(fkP[b + n]).sub(tA);
      const t = Math.min(1, Math.max(0, tn.copy(p).sub(tA).dot(tB) / tB.lengthSq())), d = r - tn.copy(p).sub(tA.addScaledVector(tB, t)).length();
      if (d > worst) { worst = d; insideWhat.part = a + n; insideWhat.pt = cur; if (out) out.copy(tn).normalize(); }
    }
  };
  const pts = ARM_PTS.map(([a, b, k]) => tv.copy(fkP[a + lo]).lerp(fkP[b + lo], k).clone());
  pts.push(tv.set(0, -0.09, 0).applyQuaternion(fkQ['hand' + lo]).add(fkP['hand' + lo]).clone());
  // and his head: a ball 11 cm round, 9 cm up from the top of his neck
  // (its own vector: tA is the trunk and leg tests' scratch, and until Nov 2026 the head was measured against whatever
  // they had left in it)
  hC.set(0, 0.09, 0.01).applyQuaternion(fkQ.head).add(fkP.head);
  const head = p => { const d = 0.115 - tn.copy(p).sub(hC).length(); if (d > worst) { worst = d; insideWhat.part = 'head'; insideWhat.pt = cur; if (out) out.copy(tn).normalize(); } };
  pts.forEach((p, i) => { cur = i; test(p); if (i >= 2) leg(p); if (i >= 1) head(p); });
  return worst;
}
// The arm kept out of the trunk, smoothly (no searching, so nothing can flip from one frame to the next: a search
// for a clear elbow did flip, and the arms flickered). A palm asked to be across his chest or in it is brought to
// the front of the chest, and the elbow of an arm reaching across goes forward, so the arm passes in front of him.
const cq = new THREE.Quaternion(), cqi = new THREE.Quaternion(), cpos = new THREE.Vector3(), lp = new THREE.Vector3(), spT = { palm: new THREE.Vector3(), N: null, F: null }, pl = new THREE.Vector3();
const hq = new THREE.Quaternion(), hc = new THREE.Vector3();
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function placeHand(bn, lo, sp, pole, w = 1, lim = WRIST, free = false) {
  const up = bn['upperArm' + lo], fa = bn['foreArm' + lo], hd = bn['hand' + lo], sd = lo === 'L' ? 1 : -1;
  if (w < 1) { held.u = up.quaternion.clone(); held.f = fa.quaternion.clone(); held.h = hd.quaternion.clone(); }
  // the chest's frame (model space)
  cq.copy(bn.hips.quaternion); cpos.copy(bn.spine.position).applyQuaternion(cq).add(bn.hips.position);
  cq.multiply(bn.spine.quaternion); cpos.add(lp.copy(bn.chest.position).applyQuaternion(cq)); cq.multiply(bn.chest.quaternion); cqi.copy(cq).invert();
  lp.copy(sp.palm).sub(cpos).applyQuaternion(cqi);                       // the palm as the chest sees it: x toward this arm's side is sd * x
  const across = sm(0.24, 0.06, sd * lp.x), level = sm(-0.5, -0.36, lp.y) * sm(0.54, 0.4, lp.y);   // how far over his body it is, and whether it is at the trunk's height at all
  const k = free ? 0 : across * level, front = 0.17 + 0.17 * sm(0.02, -0.28, sd * lp.x);   // further forward the further past his middle it is: the whole arm has to clear his chest
  if (k > 0 && lp.z < front) lp.z += (front - lp.z) * k;                  // (by how far over him it is: a palm well clear of him is left exactly where it was asked)
  spT.palm.copy(lp).applyQuaternion(cq).add(cpos); spT.N = sp.N; spT.F = sp.F;
  // and off his head: a palm asked to be nearer than 16.5 cm to its middle is moved straight out from it, to the front
  // if it is dead centre (a hand going from in front of his chest to a ball over his far shoulder went through his face)
  hq.copy(cq).multiply(bn.neck.quaternion); hc.copy(bn.neck.position).applyQuaternion(cq).add(cpos).add(lp.copy(bn.head.position).applyQuaternion(hq));
  hq.multiply(bn.head.quaternion); hc.add(lp.set(0, 0.09, 0.01).applyQuaternion(hq));
  lp.copy(spT.palm).sub(hc); const hd0 = lp.length();
  if (hd0 < 0.165) { if (hd0 < 0.02) lp.set(0, 0, 1).applyQuaternion(hq); else lp.multiplyScalar(1 / hd0); lp.addScaledVector(pl.set(0, 0, 0.35).applyQuaternion(hq), 1).normalize(); spT.palm.copy(hc).addScaledVector(lp, 0.165 + (0.165 - hd0) * 0.2); }
  // and the shoulder rolls forward as an arm reaches across (as a real one does): without it the upper arm lay through
  // the top of his chest
  const over = k * sm(0.1, -0.25, sd * lp.x);
  if (over > 0) { const cl = bn['clavicle' + lo]; cl.quaternion.slerp(q2.setFromAxisAngle(v2.set(0, 1, 0), -sd * 0.6), over); }
  pl.set(sd * 0.1, -0.15, 1).applyQuaternion(cq).lerp(pole, 1 - k);
  const qWant = solve(bn, lo, spT, pl, lim);
  hd.quaternion.copy(forearmTurn(bn, lo, q1).invert().multiply(qWant));
  if (w < 1) { up.quaternion.copy(held.u.slerp(up.quaternion, w)); fa.quaternion.copy(held.f.slerp(fa.quaternion, w)); hd.quaternion.copy(held.h.slerp(hd.quaternion, w)); }
}
// both hands; poles out to each side and a little down and back, in the hips' frame
// (free: the elbows go where the pole says even with the palms in front of his chest: a catch in both hands, where
// the arms come round a ball from either side, not across him)
export function placeHands(bn, g, w = 1, poleOut = 1, poleDown = 0.4, free = false, lim = WRIST) {
  for (const lo of ['L', 'R']) {
    const sd = lo === 'L' ? 1 : -1, pole = new THREE.Vector3(sd * poleOut, -poleDown, -0.35).applyQuaternion(bn.hips.quaternion);
    placeHand(bn, lo, g[lo], pole, w, lim, free);
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
export function keepAboveGrass(m, settle = false, ball = null, dt = 1 / 72) {
  m.root.updateMatrixWorld(true);
  let d = underGrass(m);
  if (ball) d = Math.max(d, BALL_R - ball.y);                         // a ball in his hands (model space) stays on the grass too
  // (lying or getting up, what he rests on changes from frame to frame: an arm he was lying on is taken away and he
  // would drop 5 cm in a frame. He is let down, or lifted, at 1.1 m/s at most, and is never left more than 8 mm under)
  const want = d > 0 || settle ? d : 0, was = m.kOff ?? 0, step = 1.1 * dt;
  const off = settle || was !== 0 ? Math.max(want - 0.008 * Math.min(1, Math.abs(want - was) / 0.02), Math.min(was + step, Math.max(was - step, want))) : want;
  m.kOff = settle || Math.abs(off) > 1e-4 ? off : 0;
  if (off !== 0) { m.bone.hips.position.y += off; m.root.updateMatrixWorld(true); }
  return off;
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

// Where his hands are carried through a save before they go to the ball: in front of his chest off bent elbows,
// fingers forward, palms turned in and half to the ball, wrists straight. Carried with the chest, not the hips: as
// he sinks into the load his thighs come up, and hands hung off the hips went into his lap and his stomach.
const rq = new THREE.Quaternion(), rI = new THREE.Quaternion(), rp = new THREE.Vector3(), rw = new THREE.Vector3();
export function readyGrip(bn) {
  const out = {};
  rq.copy(bn.hips.quaternion); rp.copy(bn.spine.position).applyQuaternion(rq).add(bn.hips.position);
  rq.multiply(bn.spine.quaternion); rp.add(rw.copy(bn.chest.position).applyQuaternion(rq)); rq.multiply(bn.chest.quaternion);
  // (hung from the chest but only a third turned with it: bent well forward, hands that followed the chest all the
  // way came down onto his knees)
  rq.slerp(rI, 0.65);
  for (const [lo, sd] of [['L', 1], ['R', -1]]) {
    const palm = new THREE.Vector3(sd * 0.17, -0.2, 0.36).applyQuaternion(rq).add(rp);
    const N = n(-sd * 0.75, -0.25, 0.6).applyQuaternion(rq), F = n(sd * 0.12, -0.3, 1).applyQuaternion(rq);
    out[lo] = { palm, N, F: F.addScaledVector(N, -F.dot(N)).normalize() };
  }
  return out;
}
// (the hand turns from one to the other the short way round, as one turn: its two directions blended each on its own
// could pass through nothing and flip when the grips faced opposite ways)
const ga = new THREE.Quaternion(), gb = new THREE.Quaternion(), gm = new THREE.Matrix4(), gx = new THREE.Vector3();
const frameOf = (g, out) => out.setFromRotationMatrix(gm.makeBasis(g.N, gx.copy(g.F).addScaledVector(g.N, -g.F.dot(g.N)).normalize(), v3.crossVectors(g.N, gx)));
export function lerpGrip(a, b, k) {
  const out = {};
  for (const lo of ['L', 'R']) {
    frameOf(a[lo], ga).slerp(frameOf(b[lo], gb), k);
    out[lo] = { palm: a[lo].palm.clone().lerp(b[lo].palm, k), N: new THREE.Vector3(1, 0, 0).applyQuaternion(ga), F: new THREE.Vector3(0, 1, 0).applyQuaternion(ga) };
  }
  return out;
}
// in front of his chest, where a caught ball is held (carried with the trunk)
export function chestPoint(bn, out) {
  rq.copy(bn.hips.quaternion).multiply(bn.spine.quaternion);
  return out.set(0, 0.34, 0.26).applyQuaternion(rq).add(bn.hips.position);
}
