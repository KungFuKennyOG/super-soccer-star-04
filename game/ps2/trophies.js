// The '04-look trophies, to replace the PS1 cups of game/trophy.js (not wired in yet). Same interface
// shape as there: buildTrophy2(kind) gives a Group for 'world' or 'club', with userData.grips (the
// hand-hold points, index 0 on +x for your left hand, as GRIPS in trophy.js), userData.holds (per hold:
// at, axis, d, for the hands' 'hold' pose), userData.holdD (the diameter), userData.height;
// buildPlinth2() is the ceremony's plinth, its top at the cup's rest height (1.02 m). Shapes in
// trophygeo.js, what they're made of in trophymat.js. Three draw calls a cup: polished metal, stone,
// the engraved metal (plaque and laurel band).
import * as THREE from 'three';
import { merge, tris, revolve, smooth } from './metal.js';
import { goldMat, silverMat, malachiteMat, marbleMat, engravedMat, lacquerMat, velvetMat } from './trophymat.js';
import { worldParts, clubParts, GRIPS2, HOLD_D, HOLDS } from './trophygeo.js';
import { worldSketch, clubSketch } from './trophysketch.js';

export { GRIPS2, HOLD_D, HOLDS };
// the plaques: [words, px, y on the sheet, letter spacing]
const WORDS = { world: [['WORLD', 44, 52, 16], ['*', 13, 86], ['CHAMPIONS', 36, 122, 9]], club: [['CHAMPIONS CUP', 46, 58, 9], ['*', 13, 96], ['SUPER SOCCER STAR', 21, 128, 7]] };
const mats = {};
const matsFor = kind => mats[kind] || (mats[kind] = kind === 'world'
  ? { metal: goldMat(), stone: malachiteMat(), engraved: engravedMat(WORDS.world, 'gold') }
  : { metal: silverMat(), stone: marbleMat(), engraved: engravedMat(WORDS.club, 'silver') });

export function buildTrophy2(kind, sketch) {
  const parts = sketch ? (kind === 'world' ? worldSketch : clubSketch)(sketch) : (kind === 'world' ? worldParts : clubParts)(), m = matsFor(kind), g = new THREE.Group();
  let count = 0;
  for (const k of ['metal', 'stone', 'engraved']) {
    const geo = merge(parts[k]), mesh = new THREE.Mesh(geo, m[k]);
    count += tris(geo); mesh.name = k; g.add(mesh);
  }
  const box = new THREE.Box3().setFromObject(g);
  g.userData = { kind, grips: GRIPS2[kind], holds: HOLDS[kind], holdD: HOLD_D[kind], height: box.max.y, width: box.max.x - box.min.x, tris: count, calls: g.children.length };
  return g;
}

// The ceremony plinth: a black lacquer column on a step, a gold fillet under its cap, and midnight
// velvet laid over the top, a gold cord round its edge, hanging in folds. The cup rests at y = 1.02 as in trophy.js. Three draw calls.
export const REST_Y = 1.02;
export function buildPlinth2() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(revolve(smooth([[0, 0], [0.34, 0, 1], [0.34, 0.05, 1], [0.325, 0.06, 1], [0.29, 0.066, 1], [0.275, 0.1], [0.262, 0.5], [0.258, 0.9, 1], [0.27, 0.91], [0.288, 0.94], [0.292, 0.96, 1], [0.292, 1.0, 1], [0, 1.0]], 4), 48), lacquerMat()));
  g.add(new THREE.Mesh(merge([revolve([[0.326, 0.05], [0.3285, 0.052], [0.3285, 0.058], [0.326, 0.06]], 48), revolve([[0.258, 0.888], [0.2615, 0.89], [0.2615, 0.9], [0.258, 0.902]], 48),
    revolve([[0.3, 1.0005], [0.3045, 1.003], [0.3055, 1.0075], [0.3035, 1.012], [0.299, 1.0135]], 64)]), goldMat()));   // and a gold cord round the edge of the cloth
  // the velvet: flat on top, over the edge, hanging 13 to 17 cm in soft folds (deeper toward the hem)
  const folds = 14, fold = (a, y) => { const t = Math.pow(Math.max(0, Math.min(1, (0.998 - y) / 0.15)), 0.6); return 1 + t * (0.04 * Math.sin(a * folds) + 0.014 * Math.sin(a * folds * 2.3 + 1)); };
  const hem = a => 0.855 + 0.018 * Math.cos(a * folds) + 0.01 * Math.sin(a * 3);
  const cloth = revolve(smooth([[0, 1.019], [0.2, 1.019], [0.285, 1.0185], [0.297, 1.012], [0.3005, 1.0], [0.302, 0.96], [0.304, 0.9], [0.306, 0.856]], 3), 112, { mod: fold });
  const p = cloth.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 0.99) { const a = Math.atan2(p.getX(i), -p.getZ(i)); p.setY(i, 1.0 - (1.0 - y) * (1.0 - hem(a)) / 0.144); } }
  cloth.computeVertexNormals();
  cloth.userData.ao = (x, y, z) => { const a = Math.atan2(x, -z), t = Math.max(0, Math.min(1, (1.0 - y) / 0.15)); return 1 - Math.pow(t, 0.6) * 0.55 * (0.5 - 0.5 * Math.sin(a * folds)); };
  const c = new THREE.Mesh(merge([cloth]), velvetMat('#1a2458')); c.material.side = THREE.DoubleSide; g.add(c);
  return g;
}
