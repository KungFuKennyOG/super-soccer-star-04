// Keeper shots for the look page (tools/ps2look.html): the real sim plays a real shot (or an attacker moving
// the ball about) and the keeper is posed from it frame by frame, as game/main.js does in a match.
//   keepready     you bring the ball slowly toward goal from 24 m: his set position, adjusting
//   keepshuffle   you carry it across the top of the box and back: his side-steps
//   keeplow       a low shot to his left (&side=-1 his right): a low dive. &kind=catch|parry forces the outcome
//   keephigh      a high shot to his left: a high dive
//   keepstand     a shot straight at him, chest high (&y=0.3 a low one he scoops, &y=2 one over his head)
//   keephold      a soft one at him that he catches and holds, then the seconds after
//   keepscoop / keepcup / keepw / keephead / keepover / keepjump   standing catches by height; keepwside, keepcupside a
//                 step to one side first; keepblock / keeplowblock / keeptip   the same too hot to hold
//   keeplrl, keepcreep, keepinout, keepsplit   the feet: a long shuffle left-right-left, small steps, out and back, the split step
// Each also ...front (from behind the shooter: the striker's view), ...side (along the goal line, his profile),
// ...near (5 m in front of him, low), and going with him, close: ...cfront, ...cside, ...cq, ...chigh, ...chighside.
// Overrides: &tx= &ty= (where the shot is aimed, m from the middle of the goal / the grass), &hold= (s charged:
// how hard), &from= (m out), &fx= (m across). The shot is struck about t = 1.08 s (let go at 1.0 s).
// Sim → page: the sim's goal (z = -34, facing +z) sits on the page's goal line at x = 34, the middle at z = 7.
import * as THREE from 'three';
import { createWorld, stepSim } from '../rules/sim.js';
import { GOAL } from '../rules/tuning.js';

const DT = 1 / 72, MZ = 7, hipW = new THREE.Vector3();
const P = (x, z) => [-z, x + MZ];                           // a sim point on the page
const SETUPS = {
  ready: { secs: 6, walk: { x: 0.25, z: -0.35 }, from: 24, fx: -3 },
  shuffle: { secs: 6, across: true, from: 17, fx: -6 },
  low: { tx: 2.5, ty: 0.3, hold: 0.5 },
  high: { tx: 2.4, ty: 1.95, hold: 0.5 },
  stand: { tx: 0.15, ty: 1.15, hold: 0.45 },
  hold: { tx: 0.1, ty: 1.0, hold: 0.35, secs: 5 },
  // standing saves by height (a catch unless it says parry), the feet, and the split step
  scoop: { tx: 0.15, ty: 0.25, hold: 0.4, kind: 'catch' }, cup: { tx: -0.1, ty: 0.85, hold: 0.4, kind: 'catch' }, w: { tx: 0.15, ty: 1.2, hold: 0.4, kind: 'catch' },
  head: { tx: 0.1, ty: 1.65, hold: 0.4, kind: 'catch' }, over: { tx: 0.1, ty: 2.15, hold: 0.4, kind: 'catch' }, jump: { tx: 0.1, ty: 2.4, hold: 0.4, kind: 'catch' },
  wside: { tx: 0.45, ty: 1.2, hold: 0.4, kind: 'catch' }, cupside: { tx: -0.45, ty: 0.8, hold: 0.4, kind: 'catch' },
  block: { tx: 0.15, ty: 1.2, hold: 0.8, kind: 'parry' }, lowblock: { tx: 0.15, ty: 0.25, hold: 0.9, kind: 'parry' }, tip: { tx: 0.1, ty: 2.15, hold: 0.8, kind: 'parry' },
  lrl: { secs: 7, from: 15, fx: 0, sprint: true, move: t => ({ x: t < 1.5 ? 1 : t < 4 ? -1 : t < 6 ? 1 : 0, z: 0 }) },     // a long shuffle left, right, left
  creep: { secs: 6, from: 17, fx: -3, move: t => ({ x: t < 3 ? 0.3 : -0.3, z: 0 }) },                                 // small adjusting steps
  inout: { secs: 6, from: 24, fx: -2, move: t => ({ x: 0.1, z: t < 3 ? -0.7 : 0.7 }) },                               // off his line and back
  split: { tx: 3.4, ty: 2.2, hold: 1.0, from: 22, secs: 2.5 },                                                         // the split step, then a dive
};
const LET_GO = 1.0;

// One row per sim step: the keeper, the shooter, the ball, who has it, the events.
export function keeperLog(name, q) {
  const S = { ...SETUPS[name] };
  for (const k of ['tx', 'ty', 'hold', 'from', 'fx']) if (q.get(k) !== null) S[k] = +q.get(k);
  if (q.get('y') !== null) S.ty = +q.get('y');
  if (q.get('side') === '-1' && S.tx) S.tx = -S.tx;
  const w = createWorld(() => 0.5), kind = q.get('kind') || S.kind;
  if (kind) w.tune = { ...w.tune, ai: { ...w.tune.ai, gkCatchBelow: kind === 'catch' ? 99 : 0, gkCatchAtHim: kind === 'catch' ? 99 : 0 } };
  for (const id of ['d1', 'd2', 'd3', 'm1', 'm2']) { const p = w.byId[id]; p.x = 25 + p.x; p.z = 20; if (p.role === 'def') p.stun = 99; }
  const from = S.from ?? 16, fx = S.fx ?? 0;
  w.you.x = fx; w.you.z = GOAL.z + from; w.ball.x = fx; w.ball.z = GOAL.z + from - 0.6;
  const gk = w.byId.gk; gk.x = 0; gk.z = GOAL.z + 1.2;
  const log = [], secs = S.secs ?? 3.6;
  for (let t = 0; t < secs; t += DT) {
    let move = { x: 0, z: 0 };
    if (S.walk) move = S.walk;
    if (S.across) move = { x: t < 3 ? 0.55 : -0.55, z: 0 };
    if (S.move) move = S.move(t);
    const it = { move, sprint: !!S.sprint, facing: { x: 0, z: -1 } };
    if (S.tx !== undefined && Math.abs(t - LET_GO) < DT / 2) {
      const eye = { x: w.you.x, y: 1.7, z: w.you.z }, d = [S.tx - eye.x, S.ty - eye.y, GOAL.z - eye.z], l = Math.hypot(...d);
      it.shot = { eye, dir: { x: d[0] / l, y: d[1] / l, z: d[2] / l }, holdT: S.hold };
    }
    const before = { ...w.ball };
    const ev = stepSim(w, it, DT, () => 0.5);
    if (w.dead && ev.some(e => e.type === 'goal' || e.type === 'saved' || e.type === 'parried')) w.dead = false;   // play on: no restart on the page
    log.push({ ev, gk: { ...gk, save: gk.save && { ...gk.save } }, you: { ...w.you }, ball: { ...w.ball }, before, owner: w.owner });
  }
  return log;
}

// The goal: posts, bar and a see-through net.
export function buildGoal() {
  const g = new THREE.Group(), white = new THREE.MeshLambertMaterial({ color: '#f4f4f0' }), r = GOAL.post;
  const bar = (len, x, y, z, ax) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), white); m.position.set(x, y, z); if (ax === 'z') m.rotation.x = Math.PI / 2; g.add(m); };
  bar(GOAL.h, 0, GOAL.h / 2, -GOAL.halfW); bar(GOAL.h, 0, GOAL.h / 2, GOAL.halfW); bar(GOAL.halfW * 2 + 2 * r, 0, GOAL.h, 0, 'z');
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = 2; x.strokeRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const net = (wd, ht, px, py, pz, ry) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(wd / 0.16, ht / 0.16); const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.position.set(px, py, pz); m.rotation.y = ry; g.add(m); };
  net(GOAL.halfW * 2, GOAL.h, GOAL.depth, GOAL.h / 2, 0, Math.PI / 2);
  net(GOAL.depth, GOAL.h, GOAL.depth / 2, GOAL.h / 2, -GOAL.halfW, 0); net(GOAL.depth, GOAL.h, GOAL.depth / 2, GOAL.h / 2, GOAL.halfW, 0);
  g.position.set(-GOAL.z, 0, MZ);
  return g;
}

// The views. A diagonal one from in front and to his left, the striker's, and one along the goal line.
const VIEWS = {
  diag: { fov: 40, cam: [28.2, 1.3, MZ + 3.6], at: [32.7, 0.9, MZ + 0.9] },
  front: { fov: 17, cam: [-GOAL.z - 18.5, 1.75, MZ - 1.1], at: [33, 1.0, MZ + 0.3] },
  near: { fov: 30, cam: [28.5, 1.15, MZ - 0.6], at: [33, 0.85, MZ] },
  side: { fov: 42, cam: [32.6, 1.1, MZ - 6.5], at: [32.6, 0.9, MZ + 1] },
  dive: { fov: 36, cam: [29.0, 0.9, MZ + 1.0], at: [33, 0.7, MZ + 1.0] },      // square on to a dive to his left, close
  top: { fov: 36, cam: [32.2, 4.6, MZ + 1.0], at: [32.9, 0, MZ + 1.0] },       // looking down on it
};
// ...and three that go with him, close: from the front (the striker's side), along the goal line, and three-quarter
const CLOSE = { cfront: { fov: 26, off: [-5.6, 1.25, 0], y: 1.0 }, cside: { fov: 26, off: [0, 1.15, -5.6], y: 1.0 }, cq: { fov: 26, off: [-4.2, 1.5, 3.6], y: 1.0 }, cup: { fov: 34, off: [-5.6, 1.25, 0], y: 1.35 }, cupside: { fov: 34, off: [0, 1.15, -5.6], y: 1.35 } };
// ...four that go with his hips (a dive leaves his spot behind): front, along the line, three-quarter, from above
Object.assign(CLOSE, { hfront: { fov: 24, off: [-5.2, 0.5, 0], hips: true }, hside: { fov: 24, off: [0, 0.4, -5.2], hips: true }, hq: { fov: 24, off: [-4, 0.9, 3.4], hips: true }, htop: { fov: 24, off: [-0.6, 5.2, 0], hips: true } });
// ...and the striker's eyes: 1.7 m up, &eye= m out from the goal line (default 15), level with the middle of the goal.
// fov 34: at 600 px high that is 17.6 px a degree, about what a Quest 3 shows at framebuffer scale 0.7, so a frame
// looked at 1:1 is as much of him as the headset draws
const EYE = typeof location !== 'undefined' ? +(new URLSearchParams(location.search).get('eye') || 15) : 15;
VIEWS.eye = { fov: 34, cam: [-GOAL.z - EYE, 1.7, MZ], at: [-GOAL.z - 1.2, 1.0, MZ] };
const VNAMES = ['front', 'side', 'near', 'dive', 'top', 'cfront', 'cside', 'cq', 'chigh', 'chighside', 'hfront', 'hside', 'hq', 'htop', 'eye'];
CLOSE.chigh = CLOSE.cup; CLOSE.chighside = CLOSE.cupside; delete CLOSE.cup; delete CLOSE.cupside;
export const KEEP_SHOTS = Object.keys(SETUPS).flatMap(n => ['', ...VNAMES].map(v => 'keep' + n + v));
export function parseKeepShot(name) {
  if (!name.startsWith('keep')) return null;
  const rest = name.slice(4), v = VNAMES.filter(x => rest.endsWith(x) && SETUPS[rest.slice(0, -x.length)]).sort((a, b) => b.length - a.length)[0] || '';
  const setup = v ? rest.slice(0, -v.length) : rest;
  return SETUPS[setup] ? { setup, view: VIEWS[v || 'diag'] || { close: CLOSE[v] } } : null;
}
// the camera for a view: { fov, cam, at }; root: the keeper's (a close view goes with him)
export function keepView(view, root) {
  if (!view.close) return view;
  const c = view.close;
  if (c.hips) { const h = (root.userData.hipsBone ??= root.getObjectByName('hips')).getWorldPosition(hipW); return { fov: c.fov, cam: [h.x + c.off[0], h.y + c.off[1], h.z + c.off[2]], at: [h.x, h.y + 0.1, h.z] }; }
  const p = root.position;
  return { fov: c.fov, cam: [p.x + c.off[0], c.off[1], p.z + c.off[2]], at: [p.x, c.y, p.z] };
}
export const toPage = { P, MZ };
