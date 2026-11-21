// Everything drawn on top of the match, all in-world so it works in the headset:
// the stadium scoreboard, the event banner, the pass timing rings, the shot reticle and its power ring.
import * as THREE from 'three';
import { GOAL } from '../rules/tuning.js';
import { ps1 } from './ps1.js';
import { ringTex, reticleTex } from './tex.js';
import { uiPlane } from './ps2/ui.js';
import { BW, BH, paintBug, SW, SH, paintBoard, NW, NH, paintBanner, TW, TH, paintTag, RW, RH, RMAP, paintRadar } from './ps2/hudpaint.js';

export function buildHud(scene, camera) {
  /* scoreboard over the stand behind the goal */
  const sb = uiPlane(SW, SH, 18, 6.75);
  sb.m.material.transparent = false; sb.m.material.depthWrite = true;
  sb.m.position.set(0, 29, GOAL.z - 22);
  scene.add(sb.m);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(19, 7.6, 0.6), ps1({ color: '#22222a' }));
  frame.position.set(0, 29, GOAL.z - 22.35); scene.add(frame);
  // hung from two cables, high enough to clear any stand's roof (placeScoreboard)
  const cables = [-1, 1].map(s => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 40, 0.12), ps1({ color: '#22222a' }));
    c.position.set(s * 7, 29 + 3.8 + 20, GOAL.z - 22.4); scene.add(c); return c;
  });
  function placeScoreboard(y, z) {
    sb.m.position.y = frame.position.y = y;
    sb.m.position.z = z; frame.position.z = z - 0.35;
    for (const c of cables) { c.position.y = y + 3.8 + 20; c.position.z = z - 0.4; }
  }
  // the scoreboard bug: top left of your view in the headset (on the camera), top left of the page in the browser
  const bug = uiPlane(BW, BH, 0.3, 0.3 * BH / BW, { mat: { depthTest: false } });
  bug.m.renderOrder = 26; bug.m.position.set(-0.33, 0.25, -0.72); bug.m.rotation.set(0.3, 0.38, 0, 'YXZ'); bug.m.visible = false;
  camera.add(bug.m);
  bug.c.className = 'bug';
  let sbKey = '', bugKey = '';
  // score: 'MAD 1-2 BAR' in a cup match (shown instead of the goal count), or ''.
  // teams: { home, away, us, them, show, vr } for the bug (us / them only in a cup match)
  function scoreboard(goals, clock, points, flash, score = '', teams = null) {
    const blinkOn = flash ? Math.floor(performance.now() / 150) % 2 : 0;
    const key = `${goals}|${clock}|${points}|${flash}|${score}|${blinkOn}`;
    if (key !== sbKey) { sbKey = key; paintBoard(sb.ctx, { goals, clock, points, flash, score }); sb.t.needsUpdate = true; }
    bug.m.visible = !!(teams && teams.show && teams.vr);
    bug.c.style.visibility = teams && teams.show ? 'visible' : 'hidden';
    if (!teams || !teams.show) return;
    const k2 = `${teams.home.id}|${teams.away.id}|${teams.us}|${teams.them}|${goals}|${points}|${clock}|${flash}`;
    if (k2 === bugKey) return;
    bugKey = k2;
    paintBug(bug.ctx, { ...teams, goals, points, clock, flash });
    bug.t.needsUpdate = true;
  }

  /* banner: floats in front of your face */
  const bn = uiPlane(NW, NH, 2.4, 0.8, { mat: { depthTest: false } });
  bn.m.renderOrder = 10; bn.m.visible = false;
  scene.add(bn.m);
  let bnT = 9, bnLife = 1.8;
  function banner(b) {
    paintBanner(bn.ctx, b);
    bn.t.needsUpdate = true;
    bnT = 0; bnLife = b.big ? 2.4 : 1.4;
    bn.m.visible = true;
  }

  /* pass timing: a fixed white circle and a shrinking ring over your target */
  const ringMat = () => ps1({ map: ringTex(), alphaTest: 0.5, lit: false, depthTest: false, fog: false });
  const ringTarget = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat());
  const ringLive = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat());
  for (const r of [ringTarget, ringLive]) { r.renderOrder = 11; r.visible = false; scene.add(r); }
  // ground ring under who you'd pass to
  const groundRing = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), ps1({ map: ringTex(), alphaTest: 0.5, lit: false, color: '#f2c21a' }));
  groundRing.rotation.x = -Math.PI / 2; groundRing.visible = false; scene.add(groundRing);
  // "LOB" over the target when a defender is in the lane (the pass will go over the top)
  // (and his number: the '04 name bar over the man you'd pass to)
  const tag = uiPlane(TW, TH, 0.8, 0.8 * TH / TW, { mat: { depthTest: false } });
  const lobTag = tag.m;
  lobTag.renderOrder = 11; lobTag.visible = false; scene.add(lobTag);
  let tagKey = '';

  /* shot: a reticle on the goal mouth with a power ring */
  const reticle = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), ps1({ map: reticleTex(), alphaTest: 0.5, lit: false, depthTest: false, fog: false }));
  reticle.renderOrder = 11; reticle.visible = false; scene.add(reticle);
  // Shot power: a ring round the reticle on the goal that fills up as you charge (Kenny dropped the
  // separate power bar as redundant).
  const hudMat = color => ps1({ color, lit: false, depthTest: false, depthWrite: false, fog: false });
  const ringSegs = [];
  for (let i = 0; i < 28; i++) {
    const a0 = Math.PI / 2 - (i / 28) * Math.PI * 2;                 // clockwise from the top
    const seg = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.98, 2, 1, a0 - Math.PI * 2 / 28 * 0.85, Math.PI * 2 / 28 * 0.85), hudMat('#f2c21a'));
    seg.renderOrder = 12; reticle.add(seg); ringSegs.push(seg);
  }

  const headPos = new THREE.Vector3(), headDir = new THREE.Vector3(), tmp = new THREE.Vector3();
  let bnYaw = null;

  return {
    scoreboard, banner, placeScoreboard,
    bugCanvas: bug.c,
    // everything the HUD floats in the world, hidden while the replay camera films
    overlays: [bn.m, ringTarget, ringLive, groundRing, lobTag, reticle],
    // per frame. pass: { target: {x,z}, scale (live ring), grade window color } or null.
    update(dt, { pass, aim, charge, over, mate, lob }) {
      camera.getWorldPosition(headPos); camera.getWorldDirection(headDir);
      // banner pops in, then holds level in front of the face
      bnT += dt;
      if (bn.m.visible) {
        const yaw = Math.atan2(headDir.x, headDir.z);
        bnYaw = bnYaw === null || bnT < dt * 2 ? yaw : lerpAngle(bnYaw, yaw, Math.min(1, dt * 4));
        bn.m.position.set(headPos.x + Math.sin(bnYaw) * 3, headPos.y + 0.35, headPos.z + Math.cos(bnYaw) * 3);
        bn.m.lookAt(headPos.x, headPos.y + 0.35, headPos.z);
        const pop = Math.min(1, bnT / 0.12);
        bn.m.scale.setScalar(pop * (1 + 0.15 * Math.max(0, 1 - bnT / 0.3)));
        if (bnT > bnLife) bn.m.visible = false;
      } else bnYaw = null;

      groundRing.visible = !!mate;
      if (mate) { groundRing.position.set(mate.x, 0.03, mate.z); groundRing.material.color.set(lob ? '#5ad0ff' : '#f2c21a'); }
      lobTag.visible = !!mate;
      if (mate) {
        const k = `${mate.num}|${!!lob}`;
        if (k !== tagKey) { tagKey = k; paintTag(tag.ctx, { num: mate.num, lob: !!lob }); tag.t.needsUpdate = true; }
        lobTag.position.set(mate.x, pass ? 3.15 : 2.3, mate.z); lobTag.lookAt(headPos);
      }

      ringTarget.visible = ringLive.visible = !!pass;
      if (pass) {
        for (const r of [ringTarget, ringLive]) { r.position.set(pass.target.x, 2.5, pass.target.z); r.lookAt(headPos); }
        ringTarget.scale.setScalar(0.9);
        ringLive.scale.setScalar(Math.max(0.01, pass.scale * 0.9));
        ringLive.material.color.set(pass.grade === 'perfect' ? '#40ff60' : pass.grade === 'good' ? '#f2c21a' : '#ff5040');
      }

      reticle.visible = !!aim;
      if (aim) { reticle.position.set(aim.x, aim.y, GOAL.z + 0.08); reticle.lookAt(tmp.set(aim.x, aim.y, 0)); }

      if (charge != null) {
        const col = over > 0 ? (Math.floor(performance.now() / 80) % 2 ? '#ff2020' : '#ffffff') : charge >= 1 ? '#ff8020' : '#f2c21a';
        const lit = Math.round(charge * ringSegs.length);
        ringSegs.forEach((sg, i) => { sg.visible = i < lit; sg.material.color.set(col); });
      }
    },
  };
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// The radar: a little map of the half pitch with your goals and points along the bottom.
// One canvas, shown on your left wrist in VR and in the corner in the browser.
export function buildRadar() {
  // redrawn every frame, so no mipmaps; drawn after everything and without a depth test, so your own
  // hand can never poke through it
  const r = uiPlane(RW, RH, 0.16, 0.15, { mips: false, mat: { depthTest: false } });
  r.m.renderOrder = 30;
  // world x -22..22 → the map's width, z goal line → its top, halfway → its foot
  const px = x => RW / 2 + x / 22 * (RW / 2 - 6), pz = z => 5 + (z - GOAL.z) / -GOAL.z * (RMAP - 8);
  return {
    canvas: r.c, mesh: r.m,
    draw(world, goals = 0, points = 0) {
      paintRadar(r.ctx, world, goals, points, px, pz, { box: GOAL.z + 16.5 });
      r.t.needsUpdate = true;
    },
  };
}
