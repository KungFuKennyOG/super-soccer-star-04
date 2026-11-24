// What the brawl's favours (rules/brawl/chaos.js) look like, in the same straight-faced '04 look as the rest:
// the shadow of something on its way down from the upper tier and then the thing itself (a fridge, a sofa...),
// the medical buggy and the lane it's about to drive, supporters in their side's colours, a ring under the
// man the referee is coming for, a bigger ball while it's the heavy one. Every warning is on the grass
// before anything lands.
import * as THREE from 'three';
import { buildPlayer2 } from '../ps2/player.js';
import { buildThing, buildBuggy } from './props.js';
import { groundTex } from '../ps2/markers.js';

// a soft round shadow, and a scuffed patch of turf
function radial(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 1, 32, 32, 31);
  for (const [at, col] of stops) gr.addColorStop(at, col);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
let softTex = null, scarTex = null;
const flat = (geo, color, opacity) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 5; return m; };

// kits: { home, away } the sides' kits, for the supporters' shirts.
export function createChaosView(scene, w, kits) {
  const cx = () => w.cx;
  // a supporter per slot and side: his side's shirt over jeans
  const fans = {};
  for (const slot of ['m0', 'm1']) for (const team of ['home', 'away']) {
    const k = kits[team], m = buildPlayer2({ pattern: 'solid', shirt: k.shirt, alt: k.shirt, shorts: '#34496e', socks: '#34496e', band: k.shirt, trim: k.trim || '#ffffff', trim2: k.shirt, number: k.shirt }, '', slot === 'm0' ? 31 : 47);
    m.root.visible = m.shadow.visible = false; scene.add(m.root, m.shadow);
    fans[`${slot}-${team}`] = m;
  }
  const drops = new Map(), debris = [];
  softTex = softTex || radial([[0, 'rgba(0,0,0,1)'], [0.6, 'rgba(0,0,0,0.85)'], [1, 'rgba(0,0,0,0)']]);
  scarTex = scarTex || radial([[0, 'rgba(40,28,14,0.85)'], [0.5, 'rgba(46,40,18,0.55)'], [1, 'rgba(46,40,18,0)']]);
  // dust and clods thrown up where something lands
  const DN = 240, dpos = new Float32Array(DN * 3).fill(-999), dvel = new Float32Array(DN * 3), dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: '#5a4a2a', size: 0.14, sizeAttenuation: true, map: radial([[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]), transparent: true, alphaTest: 0.3 })); dust.frustumCulled = false; scene.add(dust);
  let dn = 0;
  const puff = (x, z, n) => { for (let i = 0; i < n; i++) { const k = dn++ % DN, a = Math.random() * 6.283, s = 2 + Math.random() * 6; dpos[k * 3] = x; dpos[k * 3 + 1] = 0.1; dpos[k * 3 + 2] = z; dvel[k * 3] = Math.cos(a) * s; dvel[k * 3 + 1] = 2 + Math.random() * 6; dvel[k * 3 + 2] = Math.sin(a) * s; } };
  // a ring in his side's colour under each supporter, so you can tell whose he is
  const tag = {};
  for (const team of ['home', 'away']) { const r = flat(new THREE.RingGeometry(0.55, 0.75, 28), kits[team].shirt, 0.85); r.visible = false; scene.add(r); tag[team] = r; }
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
          const shadow = flat(new THREE.PlaneGeometry(e.r * 2.3, e.r * 2.3), '#000000', 0.1); shadow.material.map = softTex; shadow.material.needsUpdate = true; shadow.position.set(e.x, 0.03, e.z);
          const edge = flat(new THREE.RingGeometry(e.r - 0.12, e.r, 40), '#ffb020', 0.7); edge.position.set(e.x, 0.034, e.z);
          const thing = buildThing(e.thing); thing.visible = false; thing.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
          scene.add(shadow, edge, thing);
          drops.set(e.id, { shadow, edge, thing, x: e.x, z: e.z, t0: e.t });
        } else if (e.what === 'drop' && e.stage === 'hit') {
          const d = drops.get(e.id); if (!d) continue;
          scene.remove(d.shadow, d.edge); drops.delete(e.id);
          d.thing.position.set(d.x, d.thing.userData.rest.y, d.z); d.thing.rotation.set(d.thing.userData.rest.rx, Math.random() * 6, 0.05, 'YXZ'); d.rz = 0.05;
          debris.push({ thing: d.thing, t: 9, land: 0.3 }); shake = 1;
          puff(d.x, d.z, 46);
          // the turf it landed on stays scuffed
          const scar = flat(new THREE.PlaneGeometry(3.4, 3.4), '#ffffff', 0.9); scar.material.map = scarTex; scar.material.needsUpdate = true; scar.position.set(d.x, 0.024, d.z); scar.renderOrder = 3; scene.add(scar);
          // and if it landed on somebody, it shows
          if (ev.some(x => x.type === 'launch' && x.kind === 'drop')) d.thing.userData.stain(0.4);
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
      for (const d of debris) {
        d.t -= dt;
        // it lands, rocks once and settles
        if (d.land > 0) { d.land -= dt; d.thing.rotation.z = 0.05 + Math.sin(d.land * 30) * d.land * 0.5; }
        if (d.t < 1) d.thing.position.y -= dt * 1.2;
        if (d.t <= 0) scene.remove(d.thing);
      }
      for (let k = 0; k < DN; k++) { if (dpos[k * 3 + 1] < -100) continue; dvel[k * 3 + 1] -= 14 * dt; dpos[k * 3] += dvel[k * 3] * dt; dpos[k * 3 + 1] += dvel[k * 3 + 1] * dt; dpos[k * 3 + 2] += dvel[k * 3 + 2] * dt; if (dpos[k * 3 + 1] < 0) dpos[k * 3 + 1] = -999; }
      dgeo.attributes.position.needsUpdate = true;
      for (const team of ['home', 'away']) { const m = c.mob.find(q => q.state !== 'gone' && q.side === team && q.state !== 'air'); tag[team].visible = !!m; if (m) tag[team].position.set(m.x, 0.04, m.z); }
      for (let i = debris.length - 1; i >= 0; i--) if (debris[i].t <= 0) debris.splice(i, 1);
      const g = c.buggy;
      buggy.visible = lane.visible = !!g;
      if (g) {
        buggy.position.set(g.x, Math.abs(Math.sin(t * 22)) * 0.035, g.z); buggy.rotation.y = g.dir > 0 ? 0 : Math.PI;
        if (g.t <= 0) for (const wh of buggy.userData.wheels) wh.rotation.z -= dt * 38;
        buggy.userData.light.visible = Math.sin(t * 20) > 0;
        lane.position.z = g.z; lane.material.opacity = g.t > 0 ? 0.18 + 0.16 * Math.sin(t * 12) : 0.14;
      }
      const r = w.ref && w.ref.rage, tg = r && w.byId[r.id];
      ring.visible = !!tg && tg.state !== 'crowd';
      if (ring.visible) { ring.position.set(tg.x, 0.04, tg.z); ring.scale.setScalar(1 + 0.12 * Math.sin(t * 10)); }
    },
    // the heavy ball is a dull, dark thing
    heavy() { const c = cx(); return !!c && c.heavy > 0; },
    // how big the ball is drawn: the heavy one is bigger (it swells in over the warning)
    ballScale(t) { const c = cx(); return !c ? 1 : c.heavy > 0 ? 1.55 : c.heavyWarn > 0 ? 1 + 0.25 * (1 + Math.sin(t * 16)) / 2 : 1; },
  };
}
