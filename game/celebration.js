// Goal celebrations on screen: after a goal of yours (and its replay) a small prompt comes up in front of you.
// Pick one with the stick and A / X (W, S and Enter in the browser), or strike its pose with your arms (wide for
// the aeroplane, hands to your ears, one arm to the sky); do nothing and the highlighted one plays; B skips to the
// restart. Never a trigger. The celebration itself is the sim's (rules/celebrate.js) and game/cheers.js poses it.
import * as THREE from 'three';
import { CELEBRATIONS, CELEBRATE, createPick, stepPick, gestureFromHands, celebrationDone, byKind } from '../rules/celebrate.js';
import { startCelebration, pickCelebration } from '../rules/sim.js';
import { uiPlane, PAL, text, box, maroon, stack, glyph } from './ps2/ui.js';
import { viewDrop } from './cheers.js';
import { slot } from './hudslot.js';

const W = 512, RH = 46, TOP = 50, H = TOP + CELEBRATIONS.length * (RH + 2) + 52;
const HINT = { wide: 'or arms out wide', ears: 'or hands to ears', sky: 'or one arm up' };

// The prompt and the caption ride on your head like the scoreboard bug and the subtitle do, a metre away:
// PANEL_W x its height and CAP_W x its height, in degrees of your view.
const DIST = 1, DEG = Math.PI / 180, PANEL_W = 22, CAP_W = 26;
const sizeOf = (deg, aspect) => { const w = 2 * DIST * Math.tan(deg / 2 * DEG); return [w, w * aspect]; };

// o.avoid: () => meshes floating in the world that the prompt must not cover (the HUD's event banner). What rides
// on your head (the subtitle, the scoreboard bug, the training card) it finds for itself: the camera's children.
export function createCelebration(scene, camera, o = {}) {
  const { ctx, t: tex, m: panel } = uiPlane(W, H, ...sizeOf(PANEL_W, H / W), { mat: { depthTest: false } });
  panel.renderOrder = 12; panel.visible = false; camera.add(panel);
  const cap = uiPlane(512, 64, ...sizeOf(CAP_W, 64 / 512), { mat: { depthTest: false } });
  cap.m.renderOrder = 12; cap.m.visible = false; camera.add(cap.m);
  for (const m of [panel, cap.m]) { m.rotation.order = 'YXZ'; m.userData.at = null; }

  let wait = 0, pk = null, on = null, last = -1, hat = false, drawn = '', capT = 0;
  const head = new THREE.Vector3(), dir = new THREE.Vector3(), hand = new THREE.Vector3();
  let lastRect = null;

  function gesture(raw) {
    if (!raw.vr || !raw.leftHand || !raw.rightHand) return null;
    camera.getWorldPosition(head); camera.getWorldDirection(dir);
    const f = Math.hypot(dir.x, dir.z) || 1, fx = dir.x / f, fz = dir.z / f;
    const rel = h => { hand.copy(h.pos).sub(head); return { x: -hand.x * fz + hand.z * fx, y: hand.y, z: hand.x * fx + hand.z * fz }; };
    return gestureFromHands(rel(raw.leftHand), rel(raw.rightHand));
  }
  function draw(vr) {
    const left = Math.max(0, 1 - pk.t / CELEBRATE.pickTime), key = `${pk.i}|${Math.round(left * 40)}|${vr}`;
    if (key === drawn) return;
    drawn = key;
    ctx.clearRect(0, 0, W, H);
    maroon(ctx, 0, 0, 236, 40, 4); box(ctx, 0, 0, 236, 40, { r: 4, fill: null, lw: 1.5 });
    text(ctx, hat ? 'Hat trick!' : 'Celebrate', 118, 20, { size: 26, align: 'center', weight: 900 });
    // the time left before the highlighted one plays
    box(ctx, 250, 14, W - 250, 12, { r: 3, fill: 'rgba(8,8,10,0.8)', lw: 1.5 });
    ctx.fillStyle = PAL.gold; ctx.fillRect(253, 17, (W - 256) * left, 6);
    const bottom = stack(ctx, 0, TOP, W, RH, CELEBRATIONS.map(c => ({ label: c.name, value: vr && c.gesture ? HINT[c.gesture] : '', vcolor: PAL.muted })), pk.i, { glyphK: vr ? 'A' : null });
    box(ctx, 0, bottom + 8, W, 40, { r: 5, fill: 'rgba(8,8,10,0.8)', lw: 1.5 });
    let x = 12;
    for (const [k, label] of vr ? [['A', 'Select'], ['B', 'Skip']] : [['Enter', 'Select'], ['C', 'Skip']]) { x += glyph(ctx, k, x, bottom + 28, 28) + 8; x += text(ctx, label, x, bottom + 28, { size: 21 }) + 22; }
    text(ctx, 'Stick: choose', W - 12, bottom + 28, { size: 19, align: 'right', color: PAL.muted });
    tex.needsUpdate = true;
  }
  // Where it goes: straight ahead under the middle of your view, as high as it can be without touching anything
  // else that is showing (game/hudslot.js): under the subtitle while one is up, lower still if the banner has come
  // down that far, off to one side if there is no room below. It drops out of the way at once and comes back up
  // gently, so it is never on top of the banner, the subtitle or the bug even for a frame.
  const inv = new THREE.Matrix4(), corner = new THREE.Vector3();
  function rectOf(m) {                                   // a plane's outline in your view, degrees
    const g = m.geometry.parameters, r = { y0: 999, y1: -999, e0: 999, e1: -999 };
    m.updateWorldMatrix(true, false);
    for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) {
      corner.set(sx * g.width, sy * g.height, 0).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
      if (corner.z > -0.05) return null;                 // (behind you: not in view)
      const y = Math.atan2(corner.x, -corner.z) / DEG, e = Math.atan2(corner.y, -corner.z) / DEG;
      r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y); r.e0 = Math.min(r.e0, e); r.e1 = Math.max(r.e1, e);
    }
    return r;
  }
  function showing() {
    camera.updateWorldMatrix(true, false); inv.copy(camera.matrixWorld).invert();
    const out = [];
    for (const m of [...camera.children, ...(o.avoid ? o.avoid() : [])]) {
      if (!m || !m.visible || m === panel || m === cap.m || !m.geometry || !m.geometry.parameters || !m.geometry.parameters.width) continue;
      const r = rectOf(m); if (r) out.push(r);
    }
    return out;
  }
  function place(m, deg, dt, vr) {
    const h = deg * m.geometry.parameters.height / m.geometry.parameters.width, lim = vr ? 44 : camera.fov / 2 - 1.5;
    const want = slot(showing(), deg, h, { top: -3, gap: 2.5, low: -lim, side: vr ? 50 : Math.atan(Math.tan(lim * DEG) * camera.aspect) / DEG });
    let at = m.userData.at;
    if (!at) at = m.userData.at = { yaw: want.yaw, top: want.top };
    // away from something at once (down, or out sideways); back toward the middle eased
    const e = Math.min(1, dt * 6);
    at.top = want.top < at.top ? want.top : at.top + (want.top - at.top) * e;
    at.yaw = Math.abs(want.yaw) > Math.abs(at.yaw) ? want.yaw : at.yaw + (want.yaw - at.yaw) * e;
    const el = (at.top - h / 2) * DEG, yaw = at.yaw * DEG;
    m.position.set(DIST * Math.tan(yaw), DIST * Math.tan(el) / Math.cos(yaw), -DIST);
    m.rotation.set(el, -yaw, 0);
    m.visible = want.ok;
    return { y0: at.yaw - deg / 2, y1: at.yaw + deg / 2, e0: at.top - h, e1: at.top };
  }
  function caption(s) {
    cap.ctx.clearRect(0, 0, 512, 64);
    box(cap.ctx, 0, 6, 512, 52, { r: 5, fill: 'rgba(8,8,10,0.8)', lw: 1.5 });
    text(cap.ctx, s, 256, 32, { size: 27, align: 'center', max: 488 });
    cap.t.needsUpdate = true; capT = 2.2;
  }
  const stop = () => { wait = 0; pk = null; on = null; panel.visible = cap.m.visible = false; panel.userData.at = cap.m.userData.at = null; };

  return {
    get active() { return wait > 0 || !!pk || !!on; },
    get picking() { return !!pk; },
    overlays: [panel, cap.m],
    // (for the tools and the test) what is showing in your view and where the prompt is, degrees
    get layout() { return { rects: showing(), panel: panel.visible ? lastRect : null }; },
    // how far your eyes are moved up or down by the one playing (m): the page adds it to the rig
    drop(world) { return on ? viewDrop(world.celebrate) : 0; },
    get state() { return { wait, pick: pk && { i: pk.i, t: pk.t }, on, hat }; },
    // a goal of yours: teammates start over; the prompt follows. hatTrick: this one pays the bonus.
    start(world, hatTrick = false, delay = CELEBRATE.wait) { stop(); startCelebration(world); wait = delay; hat = hatTrick; },
    cancel: stop,
    // (for tests and the console) pick one now
    pick(world, id) { if (!pk) return false; pk.force = id; return true; },
    // Returns { kind, by, hat, bonus, skipped } on the frame it ends, otherwise null.
    update(dt, raw, world) {
      if (!world.celebrate || !world.dead) { if (this.active) stop(); return null; }
      const skip = raw.nav.back || raw.drag;
      if (wait > 0) {
        if (skip) { stop(); return { kind: null, by: 'skip', hat, bonus: 0, skipped: true }; }
        wait -= dt;
        if (wait <= 0) { pk = createPick(last + 1); drawn = ''; }
        return null;
      }
      if (pk) {
        if (skip) { stop(); return { kind: null, by: 'skip', hat, bonus: 0, skipped: true }; }
        const id = pk.force || stepPick(pk, dt, raw.nav, gesture(raw));
        lastRect = place(panel, PANEL_W, dt, raw.vr); draw(raw.vr);
        if (!id) return null;
        last = CELEBRATIONS.findIndex(c => c.id === id);
        on = { kind: id, by: pk.force ? 'button' : pk.by };
        pk = null; panel.visible = false; panel.userData.at = null;
        pickCelebration(world, id);
        if (raw.vr) caption(byKind(id).say);
        return null;
      }
      if (!on) return null;
      capT -= dt; cap.m.visible = capT > 0;
      if (cap.m.visible) place(cap.m, CAP_W, dt, raw.vr);
      if (skip || celebrationDone(world.celebrate)) {
        const r = { ...on, hat, bonus: hat && !skip ? CELEBRATE.bonus : 0, skipped: !!skip };
        stop();
        return r;
      }
      return null;
    },
  };
}
