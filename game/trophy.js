// The trophy lift. The cup sits on a plinth in front of you with your squad around you. In the
// headset, grab it with your grips (one hand or both) and raise it above your head. In the browser,
// press E to pick it up and hold Up to raise it. Lifting it sets off confetti, fireworks and the crowd.
import * as THREE from 'three';
import { BTN } from '../engine/input.js';
import { ps1 } from './ps1.js';
import { uiPlane, PAL, text, box, maroon, wrap, sc } from './ps2/ui.js';
import { animate } from './actors.js';
import { buildPlayer2 as buildPlayer } from './ps2/player.js';
import { sfx } from './audio.js';
import { buildHand } from './ps2/hands.js';
import { buildTrophy2, buildPlinth2 } from './ps2/trophies.js';
import { playMusic } from './music.js';

// Where your hands go on each cup comes with the cup (game/ps2/trophies.js: userData.grips, index 0 on the cup's
// +x side, your left as it faces you, for your left hand).
// How a posed hand (in grip space, see hands.js) sits on a hand-hold: knuckles away from you, thumb up,
// palm toward the cup. The same basis works for both hands because the left mesh is mirrored.
const HOLD = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0)));

// hands: from game/hands.js, so the cup is held by your real grips.
// how far in front of you the plinth stands: the hand-holds are in reach without a step (0.9 m was
// right at the end of your arms)
const NEAR = 0.6;

export function createCeremony(scene, camera, hands) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const plinth = buildPlinth2(); plinth.position.set(0, 0, NEAR); root.add(plinth);   // the '04 plinth and cups (game/ps2/trophies.js)

  // the hint card over the plinth
  const { ctx, t: tex, m: card } = uiPlane(768, 160, 1.5, 0.31, { mat: { depthTest: false } });
  card.renderOrder = 12; card.position.set(0, 2.25, 1.6); card.rotation.y = Math.PI; root.add(card);
  const say = (a, b, col = PAL.ink) => {
    ctx.clearRect(0, 0, 768, 160); box(ctx, 0, 0, 768, 160, { r: 6, fill: 'rgba(8,8,10,0.86)' });
    maroon(ctx, 2, 2, 764, 74); ctx.fillStyle = PAL.sep; ctx.fillRect(2, 76, 764, 2);
    text(ctx, a, 384, 40, { size: 50, align: 'center', weight: 900, color: col === '#f2c21a' ? PAL.ink : col, max: 730 });
    // the instruction wraps onto a second line when it's too wide for the sign
    const lines = wrap(ctx, sc(b || ''), 720, 32).filter(Boolean).slice(0, 2);
    lines.forEach((l, i) => text(ctx, l, 384, lines.length > 1 ? 100 + i * 36 : 118, { size: 32, align: 'center', max: 730 }));
    tex.needsUpdate = true;
  };

  // confetti: one instanced mesh of little paper squares
  const N = 420, conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.04), ps1({ lit: false, side: THREE.DoubleSide }), N);
  conf.frustumCulled = false; conf.visible = false; scene.add(conf);
  const bits = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: Math.random() * 6, w: 2 + Math.random() * 4 }));
  // fireworks: sparks in bursts over the stands
  const S = 240, sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), ps1({ lit: false }), S);
  sparks.frustumCulled = false; sparks.visible = false; scene.add(sparks);
  const sp = Array.from({ length: S }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();

  let trophy = null, squad = [], state = null, lifted = false, liftT = 0, palette = [], nextBurst = 0;
  const head = new THREE.Vector3(), dir = new THREE.Vector3(), hand = new THREE.Vector3(), tw = new THREE.Vector3();
  const rest = new THREE.Vector3(0, 1.02, NEAR);
  let held = { left: null, right: null }, deskHold = false, deskY = 1.25, deskHands = [], anchors = [];
  // the lift counts once a hand holding the cup is this far above your eyes (fists just over your head).
  // It used to wait for the cup's base to clear your head, which on the club cup meant arms locked
  // straight up, 44 cm over your eyes, and some lifts never counted.
  const LIFT_ABOVE = 0.12, SKIP_AFTER = 20;
  let waitT = 0, skipShown = false, topHand = -Infinity;

  function burst(at) {
    const c = palette[Math.floor(Math.random() * palette.length)];
    let n = 0;
    for (const s of sp) {
      if (s.life > 0 || n > 60) continue;
      s.p.copy(at); s.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(9 + Math.random() * 4);
      s.life = 1.4; s.c = c; n++;
    }
    sfx('kick', 0.4);
  }

  return {
    get active() { return !!state; },
    // kind: 'world' | 'club'; team: your team (for the squad's kit and the confetti colors)
    start(kind, team) {
      if (trophy) root.remove(trophy);
      trophy = buildTrophy2(kind); trophy.position.copy(rest); root.add(trophy);
      // posed hands that hold the cup properly: they replace your controller hands while you grip it
      // (and are your hands in the browser). Left hand on your left (+x here), fingers wrapping in.
      deskHands = ['left', 'right'].map(sd => buildHand(sd, 'hold', team.kit, undefined, { d: trophy.userData.holdD }));   // closed round what that cup is held by
      anchors = trophy.userData.grips.map(a => new THREE.Vector3(...a));
      deskHands.forEach((h, i) => { h.position.copy(anchors[i]); h.quaternion.copy(HOLD); h.visible = false; trophy.add(h); });
      for (const m of squad) root.remove(m.root);
      squad = [];
      for (let i = 0; i < 6; i++) {
        const m = buildPlayer(team.kit, [2, 4, 5, 8, 11, 14][i], i * 11 + 5);
        const a = -1.1 + i * 0.44, r = 2.0;
        m.root.position.set(Math.sin(a) * r, 0, Math.cos(a) * r * 0.6 + 0.9);
        m.root.rotation.y = Math.atan2(-m.root.position.x, -m.root.position.z + 0.2);
        m.phase = i; root.add(m.root); squad.push(m);
      }
      palette = [team.kit.shirt, team.kit.alt, team.kit.shorts, '#f2c21a', '#ffffff'];
      camera.getWorldPosition(head); camera.getWorldDirection(dir);
      root.position.set(head.x, 0, head.z); root.rotation.y = Math.atan2(dir.x, dir.z);
      root.visible = true; state = 'waiting'; lifted = false; held = { left: null, right: null }; trophy.quaternion.identity(); deskHold = false; deskY = 1.25; waitT = 0; skipShown = false;
      say('CHAMPIONS!', 'GRAB THE CUP AND LIFT IT ABOVE YOUR HEAD');
    },
    stop() { state = null; root.visible = conf.visible = sparks.visible = false; hands.hide('left', false); hands.hide('right', false); },
    // raw: controls.read(); keys: desktop keys. Returns 'done' once you've lifted it and pressed on.
    update(dt, t, raw, keys) {
      if (!state) return null;

      camera.getWorldPosition(head);
      const local = v => root.worldToLocal(v);

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
        if (holding.length === 2 && holding[0].a !== holding[1].a) {
          // two hands: the cup turns with the line between your hands (tilt it, turn it)
          const [h0, h1] = holding, want = h1.p.clone().sub(h0.p).normalize(), have = h1.a.clone().sub(h0.a).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(have, want);
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
        if (keys.KeyE && !deskHold) { deskHold = true; deskHands.forEach(h => { h.visible = true; }); }
        if (deskHold) {
          if (keys.ArrowUp || keys.KeyW) deskY = Math.min(head.y + 0.45, deskY + dt * 0.9);
          trophy.position.lerp(new THREE.Vector3(0, deskY, 0.55), Math.min(1, dt * 8));
        }
      }

      trophy.getWorldPosition(tw);
      const up = raw.vr ? topHand > head.y + LIFT_ABOVE : deskHold && tw.y > head.y + 0.05;
      if (!lifted && up) {
        lifted = true; liftT = 0; state = 'lifted';
        sfx('roar'); sfx('net'); playMusic('champions');
        say('CHAMPIONS!', '', '#ffffff');
        conf.visible = sparks.visible = true;
        for (const b of bits) {
          b.p.set(head.x + (Math.random() - 0.5) * 8, head.y + 3 + Math.random() * 5, head.z + (Math.random() - 0.5) * 8);
          b.v.set((Math.random() - 0.5) * 0.6, -0.6 - Math.random() * 0.6, (Math.random() - 0.5) * 0.6);
          b.c = palette[Math.floor(Math.random() * palette.length)];
        }
      }
      if (lifted) {
        liftT += dt;
        // confetti flutters down and loops back to the top
        bits.forEach((b, i) => {
          b.p.addScaledVector(b.v, dt); b.p.x += Math.sin(t * b.w + b.r) * dt * 0.4;
          if (b.p.y < 0.05) b.p.y = head.y + 4;
          q.setFromEuler(e.set(t * b.w, b.r + t * 2, 0));
          conf.setMatrixAt(i, m4.compose(b.p, q, one)); conf.setColorAt(i, col.set(b.c));
        });
        conf.instanceMatrix.needsUpdate = true; if (conf.instanceColor) conf.instanceColor.needsUpdate = true;
        nextBurst -= dt;
        if (nextBurst <= 0) {
          nextBurst = 0.5 + Math.random() * 0.6;
          const a = Math.random() * Math.PI * 2;
          burst(new THREE.Vector3(head.x + Math.sin(a) * 40, 22 + Math.random() * 12, head.z + Math.cos(a) * 40));
        }
        sp.forEach((s, i) => {
          if (s.life > 0) { s.life -= dt; s.v.y -= 6 * dt; s.p.addScaledVector(s.v, dt); }
          const k = Math.max(0, s.life);
          sparks.setMatrixAt(i, m4.compose(s.p, q.identity(), one.clone().multiplyScalar(k)));
          sparks.setColorAt(i, col.set(s.c || '#ffffff'));
        });
        sparks.instanceMatrix.needsUpdate = true; if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;
        if (liftT > 6 && state === 'lifted') { state = 'ready'; say('CHAMPIONS!', 'PRESS A TO CONTINUE', '#ffffff'); }
      }
      // never a dead end: if the lift hasn't counted after a while, A carries on
      if (state === 'waiting') {
        waitT += dt;
        if (waitT > SKIP_AFTER && !skipShown) { skipShown = true; say('CHAMPIONS!', 'LIFT IT HIGH OR PRESS A TO CONTINUE'); }
        if (skipShown && raw.nav && raw.nav.ok) return 'done';
      }
      for (const m of squad) animate(m, { vx: 0, vz: 0, role: 'mate' }, dt, t, lifted);
      card.lookAt(head);
      if (state === 'ready' && raw.nav && raw.nav.ok) return 'done';
      return null;
    },
  };
}
