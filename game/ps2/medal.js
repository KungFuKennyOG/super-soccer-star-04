// A winner's medal as it is worn: a ribbon 3.6 cm wide round the back of the neck and down the chest in a V,
// lying on the shirt, and a gold disc 6.6 cm across hanging from its point at the breastbone. The ribbon is laid
// on the player's own body in its bind pose (every point dropped onto the nearest of the shirt's triangles and
// given that triangle's skin weights), so it goes where the collar, shoulders and chest go. The disc is skinned to
// the same spot and swings from the ribbon's point: side to side, and up off the chest when he lands or takes off.
// One small skinned mesh a player, on his skeleton.
import * as THREE from 'three';
import { canvas, hex, lum } from './paint.js';

const W = 0.036, OFF = 0.0045, DISC = 0.033;
// the ribbon's middle line down his left side (+x), back of the neck to the point of the V; the right side mirrors it
const GUIDE = [[0, 1.52, -0.085], [0.05, 1.52, -0.075], [0.085, 1.515, -0.035], [0.095, 1.505, 0.01], [0.088, 1.48, 0.06], [0.072, 1.44, 0.1], [0.05, 1.39, 0.125], [0.027, 1.34, 0.135], [0, 1.293, 0.14]];
const TORSO = /^(hips|spine|chest|neck|clavicle)/;

// The shirt's triangles round the chest, shoulders and collar (bind pose), with their corners' skinning.
function torso(geo, bones) {
  const p = geo.attributes.position, si = geo.attributes.skinIndex, idx = geo.index, g = geo.groups[0], out = [];
  const ok = i => p.getY(i) > 1.18 && p.getY(i) < 1.6 && Math.abs(p.getX(i)) < 0.2 && TORSO.test(bones[si.getX(i)].name);
  for (let k = g.start; k < g.start + g.count; k += 3) {
    const a = idx.getX(k), b = idx.getX(k + 1), c = idx.getX(k + 2);
    if (!(ok(a) && ok(b) && ok(c))) continue;
    out.push({ i: [a, b, c], t: new THREE.Triangle(new THREE.Vector3().fromBufferAttribute(p, a), new THREE.Vector3().fromBufferAttribute(p, b), new THREE.Vector3().fromBufferAttribute(p, c)) });
  }
  return out;
}

const tmp = new THREE.Vector3(), bary = new THREE.Vector3(), nrm = new THREE.Vector3();
// The nearest point of the shirt to q: { p, n (pointing out of him), skin: [[bone, weight] x4] }.
function drop(tris, geo, q) {
  let best = null, bd = Infinity;
  for (const tr of tris) { tr.t.closestPointToPoint(q, tmp); const d = tmp.distanceToSquared(q); if (d < bd) { bd = d; best = tr; } }
  const p = best.t.closestPointToPoint(q, new THREE.Vector3()), n = best.t.getNormal(new THREE.Vector3());
  if (n.dot(nrm.set(p.x, 0, p.z + 0.01)) < 0 && Math.abs(n.y) < 0.9) n.negate();
  if (n.y < -0.5) n.negate();                                          // (on top of the shoulders: up)
  best.t.getBarycoord(p, bary);
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, acc = new Map();
  best.i.forEach((v, c) => { for (let j = 0; j < 4; j++) { const b = si.array[v * 4 + j], w = sw.array[v * 4 + j] * bary.getComponent(c); if (w > 0) acc.set(b, (acc.get(b) || 0) + w); } });
  const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((s, e) => s + e[1], 0);
  while (top.length < 4) top.push([0, 0]);
  return { p, n, skin: top.map(([b, w]) => [b, w / sum]) };
}

// The medal's shape on a body (its geometry in the bind pose, bones: its skeleton's). Cached per body.
const made = new WeakMap();
function medalGeometry(geo, bones) {
  if (made.has(geo)) return made.get(geo);
  const tris = torso(geo, bones), P = [], N = [], U = [], SI = [], SW = [], SG = [], I = [];
  const vert = (p, n, u, v, skin, swing = 0) => { P.push(p.x, p.y, p.z); N.push(n.x, n.y, n.z); U.push(u, v); SI.push(...skin.map(s => s[0])); SW.push(...skin.map(s => s[1])); SG.push(swing); return P.length / 3 - 1; };
  const curve = new THREE.CatmullRomCurve3(GUIDE.map(g => new THREE.Vector3(...g))), n = 16, side = new THREE.Vector3(), tan = new THREE.Vector3();
  let point = null;
  for (const sx of [1, -1]) {
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const c = curve.getPoint(i / n); c.x *= sx;
      const mid = drop(tris, geo, c);
      curve.getTangent(i / n, tan); tan.x *= sx;
      side.crossVectors(mid.n, tan).normalize().multiplyScalar(W / 2 * sx);
      const lift = OFF + (sx < 0 ? 0.0012 : 0) + 0.003 * Math.min(1, i / 3);    // (the two halves overlap at the point: one lies on the other)
      const row = [-1, 1].map(e => {
        const d = drop(tris, geo, tmp.copy(mid.p).addScaledVector(side, e).clone());
        // (an edge that found a far-off part of the shirt stays beside the middle instead)
        if (d.p.distanceTo(mid.p) > W) { d.p.copy(mid.p).addScaledVector(side, e); d.n.copy(mid.n); d.skin = mid.skin; }
        return vert(d.p.addScaledVector(d.n, lift), d.n, e < 0 ? 0.02 : 0.48, i * 0.4, d.skin);
      });
      if (prev) { if (sx > 0) I.push(prev[0], prev[1], row[1], prev[0], row[1], row[0]); else I.push(prev[0], row[1], prev[1], prev[0], row[0], row[1]); }
      prev = row;
      if (i === n && sx > 0) point = mid;
    }
  }
  // the disc: hung from the point, face out along the chest's normal there, a rim and a back
  const nz = point.n.clone(), up = new THREE.Vector3(0, 1, 0).addScaledVector(nz, -nz.y).normalize(), ax = new THREE.Vector3().crossVectors(up, nz);
  const pivot = point.p.clone().addScaledVector(nz, OFF + 0.006), centre = pivot.clone().addScaledVector(up, -(DISC + 0.012)), seg = 20, T = 0.004;
  const at = (r, a, z) => centre.clone().addScaledVector(ax, Math.sin(a) * r).addScaledVector(up, Math.cos(a) * r).addScaledVector(nz, z);
  const back = nz.clone().negate();
  const cf = vert(at(0, 0, T), nz, 0.75, 0.5, point.skin, 1), cb = vert(at(0, 0, -0.001), back, 0.52, 0.02, point.skin, 1), f = [], r = [], b = [];
  for (let i = 0; i < seg; i++) {
    const a = i / seg * Math.PI * 2, out = at(1, a, 0).sub(centre);
    f.push(vert(at(DISC, a, T), nz, 0.75 + Math.sin(a) * 0.24, 0.5 + Math.cos(a) * 0.48, point.skin, 1));
    r.push([vert(at(DISC, a, T), out, 0.52, 0.02, point.skin, 1), vert(at(DISC, a, -0.001), out, 0.52, 0.02, point.skin, 1)]);
    b.push(vert(at(DISC, a, -0.001), back, 0.52, 0.02, point.skin, 1));
  }
  for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; I.push(cf, f[j], f[i], cb, b[i], b[j], r[i][0], r[j][0], r[j][1], r[i][0], r[j][1], r[i][1]); }
  // the loop the ribbon goes through
  const l0 = vert(pivot.clone().addScaledVector(ax, -0.009), nz, 0.52, 0.02, point.skin, 1), l1 = vert(pivot.clone().addScaledVector(ax, 0.009), nz, 0.52, 0.02, point.skin, 1);
  const l2 = vert(at(0.011, 0, T).addScaledVector(up, DISC - 0.004), nz, 0.52, 0.02, point.skin, 1), l3 = vert(at(-0.011, 0, T).addScaledVector(up, DISC - 0.004), nz, 0.52, 0.02, point.skin, 1);
  I.push(l0, l3, l2, l0, l2, l1);
  // every triangle wound to face the way its corners' normals say (both sides are drawn; the back is lit as a back)
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  for (let k = 0; k < I.length; k += 3) {
    va.fromArray(P, I[k] * 3); vb.fromArray(P, I[k + 1] * 3).sub(va); vc.fromArray(P, I[k + 2] * 3).sub(va); vb.cross(vc);
    if (vb.x * (N[I[k] * 3] + N[I[k + 1] * 3] + N[I[k + 2] * 3]) + vb.y * (N[I[k] * 3 + 1] + N[I[k + 1] * 3 + 1] + N[I[k + 2] * 3 + 1]) + vb.z * (N[I[k] * 3 + 2] + N[I[k + 1] * 3 + 2] + N[I[k + 2] * 3 + 2]) < 0) { const sw = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = sw; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4)); g.setAttribute('aSwing', new THREE.Float32BufferAttribute(SG, 1));
  g.setIndex(I);
  g.userData = { pivot, nz, ax, bone: point.skin[0][0] };
  made.set(geo, g);
  return g;
}

// The ribbon's colours for a kit: whichever of white, the kit's second colour and its shorts stands out most on the
// shirt, with the shirt's own colour as the stripe down its middle. The disc: gold, a raised rim, our star.
const sheets = new Map();
function sheet(kit) {
  const key = kit.shirt + kit.alt + kit.shorts;
  if (sheets.has(key)) return sheets.get(key);
  const L = c => lum(hex(c)), main = ['#f2f1ea', kit.alt || kit.shorts, kit.shorts, '#1b2a6b'].sort((a, b) => Math.abs(L(b) - L(kit.shirt)) - Math.abs(L(a) - L(kit.shirt)))[0];
  const c = canvas(128, 64), x = c.getContext('2d');
  x.fillStyle = main; x.fillRect(0, 0, 64, 64); x.fillStyle = kit.shirt; x.fillRect(23, 0, 18, 64);
  x.fillStyle = 'rgba(0,0,0,0.16)'; for (let j = 0; j < 64; j += 4) x.fillRect(0, j, 64, 1);                  // the weave
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 3, 64); x.fillRect(61, 0, 3, 64);
  const g = x.createRadialGradient(88, 22, 2, 96, 32, 34); g.addColorStop(0, '#fff0a8'); g.addColorStop(0.5, '#e2b23e'); g.addColorStop(1, '#a87a1c');
  x.fillStyle = '#8c6414'; x.fillRect(64, 0, 64, 64); x.fillStyle = g; x.beginPath(); x.arc(96, 32, 30.5, 0, 7); x.fill();
  x.strokeStyle = '#8c6414'; x.lineWidth = 2; x.beginPath(); x.arc(96, 32, 24, 0, 7); x.stroke();
  x.fillStyle = '#b98a22'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? 6 : 15; x.lineTo(96 + Math.sin(a) * r, 32 - Math.cos(a) * r); } x.fill();
  x.fillStyle = '#ffe9a0'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? 5 : 13; x.lineTo(95 + Math.sin(a) * r, 31 - Math.cos(a) * r); } x.fill();
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  sheets.set(key, t);
  return t;
}

// m: a player from game/ps2/player.js (buildPlayer2). Adds his medal to him; returns { mesh, update(dt) }.
export function wearMedal(m, kit) {
  const geo = medalGeometry(m.mesh.geometry, m.mesh.skeleton.bones), ud = geo.userData;
  const swing = { value: new THREE.Vector2() };
  const mat = new THREE.MeshPhongMaterial({ map: sheet(kit), side: THREE.DoubleSide, shininess: 30, specular: 0x4a3c20 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uSwing: swing, uPivot: { value: ud.pivot }, uNz: { value: ud.nz }, uAx: { value: ud.ax } });
    sh.vertexShader = `attribute float aSwing; uniform vec2 uSwing; uniform vec3 uPivot, uNz, uAx;
vec3 turn(vec3 v, vec3 k, float a) { return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a)); }
` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  if (aSwing > 0.5) { vec3 d = turn(turn(transformed - uPivot, uNz, uSwing.x), uAx, uSwing.y); transformed = uPivot + d; }`);
  };
  mat.customProgramCacheKey = () => 'medal';
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.bind(m.mesh.skeleton, m.mesh.bindMatrix); mesh.frustumCulled = false; mesh.name = 'medal';
  m.root.add(mesh);
  // the disc as a pendulum on the ribbon: a (side to side), l (lifted off the chest, never into it)
  const bone = m.mesh.skeleton.bones[ud.bone], at = new THREE.Vector3(), was = new THREE.Vector3(), vel = new THREE.Vector3(), acc = new THREE.Vector3(), right = new THREE.Vector3();
  const s = { a: 0, av: 0, l: 0, lv: 0, first: true }, K = 9.8 / 0.07;
  return {
    mesh, tris: geo.index.count / 3, state: s,
    update(dt) {
      if (dt <= 0) return;
      bone.getWorldPosition(at);
      if (s.first) { was.copy(at); s.first = false; }
      acc.copy(at).sub(was).divideScalar(dt).sub(vel).divideScalar(dt); vel.add(tmp.copy(acc).multiplyScalar(dt)); was.copy(at);
      right.setFromMatrixColumn(m.root.matrixWorld, 0).normalize();
      const ax = Math.max(-40, Math.min(40, acc.dot(right))), ay = Math.max(-60, Math.min(60, acc.y));
      for (let n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n; n > 0; n--) {
        s.av += (-K * s.a - 5 * s.av + ax / 0.07 * 0.5) * h; s.a = Math.max(-0.7, Math.min(0.7, s.a + s.av * h));
        // lifted when he drops away under it (falling, or checking a rise); gravity lays it back on the shirt
        s.lv += (-K * 0.6 * (s.l + 0.15) - 4 * s.lv + Math.max(0, -ay - 3) / 0.07 * 0.35) * h; s.l += s.lv * h;
        if (s.l < 0) { s.l = 0; s.lv = Math.max(0, -0.25 * s.lv); } else if (s.l > 0.8) { s.l = 0.8; s.lv = 0; }
      }
      swing.value.set(s.a, -s.l);
    },
    dispose() { m.root.remove(mesh); mat.dispose(); },
  };
}
