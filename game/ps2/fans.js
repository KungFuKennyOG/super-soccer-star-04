// The crowd: a fan on every seat of every tier, as cards (fanmat.js) placed row by row on the tier's
// own steps, so rows stand behind and above each other and hide each other as a real stand does. Each
// fan is someone: yours or theirs, his look (fantex.js), what he wears in which colours, his skin and
// hair, his size, a little off his seat's middle. A few seats are empty, stairways are kept clear. The
// home curva and the away end stand all game; some of them wave flags (ultras2.js draws the flags).
// Two draws: the seats (the empty stand) and every fan in one instanced draw.
import * as THREE from 'three';
import { fanAtlas, seatTile } from './fantex.js';
import { fanMaterial, seatMaterial } from './fanmat.js';
import { LIGHT_DIR } from './player.js';

// SEAT: one seat's width (m), a little under groundplan.js's 0.6 so shoulders nearly touch, as they do
const PITCH_P = new THREE.Vector3(0, 3, -15), SEAT = 0.52, PACKED = 0.46, AISLE = 15;
const NEUTRAL = ['#1c1e24', '#2b3550', '#4a4f58', '#7a7f88', '#3a4a38', '#6b5a44'];
const SHAPE_W = [16, 14, 12, 12, 8, 10, 12, 16], JACKET = [2, 3, 5];
const SKIN_W = [0.3, 0.25, 0.18, 0.12, 0.09, 0.06], HAIR_W = [0.22, 0.25, 0.18, 0.1, 0.08, 0.08, 0.04, 0.05], KIT_W = [0.56, 0.24, 0.08, 0.07, 0.05];
const v = () => new THREE.Vector3();

function seeded(s) { let r = (Math.abs(Math.floor(s)) * 16807 + 11) % 2147483647 || 1; return () => (r = (r * 16807) % 2147483647) / 2147483647; }
const pick = (w, r) => { let x = r * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return i; return w.length - 1; };
const five = cols => { const c = cols.filter(Boolean); return [0, 1, 2, 3, 4].map(i => c[i % c.length]); };

export class Crowd {
  // ours / theirs: fan colours (kit colours, most worn first); share: how much of an ordinary stand is
  // yours; curvaOurs: the home curva is yours.
  constructor(ours, theirs, share, curvaOurs, seed = 1) {
    this.rand = seeded(seed * 7919 + 13);
    this.pal = [...five(ours), ...five(theirs), ...NEUTRAL];
    this.share = [share, curvaOurs ? 0.95 : 0.05, curvaOurs ? 0.15 : 0.85];
    this.curvaOurs = curvaOurs;
    this.fans = []; this.ultras = [];
    this.s = { pos: [], uv: [], ais: [], spa: [], k: [], shade: [], idx: [] };
  }

  // One tier of a stand along a run from t0 to t1. tier: { y0, z0, y1, z1, rows, i } in the stand's
  // frame. band: 0 ordinary, 1 the home curva, 2 the away block; ultra: they stand (a curva or the
  // away end's lower tier). roofFront: z of the roof's front edge over this stand, or null.
  strip(run, t0, t1, tier, band, ultra, roofFront) {
    const segs = Math.max(1, Math.ceil((t1 - t0) * run.n - 1e-6)), nA = Math.max(2, Math.round(run.at(0) / AISLE));
    const at = z => run.at(z), dz = tier.z1 - tier.z0, dy = tier.y1 - tier.y0;
    const n = v().subVectors(run.pt(t0, tier.z1, tier.y1), run.pt(t0, tier.z0, tier.y0)).cross(v().subVectors(run.pt(t1, tier.z0, tier.y0), run.pt(t0, tier.z0, tier.y0))).normalize();
    if (n.dot(v().subVectors(PITCH_P, run.pt(t0, tier.z0, tier.y0))) < 0) n.negate();
    const sun = Math.max(0, n.dot(LIGHT_DIR));
    const R = this.rand, packed = ultra && band > 0;
    for (let r = 0; r < tier.rows; r++) {
      const kA = r / tier.rows, kB = (r + 1) / tier.rows, k = (r + 0.62) / tier.rows;
      const z = tier.z0 + dz * k, y = tier.y0 + dy * k, covered = roofFront !== null && z <= roofFront + 1e-6;
      const back = 1 - 0.18 * k, shade = [(0.62 + 0.5 * sun) * (covered ? 0.62 : 1) * back, (covered ? 0.82 : 1) * back];
      // the seats: one quad a row (per segment round a corner)
      const zA = tier.z0 + dz * kA, zB = tier.z0 + dz * kB, yA = tier.y0 + dy * kA, yB = tier.y0 + dy * kB;
      for (let s = 0; s < segs; s++) {
        const ta = t0 + (t1 - t0) * s / segs, tb = t0 + (t1 - t0) * (s + 1) / segs;
        this.seatQuad([[ta, zA, yA, r], [tb, zA, yA, r], [tb, zB, yB, r + 1], [ta, zB, yB, r + 1]], run, nA, tier.i % 2, shade);
      }
      // the fans
      const sp = packed ? PACKED : SEAT, nSeats = at(z) / sp;
      for (let c = Math.ceil(t0 * nSeats - 0.5); (c + 0.5) / nSeats < t1; c++) {
        const t = (c + 0.5) / nSeats;
        if (t < t0) continue;
        const fromAisle = Math.abs(t * nA - Math.round(t * nA)) * at(z) / SEAT / nA;
        if (!packed && fromAisle < 0.6) continue;                        // the stairway
        const patch = Math.sin(c * 0.21 + tier.i * 3.1) * Math.sin(r * 0.5 + c * 0.05 + band) > 0.82 ? 0.3 : 0;
        if (R() < (packed ? 0.01 : 0.035 + patch)) continue;            // an empty seat (a few in patches)
        const jz = (R() - 0.5) * (packed ? 0.45 : 0.12), lz = z + jz, ly = y + jz * dy / dz;
        const p = run.pt(t + (R() - 0.5) * (packed ? 0.2 : 0.1) * sp / at(z), lz, ly);
        this.fan(p, band, packed ? 1 : R() < 0.012 ? 2 : 0, shade, ultra && band > 0, packed, k, t);
      }
    }
  }

  seatQuad(corners, run, nA, seatK, shade) {
    const S = this.s, i = S.pos.length / 3;
    for (const [t, z, y, row] of corners) {
      run.pt(t, z, y).toArray(S.pos, S.pos.length);
      const along = run.at(z) / SEAT;
      S.uv.push(t * along, row); S.ais.push(t * nA); S.spa.push(along / nA); S.k.push(seatK); S.shade.push(...shade);
    }
    S.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  fan(p, band, role, shade, ultra, packed, k, t) {
    const R = this.rand, mine = R() < this.share[band] ? 1 : 0, kit = mine ? 0 : 5;
    const shape = pick(SHAPE_W, R()), neutral = R() < (packed ? 0.1 : 0.28) * (JACKET.includes(shape) ? 2 : 1);
    const ks = pick(KIT_W, R()), shirt = neutral ? 10 + Math.floor(R() * 6) : kit + ks;
    const acc = neutral ? (R() < 0.7 ? kit + pick(KIT_W, R()) : 10 + Math.floor(R() * 6)) : kit + (ks + 1 + Math.floor(R() * 2)) % 5;
    const kid = !packed && R() < 0.03, scale = kid ? 0.8 : 0.94 + R() * 0.12, b = 0.9 + R() * 0.2;
    const f = { p, shape: shape + (R() < 0.5 ? 8 : 0), mine, phase: R(), role, col: [shirt, acc, pick(SKIN_W, R()), pick(HAIR_W, R())], scale, shade: [shade[0] * b, shade[1] * b], band, k, t };
    this.fans.push(f);
    if (ultra) this.ultras.push(f);
  }

  // Flag holders: a few of the standing fans in each end, spread out, and one or two big flags.
  // Returns [{ p (his seat), mine, phase, big, side (0 home curva, 1 away) }].
  flags() {
    const R = this.rand, out = [];
    for (const band of [1, 2]) {
      const pool = this.ultras.filter(f => f.band === band && f.k > 0.15 && f.k < 0.78);   // not the front rows, not under the roof
      if (pool.length < 20) continue;
      const box = new THREE.Box3().setFromPoints(pool.map(f => f.p)), span = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z);
      const want = [[Math.min(band === 1 ? 2 : 1, Math.floor(span / 12)), true], [Math.min(band === 1 ? 12 : 4, Math.round(span / (band === 1 ? 4.5 : 7))), false]];
      for (const [n, big] of want) for (let k = 0, tries = 0; k < n && tries < 400; tries++) {
        const f = pool[Math.floor(R() * pool.length)];
        if (f.role >= 3 || (big && (f.k < 0.25 || f.k > 0.6)) || out.some(o => o.f.p.distanceTo(f.p) < (big || o.big ? 6.5 : 3.2))) continue;
        f.role = big ? 4 : 3; f.scale = 1;
        out.push({ f, p: f.p, mine: f.mine, phase: f.phase, big, side: band - 1 }); k++;
      }
    }
    return out;
  }

  // light: the ground's shared light; crowd: the match-moment uniforms (stadium.js); seats: two colours
  build(light, crowd, seats) {
    const S = this.s, sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(S.pos, 3));
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(S.uv, 2));
    sg.setAttribute('aAis', new THREE.Float32BufferAttribute(S.ais, 1));
    sg.setAttribute('aSpa', new THREE.Float32BufferAttribute(S.spa, 1));
    sg.setAttribute('aSeatK', new THREE.Float32BufferAttribute(S.k, 1));
    sg.setAttribute('aShade', new THREE.Float32BufferAttribute(S.shade, 2));
    sg.setIndex(S.idx); sg.computeBoundingSphere();
    const seatMesh = new THREE.Mesh(sg, seatMaterial(seatTile(), seats, light)); seatMesh.matrixAutoUpdate = false;
    const holders = this.flags();
    const n = this.fans.length, seat = new Float32Array(n * 4), fan = new Float32Array(n * 4), col = new Float32Array(n * 4), sh = new Float32Array(n * 2);
    this.fans.forEach((f, i) => {
      seat.set([f.p.x, f.p.y, f.p.z, f.scale], i * 4); fan.set([f.shape, f.mine, f.phase, f.role], i * 4); col.set(f.col, i * 4); sh.set(f.shade, i * 2);
    });
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('aSeat', new THREE.InstancedBufferAttribute(seat, 4));
    g.setAttribute('aFan', new THREE.InstancedBufferAttribute(fan, 4));
    g.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 4));
    g.setAttribute('aShade', new THREE.InstancedBufferAttribute(sh, 2));
    g.instanceCount = n;
    const atlas = fanAtlas(), mat = fanMaterial(atlas, light, crowd);
    this.pal.forEach((c, i) => mat.uniforms.uPal.value[i].set(c));
    const fanMesh = new THREE.Mesh(g, mat); fanMesh.frustumCulled = false; fanMesh.matrixAutoUpdate = false;
    return { seats: seatMesh, fans: fanMesh, holders, count: n, tris: S.idx.length / 3 + n * 2, atlasBytes: atlas.bytes, atlasMs: atlas.ms };
  }
}
