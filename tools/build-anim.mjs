// Bakes motion-capture clips for the players (game/assets/anim/clips.js) from BVH files of the CMU
// Graphics Lab Motion Capture Database (mocap.cs.cmu.edu; free for any use, see the credit in the output).
// The BVH files themselves are not in the repo. Get the ones listed in CLIPS from the mirror:
//   git clone --filter=blob:none --no-checkout --depth 1 https://github.com/una-dinosauria/cmu-mocap
//   git -C cmu-mocap show HEAD:data/035/35_01.bvh > bvh/35_01.bvh      (and so on)
// then:  node tools/build-anim.mjs path/to/bvh [--report]
//
// What it does to a clip: reads the capture's skeleton and frames, works out every joint's rotation in
// the world, and gives each of the game's 22 bones (game/body.js) the rotation that points it the way
// the matching captured bone points (the two skeletons rest differently: the capture stands in a T with
// its legs apart, ours with arms down, so limbs are matched by direction and the trunk, head and feet by
// rotation). Heights are scaled by leg length. Walks and runs are cut to one stride, turned to face +z,
// kept on the spot, timed so the right foot is planted at phase 0 and the left at half way (the sim's
// stride, rules/dribble.js), and made to loop by fading two successive strides into each other.
import * as THREE from 'three';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildSkeleton } from '../game/body.js';

const [dir = 'bvh', ...flags] = process.argv.slice(2), REPORT = flags.includes('--report');
const OUT = fileURLToPath(new URL('../game/assets/anim/clips.js', import.meta.url));

// name: [file, kind, options]. Strides are sampled N times round the cycle.
const N = 36;
export const CLIPS = {
  walk: ['35_02', 'stride'], walkB: ['35_28', 'stride'], walkC: ['141_25', 'stride'],
  jog: ['16_36', 'stride'], jogB: ['35_20', 'stride'], jogC: ['143_01', 'stride'],
  run: ['09_06', 'stride'], runB: ['16_46', 'stride'], runC: ['127_07', 'stride'],
  // for a man on the ball going slowly (game/dribblecap.js): 'quick little steps' (half a second a stride, 0.9 m), and a low jog on short strides
  quick: ['136_31', 'stride'], low: ['16_56', 'stride'],
  // a 'kick' is a strike at a ball: the window round the contact, facing the way the foot goes through it (below).
  // the library's soccer kicks ("soccer - kick ball") are subjects 10 and 11: 11_01 is the hardest of them, struck with
  // the inside of the instep and followed through across the body with a hop; subject 10's are side-foot kicks (10_01 the
  // most upright; 10_03 sits very low). Subject 74's "kick" takes are not football: front kicks at something off the ground
  // (knee chambered, toes up). 141_22 and 16_01 are not kicks at all.
  kickShot: ['11_01', 'kick'], kickPass: ['10_01', 'kick'],
  // the keeper (game/keepercap.js): getting up off the grass after a dive, from sitting on his hip with his legs to
  // one side, up through a crouch (140_03 'get up laying on side'; its lying still before 3.4 s is not used). 'once'
  // plays a stretch one time through (below). Looked at and not used: 140_04 (lies on his back, sits up), 77_03
  // 'ready stance' (hips only 2 cm down: not a keeper's set), subject 83's side-steps (single big steps from standing). 102_28 (a basketball 'defensive move side to side', the same as 78_30) is not baked: it was measured for the shuffle's numbers (docs/notes-keeper-anim.md).
  getup: ['140_03', 'once', { from: 3.4, to: 6.6 }],
  // a 'loop' is [from, to] seconds of a capture played round and round, e.g. stand: ['137_28', 'loop', { from: 2, to: 12 }].
  // None is baked: the library's standing takes (113_21, 77_02, 141_20, 137_28) have a tilted or bowed head, fidgeting or hands on hips.
};

// game bone ← captured joint, and whether it is matched by direction (to the joint's first child)
const MAP = {
  hips: ['Hips', false], spine: ['Spine', false], chest: ['Spine1', false], neck: ['Neck1', false], head: ['Head', false],
  clavicleL: ['LeftShoulder', true], upperArmL: ['LeftArm', true], foreArmL: ['LeftForeArm', true], handL: ['LeftHand', true],
  clavicleR: ['RightShoulder', true], upperArmR: ['RightArm', true], foreArmR: ['RightForeArm', true], handR: ['RightHand', true],
  upperLegL: ['LeftUpLeg', true], lowerLegL: ['LeftLeg', true], footL: ['LeftFoot', false], toeL: ['LeftToeBase', false],
  upperLegR: ['RightUpLeg', true], lowerLegR: ['RightLeg', true], footR: ['RightFoot', false], toeR: ['RightToeBase', false],
};

/* ---------- reading a capture ---------- */

function parseBVH(text, fps) {
  const tok = text.split(/\s+/).filter(Boolean), joints = [];
  let i = 0, stack = [];
  const next = () => tok[i++];
  while (tok[i] !== 'MOTION') {
    const t = next();
    if (t === 'ROOT' || t === 'JOINT') { const j = { name: next(), parent: stack[stack.length - 1] ?? -1, offset: [0, 0, 0], channels: [], children: [] }; joints.push(j); if (j.parent >= 0) joints[j.parent].children.push(joints.length - 1); stack.push(joints.length - 1); }
    else if (t === 'End') { next(); next(); next(); const o = [+next(), +next(), +next()]; joints[stack[stack.length - 1]].end = o; next(); }   // End Site { OFFSET x y z }
    else if (t === 'OFFSET') joints[stack[stack.length - 1]].offset = [+next(), +next(), +next()];
    else if (t === 'CHANNELS') { const n = +next(); for (let k = 0; k < n; k++) joints[stack[stack.length - 1]].channels.push(next()); }
    else if (t === '}') stack.pop();
  }
  i++; if (next() !== 'Frames:') throw new Error('no frame count'); const frames = +next(); next(); next(); const dt = +next();
  const width = joints.reduce((s, j) => s + j.channels.length, 0), data = new Float64Array(frames * width);
  for (let k = 0; k < frames * width; k++) data[k] = +next();
  return { joints, frames, dt: fps ? 1 / fps : dt, width, data };
}

// Every joint's place and rotation in the world on frame f: { p: Vector3[], q: Quaternion[] }
const eul = new THREE.Euler(), D = Math.PI / 180;
function pose(bvh, f, out) {
  let c = f * bvh.width;
  bvh.joints.forEach((j, k) => {
    const p = out.p[k].fromArray(j.offset), q = out.q[k].identity();
    let rx = 0, ry = 0, rz = 0, order = '';
    for (const ch of j.channels) {
      const v = bvh.data[c++];
      if (ch === 'Xposition') p.x = v; else if (ch === 'Yposition') p.y = v; else if (ch === 'Zposition') p.z = v;
      else { order += ch[0]; if (ch[0] === 'X') rx = v * D; else if (ch[0] === 'Y') ry = v * D; else rz = v * D; }
    }
    if (order) q.setFromEuler(eul.set(rx, ry, rz, order));       // 'ZYX': about z, then y, then x, as the file lists them
    if (j.parent >= 0) { p.applyQuaternion(out.q[j.parent]).add(out.p[j.parent]); q.premultiply(out.q[j.parent]); }
  });
  return out;
}
const newPose = bvh => ({ p: bvh.joints.map(() => new THREE.Vector3()), q: bvh.joints.map(() => new THREE.Quaternion()) });

/* ---------- onto the game's skeleton ---------- */

const { bones } = buildSkeleton(), NAMES = bones.map(b => b.name).filter(n => n !== 'root'), byName = Object.fromEntries(bones.map(b => [b.name, b]));
const restOf = b => b.getWorldPosition(new THREE.Vector3());
bones[0].updateMatrixWorld(true);
const LEG = restOf(byName.upperLegL).distanceTo(restOf(byName.lowerLegL)) + restOf(byName.lowerLegL).distanceTo(restOf(byName.footL));
const HIP_UP = restOf(byName.hips).y - restOf(byName.upperLegL).y, ANKLE = restOf(byName.footL).y;

function rig(bvh) {
  const id = Object.fromEntries(bvh.joints.map((j, k) => [j.name, k])), J = n => bvh.joints[id[n]];
  const len = n => Math.hypot(...J(n).offset);
  const scale = LEG / ((len('LeftLeg') + len('LeftFoot') + len('RightLeg') + len('RightFoot')) / 2);
  // per bone: the captured joint, and the turn that lines our rest direction up with the capture's
  const align = {};
  for (const n of NAMES) {
    const [src, byDir] = MAP[n], a = new THREE.Quaternion();
    if (byDir) {
      const kid = bones.find(b => b.parent === byName[n]), ours = kid ? restOf(kid).sub(restOf(byName[n])).normalize() : new THREE.Vector3(0, -1, 0);   // (a hand has no bone below it: it hangs straight down)
      const theirs = new THREE.Vector3().fromArray(bvh.joints[J(src).children[0]]?.offset ?? J(src).end).normalize();
      a.setFromUnitVectors(ours, theirs);
    }
    align[n] = { k: id[src], a };
  }
  return { id, scale, align };
}

// The game pose for a captured pose: local rotations by bone name, hips' place (m), ankles (m, for timing).
const qw = {}, tmpQ = new THREE.Quaternion(), IDENT = new THREE.Quaternion();
for (const n of NAMES) qw[n] = new THREE.Quaternion();
function retarget(bvh, R, src, yaw, origin, out) {
  const turn = tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw).clone();
  for (const n of NAMES) qw[n].copy(turn).multiply(src.q[R.align[n].k]).multiply(R.align[n].a);
  for (const n of NAMES) { const par = byName[n].parent.name; out.q[n].copy(qw[n]); if (par !== 'root') out.q[n].premultiply(tmpQ.copy(qw[par]).invert()); }
  const hipJoint = src.p[R.id.LeftUpLeg].clone().add(src.p[R.id.RightUpLeg]).multiplyScalar(0.5);
  out.hips.copy(hipJoint).sub(origin).multiplyScalar(R.scale).applyQuaternion(turn); out.hips.y = (hipJoint.y - R.floor) * R.scale + ANKLE + HIP_UP;
  for (const s of ['Left', 'Right']) out['ankle' + s[0]].copy(src.p[R.id[s + 'Foot']]).sub(origin).multiplyScalar(R.scale).applyQuaternion(turn).setY((src.p[R.id[s + 'Foot']].y - R.floor) * R.scale + ANKLE);
  return out;
}
const newOut = () => ({ q: Object.fromEntries(NAMES.map(n => [n, new THREE.Quaternion()])), hips: new THREE.Vector3(), ankleL: new THREE.Vector3(), ankleR: new THREE.Vector3() });

/* ---------- a stride ---------- */

const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
// When each foot is planted: runs of frames where the ankle is low and barely moving over the ground. Returns their mid times (frames).
function plants(pos, floor, dt, speed) {
  const out = [], still = 0.3 + speed * 0.35;
  let from = -1;
  for (let f = 1; f < pos.length - 1; f++) {
    const v = Math.hypot(pos[f + 1].x - pos[f - 1].x, pos[f + 1].z - pos[f - 1].z) / (2 * dt), down = pos[f].y - floor < 0.17 && v < still;
    if (down && from < 0) from = f;
    if (!down && from >= 0) { if (f - from > 0.035 / dt) out.push({ mid: (from + f - 1) / 2, from, to: f - 1 }); from = -1; }
  }
  return out;
}

function stride(name, bvh, want, flip = false) {
  const R = rig(bvh), src = newPose(bvh), all = [];
  for (let f = 0; f < bvh.frames; f++) { pose(bvh, f, src); all.push({ hip: src.p[R.id.Hips].clone(), l: src.p[R.id.LeftFoot].clone(), r: src.p[R.id.RightFoot].clone() }); }
  R.floor = median(all.flatMap(a => [a.l.y, a.r.y]).sort((x, y) => x - y).slice(0, all.length >> 1));     // ankle height with the foot down (capture units)
  const m = a => a.clone().multiplyScalar(R.scale), floor = R.floor * R.scale;
  const path = all.map(a => m(a.hip)), total = path[path.length - 1].clone().sub(path[0]), speed = Math.hypot(total.x, total.z) / ((bvh.frames - 1) * bvh.dt);
  let pr = plants(all.map(a => m(a.r)), floor, bvh.dt, speed), pl = plants(all.map(a => m(a.l)), floor, bvh.dt, speed);
  if (flip) [pr, pl] = [pl, pr];
  // the steadiest two successive strides: right plant to right plant to right plant, a left plant inside each
  // (a short capture may only hold one: then that one, eased shut at its end)
  const dist = (t0, t1) => path[Math.round(t1)].distanceTo(path[Math.round(t0)]) / ((t1 - t0) * bvh.dt);
  let best = null;
  for (let k = 0; k + 1 < pr.length; k++) {
    const a = pr[k].mid, b = pr[k + 1].mid, c = pr[k + 2]?.mid, la = pl.find(p => p.mid > a && p.mid < b), lb = c && pl.find(p => p.mid > b && p.mid < c);
    if (!la) continue;
    const va = dist(a, b), vb = lb ? dist(b, c) : va;
    const score = (lb ? Math.abs(va - vb) / (va + vb) + Math.abs((b - a) - (c - b)) / (c - a) : 1) - (want ? -Math.abs((va + vb) / 2 - want) : 0);
    if (!best || score < best.score) best = { score, a, b, c: lb ? c : null, la: la.mid, lb: lb?.mid, v: (va + vb) / 2, duty: (pr[k + 1].to - pr[k + 1].from) / (b - a) };
  }
  if (!best && !flip) return stride(name, bvh, want, true);      // no stride between two right plants: take one between two left plants and start it half way round
  if (!best) throw new Error(`${name}: no clean stride (right plants ${pr.length}, left ${pl.length})`);
  const { a, b } = best, c = best.c ?? b, go = path[Math.round(c)].clone().sub(path[Math.round(a)]), yaw = Math.atan2(go.x, go.z);
  // phase → frame within a stride [t0, t1] whose left plant is at tl: the left plant lands on half way
  const frameAt = (ph, t0, tl, t1) => (ph < 0.5 ? t0 + (tl - t0) * ph * 2 : tl + (t1 - tl) * (ph - 0.5) * 2);
  const A = newOut(), B = newOut(), E = newOut(), s0 = newPose(bvh), s1 = newPose(bvh), o0 = newOut(), o1 = newOut();
  const hipAt = t => { const f = Math.floor(t); return all[f].hip.clone().lerp(all[Math.min(bvh.frames - 1, f + 1)].hip, t - f); };
  const at = (t, out, t0, t1) => {    // the retargeted pose at a fractional frame, kept on the spot: his steady travel over the stride is taken out, his sway is kept
    const f = Math.floor(t), k = t - f, org = hipAt(t0).lerp(hipAt(t1), (t - t0) / (t1 - t0)).setY(0);
    retarget(bvh, R, pose(bvh, f, s0), yaw, org, o0); retarget(bvh, R, pose(bvh, Math.min(bvh.frames - 1, f + 1), s1), yaw, org, o1);
    for (const n of NAMES) out.q[n].copy(o0.q[n]).slerp(o1.q[n], k);
    out.hips.copy(o0.hips).lerp(o1.hips, k); out.ankleL.copy(o0.ankleL).lerp(o1.ankleL, k); out.ankleR.copy(o0.ankleR).lerp(o1.ankleR, k);
    return out;
  };
  const q = [], h = [];
  let lo = 9, hi = 0;
  if (!best.c) at(b - 1e-6, E, a, b);                     // one stride only: where it ends, to ease the end onto the start
  const first = newOut(); at(a, first, a, b);
  for (let i = 0; i < N; i++) {
    const ph = flip ? (i / N + 0.5) % 1 : i / N;
    at(frameAt(ph, a, best.la, b), A, a, b);
    if (best.c) {
      // the second stride fades into the first: the loop closes on the very same pose
      at(frameAt(ph, b, best.lb, c), B, b, c);
      for (const n of NAMES) B.q[n].slerp(A.q[n], ph);
      B.hips.lerp(A.hips, ph);
    } else {
      const w = Math.max(0, (ph - 0.6) / 0.4) ** 2;
      for (const n of NAMES) B.q[n].copy(A.q[n]).multiply(tmpQ.copy(E.q[n]).invert().multiply(first.q[n]).slerp(IDENT, 1 - w).clone());
      B.hips.copy(A.hips).add(first.hips.clone().sub(E.hips).multiplyScalar(w));
    }
    for (const n of NAMES) { const r = B.q[n]; q.push(r.x, r.y, r.z, r.w); }
    h.push(B.hips.x, B.hips.y, B.hips.z);
    lo = Math.min(lo, B.hips.y); hi = Math.max(hi, B.hips.y);
  }
  const period = (c - a) / (best.c ? 2 : 1) * bvh.dt;
  if (REPORT) console.log(`${name.padEnd(8)} ${best.v.toFixed(2)} m/s  stride ${period.toFixed(3)} s (${(best.v * period).toFixed(2)} m)  planted ${(best.duty * 100).toFixed(0)}%  ${best.c ? 'two strides' : 'ONE stride'}  hips ${lo.toFixed(3)}..${hi.toFixed(3)}  scale ${R.scale.toFixed(4)}  plants R${pr.length} L${pl.length}`);
  return { kind: 'stride', speed: +best.v.toFixed(3), period: +period.toFixed(4), n: N, q, h };
}

/* ---------- a loop: a stretch of someone standing ---------- */

const HZ = 12;
function loop(name, bvh, { from, to }) {
  const R = rig(bvh), src = newPose(bvh), f0 = Math.round(from / bvh.dt), f1 = Math.min(bvh.frames - 1, Math.round(to / bvh.dt)), feet = [], org = new THREE.Vector3(), fwd = new THREE.Vector3();
  for (let f = f0; f <= f1; f++) { pose(bvh, f, src); feet.push(src.p[R.id.LeftFoot].y, src.p[R.id.RightFoot].y); org.add(src.p[R.id.Hips]); fwd.add(new THREE.Vector3(0, 0, 1).applyQuaternion(src.q[R.id.Hips])); }
  R.floor = median(feet); org.multiplyScalar(1 / (f1 - f0 + 1)).setY(0);
  const yaw = Math.atan2(fwd.x, fwd.z), n = Math.round((f1 - f0) * bvh.dt * HZ), A = newOut(), first = newOut(), last = newOut(), q = [], h = [];
  retarget(bvh, R, pose(bvh, f0, src), yaw, org, first); retarget(bvh, R, pose(bvh, f1, src), yaw, org, last);
  for (let i = 0; i < n; i++) {
    const ph = i / n, w = Math.max(0, (ph - 0.75) / 0.25), e = w * w * (3 - 2 * w);       // the last quarter eases onto the first pose
    retarget(bvh, R, pose(bvh, Math.round(f0 + (f1 - f0) * ph), src), yaw, org, A);
    for (const nm of NAMES) { const r = A.q[nm].multiply(tmpQ.copy(last.q[nm]).invert().multiply(first.q[nm]).slerp(IDENT, 1 - e).clone()); q.push(r.x, r.y, r.z, r.w); }
    A.hips.add(first.hips.clone().sub(last.hips).multiplyScalar(e)); h.push(A.hips.x, A.hips.y, A.hips.z);
  }
  if (REPORT) console.log(`${name.padEnd(8)} loop ${((f1 - f0) * bvh.dt).toFixed(1)} s, ${n} poses, hips ${Math.min(...h.filter((_, i) => i % 3 === 1)).toFixed(3)}..${Math.max(...h.filter((_, i) => i % 3 === 1)).toFixed(3)}`);
  return { kind: 'loop', speed: 0, period: +((f1 - f0) * bvh.dt).toFixed(3), n, q, h };
}

/* ---------- once: a stretch of a capture played one time through ---------- */

// [from, to] seconds at OHZ poses a second, not looped. Turned so he faces +z at `face` ('start' or 'end': the
// pelvis's forward then), placed so the hips are over the origin then. The floor is the ankles' height over the
// stretch's last quarter second, where he stands (the ankle, not the toe: our feet stand on it the same way).
// The hips' path is kept (h), and so are both ankles (a: right then left, m).
const OHZ = 30;
function once(name, bvh, { from, to, face = 'end', floor }) {
  const R = rig(bvh), src = newPose(bvh), f0 = Math.round(from / bvh.dt), f1 = Math.min(bvh.frames - 1, Math.round(to / bvh.dt)), fk = face === 'end' ? f1 : f0;
  let lo = Infinity;
  for (let f = Math.max(f0, f1 - Math.round(0.25 / bvh.dt)); f <= f1; f++) { pose(bvh, f, src); lo = Math.min(lo, src.p[R.id.LeftFoot].y, src.p[R.id.RightFoot].y); }
  R.floor = floor ?? lo;
  pose(bvh, fk, src);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(src.q[R.id.Hips]), yaw = Math.atan2(fwd.x, fwd.z), org = src.p[R.id.Hips].clone().setY(0);
  const n = Math.round((f1 - f0) * bvh.dt * OHZ) + 1, A = newOut(), q = [], h = [], a = [];
  let hy = [9, 0];
  for (let i = 0; i < n; i++) {
    retarget(bvh, R, pose(bvh, Math.min(f1, Math.round(f0 + i / OHZ / bvh.dt)), src), yaw, org, A);
    for (const nm of NAMES) { const r = A.q[nm]; q.push(r.x, r.y, r.z, r.w); }
    h.push(A.hips.x, A.hips.y, A.hips.z); a.push(A.ankleR.x, A.ankleR.y, A.ankleR.z, A.ankleL.x, A.ankleL.y, A.ankleL.z);
    hy = [Math.min(hy[0], A.hips.y), Math.max(hy[1], A.hips.y)];
  }
  if (REPORT) console.log(`${name.padEnd(9)} once ${((f1 - f0) * bvh.dt).toFixed(2)} s, ${n} poses, hips ${hy[0].toFixed(3)}..${hy[1].toFixed(3)}, ends at ${h.slice(-3).map(v => v.toFixed(2)).join(', ')}`);
  return { kind: 'once', speed: 0, hz: OHZ, n, q, h, a };
}

/* ---------- a kick: the swing through a ball ---------- */

// Kept: from `lead` seconds before the contact (the plant foot's last touchdown and the top of the backswing
// are both inside it) to the kicking foot coming down again. The contact is the kicking ankle's top speed
// (it slows as it meets the ball); the pose faces +z the way the ankle is going then, and everything is
// placed from where that ankle is at the contact (x, z). A left-footed kick is mirrored: every baked kick
// is the right boot's. opt: { at: contact frame, lead, tail (s) }.
const KHZ = 60, skel = bones[0];
function kick(name, bvh, { at, lead = 0.3, tail = 0.6 } = {}) {
  const R = rig(bvh), s0 = newPose(bvh), s1 = newPose(bvh), o0 = newOut(), o1 = newOut(), raw = [];
  const span = f => [Math.floor(f), Math.min(bvh.frames - 1, Math.floor(f) + 1)];
  for (let f = 0; f < bvh.frames; f++) { pose(bvh, f, s0); raw.push({ l: s0.p[R.id.LeftFoot].clone(), r: s0.p[R.id.RightFoot].clone() }); }
  const foot = (n, f) => { const [a, b] = span(f); return raw[a][n].clone().lerp(raw[b][n], b > a ? (f - a) / (b - a) : 0).multiplyScalar(R.scale); };
  R.floor = median(raw.flatMap(a => [a.l.y, a.r.y]).sort((x, y) => x - y).slice(0, raw.length >> 1));
  const vel = (n, f) => foot(n, f + 2).sub(foot(n, f - 2)).multiplyScalar(1 / (4 * bvh.dt)), top = n => { let b = 12; for (let f = 12; f < bvh.frames - 2; f++) if (vel(n, f).length() > vel(n, b).length()) b = f; return b; };
  const left = vel('l', top('l')).length() > vel('r', top('r')).length(), K = left ? 'l' : 'r', P = left ? 'r' : 'l', c = at ?? top(K);
  const v = vel(K, c), yaw = Math.atan2(v.x, v.z), org = (left ? raw[c].l : raw[c].r).clone();
  // where it ends: the kicking foot back on the ground (or `tail` s on); the plant foot's touchdown; the top of the backswing
  let end = c + Math.round(0.12 / bvh.dt); const last = Math.min(bvh.frames - 3, c + Math.round(tail / bvh.dt));
  while (end < last && !(foot(K, end).y - R.floor * R.scale < 0.06 && vel(K, end).length() < 1)) end++;
  let down = c; while (down > 2 && vel(P, down).length() < 1.2) down--;
  const game = (f, out) => {
    const [a, b] = span(f), k = b > a ? (f - a) / (b - a) : 0;
    retarget(bvh, R, pose(bvh, a, s0), yaw, org, o0); retarget(bvh, R, pose(bvh, b, s1), yaw, org, o1);
    for (const n of NAMES) out.q[n].copy(o0.q[n]).slerp(o1.q[n], k);
    out.hips.copy(o0.hips).lerp(o1.hips, k);
    if (left) {      // seen in a mirror: left and right bones change places, every turn is reflected
      for (const n of NAMES) { const q = out.q[n]; q.set(q.x, -q.y, -q.z, q.w); }
      for (const n of NAMES) if (n.endsWith('L')) { const o = n.slice(0, -1) + 'R'; tmpQ.copy(out.q[n]); out.q[n].copy(out.q[o]); out.q[o].copy(tmpQ); }
      out.hips.x = -out.hips.x;
    }
    // where that puts our own ankles (the capture's legs aren't quite ours)
    for (const n of NAMES) byName[n].quaternion.copy(out.q[n]);
    byName.hips.position.copy(out.hips); skel.updateMatrixWorld(true);
    byName.footR.getWorldPosition(out.ankleR); byName.footL.getWorldPosition(out.ankleL);
    return out;
  };
  const ci = Math.round(lead * KHZ), n = ci + Math.round((end - c) * bvh.dt * KHZ) + 1, A = newOut(), q = [], h = [], a = [];
  const o = game(c, A).ankleR.clone(); let back = 0, topAt = 0, lo = 9;
  for (let i = 0; i < n; i++) {
    game(Math.max(0, c + (i - ci) / KHZ / bvh.dt), A);
    for (const nm of NAMES) { const r = A.q[nm]; q.push(r.x, r.y, r.z, r.w); }
    h.push(A.hips.x - o.x, A.hips.y, A.hips.z - o.z); a.push(A.ankleR.x - o.x, A.ankleR.y, A.ankleR.z - o.z, A.ankleL.x - o.x, A.ankleL.y, A.ankleL.z - o.z);
    if (i <= ci && A.ankleR.z - A.hips.z < back) { back = A.ankleR.z - A.hips.z; topAt = (ci - i) / KHZ; }
    lo = Math.min(lo, A.ankleL.y, A.ankleR.y);
  }
  for (const b of bones) if (b.name !== 'root') b.quaternion.identity();
  if (REPORT) console.log(`${name.padEnd(9)} kick  ${left ? 'LEFT foot (mirrored)' : 'right foot'}  contact frame ${c} at ${v.length().toFixed(1)} m/s  backswing top ${topAt.toFixed(3)} s before, plant down ${((c - down) * bvh.dt).toFixed(3)} s before, ends ${((end - c) * bvh.dt).toFixed(2)} s after  ${n} poses  ankle at contact y ${o.y.toFixed(3)}, lowest ${lo.toFixed(3)}  hips ${h[ci * 3].toFixed(2)}, ${h[ci * 3 + 1].toFixed(2)}, ${h[ci * 3 + 2].toFixed(2)}  plant ankle ${a[ci * 6 + 3].toFixed(2)}, ${a[ci * 6 + 4].toFixed(2)}, ${a[ci * 6 + 5].toFixed(2)}`);
  return { kind: 'kick', speed: +v.length().toFixed(2), hz: KHZ, n, c: ci, top: +topAt.toFixed(3), plant: +((c - down) * bvh.dt).toFixed(3), q, h, a };
}

/* ---------- write ---------- */

const clips = {};
for (const [name, [file, kind, opt]] of Object.entries(CLIPS)) {
  // (subjects 141 and 143 were captured at 60 Hz though their files say 120: checked against gravity in their runs' flight)
  const bvh = parseBVH(await readFile(`${dir}/${file}.bvh`, 'utf8'), /^14[13]_/.test(file) ? 60 : 0);
  try { clips[name] = kind === 'kick' ? kick(name, bvh, opt) : kind === 'once' ? once(name, bvh, opt) : kind === 'loop' ? loop(name, bvh, opt) : stride(name, bvh, opt?.want); } catch (e) { console.log(String(e.message)); }
}
const r = v => +v.toFixed(4);
const head = c => (c.kind === 'kick' ? `hz: ${c.hz}, n: ${c.n}, c: ${c.c}, top: ${c.top}, plant: ${c.plant}` : c.kind === 'once' ? `hz: ${c.hz}, n: ${c.n}` : `period: ${c.period}, n: ${c.n}`);
const body = Object.entries(clips).map(([name, c]) => `  ${name}: { kind: '${c.kind}', speed: ${c.speed}, ${head(c)},\n    q: [${c.q.map(r).join(',')}],\n    h: [${c.h.map(r).join(',')}]${c.a ? `,\n    a: [${c.a.map(r).join(',')}]` : ''} },`).join('\n');
await mkdir(fileURLToPath(new URL('../game/assets/anim/', import.meta.url)), { recursive: true });
await writeFile(OUT, `// Motion-capture clips for the players, baked by tools/build-anim.mjs. Do not edit by hand.\n// The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding\n// from NSF EIA-0196217.\n// q: one quaternion (x, y, z, w) per bone per sample, bones in BONES order; h: the hips' place per sample (m).\n// A kick is sampled hz times a second; sample c is the contact; a: the right (kicking) and left ankles per sample;\n// h and a are measured from the kicking ankle at the contact (x, z) and the grass (y).\nexport const BONES = ${JSON.stringify(NAMES)};\nexport const CLIPS = {\n${body}\n};\n`);
console.log(`wrote ${Object.keys(clips).length} clips, ${(body.length / 1024).toFixed(0)} KB`);
