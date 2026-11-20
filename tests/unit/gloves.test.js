// The keeper's gloves (game/ps2/gloves.js) on the real figure geometry, skinned by the keeper's own poses
// (game/keeperpose.js through animate()): where they meet a held ball, and that they replace the bare hands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSkeleton } from '../../game/body.js';
import { animate, placeModel } from '../../game/actors.js';
import { figureGeometry } from '../../game/ps2/figure.js';
import { gripPoint, GL } from '../../game/ps2/gloves.js';
import { ATLAS } from '../../game/ps2/kit.js';
import { BALL } from '../../rules/tuning.js';

const DT = 1 / 60, geo = figureGeometry(0, true), bare = figureGeometry(0, false);
// the glove's vertices: those painted from the glove's corner of the kit sheet
const uv = geo.attributes.uv.array, onGlove = [];
for (let i = 0; i < uv.length / 2; i++) {
  const px = uv[i * 2] * ATLAS.w, py = (1 - uv[i * 2 + 1]) * ATLAS.h;
  if (px >= GL.hand.x && py >= GL.hand.y) onGlove.push(i);
}
function keeper() {
  const { bones, by } = buildSkeleton(), root = new THREE.Group();
  root.add(bones[0]);
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  mesh.add(bones[0]); root.add(mesh); root.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
  return { root, mesh, bone: by, shadow: new THREE.Object3D(), phase: 0 };
}
// run a keeper through keep(t) (what the sim tells the page) and measure at the moments in `at`
function play(keep, at, ball = { x: 0.3, y: 0.11, z: 9 }) {
  const m = keeper(), p = { x: 0, z: 0, fx: 0, fz: 1, vx: 0, vz: 0, role: 'gk' }, out = [], v = new THREE.Vector3(), g = new THREE.Vector3(), tmp = new THREE.Vector3();
  for (let t = 0, k = 0; k < at.length; t += DT) {
    delete p.save; delete p.dive; delete p.holding; Object.assign(p, keep(t));
    placeModel(m, p); animate(m, p, DT, t, false, null, ball, false);
    if (t + 1e-9 < at[k]) continue;
    k++;
    m.root.updateMatrixWorld(true); m.mesh.skeleton.update();
    gripPoint(m, g, tmp);
    let near = Infinity, inside = 0;
    for (const i of onGlove) {
      v.fromBufferAttribute(geo.attributes.position, i); m.mesh.boneTransform(i, v); v.applyMatrix4(m.mesh.matrixWorld);
      const d = v.distanceTo(g) - BALL.r;
      near = Math.min(near, d); if (d < -0.012) inside++;
    }
    out.push({ t, near, inside, ball: g.clone() });
  }
  return out;
}
// (not measured: the low dive's touch, where keeperpose.js has his hands under the pitch, 0.43 m down)
const save = (y, kind, dive = 0) => t => (t >= 0.5 ? { save: { y, kind, id: 1, eta: dive ? 0.42 : 0.22 }, dive, holding: kind === 'catch' && t > 0.5 + (dive ? 0.42 : 0.22) } : {});

test('the gloves replace the bare hands and stay within budget', () => {
  const tris = g => g.index.count / 3, added = tris(geo) - tris(bare);
  assert.ok(onGlove.length > 400, `${onGlove.length} glove vertices`);
  assert.ok(added > 0 && added < 2000, `gloves add ${added} triangles`);
  assert.equal(geo.groups.length, bare.groups.length, 'same materials (draw calls)');
  console.log(`  gloves: +${added} triangles (${tris(bare)} → ${tris(geo)}), ${geo.groups.length} materials as before`);
});

test('a ball held in both gloves sits between the palms, touching, not through them', () => {
  for (const [name, keep, at] of [['held to the chest', () => ({ holding: true }), [0.6]], ['caught standing', save(1.1, 'catch'), [0.75, 1.2]],
    ['caught overhead', save(2.0, 'catch'), [0.75]], ['caught diving low, on the ground', save(0.5, 'catch', 1), [1.3]]]) {
    for (const r of play(keep, at)) {
      console.log(`  ${name} at ${r.t.toFixed(2)} s: nearest glove ${(100 * r.near).toFixed(1)} cm from the ball's surface, ${r.inside} vertices more than 1.2 cm in`);
      assert.ok(r.near < 0.035, `${name}: a glove within 3.5 cm of the ball (${r.near.toFixed(3)})`);
      assert.ok(r.inside < 8, `${name}: the ball isn't through the gloves (${r.inside} vertices inside)`);
    }
  }
});
