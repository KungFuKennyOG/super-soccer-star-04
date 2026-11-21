// Shots for the look page (tools/ps2look.html) of two things, both played by the real sim step by step, with
// the page doing what game/main.js does with its events:
//
//   a2shot   you run with the ball, hold the trigger (the shot charges) and let go: the charge, the wind-up, the
//            strike, the run-off.  &speed=stand|walk|jog|sprint (default jog)  &hold=0.5 (s held)  &at=1.0 (s the
//            trigger goes down; move it to let go on another part of the stride)  &kind=pass (the pass ring)
//            &cancel=1 (the trigger is let go of with nothing struck)  &replay=1 (as a goal replay plays it: the
//            whole approach, his run brought into step for it; game/replay.js)
//   a2beat   you run at a defender who comes to meet you and beat him: &move=stepover|stepoverin|roulette|nutmeg|
//            rainbow|drag|miss (default stepover; miss: you knock it past as he goes in)  &n=1|2|3 another run
//            (his seed, the side you go)
//   each also ...front, ...back, ...top and ...you (through your own eyes, your own first-person boots:
//   &look=down|ahead). &rate=0.25 plays it at a quarter speed (FILM=4 then films one second of it at 120 frames a
//   second). The trigger is let go at `at + hold`; a2beat's move is at 1.2 s.
import * as THREE from 'three';
import { createWorld, stepSim } from '../rules/sim.js';
import { perfectTime } from '../rules/pass.js';
import { GOAL } from '../rules/tuning.js';
import { animate, placeModel, buildYou } from '../game/actors.js';
import { startStrike, struck } from '../game/strike.js';
import { beaten } from '../game/beaten.js';
import { APPROACH, slideAt, slideTo } from '../game/replay.js';

const SIM = 1 / 72, MOVE = { stand: 0, walk: 0.28, jog: 0.62, sprint: 1 };
const VIEWS = ['', 'front', 'back', 'top', 'you'], KINDS = ['a2shot', 'a2beat'];
const unit = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };
// the sim's pitch on the page: he runs toward the sim's goal (-z), which is +x past the main stand here
const P = o => ({ x: -o.z - 14, z: o.x, vx: -o.vz, vz: o.vx, fx: -o.fz, fz: o.fx, stride: o.stride });
const B = b => ({ x: -b.z - 14, y: b.y, z: b.x, vx: -b.vz, vy: b.vy, vz: b.vx });

// One row per sim step: { ev, you, def (or null), ball, own, charge }.
function shotLog(q) {
  const w = createWorld(() => 0.5), log = [], speed = q.get('speed') || 'jog', mv = MOVE[speed] ?? 0.62, kind = q.get('kind') === 'pass' ? 'pass' : 'shot';
  const at = +(q.get('at') ?? 1), hold = +(q.get('hold') ?? (kind === 'pass' ? perfectTime() : 0.5)), cancel = !!q.get('cancel');
  for (const id of ['d1', 'd2', 'd3']) { w.byId[id].x = 20; w.byId[id].z = -1; w.byId[id].stun = 99; }
  let held = 0;
  for (let t = 0; t < at + hold + 2.2; t += SIM) {
    const it = { move: { x: 0, z: -mv }, facing: { x: 0, z: -1 }, sprint: speed === 'sprint' };
    const down = t >= at - SIM / 2 && t < at + hold - SIM / 2, rel = Math.abs(t - (at + hold)) < SIM / 2;
    held = down ? held + SIM : 0;
    if (down && kind === 'shot') it.charging = true;
    if (rel && !cancel) {
      const eye = { x: w.you.x, y: 1.7, z: w.you.z }, d = new THREE.Vector3(+(q.get('tx') ?? 2) - eye.x, +(q.get('ty') ?? 0.9) - eye.y, GOAL.z - eye.z).normalize();
      if (kind === 'shot') it.shot = { eye, dir: { x: d.x, y: d.y, z: d.z }, holdT: hold }; else it.pass = { holdT: hold, targetId: 'm1' };
    }
    const ev = stepSim(w, it, SIM, () => 0.5);
    if (w.dead) w.dead = false;                         // play on: no restart on the page
    log.push({ ev, you: P(w.you), def: null, ball: B(w.ball), own: w.owner === 'you', charge: down ? { kind, t: held } : null });
  }
  log.note = `${kind} at a ${speed}, held ${hold} s from ${at} s`;
  return log;
}

// You run at a defender and beat him at 1.2 s (or he goes in and you knock it past him).
const MOVES = { stepover: { skill: { move: 'stepover', side: 1 } }, stepoverin: { skill: { move: 'stepover', side: -1 } }, roulette: { skill: { move: 'roulette', side: 1 } },
  nutmeg: { skill: { move: 'nutmeg', side: 1 } }, rainbow: { skill: { move: 'rainbow', side: 1 } }, drag: { drag: true }, miss: { knock: true } };
function beatLog(q) {
  const name = MOVES[q.get('move')] ? q.get('move') : 'stepover', act = MOVES[name], n = +(q.get('n') || 1), w = createWorld(() => 0.5), log = [];
  for (const id of ['d2', 'd3']) { w.byId[id].x = 20; w.byId[id].z = 20; w.byId[id].stun = 99; }
  // he starts goal-side of you and comes; where he starts is found so that he is on you as the move comes
  const d = w.byId.d1, gap = +(q.get('gap') ?? { nutmeg: 5.2, miss: 7.5, rainbow: 7.2 }[name] ?? 7), off = [0, 0.5, -0.9][(n - 1) % 3];
  w.you.x = 0; w.you.z = -4; w.ball.x = 0; w.ball.z = -4.6; d.x = off; d.z = -4 - gap;
  const T = 1.2;
  let did = false;
  for (let t = 0; t < 4.2; t += SIM) {
    const dist = Math.hypot(d.x - w.you.x, d.z - w.you.z), go = !did && t >= T - SIM / 2;
    const side = n % 2 ? 1 : -1, after = did ? t - T : -1;
    // after the move you go on past him (to one side for the moves that don't carry you themselves)
    const mx = after > 0 && after < 0.5 && (name === 'nutmeg' || name === 'miss' || name === 'drag') ? side * 0.8 : 0;
    const it = { move: { x: mx, z: name === 'drag' && after > 0 && after < 0.25 ? 0 : -0.75 }, facing: { x: 0, z: -1 }, sprint: after > 0.3, ...(go ? act : {}) };
    if (go) did = true;
    const ev = stepSim(w, it, SIM, () => 0.5);
    if (w.dead) w.dead = false;
    if (w.owner && w.owner !== 'you') { w.owner = 'you'; }       // (he wins it some runs: for the camera the ball stays yours)
    log.push({ ev, you: P(w.you), def: { ...P(d), stun: d.stun, tackleT: d.tackleT, role: 'def' }, ball: B(w.ball), own: w.owner === 'you', charge: null, dist });
  }
  log.note = `${name}, run ${n}: ${log[Math.round(T / SIM)].dist.toFixed(1)} m apart at the move`;
  return log;
}

export function anim2Look(scene, q, { players, ball, bp, camera, kit, shadowOf }) {
  const rate = +(q.get('rate') || 1), logs = {};
  let fp = null, played = 1e9, cur = null;
  const parse = shot => { const m = /^(a2shot|a2beat)(front|back|top|you)?$/.exec(shot); return m && { kind: m[1], view: m[2] || '' }; };
  const you = players[1], def = players[0];
  const reset = m => { m.gait = m.strike = m.special = m.trick = m.kick = m.inert = m.charge = m.beat = m.drib = m.lock = m.sway = null; m.kickK = m.onBallK = m.cheerK = m.driveT = 0; m.stunSeen = 0; };
  // what game/main.js does with the sim's events
  function events(m, row, models, rep) {
    for (const e of row.ev) {
      if (rep && (e.type === 'windup' || e.type === 'kick' || e.type === 'pass')) continue;
      if (e.type === 'windup') startStrike(m, { kind: e.kind, wind: e.t, dir: { x: -e.dir.z, z: e.dir.x }, power: e.power });
      if ((e.type === 'kick' || e.type === 'pass') && e.by === 'you') struck(m, e.type === 'pass' ? 'pass' : 'shot', unit(row.ball.vx, row.ball.vz), e.power ?? 0.5);
      if (e.type === 'launched') struck(m, e.kind, unit(row.you.fx, row.you.fz), 0.5);
      if (e.type === 'knock' || e.type === 'flick' || (e.type === 'skill' && e.move === 'nutmeg')) struck(m, e.type === 'flick' ? 'scoop' : 'poke', Math.hypot(row.ball.vx, row.ball.vz) > 0.5 ? unit(row.ball.vx, row.ball.vz) : unit(row.you.fx, row.you.fz), 0.4);
      if (e.type === 'drag') m.special = { kind: 'drag', t: 0 };
      if (e.type === 'skill') m.special = { kind: e.move, t: 0, side: 1 };
      if ((e.type === 'skill' || e.type === 'drag') && row.def) beaten(models, [{ id: 'd1', ...row.def }], e, row.you);
    }
  }
  return {
    names: KINDS.flatMap(k => VIEWS.map(v => k + v)),
    active: shot => !!parse(shot),
    note: () => (cur ? cur.note : ''),
    hide() { if (fp) fp.root.visible = false; },
    pose(shot, t, dt) {
      const { kind, view } = parse(shot), log = cur = logs[kind] ??= kind === 'a2shot' ? shotLog(q) : beatLog(q);
      const first = view === 'you';
      if (first && !fp) { fp = buildYou(kit, 0); scene.add(fp.root); }
      const me = first ? fp : you.m, now = Math.max(0, Math.min(log.length - 1, Math.round(t * rate / SIM)));
      if (now < played) { played = now - 1; reset(me); reset(def.m); }
      const models = { you: me, d1: def.m };
      // &replay=1: what game/replay.js does with a strike it knows is coming
      const rep = !!q.get('replay') && kind === 'a2shot' && !first;
      if (rep && !log.plan) {
        const i = log.findIndex(r => r.ev.some(e => (e.type === 'kick' || e.type === 'pass') && e.by === 'you')), r = log[i], e = r.ev.find(v => v.type === 'kick' || v.type === 'pass');
        const i0 = Math.max(0, i - Math.round(APPROACH.SWING / SIM)), d = slideTo(log[i0].you.stride);
        log.plan = { i, i0, list: [{ t: i * SIM, from: 0, d }], how: { kind: e.type === 'pass' ? 'pass' : 'shot', wind: APPROACH.SWING, dir: unit(r.ball.vx, r.ball.vz), power: e.power ?? 0.5 } };
      }
      while (played < now) {
        played++; if (played < 0) continue;
        events(me, log[played], models, rep);
        if (rep && played === log.plan.i0) startStrike(me, log.plan.how);
        if (rep && played === log.plan.i) struck(me, log.plan.how.kind, log.plan.how.dir, log.plan.how.power);
      }
      const row = log[now];
      for (const { m } of players) m.root.visible = m.shadow.visible = false;
      if (fp) fp.root.visible = first;
      Object.assign(bp, row.ball); ball.position.set(bp.x, bp.y, bp.z); ball.rotation.set(row.ball.x / 0.11, 0.4, 0);
      const p = { ...row.you, role: 'mate' };
      if (rep) p.stride += slideAt(log.plan.list, now * SIM);
      me.root.visible = true; if (!first) me.shadow.visible = true;
      me.charge = row.charge;
      placeModel(me, p);
      if (Math.hypot(p.vx, p.vz) > 0.5) me.root.rotation.y = Math.atan2(p.vx, p.vz);       // your own legs (and you in a replay) face the way you run
      animate(me, p, dt * rate, t * rate, false, null, bp, row.own);
      if (!first) shadowOf(me, p);
      if (row.def) {
        const d = row.def;
        def.m.root.visible = def.m.shadow.visible = true;
        placeModel(def.m, d); animate(def.m, d, dt * rate, t * rate + 1, false, null, bp, false);
        shadowOf(def.m, d);
      }
      // the camera: on you for a shot, between the two of you when you beat a man
      const c = row.def && !first ? { x: (p.x + row.def.x) / 2, z: (p.z + row.def.z) / 2 } : p, f = kind === 'a2beat' ? 1.5 : 1;
      camera.fov = first ? 96 : view === 'top' ? 34 : 30;
      if (first) {
        const h = Math.atan2(p.vx, p.vz), down = q.get('look') === 'ahead' ? 0.15 : 1.1, hx = Math.hypot(p.vx, p.vz) > 0.5 ? Math.sin(h) : p.fx, hz = Math.hypot(p.vx, p.vz) > 0.5 ? Math.cos(h) : p.fz;
        camera.position.set(p.x, 1.66, p.z); camera.lookAt(p.x + hx * Math.cos(down), 1.66 - Math.sin(down), p.z + hz * Math.cos(down));
      } else if (view === 'front') { camera.position.set(c.x + 4.8 * f, 1.05, c.z + 0.7); camera.lookAt(c.x, 0.9, c.z); }
      else if (view === 'back') { camera.position.set(c.x - 4.4 * f, 1.5, c.z - 0.8); camera.lookAt(c.x + 0.6, 0.85, c.z); }
      else if (view === 'top') { camera.position.set(c.x - 0.4, 7.5 * f, c.z + 0.01); camera.lookAt(c.x, 0, c.z); }
      else { camera.position.set(c.x + 0.9, 1.0, c.z + 4.6 * f); camera.lookAt(c.x + 0.3, 0.9, c.z); }
      camera.updateProjectionMatrix();
    },
  };
}
