// What the brawl's favours (rules/brawl/chaos.js) look like, in the same straight-faced '04 look as the rest:
// the shadow of something on its way down from the upper tier and then the thing itself (a fridge, a sofa...),
// the medical buggy and the lane it's about to drive, supporters in their side's colours, a ring under the
// man the referee is coming for, a bigger ball while it's the heavy one. Every warning is on the grass
// before anything lands.
import * as THREE from 'three';
import { buildPlayer2 } from '../ps2/player.js';
import { groundTex } from '../ps2/markers.js';

// The things that get thrown on: [w, h, d] in metres, colour, and a second box (a door, a back, a roof).
const THINGS = {
  fridge: { size: [0.8, 1.8, 0.75], color: '#e9ebee', extra: [[0.05, 0.5, 0.04], [0.33, 0.3, 0.39], '#9aa0a8'] },
  sofa: { size: [2.1, 0.5, 0.95], color: '#6b4a34', extra: [[2.1, 0.55, 0.25], [0, 0.5, -0.35], '#5a3d2a'] },
  vending: { size: [1.0, 1.9, 0.85], color: '#b3261e', extra: [[0.7, 1.1, 0.04], [-0.08, 0.2, 0.44], '#1d2733'] },
  loo: { size: [1.2, 2.3, 1.2], color: '#2f62b8', extra: [[1.3, 0.12, 1.3], [0, 1.2, 0], '#e9ebee'] },
  wardrobe: { size: [1.2, 2.0, 0.6], color: '#7a5a3a', extra: [[0.04, 1.8, 0.04], [0, 0, 0.31], '#3a2a1a'] },
};
const box = (s, color) => new THREE.Mesh(new THREE.BoxGeometry(...s), new THREE.MeshPhongMaterial({ color, shininess: 18 }));
function buildThing(kind) {
  const T = THINGS[kind] || THINGS.fridge, g = new THREE.Group(), body = box(T.size, T.color), ex = box(T.extra[0], T.extra[2]);
  ex.position.set(...T.extra[1]); g.add(body, ex); g.userData.h = T.size[1];
  return g;
}
function buildBuggy() {
  const g = new THREE.Group(), body = box([2.6, 0.55, 1.3], '#eef0f2'); body.position.y = 0.6;
  const roof = box([1.5, 0.06, 1.25], '#eef0f2'); roof.position.set(-0.2, 1.75, 0);
  const bed = box([1.0, 0.12, 1.1], '#d8322a'); bed.position.set(-0.75, 0.95, 0);
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), new THREE.MeshBasicMaterial({ color: '#ffb020' })); light.position.set(-0.2, 1.86, 0);
  g.add(body, roof, bed, light);
  for (const [x, z] of [[0.5, 0.6], [0.5, -0.6], [-0.85, 0.6], [-0.85, -0.6]]) { const p = box([0.06, 1.15, 0.06], '#30343a'); p.position.set(x * 1.1, 1.17, z); g.add(p); }
  for (const [x, z] of [[0.85, 0.68], [0.85, -0.68], [-0.85, 0.68], [-0.85, -0.68]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12), new THREE.MeshPhongMaterial({ color: '#17181b' })); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.3, z); g.add(wh); }
  g.userData.light = light;
  return g;
}
const flat = (geo, color, opacity) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 5; return m; };

// kits: { home, away } the sides' kits, for the supporters' shirts.
export function createChaosView(scene, w, kits) {
  const cx = () => w.cx;
  // a supporter per slot and side: his side's shirt over jeans
  const fans = {};
  for (const slot of ['m0', 'm1']) for (const team of ['home', 'away']) {
    const k = kits[team], m = buildPlayer2({ pattern: 'solid', shirt: k.shirt, alt: k.shirt, shorts: '#34496e', socks: '#e8e8e4', band: k.shirt, trim: k.trim || '#ffffff', trim2: k.shirt, number: k.shirt }, '', slot === 'm0' ? 31 : 47);
    m.root.visible = m.shadow.visible = false; scene.add(m.root, m.shadow);
    fans[`${slot}-${team}`] = m;
  }
  const drops = new Map(), debris = [];
  const buggy = buildBuggy(); buggy.visible = false; scene.add(buggy);
  const lane = flat(new THREE.PlaneGeometry(2 * w.W + 16, 2.6), '#ffb020', 0.3); lane.position.y = 0.035; lane.visible = false; scene.add(lane);
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: groundTex(), color: '#e0352b', transparent: true, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 6; ring.visible = false; scene.add(ring);
  let shake = 0;
  return {
    // the model of a supporter on the pitch (or undefined)
    modelOf(p) { return p && p.mob && p.side ? fans[`${p.id}-${p.side}`] : undefined; },
    mob() { return cx() ? cx().mob.filter(m => m.state !== 'gone') : []; },
    get shake() { return shake; },
    events(ev) {
      for (const e of ev) {
        if (e.type !== 'chaos') continue;
        if (e.what === 'drop' && e.stage === 'warn') {
          const shadow = flat(new THREE.CircleGeometry(e.r, 28), '#000000', 0.1); shadow.position.set(e.x, 0.03, e.z);
          const edge = flat(new THREE.RingGeometry(e.r - 0.12, e.r, 40), '#ffb020', 0.7); edge.position.set(e.x, 0.034, e.z);
          const thing = buildThing(e.thing); thing.visible = false; thing.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
          scene.add(shadow, edge, thing);
          drops.set(e.id, { shadow, edge, thing, x: e.x, z: e.z, t0: e.t });
        } else if (e.what === 'drop' && e.stage === 'hit') {
          const d = drops.get(e.id); if (!d) continue;
          scene.remove(d.shadow, d.edge); drops.delete(e.id);
          d.thing.position.set(d.x, d.thing.userData.h * 0.32, d.z); d.thing.rotation.set(Math.PI / 2 + 0.2, Math.random() * 3, 0.15);
          debris.push({ thing: d.thing, t: 7 }); shake = 1;
        } else if (e.what === 'invader' && e.stage === 'warn') {
          const m = fans[`${e.id}-${e.team}`]; m.rag = null; m.getUp = null;
        }
      }
    },
    update(dt, t) {
      const c = cx();
      shake = Math.max(0, shake - dt * 3);
      for (const m of Object.values(fans)) m.root.visible = m.shadow.visible = false;
      if (!c) return;
      for (const p of c.mob) { const m = this.modelOf(p); if (m && p.state !== 'gone') m.root.visible = m.shadow.visible = true; }
      // the shadow darkens and the thing comes down over the last second
      for (const d of c.drops) {
        const v = drops.get(d.id); if (!v) continue;
        const k = 1 - Math.max(0, d.t) / v.t0;
        v.shadow.material.opacity = 0.12 + 0.5 * k; v.shadow.scale.setScalar(0.45 + 0.55 * k);
        v.edge.material.opacity = 0.45 + 0.4 * Math.sin(t * 14);
        v.thing.visible = d.t < 1.1;
        if (v.thing.visible) { v.thing.position.set(v.x, 0.6 + d.t * 38, v.z); v.thing.rotation.x += dt * 3; v.thing.rotation.z += dt * 2; }
      }
      for (const d of debris) { d.t -= dt; if (d.t < 1) d.thing.position.y -= dt * 1.2; if (d.t <= 0) scene.remove(d.thing); }
      for (let i = debris.length - 1; i >= 0; i--) if (debris[i].t <= 0) debris.splice(i, 1);
      const g = c.buggy;
      buggy.visible = lane.visible = !!g;
      if (g) {
        buggy.position.set(g.x, 0, g.z); buggy.rotation.y = g.dir > 0 ? 0 : Math.PI;
        buggy.userData.light.visible = Math.sin(t * 20) > 0;
        lane.position.z = g.z; lane.material.opacity = g.t > 0 ? 0.18 + 0.16 * Math.sin(t * 12) : 0.14;
      }
      const r = w.ref && w.ref.rage, tg = r && w.byId[r.id];
      ring.visible = !!tg && tg.state !== 'crowd';
      if (ring.visible) { ring.position.set(tg.x, 0.04, tg.z); ring.scale.setScalar(1 + 0.12 * Math.sin(t * 10)); }
    },
    // how big the ball is drawn: the heavy one is bigger (it swells in over the warning)
    ballScale(t) { const c = cx(); return !c ? 1 : c.heavy > 0 ? 1.55 : c.heavyWarn > 0 ? 1 + 0.25 * (1 + Math.sin(t * 16)) / 2 : 1; },
  };
}
