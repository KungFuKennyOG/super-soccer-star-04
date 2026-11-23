// Shots for the look page (tools/ps2look.html) of how a man off the ball changes what he is doing: cuts, stops,
// side-steps and backing off (game/footwork.js, game/shuffle.js). He is moved the way the sim moves a player
// (rules/sim.js steer: his velocity goes to the one he wants at 18 m/s2, an arrival slows as 4 x the distance
// left), 72 steps a second, and posed on every step.
//
//   m3cut     runs at 6 m/s and cuts at 1.2 s        &ang=80 (degrees, + to his left)  &v=6
//   m3stop    runs flat out and stops at 1.2 s        &v=7.2
//   m3arrive  runs to a spot and pulls up on it, as the sim's players arrive (4 x the distance left)
//   m3zig     three cuts in a row, left and right
//   m3side    a defender side-steps one way, then back, facing the ball        &v=2.4
//   m3back    a defender backs off from the ball, stops, comes forward        &v=2.4
//   &old=1 shows any of them as they were before (m.plain: no footwork, no recorded slide).
//   each also ...front (from ahead of where he starts) and ...top.  &rate=0.25 slows it.
import { strideRate } from '../rules/dribble.js';
import { animate, placeModel } from '../game/actors.js';

const SIM = 1 / 72, D = Math.PI / 180;
const KINDS = ['m3cut', 'm3stop', 'm3arrive', 'm3zig', 'm3side', 'm3back'], VIEWS = ['', 'front', 'top'];
// [from this time, speed, heading (degrees from +x, + toward -z: his left as he runs along +x)]
const SCRIPT = {
  m3cut: q => [[0, +(q.get('v') ?? 6), 0], [1.2, +(q.get('v') ?? 6), +(q.get('ang') ?? 80)]],
  m3stop: q => [[0, +(q.get('v') ?? 7.2), 0], [1.2, 0, 0]],
  m3zig: q => [[0, 6, 0], [1.0, 6, 70], [1.7, 6, -30], [2.4, 6, 60]],
  m3side: q => [[0, 0, 90], [0.5, +(q.get('v') ?? 2.4), 90], [2.0, +(q.get('v') ?? 2.4), -90], [3.5, 0, 0]],
  m3back: q => [[0, 0, 180], [0.5, +(q.get('v') ?? 2.4), 180], [2.4, 0, 180], [3.0, 3.5, 0]],
};

// One row per step: { p: the player as the sim would have him, ball }.
export function moveLog(kind, q = new Map()) {
  const log = [], def = kind === 'm3side' || kind === 'm3back', p = { x: -7, z: 0, vx: 0, vz: 0, fx: 1, fz: 0, stride: 0.6, role: def ? 'def' : 'mate' };
  const keys = kind === 'm3arrive' ? null : SCRIPT[kind](q), accel = +(q.get('accel') ?? 18), T = +(q.get('len') ?? 4.5);
  if (keys && keys[0][1] > 0) { p.vx = keys[0][1]; }
  if (kind === 'm3arrive') p.vx = 7;
  for (let t = 0; t < T; t += SIM) {
    let tx = 0, tz = 0;
    if (kind === 'm3arrive') { const d = 2 - p.x, sp = Math.abs(d) < 0.25 ? 0 : Math.min(7, Math.abs(d) * 4); tx = Math.sign(d) * sp; }
    else { let k = keys[0]; for (const c of keys) if (t >= c[0]) k = c; tx = Math.cos(k[2] * D) * k[1]; tz = -Math.sin(k[2] * D) * k[1]; }
    const dx = tx - p.vx, dz = tz - p.vz, d = Math.hypot(dx, dz), st = Math.min(d, accel * SIM);
    if (d > 0) { p.vx += dx / d * st; p.vz += dz / d * st; }
    p.x += p.vx * SIM; p.z += p.vz * SIM;
    const s = Math.hypot(p.vx, p.vz);
    // a defender keeps the ball in front of him (it stays 5 m off, the way he first faced); anyone else faces the way he goes
    const ball = def ? { x: -7 + 5, y: 0.11, z: p.z * (kind === 'm3side' ? 1 : 0), vx: 0, vy: 0, vz: 0 } : { x: 40, y: 0.11, z: 30, vx: 0, vy: 0, vz: 0 };
    if (kind === 'm3back') ball.x = p.x + 5;
    if (def) { const l = Math.hypot(ball.x - p.x, ball.z - p.z) || 1; p.fx = (ball.x - p.x) / l; p.fz = (ball.z - p.z) / l; } else if (s > 0.4) { p.fx = p.vx / s; p.fz = p.vz / s; }
    p.stride += SIM * strideRate(s);
    log.push({ p: { ...p }, ball });
  }
  return log;
}

export function moves3Look(q, { players, ball, bp, camera, shadowOf }) {
  const rate = +(q.get('rate') || 1), logs = {};
  let played = 1e9, cur = '';
  const parse = shot => { for (const view of ['front', 'top', '']) { const kind = view && shot.endsWith(view) ? shot.slice(0, -view.length) : shot; if (KINDS.includes(kind)) return { kind, view: kind === shot ? '' : view }; } return null; };
  const reset = m => { m.gait = m.strike = m.special = m.trick = m.kick = m.inert = m.charge = m.beat = m.drib = m.lock = m.sway = m.fw = m.shuf = null; m.kickK = m.onBallK = m.cheerK = m.driveT = 0; };
  return {
    names: KINDS.flatMap(k => VIEWS.map(v => k + v)),
    active: shot => !!parse(shot),
    pose(shot, t) {
      const { kind, view } = parse(shot), log = logs[kind] ??= moveLog(kind, q), me = players[0].m;
      const now = Math.max(0, Math.min(log.length - 1, Math.round(t * rate / SIM)));
      if (now < played || cur !== kind) { played = -1; cur = kind; reset(me); me.plain = !!q.get('old'); }      // &old=1: as it was before game/footwork.js and game/shuffle.js
      for (const { m } of players) m.root.visible = m.shadow.visible = false;
      me.root.visible = me.shadow.visible = true;
      while (played < now) { played++; const r = log[played]; placeModel(me, r.p); animate(me, r.p, SIM, played * SIM, false, null, r.ball, false); }
      const row = log[now], p = row.p, p0 = log[Math.round(Math.min(log.length - 1, 1.2 / SIM))].p;
      shadowOf(me, { x: me.root.position.x, z: me.root.position.z });
      Object.assign(bp, row.ball); ball.position.set(bp.x, bp.y, bp.z);
      const c = kind === 'm3cut' || kind === 'm3zig' ? { x: p0.x + (p.x - p0.x) * 0.5, z: p0.z + (p.z - p0.z) * 0.5 } : p;
      camera.fov = view === 'top' ? 34 : 30;
      if (view === 'front') { camera.position.set(c.x + 5.2, 1.1, c.z + 0.5); camera.lookAt(c.x, 0.9, c.z); }
      else if (view === 'top') { camera.position.set(c.x - 0.3, 7.5, c.z + 0.01); camera.lookAt(c.x, 0, c.z); }
      else { camera.position.set(c.x + 0.6, 1.0, c.z + 5.2); camera.lookAt(c.x + 0.2, 0.9, c.z); }
      camera.updateProjectionMatrix();
    },
  };
}
