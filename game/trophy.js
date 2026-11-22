// The trophy presentation. A stage on the pitch facing the goal end (game/ps2/stage.js): you front and centre,
// the cup on a plinth within reach, your squad on the platform and the riser behind you (game/ceremonycast.js),
// photographers in front. In the headset, grab the cup with your grips (one hand or both) and raise it above
// your head; in the browser Space (or E) takes it and W / Up raises it. When it goes up: confetti cannons, spark
// jets, flashes round the ground (game/ps2/confetti.js), a fanfare, the squad erupts and the crowd with them.
import * as THREE from 'three';
import { BTN } from '../engine/input.js';
import { uiPlane, PAL, text, box, maroon, glyph, measure } from './ps2/ui.js';
import { sfx } from './audio.js';
import { buildHand } from './ps2/hands.js';
import { buildTrophy2, buildPlinth2 } from './ps2/trophies.js';
import { buildStage, STAGE, CUP_NAME } from './ps2/stage.js';
import { createPress } from './presscast.js';
import { buildConfetti, buildJets, buildFlashes } from './ps2/confetti.js';
import { createCast } from './ceremonycast.js';
import { playMusic } from './music.js';

// Where your hands go on each cup comes with the cup (game/ps2/trophies.js: userData.grips, index 0 on the cup's
// +x side, your left as it faces you, for your left hand).
// How a posed hand (in grip space, see hands.js) sits on a hand-hold: knuckles away from you, thumb up,
// palm toward the cup. The same basis works for both hands because the left mesh is mirrored.
const HOLD = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0)));

// how far in front of you the plinth stands: the hand-holds are in reach without a step (0.9 m was
// right at the end of your arms)
const NEAR = 0.6;
// where the stage stands on the pitch (you, on it), facing the goal end, its big screen and the home curva
export const STAGE_AT = { x: 0, z: -13 };

// hands: from game/hands.js, so the cup is held by your real grips. o.stadium: for the crowd and the flashes.
export function createCeremony(scene, camera, hands, o = {}) {
  const rig = o.rig || camera.parent, stadium = o.stadium || null;
  // stageG: the stage's frame (you at its origin facing -z). root: the frame the cup is handled in, on the
  // platform, turned round so that +z is ahead of you and +x your left.
  const stageG = new THREE.Group(); stageG.visible = false; stageG.position.set(STAGE_AT.x, 0, STAGE_AT.z); scene.add(stageG);
  const root = new THREE.Group(); root.position.y = STAGE.h; root.rotation.y = Math.PI; stageG.add(root);
  const plinth = buildPlinth2(); plinth.position.set(0, 0, NEAR); root.add(plinth);   // the '04 plinth and cups (game/ps2/trophies.js)

  // the prompt: a small plate floating over the cup, gone once you have it
  const PW = 640, PH = 132, { ctx, t: tex, m: card } = uiPlane(PW, PH, 0.36, 0.36 * PH / PW, { mat: { depthTest: false } });
  card.renderOrder = 12; root.add(card);
  // the television lights on the stage: from the front, so faces turned to the cup aren't in their own shade
  const lamp = new THREE.DirectionalLight('#fff4e0', 0.5); lamp.position.set(0.25, 0.9, -1); lamp.visible = false; scene.add(lamp);
  let cardA = 0, cardWant = 0;
  // parts: strings, or [glyph] for a button or key
  const say = (head, parts) => {
    ctx.clearRect(0, 0, PW, PH); box(ctx, 0, 0, PW, PH, { r: 6, fill: 'rgba(8,8,10,0.88)' });
    maroon(ctx, 2, 2, PW - 4, 50); ctx.fillStyle = PAL.sep; ctx.fillRect(2, 52, PW - 4, 2);
    text(ctx, head, PW / 2, 28, { size: 30, align: 'center', weight: 900, max: PW - 30 });
    const size = 27, gh = 40, w = p => (Array.isArray(p) ? (p[0].length === 1 ? gh : measure(ctx, p[0], gh * 0.48) + gh * 0.6) : measure(ctx, p, size)) + 10;
    let x = (PW - parts.reduce((s, p) => s + w(p), 0)) / 2;
    for (const p of parts) { if (Array.isArray(p)) glyph(ctx, p[0], x, 93, gh); else text(ctx, p, x, 93, { size }); x += w(p); }
    tex.needsUpdate = true; cardWant = 1;
  };

  const jets = buildJets(); stageG.add(jets.mesh);
  const stages = {};
  let stage = null, cast = null, press = null, confetti = null, flashes = null, key = null, hemi = null;
  let trophy = null, state = null, lifted = false, liftT = 0, upNow = false, roarT = 0, vrMode = false;
  const head = new THREE.Vector3(), dir = new THREE.Vector3(), hand = new THREE.Vector3(), tw = new THREE.Vector3(), cupS = new THREE.Vector3(), sun = new THREE.Vector3(), cKey = new THREE.Color(), cAmb = new THREE.Color();
  const rest = new THREE.Vector3(0, 1.02, NEAR);
  let held = { left: null, right: null }, deskHold = false, deskY = 1.25, deskHands = [], anchors = [], rigWas = null;
  // the lift counts once a hand holding the cup is this far above your eyes (fists just over your head).
  // It used to wait for the cup's base to clear your head, which on the club cup meant arms locked
  // straight up, 44 cm over your eyes, and some lifts never counted.
  const LIFT_ABOVE = 0.12, SKIP_AFTER = 20;
  let waitT = 0, skipShown = false, topHand = -Infinity;

  // You are put on the stage once, as it starts: turned to face the front with your head over the mark. After
  // that the rig is left alone (pinning it cancelled real steps), so you walk about it for real.
  function standYou() {
    rigWas = { y: rig.rotation.y, vr: vrMode };
    camera.getWorldDirection(dir);
    rig.rotation.y += Math.PI - Math.atan2(dir.x, dir.z);
    rig.position.y = STAGE.h; rig.updateMatrixWorld(true); camera.getWorldPosition(head);
    rig.position.x += STAGE_AT.x - head.x; rig.position.z += STAGE_AT.z - head.z;
    rig.updateMatrixWorld(true);
  }
  // camera flashes: the photographers' lenses, and a few hundred seats round the ground
  function flashPoints() {
    const pts = press.lenses(), fans = stadium && stadium.ground && stadium.ground.meshes.fans, seat = fans && fans.geometry.attributes.aSeat;
    if (seat) for (let i = 0, n = 420, step = Math.max(1, Math.floor(seat.count / n)); i < seat.count; i += step) pts.push([seat.getX(i) - STAGE_AT.x, seat.getY(i) + 1.1, seat.getZ(i) - STAGE_AT.z]);
    return pts;
  }
  function clear() {
    if (cast) { cast.dispose(); cast = null; }
    if (press) { press.dispose(); press = null; }
    if (confetti) { stageG.remove(confetti.mesh); confetti.mesh.geometry.dispose(); confetti.mesh.material.dispose(); confetti = null; }
    if (flashes) { stageG.remove(flashes.mesh); flashes.mesh.geometry.dispose(); flashes.mesh.material.dispose(); flashes = null; }
    if (stage) stageG.remove(stage.mesh);
    jets.stop();
  }

  return {
    get active() { return !!state; },
    get lifted() { return lifted; },
    get cast() { return cast; },
    get stageGroup() { return stageG; },
    // what it adds to the frame, for the notes: { tris, calls }
    get cost() { return { stage: stage && stage.tris, cast: cast && cast.tris, press: press && press.tris, confetti: confetti && confetti.tris, jets: jets.tris }; },
    // kind: 'world' | 'club'; team: your team (for the squad's kit and the confetti colors); vr: in the headset
    start(kind, team, vr = false) {
      vrMode = vr;
      if (trophy) root.remove(trophy);
      clear();
      trophy = buildTrophy2(kind); trophy.position.copy(rest); root.add(trophy);
      // posed hands that hold the cup properly: they replace your controller hands while you grip it
      // (and are your hands in the browser). Left hand on your left (+x here), fingers wrapping in.
      deskHands = ['left', 'right'].map(sd => buildHand(sd, 'hold', team.kit, undefined, { d: trophy.userData.holdD }));   // closed round what that cup is held by
      anchors = trophy.userData.grips.map(a => new THREE.Vector3(...a));
      deskHands.forEach((h, i) => { h.position.copy(anchors[i]); h.quaternion.copy(HOLD); h.visible = false; trophy.add(h); });
      stage = stages[kind] || (stages[kind] = buildStage(kind)); stageG.add(stage.mesh);
      cast = createCast(stageG, team, kind === 'world' ? 3 : 5);
      const k = team.kit;
      confetti = buildConfetti([k.shirt, k.shirt, k.alt || k.shorts, k.shorts, '#f2f1ea', '#e8c04a']); stageG.add(confetti.mesh);
      press = createPress(stageG); stageG.updateMatrixWorld(true); press.update(0, 0, cupS.set(0, STAGE.h + 1.2, -NEAR));
      flashes = buildFlashes(flashPoints(), press.men.length); stageG.add(flashes.mesh);
      key = scene.children.find(c => c.isDirectionalLight); hemi = scene.children.find(c => c.isHemisphereLight);
      lamp.intensity = stadium && stadium.ground && stadium.ground.recipe.time === 'day' ? 0.22 : 0.5; lamp.visible = true;
      card.position.set(0, rest.y + trophy.userData.height + 0.1, NEAR);
      standYou();
      stageG.visible = true; state = 'waiting'; lifted = upNow = false; liftT = 0; held = { left: null, right: null }; trophy.quaternion.identity(); deskHold = false; deskY = 1.25; waitT = 0; skipShown = false; cardA = 0;
      say(`${CUP_NAME[kind]} CHAMPIONS`, vr ? ['HOLD BOTH ', ['GRIP'], ' ON THE CUP AND LIFT IT HIGH'] : [['SPACE'], ' TAKE THE CUP   ', ['W'], ' LIFT IT']);
    },
    stop() {
      if (!state) return;
      state = null; stageG.visible = lamp.visible = false; clear(); hands.hide('left', false); hands.hide('right', false);
      rig.position.y = 0; if (rigWas && !rigWas.vr) rig.rotation.y = rigWas.y;
    },
    // raw: controls.read(); keys: desktop keys. Returns 'done' once you've lifted it and pressed on.
    update(dt, t, raw, keys) {
      if (!state) return null;

      camera.getWorldPosition(head);
      const local = v => root.worldToLocal(v);
      let have = false;

      if (raw.vr) {
        // grab: squeeze a grip with your hand near one of the cup's hand-holds
        const grips = hands.grips(), aw = new THREE.Vector3();
        for (const g of grips) {
          const b = g.gamepad.buttons[BTN.GRIP], squeeze = !!(b && b.value > 0.45);
          if (!squeeze) { held[g.side] = null; continue; }
          if (held[g.side] !== null) continue;
          // each hand takes the hand-hold on its own side
          const i = g.side === 'left' ? 0 : 1;
          g.obj.getWorldPosition(hand); aw.copy(anchors[i]); trophy.localToWorld(aw);
          if (hand.distanceTo(aw) < 0.3) held[g.side] = i;
        }
        // a posed hand appears on the hand-hold you grabbed, and your controller hand hides
        for (const side of ['left', 'right']) {
          const on = held[side] !== null, h = deskHands[side === 'left' ? 0 : 1];
          h.visible = on; hands.hide(side, on);
        }
        topHand = -Infinity;
        for (const g of grips) if (held[g.side] !== null) topHand = Math.max(topHand, g.obj.getWorldPosition(new THREE.Vector3()).y);
        const holding = grips.filter(g => held[g.side] !== null).map(g => ({ p: local(g.obj.getWorldPosition(new THREE.Vector3())), a: anchors[held[g.side]] }));
        have = holding.length > 0;
        if (holding.length === 2 && holding[0].a !== holding[1].a) {
          // two hands: the cup turns with the line between your hands (tilt it, turn it)
          const [h0, h1] = holding, want = h1.p.clone().sub(h0.p).normalize(), was = h1.a.clone().sub(h0.a).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(was, want);
          trophy.quaternion.slerp(q, Math.min(1, dt * 15));
          const mid = h0.p.clone().add(h1.p).multiplyScalar(0.5), amid = h0.a.clone().add(h1.a).multiplyScalar(0.5).applyQuaternion(trophy.quaternion);
          trophy.position.lerp(mid.sub(amid), Math.min(1, dt * 25));
        } else if (holding.length) {
          const h0 = holding[0];
          trophy.position.lerp(h0.p.clone().sub(h0.a.clone().applyQuaternion(trophy.quaternion)), Math.min(1, dt * 25));
        } else {
          trophy.position.lerp(rest, Math.min(1, dt * 6));
          trophy.quaternion.slerp(new THREE.Quaternion(), Math.min(1, dt * 6));
        }
      } else {
        if ((keys.KeyE || keys.Space) && !deskHold) { deskHold = true; deskHands.forEach(h => { h.visible = true; }); }
        if (deskHold) {
          if (keys.ArrowUp || keys.KeyW) deskY = Math.min(head.y - STAGE.h + 0.45, deskY + dt * 0.9);
          if (keys.ArrowDown || keys.KeyS) deskY = Math.max(1.25, deskY - dt * 0.9);
          trophy.position.lerp(new THREE.Vector3(0, deskY, 0.55), Math.min(1, dt * 8));
        }
        have = deskHold;
      }

      trophy.getWorldPosition(tw);
      // up: it counts (over your eyes); upNow: it is still up there, with a little slack so it doesn't flicker
      const slack = upNow ? 0.18 : 0;
      const up = raw.vr ? topHand > head.y + LIFT_ABOVE - slack : deskHold && tw.y > head.y + 0.05 - slack;
      if (up && !upNow) {
        // every time it goes up: the jets, the roar, the stands again
        jets.fire(t, lifted ? 3 : 5.5); sfx('roar'); sfx('cannon'); roarT = 0;
        if (stadium) { stadium.cheer(false); stadium.cheer(true); }
        if (!lifted) {
          lifted = true; liftT = 0; state = 'lifted'; cardWant = 0;
          sfx('fanfare'); confetti.fire(t);
          setTimeout(() => { if (state) playMusic('champions'); }, 1900);
        }
      }
      upNow = up;
      if (lifted) {
        liftT += dt; roarT += dt;
        if (upNow && roarT > 3.2) { roarT = 0; sfx('roar'); }                 // the roar holds while the cup is up
        if (liftT > 6 && state === 'lifted') { state = 'ready'; say('CHAMPIONS!', [['A'], ' CONTINUE']); }
      }
      // never a dead end: if the lift hasn't counted after a while, A carries on
      if (state === 'waiting') {
        if (have) cardWant = 0;
        waitT += dt;
        if (waitT > SKIP_AFTER && !skipShown) { skipShown = true; say('LIFT IT OVER YOUR HEAD', ['OR ', ['A'], ' CONTINUE']); }
        if (skipShown && raw.nav && raw.nav.ok) return 'done';
      }
      // the squad, and what is in the air
      stageG.updateMatrixWorld(true);
      cupS.copy(tw); stageG.worldToLocal(cupS);
      cast.update(dt, t, { cup: cupS, held: have, up: lifted && (upNow || liftT < 2.5) });
      press.update(dt, t, cupS);
      if (key) { sun.copy(key.position).normalize(); cKey.copy(key.color).multiplyScalar(key.intensity); }
      if (hemi) cAmb.copy(hemi.color).multiplyScalar(hemi.intensity * 0.75);
      confetti.update(t, sun, cKey, cAmb); jets.update(t);
      flashes.update(t, upNow ? 0.55 : lifted ? 0.2 : have ? 0.16 : 0.05, o.renderer ? o.renderer.domElement.height : 900);
      cardA += (cardWant - cardA) * Math.min(1, dt * 5); card.material.opacity = cardA; card.visible = cardA > 0.02;
      card.lookAt(head);
      if (state === 'ready' && raw.nav && raw.nav.ok) return 'done';
      return null;
    },
  };
}
