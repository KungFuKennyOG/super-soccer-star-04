// Your squad at the trophy presentation (game/trophy.js): eight of them in your kit (the keeper in his),
// medals round their necks, on the stage behind you: four on the platform, four on the riser. Before the cup
// goes up they clap, bounce on their toes and stand with an arm round each other, watching it; when it goes up
// they erupt, each a moment after the other, and two of the front row come forward beside you.
// What is recorded and what is built:
//   recorded (CMU captures, game/cheercap.js; its 'yes' take is baked but not used: it reads as a shrug): the clapping, the giddy bouncing, arms up, reaching
//     overhead on the toes, the jumps and hops; the walk forward is the game's own captured gait (animate()).
//   built: which arms go with which legs, the fist pumped overhead, the arm round a teammate (IK onto him),
//     heads on the cup, who does what when.
// Everything here is in the stage's frame (game/ps2/stage.js): you at the origin facing -z, the squad at +z.
import * as THREE from 'three';
import { buildPlayer2, LIGHT_DIR } from './ps2/player.js';
import { animate } from './actors.js';
import { restPose } from './body.js';
import { applyPose, aimHead, mixPose } from './mocap.js';
import { cheerPose, newPose, PART } from './cheercap.js';
import { BONES } from './assets/anim/cheer.js';
import { reachArm, ankleOf, footOf, reachLeg, aimFoot } from './legik.js';
import { keeperKit } from '../rules/teams.js';
import { pickSquad } from '../rules/looks.js';
import { STAGE } from './ps2/stage.js';
import { wearMedal } from './ps2/medal.js';

const smooth = x => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const TOP = STAGE.h, UP = STAGE.h + STAGE.riser;

// What a man does: the take his legs (and hips) are from, the take his trunk and arms are from, and what is
// laid over it: fist 'L' | 'R' | 'LR' pumped overhead, link: his arm round the man beside him.
const ACTS = {
  clap: { legs: 'clap', up: 'clap' }, giddy: { legs: 'giddy', up: 'giddy' },
  armsUp: { legs: 'armsUp', up: 'armsUp' }, reach: { legs: 'reach', up: 'reach' },
  jumpUp: { legs: 'jump', up: 'armsUp' }, jumpR: { legs: 'jump', up: 'reach' }, hopUp: { legs: 'bounce', up: 'reach' },
  pump: { legs: 'bounce', up: 'giddy', fist: 'R' }, pump2: { legs: 'jump', up: 'giddy', fist: 'LR' },
  sway: { legs: 'giddy', up: 'giddy', link: true }, bounce: { legs: 'bounce', up: 'giddy', link: true, fist: 'out' },
};
// The cast: where he stands (x, z, on the riser?), his number, what he does waiting / once you hold the cup /
// when it is up, how long after it goes up he goes off, his own pace, mirrored or not; go: where he comes forward to.
const CAST = [
  { x: -2.55, z: 1.2, num: 3, acts: ['clap', 'giddy', 'jumpR'], lag: 0.3, rate: 1.0, drop: 0.2 },
  { x: -1.25, z: 1.3, num: 8, acts: ['giddy', 'clap', 'jumpUp'], lag: 0.12, rate: 1.06, go: [-1.45, 0.45], drop: 0.08 },
  { x: 1.25, z: 1.25, num: 10, acts: ['clap', 'giddy', 'pump2'], lag: 0.22, rate: 0.94, mirror: true, go: [1.5, 0.5], drop: 0.13 },
  { x: 2.55, z: 1.15, num: 1, gk: true, acts: ['clap', 'clap', 'reach'], lag: 0.5, rate: 0.9, mirror: true, drop: 0.24 },
  { x: -1.85, z: 2.62, up: true, num: 5, acts: ['giddy', 'giddy', 'armsUp'], lag: 0.4, rate: 0.97, mirror: true },
  { x: -0.37, z: 2.66, up: true, num: 4, acts: ['sway', 'sway', 'bounce'], lag: 0.18, rate: 1.0, link: 6 },
  { x: 0.37, z: 2.66, up: true, num: 6, acts: ['sway', 'sway', 'bounce'], lag: 0.18, rate: 1.0, link: 5 },
  { x: 1.85, z: 2.6, up: true, num: 11, acts: ['clap', 'giddy', 'hopUp'], lag: 0.6, rate: 1.08, drop: 0.16 },
];

// The players' flat shadows fall on the pitch (game/ps2/player.js); these fall on the floor they stand on.
const shadows = {};
function shadowOn(y) {
  if (shadows[y]) return shadows[y];
  const m = new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
  m.onBeforeCompile = sh => {
    sh.uniforms.uSun = { value: LIGHT_DIR }; sh.uniforms.uFloor = { value: y };
    sh.vertexShader = 'uniform vec3 uSun; uniform float uFloor;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 wp = modelMatrix * vec4( transformed, 1.0 );
      wp.xz -= uSun.xz * ( max( wp.y - uFloor, 0.0 ) / uSun.y );
      wp.y = uFloor + 0.012;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => 'stageShadow' + y;
  return (shadows[y] = m);
}

const PA = newPose(), PB = newPose(), PC = newPose(), PD = newPose();
// The whole pose of an act at his time t → out: the legs' take, with the trunk and arms of another over it.
function actPose(act, t, mirror, out) {
  cheerPose(act.legs, t, out, mirror);
  if (act.up !== act.legs) {
    cheerPose(act.up, t * 1.07 + 0.6, PD, mirror);
    for (let b = 0; b < out.q.length / 4; b++) if (UPPER[b]) for (let j = 0; j < 4; j++) out.q[b * 4 + j] = PD.q[b * 4 + j];
  }
  return out;
}
const UPPER = BONES.map(n => PART.upper.has(n));

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), pole = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
// A fist pumped over his head (built): from beside the ear to nearly straight up, about twice a second.
function pumpFist(bn, n, t, w, hipY) {
  const sd = n === 'L' ? 1 : -1, k = 0.5 - 0.5 * Math.cos(t * 12.5), ua = bn['upperArm' + n], fa = bn['foreArm' + n];
  qa.copy(ua.quaternion); qb.copy(fa.quaternion);
  reachArm(bn, n, v1.set(sd * (0.3 + 0.03 * k), hipY + 0.72 + 0.3 * k, 0.16 - 0.05 * k), pole.set(sd * 1, -0.2, 0.25));
  qc.copy(ua.quaternion); ua.quaternion.copy(qa).slerp(qc, w); qc.copy(fa.quaternion); fa.quaternion.copy(qb).slerp(qc, w);
}

// Hands that have gone through each other (a take's arms on our wider shoulders cross at the wrists when its
// hands met) are put back side by side: each arm is bent again to a wrist moved out, its elbow where it was.
const wl = new THREE.Vector3(), wr = new THREE.Vector3(), el = new THREE.Vector3(), sh = new THREE.Vector3();
function partHands(root, bn, drop = 0, need = 0.13) {
  root.updateMatrixWorld(true);
  root.worldToLocal(bn.handL.getWorldPosition(wl)); root.worldToLocal(bn.handR.getWorldPosition(wr));
  const k = 1 - smooth((wl.distanceTo(wr) - 0.28) / 0.17);                 // only while his hands are together
  if (k <= 0 || (drop <= 0 && wl.x - wr.x >= need)) return;
  // drop: this man claps that much lower than the take did (it clapped at the chin: not everyone does)
  wl.y -= drop * k; wr.y -= drop * k; wl.z += drop * 0.35 * k; wr.z += drop * 0.35 * k;
  const mid = (wl.x + wr.x) / 2, gap = Math.max(wl.x - wr.x, need * k);
  wl.x = mid + gap / 2; wr.x = mid - gap / 2;
  for (const [n, w] of [['L', wl], ['R', wr]]) {
    root.worldToLocal(bn['foreArm' + n].getWorldPosition(el)); root.worldToLocal(bn['upperArm' + n].getWorldPosition(sh));
    el.y -= drop * 0.5 * k;
    reachArm(bn, n, w, pole.copy(el).sub(sh.add(w).multiplyScalar(0.5)));
  }
}

// A boot on the floor stays where it came down: while its toes are within a few centimetres of the floor their
// spot is kept and the leg bent to it (a take's legs on our skeleton drift otherwise); let go as it lifts, or if
// the take has gone 14 cm from it (a step), the difference eased away.
const an = new THREE.Vector3(), toe = new THREE.Vector3(), fq = new THREE.Quaternion();
function pinFeet(c, bn, dt) {
  const pins = c.pins || (c.pins = { L: { on: false, x: 0, z: 0, ox: 0, oz: 0 }, R: { on: false, x: 0, z: 0, ox: 0, oz: 0 } });
  for (const n of ['L', 'R']) {
    const p = pins[n];
    ankleOf(bn, n, an); footOf(bn, n, fq);
    toe.copy(bn['toe' + n].userData.rest).applyQuaternion(fq).add(an);
    const low = Math.min(toe.y, an.y - 0.06) < (p.on ? 0.065 : 0.045);
    if (low && p.on && Math.hypot(p.x - toe.x, p.z - toe.z) < 0.14) { p.ox = p.x - toe.x; p.oz = p.z - toe.z; }
    else if (low && !p.on) { p.on = true; p.x = toe.x + p.ox; p.z = toe.z + p.oz; }
    else { p.on = false; const e = Math.exp(-dt * 12); p.ox *= e; p.oz *= e; }
    an.x += p.ox; an.z += p.oz;
    if (an.y < 0.085) an.y += (0.085 - an.y) * 0.8;                       // (and no ankle under the floor)
    reachLeg(bn, n, an); aimFoot(bn, n, fq);
  }
}

// group: the stage's frame. team: your team. Returns { update(dt, t, s), dispose(), tris }.
// s: { cup: Vector3 (the cup, stage frame), held: you have a hand on it, up: it is over your head }.
export function createCast(group, team, seed = 1) {
  const looks = pickSquad(team.id, CAST.map(c => c.num), seed), gkKit = keeperKit(team.kit);
  const cast = CAST.map((c, i) => {
    const m = buildPlayer2(c.gk ? gkKit : team.kit, c.num, c.num * 7 + i, { ap: looks[c.num] });
    const y = c.up ? UP : TOP, face = Math.atan2(-c.x * 0.45, -1);          // toward the front, turned a little to the cup
    m.root.position.set(c.x, y, c.z); m.root.rotation.y = face;
    m.root.children[1].material = shadowOn(y);
    m.shadow.position.set(c.x, y + 0.008, c.z); m.shadow.scale.setScalar(0.8); m.shadow.material = m.shadow.material.clone(); m.shadow.material.opacity = 0.5;
    group.add(m.root, m.shadow);
    return { ...c, m, y, face, t: i * 1.37 + (seed % 7) * 0.31, act: 0, from: 0, k: 1, off: 0, mode: 'stand', p: { x: c.x, z: c.z, vx: 0, vz: 0, fx: Math.sin(face), fz: Math.cos(face), role: 'mate' }, snap: null, snapK: 0, head: [0, 0] };
  });
  cast[6].t = cast[5].t; cast[6].mirror = true;                                                    // the two with an arm round each other move as one
  for (const c of cast) c.medal = wearMedal(c.m, c.gk ? gkKit : team.kit);               // (game/ps2/medal.js: on the shirt, the disc swinging)
  let upT = -1, level = 0;

  // his pose from his acts (the one he is leaving and the one he is in, mixed), then head, fists
  function cheer(c, dt, s) {
    const bn = c.m.bone, a = ACTS[c.acts[c.act]], b = ACTS[c.acts[c.from]];
    c.k = Math.min(1, c.k + dt / 0.4);
    const k = smooth(c.k);
    actPose(a, c.t, c.mirror, PA);
    if (k < 1) mixPose(actPose(b, c.t, c.mirror, PB), PA, k, PA);
    restPose(bn); applyPose(bn, PA, 1, PART.body);
    pinFeet(c, bn, dt); partHands(c.m.root, bn, c.drop || 0);
    for (const [act, w] of [[a, k], [b, 1 - k]]) {
      if (!act.fist || w <= 0.01) continue;
      const which = act.fist === 'out' ? (c.x < 0 ? 'L' : 'R') : act.fist;       // (the arm that isn't round his mate)
      for (const n of which) pumpFist(bn, n, c.t + (n === 'L' ? 0.25 : 0), w, bn.hips.position.y);
    }
    return bn;
  }
  function look(c, bn, s, dt) {
    const r = c.m.root, dx = s.cup.x - r.position.x, dy = s.cup.y - (r.position.y + 1.66), dz = s.cup.z - r.position.z, cs = Math.cos(r.rotation.y), sn = Math.sin(r.rotation.y);
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    const yaw = Math.max(-1.1, Math.min(1.1, Math.atan2(lx, lz))), pitch = Math.max(-0.75, Math.min(0.5, -Math.atan2(dy, Math.hypot(lx, lz))));
    const e = Math.min(1, dt * 7); c.head[0] += (yaw - c.head[0]) * e; c.head[1] += (pitch - c.head[1]) * e;
    aimHead(bn, c.head[0], c.head[1], 1);
  }
  // an arm round the man beside him: the man on the left over the other's shoulders, the man on the right
  // round the other's back lower down, so the two arms never cross
  function link(c, o) {
    // (they face the front, -z: the man at the greater x is on his right)
    const bn = c.m.bone, over = c.x < o.x, n = over ? 'R' : 'L', ob = o.m.bone;
    o.m.root.updateMatrixWorld(true); c.m.root.updateMatrixWorld(true);
    if (over) { ob.upperArmR.getWorldPosition(v1); ob.neck.getWorldPosition(v2); v1.lerp(v2, 0.3); v1.y += 0.06; }
    else { ob.spine.getWorldPosition(v1); ob.chest.getWorldPosition(v2); v1.lerp(v2, 0.5); ob.upperLegL.getWorldPosition(v2); v1.x += (v2.x - v1.x) * 0.9; }
    c.m.root.worldToLocal(v1); v1.z -= over ? 0.13 : 0.16;                        // behind him
    reachArm(bn, n, v1, pole.set(0, over ? 0.3 : -0.8, -1));
  }

  const api = {
    cast, tris: 0,
    update(dt, t, s) {
      const want = s.up ? 2 : s.held ? 1 : 0;
      if (s.up && upT < 0) upT = 0; if (!s.up) upT = -1; else upT += dt;
      level += ((s.up ? 1 : s.held ? 0.5 : 0) - level) * Math.min(1, dt * 2);
      for (const c of cast) {
        // each goes off (and settles) in his own time
        const next = want === 2 ? (upT > c.lag ? 2 : c.act) : want;
        if (next !== c.act && c.k >= 1) { c.from = c.act; c.act = next; c.k = 0; }
        c.t += dt * c.rate * (1 + 0.12 * level);
        if (c.go) walk(c, dt, t, s); else { const bn = cheer(c, dt, s); look(c, bn, s, dt); }
      }
      for (const c of cast) if (c.link !== undefined) { const a = ACTS[c.acts[c.act]]; if (a.link) link(c, cast[c.link]); }
      for (const c of cast) { c.m.root.updateMatrixWorld(true); c.medal.update(dt); c.m.shadow.position.set(c.m.root.position.x, c.y + 0.008, c.m.root.position.z); }
    },
    dispose() {
      for (const c of cast) { c.medal.dispose(); group.remove(c.m.root, c.m.shadow); c.m.shadow.material.dispose(); }
    },
  };

  // The two who come forward: standing as the others do until the cup is up, then they walk to a place beside
  // you (the game's own gait, arms already up) and celebrate there; they stay there afterwards.
  function walk(c, dt, t, s) {
    const m = c.m, bn = m.bone, r = m.root, p = c.p;
    if (c.mode === 'stand' && c.act === 2 && upT > c.lag + 0.5) { c.mode = 'walk'; c.snapK = 0; }
    if (c.mode === 'stand' || c.mode === 'there') {
      const live = cheer(c, dt, s);
      if (c.mode === 'there') { c.snapK = Math.min(1, c.snapK + dt / 0.35); blendFrom(c, live, smooth(c.snapK)); r.rotation.y += (c.face2 - r.rotation.y) * Math.min(1, dt * 5); }
      look(c, live, s, dt);
      if (c.mode === 'stand') keep(c, bn);
      return;
    }
    const dx = c.go[0] - p.x, dz = c.go[1] - p.z, d = Math.hypot(dx, dz), sp = Math.min(1.7, 0.25 + d * 3.2, (c.sp || 0) + dt * 5);
    c.sp = sp;
    if (d < 0.04) {
      c.mode = 'there'; c.snapK = 0; p.vx = p.vz = 0; c.face2 = Math.atan2(-c.go[0] * 0.5, -1); keep(c, bn); return;
    }
    p.vx = dx / d * sp; p.vz = dz / d * sp; p.x += p.vx * dt; p.z += p.vz * dt; p.fx = p.vx / sp; p.fz = p.vz / sp;
    r.position.set(p.x, c.y, p.z);
    animate(m, p, dt, t, false);
    // arms up as he comes (the take he had them up in), eased in from how he stood
    actPose(ACTS.armsUp, c.t, c.mirror, PC); applyPose(bn, PC, 0.85, PART.upper);
    c.snapK = Math.min(1, c.snapK + dt / 0.3); blendFrom(c, bn, smooth(c.snapK));
    look(c, bn, s, dt);
    keepNow(c, bn);
  }
  // the pose he was in when he changed over, held and faded out of the one he is in now
  function keep(c, bn) { keepNow(c, bn); c.snap = c.now; c.now = null; }
  function keepNow(c, bn) { const o = c.now || (c.now = {}); for (const n in bn) (o[n] || (o[n] = new THREE.Quaternion())).copy(bn[n].quaternion); o.y = bn.hips.position.y; }
  function blendFrom(c, bn, k) {
    if (!c.snap || k >= 1) return;
    for (const n in bn) if (c.snap[n]) { qa.copy(bn[n].quaternion); bn[n].quaternion.copy(c.snap[n]).slerp(qa, k); }
    bn.hips.position.y = c.snap.y + (bn.hips.position.y - c.snap.y) * k;
  }
  for (const c of cast) api.tris += c.m.mesh.geometry.index ? c.m.mesh.geometry.index.count / 3 : c.m.mesh.geometry.attributes.position.count / 3;
  return api;
}
