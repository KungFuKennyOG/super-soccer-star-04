// Goal celebrations on the bodies (rules/celebrate.js has the timelines and moves the players): the knee slide,
// the aeroplane, cupped ears, pointing to the sky, the pile-on, the backflip, what the teammates do in each, and
// the beaten side trudging back. Laid over the pose animate() left (game/actors.js calls cheerPose last).
//   recorded (CMU, game/assets/anim/clips.js): the backflip whole (88_01), a teammate's arms-up cheering (79_69 'very
//     happy', trunk and arms), the beaten side's bowed walk (91_13, 82_10: trunk, head and arms over the walking legs)
//   built from how they are done: kneeling and the slide on knees and shins, getting up through one knee, the
//     aeroplane's arms and banking, hands to the ears, the arm to the sky, the arms round each other in the pile-on
// m.cheer = { c: world.celebrate, role: 'you' | 'mate' | 'opp', side: -1 | 1 (a teammate's), you: the sim's you }.
import * as THREE from 'three';
import { CLIPS, sampleStride, newPose, applyPose, mixPose } from './mocap.js';
import { sampleOnce, newOnce } from './keepercap.js';
import { ankleOf, footOf, reachLeg, aimFoot, reachArm, aimHand } from './legik.js';
import { gaitOf } from './gait.js';
import { ride } from './poses.js';
import { SLIDE, FLIP, PILE, flipShift } from '../rules/celebrate.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), smooth = x => { const k = clamp(x, 0, 1); return k * k * (3 - 2 * k); };
const q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), eul = new THREE.Euler(), v = new THREE.Vector3(), v2 = new THREE.Vector3(), pole = new THREE.Vector3();
const aL = new THREE.Vector3(), aR = new THREE.Vector3(), fL = new THREE.Quaternion(), fR = new THREE.Quaternion(), H0 = new THREE.Vector3(), HQ = new THREE.Quaternion(), FLAT = new THREE.Quaternion();
const UPPER = new Set(['spine', 'chest', 'clavicleL', 'upperArmL', 'foreArmL', 'clavicleR', 'upperArmR', 'foreArmR']);
const BOWED = new Set([...UPPER, 'neck', 'head']);
const BODY = new Set([...BOWED, 'hips', 'upperLegL', 'lowerLegL', 'footL', 'toeL', 'upperLegR', 'lowerLegR', 'footR', 'toeR']);
const JOY = CLIPS.joy, BACK = CLIPS.flip, SAD = [CLIPS.sad, CLIPS.sadB], P1 = newOnce(), P2 = newPose(), P3 = newOnce();
const STAND = 0.93, ANKLE = 0.085, HIPX = 0.09;

// fn poses the bones outright; `w` of that is laid over the pose they had.
const names = new WeakMap(), saved = new Float32Array(32 * 4), HB = new THREE.Vector3();
function blend(bn, w, fn) {
  if (w <= 0.001) return;
  if (w >= 0.999) { fn(); return; }
  let ns = names.get(bn);
  if (!ns) names.set(bn, ns = Object.keys(bn).filter(n => n !== 'root'));
  ns.forEach((n, i) => bn[n].quaternion.toArray(saved, i * 4)); HB.copy(bn.hips.position);
  fn();
  ns.forEach((n, i) => { q.copy(bn[n].quaternion); bn[n].quaternion.fromArray(saved, i * 4).slerp(q, w); });
  bn.hips.position.lerpVectors(HB, v.copy(bn.hips.position), w);
}
// an arm by its angles: x swings it forward (-) or back, z lifts it out to the side (1.57 level, 3 overhead), f folds the elbow
function arm(bn, n, x, z, f, tw = 0) {
  const sd = n === 'L' ? 1 : -1;
  bn['upperArm' + n].rotation.set(x, sd * tw, sd * z); bn['foreArm' + n].rotation.set(-f, 0, 0);
  bn['clavicle' + n].rotation.set(0, 0, sd * clamp((z - 1.2) * 0.25, 0, 0.3));
}
// where a point in the world is in a model's own space (x his left, z ahead of him)
function local(m, wx, wz, out) {
  const dx = wx - m.root.position.x, dz = wz - m.root.position.z, a = m.root.rotation.y, c = Math.cos(a), s = Math.sin(a);
  return out.set(dx * c - dz * s, 0, dx * s + dz * c);
}
// the base of his skull in model space (the trunk must be posed)
function skull(bn, out) {
  q.copy(bn.hips.quaternion); out.copy(bn.spine.position).applyQuaternion(q).add(bn.hips.position);
  q.multiply(bn.spine.quaternion); out.add(v2.copy(bn.chest.position).applyQuaternion(q));
  q.multiply(bn.chest.quaternion); out.add(v2.copy(bn.neck.position).applyQuaternion(q));
  q.multiply(bn.neck.quaternion); return out.add(v2.copy(bn.head.position).applyQuaternion(q));
}

/* ---------- on his knees ---------- */

// Kneeling on both knees, shins and insteps flat on the grass behind him. lean: the trunk back (rad); sit: how far
// he sits back toward his heels (the thighs' angle forward of straight down); spread: knees apart.
function kneel(bn, lean, sit, spread = 0.12) {
  bn.hips.rotation.set(-lean, 0, 0); bn.hips.position.set(0, 0.6, 0);
  for (const n of ['L', 'R']) {
    const sd = n === 'L' ? 1 : -1;
    bn['upperLeg' + n].rotation.set(lean - sit, 0, sd * spread);
    bn['lowerLeg' + n].rotation.set(Math.PI / 2 + sit + 0.04, 0, 0);
    bn['foot' + n].rotation.set(1.3, 0, 0); bn['toe' + n].rotation.set(0, 0, 0);
  }
  // down until the knees are on the grass (the knee's joint is about 5.5 cm inside it)
  q.copy(bn.hips.quaternion).multiply(bn.upperLegL.quaternion);
  const knee = v.copy(bn.upperLegL.position).applyQuaternion(bn.hips.quaternion).add(v2.copy(bn.lowerLegL.position).applyQuaternion(q)).y;
  bn.hips.position.y = 0.055 - knee;
  bn.spine.rotation.set(lean * 0.35, 0, 0); bn.chest.rotation.set(-lean * 0.25, 0, 0);
}
// Up off his knees the way people get up: the right foot is brought through and planted, then he stands over it
// and the left follows. u: 0..1. Call with the kneeling pose on him.
function rise(bn, u) {
  ankleOf(bn, 'L', aL); ankleOf(bn, 'R', aR); footOf(bn, 'L', fL); footOf(bn, 'R', fR);
  H0.copy(bn.hips.position); HQ.copy(bn.hips.quaternion);
  const a = smooth(u / 0.45), b = smooth((u - 0.45) / 0.55);
  bn.hips.position.set(0, H0.y + 0.07 * a + (STAND - 0.015 - H0.y - 0.07) * b, H0.z + 0.05 * a + (0.02 - H0.z - 0.05) * b);
  bn.hips.quaternion.copy(HQ).slerp(q.setFromEuler(eul.set(0.2 * Math.sin(Math.PI * b) + 0.12 * a * (1 - b), 0, 0)), Math.max(a * 0.8, b));
  v.set(-HIPX - 0.02, ANKLE, 0.2).sub(aR).multiplyScalar(a).add(aR); v.y += 0.13 * Math.sin(Math.PI * a);
  reachLeg(bn, 'R', v); aimFoot(bn, 'R', q.copy(fR).slerp(FLAT, smooth(a * 1.3)));
  v.set(HIPX + 0.02, ANKLE, -0.07).sub(aL).multiplyScalar(b).add(aL); v.y += 0.1 * Math.sin(Math.PI * b);
  reachLeg(bn, 'L', v); aimFoot(bn, 'L', q.copy(fL).slerp(FLAT, smooth(b * 1.3)));
  bn.spine.quaternion.slerp(FLAT, b); bn.chest.quaternion.slerp(FLAT, b);
}
// Half way into or out of kneeling nothing may be under the grass: the hips are lifted by whatever a knee, an ankle
// or the ball of a foot is short.
function unsink(bn) {
  let low = 9;
  for (const n of ['L', 'R']) {
    q.copy(bn.hips.quaternion); v.copy(bn['upperLeg' + n].position).applyQuaternion(q).add(bn.hips.position);
    q.multiply(bn['upperLeg' + n].quaternion); v.add(v2.copy(bn['lowerLeg' + n].position).applyQuaternion(q)); low = Math.min(low, v.y - 0.05);
    q.multiply(bn['lowerLeg' + n].quaternion); v.add(v2.copy(bn['foot' + n].position).applyQuaternion(q)); low = Math.min(low, v.y - 0.045);
    q.multiply(bn['foot' + n].quaternion); v.add(v2.copy(bn['toe' + n].position).applyQuaternion(q)); low = Math.min(low, v.y - 0.02);
  }
  if (low < 0) bn.hips.position.y -= low;
}
// how far down a kneeling celebration has him (0..1) and how far up again (0..1)
const downUp = (c, at, len, up) => [smooth((c.t - at) / len), clamp((c.t - (c.T - up - 0.12)) / up, 0, 1)];
const slideDU = c => downUp(c, c.plan.run - 0.1, SLIDE.drop, SLIDE.up), pileDU = c => downUp(c, 0.12, PILE.down, PILE.up);

// How far your own eyes are from where you stand (m, + up): down on your knees, up and over in the backflip.
// The page moves the headset's view by it (never turning it).
export function viewDrop(c) {
  if (!c || !c.kind) return 0;
  if (c.kind === 'slide' || c.kind === 'pile') {
    const [d, u] = c.kind === 'slide' ? slideDU(c) : pileDU(c);
    return -(c.kind === 'slide' ? 0.6 : 0.5) * d * (1 - smooth(u * 1.15));
  }
  if (c.kind === 'flip' && BACK) { const u = c.t - FLIP.at; return u > 0 && u < FLIP.len ? sampleOnce(BACK, u, P1).h[1] - BACK.h[1] : 0; }
  return 0;
}
// your own boots are not drawn while you are upside down
export const hideBoots = c => !!c && c.kind === 'flip' && c.t - FLIP.at > FLIP.air[0] - 0.04 && c.t - FLIP.at < FLIP.air[1] + 0.05;

/* ---------- recorded ---------- */

// The backflip, `u` s into it: the whole body as recorded, his hips' path with the sim's own move taken out of it
// (he is carried back while he is in the air: rules/celebrate.js), so his feet leave and land where they are.
function backflip(bn, u) {
  if (!BACK || u <= 0 || u > FLIP.len + 0.3) return;
  blend(bn, smooth(u / 0.14) * (1 - smooth((u - FLIP.len) / 0.3)), () => {
    const P = sampleOnce(BACK, u, P1), k = flipShift(u);
    applyPose(bn, P, 1, BODY);
    bn.hips.position.set(P.h[0] - BACK.h[0] - FLIP.left * k, P.h[1], P.h[2] - BACK.h[2] + FLIP.back * k);
  });
}
// Arms thrown up, twice, the second time twisting from side to side: the trunk and arms of the recording over his
// own legs, the knees giving as the recording's do.
// (The recording stands with his hands at his chest between the two: only the throws are played, one into the other.)
const THROWS = [[0.1, 0.95], [2.05, 3.3]], FADE = 0.14, JLEN = THROWS[0][1] - THROWS[0][0] + THROWS[1][1] - THROWS[1][0] - 2 * FADE;
function joy(bn, tt, w) {
  if (!JOY || w <= 0) return;
  const a = THROWS[0], b = THROWS[1], la = a[1] - a[0] - FADE, u = ((tt % JLEN) + JLEN) % JLEN;
  // in the first throw, or the second; each begins with the tail of the other fading out
  const [cur, prev, at] = u < la ? [a, b, u] : [b, a, u - la];
  const P = sampleOnce(JOY, cur[0] + at, P1);
  if (at < FADE) mixPose(sampleOnce(JOY, prev[1] - FADE + at, P3), P, smooth(at / FADE), P);
  applyPose(bn, P, w, UPPER);
  ride(bn, w * Math.min(0, P.h[1] - JOY.h[1]));
}

/* ---------- each celebration ---------- */

function slide(m, bn, ch, p, t) {
  const c = ch.c, you = ch.role === 'you', [d0, u] = slideDU(c), seed = gaitOf(m).seed;
  if (!you && ch.side > 0) { joy(bn, c.t - c.plan.stop + seed, arrived(m, p, c.t > c.plan.stop) * (1 - smooth((c.t - (c.T - 0.5)) / 0.4))); return; }       // the one who arrives behind: arms up over you
  // the one beside you goes down as he gets there, a moment after you
  const d = you ? d0 : arrived(m, p, c.t > c.plan.stop - 0.3, 3.2, 5);
  if (d <= 0) { if (you) wings(bn, smooth(c.t / 0.5), 0, 0.5); return; }
  const going = you ? clamp(Math.hypot(p.vx, p.vz) / 3, 0, 1) : 1 - smooth((c.t - c.plan.stop) / 0.5), late = you ? 0 : 0.3;
  blend(bn, d * (1 - smooth((u - late - 0.82) / 0.18)), () => {
    kneel(bn, 0.12 + 0.3 * going, 0.2 + 0.28 * going, 0.14);
    bn.neck.rotation.set(-0.12 - 0.3 * going, 0, 0); bn.head.rotation.set(-0.1 * going, 0, 0);
    // sliding: arms out wide and a little behind, chest out; stopped: both fists up, shaken
    const up = (1 - going) * (1 - u), shake = 0.12 * Math.sin(t * 11 + seed * 9) * up;
    for (const n of ['L', 'R']) arm(bn, n, 0.35 * going - 0.3 * up, 1.25 + 1.2 * up + shake, 0.15 + 0.7 * up);
    if (u - late > 0) rise(bn, clamp((u - late) / (1 - late), 0, 1));
  });
  unsink(bn);
}
// arms out like wings, level, the whole of him banking with the turn
function wings(bn, w, bank, level = 1) {
  if (w <= 0) return;
  for (const n of ['L', 'R']) {
    const sd = n === 'L' ? 1 : -1, ua = bn['upperArm' + n], fa = bn['foreArm' + n];
    ua.quaternion.slerp(q.setFromEuler(eul.set(0.12, 0, sd * (1.38 * level + 0.9 * (1 - level)))), w); fa.quaternion.slerp(q.setFromEuler(eul.set(-0.08, 0, 0)), w);
    bn['hand' + n].quaternion.slerp(FLAT, w); bn['clavicle' + n].rotation.z += sd * 0.08 * w;
  }
  bn.spine.rotation.z += bank * 0.45 * w; bn.chest.rotation.z += bank * 0.55 * w; bn.neck.rotation.z -= bank * 0.6 * w;
}
function plane(m, bn, ch, p, t) {
  const c = ch.c, seed = gaitOf(m).seed, w = smooth((c.t - (ch.role === 'you' ? 0 : 0.25 + 0.3 * seed)) / 0.45) * (1 - smooth((c.t - (c.T - 1.0)) / 0.5));
  wings(bn, w, clamp(-c.bank * 0.3 + 0.2 * Math.sin(c.t * 2.5 + seed * 12), -0.42, 0.42));
}
// has he got to his place? 0..1, easing in once he is nearly still (or within `near` m/s) and `ok`
function arrived(m, p, ok = true, near = 0.8, rate = 4) {
  m.cheerA = clamp((m.cheerA || 0) + (ok && Math.hypot(p.vx, p.vz) < near ? rate : -rate) * DT, 0, 1);
  return smooth(m.cheerA);
}
function point(m, bn, ch, p, t) {
  const c = ch.c, seed = gaitOf(m).seed, out = 1 - smooth((c.t - (c.T - 0.6)) / 0.45);
  if (ch.role === 'you' || ch.side < 0) {
    // one arm straight up, the other out from his side, head back to look where he points (the teammate beside you: both arms)
    const w = (ch.role === 'you' ? smooth((c.t - 0.95) / 0.35) : arrived(m, p)) * out, both = ch.role !== 'you';
    blend(bn, w, () => {
      arm(bn, 'R', -0.12, 2.92, 0.06); arm(bn, 'L', both ? -0.12 : 0.1, both ? 2.85 : 0.5, both ? 0.1 : 0.45);
      bn.handR.rotation.set(0, 0, 0); bn.spine.rotation.x -= 0.08; bn.neck.rotation.set(-0.38, 0, 0); bn.head.rotation.set(-0.22, 0, 0);
    });
    return;
  }
  // the other points at you with a straight arm, the other fist pumping
  const w = arrived(m, p) * out;
  blend(bn, w, () => {
    local(m, ch.you.x, ch.you.z, v); v.y = 1.42;
    reachArm(bn, 'R', v, pole.set(-0.3, -1, 0)); bn.handR.rotation.set(0, 0, 0);
    arm(bn, 'L', -0.5, 2.2 + 0.25 * Math.sin(t * 9 + seed * 5), 0.9 + 0.5 * Math.sin(t * 9 + seed * 5));
  });
}
function ears(m, bn, ch, p, t) {
  const c = ch.c, seed = gaitOf(m).seed, out = 1 - smooth((c.t - (c.T - 0.6)) / 0.45);
  if (ch.role === 'you') {
    // a hand cupped behind each ear, elbows out, the head turning to one end of the stand and the other
    blend(bn, smooth((c.t - 0.2) / 0.4) * out, () => {
      const turn = 0.38 * Math.sin(c.t * 1.7);
      bn.spine.rotation.set(0.06, turn * 0.3, 0); bn.chest.rotation.set(0.04, turn * 0.3, 0); bn.neck.rotation.set(-0.06, turn * 0.25, 0); bn.head.rotation.set(-0.04, turn * 0.15, 0);
      skull(bn, v); q2.copy(q).multiply(bn.head.quaternion);                    // (q: the neck's frame, left by skull)
      for (const n of ['L', 'R']) {
        const sd = n === 'L' ? 1 : -1;
        v2.set(sd * 0.165, 0.075, 0.03).applyQuaternion(q2).add(v);
        reachArm(bn, n, v2, pole.set(sd, -0.75, 0.05));
        aimHand(bn, n, q.setFromEuler(eul.set(0, sd * 0.5, Math.PI)).premultiply(q2));       // fingers up, the palm forward
      }
    });
    return;
  }
  // teammates whip the crowd up: both arms swept from the waist to over the head, palms up, again and again
  const w = arrived(m, p) * out, k = 0.5 - 0.5 * Math.cos(t * 7.4 + seed * 20 + (ch.side > 0 ? 1.6 : 0));
  blend(bn, w, () => {
    for (const n of ['L', 'R']) { arm(bn, n, -0.5 - 0.5 * k, 0.5 + 1.75 * k, 0.95 - 0.6 * k, -0.6); bn['hand' + n].rotation.set(0, 0, 0); }
    bn.neck.rotation.x -= 0.12; bn.spine.rotation.x -= 0.05 * k;
  });
  if (w > 0) ride(bn, -0.05 * w * (1 - k));
}
function pile(m, bn, ch, p, t) {
  const c = ch.c, [d, u] = pileDU(c), seed = gaitOf(m).seed;
  if (ch.role === 'you') {
    // down on your knees, arms open for them
    blend(bn, d * (1 - smooth((u - 0.82) / 0.18)), () => {
      kneel(bn, 0.06, 0.16, 0.13);
      const open = 1 - smooth((c.t - 0.9) / 0.5);
      arm(bn, 'L', -0.5 - 0.3 * (1 - open), 1.2 * open + 0.55, 0.3 + 0.7 * (1 - open)); arm(bn, 'R', -0.25, 1.9 * open + 0.5, 0.25 + 0.5 * (1 - open));
      bn.neck.rotation.set(-0.15 * open, 0, 0);
      if (u > 0) rise(bn, u);
    });
    unsink(bn);
    return;
  }
  local(m, ch.you.x, ch.you.z, v); const yx = v.x, yz = v.z, near = Math.hypot(yx, yz) < 1.15;
  if (ch.side < 0) {
    // in front of you and to one side: onto his knees and his arms round you, his head past your shoulder
    const w = arrived(m, p, near && c.t > 0.5, 2.5, 5) * (1 - smooth((u - 0.9) / 0.1)), late = 0.18;
    blend(bn, w, () => {
      kneel(bn, -0.2, 0.1, 0.15);
      bn.neck.rotation.set(-0.15, 0, 0.2);
      for (const n of ['L', 'R']) { const sd = n === 'L' ? 1 : -1; reachArm(bn, n, v2.set(yx + sd * 0.22, 1.02 - 0.1 * sd, yz + 0.1), pole.set(sd, -0.6, -0.3)); }
      if (u > late) rise(bn, clamp((u - late) / (1 - late), 0, 1));
    });
    unsink(bn);
    return;
  }
  // over your back: bent over you, a hand on each of your shoulders, bouncing
  const w = arrived(m, p, near && c.t > PILE.mate, 2.5, 5) * (1 - smooth((u - 0.15) / 0.4)), b = Math.abs(Math.sin(t * 6 + seed * 7));
  blend(bn, w, () => {
    bn.spine.rotation.set(0.3, 0, 0); bn.chest.rotation.set(0.22, 0, 0); bn.neck.rotation.set(-0.35, 0, 0);
    for (const n of ['L', 'R']) { const sd = n === 'L' ? 1 : -1; reachArm(bn, n, v2.set(yx + sd * 0.2, 1.16 + 0.02 * b, yz + 0.05), pole.set(sd, 0.2, -0.6)); bn['hand' + n].rotation.set(-0.6, 0, 0); }
  });
  if (w > 0) ride(bn, -w * (0.1 + 0.04 * b));
}
function flip(m, bn, ch, p) {
  const c = ch.c, seed = gaitOf(m).seed;
  if (ch.role === 'you') { backflip(bn, c.t - FLIP.at); const after = c.t - FLIP.at - FLIP.len; joy(bn, after + 0.3, smooth(after / 0.3) * (1 - smooth((c.t - (c.T - 0.5)) / 0.4))); return; }
  if (ch.side > 0) { backflip(bn, c.t - FLIP.mateAt); return; }
  joy(bn, c.t + seed * 2, arrived(m, p) * (1 - smooth((c.t - (c.T - 0.5)) / 0.4)));
}
const KINDS = { slide, plane, point, ears, pile, flip };

// The beaten side: walking, the bowed trunk, head and hanging arms of a recorded sad walk over his own legs;
// standing, hands on hips or on his head, looking at the grass.
function beaten(m, bn, p, t) {
  const g = gaitOf(m), sp = Math.hypot(p.vx, p.vz), i = Math.floor(g.seed * 97) % 3;
  m.cheerW = clamp((m.cheerW || 0) + 2 * DT, 0, 1);
  const w = smooth(m.cheerW), walk = smooth((sp - 0.15) / 0.4) * (1 - smooth((sp - 1.6) / 0.8)), clip = SAD[i % 2];
  if (clip && walk > 0) applyPose(bn, sampleStride(clip, g.ph || 0, P2), w * walk, BOWED);
  const st = w * (1 - smooth(sp / 0.4));
  if (st <= 0) return;
  blend(bn, st, () => {
    bn.neck.rotation.set(0.32, 0, 0); bn.head.rotation.set(0.2, 0, 0); bn.spine.rotation.x += 0.06;
    for (const n of ['L', 'R']) {
      const sd = n === 'L' ? 1 : -1;
      if (i === 1) { skull(bn, v); reachArm(bn, n, v2.set(sd * 0.075, 0.2, -0.02).add(v), pole.set(sd, 0.1, 0.45)); bn['hand' + n].rotation.set(0, 0, sd * 1.2); }       // hands on his head
      else { reachArm(bn, n, v.copy(bn.hips.position).add(v2.set(sd * 0.2, 0.085, 0.01).applyQuaternion(bn.hips.quaternion)), pole.set(sd, -0.15, -0.75)); aimHand(bn, n, q.setFromEuler(eul.set(-0.55, sd * 0.5, sd * 0.15))); }
    }
  });
}

// Who a model is in the celebration `c` (world.celebrate, or null: none), for cheerPose. p: his sim player.
export function cheerOf(m, p, c, you) {
  if (!c || p.role === 'gk') return (m.cheer = null);
  const o = m.cheerO || (m.cheerO = {});
  o.c = c; o.role = p.id === 'you' ? 'you' : p.team === 'home' ? 'mate' : 'opp'; o.side = p.lane || 1; o.you = you;
  return (m.cheer = o);
}

// Call after animate()'s own posing. p: the sim player; t: the clock.
let DT = 1 / 72;
export function cheerPose(m, p, dt, t) {
  const ch = m.cheer;
  DT = dt;
  if (!ch) { m.cheerA = m.cheerW = 0; return; }
  if (ch.role === 'opp') { beaten(m, m.bone, p, t); return; }
  const fn = ch.c.kind && KINDS[ch.c.kind];
  if (!fn) { m.cheerA = 0; return; }
  fn(m, m.bone, ch, p, t);
  if (m.firstPerson) m.bone.chest.scale.setScalar(0.001);
}
