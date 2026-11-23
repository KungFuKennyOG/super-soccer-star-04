// Ragdolls for men sent flying (rules/brawl/hits.js). Each joint of the skeleton is a point mass (Verlet),
// held to its neighbours by sticks the length of the bones, with braces across the trunk so it stays a
// trunk, gravity, the grass with friction, and a few limits so knees and elbows don't fold into themselves.
// Every frame the bones are turned to lie along the sticks, so the skinned mesh flops as the points do.
// It starts from the pose he was in at the moment of the hit, moving with the hit's velocity and a tumble,
// and is pulled gently toward where the sim says his body is, so the sim and the picture agree on where he
// lands. Getting up is game/brawl/getup.js (startGetUp reads the pose it ends in).
// A man going down is not a rag, so four things are added that a rag hasn't got (TONE below): his arms go out
// in front of him the way he is falling, to break the fall; an arm that lands holds for a moment and then
// gives; his head is kept up off the grass; and his legs don't fold flat under him. All are full strength in a trip (a fouled man going
// over at 2 to 4 m/s) and mostly gone in a man sent flying at 9 m/s or more, who has no time for any of it.
import * as THREE from 'three';

// The points: [name, bone it sits on]. Each is the bone's own origin (its joint).
const PTS = ['hips', 'spine', 'chest', 'head', 'upperArmL', 'foreArmL', 'handL', 'upperLegL', 'lowerLegL', 'footL', 'toeL',
  'upperArmR', 'foreArmR', 'handR', 'upperLegR', 'lowerLegR', 'footR', 'toeR'];
const I = Object.fromEntries(PTS.map((n, i) => [n, i]));
const STICKS = [
  ['hips', 'spine'], ['spine', 'chest'], ['chest', 'head'],
  ['chest', 'upperArmL'], ['chest', 'upperArmR'], ['upperArmL', 'upperArmR'],
  ['upperArmL', 'foreArmL'], ['foreArmL', 'handL'], ['upperArmR', 'foreArmR'], ['foreArmR', 'handR'],
  ['hips', 'upperLegL'], ['hips', 'upperLegR'], ['upperLegL', 'upperLegR'],
  ['upperLegL', 'lowerLegL'], ['lowerLegL', 'footL'], ['footL', 'toeL'], ['upperLegR', 'lowerLegR'], ['lowerLegR', 'footR'], ['footR', 'toeR'],
  // braces: the trunk is a box, the head sits on the shoulders, the feet keep their shape
  ['upperArmL', 'upperLegL'], ['upperArmR', 'upperLegR'], ['upperArmL', 'upperLegR'], ['upperArmR', 'upperLegL'],
  ['spine', 'upperArmL'], ['spine', 'upperArmR'], ['head', 'upperArmL'], ['head', 'upperArmR'], ['spine', 'upperLegL'], ['spine', 'upperLegR'],
  ['lowerLegL', 'toeL'], ['lowerLegR', 'toeR'],
];
// at least this share of the straight length apart: a knee or an elbow can bend, not fold flat
const LIMITS = [['upperArmL', 'handL', 0.45], ['upperArmR', 'handR', 0.45], ['upperLegL', 'footL', 0.5], ['upperLegR', 'footR', 0.5],
  ['head', 'hips', 0.85], ['handL', 'upperLegL', 0.2], ['handR', 'upperLegR', 0.2]];
const RAD = PTS.map(n => (n === 'head' ? 0.12 : n.startsWith('toe') || n.startsWith('foot') ? 0.05 : n.startsWith('hand') ? 0.05 : 0.1));

const v = () => new THREE.Vector3();
const tmp = v(), tmp2 = v(), tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion(), mtx = new THREE.Matrix4();

// The bones' rest directions in the model's frame (no rotations): from each bone's joint to the joint that
// ends it. Worked out once from the skeleton's rest offsets.
let REST = null;
function restOf(bn) {
  if (REST) return REST;
  const pos = {};
  const walk = (b, at) => { const p = at.clone().add(b.userData.rest); pos[b.name] = p; for (const c of b.children) if (c.isBone) walk(c, p); };
  walk(bn.root, v());
  const dir = (a, b) => v().subVectors(pos[b], pos[a]).normalize();
  REST = { pos, dir: {
    upperArmL: dir('upperArmL', 'foreArmL'), foreArmL: dir('foreArmL', 'handL'), upperArmR: dir('upperArmR', 'foreArmR'), foreArmR: dir('foreArmR', 'handR'),
    upperLegL: dir('upperLegL', 'lowerLegL'), lowerLegL: dir('lowerLegL', 'footL'), upperLegR: dir('upperLegR', 'lowerLegR'), lowerLegR: dir('lowerLegR', 'footR'),
    footL: dir('footL', 'toeL'), footR: dir('footR', 'toeR'),
  } };
  return REST;
}

// Start a ragdoll on model m from the pose it's in. vel: { x, y, z } the hit's velocity (m/s).
export function startRagdoll(m, vel) {
  const bn = m.bone;
  restOf(bn);
  m.root.updateMatrixWorld(true);
  const p = PTS.map(n => bn[n].getWorldPosition(v()));
  const com = p.reduce((a, q) => a.add(q), v()).multiplyScalar(1 / p.length);
  const h = Math.hypot(vel.x, vel.z) || 1, axis = v().set(vel.z / h, 0, -vel.x / h);
  // how much of him is still his own: all of it in a trip, a quarter when he is launched (and the less he spins about his length)
  const tone = Math.min(1, Math.max(0.25, (9 - Math.hypot(vel.x, vel.y, vel.z)) / 4.5));
  // tumble: head over heels the way he's knocked (a tripped man only pitches forward onto his hands: his feet are
  // held back and the rest of him goes on), plus a little spin about his length
  const w = Math.min(14, (2.5 + h * 0.45) * (1 - tone) + (0.7 + h * 0.42) * tone);
  const spin = v().subVectors(p[I.head], p[I.hips]).normalize().multiplyScalar((Math.random() - 0.5) * 6 * (1.15 - tone));
  const dt = H, prev = p.map(q => {
    const r = v().subVectors(q, com), tang = v().crossVectors(axis, r).multiplyScalar(w).add(v().crossVectors(spin, r));
    return q.clone().sub(tmp.set(vel.x, vel.y, vel.z).add(tang).multiplyScalar(dt));
  });
  const len = STICKS.map(([a, b]) => p[I[a]].distanceTo(p[I[b]]));
  const lim = LIMITS.map(([a, b, k]) => ({ a: I[a], b: I[b], min: chainLen(a, b, p) * k, len: chainLen(a, b, p), k, arm: a.startsWith('upperArm'), leg: a.startsWith('upperLeg') && b.startsWith('foot') }));
  m.rag = { p, prev, len, lim, t: 0, acc: 0, tone, hit: -1, arm: p[I.upperArmL].distanceTo(p[I.foreArmL]) + p[I.foreArmL].distanceTo(p[I.handL]) };
  m.root.position.set(0, 0, 0); m.root.rotation.set(0, 0, 0);
  m.strike = null; m.special = null;
}

// The length of a limb laid straight (shoulder to hand, hip to foot), for the limits.
function chainLen(a, b, p) {
  const chains = { upperArmL: ['upperArmL', 'foreArmL', 'handL'], upperArmR: ['upperArmR', 'foreArmR', 'handR'], upperLegL: ['upperLegL', 'lowerLegL', 'footL'], upperLegR: ['upperLegR', 'lowerLegR', 'footR'] };
  const c = chains[a];
  if (c && c[c.length - 1] === b) { let s = 0; for (let i = 1; i < c.length; i++) s += p[I[c[i - 1]]].distanceTo(p[I[c[i]]]); return s; }
  return p[I[a]].distanceTo(p[I[b]]);
}

// Step the points, in fixed sub-steps of H (Verlet wants an even step). at: where the sim has his body
// ({ x, z }), or null.
const H = 1 / 120;
export function stepRagdoll(m, dt, at) {
  const R = m.rag, { p, prev } = R;
  R.t += dt; R.acc = Math.min(R.acc + dt, 0.05);
  while (R.acc >= H) {
    R.acc -= H;
    for (let i = 0; i < p.length; i++) {
      const q = p[i], o = prev[i];
      tmp.subVectors(q, o).multiplyScalar(0.998);
      o.copy(q);
      q.add(tmp); q.y -= 9.81 * H * H;
    }
    tone(R);
    for (let k = 0; k < 5; k++) {
      STICKS.forEach(([a, b], j) => solve(p[I[a]], p[I[b]], R.len[j], 1));
      for (const l of R.lim) { const d = p[l.a].distanceTo(p[l.b]); if (d < l.min) solve(p[l.a], p[l.b], l.min, 0.5); }
      for (let i = 0; i < p.length; i++) {
        const q = p[i], r = RAD[i];
        if (q.y < r) {
          q.y = r;
          // friction on the grass: some of the slide this step is lost
          const o = prev[i]; o.x += (q.x - o.x) * 0.08; o.z += (q.z - o.z) * 0.08;
        }
      }
    }
  }
  // drift toward where the sim has him (sideways only), so they agree on where he lands. In the air it is his
  // middle that follows the sim. Once he is down it is the spot he will get up on: a man gets up over his
  // feet, about half a metre from his hips (STAND, from the recorded get-ups in game/brawl/getup.js), and the
  // sim stands him on its own spot, so the body comes to rest with that spot under the sim's.
  if (at) {
    const c = tmp2.set(0, 0, 0), hips = p[I.hips], head = p[I.head];
    for (const q of p) c.add(q);
    c.multiplyScalar(1 / p.length);
    R.settle = (R.settle || 0) + ((hips.y < 0.4 && R.t > 0.25 ? 1 : 0) - (R.settle || 0)) * Math.min(1, dt * 2.5);
    const ax = head.x - hips.x, az = head.z - hips.z, al = Math.hypot(ax, az) || 1;
    c.x += (hips.x - ax / al * STAND - c.x) * R.settle; c.z += (hips.z - az / al * STAND - c.z) * R.settle;
    const k = Math.min(1, dt * 5), dx = (at.x - c.x) * k, dz = (at.z - c.z) * k;
    for (let i = 0; i < p.length; i++) { p[i].x += dx; p[i].z += dz; prev[i].x += dx; prev[i].z += dz; }
  }
}
const STAND = 0.55;
// What a falling man does that a rag doesn't (once a sub-step, before the sticks are solved).
// TONE: reach, how hard the hands are drawn out in front of him each sub-step; brace, how straight a landed arm
// is held (share of its length, on top of the rag's 0.45) for `hold` s before it gives over `give` s; legs, the
// same for a leg (on top of 0.5) over the first `stiff` s; until, when he stops trying (s after the hit).
const TONE = { reach: 0.13, brace: 0.42, hold: 0.12, give: 0.4, legs: 0.22, stiff: 0.9, until: 1.5 };
const dirv = v(), sh = v();
function tone(R) {
  const { p, prev } = R, T = R.tone, chest = p[I.chest];
  // which way he is going: his chest's own travel this step, flat, plus down
  dirv.subVectors(chest, prev[I.chest]); const vy = dirv.y / H; dirv.y = 0;
  const sp = dirv.length() / H, live = R.t < TONE.until ? 1 : Math.max(0, 1 - (R.t - TONE.until) / 0.4);
  let down = false;
  for (const s of ['L', 'R']) if (p[I['hand' + s]].y < RAD[I['hand' + s]] + 0.015) down = true;
  if (down && R.hit < 0 && R.t > 0.08) R.hit = R.t;
  // hands out: only while he is coming down (not on the way up from a big hit), and until they have landed and given
  const falling = (vy < -0.3 || chest.y < 1.0) && chest.y > 0.2, k = TONE.reach * T * live * (falling ? 1 : 0) * (R.hit < 0 ? 1 : Math.max(0, 1 - (R.t - R.hit) / (TONE.hold + TONE.give)));
  if (k > 0 && sp > 0.3) {
    dirv.multiplyScalar(1 / (sp * H));
    for (const s of ['L', 'R']) {
      const hand = p[I['hand' + s]], i = I['hand' + s];
      // (out along the fall and down, a little wide of the shoulder; nearer the ground it is more down than along)
      sh.copy(p[I['upperArm' + s]]).addScaledVector(dirv, R.arm * 0.62).addScaledVector(tmp.subVectors(p[I['upperArm' + s]], chest).setY(0), 0.5);
      sh.y -= R.arm * 0.66;
      tmp.subVectors(sh, hand).multiplyScalar(k);
      hand.add(tmp); prev[i].addScaledVector(tmp, 0.6);
      const el = I['foreArm' + s]; tmp.multiplyScalar(0.5); p[el].add(tmp); prev[el].addScaledVector(tmp, 0.6);
    }
  }
  // his head is held up off the grass (chin up, as a man landing on his front holds it) while he is still trying
  const chin = chest.y + 0.05 * T * live - p[I.head].y;
  if (chin > 0 && chest.y < 0.5) { p[I.head].y += chin * 0.5; prev[I.head].y += chin * 0.5; }
  // a landed arm holds, then gives; his legs keep some of their length for the first second
  const brace = R.hit < 0 ? (falling ? 0.5 : 0) : R.t - R.hit < TONE.hold ? 1 : Math.max(0, 1 - (R.t - R.hit - TONE.hold) / TONE.give);
  for (const l of R.lim) {
    if (l.arm) l.min = l.len * (l.k + TONE.brace * T * brace * live);
    else if (l.leg) l.min = l.len * (l.k + TONE.legs * T * Math.max(0, 1 - R.t / TONE.stiff));
  }
}
function solve(a, b, L, stiff) {
  tmp.subVectors(b, a);
  const d = tmp.length() || 1e-6, k = (d - L) / d * 0.5 * stiff;
  a.addScaledVector(tmp, k); b.addScaledVector(tmp, -k);
}

// A frame: x along xv, y along yv (orthonormalised), z = x × y.
function frame(xv, yv, out) {
  const y = tmp.copy(yv).normalize(), x = tmp2.copy(xv).addScaledVector(y, -xv.dot(y)).normalize(), z = v().crossVectors(x, y);
  mtx.makeBasis(x, y, z);
  return out.setFromRotationMatrix(mtx);
}

// Turn the bones to lie along the points. The model's root sits at the origin with no turn, so bone world
// rotations are worked out directly and handed down the chain as local ones.
export function poseRagdoll(m) {
  const bn = m.bone, R = m.rag, p = R.p, REST_ = restOf(bn), W = {};
  m.root.position.set(0, 0, 0); m.root.rotation.set(0, 0, 0);
  for (const b of Object.values(bn)) { b.position.copy(b.userData.rest); b.scale.set(1, 1, 1); }
  bn.root.quaternion.identity();
  const P = n => p[I[n]];
  W.hips = frame(v().subVectors(P('upperLegL'), P('upperLegR')), v().subVectors(P('spine'), P('hips')), new THREE.Quaternion());
  W.spine = frame(v().subVectors(P('upperArmL'), P('upperArmR')), v().subVectors(P('chest'), P('spine')), new THREE.Quaternion());
  W.chest = frame(v().subVectors(P('upperArmL'), P('upperArmR')), v().subVectors(P('head'), P('chest')), new THREE.Quaternion());
  W.neck = W.chest; W.head = W.chest;
  // the hips' place: the hips point, less where its rest offset under the root would put it
  bn.hips.position.copy(P('hips'));
  const swing = (name, parentQ, to) => {
    const rest = tmp.copy(REST_.dir[name]).applyQuaternion(parentQ), cur = tmp2.subVectors(P(to), P(name)).normalize();
    return new THREE.Quaternion().setFromUnitVectors(rest, cur).multiply(parentQ);
  };
  for (const s of ['L', 'R']) {
    W['clavicle' + s] = W.chest;
    W['upperArm' + s] = swing('upperArm' + s, W.chest, 'foreArm' + s);
    W['foreArm' + s] = swing('foreArm' + s, W['upperArm' + s], 'hand' + s);
    W['hand' + s] = W['foreArm' + s];
    W['upperLeg' + s] = swing('upperLeg' + s, W.hips, 'lowerLeg' + s);
    W['lowerLeg' + s] = swing('lowerLeg' + s, W['upperLeg' + s], 'foot' + s);
    W['foot' + s] = swing('foot' + s, W['lowerLeg' + s], 'toe' + s);
    W['toe' + s] = W['foot' + s];
  }
  // world to local, down the tree
  const walk = (b, parentQ) => {
    const wq = W[b.name] || parentQ;
    b.quaternion.copy(tq.copy(parentQ).invert().multiply(wq));
    for (const c of b.children) if (c.isBone) walk(c, wq);
  };
  walk(bn.hips, tq2.identity().clone());
}

// The old get-up (a blend from lying to standing: he swings up like a plank). game/brawl/view.js still calls these two
// until it is wired to game/brawl/getup.js (startGetUp / poseGetUp); delete them then.
// Remember the ragdoll's last pose in the frame of where he'll stand, then each frame of the
// get-up, after the normal animation has posed him, ease from that pose into it. k: 0 → 1.
export function holdForGetUp(m) {
  const bn = m.bone;
  poseRagdoll(m);
  m.root.updateMatrixWorld(true);
  m.getUp = { q: {}, hips: null };
  for (const [n, b] of Object.entries(bn)) m.getUp.q[n] = b.quaternion.clone();
  m.getUp.hipsW = bn.hips.position.clone();
  m.rag = null;
}
export function getUpBlend(m, k) {
  const G = m.getUp, bn = m.bone;
  if (!G) return;
  const e = k * k * (3 - 2 * k);
  // the lying hips, in the frame of the root as the animation has placed it
  m.root.updateMatrixWorld(true);
  const rq = m.root.quaternion, inv = tq.copy(rq).invert();
  const hipsL = tmp.copy(G.hipsW).sub(m.root.position).applyQuaternion(inv);
  for (const [n, b] of Object.entries(bn)) {
    if (!G.q[n]) continue;
    const from = n === 'hips' ? tq2.copy(inv).multiply(G.q[n]) : G.q[n];
    b.quaternion.copy(from.clone().slerp(b.quaternion, e));
  }
  bn.hips.position.lerpVectors(hipsL, bn.hips.position, e);
  if (k >= 1) m.getUp = null;
}
