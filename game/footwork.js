// Footwork where a run changes: a cut and a stop. The sim only changes a man's velocity (18 to 24 m/s2 toward
// the one he wants); the page sees that happen frame by frame and this is what his feet do about it.
//
//   cut    his velocity is being pushed sideways hard: the foot on the outside of the turn is put down wide of
//          his body, away from where he is going (33 cm out from under the hip, the width measured in CMU 127_13
//          'Run Side Step'), and stays on that spot of the pitch while he is being turned; his hips drop and his
//          trunk and arms go into the new direction (recorded: that take's plant step, cutA), and his stride is
//          re-timed so the push comes off that foot. When the push ends the foot leaves the ground into his run.
//   stop   he is braking hard out of a run: the foot in the air comes down ahead of his hips (up to 0.42 m, as in
//          127_17 'Run Stop Run'), the other follows it ahead on the other side if he is still moving, each stays
//          where it lands while his body comes up over it, and when he has stopped a foot that isn't where he
//          stands is picked up and put there: a settling step. Nothing slides. Pelvis sink, trunk and arms:
//          recorded (that take's two braking steps and coming upright, stopC).
//
// Recorded: the pelvis's sink and tip, the trunk, the arms. Built: where each foot goes and when (from where the
// body will be, by his speed and the sim's braking), the steps' arcs. The feet are held in the pitch's own space.
// Not for your own first-person legs, a man on the ball or striking it, a beaten defender or the keeper.
// Model space: +z the way he faces, +x his left. m.fw holds the state.
import * as THREE from 'three';
import { P } from './body.js';
import { CLIPS, BONES, applyPose } from './mocap.js';
import { sampleOnce, newOnce } from './keepercap.js';
import { ankleOf, footOf, reachLeg, aimFoot } from './legik.js';

export const FOOT = {
  cutLat: 9, cutSpeed: 2.4, cutWide: 0.33, cutAhead: 0.1, cutStep: 0.07, cutMax: 0.42, cutEnd: 4, cutSink: 0.08, cutReach: 0.56,      // m/s2 across his way to begin; m/s; m out from under the hip; m along his way; s to get the foot there; s at most; m/s2 it ends under; m the hips drop
  stopDecel: 8, stopSpeed: 2.2, ahead: 0.1, aheadMax: 0.42, side: 0.11, step: 0.15, settle: 0.2, lift: 0.07, far: 0.06, reach: 0.74, brake: 18,   // m/s2; m/s; s of his speed the foot lands ahead; m; m either side of his line; s a braking step; s a settling step; m; m off its place before a standing foot steps; m from the hip before a foot must be picked up; m/s2 the sim brakes at
};
const REACH = 0.835, ANK = P.ankleY, NB = BONES.length, HI = BONES.indexOf('hips');
const TRUNK = new Set(['spine', 'chest', 'clavicleL', 'upperArmL', 'foreArmL', 'clavicleR', 'upperArmR', 'foreArmR']);
const PAIR = BONES.map(n => (/[LR]$/.test(n) ? BONES.indexOf(n.slice(0, -1) + (n.endsWith('L') ? 'R' : 'L')) : -1));
const smooth = x => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); }, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const q = new THREE.Quaternion(), q0 = new THREE.Quaternion(), ID = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ'), v3 = new THREE.Vector3(), hj = new THREE.Vector3();
const AV = { L: new THREE.Vector3(), R: new THREE.Vector3() }, AQ = { L: new THREE.Quaternion(), R: new THREE.Quaternion() };
function mirror(src, out) {
  for (let b = 0; b < NB; b++) { const o = (PAIR[b] < 0 ? b : PAIR[b]) * 4; out.q[o] = src.q[b * 4]; out.q[o + 1] = -src.q[b * 4 + 1]; out.q[o + 2] = -src.q[b * 4 + 2]; out.q[o + 3] = src.q[b * 4 + 3]; }
  out.h[0] = -src.h[0]; out.h[1] = src.h[1]; out.h[2] = src.h[2];
  return out;
}
const REC = Object.fromEntries(['cutA', 'stopC'].filter(n => CLIPS[n]).map(n => [n, { c: CLIPS[n], len: (CLIPS[n].n - 1) / CLIPS[n].hz, first: sampleOnce(CLIPS[n], 0, newOnce()) }]));
const P1 = newOnce(), P2 = newOnce();

const foot = () => ({ lock: false, wx: 0, wz: 0, yaw: 0, step: null, done: false });
const stateOf = m => m.fw || (m.fw = { mode: null, t: 0, k: 0, side: 0, out: 'R', sharp: 0, vx: null, vz: 0, ax: 0, az: 0, top: 0, still: 0, rec: null, rt: 0, rk: 0, flip: false, L: foot(), R: foot() });

// Call after the legs are posed (the stride, the slide) and before a boot is sent to the ball. p: the sim's player.
export function footwork(m, bn, p, g, dt) {
  const S = stateOf(m), busy = m.plain || m.firstPerson || (m.onBallK || 0) > 0.5 || m.strike || m.beat || m.special || m.cheer || p.role === 'gk' || (m.lunge || 0) > 0;
  const s = Math.hypot(p.vx, p.vz);
  if (S.vx === null) { S.vx = p.vx; S.vz = p.vz; }
  let along = 0, lat = 0;
  if (dt > 0) {
    // how his velocity is being changed (m/s2), eased over a couple of frames: along his way (- braking) and across it (+ to his left)
    const e = Math.min(1, dt * 30);
    S.ax += ((p.vx - S.vx) / dt - S.ax) * e; S.az += ((p.vz - S.vz) / dt - S.az) * e;
    const ux = s > 0.3 ? p.vx / s : Math.sin(m.root.rotation.y), uz = s > 0.3 ? p.vz / s : Math.cos(m.root.rotation.y);
    along = S.ax * ux + S.az * uz; lat = S.ax * uz - S.az * ux;      // (his left across his way is (uz, -ux))
    S.cool = Math.max(0, (S.cool || 0) - dt);
    S.vx = p.vx; S.vz = p.vz;
    S.top = Math.max(s, S.top - dt * 6);                  // how fast he was going a moment ago
    S.still = s < 0.3 ? S.still + dt : 0;
  }
  if (busy) { if (S.mode || S.k > 0) { S.mode = null; S.k = 0; S.rk = 0; S.L = foot(); S.R = foot(); } return; }
  const rp = m.root.position, ry = m.root.rotation.y, c = Math.cos(ry), sn = Math.sin(ry);
  const toW = (mx, mz, out) => { out.x = rp.x + mx * c + mz * sn; out.z = rp.z - mx * sn + mz * c; return out; };
  const toM = (wx, wz, out) => { const dx = wx - rp.x, dz = wz - rp.z; out.x = dx * c - dz * sn; out.z = dx * sn + dz * c; return out; };
  const h = bn.hips;
  for (const n of 'LR') { ankleOf(bn, n, AV[n]); footOf(bn, n, AQ[n]); }
  const yawOf = n => { v3.set(0, 0, 1).applyQuaternion(AQ[n]); return Math.atan2(v3.x, v3.z) + ry; };
  const lockAt = (n, wx, wz, yaw) => { const F = S[n]; F.lock = true; F.step = null; F.wx = wx; F.wz = wz; F.yaw = yaw; };
  const stepTo = (n, wx, wz, T, lift, follow = false) => { const F = S[n], W = toW(AV[n].x, AV[n].z, {}); const fx = F.lock ? F.wx : W.x, fz = F.lock ? F.wz : W.z; F.step = { t: 0, T, fx, fz, fy: F.lock ? ANK : AV[n].y, tx: wx, tz: wz, lift, follow, yaw0: F.lock ? F.yaw : yawOf(n) }; F.lock = false; };

  // let go: the foot is carried from where it was held back into the pose's own path
  const letGo = (n, T = 0.09) => { stepTo(n, 0, 0, T, 0.03, true); S[n].step.free = true; };

  // --- beginnings ---
  if (dt > 0 && !S.mode && g.mv > 0.5) {
    if (!S.cool && s > FOOT.cutSpeed && Math.abs(lat) > FOOT.cutLat && Math.abs(lat) > Math.abs(along) * 0.7 && (g.jk || 0) < 0.5) {
      // a cut: the outside foot goes down wide, away from the way he is being pushed, a little ahead along his old line
      const side = Math.sign(lat), n = side > 0 ? 'R' : 'L', ux = p.vx / s, uz = p.vz / s, T = FOOT.cutStep;
      S.mode = 'cut'; S.t = 0; S.cool = 0.55; S.side = side; S.out = n; S.sharp = 0.5; S.L = foot(); S.R = foot();
      // (his left across his way is (uz, -ux) in the world; the outside is the other way from the push)
      const ox = -side * uz, oz = side * ux, hx = rp.x + p.vx * T, hz = rp.z + p.vz * T;
      stepTo(n, hx + ox * (FOOT.cutWide + 0.09) + ux * FOOT.cutAhead, hz + oz * (FOOT.cutWide + 0.09) + uz * FOOT.cutAhead, T, 0.03);
      S[n].step.yaw1 = Math.atan2(ux, uz) + side * 0.25;
      // his stride is taken to that foot's stance (right foot planted round phase 0, left round half way): the push comes off it
      m.land = { at: (n === 'R' ? 0 : Math.PI) - 0.35, t: 0, ease: 0.1 };
      if (REC.cutA) { S.rec = 'cutA'; S.rt = 0.08; S.flip = side < 0; }
    } else if (S.top > FOOT.stopSpeed && along < -FOOT.stopDecel && Math.abs(lat) < -along * 0.6) {
      S.mode = 'stop'; S.t = 0; S.L = foot(); S.R = foot(); S.next = null;
      // the lower foot is the one on the ground: it stays where it is; the other comes down ahead of him
      const low = AV.L.y <= AV.R.y ? 'L' : 'R', air = low === 'L' ? 'R' : 'L';
      if (AV[low].y < ANK + 0.12) { const W = toW(AV[low].x, AV[low].z, {}); lockAt(low, W.x, W.z, yawOf(low)); }
      S.next = air;
      if (REC.stopC) { S.rec = 'stopC'; S.rt = 0; S.flip = false; }
    }
  }
  if (S.mode) S.t += dt;
  S.k = clamp(S.k + (S.mode || S.L.step || S.R.step ? dt / 0.05 : -dt / 0.14), 0, 1);
  if (S.k <= 0 && !S.mode) { if (S.L.lock || S.R.lock || S.L.step || S.R.step) { S.L = foot(); S.R = foot(); } return; }

  // --- a cut: held while he is being turned, then let go into the run ---
  if (S.mode === 'cut') {
    S.sharp = Math.max(S.sharp, clamp(Math.abs(lat) / 16, 0.4, 1) * smooth(S.t / 0.08));
    const F = S[S.out], gone = F.lock && Math.hypot(toM(F.wx, F.wz, v3).x - (S.out === 'L' ? P.hipX : -P.hipX), v3.z) > FOOT.cutReach;
    if ((S.t > FOOT.cutStep + 0.05 && Math.abs(lat) < FOOT.cutEnd) || S.t > FOOT.cutMax || gone || s < 1) { S.mode = null; if (F.lock) letGo(S.out, 0.12); }
  }
  // --- a stop: braking steps while he still moves, then a settling step for a foot that isn't where he stands ---
  if (S.mode === 'stop') {
    const moving = s > 0.5, ux = moving ? p.vx / s : 0, uz = moving ? p.vz / s : 0, a = FOOT.brake;
    const stepping = S.L.step || S.R.step;
    if (moving && along > 2 && S.t > 0.1) S.mode = null;                          // he is off again
    else if (!stepping) {
      if (moving) {
        // which foot next: the one asked for, else one the body has left behind
        let n = S.next;
        for (const f of 'LR') if (S[f].lock) { toM(S[f].wx, S[f].wz, v3); const bx = v3.x * (ux * c - uz * sn) + v3.z * (ux * sn + uz * c); if (bx < -0.3 || Math.hypot(v3.x, v3.z) > FOOT.reach) { if (!n && sLeft(s) > 0.25) n = f; else if (f !== n) letGo(f); } }
        if (n) {
          // it lands ahead of where his hips will be as it lands, by a tenth of a second of the speed he will still have
          const T = FOOT.step, sT = Math.max(0, s - a * T), d = s > a * T ? s * T - 0.5 * a * T * T : s * s / (2 * a), ah = clamp(FOOT.ahead * sT + 0.12, 0.12, FOOT.aheadMax), sd = (n === 'L' ? 1 : -1) * FOOT.side;
          stepTo(n, rp.x + ux * (d + ah) + uz * sd, rp.z + uz * (d + ah) - ux * sd, T, FOOT.lift + 0.03);
          S[n].step.yaw1 = Math.atan2(ux, uz) + (n === 'L' ? 0.12 : -0.12);
          S.next = sT > 1.2 ? (n === 'L' ? 'R' : 'L') : null;
        } else for (const f of 'LR') if (!S[f].lock && AV[f].y < ANK + 0.03) { const W = toW(AV[f].x, AV[f].z, {}); lockAt(f, W.x, W.z, yawOf(f)); }
      } else {
        // standing: a foot that is not where he stands steps there (the worse one first); with both there it is over
        let worst = null, far = FOOT.far;
        for (const f of 'LR') { const F = S[f]; if (!F.lock) { const W = toW(AV[f].x, AV[f].z, {}); if (AV[f].y < ANK + 0.05) lockAt(f, W.x, W.z, yawOf(f)); continue; } toM(F.wx, F.wz, v3); const d = Math.hypot(v3.x - AV[f].x, v3.z - AV[f].z); if (d > far) { far = d; worst = f; } }
        if (worst && g.mv < 0.3 && !S[worst].done) { const W = toW(AV[worst].x, AV[worst].z, {}); stepTo(worst, W.x, W.z, FOOT.settle, FOOT.lift, true); S[worst].done = true; }
        else if (S.L.lock && S.R.lock && g.mv < 0.05 && (!worst || S[worst].done)) S.mode = null;
      }
    }
  }
  // --- the feet: stepping, held, or the pose's own ---
  let top = 9; const h0 = h.position.y;
  for (const n of 'LR') {
    const F = S[n], a = AV[n];
    if (F.step) {
      const st = F.step; st.t += dt;
      if (st.follow) { const W = toW(a.x, a.z, {}); st.tx = W.x; st.tz = W.z; st.yaw1 = yawOf(n); }
      const u = Math.min(1, st.t / st.T), e = smooth(u), wx = st.fx + (st.tx - st.fx) * e, wz = st.fz + (st.tz - st.fz) * e, yaw = st.yaw0 + wrap((st.yaw1 ?? st.yaw0) - st.yaw0) * e;
      toM(wx, wz, v3); a.x += (v3.x - a.x) * S.k; a.z += (v3.z - a.z) * S.k;
      a.y += (st.fy + ((st.free ? a.y : ANK) - st.fy) * e + st.lift * Math.sin(Math.PI * u) - a.y) * S.k;
      AQ[n].slerp(q.setFromEuler(eul.set(0.25 * Math.sin(Math.PI * u) * (st.follow ? 1 : -0.6), yaw - ry, 0)), S.k * (st.free ? 1 - e : 1));
      if (u >= 1) { const done = F.done; if (st.free) F.step = null; else lockAt(n, st.tx, st.tz, st.yaw1 ?? st.yaw0); F.done = done; }
    } else if (F.lock) {
      toM(F.wx, F.wz, v3); a.x += (v3.x - a.x) * S.k; a.z += (v3.z - a.z) * S.k; a.y += (ANK - a.y) * S.k;
      AQ[n].slerp(q.setFromEuler(eul.set(0, F.yaw - ry, 0)), S.k);
    }
    hj.set(n === 'L' ? P.hipX : -P.hipX, -0.02, 0).applyQuaternion(h.quaternion);
    const dx = a.x - h.position.x - hj.x, dz = a.z - h.position.z - hj.z;
    top = Math.min(top, a.y - hj.y + Math.sqrt(Math.max(0.01, REACH * REACH - dx * dx - dz * dz)));
  }
  // --- the pelvis: the recording's sink and tip since it began, and never higher than both legs reach ---
  S.rk = clamp(S.rk + (S.mode ? dt / 0.08 : -dt / 0.25), 0, 1);
  if (S.rec && REC[S.rec] && S.rk > 0) {
    const R = REC[S.rec], cut = S.rec === 'cutA', w = S.rk * (cut ? S.sharp : clamp(S.top / 4, 0.5, 1));
    S.rt = Math.min(R.len, S.rt + dt * (cut ? 1 : 1.25));
    S.pose = sampleOnce(R.c, S.rt, P1); if (S.flip) S.pose = mirror(P1, P2);
    q.fromArray(S.pose.q, HI * 4).multiply(q0.fromArray(R.first.q, HI * 4).invert());
    if (S.flip) q.set(q.x, -q.y, -q.z, q.w);
    // (only its tip and roll: which way he faces is the sim's)
    eul.setFromQuaternion(q, 'YXZ'); eul.y = 0;
    h.quaternion.multiply(q0.copy(ID).slerp(q.setFromEuler(eul), w * 0.6));
    h.position.y += clamp(S.pose.h[1] - R.first.h[1], -0.14, 0.02) * w * (cut ? 0.6 : 0.8) - (cut ? FOOT.cutSink * w * smooth(S.t / 0.08) * (S.mode ? 1 : S.rk) : 0);
    S.w = w;
  } else S.w = 0;
  h.position.y = Math.max(Math.min(h.position.y, top), h0 - 0.1);
  for (const n of 'LR') { reachLeg(bn, n, AV[n]); aimFoot(bn, n, AQ[n]); }
}
const wrap = a => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
// how far he still goes before the sim has stopped him (m)
const sLeft = s => s * s / (2 * FOOT.brake);

// The trunk and arms through a cut or a stop: the recording's. Call after the upper body and its layers are posed.
export function footBody(m, bn) {
  const S = m.fw;
  if (!S || !(S.w > 0) || !S.pose) return;
  applyPose(bn, S.pose, S.w * 0.7, TRUNK);
}
