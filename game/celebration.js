// Goal celebrations on screen: after a goal of yours (and its replay) a small prompt comes up in front of you.
// Pick one with the stick and A / X (W, S and Enter in the browser), or strike its pose with your arms (wide for
// the aeroplane, hands to your ears, one arm to the sky); do nothing and the highlighted one plays; B skips to the
// restart. Never a trigger. The celebration itself is the sim's (rules/celebrate.js) and game/cheers.js poses it.
import * as THREE from 'three';
import { CELEBRATIONS, CELEBRATE, createPick, stepPick, gestureFromHands, celebrationDone, byKind } from '../rules/celebrate.js';
import { startCelebration, pickCelebration } from '../rules/sim.js';
import { uiPlane, PAL, text, box, maroon, stack, glyph } from './ps2/ui.js';
import { viewDrop } from './cheers.js';

const W = 512, RH = 46, TOP = 50, H = TOP + CELEBRATIONS.length * (RH + 2) + 52;
const HINT = { wide: 'or arms out wide', ears: 'or hands to ears', sky: 'or one arm up' };

export function createCelebration(scene, camera) {
  const { ctx, t: tex, m: panel } = uiPlane(W, H, 1.02, 1.02 * H / W, { mat: { depthTest: false } });
  panel.renderOrder = 12; panel.visible = false; scene.add(panel);
  const cap = uiPlane(512, 64, 1.3, 0.1625, { mat: { depthTest: false } });
  cap.m.renderOrder = 12; cap.m.visible = false; scene.add(cap.m);

  let wait = 0, pk = null, on = null, last = -1, hat = false, drawn = '', capT = 0;
  const head = new THREE.Vector3(), dir = new THREE.Vector3(), hand = new THREE.Vector3();

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
  // in front of your face: the prompt a little below your eye line, the caption lower still
  function place(m, dist, down) {
    camera.getWorldPosition(head); camera.getWorldDirection(dir);
    const yaw = Math.atan2(dir.x, dir.z);
    m.position.set(head.x + Math.sin(yaw) * dist, head.y - down, head.z + Math.cos(yaw) * dist);
    m.lookAt(head.x, head.y - down * 0.5, head.z);
  }
  function caption(s) {
    cap.ctx.clearRect(0, 0, 512, 64);
    box(cap.ctx, 0, 6, 512, 52, { r: 5, fill: 'rgba(8,8,10,0.8)', lw: 1.5 });
    text(cap.ctx, s, 256, 32, { size: 27, align: 'center', max: 488 });
    cap.t.needsUpdate = true; capT = 2.2;
  }
  const stop = () => { wait = 0; pk = null; on = null; panel.visible = cap.m.visible = false; };

  return {
    get active() { return wait > 0 || !!pk || !!on; },
    get picking() { return !!pk; },
    overlays: [panel, cap.m],
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
        place(panel, 2.1, 0.42); panel.visible = true; draw(raw.vr);
        if (!id) return null;
        last = CELEBRATIONS.findIndex(c => c.id === id);
        on = { kind: id, by: pk.force ? 'button' : pk.by };
        pk = null; panel.visible = false;
        pickCelebration(world, id);
        if (raw.vr) caption(byKind(id).say);
        return null;
      }
      if (!on) return null;
      capT -= dt; cap.m.visible = capT > 0;
      if (cap.m.visible) place(cap.m, 2.2, 0.62);
      if (skip || celebrationDone(world.celebrate)) {
        const r = { ...on, hat, bonus: hat && !skip ? CELEBRATE.bonus : 0, skipped: !!skip };
        stop();
        return r;
      }
      return null;
    },
  };
}
