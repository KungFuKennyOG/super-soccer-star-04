// Your hands in the headset, the '04 look: a real-size man's hand (handgeo.js) on its own small skeleton, one
// skinned mesh and one draw call each, painted in code (handskin.js), lit like the '04 players (Phong with a low
// broad highlight, baked shade in the vertex colors). The same interface as game/hands.js, so main.js can switch
// with its import line (trophy.js imports buildHand too).
// The fingers follow the controller's analog values and ease between poses: the trigger closes the index, the
// grip the other three; grip alone points, trigger (with or without grip) makes a fist, neither is a relaxed hand.
import * as THREE from 'three';
import { SKINS } from '../tex.js';
import { handSkeleton, handGeometry, SHEET } from './handgeo.js';
import { POSES, seatThumbs, holdPose, handleAt, HANDLE_DIR, CONTROLLER_D, newPose, copyPose, mixPoses, easePose, applyPose } from './handpose.js';
import { paintHand } from './handskin.js';
import { canvas, hex, smoothTex } from './paint.js';

// WebXR grip space (right hand): origin in the middle of the fist, -Z along the handle toward the thumb, +X out of
// the back of the hand (the palm faces -X), +Y back toward the wrist. The hand is built in H (handgeo.js: +y to the
// fingertips, +x to the little finger, +z out of the back), so: H +z → grip +X, the handle's axis (toward the
// little finger) → grip +Z, and the handle's middle → the origin. The left hand is the same mirrored in x.
export const HtoGrip = (() => {
  const xg = new THREE.Vector3(0, 0, 1), zg = HANDLE_DIR.clone(), yg = new THREE.Vector3().crossVectors(zg, xg);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xg, yg, zg)).invert();
})();
// The skin tone game/hands.js uses for you (tex.js SKINS[1]), deepened the way the '04 players' skin is.
export const YOU_SKIN = SKINS[1];
const skinRGB = h => hex(h).map((v, k) => v * [0.95, 0.9, 0.87][k]);

const mats = new Map();
function material(kit, skin) {
  const band = kit.sleeve || kit.shirt, key = `${band}${kit.trim}${skin}`;
  if (mats.has(key)) return mats.get(key);
  const c = canvas(SHEET.w, SHEET.h), t0 = performance.now();
  paintHand(c.getContext('2d'), { skin: skinRGB(skin), band: hex(band), trim: hex(kit.trim || '#ffffff') });
  const m = new THREE.MeshPhongMaterial({ map: smoothTex(c), vertexColors: true, specular: 0x302b26, shininess: 14 });
  // the forearm's end fades out (vertex alpha, handgeo.js) as a screen-door dither: no sorting, no blending, and
  // the game runs without MSAA so alpha to coverage wouldn't do it
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', `
      { int x = int(mod(gl_FragCoord.x, 4.0)), y = int(mod(gl_FragCoord.y, 4.0));
        const float B[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
        if (diffuseColor.a < (B[x + y * 4] + 0.5) / 16.0) discard; diffuseColor.a = 1.0; }`);
  };
  m.userData.paintMs = performance.now() - t0;
  mats.set(key, m);
  return m;
}

// One hand: a group in grip space holding the mesh. .hand drives it: setPose('open' | 'point' | 'fist' |
// 'hold' | a pose object), setInput(trigger, grip) for analog values, update(dt) eases toward the target.
// opts.d: what the hand is closed round in 'hold' (diameter, m); opts.at: where that handle's middle is in grip
// space, as for a right hand (the left mirrors it). Without them the hand sits on the controller's handle.
export function buildHand(side, pose = 'open', kit = { shirt: '#f2f1ea', trim: '#2b2f6b' }, skin = YOU_SKIN, opts = {}) {
  const t0 = performance.now();
  seatThumbs();
  const sk = handSkeleton(), mesh = new THREE.SkinnedMesh(handGeometry(), material(kit, skin));
  mesh.add(sk.root); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(sk.bones));
  mesh.frustumCulled = false;                               // (the bind box doesn't follow the fingers)
  const flip = new THREE.Group(); flip.add(mesh);
  if (side === 'left') flip.scale.x = -1;
  const group = new THREE.Group(); group.add(flip);          // this group is grip space
  const cur = newPose(), target = newPose();
  const place = (d, at) => {                                 // put the handle of diameter d at `at` (grip space)
    mesh.quaternion.copy(HtoGrip);
    mesh.position.copy(handleAt(d)).applyQuaternion(HtoGrip).negate().add(at);
  };
  const hand = {
    side, mesh, buildMs: performance.now() - t0, bones: sk.by, pose: cur,
    setPose(p, o = opts) {
      const d = o.d || CONTROLLER_D;
      place(p === 'hold' ? d : CONTROLLER_D, new THREE.Vector3(...(p === 'hold' && o.at ? o.at : [0, 0, 0])));
      copyPose(target, typeof p === 'string' ? (p === 'hold' ? holdPose(d) : POSES[p]) : p);
    },
    // trigger and grip 0..1: the index follows the trigger, the other three the grip; the trigger also closes them
    setInput(trig, grip) {
      const fist = trig, point = Math.max(0, grip - trig), open = 1 - fist - point;
      mixPoses(target, [[POSES.open, open], [POSES.point, point], [POSES.fist, fist]]);
    },
    update(dt) { easePose(cur, target, dt); applyPose(sk.by, cur); },
    snap() { copyPose(cur, target); applyPose(sk.by, cur); },
  };
  hand.setPose(pose); hand.snap();
  group.hand = hand;
  return group;
}

// Hands that follow the controllers. Call setKit when your team changes, update every frame.
export function createHands(renderer, rig) {
  const slots = [0, 1].map(i => {
    const grip = renderer.xr.getControllerGrip(i);
    const slot = { grip, side: null, gamepad: null, hand: null, hidden: false };
    grip.addEventListener('connected', e => { slot.side = e.data.handedness === 'left' ? 'left' : 'right'; slot.gamepad = e.data.gamepad; build(slot); });
    grip.addEventListener('disconnected', () => { slot.gamepad = null; if (slot.hand) slot.hand.visible = false; });
    rig.add(grip);
    return slot;
  });
  let kit = { shirt: '#f2f1ea', trim: '#2b2f6b' }, last = 0;
  function build(slot) {
    if (!slot.side) return;
    if (slot.hand) slot.grip.remove(slot.hand);
    slot.hand = buildHand(slot.side, 'open', kit);
    slot.grip.add(slot.hand);
  }
  return {
    grips: () => slots.filter(s => s.side && s.gamepad).map(s => ({ side: s.side, obj: s.grip, gamepad: s.gamepad })),
    highest(eyeY) {
      let best = null;
      for (const s of slots) {
        if (!s.gamepad || !s.grip.visible) continue;
        const dy = s.grip.position.y - eyeY;
        if (!best || dy > best.dy) best = { side: s.side, dy };
      }
      return best;
    },
    hand(side, out) {
      const s = slots.find(x => x.side === side && x.gamepad && x.grip.visible);
      if (!s) return null;
      s.grip.getWorldPosition(out);
      const b = s.gamepad.buttons;
      return { pos: out, grip: !!(b[1] && b[1].value > 0.45) };
    },
    setKit(k) { kit = k; slots.forEach(build); },
    hide(side, on) { for (const s of slots) if (s.side === side) s.hidden = on; },
    // the fingers follow the trigger and grip as they're pressed (analog), eased; dt is measured if not given
    update(dt) {
      const now = performance.now();
      if (dt === undefined) dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 72;
      last = now;
      for (const s of slots) {
        if (!s.hand || !s.gamepad) continue;
        const b = s.gamepad.buttons, h = s.hand.hand;
        s.hand.visible = !s.hidden;
        h.setInput(b[0] ? b[0].value : 0, b[1] ? b[1].value : 0);
        h.update(dt);
      }
    },
  };
}
