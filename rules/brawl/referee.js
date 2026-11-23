// The referee. Pure. He runs the diagonal (the system real referees use: on a line from one corner flag
// toward the other, keeping play between him and his assistant on the far touchline), 10 to 20 m from the
// ball, a little behind it and wide of it, out of the way. He doesn't touch the ball or anyone. He blows for
// fouls, offside, half and full time, walks over to show cards, signals the free kick's direction or points
// to the spot, and in the brawl waves everything on.
//   w.ref = { x, z, vx, vz, fx, fz, stride, sig: { kind, dir, t, color } | null, queue: [...] }
// Signal kinds (game/brawl/refpose.js poses them): whistle, free, indirect, penalty, card, advantage,
// halftime, fulltime. Pushes events: signal { kind, dir, color }.
import { REF } from './tuning.js';
import { dirOf } from './world.js';
import { strideRate } from '../dribble.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const unit = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };

export function createRef(w) {
  w.ref = { id: 'ref', role: 'mate', line: 'ref', state: 'up', x: -10, z: 4, vx: 0, vz: 0, fx: 1, fz: 0, stride: 0, sig: null, queue: [], to: null, calm: 0 };
  return w.ref;
}

// Queue a signal. dir: world unit vector (the way the free kick goes, at the player, to the spot).
function signal(r, kind, dir = null, extra = {}) {
  r.queue.push({ kind, dir: dir || { x: r.fx, z: r.fz }, t: 0, ...extra });
}

// The referee's reaction to this step's events.
export function refEvents(w, ev) {
  const r = w.ref;
  if (!r) return;
  for (const e of ev) {
    if (e.type === 'whistle') {
      const on = w.byId[e.on], by = w.byId[e.by];
      r.to = { x: on.x, z: on.z, near: 6 };
      r.queue = [];
      signal(r, 'whistle');
      r.pending = { kind: e.kind, team: on.team, by: by.id };
    } else if (e.type === 'card') {
      const p = w.byId[e.id];
      signal(r, 'card', unit(p.x - r.x, p.z - r.z), { color: e.color, at: p.id });
    } else if (e.type === 'setpiece' && r.pending && (e.kind === 'free' || e.kind === 'penalty')) {
      // after the card (if any): which way the free kick goes, or the spot
      const d = e.kind === 'penalty' ? unit(e.x - r.x, e.z - r.z) : { x: 0, z: dirOf(w, e.team) };
      signal(r, e.kind === 'penalty' ? 'penalty' : 'free', d);
      r.pending = null;
    } else if (e.type === 'offside') {
      r.queue = []; signal(r, 'whistle'); signal(r, 'indirect', { x: r.fx, z: r.fz });
    } else if (e.type === 'halftime' || (e.type === 'fulltime' && !e.pens)) {
      r.queue = []; signal(r, 'whistle'); signal(r, e.type, unit(-r.x, -r.z));
    } else if (e.type === 'kickoff' || e.type === 'taking') {
      if (!r.sig && !r.queue.length) signal(r, 'whistle');
    } else if (e.type === 'launch' && w.brawl && e.kind !== 'domino' && r.calm <= 0) {
      // the brawl: nothing to see here, play on
      const b = w.ball; signal(r, 'advantage', unit(b.vx || r.fx, b.vz || r.fz)); r.calm = REF.calm;
    }
  }
}

// Where he wants to be: on his diagonal, behind and wide of the ball, never too near it.
export function refSpot(w) {
  const b = w.ball, r = w.ref, att = w.owner ? dirOf(w, w.byId[w.owner].team) : Math.sign(b.vz) || 1;
  const z = clamp(b.z - att * REF.behind, -w.L + 8, w.L - 8);
  const x = clamp((z / w.L) * w.W * REF.diag, -w.W + 4, w.W - 4);
  const t = { x, z };
  // keep his distance from the ball
  const dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz);
  if (d < REF.near) { const u = d > 0.1 ? unit(dx, dz) : { x: -Math.sign(b.x || 1), z: 0 }; t.x = b.x + u.x * REF.near; t.z = b.z + u.z * REF.near; }
  if (d > REF.far) { const u = unit(dx, dz); t.x = b.x + u.x * REF.far; t.z = b.z + u.z * REF.far; }
  if (r.to) return r.to;
  return t;
}

// One step: signals play out (he stands for a card), otherwise he moves toward his spot facing play.
export function stepRef(w, dt) {
  const r = w.ref;
  if (!r) return;
  if (r.calm > 0) r.calm -= dt;
  if (!r.sig && r.queue.length) { r.sig = r.queue.shift(); r.sig.t = 0; }
  let stand = false;
  if (r.sig) {
    r.sig.t += dt;
    if (!r.sig.sent) { r.sig.sent = true; r.events = [...(r.events || []), { type: 'signal', kind: r.sig.kind, dir: r.sig.dir, color: r.sig.color }]; }
    stand = r.sig.kind === 'card';
    if (r.sig.t >= (REF.sig[r.sig.kind] || 1.5)) r.sig = null;
  }
  const t = refSpot(w);
  let vx = 0, vz = 0;
  if (!stand) {
    const dx = t.x - r.x, dz = t.z - r.z, d = Math.hypot(dx, dz), near = t.near || 0.3;
    if (d > near) { const sp = Math.min(d > 12 ? REF.run : REF.jog, (d - near) * 1.6 + 0.6); vx = dx / d * sp; vz = dz / d * sp; }
    else if (r.to) r.to = null;
  }
  const k = Math.min(1, REF.accel * dt);
  r.vx += (vx - r.vx) * k; r.vz += (vz - r.vz) * k;
  r.x += r.vx * dt; r.z += r.vz * dt;
  // he faces the play (the ball), or the man he's booking
  const look = r.sig && r.sig.kind === 'card' ? r.sig.dir : unit(w.ball.x - r.x, w.ball.z - r.z);
  const ft = Math.min(1, 6 * dt);
  r.fx += (look.x - r.fx) * ft; r.fz += (look.z - r.fz) * ft;
  const l = Math.hypot(r.fx, r.fz) || 1; r.fx /= l; r.fz /= l;
  r.stride += dt * strideRate(Math.hypot(r.vx, r.vz));
}

// Signal events gathered while stepping (for the page and the commentator): taken once.
export function refSignals(w) { const e = (w.ref && w.ref.events) || []; if (w.ref) w.ref.events = []; return e; }
