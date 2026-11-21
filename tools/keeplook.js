// Keeper shots for the look page (tools/ps2look.html): the real sim plays a real shot (or an attacker moving
// the ball about) and the keeper is posed from it frame by frame, as game/main.js does in a match.
//   keepready     you bring the ball slowly toward goal from 24 m: his set position, adjusting
//   keepshuffle   you carry it across the top of the box and back: his side-steps
//   keeplow       a low shot to his left (&side=-1 his right): a low dive. &kind=catch|parry forces the outcome
//   keephigh      a high shot to his left: a high dive
//   keepstand     a shot straight at him, chest high (&y=0.3 a low one he scoops, &y=2 one over his head)
//   keephold      a soft one at him that he catches and holds, then the seconds after
// Each also ...front (from behind the shooter: the striker's view), ...side (along the goal line, his profile) and
// ...near (5 m in front of him, low).
// Overrides: &tx= &ty= (where the shot is aimed, m from the middle of the goal / the grass), &hold= (s charged:
// how hard), &from= (m out), &fx= (m across). The shot is struck about t = 1.08 s (let go at 1.0 s).
// Sim → page: the sim's goal (z = -34, facing +z) sits on the page's goal line at x = 34, the middle at z = 7.
import * as THREE from 'three';
import { createWorld, stepSim } from '../rules/sim.js';
import { GOAL } from '../rules/tuning.js';

const DT = 1 / 72, MZ = 7;
const P = (x, z) => [-z, x + MZ];                           // a sim point on the page
const SETUPS = {
  ready: { secs: 6, walk: { x: 0.25, z: -0.35 }, from: 24, fx: -3 },
  shuffle: { secs: 6, across: true, from: 17, fx: -6 },
  low: { tx: 2.5, ty: 0.3, hold: 0.5 },
  high: { tx: 2.4, ty: 1.95, hold: 0.5 },
  stand: { tx: 0.15, ty: 1.15, hold: 0.45 },
  hold: { tx: 0.1, ty: 1.0, hold: 0.35, secs: 5 },
};
const LET_GO = 1.0;

// One row per sim step: the keeper, the shooter, the ball, who has it, the events.
export function keeperLog(name, q) {
  const S = { ...SETUPS[name] };
  for (const k of ['tx', 'ty', 'hold', 'from', 'fx']) if (q.get(k) !== null) S[k] = +q.get(k);
  if (q.get('y') !== null) S.ty = +q.get('y');
  if (q.get('side') === '-1' && S.tx) S.tx = -S.tx;
  const w = createWorld(() => 0.5), kind = q.get('kind');
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
    const it = { move, facing: { x: 0, z: -1 } };
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
export const KEEP_SHOTS = Object.keys(SETUPS).flatMap(n => ['', 'front', 'side', 'near', 'dive', 'top'].map(v => 'keep' + n + v));
export function parseKeepShot(name) {
  const m = /^keep(ready|shuffle|low|high|stand|hold)(front|side|near|dive|top)?$/.exec(name);
  return m && { setup: m[1], view: VIEWS[m[2] || 'diag'] };
}
export const toPage = { P, MZ };
