// Blood, for Chaos (cosmetic: nothing here changes the match). level 1: hits spray, bodies leave a mark where
// they land and a smear where they slide, and the stains stay on the pitch all match. level 2 adds limbs: the
// biggest hits (a fridge, the buggy, a super shot, the referee) can take an arm off at the elbow. It lies
// where it lands, the stump spurts for a few seconds, and he carries on with the match as if nothing has
// happened until half time, when it's back.
import * as THREE from 'three';

const RED = '#7d0a0a', MAX_P = 900, MAX_D = 420;
// how likely a hit of each kind is to cost an arm (level 2)
const LIMB = { drop: 0.5, buggy: 0.45, shot: 0.3, ref: 0.3, big: 0.1, domino: 0.05, thrown: 0.1, invader: 0.12 };
export const GORE_LINES = [
  "He's lost an arm there. He'll run that off.", "That's come clean off. He's waving the physio away. With the other one.",
  "He'll want that back at half time.", "Somebody pick that up for him.", "A knock, that. He's fine to continue.",
];

function splatTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * 6.283, d = Math.pow(Math.random(), 1.6) * 46, r = 4 + Math.random() * (i < 6 ? 26 : 9);
    const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true;
  return t;
}

// modelOf(id): the model of a player, supporter or the referee; who(id): his sim object.
export function createGore(scene, w, level, modelOf, who) {
  // drops in the air
  const pos = new Float32Array(MAX_P * 3).fill(-999), vel = new Float32Array(MAX_P * 3), live = new Uint8Array(MAX_P);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const drops = new THREE.Points(pg, new THREE.PointsMaterial({ color: RED, size: 0.11, sizeAttenuation: true }));
  drops.frustumCulled = false; scene.add(drops);
  let pi = 0;
  // stains on the grass: they stay (the oldest goes when there are too many)
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const stains = new THREE.InstancedMesh(flat, new THREE.MeshBasicMaterial({ map: splatTexture(), color: RED, transparent: true, opacity: 0.82, depthWrite: false }), MAX_D);
  stains.count = 0; stains.frustumCulled = false; stains.renderOrder = 4; scene.add(stains);
  let di = 0;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function stain(x, z, size) {
    Q.setFromAxisAngle(UP, Math.random() * 6.283); S.set(size, 1, size * (0.7 + Math.random() * 0.6));
    M.compose(V.set(x, 0.026 + (di % 7) * 0.0008, z), Q, S);
    stains.setMatrixAt(di % MAX_D, M); di++; stains.count = Math.min(di, MAX_D); stains.instanceMatrix.needsUpdate = true;
  }
  function spray(x, y, z, n, speed, dir = null) {
    for (let i = 0; i < n; i++) {
      const k = pi++ % MAX_P, a = Math.random() * 6.283, s = speed * (0.3 + Math.random() * 0.9);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; live[k] = 1;
      vel[k * 3] = Math.cos(a) * s * 0.6 + (dir ? dir.x * s * 0.5 : 0); vel[k * 3 + 1] = 1 + Math.random() * s * 0.8; vel[k * 3 + 2] = Math.sin(a) * s * 0.6 + (dir ? dir.z * s * 0.5 : 0);
    }
  }
  // arms: which are off, the bits lying about, the stumps still going
  const lost = new Map(), bits = [], stumps = [];
  let limbs = 0;
  // a forearm: tapered, a hand on one end, what's left of the elbow on the other
  const skin = new THREE.MeshPhongMaterial({ color: '#b98a6a', shininess: 8 }), raw = new THREE.MeshPhongMaterial({ color: '#7d0a0a', shininess: 30 });
  function buildArm() {
    const g = new THREE.Group(), fore = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 10), skin);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.035), skin); hand.position.y = -0.2;
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.03), skin); thumb.position.set(0.05, -0.17, 0); thumb.rotation.z = 0.5;
    const end = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), raw); end.position.y = 0.15; end.scale.y = 0.5;
    g.add(fore, hand, thumb, end);
    return g;
  }
  // blood on the kit: blotches painted onto his own kit sheet, and they stay
  function stainKit(m, n) {
    const mat = m && m.mesh && Array.isArray(m.mesh.material) ? m.mesh.material[0] : null, img = mat && mat.map && mat.map.image;
    if (!img || !img.getContext) return;
    const g = img.getContext('2d');
    for (let i = 0; i < n; i++) {
      const x = Math.random() * img.width, y = Math.random() * img.height, r = 5 + Math.random() * 20, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(105,6,6,0.85)'); gr.addColorStop(0.7, 'rgba(105,6,6,0.6)'); gr.addColorStop(1, 'rgba(105,6,6,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
    mat.map.needsUpdate = true;
  }
  function loseArm(id, m, at) {
    const had = lost.get(id) || {}, side = !had.L && !had.R ? (Math.random() < 0.5 ? 'L' : 'R') : !had.L ? 'L' : !had.R ? 'R' : null;
    if (!side) return false;
    had[side] = true; lost.set(id, had); limbs++;
    const bit = buildArm(); bit.position.set(at.x, 1.2, at.z); scene.add(bit);
    stainKit(m, 10);
    bits.push({ mesh: bit, vx: (Math.random() - 0.5) * 8, vy: 5 + Math.random() * 3, vz: (Math.random() - 0.5) * 8, spin: 8 + Math.random() * 8, t: 45 });
    stumps.push({ m, bone: m.bone[`foreArm${side}`], t: 4.5 });
    spray(at.x, 1.3, at.z, 40, 5);
    return true;
  }
  const at = id => { const m = modelOf(id), p = who(id); return m && m.rag ? m.rag.p[0] : p; };
  return {
    get limbs() { return limbs; },
    // → a line for the commentator when an arm goes, else null
    events(ev) {
      let line = null;
      for (const e of ev) {
        const p = e.id != null && at(e.id);
        if (e.type === 'launch' && p) {
          const big = e.kind !== 'hit' && e.kind !== 'barge' && e.kind !== 'foul';
          spray(p.x, 1.1, p.z, big ? Math.min(70, 14 + e.power * 4) : 6, big ? 4 + e.power * 0.25 : 2.5);
          if (big) stainKit(modelOf(e.id), 3);
          if (level > 1 && Math.random() < (LIMB[e.kind] || 0) && modelOf(e.id) && loseArm(e.id, modelOf(e.id), p)) line = GORE_LINES[Math.floor(Math.random() * GORE_LINES.length)];
        } else if (e.type === 'thud' && p) { if (e.hard > 0.35) { stain(p.x, p.z, 0.6 + e.hard * 1.3); spray(p.x, 0.3, p.z, 8, 2.5); } }
        else if (e.type === 'landed' && p) stain(p.x, p.z, 0.9 + Math.random() * 0.7);
        else if (e.type === 'boards' && p) spray(p.x, 0.8, p.z, 16, 3);
        else if (e.type === 'chaos' && e.what === 'drop' && e.stage === 'hit') stain(e.x, e.z, 1.2);
        else if (e.type === 'kickoff' && e.half === 2) lost.clear();          // patched up at half time
      }
      return line;
    },
    update(dt) {
      // drops fall; where one lands there's a spot
      for (let k = 0; k < MAX_P; k++) {
        if (!live[k]) continue;
        vel[k * 3 + 1] -= 9.81 * dt;
        pos[k * 3] += vel[k * 3] * dt; pos[k * 3 + 1] += vel[k * 3 + 1] * dt; pos[k * 3 + 2] += vel[k * 3 + 2] * dt;
        if (pos[k * 3 + 1] <= 0.02) { if (k % 3 === 0) stain(pos[k * 3], pos[k * 3 + 2], 0.12 + Math.random() * 0.3); live[k] = 0; pos[k * 3 + 1] = -999; }
      }
      pg.attributes.position.needsUpdate = true;
      // a body sliding along the grass leaves a smear
      for (const p of w.players) {
        const m = modelOf(p.id);
        if (p.state === 'air' && m && m.rag && m.rag.p[0].y < 0.4 && Math.hypot(p.vx, p.vz) > 2 && Math.random() < dt * 14) stain(m.rag.p[0].x, m.rag.p[0].z, 0.35 + Math.random() * 0.3);
      }
      for (const b of bits) {
        b.t -= dt;
        if (b.mesh.position.y > 0.06 || b.vy > 0) {
          b.vy -= 9.81 * dt; b.mesh.position.x += b.vx * dt; b.mesh.position.y += b.vy * dt; b.mesh.position.z += b.vz * dt;
          b.mesh.rotation.x += b.spin * dt; b.mesh.rotation.z += b.spin * 0.6 * dt;
          if (b.mesh.position.y <= 0.06) { b.mesh.position.y = 0.05; b.mesh.rotation.set(Math.PI / 2, 0, Math.random() * 6); stain(b.mesh.position.x, b.mesh.position.z, 0.7); b.vy = 0; }
        }
        if (b.t <= 0) scene.remove(b.mesh);
      }
      for (let i = bits.length - 1; i >= 0; i--) if (bits[i].t <= 0) bits.splice(i, 1);
      for (const s of stumps) {
        s.t -= dt;
        if (Math.random() < dt * 30) { s.bone.getWorldPosition(V); spray(V.x, V.y, V.z, 2, 2.2); }
      }
      for (let i = stumps.length - 1; i >= 0; i--) if (stumps[i].t <= 0) stumps.splice(i, 1);
      // the arms that are off stay off (the animation and the ragdoll both put the bones back every frame)
      for (const id of new Set([...lost.keys(), ...shown])) {
        const m = modelOf(id), had = lost.get(id) || {};
        if (!m) continue;
        for (const side of ['L', 'R']) m.bone[`foreArm${side}`].scale.setScalar(had[side] ? 0.001 : 1);
        if (lost.has(id)) shown.add(id); else shown.delete(id);
      }
    },
  };
}
const shown = new Set();
