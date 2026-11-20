// Your own '04 hands (game/ps2/hands*): size and budget, the grip-space convention, poses within the joints'
// ranges, and a hold that closes round a handle without going into it. Skinned on the CPU, no canvas.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { handGeometry, handSkeleton, FINGERS, THUMB, BONES } from '../../game/ps2/handgeo.js';
import { POSES, LIMITS, seatThumbs, holdPose, applyPose, handleAt, HANDLE_DIR } from '../../game/ps2/handpose.js';

seatThumbs();
const geo = handGeometry();
// every vertex of the hand in a pose, in the hand's own frame (H)
function skin(pose) {
  const sk = handSkeleton(), inv = sk.bones.map(b => new THREE.Matrix4().copy(b.matrixWorld).invert());
  applyPose(sk.by, pose); sk.root.updateMatrixWorld(true);
  const M = sk.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, inv[i]));
  const p = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, out = [], v = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const r = new THREE.Vector3();
    for (let k = 0; k < 4; k++) { const w = sw.array[i * 4 + k]; if (w) r.addScaledVector(t.copy(v.fromBufferAttribute(p, i)).applyMatrix4(M[si.array[i * 4 + k]]), w); }
    out.push({ p: r, bone: BONES[si.array[i * 4]] });
  }
  return out;
}
const axisDist = (p, c) => { const d = p.clone().sub(c); return d.addScaledVector(HANDLE_DIR, -d.dot(HANDLE_DIR)).length(); };

test('one hand is well under half of 3,000 triangles, and a real man\'s size', () => {
  const tris = geo.index.count / 3;
  assert.ok(tris < 1350, `${tris} triangles`);
  const v = skin({ f: FINGERS.map(() => [0, 0, 0, 0]), t: [0, 0, 0, 0, 0] }).filter(q => q.bone[0] !== 't').map(q => q.p);
  const tip = Math.max(...v.map(q => q.y)), wide = Math.max(...v.filter(q => q.y > 0.06 && q.y < 0.085).map(q => q.x)) - Math.min(...v.filter(q => q.y > 0.06 && q.y < 0.085).map(q => q.x));
  assert.ok(tip > 0.18 && tip < 0.2, `wrist to middle fingertip ${tip}`);
  assert.ok(wide > 0.08 && wide < 0.095, `breadth ${wide}`);
});

test('poses stay inside the joints\' ranges', () => {
  for (const [name, p] of Object.entries(POSES)) p.f.forEach((r, k) => {
    assert.ok(r[1] >= -10 && r[1] <= LIMITS.mcp, `${name} MCP`);
    assert.ok(r[2] >= -5 && r[2] <= LIMITS.pip[k], `${name} PIP`);
    assert.ok(r[3] >= -5 && r[3] <= LIMITS.dip, `${name} DIP`);
  });
  for (const p of Object.values(POSES)) { assert.ok(p.t[3] <= LIMITS.tmcp + 1); assert.ok(p.t[4] <= LIMITS.tip + 1); }
});

test('the open hand is a resting cascade: each finger from index to little more bent', () => {
  const f = POSES.open.f;
  for (let k = 1; k < 4; k++) for (const j of [1, 2]) assert.ok(f[k][j] > f[k - 1][j]);
});

for (const d of [0.032, 0.038, 0.066]) test(`a hold closes round a ${d * 100} cm handle without going into it`, () => {
  const c = handleAt(d), R = d / 2, v = skin(holdPose(d));
  const into = Math.min(...v.map(q => axisDist(q.p, c))) - R;
  assert.ok(into > -0.003, `skin ${(-into * 1000).toFixed(1)} mm into the handle`);
  // every finger touches it (within 4 mm), and the palm does
  for (const f of FINGERS) {
    const near = Math.min(...v.filter(q => q.bone[0] === f.name).map(q => axisDist(q.p, c))) - R;
    assert.ok(near < 0.004, `${f.name} ${(near * 1000).toFixed(1)} mm off`);
  }
  const palm = Math.min(...v.filter(q => q.bone === 'root' && q.p.y > 0.03).map(q => axisDist(q.p, c))) - R;
  assert.ok(palm < 0.004, `palm ${(palm * 1000).toFixed(1)} mm off`);
});

test('a fist: the fingertips come back to the palm, the thumb lies across the fingers', () => {
  const v = skin(POSES.fist);
  for (const f of FINGERS) {
    const tip = v.filter(q => q.bone === f.name + '3').reduce((a, q) => (q.p.z < a.z ? q.p : a), new THREE.Vector3(0, 0, 9));
    assert.ok(tip.y < f.at[1] + 0.012, `${f.name} tip at ${tip.y.toFixed(3)}, knuckle ${f.at[1]}`);
  }
  const thumb = v.filter(q => q.bone === 't3').map(q => q.p), fingers = v.filter(q => /^[imrl]2/.test(q.bone)).map(q => q.p);
  const gap = Math.min(...thumb.map(a => Math.min(...fingers.map(b => a.distanceTo(b)))));
  assert.ok(gap < 0.01, `thumb ${(gap * 1000).toFixed(1)} mm from the fingers`);
});

test('grip space: thumb up the handle (-Z), wrist toward +Y, palm toward -X', () => {
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3().crossVectors(HANDLE_DIR, new THREE.Vector3(0, 0, 1)), HANDLE_DIR.clone())).invert();
  const g = p => p.clone().sub(handleAt(0.038)).applyQuaternion(q);
  const v = skin(POSES.fist);
  const thumb = g(new THREE.Vector3(...THUMB.at)), wrist = g(new THREE.Vector3(0, 0, 0));
  const back = v.filter(q => q.bone === 'root' && q.p.z > 0.01).map(q => g(q.p).x), palm = v.filter(q => q.bone === 'root' && q.p.z < -0.01 && q.p.y > 0.03).map(q => g(q.p).x);
  assert.ok(thumb.z < 0, 'thumb toward -Z');
  assert.ok(wrist.y > 0.04, 'wrist toward +Y');
  assert.ok(Math.min(...back) > 0 && back.reduce((a, b) => a + b) / back.length > Math.max(...palm) - 0.005, 'back of the hand toward +X, the palm on the handle');
});
