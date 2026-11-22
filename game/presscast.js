// The press in front of the stage at the trophy presentation (game/trophy.js): seven photographers as real people
// (game/ps2/press.js) on the carpet between the platform and the boards, three down on one knee in front and four
// standing behind in the gaps, each with a long lens on the cup; two of the standing ones hold the camera up over
// the heads in front. They turn and tilt to keep the cup framed and shift a little as people do.
// All of it is built (no capture of a photographer exists in the library), from how the job is done: down on one
// knee with the other foot flat in front, back upright, elbows tucked in against the ribs, the right hand on the
// grip and the left cupped under the lens taking its weight, the camera pressed to the brow; standing, feet apart
// and one a little ahead, knees soft; overhead, both arms nearly straight with the camera tipped down.
// Everything is in the stage's frame (game/ps2/stage.js): they face +z, toward you.
import * as THREE from 'three';
import { buildPressman, cameraGeometry, capGeometry, CAMERA, BIBS } from './ps2/press.js';
import { restPose } from './body.js';
import { aimHead } from './mocap.js';
import { reachArm, reachLeg, aimFoot } from './legik.js';
import { canvas, smoothTex } from './ps2/paint.js';

// x, z on the grass; how he works: 'kneel' | 'stand' | 'over'; cap; which way he turns his shoulders at rest
const PRESS = [
  { x: -2.3, z: -2.55, kind: 'kneel' }, { x: 0.15, z: -2.7, kind: 'kneel', cap: true, flip: true }, { x: 2.35, z: -2.5, kind: 'kneel' },
  { x: -3.4, z: -2.95, kind: 'stand', cap: true }, { x: -1.1, z: -3.05, kind: 'over' }, { x: 1.3, z: -3.0, kind: 'stand' }, { x: 3.5, z: -2.9, kind: 'over', cap: true, flip: true },
];
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), pole = new THREE.Vector3(), q1 = new THREE.Quaternion(), e1 = new THREE.Euler(0, 0, 0, 'YXZ');
const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), inv = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function blobs(list) {
  const c = canvas(64, 64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(4,12,8,0.6)'); gr.addColorStop(0.6, 'rgba(4,12,8,0.25)'); gr.addColorStop(1, 'rgba(4,12,8,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const P = [], U = [], I = [];
  list.forEach((p, i) => { const w = p.kind === 'kneel' ? 0.6 : 0.5, l = p.kind === 'kneel' ? 0.75 : 0.45, zc = p.z - (p.kind === 'kneel' ? 0.1 : 0); P.push(p.x - w, 0.02, zc - l, p.x + w, 0.02, zc - l, p.x + w, 0.02, zc + l, p.x - w, 0.02, zc + l); U.push(0, 0, 1, 0, 1, 1, 0, 1); I.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: smoothTex(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.renderOrder = 1; return m;
}

// group: the stage's frame. Returns { update(dt, t, cup), lenses(), dispose(), tris, calls }.
export function createPress(group) {
  const men = PRESS.map((p, i) => {
    const m = buildPressman(i, !!p.cap);
    m.root.position.set(p.x, 0, p.z); m.root.rotation.y = Math.atan2(-p.x * 0.25, 1);       // toward the stage's middle
    group.add(m.root);
    return { ...p, m, i, yaw: 0, pitch: 0, cam: new THREE.Matrix4(), ph: i * 2.4 };
  });
  const lit = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 24, specular: 0x333333 });
  const cams = new THREE.InstancedMesh(cameraGeometry(), lit, men.length); cams.frustumCulled = false; group.add(cams);
  const capped = men.filter(p => p.cap), caps = new THREE.InstancedMesh(capGeometry(), lit, Math.max(1, capped.length)); caps.frustumCulled = false; group.add(caps);
  capped.forEach((p, k) => caps.setColorAt(k, new THREE.Color(['#22262e', BIBS[2], '#8a1f24'][k % 3])));
  men.forEach((p, k) => cams.setColorAt(k, new THREE.Color('#ffffff')));
  const shade = blobs(PRESS); group.add(shade);

  function pose(p, dt, t, cup) {
    const bn = p.m.bone, r = p.m.root, kneel = p.kind === 'kneel', over = p.kind === 'over', sd = p.flip ? -1 : 1;
    restPose(bn);
    // where the cup is from him: how far to turn, how far to tilt (eased, with the small shifts of a man reframing)
    const dx = cup.x - r.position.x, dz = cup.z - r.position.z, cs = Math.cos(r.rotation.y), sn = Math.sin(r.rotation.y), lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    const eye = kneel ? 1.12 : over ? 2.1 : 1.66, wantYaw = clamp(Math.atan2(lx, lz), -0.6, 0.6) + 0.035 * Math.sin(t * 0.7 + p.ph), wantPitch = clamp(-Math.atan2(cup.y - eye, Math.hypot(lx, lz)), -0.7, 0.3) + 0.02 * Math.sin(t * 0.9 + p.ph * 2);
    const e = Math.min(1, dt * 3.5); p.yaw += (wantYaw - p.yaw) * e; p.pitch += (wantPitch - p.pitch) * e;
    const breath = 0.006 * Math.sin(t * 1.7 + p.ph), shift = 0.012 * Math.sin(t * 0.43 + p.ph);
    // legs and hips
    if (kneel) {
      // down on the right knee (the left for a man the other way round): that shin along the ground behind him,
      // toes tucked; the other foot flat in front, its knee up
      bn.hips.position.set(shift, 0.47 + breath, -0.04); bn.hips.rotation.set(0.06, p.yaw * 0.15, 0);
      const A = sd > 0 ? 'L' : 'R', B = sd > 0 ? 'R' : 'L';
      reachLeg(bn, A, v1.set(sd * 0.15, 0.085, 0.33)); aimFoot(bn, A, q1.setFromEuler(e1.set(0, sd * 0.12, 0)));
      reachLeg(bn, B, v1.set(-sd * 0.13, 0.12, -0.47)); aimFoot(bn, B, q1.setFromEuler(e1.set(1.15, -sd * 0.05, 0)));
    } else {
      bn.hips.position.set(shift, 0.905 + breath, 0); bn.hips.rotation.set(0.03, p.yaw * 0.3, 0);
      reachLeg(bn, 'L', v1.set(0.15, 0.085, sd * 0.1)); aimFoot(bn, 'L', q1.setFromEuler(e1.set(0, 0.22, 0)));
      reachLeg(bn, 'R', v1.set(-0.15, 0.085, -sd * 0.1)); aimFoot(bn, 'R', q1.setFromEuler(e1.set(0, -0.22, 0)));
    }
    // the trunk turns the rest of the way and leans in to the camera (back, a little, for the men reaching up)
    const lean = over ? -0.06 : kneel ? 0.1 : 0.14, up = Math.max(0, -p.pitch);
    bn.spine.rotation.set(lean - up * 0.18, p.yaw * 0.3, 0); bn.chest.rotation.set(lean * 0.6 - up * 0.14, p.yaw * 0.25, 0);
    // the camera: at his eye, or up over his head tipped down at the stage
    p.m.root.updateMatrixWorld(true);
    if (over) {
      aimHead(bn, p.yaw, -0.42, 1);
      const lift = 0.03 * Math.sin(t * 0.6 + p.ph);
      m1.compose(v1.set(0.02 * sd, 1.98 + lift, 0.2), q1.setFromEuler(e1.set(clamp(p.pitch + 0.2, -0.3, 0.45), p.yaw, 0)), one);
      p.cam.multiplyMatrices(p.m.root.matrixWorld, m1);
    } else {
      aimHead(bn, p.yaw, p.pitch, 1);
      p.m.root.updateMatrixWorld(true);
      m1.makeTranslation(0.012, 0.105, 0.118);                                   // (his right eye to the eyepiece)
      p.cam.multiplyMatrices(bn.head.matrixWorld, m1);
    }
    // the hands on it: right on the grip, left under the lens, elbows down and in
    inv.copy(p.m.root.matrixWorld).invert(); m2.multiplyMatrices(inv, p.cam);
    const G = CAMERA.grip, Uu = CAMERA.under;
    v1.set(G[0] - 0.012, G[1] - (over ? 0.1 : 0.085), G[2] - (over ? 0.0 : 0.035)).applyMatrix4(m2);
    reachArm(bn, 'R', v1, pole.set(-0.35, over ? -0.2 : -1, over ? 0.9 : -0.15));
    v2.set(Uu[0] + 0.02, Uu[1] - (over ? 0.1 : 0.09), Uu[2] - (over ? 0.02 : 0.05)).applyMatrix4(m2);
    reachArm(bn, 'L', v2, pole.set(0.3, over ? -0.2 : -1, over ? 0.9 : -0.1));
    bn.handL.rotation.set(0, 0, 0); bn.handR.rotation.set(0, 0, 0);
  }

  const api = {
    men, tris: men.reduce((s, p) => s + p.m.tris, 0) + (cams.geometry.index.count / 3) * men.length + (caps.geometry.index.count / 3) * capped.length, calls: men.length * 2 + 3,
    // cup: where the cup is (stage frame)
    update(dt, t, cup) {
      group.updateMatrixWorld(true); inv.copy(group.matrixWorld).invert();
      let k = 0;
      for (const p of men) {
        pose(p, dt, t, cup);
        p.m.root.updateMatrixWorld(true);
        cams.setMatrixAt(p.i, m1.multiplyMatrices(m2.copy(group.matrixWorld).invert(), p.cam));
        if (p.cap) caps.setMatrixAt(k++, m1.multiplyMatrices(m2, p.m.bone.head.matrixWorld));
      }
      cams.instanceMatrix.needsUpdate = caps.instanceMatrix.needsUpdate = true;
    },
    // where the flashes come from (stage frame), as they stand now
    lenses() { m2.copy(group.matrixWorld).invert(); return men.map(p => v1.set(...CAMERA.flash).applyMatrix4(p.cam).applyMatrix4(m2).toArray()); },
    dispose() { for (const p of men) group.remove(p.m.root); group.remove(cams, caps, shade); cams.dispose(); caps.dispose(); shade.geometry.dispose(); shade.material.dispose(); lit.dispose(); },
  };
  return api;
}
