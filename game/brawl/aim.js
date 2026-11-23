// What you're about to do, drawn on the pitch: a reticle on the goal where your shot is going while you
// hold shoot (it climbs as the power goes up, and goes red when you've held it too long), and a ring on
// the grass under the man a pass would go to.
import * as THREE from 'three';
import { reticleTex, groundTex, COLORS } from '../ps2/markers.js';
import { shotTarget, bestPass } from '../../rules/brawl/kicks.js';
import { dirOf } from '../../rules/brawl/world.js';
import { KICK } from '../../rules/brawl/tuning.js';

const mat = (tex, color) => new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthTest: false, depthWrite: false });

export function createAim(scene, w) {
  const ret = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), mat(reticleTex(), COLORS.power));
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), mat(groundTex(), COLORS.ring));
  ret.renderOrder = ring.renderOrder = 20;
  ring.rotation.x = -Math.PI / 2;
  scene.add(ret, ring);
  ret.visible = ring.visible = false;
  return {
    // input: this frame's controls; camera: to face the reticle at it
    update(input, camera, t) {
      const you = w.byId[w.ctrl], sp = w.sp;
      ret.visible = ring.visible = false;
      if (!you || w.demo || you.state !== 'up') return;
      const mv = input.move || { x: 0, z: 0 }, m = Math.hypot(mv.x, mv.z);
      const onBall = (w.owner === you.id && w.phase === 'play') || (sp && sp.taker === you.id && sp.stage === 'ready');
      if (!onBall) return;
      if (w.charge > 0 && !(sp && sp.kind === 'throw')) {
        const held = w.charge, power = Math.min(1, held / KICK.maxHold), end = sp && sp.end != null ? sp.end : dirOf(w, you.team);
        const tg = shotTarget(w, you, power, mv.x * 1.3, held, end);
        ret.position.set(tg.x, Math.min(tg.y, 3.2), tg.z);
        ret.quaternion.copy(camera.quaternion);
        ret.material.color.set(held > KICK.overHold ? COLORS.over : power >= 1 ? COLORS.full : COLORS.power);
        ret.scale.setScalar(1 + Math.sin(t * 10) * 0.05);
        ret.visible = true;
        return;
      }
      if (sp && sp.kind === 'penalty') return;
      const q = bestPass(w, you, m > 0.2 ? { x: mv.x, z: mv.z } : { x: you.fx, z: you.fz });
      if (!q) return;
      ring.position.set(q.x, 0.04, q.z);
      ring.visible = true;
    },
  };
}
