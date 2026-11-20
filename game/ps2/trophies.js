// The '04-look trophies, to replace the PS1 cups of game/trophy.js (not wired in yet). Same interface
// shape as there: buildTrophy2(kind) gives a Group for 'world' or 'club', with userData.grips (the
// hand-hold points, index 0 on +x for your left hand, as GRIPS in trophy.js), userData.holds (per hold:
// at, axis, d, for the hands' 'hold' pose), userData.holdD (the diameter), userData.height; buildPlinth2() is the ceremony's
// pedestal, its top at the cup's rest height (1.02 m). Shapes in trophygeo.js, metal in metal.js.
// Three draw calls a cup: metal, stone (or the black plinth), the engraved plate.
import * as THREE from 'three';
import { merge, tris, goldMat, silverMat, ebonyMat, malachiteMat, plateMat } from './metal.js';
import { worldParts, clubParts, GRIPS2, HOLD_D, HOLDS } from './trophygeo.js';

export { GRIPS2, HOLD_D, HOLDS };
const WORDS = { world: [['WORLD', 30], ['CHAMPIONS', 30], ['*', 30]], club: [['CHAMPIONS CUP', 30], ['*  SUPER SOCCER STAR  *', 17]] };
const mats = {};
const matsFor = kind => mats[kind] || (mats[kind] = kind === 'world'
  ? { metal: goldMat(), stone: malachiteMat(), plate: plateMat(WORDS.world, 'gold', { w: 192, h: 128 }) }
  : { metal: silverMat(), dark: ebonyMat(), plate: plateMat(WORDS.club, 'silver', { w: 384, h: 108 }) });

export function buildTrophy2(kind, variant) {
  const parts = kind === 'world' ? worldParts(variant) : clubParts(variant), m = matsFor(kind), g = new THREE.Group();
  let count = 0;
  for (const k of ['metal', 'stone', 'dark']) {
    if (!parts[k].length) continue;
    const geo = merge(parts[k]), mesh = new THREE.Mesh(geo, m[k]);
    count += tris(geo); mesh.name = k; g.add(mesh);
  }
  const p = parts.plate, plate = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), m.plate);
  plate.position.set(0, p.y, p.z); plate.name = 'plate'; g.add(plate); count += 12;
  const box = new THREE.Box3().setFromObject(g);
  g.userData = { kind, grips: GRIPS2[kind], holds: HOLDS[kind], holdD: HOLD_D[kind], height: box.max.y, width: box.max.x - box.min.x, tris: count, calls: g.children.length };
  return g;
}

// The ceremony pedestal: a dark blue column with a gold lip and a red cloth on top, the cup resting at
// y = 1.02 as in trophy.js (rest). Two draw calls.
export function buildPlinth2() {
  const g = new THREE.Group();
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.0, 40), new THREE.MeshStandardMaterial({ color: '#18204a', roughness: 0.5, metalness: 0.1 }));
  col.position.y = 0.5; g.add(col);
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.312, 0.312, 0.04, 40), new THREE.MeshStandardMaterial({ color: '#a80c26', roughness: 0.85 }));
  cloth.position.y = 1.0; g.add(cloth);
  return g;
}
export const REST_Y = 1.02;
