// Shots of your own '04 hands (game/ps2/hands.js) for tools/ps2look.html. All start with "hand":
//   handeye     through your eyes, hands at your sides as held in VR (&pose=open|point|fist; default open)
//   handraise   through your eyes, both hands raised in front
//   handgrid    one hand close up from six sides: palm, back, knuckles, thumb side, thumb from above, wrist end
//               (&pose=open|point|fist|hold, &d=0.032 for hold's diameter, &side=left)
//   handortho   the bare hand in its own frame: palm, back, thumb side, little-finger side, palm from the thumb side, tips
//   handposes   the four poses side by side, from the back and from the palm
//   handcmp     the old PS1 hand (left of each pair) next to the new one, back and palm, each pose
//   handfilm    through your eyes, the right hand raised: open → point → fist → open on analog values (4 s; FILM=4)
import * as THREE from 'three';
import { buildHand, HtoGrip } from '../game/ps2/hands.js';
import { FOREARM } from '../game/ps2/handgeo.js';
import { buildHand as buildOld } from '../game/hands.js';

const KIT = { shirt: '#c4122c', sleeve: '#c4122c', trim: '#ffffff' };
const EYE = new THREE.Vector3(0, 1.66, 0);
// a grip-space orientation from where the handle points (toward the thumb) and where the back of the hand faces
function gripQ(up, back) {
  const z = new THREE.Vector3(...up).normalize().negate(), x = new THREE.Vector3(...back);
  x.addScaledVector(z, -x.dot(z)).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
// a right hand's grip orientation from where its forearm goes (toward the elbow) and where the back of the hand faces
const ARMG = FOREARM.clone().applyQuaternion(HtoGrip);
function armQ(arm, back) {
  const basis = (a, b) => { a = a.clone().normalize(); b = b.clone().addScaledVector(a, -b.dot(a)).normalize(); return new THREE.Matrix4().makeBasis(a, b, new THREE.Vector3().crossVectors(a, b)); };
  const L = basis(ARMG, new THREE.Vector3(1, 0, 0)), W = basis(new THREE.Vector3(...arm), new THREE.Vector3(...back));
  return new THREE.Quaternion().setFromRotationMatrix(W.multiply(L.transpose()));
}
const mirrorQ = q => new THREE.Quaternion(q.x, -q.y, -q.z, q.w);     // the same orientation seen in a mirror across x (the left hand)
// handle straight up, back of the (right) hand toward +x, wrist toward +z
const STUDIO = gripQ([0, 1, 0], [1, 0, 0]);

export function handLook(scene, q) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const pose = q.get('pose') || 'open', d = +(q.get('d') || 0.032), side = q.get('side') || 'right';
  const made = [];
  let firstMs = 0;
  const add = (h, pos, quat) => { h.position.copy(pos); h.quaternion.copy(quat); root.add(h); made.push(h); return h; };
  const hand = (sd, p, o) => { const h = buildHand(sd, p, KIT, undefined, p === 'hold' ? { d, ...o } : o); return h; };
  let shots;
  const views = [  // [name, camera offset from the hand]
    ['palm', [-0.36, 0.02, 0.06]], ['back', [0.36, 0.04, 0.05]], ['knuckles', [0.04, 0.03, -0.36]],
    ['thumb side', [-0.24, 0.12, -0.24]], ['thumb above', [-0.12, 0.33, -0.08]], ['wrist end', [0.12, 0.08, 0.36]],
  ];
  function setup(shot) {
    while (made.length) root.remove(made.pop());
    root.visible = true;
    if (shot === 'handeye') {
      // arms hanging, the controllers held level and pointing ahead: the wrists up toward the elbows
      const qg = armQ([0.05, 0.95, 0.3], [1, 0.1, -0.15]), ql = mirrorQ(qg);
      add(hand('right', pose), new THREE.Vector3(0.24, 0.86, -0.1), qg); add(hand('left', pose), new THREE.Vector3(-0.24, 0.86, -0.1), ql);
      return { cams: [{ pos: EYE, at: [0, 0.95, -0.3], fov: 92 }] };
    }
    if (shot === 'handraise' || shot === 'handfilm') {
      const qr = armQ([0.2, -0.45, 0.87], [0.45, 0.88, 0.1]), ql = mirrorQ(qr);
      const r = add(hand('right', pose), new THREE.Vector3(0.14, 1.32, -0.36), qr);
      if (shot === 'handraise') add(hand('left', pose), new THREE.Vector3(-0.15, 1.3, -0.38), ql);
      return { cams: [{ pos: EYE, at: [0, 1.3, -0.5], fov: 92 }], film: r.hand };
    }
    if (shot === 'handgrid') {
      add(hand(side, pose), new THREE.Vector3(0, 1.2, 0), STUDIO);
      if (pose === 'hold') add(stick(d), new THREE.Vector3(0, 1.2, 0), new THREE.Quaternion());
      return { grid: [3, 2], cams: views.map(([, o]) => ({ pos: new THREE.Vector3(o[0], 1.2 + o[1], o[2]), at: [0, 1.19, -0.01], fov: 32 })) };
    }
    if (shot === 'handortho') {     // the bare hand in its own frame (handgeo.js H): fingers up, palm toward -z
      const h = add(hand(side, pose), new THREE.Vector3(0, 1.1, 0), new THREE.Quaternion());
      h.hand.mesh.position.set(0, 0, 0); h.hand.mesh.quaternion.identity();
      const at = [0, 1.17, 0], c = (x, y, z, up = [0, 1, 0]) => ({ pos: new THREE.Vector3(x, 1.17 + y, z), at, fov: 34, up });
      return { grid: [3, 2], cams: [c(0, 0, -0.4), c(0, 0, 0.4), c(-0.4, 0, 0), c(0.4, 0, 0), c(-0.25, 0.05, -0.3), c(0, 0.4, -0.01, [0, 0, 1])] };
    }
    if (shot === 'handposes') {
      const P = ['open', 'point', 'fist', 'hold'], cams = [];
      P.forEach((p, i) => {
        const at = new THREE.Vector3(i * 0.8, 1.2, 0);
        add(hand('right', p), at, STUDIO);
        if (p === 'hold') add(stick(d), at, new THREE.Quaternion());
        cams.push({ pos: at.clone().add(new THREE.Vector3(0.36, 0.1, -0.24)), at: [at.x, 1.19, -0.02], fov: 40 });
      });
      P.forEach((p, i) => cams.push({ pos: new THREE.Vector3(i * 0.8 - 0.36, 1.27, -0.24), at: [i * 0.8, 1.19, -0.02], fov: 40 }));
      return { grid: [4, 2], cams };
    }
    if (shot === 'handcmp') {
      const P = ['open', 'point', 'fist'], cams = [];
      P.forEach((p, i) => {
        const a = new THREE.Vector3(i * 1.5, 1.2, -0.13), b = a.clone().add(new THREE.Vector3(0, 0, 0.26));     // old on the left of each pair
        add(buildOld('right', p, KIT), a, STUDIO); add(hand('right', p), b, STUDIO);
        cams.push({ pos: new THREE.Vector3(a.x + 0.5, 1.3, 0.0), at: [a.x, 1.19, 0.0], fov: 38 });   // backs
        cams.push({ pos: new THREE.Vector3(a.x - 0.5, 1.3, 0.0), at: [a.x, 1.19, 0.0], fov: 38 });   // palms
      });
      return { grid: [2, 3], cams };
    }
    return null;
  }
  function stick(dd) {            // the handle a hold closes round, see-through
    const m = new THREE.Mesh(new THREE.CylinderGeometry(dd / 2, dd / 2, 0.16, 20), new THREE.MeshPhongMaterial({ color: '#9aa4b4', transparent: true, opacity: 0.45, depthWrite: false }));
    const g = new THREE.Group(); g.add(m); return g;
  }
  // open → point → fist → open on analog values, 4 s
  const filmInput = t => {
    const k = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
    const grip = k(0.5, 0.9) * (1 - k(3.0, 3.4)), trig = k(1.7, 2.1) * (1 - k(3.0, 3.4));
    return [trig, grip];
  };
  return {
    active: s => s.startsWith('hand'),
    info: () => { const h = made.find(x => x.hand); return h ? { handTris: h.hand.mesh.geometry.index.count / 3, handPaintMs: Math.round(h.hand.mesh.material.userData.paintMs), firstHandMs: Math.round(firstMs) } : {}; },
    hide() { root.visible = false; },
    pose(s, t, dt) {
      if (!shots || shots.name !== s) { const t0 = performance.now(); shots = { name: s, ...setup(s) }; firstMs = performance.now() - t0; for (const h of made) if (h.hand) h.hand.snap(); }
      if (shots.film) {
        const [tr, gr] = filmInput(t); shots.film.setInput(tr, gr);
        if (dt > 0) shots.film.update(dt); else shots.film.snap();
      }
    },
    render(renderer, camera, W, H) {
      const { cams, grid } = shots, [cx, cy] = grid || [1, 1], w = W / cx, h = H / cy;
      renderer.setScissorTest(true); renderer.autoClear = false; renderer.clear();
      cams.forEach((c, i) => {
        const x = (i % cx) * w, y = H - (Math.floor(i / cx) + 1) * h;
        renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
        camera.fov = c.fov; camera.aspect = w / h; camera.near = 0.02; camera.updateProjectionMatrix();
        camera.position.copy(c.pos); camera.up.set(...(c.up || [0, 1, 0])); camera.lookAt(...c.at);
        renderer.clear(); renderer.render(scene, camera);
      });
      renderer.setScissorTest(false); renderer.autoClear = true; camera.up.set(0, 1, 0); renderer.setViewport(0, 0, W, H);
    },
  };
}
