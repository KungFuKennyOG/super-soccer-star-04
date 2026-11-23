// The crowd: a fan on every seat of every tier, as cards (fanmat.js) placed row by row on the tier's
// own steps, so rows stand behind and above each other and hide each other as a real stand does. Each
// fan is someone: yours or theirs, in his side's colours (sideWear), his top, head and build
// (fantex.js), his skin and hair, his size, a little off his seat's middle, where he looks. A few seats are empty, stairways are kept clear. The
// home curva and the away end stand all game; some of them wave flags (ultras2.js draws the flags).
// Two draws: the seats (the empty stand) and every fan in one instanced draw.
import * as THREE from 'three';
import { fanAtlas, seatTile } from './fantex.js';
import { fanMaterial, seatMaterial } from './fanmat.js';
import { LIGHT_DIR } from './player.js';

// SEAT: one seat's width (m), a little under groundplan.js's 0.6 so shoulders nearly touch, as they do
const PITCH_P = new THREE.Vector3(0, 3, -15), SEAT = 0.52, PACKED = 0.46, AISLE = 15;
const NEUTRAL = ['#1c1e24', '#2b3550', '#4a4f58', '#3a4a38', '#6b5a44', '#7a7f88'];
// the tops (fantex.js TOPS): collar, stripes, band, scarf, zip jacket + scarf, hoodie, track jacket, polo
const TOP_W = [22, 18, 8, 16, 12, 8, 8, 8], STYLE_W = [26, 14, 6, 10, 8, 6, 9, 0, 5];   // head styles: short, buzz, bald, cap, beanie, long, curly, (hood), receding
// builds (fanpaint.js BUILDS): slim, average, broad, heavy for the men; women are their own build. Women
// are about one in eight of a football crowd (UK league surveys of the 2000s put them at 10 to 15%).
const BUILD_W = [24, 38, 20, 18], WOMEN = [0.13, 0.06], WOMAN = 4;
const WOMAN_STYLE_W = [10, 0, 0, 6, 8, 60, 16, 0, 0];
const SKIN_W = [0.3, 0.25, 0.18, 0.12, 0.09, 0.06], HAIR_W = [0.22, 0.25, 0.18, 0.1, 0.08, 0.04, 0.04, 0.05], GREY = 5;
const v = () => new THREE.Vector3();

function seeded(s) { let r = (Math.abs(Math.floor(s)) * 16807 + 11) % 2147483647 || 1; return () => (r = (r * 16807) % 2147483647) / 2147483647; }
const pick = (w, r) => { let x = r * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return i; return w.length - 1; };
const lum = h => { const n = parseInt(h.slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255; };

// What one side's fans wear, from its kit colours as the game hands them over ([shirt, alt, shorts,
// trim, off-white]; the off-white is always added, so it's dropped). The shirt colour dominates; the
// rest wear the kit's second colour (or the stripes); scarves and caps are in the kit's colours. A
// white shirt makes a grey crowd, so a white side leans on its trim and shorts colours too.
// Returns { cols: up to 4 distinct colours, top: [[i, weight]], acc: [[i, weight]], stripes }.
export function sideWear(kit) {
  const [shirt, alt = shirt, shorts = shirt, trim = alt] = kit, cols = [];
  const at = c => { const i = cols.indexOf(c); if (i >= 0) return i; cols.push(c); return cols.length - 1; };
  const S = at(shirt), stripes = alt !== shirt, white = lum(shirt) > 0.82;
  const others = [alt, trim, shorts].filter(c => c !== shirt && !(lum(c) > 0.82 && !white));
  const second = others.length ? at(others[0]) : S, third = others.length > 1 ? at(others.find(c => c !== others[0]) || others[0]) : second;
  const top = white ? [[S, 0.5], [second, 0.34], [third, 0.16]] : [[S, 0.64], [second, 0.26], [third, 0.1]];
  // scarves and caps may be white where the kit has white in it (a red shirt with white trim: red and white scarves)
  const lightAcc = [alt, trim, shorts].find(c => c !== shirt && lum(c) > 0.82), acc2 = second !== S ? second : lightAcc ? at(lightAcc) : S;
  const acc = [[acc2, 0.6], [S, 0.3], [third, 0.1]];
  return { cols, top, acc, stripes };
}

export class Crowd {
  // ours / theirs: fan colours (kit colours, most worn first); share: how much of an ordinary stand is
  // yours; curvaOurs: the home curva is yours.
  constructor(ours, theirs, share, curvaOurs, seed = 1) {
    this.rand = seeded(seed * 7919 + 13);
    this.wear = [sideWear(theirs), sideWear(ours)];
    const four = w => [0, 1, 2, 3].map(i => w.cols[i] || w.cols[0]);
    this.pal = [...four(this.wear[1]), ...four(this.wear[0]), ...NEUTRAL];          // 0..3 yours, 4..7 theirs, 8.. neutral
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
    const R = this.rand, mine = R() < this.share[band] ? 1 : 0, w = this.wear[mine], base = mine ? 0 : 4;
    const W = TOP_W.slice(); if (!w.stripes) W[1] = 0;
    const top = pick(W, R()), neutral = band === 0 && R() < 0.05;            // a few plain jackets, only in ordinary stands
    const shirt = neutral ? 8 + Math.floor(R() * 6) : base + (top === 1 ? w.top[0][0] : w.top[pick(w.top.map(q => q[1]), R())][0]);
    let acc = base + w.acc[pick(w.acc.map(q => q[1]), R())][0];
    if (acc === shirt) { const o = w.top.map(q => q[0]).find(i => base + i !== shirt); if (o !== undefined) acc = base + o; }
    // who he is: a kid, a woman or a man of some build and age; his face, beard and glasses
    const kid = !packed && R() < 0.03, woman = !kid && R() < WOMEN[packed ? 1 : 0], old = !kid && R() < 0.16;
    const build = kid ? 0 : woman ? WOMAN : pick(BUILD_W, R());
    let style = top === 5 && R() < 0.5 ? 7 : pick(woman ? WOMAN_STYLE_W : STYLE_W, R());
    if (old && !woman && (style === 0 || style === 1 || style === 6) && R() < 0.55) style = R() < 0.5 ? 8 : 2;   // older men: thinning on top
    const face = woman || kid ? 0 : R() < 0.45 ? 1 : 0;
    const beard = woman || kid ? 0 : pick([50, 26, 12, 12], R());          // none, stubble, goatee and moustache, a full beard
    const glasses = !kid && R() < (old ? 0.3 : 0.08) ? 1 : 0;
    const hair = old && R() < 0.75 ? GREY : pick(HAIR_W, R());
    const scale = kid ? 0.8 : woman ? 0.9 + R() * 0.08 : 0.92 + R() * 0.16, b = 0.9 + R() * 0.2;
    const chat = !packed && R() < 0.1 ? (R() < 0.5 ? 1 : 2) : 0;
    const f = {
      p, torso: top + 8 * build + (top >= 4 && top <= 6 ? 64 : 0), mine, phase: R(), role, scale, shade: [shade[0] * b, shade[1] * b], band, k, t,
      col: [shirt, acc, pick(SKIN_W, R()) + 8 * hair, style + 16 * face + 32 * beard + 128 * glasses], look: [R() < 0.5 ? -1 : 1, (R() - 0.5) * 34, (R() - 0.5) * 20, chat],
      who: { kid, woman, old, build, face, beard, glasses },
    };
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
    const n = this.fans.length, seat = new Float32Array(n * 4), fan = new Float32Array(n * 4), col = new Float32Array(n * 4), look = new Float32Array(n * 4), sh = new Float32Array(n * 2);
    this.fans.forEach((f, i) => {
      seat.set([f.p.x, f.p.y, f.p.z, f.scale], i * 4); fan.set([f.torso, f.mine, f.phase, f.role], i * 4); col.set(f.col, i * 4); look.set(f.look, i * 4); sh.set(f.shade, i * 2);
    });
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('aSeat', new THREE.InstancedBufferAttribute(seat, 4));
    g.setAttribute('aFan', new THREE.InstancedBufferAttribute(fan, 4));
    g.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 4));
    g.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 4));
    g.setAttribute('aShade', new THREE.InstancedBufferAttribute(sh, 2));
    g.instanceCount = n;
    const atlas = fanAtlas(), mat = fanMaterial(atlas, light, crowd);
    this.pal.forEach((c, i) => mat.uniforms.uPal.value[i].set(c));
    const fanMesh = new THREE.Mesh(g, mat); fanMesh.frustumCulled = false; fanMesh.matrixAutoUpdate = false;
    return { seats: seatMesh, fans: fanMesh, holders, count: n, tris: S.idx.length / 3 + n * 2, atlasBytes: atlas.bytes, atlasMs: atlas.ms };
  }
}
