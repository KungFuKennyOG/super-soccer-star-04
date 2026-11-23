// What the brawl looks like: the '04 players dressed for the match, the ball, the marker over your man,
// the TV camera, and each frame every man posed: animated as the VR game animates them (game/actors.js),
// or as a ragdoll while he's flying or lying there (game/brawl/ragdoll.js), blending back as he gets up.
import * as THREE from 'three';
import { animate, placeModel } from '../actors.js';
import { buildPlayer2 } from '../ps2/player.js';
import { buildBall04 } from '../ps2/ball.js';
import { buildArrow04 } from '../ps2/markers.js';
import { heldBall } from '../keeperpose.js';
import { struck } from '../strike.js';
import { squadLooks } from '../squad.js';
import { matchKit, keeperKit } from '../../rules/teams.js';
import { BODY } from '../../rules/brawl/tuning.js';
import { startRagdoll, stepRagdoll, poseRagdoll, holdForGetUp, getUpBlend } from './ragdoll.js';

const seedOf = id => [...id].reduce((a, c) => a + c.charCodeAt(0), 0);

// One model per sim player: home in their kit, away in theirs (their change kit on a clash), keepers in
// keeper kits that stand out from both.
export function dressSides(scene, w, home, away) {
  const awayK = matchKit(away, home), looks = squadLooks(w, home, away), models = {};
  const gkH = keeperKit(home.kit), gkA = keeperKit(awayK);
  for (const p of w.players) {
    const team = p.team === 'home' ? home : away, look = p.num * 7 + seedOf(team.id);
    const kit = p.line === 'gk' ? (p.team === 'home' ? gkH : gkA) : p.team === 'home' ? home.kit : awayK;
    const m = buildPlayer2(kit, p.num, look, { ap: looks[p.id] });
    if (p.line !== 'gk' && (Math.imul(look + 11, 2654435761) >>> 0) % 100 < 27) m.foot = 'L';
    scene.add(m.root, m.shadow);
    models[p.id] = m;
  }
  return models;
}

export function createView(scene, w, models) {
  const ball = buildBall04(); scene.add(ball.mesh, ball.shadow);
  const arrow = buildArrow04(); arrow.scale.setScalar(2.2); scene.add(arrow);
  const held = new THREE.Vector3();
  return {
    ball,
    // events from the sim that the models act on
    events(ev) {
      for (const e of ev) {
        const p = w.byId[e.id], m = models[e.id];
        if (!m) continue;
        if (e.type === 'launch') startRagdoll(m, { x: p.air.vx, y: p.air.vy, z: p.air.vz });
        else if (e.type === 'miss' && !e.quiet) startRagdoll(m, { x: p.vx * 1.4, y: 0.5, z: p.vz * 1.4 });
        else if (e.type === 'getup' && m.rag) { holdForGetUp(m); m.upT = 0; }
        else if (e.type === 'pass' || e.type === 'shot' || e.type === 'clear') {
          const b = w.ball, h = Math.hypot(b.vx, b.vz) || 1;
          if (!p.holding && p.line !== 'gk') struck(m, e.type === 'shot' ? 'shot' : 'pass', { x: b.vx / h, z: b.vz / h }, e.power || 0.5);
        }
      }
    },
    update(dt, t) {
      for (const p of w.players) {
        const m = models[p.id];
        // sent off: gone down the tunnel
        m.root.visible = m.shadow.visible = p.state !== 'off';
        if (p.state === 'off') continue;
        if (m.rag) {
          stepRagdoll(m, dt, p.state === 'air' || p.state === 'down' ? { x: p.x, z: p.z } : null);
          poseRagdoll(m);
          const h = m.rag.p[0];
          m.shadow.position.set(h.x + 0.2, 0.02, h.z - 0.1);
          continue;
        }
        placeModel(m, p);
        const celebrate = w.phase === 'goal' && p.team === w.scorers && p.state === 'up';
        animate(m, p, dt, t, celebrate, false, w.ball, w.owner === p.id && !p.holding);
        if (m.getUp) { m.upT += dt; getUpBlend(m, Math.min(1, m.upT / BODY.getup)); }
      }
      ball.update(w.ball, dt);
      // the keeper's ball is drawn between his gloves
      const gk = w.owner && w.byId[w.owner];
      if (gk && gk.holding && heldBall(models[gk.id], held)) ball.mesh.position.copy(held);
      const you = w.byId[w.ctrl];
      arrow.visible = !!you && you.state !== 'air' && !w.demo;
      if (arrow.visible) arrow.position.set(you.x, 2.75 + Math.sin(t * 6) * 0.08, you.z);
    },
    faceArrow(camera) { arrow.quaternion.copy(camera.quaternion); },
  };
}

// The TV camera: high in the stand on the +x touchline, panning along with the play and leading it a
// little. stand: the plan of that stand (game/ps2/groundplan.js) to sit it under the roof.
export function createTvCamera(camera, w, plan) {
  const right = plan.stands[2], p = right.p, back = Math.min(-p.back, 24);
  const x = plan.sideX + back * 0.45, y0 = p.roof ? Math.min(p.roof.y - 1.5, 24) : 22;
  const y = Math.max(14, y0);
  const at = new THREE.Vector3(0, 0, 0), lead = new THREE.Vector3();
  camera.fov = w.n === 6 ? 30 : 27; camera.near = 0.5; camera.far = 600; camera.updateProjectionMatrix();
  return {
    update(dt) {
      const b = w.ball, reach = w.L - 7;
      lead.set(b.x * 0.35, 0, Math.max(-reach, Math.min(reach, b.z + b.vz * 0.35)));
      at.lerp(lead, Math.min(1, dt * 2.2));
      camera.position.set(x, y, at.z * 0.94);
      camera.lookAt(at.x - 2, 0, at.z);
    },
    snap() { const b = w.ball; at.set(b.x * 0.35, 0, b.z); this.update(1); },
  };
}
