// Bakes the brawl's get-ups (game/brawl/anim/getups.js) from BVH files of the CMU Graphics Lab Motion Capture
// Database (mocap.cs.cmu.edu; free for any use, see the credit in the output): subjects 139 and 140, getting up
// from the ground. The BVH files are not in the repo. Get them from the mirror:
//   git clone --filter=blob:none --no-checkout --depth 1 https://github.com/una-dinosauria/cmu-mocap
//   git -C cmu-mocap show HEAD:data/140/140_09.bvh > bvh/140_09.bvh      (and so on: the files in TAKES)
// then:  node tools/build-getup.mjs path/to/bvh            (writes the clips)
//        node tools/build-getup.mjs path/to/bvh --scan 140_08   (prints a take's timeline, to pick a stretch)
//
// The reading and retargeting are the same as tools/build-anim.mjs (limbs matched by direction, trunk, head
// and feet by rotation, heights scaled by leg length); that tool runs when imported, so they are repeated here.
// A get-up is kept as it was recorded: [from, to] seconds at HZ poses a second, laid so that at its start his
// hips are over the origin and his head points along +z on the grass. With each pose goes which of his hands
// and feet are bearing on the ground (low and still), which the page pins to the grass (game/brawl/getup.js).
import * as THREE from 'three';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildSkeleton } from '../game/body.js';

const [dir = 'bvh', ...flags] = process.argv.slice(2);
const SCAN = flags.includes('--scan') ? flags[flags.indexOf('--scan') + 1] : null;
const OUT = fileURLToPath(new URL('../game/brawl/anim/getups.js', import.meta.url));
const HZ = 30;

// name: [file, { from, to }] (seconds of the take). All three end in the ready crouch the people recorded came up into
// (hips about 0.87 m, trunk 40 degrees forward): the page takes him from there into the game's standing pose.
// - back: 140_09 'Get Up From Ground Laying on Back': knees up, a sit-up, rocks forward over his feet with no hand
//   down, squats, stands. 4.3 s.
// - front: 139_16 'Get Up From Ground' (face down): a press-up, knees under, a foot then the other brought up, stands. 2.7 s.
// - side: 139_18 (listed as 'Laying on Back', but he lies on his left side): rolls onto his front and his left hand,
//   knees under, up. 4 s.
// Looked at and not baked: 140_08 (as 140_09, a slower sit-up), 140_01 / 140_02 (face down, 3.6 s and slower still),
// 140_03 / 140_04 (from the side by rolling onto the back and sitting up: 5.4 and 5.7 s; 140_03 is the keeper's
// get-up in tools/build-anim.mjs), 77_16 / 77_18 (the same files as 139_16 / 139_18).
export const TAKES = {
  back: ['140_09', { from: 0.4, to: 4.75 }],
  front: ['139_16', { from: 1.3, to: 4.0 }],
  side: ['139_18', { from: 0.8, to: 4.8 }],
};

const MAP = {
  hips: ['Hips', false], spine: ['Spine', false], chest: ['Spine1', false], neck: ['Neck1', false], head: ['Head', false],
  clavicleL: ['LeftShoulder', true], upperArmL: ['LeftArm', true], foreArmL: ['LeftForeArm', true], handL: ['LeftHand', true],
  clavicleR: ['RightShoulder', true], upperArmR: ['RightArm', true], foreArmR: ['RightForeArm', true], handR: ['RightHand', true],
  upperLegL: ['LeftUpLeg', true], lowerLegL: ['LeftLeg', true], footL: ['LeftFoot', false], toeL: ['LeftToeBase', false],
  upperLegR: ['RightUpLeg', true], lowerLegR: ['RightLeg', true], footR: ['RightFoot', false], toeR: ['RightToeBase', false],
};

function parseBVH(text, fps) {
  const tok = text.split(/\s+/).filter(Boolean), joints = [];
  let i = 0, stack = [];
  const next = () => tok[i++];
  while (tok[i] !== 'MOTION') {
    const t = next();
    if (t === 'ROOT' || t === 'JOINT') { const j = { name: next(), parent: stack[stack.length - 1] ?? -1, offset: [0, 0, 0], channels: [], children: [] }; joints.push(j); if (j.parent >= 0) joints[j.parent].children.push(joints.length - 1); stack.push(joints.length - 1); }
    else if (t === 'End') { next(); next(); next(); const o = [+next(), +next(), +next()]; joints[stack[stack.length - 1]].end = o; next(); }
    else if (t === 'OFFSET') joints[stack[stack.length - 1]].offset = [+next(), +next(), +next()];
    else if (t === 'CHANNELS') { const n = +next(); for (let k = 0; k < n; k++) joints[stack[stack.length - 1]].channels.push(next()); }
    else if (t === '}') stack.pop();
  }
  i++; if (next() !== 'Frames:') throw new Error('no frame count'); const frames = +next(); next(); next(); const dt = +next();
  const width = joints.reduce((s, j) => s + j.channels.length, 0), data = new Float64Array(frames * width);
  for (let k = 0; k < frames * width; k++) data[k] = +next();
  return { joints, frames, dt: fps ? 1 / fps : dt, width, data };
}

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
    if (order) q.setFromEuler(eul.set(rx, ry, rz, order));
    if (j.parent >= 0) { p.applyQuaternion(out.q[j.parent]).add(out.p[j.parent]); q.premultiply(out.q[j.parent]); }
  });
  return out;
}
const newPose = bvh => ({ p: bvh.joints.map(() => new THREE.Vector3()), q: bvh.joints.map(() => new THREE.Quaternion()) });

const { bones } = buildSkeleton(), NAMES = bones.map(b => b.name).filter(n => n !== 'root'), byName = Object.fromEntries(bones.map(b => [b.name, b]));
const restOf = b => b.getWorldPosition(new THREE.Vector3());
bones[0].updateMatrixWorld(true);
const LEG = restOf(byName.upperLegL).distanceTo(restOf(byName.lowerLegL)) + restOf(byName.lowerLegL).distanceTo(restOf(byName.footL));
const HIP_UP = restOf(byName.hips).y - restOf(byName.upperLegL).y, ANKLE = restOf(byName.footL).y;

function rig(bvh) {
  for (const b of bones) { b.quaternion.identity(); b.position.copy(b.userData.rest); }       // (joints() leaves it posed)
  bones[0].updateMatrixWorld(true);
  const id = Object.fromEntries(bvh.joints.map((j, k) => [j.name, k])), J = n => bvh.joints[id[n]];
  const len = n => Math.hypot(...J(n).offset);
  const scale = LEG / ((len('LeftLeg') + len('LeftFoot') + len('RightLeg') + len('RightFoot')) / 2);
  const align = {};
  for (const n of NAMES) {
    const [src, byDir] = MAP[n], a = new THREE.Quaternion();
    if (byDir) {
      const kid = bones.find(b => b.parent === byName[n]), ours = kid ? restOf(kid).sub(restOf(byName[n])).normalize() : new THREE.Vector3(0, -1, 0);
      const theirs = new THREE.Vector3().fromArray(bvh.joints[J(src).children[0]]?.offset ?? J(src).end).normalize();
      a.setFromUnitVectors(ours, theirs);
    }
    align[n] = { k: id[src], a };
  }
  return { id, scale, align };
}

// The game pose for a captured pose, turned by -yaw about `origin`: local rotations by bone name and the hips' place (m).
const qw = {}, tmpQ = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
for (const n of NAMES) qw[n] = new THREE.Quaternion();
function retarget(bvh, R, src, yaw, origin, out) {
  const turn = tmpQ.setFromAxisAngle(UP, -yaw).clone();
  for (const n of NAMES) qw[n].copy(turn).multiply(src.q[R.align[n].k]).multiply(R.align[n].a);
  for (const n of NAMES) { const par = byName[n].parent.name; out.q[n].copy(qw[n]); if (par !== 'root') out.q[n].premultiply(tmpQ.copy(qw[par]).invert()); }
  const hipJoint = src.p[R.id.LeftUpLeg].clone().add(src.p[R.id.RightUpLeg]).multiplyScalar(0.5);
  out.hips.copy(hipJoint).sub(origin).multiplyScalar(R.scale).applyQuaternion(turn);
  // the hips bone sits HIP_UP above the hip joints along the pelvis's own up, which is not the sky's when he lies down
  out.hips.add(new THREE.Vector3(0, HIP_UP, 0).applyQuaternion(qw.hips));
  out.hips.y += -R.floor * R.scale;
  return out;
}
const newOut = () => ({ q: Object.fromEntries(NAMES.map(n => [n, new THREE.Quaternion()])), hips: new THREE.Vector3() });

// Our skeleton in a retargeted pose: where its joints are (m, the grass at 0 once `lift` is known).
const PTS = ['hips', 'chest', 'head', 'handL', 'handR', 'foreArmL', 'foreArmR', 'lowerLegL', 'lowerLegR', 'footL', 'footR', 'toeL', 'toeR'];
function joints(out) {
  for (const n of NAMES) byName[n].quaternion.copy(out.q[n]);
  byName.hips.position.copy(out.hips); bones[0].updateMatrixWorld(true);
  const r = {};
  for (const n of PTS) r[n] = byName[n].getWorldPosition(new THREE.Vector3());
  r.crown = new THREE.Vector3(0, 0.24, 0.02).applyMatrix4(byName.head.matrixWorld);
  r.fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(byName.chest.getWorldQuaternion(new THREE.Quaternion()));
  r.up = new THREE.Vector3(0, 1, 0).applyQuaternion(byName.hips.getWorldQuaternion(new THREE.Quaternion()));
  return r;
}

// A take, retargeted frame by frame. The floor is where the capture's lowest ankles are over its last half second
// (standing); every frame is turned so his head points along +z as he lies at `from`, hips over the origin.
function take(bvh, from, to) {
  const R = rig(bvh), src = newPose(bvh), f0 = Math.round(from / bvh.dt), f1 = Math.min(bvh.frames - 1, Math.round((to || 1e9) / bvh.dt));
  let lo = Infinity;
  for (let f = Math.max(f0, f1 - Math.round(0.5 / bvh.dt)); f <= f1; f++) { pose(bvh, f, src); lo = Math.min(lo, src.p[R.id.LeftFoot].y, src.p[R.id.RightFoot].y); }
  R.floor = lo - ANKLE / R.scale;
  pose(bvh, f0, src);
  const head = src.p[R.id.Head].clone().sub(src.p[R.id.Hips]), yaw = Math.atan2(head.x, head.z), org = src.p[R.id.LeftUpLeg].clone().add(src.p[R.id.RightUpLeg]).multiplyScalar(0.5).setY(0);
  return { R, f0, f1, at: (f, out) => retarget(bvh, R, pose(bvh, Math.max(0, Math.min(bvh.frames - 1, f)), src), yaw, org, out) };
}

const fx = (v, n = 2) => v.toFixed(n).padStart(6);
if (SCAN) {
  const bvh = parseBVH(await readFile(`${dir}/${SCAN}.bvh`, 'utf8')), T = take(bvh, +(flags[flags.indexOf('--scan') + 2] || 0), 0), A = newOut();
  console.log(`${SCAN}: ${(bvh.frames * bvh.dt).toFixed(2)} s at ${(1 / bvh.dt).toFixed(0)} Hz, scale ${T.R.scale.toFixed(4)}`);
  console.log('    t   hipsY  headY  chestF  pelvUp  handL  handR  kneeL  kneeR  footL  footR   hipsXZ        yaw');
  const step = +(flags[flags.indexOf('--scan') + 3] || 0.2);
  for (let t = 0; t < bvh.frames * bvh.dt; t += step) {
    const j = joints(T.at(Math.round(t / bvh.dt), A)), f = new THREE.Vector3(0, 0, 1).applyQuaternion(A.q.hips);
    console.log(fx(t), fx(j.hips.y), fx(j.head.y), fx(j.fwd.y), fx(j.up.y), fx(j.handL.y), fx(j.handR.y), fx(j.lowerLegL.y), fx(j.lowerLegR.y), fx(j.footL.y), fx(j.footR.y), fx(j.hips.x), fx(j.hips.z), fx(Math.atan2(f.x, f.z) / D, 0));
  }
  process.exit(0);
}

/* ---------- bake ---------- */

// A hand or foot bears on the ground when it is low and all but still. Hands: the wrist under 0.12 m; feet: the
// ankle or the toe joint within 5 cm of where it stands. Runs shorter than 0.1 s are dropped, gaps that short closed.
function bearing(js, k, dt) {
  const low = k.startsWith('hand') ? j => j[k].y < 0.13 : j => j[k].y < ANKLE + 0.06 || j['toe' + k.slice(-1)].y < 0.028 + 0.035;
  const pt = k.startsWith('hand') ? j => j[k] : j => (j[k].y < ANKLE + 0.06 ? j[k] : j['toe' + k.slice(-1)]);
  const on = js.map((j, i) => { const a = js[Math.max(0, i - 1)], b = js[Math.min(js.length - 1, i + 1)]; return low(j) && pt(a).distanceTo(pt(b)) / (2 * dt) < 0.3; });
  const runs = (v, min) => { let s = 0; for (let i = 1; i <= on.length; i++) if (i === on.length || on[i] !== on[s]) { if (on[s] === v && i - s < min && s > 0 && i < on.length) for (let x = s; x < i; x++) on[x] = !v; s = i; } };
  runs(false, Math.round(0.1 / dt)); runs(true, Math.round(0.1 / dt));
  return on;
}

const clips = {}, r4 = v => +v.toFixed(4);
for (const [name, [file, { from, to }]] of Object.entries(TAKES)) {
  const bvh = parseBVH(await readFile(`${dir}/${file}.bvh`, 'utf8')), T = take(bvh, from, to), A = newOut();
  const n = Math.round((T.f1 - T.f0) * bvh.dt * HZ) + 1, q = [], h = [], js = [];
  for (let i = 0; i < n; i++) {
    T.at(Math.round(T.f0 + i / HZ / bvh.dt), A);
    for (const nm of NAMES) { const r = A.q[nm]; q.push(r.x, r.y, r.z, r.w); }
    h.push(A.hips.x, A.hips.y, A.hips.z); js.push(joints(A));
  }
  // bit 0 left foot, 1 right foot, 2 left hand, 3 right hand
  const on = ['footL', 'footR', 'handL', 'handR'].map(k => bearing(js, k, 1 / HZ)), c = js.map((_, i) => on.reduce((s, o, b) => s | (o[i] ? 1 << b : 0), 0));
  const last = js[n - 1], f = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion().fromArray(q, (n - 1) * NAMES.length * 4));
  const lies = js[0].fwd.y > 0.5 ? 'back' : js[0].fwd.y < -0.5 ? 'front' : `side (${js[0].fwd.x > 0 ? 'chest to his left: on his right side' : 'on his left side'})`;
  console.log(`${name.padEnd(6)} ${file} ${from}..${to} s: ${((n - 1) / HZ).toFixed(2)} s, ${n} poses; lies on his ${lies}; ends at ${fx(last.hips.x)}, ${fx(last.hips.z)} facing ${(Math.atan2(f.x, f.z) / D).toFixed(0)} deg; lowest joint ${Math.min(...js.flatMap(j => PTS.map(p => j[p].y))).toFixed(3)}`);
  console.log('       bearing  ' + ['footL', 'footR', 'handL', 'handR'].map((k, b) => `${k}: ${(() => { const out = []; let s = -1; for (let i = 0; i <= n; i++) { const v = i < n && on[b][i]; if (v && s < 0) s = i; if (!v && s >= 0) { out.push(`${(s / HZ).toFixed(2)}-${((i - 1) / HZ).toFixed(2)}`); s = -1; } } return out.join(' '); })()}`).join('   '));
  clips[name] = { file, hz: HZ, n, q, h, c };
}
const body = Object.entries(clips).map(([name, c]) => `  ${name}: { take: '${c.file}', hz: ${c.hz}, n: ${c.n},\n    q: [${c.q.map(r4).join(',')}],\n    h: [${c.h.map(r4).join(',')}],\n    c: [${c.c.join(',')}] },`).join('\n');
await mkdir(fileURLToPath(new URL('../game/brawl/anim/', import.meta.url)), { recursive: true });
await writeFile(OUT, `// Get-ups for the brawl's men, baked by tools/build-getup.mjs. Do not edit by hand.\n// The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding\n// from NSF EIA-0196217.\n// q: one quaternion (x, y, z, w) per bone per pose, bones in BONES order; h: the hips' place per pose (m; at pose 0\n// the hip joints are over the origin and his head points along +z); c: what bears on the grass per pose\n// (bit 0 left foot, 1 right foot, 2 left hand, 3 right hand); hz poses a second.\nexport const BONES = ${JSON.stringify(NAMES)};\nexport const GETUPS = {\n${body}\n};\n`);
console.log(`wrote ${Object.keys(clips).length} clips, ${(body.length / 1024).toFixed(0)} KB`);
