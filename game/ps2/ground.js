// An '04-look ground, built from its recipe in game/grounds.js through the plan in groundplan.js:
// stands with tiers, fascias with ad boards, executive boxes under the overhangs, roofs on cantilever
// trusses, closed gable ends, corner sweeps, and a crowd on every tier (fans.js: the seats and a fan on
// each). The floodlights, towers and pitchside boards are in groundbits.js, the flags and banners in
// ultras2.js. Draw calls per ground: structure 1, lattice 1, seats 1, fans 1, glows 1, flags 1, banners 1.
import * as THREE from 'three';
import { planGround, gable, FRONT } from './groundplan.js';
import { Geo, GlowGeo, frameAt } from './groundgeo.js';
import { structureAtlas, region, adRegion } from './groundtex.js';
import { structureMaterial, glowMaterial } from './groundmat.js';
import { Crowd } from './fans.js';
import { lightsAndBits } from './groundbits.js';
import { buildUltras2 } from './ultras2.js';
import { extras, cornerBlock, skyline, skylineTex, END_CORNER } from './groundextras.js';

const PITCH_P = new THREE.Vector3(0, 3, -15);
const v = () => new THREE.Vector3();

// A run: where a stand's cross-section is swept. Straight: along x for `len`. Corner: round (cx, cz)
// from yaw a0 to a1. pt(t, z, y) is a world point, at(z) the run's length at depth z.
export function straightRun(x, z, yaw, len) {
  const f = frameAt(x, z, yaw);
  return { f, n: 1, len, pt: (t, lz, y) => f(-len / 2 + t * len, y, lz), at: () => len };
}
export function cornerRun(cx, cz, a0, a1, n = 6) {
  return { n, pt: (t, lz, y) => frameAt(cx, cz, a0 + t * (a1 - a0))(0, y, lz), at: lz => Math.abs(a1 - a0) * Math.max(0.5, -lz) };
}
const faceOf = (kind, m) => kind === 'pitch' ? PITCH_P : kind === 'out' ? v().set(m.x * 2 - PITCH_P.x, m.y, m.z * 2 - PITCH_P.z) : kind === 'up' ? v().set(m.x, m.y + 10, m.z) : v().set(m.x, m.y - 10, m.z);

// One strip of the cross-section ([z0, y0] to [z1, y1]) along the run from t0 to t1. o.tile: metres
// per texture repeat [along, across]; o.uv: fixed uvs instead; o.face: 'pitch' | 'out' | 'up' | 'down'.
export function strip(G, run, t0, t1, [z0, y0], [z1, y1], o) {
  const segs = Math.max(1, Math.ceil((t1 - t0) * run.n - 1e-6)), across = Math.hypot(z1 - z0, y1 - y0), along = run.at((z0 + z1) / 2);
  for (let k = 0; k < segs; k++) {
    const ta = t0 + (t1 - t0) * k / segs, tb = t0 + (t1 - t0) * (k + 1) / segs;
    const a = run.pt(ta, z0, y0), b = run.pt(tb, z0, y0), c = run.pt(tb, z1, y1), d = run.pt(ta, z1, y1);
    const m = v().addVectors(a, c).multiplyScalar(0.5);
    let uv = o.uv || [ta * along / o.tile[0], 0, tb * along / o.tile[0], across / o.tile[1]];
    // words read left to right from the pitch, whichever way the run goes
    if (o.uv && o.face === 'pitch') { const n = v().subVectors(PITCH_P, m), right = v().crossVectors(n.negate(), v().set(0, 1, 0)); if (v().subVectors(b, a).dot(right) < 0) uv = [uv[2], uv[1], uv[0], uv[3]]; }
    G.quad(a, b, c, d, { ...o, uv, face: faceOf(o.face, m) });
  }
}

// The whole cross-section of a stand along a run. bands(i): the crowd blocks on tier i as
// [[t0, t1, band, ultra]]. ends: close the two ends with gable walls (straight stands only).
function stand(G, L, CR, glow, run, p, colors, bands, ends) {
  const club = colors.facade || colors.club, front = colors.front || '#343841';
  strip(G, run, 0, 1, [0.02, 0], [0.02, FRONT], { reg: region('paint'), color: front, tile: [4, 4], face: 'pitch' });
  strip(G, run, 0, 1, [0.02, FRONT], [-0.4, FRONT], { reg: region('concrete'), tile: [4, 4], face: 'up' });
  const roofFront = p.roof ? Math.max(p.roof.zFront, p.tiers[p.tiers.length - 1].z1) : null;
  p.tiers.forEach((t, i) => {
    const tier = i === 0 ? { ...t, z0: -0.4, i } : { ...t, z0: t.z0 - 0.4, i };
    for (const [t0, t1, band, ultra] of bands(i)) CR.strip(run, t0, t1, tier, band, ultra, roofFront);
    const f = p.fascias[i];
    if (f) {
      // the fascia under the next tier: a trim in the club's colour, a row of ads, a trim; its top
      strip(G, run, 0, 1, [f.z, f.y0], [f.z, f.y0 + 0.3], { reg: region('paint'), color: club, tile: [8, 1], face: 'pitch' });
      const n = Math.max(1, Math.round(run.at(f.z) / 6.4));
      for (let k = 0; k < n; k++) strip(G, run, k / n, (k + 1) / n, [f.z, f.y0 + 0.3], [f.z, f.y1 - 0.3], { reg: adRegion(k + i * 3), uv: [0, 0, 1, 1], glow: 0.18, face: 'pitch' });
      strip(G, run, 0, 1, [f.z, f.y1 - 0.3], [f.z, f.y1], { reg: region('paint'), color: club, tile: [8, 1], face: 'pitch' });
      strip(G, run, 0, 1, [f.z, f.y1], [f.z - 0.4, f.y1], { reg: region('concrete'), tile: [4, 4], face: 'up' });
      // under the overhang: its soffit and the executive boxes on the back wall of the tier below
      const s = p.soffits[i];
      strip(G, run, 0, 1, [s.z0, s.y0], [s.z1, s.y1], { reg: region('roofUnder'), tile: [6, 6], color: [0.7, 0.7, 0.72], face: 'down' });
      strip(G, run, 0, 1, [s.z1 + 0.02, s.lowTop], [s.z1 + 0.02, s.y1], { reg: region('boxes'), tile: [4, 1.4], glow: 0.35, face: 'pitch' });
    }
  });
  const last = p.tiers[p.tiers.length - 1];
  strip(G, run, 0, 1, [p.back + 0.05, last.y1 - 0.5], [p.back + 0.05, p.wallTop], { reg: region('concrete'), tile: [4, 4], color: [0.8, 0.8, 0.8], face: 'pitch' });
  strip(G, run, 0, 1, [p.back - 0.3, 0], [p.back - 0.3, p.wallTop], { reg: region('cladding'), tile: [4, 6], face: 'out' });
  strip(G, run, 0, 1, [p.back + 0.05, p.wallTop], [p.back - 0.3, p.wallTop], { reg: region('concrete'), tile: [4, 4], face: 'up' });
  // the underside behind the last tier, so you can't see through under the seats from outside
  strip(G, run, 0, 1, [p.back - 0.3, 0.05], [0, 0.05], { reg: region('dark'), tile: [6, 6], face: 'up' });
  if (p.roof) {
    const r = p.roof, yB = p.wallTop + 0.4, yF = r.y + 0.6;
    strip(G, run, 0, 1, [r.zBack, yB], [r.zFront, yF], { reg: region('roofTop'), tile: [4, 8], color: colors.roof || [1, 1, 1], face: 'up' });
    strip(G, run, 0, 1, [r.zBack, yB - 0.35], [r.zFront, yF - 0.35], { reg: colors.roof ? region('paint') : region('roofUnder'), tile: [4, 4], color: colors.roof || [0.75, 0.75, 0.8], face: 'down' });
    strip(G, run, 0, 1, [r.zFront, yF - 0.95], [r.zFront, yF], { reg: region('paint'), color: '#e4e6ea', tile: [8, 1], face: 'pitch' });
    strip(G, run, 0, 1, [r.zFront, yF], [r.zFront - 0.3, yF], { reg: region('paint'), color: '#c8cacf', tile: [8, 1], face: 'up' });
    // the lattice beam along the front edge, and a cantilever truss every 8 m
    strip(L, run, 0, 1, [r.zFront - 0.05, yF - 2.3], [r.zFront - 0.05, yF - 0.9], { reg: region('lattice'), tile: [2.6, 1.4], face: 'pitch', color: [0.85, 0.86, 0.9] });
    const nT = Math.max(2, Math.round(run.at((r.zBack + r.zFront) / 2) / 8));
    for (let k = 0; k <= nT; k++) {
      const t = k / nT, a = run.pt(t, r.zBack, yB - 0.35), b = run.pt(t, r.zFront, yF - 0.35), c = run.pt(t, r.zFront, yF - 2.3), d = run.pt(t, r.zBack, yB - 4.5);
      L.quad(a, b, c, d, { reg: region('lattice'), uv: [0, 1, Math.hypot(r.zFront - r.zBack, 1) / 3, 0], color: [0.8, 0.82, 0.86] });
    }
    if (colors.lights === 'roof') {
      const nL = Math.max(2, Math.round(run.at(r.zFront) / 6));
      for (let k = 0; k < nL; k++) {
        const t = (k + 0.5) / nL, a = run.pt(t - 0.3 / nL, r.zFront + 0.15, yF - 2.0), b = run.pt(t + 0.3 / nL, r.zFront + 0.15, yF - 2.0), c = run.pt(t + 0.3 / nL, r.zFront - 0.25, yF - 1.1), d = run.pt(t - 0.3 / nL, r.zFront - 0.25, yF - 1.1);
        G.quad(a, b, c, d, { reg: region('lamp'), uv: [0, 0, 2, 1], glow: 1, face: 'pitch' });
        glow.add(run.pt(t, r.zFront + 0.6, yF - 1.6), 2.4);
      }
    }
  }
  if (run.f) for (const sx of [-1, 1]) {
    if (!ends[sx < 0 ? 0 : 1]) continue;
    const pts = gable(p).map(([z, y]) => run.f(sx * run.len / 2, y, z)), back = pts.pop();
    const uvs = [back, ...pts].map(q => { const l = v().copy(q); return [l.z * 0.25 + l.x * 0.25, l.y * 0.25]; });
    G.poly([back, ...pts], uvs, { reg: region('concrete'), color: [0.85, 0.85, 0.83], face: run.f(sx * (run.len / 2 + 20), 5, -5) });
  }
}

// recipe: from GROUNDS. ours / theirs: fan colours. oursShare: 0..1 of the crowd that is yours.
// light: groundLight() (stadium.js), shared by every ground material. jump: the match-moment uniforms
// the crowd reacts to (stadium.js: uJumpOurs, uJumpTheirs, uOoh, uGoalT, uTheirT).
export function buildGround2(recipe, ours, theirs, oursShare, light, jump, hype) {
  const t0 = performance.now(), plan = planGround(recipe), group = new THREE.Group();
  const curvaOurs = oursShare >= 0.5, home = curvaOurs ? ours : theirs, away = curvaOurs ? theirs : ours;
  const G = new Geo(), L = new Geo(), CR = new Crowd(ours, theirs, oursShare, curvaOurs, recipe.name.length * 31 + recipe.gap * 7), glow = new GlowGeo();
  const colors = { club: recipe.seats[0], facade: recipe.facade, front: recipe.front, roof: recipe.roofColor, lights: recipe.lights };
  const { curva, block } = plan, T = s => s + 0.5;              // fractions along the end stand, from -0.5..0.5 to 0..1
  for (const s of plan.stands) {
    const run = straightRun(s.x, s.z, s.yaw, s.len);
    const blockHere = block.on === s.id, B = blockHere ? (s.id === 'near' ? [1 - T(block.to), 1 - T(block.from)] : [T(block.from), T(block.to)]) : null;
    const bands = i => {
      if (s.isEnd && i === 0) return blockHere ? [[0, T(curva.from), 0, 0], [T(curva.from), T(curva.to), 1, 1], [T(curva.to), B[0], 0, 0], [B[0], 1, 2, 1]] : [[0, T(curva.from), 0, 0], [T(curva.from), T(curva.to), 1, 1], [T(curva.to), 1, 0, 0]];
      if (blockHere) return B[0] > 0 ? [[0, B[0], 0, 0], [B[0], B[1], 2, i === 0 ? 1 : 0], ...(B[1] < 1 ? [[B[1], 1, 0, 0]] : [])] : [[0, B[1], 2, i === 0 ? 1 : 0], [B[1], 1, 0, 0]];
      return [[0, 1, 0, 0]];
    };
    // gables close a stand's ends where nothing meets them: no corner there, or one shaped differently
    const ends = [-1, 1].map(sx => { const k = END_CORNER[s.id][sx < 0 ? 0 : 1], c = plan.corners.find(q => q.id === k); return !c || c.block || JSON.stringify(c.tiers) !== JSON.stringify(s.tiers); });
    stand(G, L, CR, glow, run, s.p, colors, bands, ends);
    extras(G, L, run, s.p, recipe, s.id);
  }
  for (const c of plan.corners) {
    const run = cornerRun(c.x, c.z, c.a0, c.a1);
    if (c.block) cornerBlock(G, run, c.p); else { stand(G, L, CR, glow, run, c.p, colors, () => [[0, 1, 0, 0]], [false, false]); extras(G, L, run, c.p, recipe, c.id); }
  }
  const SK = new Geo();
  if (recipe.skyline) skyline(SK, recipe.skyline, plan);
  const bits = lightsAndBits(G, L, glow, plan, recipe);
  const crowd = CR.build(light, jump, recipe.seats);
  const atlas = structureAtlas();
  const meshes = { structure: G.mesh(structureMaterial(atlas, light)), lattice: L.mesh(structureMaterial(atlas, light, true)), seats: crowd.seats, fans: crowd.fans, glows: glow.mesh(glowMaterial(light)) };
  if (SK.count) meshes.skyline = SK.mesh(structureMaterial(skylineTex(recipe.skyline), light, true));
  const end = plan.stands[0], ultras = buildUltras2({ f: frameAt(end.x, end.z, end.yaw), len: end.len, curva: plan.curva, block: plan.block }, crowd.holders, home, away, light, { ...hype, ...jump }, recipe.name.length);
  group.add(...Object.values(meshes), ultras.group);
  const tris = Object.values(meshes).reduce((n, m) => n + (m === crowd.fans ? 0 : m.geometry.index.count / 3), 0) + crowd.count * 2 + ultras.tris;
  return {
    group, recipe, plan, topY: plan.topY, endZ: plan.endZ, sideX: plan.sideX, ultras, curvaOurs, board: plan.board,
    lamps: meshes.glows.material, meshes, bits,
    stats: { draws: Object.keys(meshes).length + ultras.draws, tris, fans: crowd.count, fanAtlasMs: crowd.atlasMs, lamps: glow.pos.length / 12, ms: Math.round(performance.now() - t0) },
  };
}
