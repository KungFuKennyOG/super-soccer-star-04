// The press in front of the stage at the trophy presentation (game/trophy.js): seven photographers as real people
// (game/ps2/press.js) on the carpet between the platform and the boards, three down on one knee in front and four
// standing behind in the gaps, each with a long lens on the cup. What they do and when is game/pressact.js
// (shooting, dropping the camera to check the screen, re-framing, shifting weight, leaning out for an angle, one
// getting up off his knee, two changing places, two shooting from over their heads); this file poses it.
// All of it is built (no capture of a photographer exists in the library), from how the job is done: down on one
// knee with the other foot flat in front, back upright, elbows down and in against the ribs, the right hand round
// the grip and the left cupped under the lens taking its weight, the camera pressed to the brow; standing, feet
// apart and one half a pace ahead, knees soft; overhead, both arms nearly straight with the camera tipped down.
// Both hands stay on the camera whatever he does, so the arms follow it by IK and the hands are turned to it.
// Everything is in the stage's frame (game/ps2/stage.js): they face +z, toward you.
import * as THREE from 'three';
import { buildPressman, cameraGeometry, capGeometry, CAMERA, BIBS } from './ps2/press.js';
import { TURN } from './ps2/limbs.js';
import { restPose } from './body.js';
import { aimHead } from './mocap.js';
import { reachArm, reachLeg, aimFoot, aimHand } from './legik.js';
import { canvas, smoothTex } from './ps2/paint.js';
import { PRESS, createActs, stepActs, smooth } from './pressact.js';
import { createSteps, stepFeet, armsClear } from './pressfeet.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), pole = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e1 = new THREE.Euler(0, 0, 0, 'YXZ');
const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), inv = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
const pE = new THREE.Vector3(), qE = new THREE.Quaternion(), F = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), mA = new THREE.Matrix4(), mB = new THREE.Matrix4();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), mix = (a, b, k) => a + (b - a) * k;

// How each hand sits on the camera (camera frame: the eyepiece at the origin, the lens along +z, +y up; his right
// is -x): where the middle of the palm presses, which way the fingers run from the wrist, which way the palm faces.
// Right: flat against the outside of the grip, fingers forward and closed round its front. Left: palm up under
// the barrel, fingers forward along it and curling up its far side, the thumb up the near side.
const HANDS = {
  R: { at: [CAMERA.grip[0] - 0.02, CAMERA.grip[1] + 0.012, CAMERA.grip[2] + 0.004], f: [0.06, 0.34, 1], n: [1, 0, 0], turn: 0.3 },
  L: { at: [CAMERA.under[0] + 0.004, CAMERA.under[1] - 0.004, CAMERA.under[2] - 0.035], f: [-0.42, 0.04, 0.9], n: [0, 1, 0], turn: 0.7 },
};
const PALM = 0.076, THICK = 0.021, fl = new THREE.Vector3(0, -1, 0), nl = new THREE.Vector3(), bl = new THREE.Vector3();
// One hand onto the camera (cam: its matrix in the man's own frame): the wrist where the palm then lies on its
// place, the elbow toward `pole`, the hand turned so the fingers and the palm are as HANDS says.
function hold(bn, n, cam, pl) {
  const h = HANDS[n], s = n === 'L' ? 1 : -1;
  q2.setFromRotationMatrix(cam);
  F.set(...h.f).normalize().applyQuaternion(q2); N.set(...h.n).applyQuaternion(q2);
  nl.set(-s * Math.cos(TURN), 0, -Math.sin(TURN)); bl.crossVectors(fl, nl);            // the hanging hand's own palm (limbs.js turns it)
  // twice: the second time the fingers are swung round on the palm toward the line of the forearm as it then
  // lies (a hand cupped under a lens can lie any way round under it; one on a grip has little choice), so the
  // wrist is never bent sideways further than a wrist goes
  for (let pass = 0; pass < 2; pass++) {
    if (pass) {
      q1.copy(bn.hips.quaternion).multiply(bn.spine.quaternion).multiply(bn.chest.quaternion).multiply(bn['clavicle' + n].quaternion).multiply(bn['upperArm' + n].quaternion).multiply(bn['foreArm' + n].quaternion);
      v2.copy(bn['hand' + n].position).normalize().applyQuaternion(q1); v2.addScaledVector(N, -v2.dot(N));
      if (v2.lengthSq() > 0.04) F.lerp(v2.normalize(), h.turn).normalize();
    }
    B.crossVectors(F, N).normalize(); N.crossVectors(B, F);
    q1.setFromRotationMatrix(mA.makeBasis(F, N, B).multiply(mB.makeBasis(fl, nl, bl).transpose()));
    v1.set(...h.at).applyMatrix4(cam).addScaledVector(F, -PALM).addScaledVector(N, -THICK);
    reachArm(bn, n, v1, pl);
  }
  aimHand(bn, n, q1);
}

function blobs(n) {
  const c = canvas(64, 64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(4,12,8,0.6)'); gr.addColorStop(0.6, 'rgba(4,12,8,0.25)'); gr.addColorStop(1, 'rgba(4,12,8,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
  const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: smoothTex(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), n);
  m.renderOrder = 1; m.frustumCulled = false; return m;
}

// group: the stage's frame. Returns { update(dt, t, cup), lenses(), measure(), dispose(), tris, calls }.
export function createPress(group, seed = 1) {
  const acts = createActs(PRESS, seed);
  const men = acts.map((a, i) => {
    const m = buildPressman(i, !!a.cap);
    m.root.position.set(a.px, 0, a.pz); group.add(m.root);
    return { a, m, i, kind: a.kind, cap: a.cap, sd: a.flip ? -1 : 1, yaw: 0, pitch: 0, cam: new THREE.Matrix4(), local: new THREE.Matrix4(), ph: i * 2.4, steps: a.kind === 'kneel' ? null : createSteps() };
  });
  const lit = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 24, specular: 0x333333 });
  const cams = new THREE.InstancedMesh(cameraGeometry(), lit, men.length); cams.frustumCulled = false; group.add(cams);
  const capped = men.filter(p => p.cap), caps = new THREE.InstancedMesh(capGeometry(), lit, Math.max(1, capped.length)); caps.frustumCulled = false; group.add(caps);
  capped.forEach((p, k) => caps.setColorAt(k, new THREE.Color(['#22262e', BIBS[2], '#8a1f24'][k % 3])));
  men.forEach((p, k) => cams.setColorAt(k, new THREE.Color('#ffffff')));
  const shade = blobs(men.length); group.add(shade);
  let up = false;

  function pose(p, dt, t, cup) {
    const a = p.a, bn = p.m.bone, r = p.m.root, sd = p.sd, kn = p.steps ? 0 : smooth(a.kneel), rising = !p.steps && a.rises ? Math.sin(Math.PI * kn) : 0;
    r.position.set(a.px, 0, a.pz); r.rotation.y = Math.atan2(-a.px * 0.25, 1);                 // toward the stage's middle
    restPose(bn);
    // what he is framing (the cup, or someone else for a moment) from where he is: how far to turn and tilt
    const tg = a.aim || v3.set(cup.x, cup.y + 0.25, cup.z).toArray(), dx = tg[0] - a.px, dz = tg[2] - a.pz, cs = Math.cos(r.rotation.y), sn = Math.sin(r.rotation.y), lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    const eye = mix(mix(1.66, 2.1, a.over), 1.12, kn);
    const wantYaw = clamp(Math.atan2(lx, lz), -0.75, 0.75) + a.nudge[0], wantPitch = clamp(-Math.atan2(tg[1] - eye, Math.hypot(lx, lz)), -0.7, 0.3) + a.nudge[1];
    const e = Math.min(1, dt * 5); p.yaw += (wantYaw - p.yaw) * e; p.pitch += (wantPitch - p.pitch) * e;
    const breath = 0.006 * Math.sin(t * 1.7 + p.ph), walk = Math.min(1, Math.hypot(a.vx, a.vz) / 0.5);
    // legs and hips
    const A = sd > 0 ? 'L' : 'R', Bk = sd > 0 ? 'R' : 'L';
    if (p.steps) {
      // on his feet: weight on one leg or the other, leaning out for an angle; the feet stay where they were put
      // down and step after him when he moves (pressfeet.js)
      const hx = a.side * 0.034 + a.lean * 0.1, hy = 0.905 - 0.012 * Math.abs(a.side) - 0.03 * Math.abs(a.lean) - 0.035 * walk + breath;
      bn.hips.position.set(hx, hy, 0); bn.hips.rotation.set(0.03, p.yaw * 0.3 * (1 - walk), -a.side * 0.035 - a.lean * 0.05);
      stepFeet(p.steps, a, r.rotation.y, sd, dt);
      for (const n of ['L', 'R']) {
        const f = p.steps[n], fx = f.x - a.px, fz = f.z - a.pz;
        reachLeg(bn, n, v1.set(fx * cs - fz * sn, 0.085 + f.lift, fx * sn + fz * cs)); aimFoot(bn, n, q1.setFromEuler(e1.set(f.lift * 4, (n === 'L' ? 0.22 : -0.22), 0)));
      }
    } else {
      // down on one knee: that shin along the ground behind him, toes tucked; the other foot flat in front, its
      // knee up. Getting up (kn 1 → 0): over the front foot, the back foot brought through under him.
      const u = smooth((0.8 - kn) / 0.6), hz = mix(0.13, -0.04, kn);
      bn.hips.position.set(a.side * 0.02 * kn, mix(0.9, 0.47, kn) + breath, hz); bn.hips.rotation.set(0.06 + 0.1 * rising, p.yaw * 0.15, 0);
      reachLeg(bn, A, v1.set(sd * 0.15, 0.085, 0.33)); aimFoot(bn, A, q1.setFromEuler(e1.set(0, sd * 0.12, 0)));
      reachLeg(bn, Bk, v1.set(-sd * mix(0.13, 0.16, u), mix(0.12, 0.085, u) + 0.05 * Math.sin(Math.PI * u), mix(-0.47, -0.07, u)));
      aimFoot(bn, Bk, q1.setFromEuler(e1.set(1.15 * (1 - u) * (1 - 0.4 * rising), -sd * mix(0.05, 0.2, u), 0)));
    }
    // the trunk turns the rest of the way and leans in to the camera (back, a little, for the men reaching up)
    const lean = mix(mix(0.14, -0.06, a.over), 0.1, kn) + 0.3 * rising + 0.07 * a.down, upk = Math.max(0, -p.pitch) * (1 - a.chest);
    bn.spine.rotation.set(lean - upk * 0.18, p.yaw * 0.3, -a.lean * 0.09); bn.chest.rotation.set(lean * 0.6 - upk * 0.14, p.yaw * 0.25, -a.lean * 0.07);
    // the camera at his eye (it goes where his head goes), up over his head, or down at his chest tipped up to be read
    aimHead(bn, p.yaw, p.pitch, 1);
    r.updateMatrixWorld(true); inv.copy(r.matrixWorld).invert();
    m1.multiplyMatrices(inv, bn.head.matrixWorld).multiply(m2.makeTranslation(0.012, 0.105, 0.118)).decompose(pE, qE, v2);   // (his right eye to the eyepiece)
    if (a.over > 0) {
      const k = smooth(a.over), lift = 0.03 * Math.sin(t * 0.6 + p.ph);
      pE.lerp(v1.set(0.02 * sd + bn.hips.position.x, bn.hips.position.y + 1.075 + lift, 0.2), k); qE.slerp(q1.setFromEuler(e1.set(clamp(p.pitch + 0.2, -0.3, 0.45), p.yaw, 0)), k);
    }
    if (a.chest > 0) {
      const k = smooth(a.chest);
      v2.set(0, 0.44, 0.33).applyEuler(e1.set(lean, 0, 0)).add(bn.hips.position); v2.y -= 0.05 * walk;
      pE.lerp(v2, k); qE.slerp(q1.setFromEuler(e1.set(0.78 - 0.3 * walk, p.yaw * 0.3, 0)), k);
    }
    p.local.compose(pE, qE, one);
    bn.neck.rotation.set(0, 0, 0); bn.head.rotation.set(0, 0, 0);
    aimHead(bn, p.yaw * (1 - 0.6 * a.down), mix(mix(p.pitch, -0.4, smooth(a.over)), 0.62, smooth(a.down)), 1);
    // both hands on it: elbows down and in at the eye, forward and up overhead, out and back at the chest
    const o = smooth(a.over), c = smooth(a.chest) * (1 - o);
    hold(bn, 'R', p.local, pole.set(-0.5 - 0.9 * c, mix(mix(-1, -0.2, o), -0.55, c), mix(mix(-0.1, 0.9, o), -0.75, c)));
    hold(bn, 'L', p.local, pole.set(0.5 + 0.9 * c, mix(mix(-1, -0.2, o), -0.55, c), mix(mix(-0.05, 0.9, o), -0.75, c)));
    r.updateMatrixWorld(true);
    p.cam.multiplyMatrices(r.matrixWorld, p.local);
  }

  const api = {
    men, tris: men.reduce((s, p) => s + p.m.tris, 0) + (cams.geometry.index.count / 3) * men.length + (caps.geometry.index.count / 3) * capped.length + men.length * 2, calls: men.length * 2 + 3,
    // cup: where the cup is (stage frame). It is "up" over about head height (they are all on it then).
    update(dt, t, cup) {
      up = cup.y > (up ? 2.25 : 2.4);
      stepActs(acts, dt, t, { up });
      group.updateMatrixWorld(true); m2.copy(group.matrixWorld).invert();
      let k = 0;
      for (const p of men) {
        pose(p, dt, t, cup);
        cams.setMatrixAt(p.i, m1.multiplyMatrices(inv.copy(group.matrixWorld).invert(), p.cam));
        if (p.cap) caps.setMatrixAt(k++, m1.multiplyMatrices(inv, p.m.bone.head.matrixWorld));
        const kn = p.kind === 'kneel' ? smooth(p.a.kneel) : 0, w = mix(1.0, 1.2, kn), l = mix(0.9, 1.5, kn);
        shade.setMatrixAt(p.i, m1.compose(v1.set(p.a.px, 0.02, p.a.pz - 0.1 * kn), q1.identity(), v2.set(w, 1, l)));
      }
      cams.instanceMatrix.needsUpdate = caps.instanceMatrix.needsUpdate = shade.instanceMatrix.needsUpdate = true;
    },
    // where the flashes come from (stage frame), as they stand now
    lenses() { m2.copy(group.matrixWorld).invert(); return men.map(p => v1.set(...CAMERA.flash).applyMatrix4(p.cam).applyMatrix4(m2).toArray()); },
    // (for the tools) how far any arm is inside its own trunk, head or camera, and how near two men are: metres
    measure() { return { arms: men.map(p => armsClear(p.m.bone, p.local)), near: Math.min(...men.flatMap((p, i) => men.slice(i + 1).map(o => Math.hypot(p.a.px - o.a.px, p.a.pz - o.a.pz)))) }; },
    dispose() { for (const p of men) group.remove(p.m.root); group.remove(cams, caps, shade); cams.dispose(); caps.dispose(); shade.dispose(); shade.geometry.dispose(); shade.material.dispose(); lit.dispose(); },
  };
  return api;
}
