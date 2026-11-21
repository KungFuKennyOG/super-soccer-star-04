// Players in the early-2000s FIFA style: one continuous skinned mesh per player (body.js) wearing a
// painted texture sheet (atlas.js), posed every frame by a procedural run cycle.
import * as THREE from 'three';
import { BALL } from '../rules/tuning.js';
import { ps1 } from './ps1.js';
import { SKINS, HAIRS, blobTex, arrowTex } from './tex.js';
import { playerAtlas } from './atlas.js';
import { toneOf, HAIRS as LHAIRS, stylePS1 } from '../rules/looks.js';
import { buildBody, restPose } from './body.js';
import { animateKeeper, keeperRuns, keeperRan } from './keeperpose.js';
import { strideRate } from '../rules/dribble.js';
import { poseStrike, poseTouch, poseHold } from './strike.js';
import { faceBody, poseLegs, leanHips } from './gait.js';
import { poseUpper, layerLean, layerReady, layerBreath, layerKick, layerLook, strikeSwing } from './carriage.js';
import { specialPose, dancePose, celebratePose } from './poses.js';
import { strideLegs, strideTrunk } from './mocap.js';
import { kickTrunk, isKick } from './kickcap.js';
import { sway } from './sway.js';
import { layerDribble, dribbleGlance } from './dribblecap.js';
import { trickHips, trickLegs, trickBody, trickHead } from './tricks.js';
import { settle, remember } from './inertia.js';
import { chargeLevel, chargeLegs, layerCharge } from './windup.js';
import { beatWatch, beatLegs, beatBody, beatHead } from './beaten.js';

const matCache = new Map();
const mat = (key, make) => { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); };

// kit: a kit spec from rules/teams.js; look picks skin, hair, hairstyle and stubble.
// boots: a locker color (0 black, 1 white, 2 red, 3 gold).
// ap: a look from rules/looks.js (pickSquad) in place of `look`'s: its tone, hair color, hairstyle and stubble.
export function buildPlayer(kit, num, look = 0, { feetOnly = false, boots = 0, ap = null } = {}) {
  let skin = SKINS[look % SKINS.length], hair = HAIRS[(look * 3 + 1) % HAIRS.length];
  let style = [0, 0, 2, 0, 5, 1, 0, 2, 3, 0, 5, 0, 2, 4][look % 14], stubble = look % 3 !== 0;   // mostly short hair, most with stubble
  if (ap) { skin = toneOf(ap); hair = LHAIRS[ap.hair]; style = stylePS1(ap.style, ap.face); stubble = ap.stubble; }
  const tex = playerAtlas({ kit, num, skin, hair, style, stubble, feetOnly, boots });
  const material = mat(tex.uuid, () => ps1(feetOnly ? { map: tex, alphaTest: 0.5, vertexColors: true, pop: true } : { map: tex, vertexColors: true, pop: true }));
  const { mesh, bone } = buildBody(material, style);
  const root = new THREE.Group();
  root.add(mesh);
  return { root, mesh, bone, shadow: blob(), phase: Math.random() * 6, strike: null };
}

// You, in first person: the same body, but only your boots and lower socks are drawn.
export function buildYou(kit, boots = 0) {
  const m = buildPlayer(kit, 7, 1, { feetOnly: true, boots });
  m.firstPerson = true;
  return m;
}

/* ---------- animation ---------- */

// Standing, walking and running (game/gait.js for the hips and legs, game/carriage.js above them, captured
// strides from game/mocap.js over both when he runs forward), strikes and dribbling touches
// (game/strike.js), springs for weight (game/sway.js), headers, the dance and celebrating (game/poses.js).
// p is the sim player (his p.stride drives the run cycle, so the sim's touches are the boot's); the keeper
// has his own (game/keeperpose.js). Place the model (placeModel) before posing it: the boot is sent to the
// ball, and the model's heading is eased from the one placeModel gave it.
// ball: the sim ball, for the keeper and for the boot to meet; onBall: he has it at his feet.
// The boot that does the work is the right one, or the left for a left-footed player (below).
export function animate(m, p, dt, t, celebrate, guide = null, ball = null, onBall = false) {
  // the keeper has his own (game/keeperpose.js), except when he runs off his line flat out
  if (p.role === 'gk') { if (!keeperRuns(m, p)) animateKeeper(m, p, dt, t, ball); else { pose(m, p, dt, t, false, null, ball, false); keeperRan(m, dt); } return; }
  if (m.foot !== 'L' || m.firstPerson) return pose(m, p, dt, t, celebrate, guide, ball, onBall);
  // A left-footed player (m.foot 'L', game/squad.js) is posed as his right-footed twin in a mirror standing
  // on the pitch's long axis (x → -x: his place, velocity, facing, the ball, a strike's direction), then the
  // pose is mirrored back onto him. So every touch, strike and pass is his left boot's, and nothing that puts
  // a boot on the ball needs to know. The twin's world is a whole one, so what the poses remember between
  // frames (footprints, heading, springs) stays true in it.
  const r = m.root, st = m.strike, flip = v => (v === undefined ? v : -v);
  const pm = Object.create(p); pm.x = flip(p.x); pm.vx = flip(p.vx); pm.fx = flip(p.fx);
  let bm = null, gm = guide;
  if (ball) { bm = Object.create(ball); bm.x = -ball.x; bm.vx = flip(ball.vx); }
  if (guide && (guide.move === 'left' || guide.move === 'right')) { gm = Object.create(guide); gm.move = guide.move === 'left' ? 'right' : 'left'; }   // the dance's arm signals stay on the side they were called
  r.position.x = -r.position.x; r.rotation.y = -r.rotation.y;
  if (st) st.dir.x = -st.dir.x;
  pose(m, pm, dt, t, celebrate, gm, bm, onBall);
  if (st) st.dir.x = -st.dir.x;
  r.position.x = -r.position.x; r.rotation.y = -r.rotation.y;      // (back out of the mirror, from wherever the pose left him: game/beaten.js moves a man thrown by a fake)
  mirrorPose(m.bone);
  if (m.cloth) m.cloth.uCloth.value.x *= -1;
}

// A pose seen in a mirror down the body's middle: left and right bones change places and every turn is reflected.
const sides = new WeakMap(), qm = new THREE.Quaternion();
function mirrorPose(bn) {
  let k = sides.get(bn);
  if (!k) { const names = Object.keys(bn); sides.set(bn, k = { pairs: names.filter(n => n.endsWith('L') && bn[n.slice(0, -1) + 'R']).map(n => n.slice(0, -1)), mid: names.filter(n => !(/[LR]$/.test(n) && bn[n.slice(0, -1) + (n.endsWith('L') ? 'R' : 'L')])) }); }
  for (const n of k.mid) { const q = bn[n].quaternion; q.set(q.x, -q.y, -q.z, q.w); }
  for (const n of k.pairs) { const l = bn[n + 'L'].quaternion, rq = bn[n + 'R'].quaternion; qm.set(l.x, -l.y, -l.z, l.w); l.set(rq.x, -rq.y, -rq.z, rq.w); rq.copy(qm); }
  bn.hips.position.x = -bn.hips.position.x;
}

function pose(m, p, dt, t, celebrate, guide, ball, onBall) {
  posed(m, p, dt, t, celebrate, guide, ball, onBall);
  // a movement that took him over at once this frame (a kick's wind-up) has the old one eased into it (game/inertia.js)
  settle(m, m.bone, dt); remember(m, m.bone, dt);
}
function posed(m, p, dt, t, celebrate, guide, ball, onBall) {
  const bn = m.bone;
  restPose(bn);
  if (m.bigHead) bn.head.scale.setScalar(1.65);           // the big-heads cheat (locker)
  // a defender who has just been beaten, or is going in for the ball (game/beaten.js)
  const def = p.role === 'def';
  if (def) p = beatWatch(m, p, dt, onBall);
  const s = Math.hypot(p.vx, p.vz);
  if (p.stride === undefined) m.phase += dt * strideRate(s); else m.phase = p.stride;
  // the body turns after the sim's facing; then legs, feet and hips: the feet follow their paths over the
  // ground and the legs are bent to them (set before the boot is sent to the ball, so it lands on it)
  if (!m.firstPerson) faceBody(m, p, dt, celebrate || guide ? null : ball, onBall || !!m.strike);
  const g = poseLegs(m, bn, p, dt);
  // running and walking forward are motion capture (game/mocap.js), laid over that gait; the lean into a
  // turn that the captured pelvis took the place of is put back, over the same footprints
  const cap = strideLegs(m, bn, g, dt, onBall ? ball : null);
  if (cap > 0 && !m.firstPerson) leanHips(bn, g, cap);
  // holding the trigger (a shot charging) or the pass ring: he shapes up to strike it as he runs (game/windup.js)
  if (chargeLevel(m, dt) > 0) chargeLegs(m, bn);
  if (def) beatLegs(m, bn, ball);
  if (m.special) { m.special.t += dt; if (m.special.t > 0.9) m.special = null; }
  const sp = m.special;
  // a skill move or a trick (game/tricks.js) is the whole body's: the hips first (the roulette's spin, how
  // low he sits), then the boot on the ball, then the other leg, and the trunk, arms and head further down
  const trk = trickHips(m, bn, p, ball, dt);
  // the right boot goes to the ball: a strike swinging through it, a touch on the run, or a skill's
  // hold on it (the sole of a drag-back or roulette, the step-over's circle)
  let kick = 0;
  const st = m.strike;
  if (ball && st) { kick = poseStrike(m, bn, ball, dt); if (!onBall && isKick(st.kind)) m.onBallK = Math.max(0, (m.onBallK || 0) - dt * 8); }      // (a shot or a pass struck: he is off the ball, and his legs are no longer kept in time with touches)
  else if (ball) { poseTouch(m, bn, p, ball, onBall, dt); if (sp && HOLDS.includes(sp.kind)) poseHold(m, bn, sp, ball); }
  if (trk && ball) trickLegs(m, bn, trk, ball);
  if (sp && sp.kind === 'bicycle') { specialPose(bn, sp); if (m.firstPerson) bn.chest.scale.setScalar(0.001); return; }
  if (m.firstPerson) { bn.chest.scale.setScalar(0.001); return; }

  // above the hips: how he carries himself, with the captured trunk and arms over that when he is running
  // forward; then what is laid over either: lean (the capture has its own forward pitch), the ready crouch,
  // breath, a strike's arms (eased in: a teammate's strike starts on the ball), the head on the ball (and
  // down a little in a sprinter's drive), and weight: springs knocked by stops, cuts, turns and footfalls
  poseUpper(m, bn, g, dt, t);
  m.kickK = (m.kickK || 0) + (kick - (m.kickK || 0)) * Math.min(1, dt * 22);
  if (cap > 0) strideTrunk(m, bn, g, 1 - m.kickK);
  layerLean(bn, g, 1 - cap); layerReady(bn, g); layerBreath(bn, g, dt);
  if (!kickTrunk(m, bn)) layerKick(bn, m.kickK, strikeSwing(st));     // a recorded kick's trunk and arms (game/kickcap.js), or the hand-built layer for a poke, a scoop, a heel
  // on the ball: over it, arms wider, eyes on it for each touch and up for a look in between (game/dribblecap.js)
  const ob = (m.onBallK || 0) * (1 - m.kickK), up = ob > 0.5 && !st && dribbleGlance(m, p, dt);
  layerDribble(bn, g, ob, m.drive || 0);
  layerCharge(m, bn);
  if (def) beatBody(m, bn);
  if (trk) trickBody(m, bn, trk);
  layerLook(m, bn, g, celebrate || up ? null : ball, dt, 0.22 * (m.drive || 0));
  if (trk) trickHead(bn, trk);
  if (def) beatHead(m, bn, ball);
  sway(m, bn, p, dt, g);
  if (guide && p.role === 'mate') { dancePose(bn, guide); return; }
  if (sp && sp.kind === 'header') specialPose(bn, sp);
  m.cheerK = Math.min(1, Math.max(0, (m.cheerK || 0) + (celebrate ? dt : -dt) * 4));       // arms go up, and come down, in a quarter of a second
  if (m.cheerK > 0) celebratePose(bn, g, t, m.cheerK * m.cheerK * (3 - 2 * m.cheerK));
}

// Skill moves and the drag-back are posed on the ball by game/strike.js (m.special = { kind, t }).
const HOLDS = ['drag', 'roulette', 'stepover'];

// The middle of a player's two hands in world space (out): where the keeper holds the ball.
const handA = new THREE.Vector3(), handB = new THREE.Vector3();
export function handsOf(m, out) {
  m.root.updateMatrixWorld(true);
  m.bone.handL.getWorldPosition(handA); m.bone.handR.getWorldPosition(handB);
  return out.copy(handA).add(handB).multiplyScalar(0.5);
}

// Shadows fall away from the floodlight behind your left shoulder, stretched like the PS2-era ones.
const SHADOW_DIR = { x: 0.26, z: -0.12, ang: Math.atan2(0.26, -0.12) };
export function placeModel(m, p) {
  m.root.position.set(p.x, 0, p.z);
  m.root.rotation.y = Math.atan2(p.fx, p.fz);
  m.shadow.position.set(p.x + SHADOW_DIR.x, 0.02, p.z + SHADOW_DIR.z);
}

/* ---------- ball ---------- */

// Ball designs (the locker, game/display.js), plus the orange snow ball: [panel, pentagon, alt pentagon].
const BALLS = {
  CLASSIC: [[0.95, 0.95, 0.92], [0.08, 0.08, 0.1]],
  ORANGE: [[0.98, 0.5, 0.08], [0.1, 0.06, 0.04]],
  STAR: [[0.96, 0.96, 0.94], [0.8, 0.08, 0.12], [0.08, 0.14, 0.5]],
  RETRO: [[0.62, 0.38, 0.16], [0.42, 0.24, 0.1], [0.74, 0.5, 0.24]],
  GOLD: [[0.95, 0.76, 0.22], [0.36, 0.22, 0.06], [0.8, 0.58, 0.14]],
};
// A detail-2 icosahedron with patches around the 12 original corners: the 90s low-poly ball.
// setDesign(name) repaints it.
export function buildBall() {
  const g = new THREE.IcosahedronGeometry(BALL.r, 2); // already non-indexed in r149
  const ico = new THREE.IcosahedronGeometry(1, 0), corners = [];
  const ip = ico.attributes.position;
  for (let i = 0; i < ip.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(ip, i).normalize();
    if (!corners.some(c => c.distanceTo(v) < 1e-3)) corners.push(v);
  }
  // which pentagon (corner) each face belongs to, or -1 for the panels between
  const p = g.attributes.position, face = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    const mid = a.add(b).add(c).normalize();
    face.push(corners.findIndex(k => k.dot(mid) > 0.94));
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(p.count * 3), 3));
  const paint = name => {
    const d = BALLS[name] || BALLS.CLASSIC, col = g.attributes.color;
    face.forEach((k, f) => { const rgb = k < 0 ? d[0] : d[2] && k % 2 ? d[2] : d[1]; for (let j = 0; j < 3; j++) col.setXYZ(f * 3 + j, ...rgb); });
    col.needsUpdate = true;
  };
  paint('CLASSIC');
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, ps1({ vertexColors: true, flatShading: true }));
  const shadow = blob(0.45, 0.45);
  const axis = new THREE.Vector3(), q = new THREE.Quaternion();
  return {
    mesh, shadow,
    setDesign: paint,
    update(bl, dt) {
      mesh.position.set(bl.x, bl.y, bl.z);
      const h = Math.hypot(bl.vx, bl.vz);
      if (h > 0.05) { axis.set(bl.vz / h, 0, -bl.vx / h); q.setFromAxisAngle(axis, h / BALL.r * dt); mesh.quaternion.premultiply(q); }
      shadow.position.set(bl.x + bl.y * 0.25, 0.021, bl.z - bl.y * 0.12);
      const s = Math.max(0.35, 1 - bl.y * 0.15); shadow.scale.set(s, s, s);
    },
  };
}

function blob(w = 0.7, l = 1.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat('blob', () => ps1({ map: blobTex(), transparent: true, depthWrite: false, lit: false })));
  m.rotation.set(-Math.PI / 2, 0, -SHADOW_DIR.ang);
  m.renderOrder = 1;
  return m;
}

// The yellow arrow over whoever has the ball (not you).
export function buildArrow() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), ps1({ map: arrowTex(), alphaTest: 0.5, lit: false, side: THREE.DoubleSide }));
  m.visible = false;
  return m;
}
