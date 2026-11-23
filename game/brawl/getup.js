// Getting up off the grass. A man knocked over is a ragdoll (game/brawl/ragdoll.js); when the sim says he gets
// up, the ragdoll ends where it lies and a recorded get-up takes over: three CMU captures of people getting up
// from the ground (game/brawl/anim/getups.js, baked by tools/build-getup.mjs), one from lying on the back (sit
// up, rock forward onto the feet, stand), one face down (push up on the hands, a knee and then the feet
// brought under, stand) and one from the side (roll onto the front and a hand, then up the same way).
//
// What is the recording's and what isn't:
// - the body's path from lying to a crouch is the recording, laid where the ragdoll lay (head the same way,
//   seen in a mirror when that is nearer to how his limbs fell), played quicker than the people recorded;
// - the first fifth eases from however the ragdoll's limbs fell into the recording's lying pose: him gathering
//   himself. That part is a blend, not a capture;
// - the people recorded end in a ready crouch facing wherever the get-up left them. The sim wants him standing
//   on its spot facing its way, so from the moment his trunk is off the grass he is turned and carried there,
//   and the last third eases into the game's own standing pose. Hands and feet that bear on the grass (marked
//   in the bake) are pinned to their spots while that happens, and a foot left too far behind takes a step.
import * as THREE from 'three';
import { BONES, GETUPS } from './anim/getups.js';
import { poseRagdoll } from './ragdoll.js';

export const GETUP_TIME = 1.5;

const NB = BONES.length, HI = BONES.indexOf('hips'), slerpFlat = THREE.Quaternion.slerpFlat;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const PAIR = BONES.map(n => (/[LR]$/.test(n) ? BONES.indexOf(n.slice(0, -1) + (n.endsWith('L') ? 'R' : 'L')) : -1));
const UP = new THREE.Vector3(0, 1, 0), turnOf = a => Math.atan2(Math.sin(a), Math.cos(a));

// Each kind: its clip, and how the recording's seconds are laid over the get-up: [share of GETUP_TIME, seconds
// into the recording]. The people recorded took 2.7 to 4.3 s; a footballer is up in about a second and a half,
// so the slow parts (lying there, the sit-up, the roll) are squeezed most and the push up off the grass least.
// turn: the shares of the get-up between which he is brought round to the sim's spot and facing.
const KINDS = {
  back: { clip: GETUPS.back, keys: [[0, 0.1], [0.12, 0.55], [0.4, 2.2], [0.68, 3.25], [1, 4.25]], turn: [0.34, 0.82] },
  front: { clip: GETUPS.front, keys: [[0, 0], [0.14, 0.3], [0.45, 1.15], [0.72, 1.85], [1, 2.6]], turn: [0.3, 0.82] },
  side: { clip: GETUPS.side, keys: [[0, 0], [0.12, 0.45], [0.36, 1.75], [0.66, 2.95], [1, 3.9]], turn: [0.36, 0.82] },
};
const IN = 0.26, OUT = 0.66;          // shares of the get-up: easing in from the ragdoll's pose until IN, into the standing pose from OUT
for (const k of Object.values(KINDS)) {
  const c = k.clip;
  if (!(c.q instanceof Float32Array)) { c.q = new Float32Array(c.q); c.h = new Float32Array(c.h); }
  const q = new THREE.Quaternion().fromArray(c.q, ((c.n - 1) * NB + HI) * 4), f = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  k.face = Math.atan2(f.x, f.z);                                  // which way he faces as the recording ends
  k.end = [c.h[(c.n - 1) * 3], c.h[(c.n - 1) * 3 + 2]];            // and where his hips are then
}
// seconds into the recording at share f of the get-up: a smooth curve through the keys that never runs backwards
function warp(keys, f) {
  let i = 0;
  while (i < keys.length - 2 && f > keys[i + 1][0]) i++;
  const slope = j => (keys[j + 1][1] - keys[j][1]) / (keys[j + 1][0] - keys[j][0]);
  const tan = j => (j === 0 ? slope(0) : j === keys.length - 1 ? slope(j - 1) : 2 * slope(j - 1) * slope(j) / (slope(j - 1) + slope(j)));
  const [x0, y0] = keys[i], [x1, y1] = keys[i + 1], h = x1 - x0, s = clamp((f - x0) / h, 0, 1), s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * tan(i) + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * tan(i + 1);
}

// The recording's pose `u` seconds in → out { q, h, c }, seen in a mirror down his middle if asked (left and
// right change places, every turn is reflected).
const newPose = () => ({ q: new Float32Array(NB * 4), h: [0, 0, 0], c: 0 }), tmpP = newPose();
function sample(clip, u, mirror, out) {
  const f = clamp(u * clip.hz, 0, clip.n - 1.001), i0 = Math.floor(f), k = f - i0, o = mirror ? tmpP : out;
  for (let b = 0; b < NB; b++) slerpFlat(o.q, b * 4, clip.q, (i0 * NB + b) * 4, clip.q, ((i0 + 1) * NB + b) * 4, k);
  for (let j = 0; j < 3; j++) out.h[j] = clip.h[i0 * 3 + j] + (clip.h[i0 * 3 + 3 + j] - clip.h[i0 * 3 + j]) * k;
  out.c = clip.c[k < 0.5 ? i0 : i0 + 1];
  if (mirror) {
    for (let b = 0; b < NB; b++) { const d = (PAIR[b] < 0 ? b : PAIR[b]) * 4; out.q[d] = o.q[b * 4]; out.q[d + 1] = -o.q[b * 4 + 1]; out.q[d + 2] = -o.q[b * 4 + 2]; out.q[d + 3] = o.q[b * 4 + 3]; }
    out.h[0] = -out.h[0]; out.c = (out.c & 1) << 1 | (out.c & 2) >> 1 | (out.c & 4) << 1 | (out.c & 8) >> 1;
  }
  return out;
}

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), v5 = new THREE.Vector3();
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion(), qy = new THREE.Quaternion();
const P0 = newPose();

// The sim says he gets up: read how the ragdoll lies, pick the recording, end the ragdoll. Returns where and
// which way the recording alone would bring him up ({ x, z, fx, fz }): a sim that takes those for his spot
// and facing gets the get-up with nothing added.
export function startGetUp(m) {
  const bn = m.bone;
  poseRagdoll(m);                                  // (the root is at the origin, unturned: the hips' own place and turn are the world's)
  m.root.updateMatrixWorld(true);
  const chest = bn.chest.getWorldQuaternion(q1), fwd = v1.set(0, 0, 1).applyQuaternion(chest), left = v2.set(1, 0, 0).applyQuaternion(chest);
  const head = bn.head.getWorldPosition(v3).sub(bn.hips.getWorldPosition(v4));
  const kind = fwd.y > 0.5 ? 'back' : fwd.y < -0.5 ? 'front' : 'side', K = KINDS[kind];
  const G = { kind, t: 0, yaw: Math.atan2(head.x, head.z), q: {}, hq: bn.hips.quaternion.clone(), hp: bn.hips.position.clone(), pins: {}, aq: {}, ap: {} };
  for (const n of BONES) G.q[n] = bn[n].quaternion.clone();
  // on his side: the recording lies on its left. On his back or front: whichever way round is nearer to how his limbs fell.
  if (kind === 'side') G.mirror = left.y > 0;
  else {
    const far = mir => { sample(K.clip, K.keys[0][1], mir, P0); let s = 0; for (let b = 0; b < NB; b++) if (b !== HI) s += q1.fromArray(P0.q, b * 4).angleTo(G.q[BONES[b]]); return s; };
    G.mirror = far(true) < far(false);
  }
  sample(K.clip, K.keys[0][1], G.mirror, P0);
  qy.setFromAxisAngle(UP, G.yaw);
  v1.set(P0.h[0], 0, P0.h[2]).applyQuaternion(qy);
  G.o = [G.hp.x - v1.x, G.hp.z - v1.z];              // where the recording's origin goes on the pitch
  for (const k of ['footL', 'footR', 'handL', 'handR']) G.pins[k] = { on: false, pos: new THREE.Vector3(), from: new THREE.Vector3(), step: 1, off: new THREE.Vector3(), rel: 1 };
  m.rag = null; m.getUp = G;
  const face = G.yaw + (G.mirror ? -K.face : K.face);
  v1.set(G.mirror ? -K.end[0] : K.end[0], 0, K.end[1]).applyQuaternion(qy);
  return { x: G.o[0] + v1.x, z: G.o[1] + v1.z, fx: Math.sin(face), fz: Math.cos(face) };
}

/* ---------- limbs to a spot ---------- */

// Bends a limb (upper bone, lower bone, the joint at its end) so the end joint is at `target` (world), changing
// as little as possible: the knee or elbow opens or closes in the plane it is already bent in, then the whole
// limb swings from the hip or shoulder. A limb already there is left exactly as it was. hinge: -1 a leg, 1 an arm;
// floor: the lowest the middle joint may be; pole (world, optional): the way the knee or elbow should point.
const H = new THREE.Vector3(), K0 = new THREE.Vector3(), Kn = new THREE.Vector3(), A = new THREE.Vector3(), ax = new THREE.Vector3(), R = new THREE.Quaternion();
function turnWorld(bone, r) {          // turn a bone by r (a world rotation) about its own joint
  bone.parent.getWorldQuaternion(q2);
  bone.quaternion.premultiply(q3.copy(q2).invert().multiply(r).multiply(q2));
  bone.updateWorldMatrix(false, true);
}
export function reach(up, lo, end, target, hinge, floor = -9, pole = null) {
  up.getWorldPosition(H); lo.getWorldPosition(Kn); end.getWorldPosition(A);
  if (A.distanceToSquared(target) < 1e-10 && Kn.y >= floor && !pole) return;
  const L1 = Kn.distanceTo(H), L2 = A.distanceTo(Kn), d = clamp(target.distanceTo(H), Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.003);
  const inner = len => Math.acos(clamp((L1 * L1 + L2 * L2 - len * len) / (2 * L1 * L2), -1, 1));
  v1.subVectors(H, Kn); v2.subVectors(A, Kn);
  // (a limb that is all but straight has no plane of its own: its hinge decides, a knee folding back, an elbow forward)
  ax.crossVectors(v1, v2).addScaledVector(v3.set(hinge, 0, 0).applyQuaternion(lo.getWorldQuaternion(q1)), 0.012).normalize();
  turnWorld(lo, R.setFromAxisAngle(ax, inner(d) - inner(A.distanceTo(H))));
  end.getWorldPosition(A);
  turnWorld(up, R.setFromUnitVectors(v1.subVectors(A, H).normalize(), v2.subVectors(target, H).normalize()));
  // the knee or elbow stays on the side it was on: swung round the line from hip to foot (shoulder to hand), which moves
  // neither end, to as near where it was as it can be (a folded limb would otherwise be thrown about by a small reach)
  if (pole) K0.copy(pole); else K0.copy(Kn).sub(H);
  lo.getWorldPosition(Kn); end.getWorldPosition(A);
  ax.subVectors(A, H).normalize();
  v1.subVectors(Kn, H); v1.addScaledVector(ax, -v1.dot(ax)); K0.addScaledVector(ax, -K0.dot(ax));
  if (v1.lengthSq() > 1e-6 && K0.lengthSq() > 1e-6) turnWorld(up, R.setFromAxisAngle(ax, Math.atan2(ax.dot(v2.crossVectors(v1, K0)), v1.dot(K0))));
  // and one left under the grass is swung up the same way
  lo.getWorldPosition(Kn);
  if (Kn.y < floor) {
    ax.subVectors(target, H).normalize();
    v1.subVectors(Kn, H); v1.addScaledVector(ax, -v1.dot(ax));              // the joint, out from that line
    v2.crossVectors(ax, v1);
    const need = floor - (Kn.y - v1.y), top = Math.hypot(v1.y, v2.y), best = Math.atan2(v2.y, v1.y);
    if (top > 1e-5) {
      // two ways up when there is room to spare: the nearer; from right underneath, the one that leaves a knee more to his front, an elbow more to his back
      let by = best;
      if (need < top) {
        const d = Math.acos(need / top), fw = v3.set(0, 0, -hinge).applyQuaternion(up.parent.getWorldQuaternion(q1));
        const front = a => (v1.dot(fw) * Math.cos(a) + v2.dot(fw) * Math.sin(a));
        by = Math.abs(best) < 2.4 ? best - Math.sign(best) * d : front(best - d) > front(best + d) ? best - d : best + d;
      }
      turnWorld(up, R.setFromAxisAngle(ax, by));
    }
  }
}
// q with the sign that keeps it next to what it was last frame (store[n]); returns the stored copy
function same(store, n, q) {
  const o = store[n];
  if (!o) return (store[n] = q.clone());
  return o.dot(q) < 0 ? o.set(-q.x, -q.y, -q.z, -q.w) : o.copy(q);
}
// from a to b by k along the arc between them as given: never the other way round, unlike Quaternion.slerp
function blend(a, b, k, out) {
  const cos = clamp(a.dot(b), -1, 1), th = Math.acos(cos), sn = Math.sin(th);
  const wa = sn < 1e-4 ? 1 - k : Math.sin((1 - k) * th) / sn, wb = sn < 1e-4 ? k : Math.sin(k * th) / sn;
  return out.set(a.x * wa + b.x * wb, a.y * wa + b.y * wb, a.z * wa + b.z * wb, a.w * wa + b.w * wb).normalize();
}
const LIMB = { footL: ['upperLegL', 'lowerLegL', 'footL'], footR: ['upperLegR', 'lowerLegR', 'footR'], handL: ['upperArmL', 'foreArmL', 'handL'], handR: ['upperArmR', 'foreArmR', 'handR'] };
const BIT = { footL: 1, footR: 2, handL: 4, handR: 8 };
// the lowest a joint's middle may be over the grass (m): what is round it has to fit under it
const FLOOR = { hips: 0.1, spine: 0.1, chest: 0.11, head: 0.11, upperArmL: 0.07, upperArmR: 0.07, foreArmL: 0.045, foreArmR: 0.045, lowerLegL: 0.055, lowerLegR: 0.055 };
const ENDS = { handL: 0.035, handR: 0.035, footL: 0.045, footR: 0.045 }, TOE = 0.02;
const wq = new THREE.Quaternion(), want = new THREE.Vector3(), tgt = new THREE.Vector3(), rootQ = new THREE.Quaternion(), aHips = new THREE.Vector3();
const aAnk = { footL: new THREE.Vector3(), footR: new THREE.Vector3() };

// Every frame of the get-up, after placeModel() and animate() have stood him on the sim's spot. t: seconds
// since startGetUp. Starts on the ragdoll's pose, ends on the animation's (and then lets go: m.getUp = null).
export function poseGetUp(m, p, t) {
  const G = m.getUp, bn = m.bone;
  if (!G) return;
  if (t >= GETUP_TIME) { m.getUp = null; return; }
  const K = KINDS[G.kind], f = clamp(t / GETUP_TIME, 0, 1), dt = Math.max(0, t - G.t);
  G.t = t;
  // where the animation has him: every bone, the root's turn, his hips and ankles on the pitch
  m.root.updateMatrixWorld(true);
  for (const n of BONES) { (G.aq[n] || (G.aq[n] = new THREE.Quaternion())).copy(bn[n].quaternion); (G.ap[n] || (G.ap[n] = new THREE.Vector3())).copy(bn[n].position); }
  m.root.getWorldQuaternion(rootQ);
  bn.hips.getWorldPosition(aHips); bn.footL.getWorldPosition(aAnk.footL); bn.footR.getWorldPosition(aAnk.footR);
  const rootYaw = Math.atan2(2 * (rootQ.w * rootQ.y + rootQ.x * rootQ.z), 1 - 2 * (rootQ.y * rootQ.y + rootQ.x * rootQ.x));

  // the recording, laid where he lay; brought round to where and how the animation stands him as he comes up
  const P = sample(K.clip, warp(K.keys, f), G.mirror, P0), e = ease((f - K.turn[0]) / (K.turn[1] - K.turn[0]));
  // (which way round he turns is settled once: the nearer way can flip while the animation is still easing his heading)
  const yaw1 = rootYaw - (G.mirror ? -K.face : K.face);
  G.turn = G.turn === undefined ? turnOf(yaw1 - G.yaw) : G.turn + turnOf(yaw1 - G.yaw1);
  G.yaw1 = yaw1;
  const yaw = G.yaw + G.turn * e;
  v1.set(P.h[0], 0, P.h[2]).applyAxisAngle(UP, G.yaw); v1.x += G.o[0]; v1.z += G.o[1];
  v2.set(P.h[0] - (G.mirror ? -K.end[0] : K.end[0]), 0, P.h[2] - K.end[1]).applyAxisAngle(UP, G.yaw + G.turn); v2.x += aHips.x; v2.z += aHips.z;
  want.lerpVectors(v1, v2, e); want.y = P.h[1];
  wq.setFromAxisAngle(UP, yaw).multiply(q1.fromArray(P.q, HI * 4));
  // easing in from the ragdoll's pose, and out into the standing one. Each bone goes one way round from start
  // to finish (blend() and same() below): the nearer way can change from frame to frame, and the bone would jump.
  const w0 = ease(f / IN), w1 = ease((f - OUT) / (1 - OUT)), first = !G.was;
  if (first) { G.was = {}; G.anim = {}; G.side = {}; }
  q2.copy(rootQ).invert();
  for (let b = 0; b < NB; b++) {
    const n = BONES[b], bone = bn[n], hips = b === HI;
    // (the hips are blended as they are on the pitch, then put under the root as the animation placed it)
    const c = same(G.was, n, hips ? wq : q1.fromArray(P.q, b * 4)), from = hips ? G.hq : G.q[n], a = same(G.anim, n, hips ? q1.copy(rootQ).multiply(G.aq[n]) : G.aq[n]);
    if (first && from.dot(c) < 0) from.set(-from.x, -from.y, -from.z, -from.w);
    blend(from, c, w0, bone.quaternion);
    if (w1 > 0) {
      if (!G.side[n]) G.side[n] = bone.quaternion.dot(a) < 0 ? -1 : 1;
      blend(bone.quaternion, G.side[n] < 0 ? q3.set(-a.x, -a.y, -a.z, -a.w) : a, w1, bone.quaternion);
    }
    if (hips) bone.quaternion.premultiply(q2);
    if (!hips) bone.position.copy(bone.userData.rest).lerp(G.ap[n], w1);
  }
  want.copy(v1.copy(G.hp).lerp(want, w0));
  bn.hips.position.copy(m.root.worldToLocal(want)).lerp(G.ap.hips, w1);
  m.root.updateMatrixWorld(true);
  // nothing of his trunk, head, elbows or knees under the grass: the whole of him comes up by what is short
  // (none of this on the very first frame, which is the ragdoll's pose as it lay: `sure` comes in over the next three)
  const sure = ease(f / 0.03);
  let lift = 0;
  for (const n in FLOOR) lift = Math.max(lift, (FLOOR[n] - bn[n].getWorldPosition(v1).y) * sure);
  if (lift > 0) { bn.hips.position.y += lift; m.root.updateMatrixWorld(true); }

  // hands and feet that bear on the grass stay on their spots
  const last = f > OUT, settle = f > 0.82, closing = ease((f - 0.95) / 0.045);
  for (const k in LIMB) {
    const pin = G.pins[k], [un, ln, en] = LIMB[k], up = bn[un], lo = bn[ln], end = bn[en], foot = k[0] === 'f';
    end.getWorldPosition(want);                                 // where the pose alone has it
    end.getWorldQuaternion(wq);
    const stepping = pin.step < 1, other = foot && G.pins[k === 'footL' ? 'footR' : 'footL'].step < 1;
    let bears = w0 >= 1 && !!(P.c & BIT[k]) && (foot || !last);       // (his hands are done with the grass once he is coming to his feet)
    if (bears && !pin.on && pin.rel >= 1) { pin.on = true; pin.pos.copy(want); pin.pos.y = Math.max(pin.pos.y, ENDS[k]); pin.step = 1; }
    if (foot && last) {
      bears = true;
      if (!pin.on) { pin.on = true; pin.pos.copy(want); pin.step = 1; }
      if (settle) want.copy(aAnk[k]); else want.y = aAnk[k].y;
    }
    else if (!bears && pin.on) { pin.on = false; pin.off.copy(pin.pos).sub(want); pin.rel = 0; pin.step = 1; }
    if (pin.on) {
      const far = pin.pos.distanceTo(want);
      // (a folded leg is thrown about by a foot a little out of place, so the further he is down the sooner it steps)
      const room = foot ? Math.min(1, want.distanceTo(up.getWorldPosition(v1)) / 0.6) : 1;
      if (!stepping && (!other || far > 0.3 * room) && far > (foot ? (settle ? 0.025 : last ? 0.12 : 0.18) * room : 0.16)) { pin.step = 0; pin.from.copy(pin.pos); }      // (one foot at a time, unless it is being left behind)
      if (pin.step < 1) {
        pin.step = Math.min(1, pin.step + dt / 0.13);
        const s = ease(pin.step);
        pin.pos.lerpVectors(pin.from, want, s); pin.pos.y += Math.sin(Math.PI * s) * Math.min(0.06, 0.02 + far * 0.2);
      }
      if (foot && closing > 0) pin.pos.lerp(want, closing);
      tgt.copy(pin.pos);
    } else {
      if (pin.rel < 1) pin.rel = Math.min(1, pin.rel + dt / 0.14);
      tgt.copy(want).addScaledVector(pin.off, 1 - ease(pin.rel));
    }
    const min = ENDS[k] * sure;
    if (tgt.y < min) tgt.y = min;
    reach(up, lo, end, tgt, foot ? -1 : 1, (FLOOR[ln] - 0.006) * sure);      // (a little under what the body was lifted to: a knee resting on the grass is left alone)
    // the hand or foot keeps its own turn whatever the limb did, and a boot's toes stay out of the grass
    end.parent.getWorldQuaternion(q2); end.quaternion.copy(q2.invert().multiply(wq)); end.updateWorldMatrix(false, true);
    if (foot) {
      const toe = bn['toe' + k.slice(-1)].getWorldPosition(v3), ank = end.getWorldPosition(v4), low = TOE * sure - toe.y;
      if (low > 0) {
        const d = v5.subVectors(toe, ank), l = d.length();
        v3.copy(d); v3.y += low; const flat = Math.hypot(v3.x, v3.z), keep = Math.sqrt(Math.max(1e-6, l * l - v3.y * v3.y));
        if (flat > 1e-3) { v3.x *= keep / flat; v3.z *= keep / flat; turnWorld(end, R.setFromUnitVectors(d.normalize(), v3.normalize())); }
      }
    }
  }
}
