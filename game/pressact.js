// What each press photographer at the trophy presentation is doing, and when (game/presscast.js poses it). Pure:
// no three.js, unit tested (tests/unit/pressact.test.js). Built from how the job is done, not captured:
// - they shoot in bursts with the camera at the eye and, between bursts, drop it to the chest and look down at
//   the screen for a second or two ("chimping": checking the frame, the focus, the exposure), then back up;
// - they keep re-framing (small quick shifts) and now and then swing off the main subject to someone else and back;
// - on their feet they stand with one foot half a pace ahead and shift their weight from leg to leg, or lean out
//   to one side to shoot past the man in front;
// - the front row works low (on one knee) so the row behind can shoot over them; some of the back row hold the
//   camera up over the heads in front and shoot blind (a "Hail Mary");
// - when the moment comes (the cup goes up) everybody is on it at once: nobody is checking a screen, a kneeler
//   gets up for the angle;
// - they move for position: two of the back row change places, one going round behind the other, cameras down.
// Sources: camera makers' how-to-hold guides (left hand cradling the lens from underneath, elbows in against the
// body, one foot half a pace ahead) and press photographers' accounts of working in a pack; the timings are guesses.
// Stage frame: they face +z (toward you); x is along the row.

export const PRESS = [
  { x: -2.3, z: -2.5, kind: 'kneel' }, { x: 0.15, z: -2.6, kind: 'kneel', cap: true, flip: true }, { x: 2.35, z: -2.5, kind: 'kneel', rises: true },
  { x: -3.4, z: -3.05, kind: 'stand', cap: true }, { x: -1.1, z: -3.15, kind: 'over' }, { x: 1.2, z: -3.1, kind: 'stand', swap: 6 }, { x: 3.5, z: -3.05, kind: 'over', cap: true, flip: true, swap: 5 },
];
export const ACT = { chest: 0.4, kneel: 1.15, speed: 0.75, behind: 0.55, swapAt: 5, swapEvery: 26, riseAt: 11, riseEvery: 24, riseFor: 7 };
// other people worth a frame while nothing is happening: the squad on the stage (x, y, z)
const OTHERS = [[-2.2, 2.1, 1.2], [2.2, 2.1, 1.2], [-1.2, 2.5, 2.6], [1.2, 2.5, 2.6], [0, 2.5, 2.66]];

const rng = seed => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const ease = (v, to, dt, rate) => v + (to - v) * Math.min(1, dt * rate);
const toward = (v, to, step) => (Math.abs(to - v) <= step ? to : v + Math.sign(to - v) * step);
export const smooth = x => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

export function createActs(list = PRESS, seed = 1) {
  return list.map((p, i) => {
    const r = rng(seed * 31 + i * 7 + 3);
    return { ...p, i, r, home: [p.x, p.z], px: p.x, pz: p.z, vx: 0, vz: 0, moving: false, from: null, go: 0,
      act: 'shoot', left: 1.5 + r() * 4, react: 0, quiet: 0,
      chest: 0, down: 0, over: p.kind === 'over' ? 1 : 0, wantOver: p.kind === 'over', kneel: p.kind === 'kneel' ? 1 : 0, standT: 0, lean: 0, leanTo: 0, side: 0, sideT: r() * 6,
      aim: null, nudge: [0, 0], nudgeT: 0 };
  });
}

// s: { up: the cup is over your head }. Advances every man; presscast reads: px, pz, vx, vz, chest (camera down at
// the chest 0..1), down (head down at the screen 0..1), over (camera overhead 0..1), kneel (0 standing .. 1 on one
// knee), lean (-1..1, out to one side), side (-1..1: which leg his weight is on), aim (null: the cup, or a point),
// nudge (a small re-framing offset, radians).
export function stepActs(men, dt, t, s) {
  const st = men.st || (men.st = { up: false, upT: 99, swapT: ACT.swapAt, riseT: ACT.riseAt });
  if (s.up && !st.up) { st.upT = 0; for (const a of men) { a.react = 0.1 + a.r() * 0.4; a.quiet = 3.5 + a.r() * 2.5; } }
  st.up = !!s.up; st.upT += dt;
  // the pair who change places (not in the first seconds of a lift: nobody walks off then)
  st.swapT -= dt;
  const pair = men.filter(a => a.swap !== undefined);
  if (st.swapT <= 0 && pair.length === 2 && st.upT > 4 && !pair.some(a => a.moving)) {
    st.swapT = ACT.swapEvery;
    const [a, b] = pair, ha = a.home, hb = b.home;
    a.from = [a.px, a.pz]; b.from = [b.px, b.pz]; a.home = [hb[0], ha[1]]; b.home = [ha[0], hb[1]];   // each keeps his own depth
    a.moving = b.moving = true; a.go = b.go = 0; a.behind = 1; b.behind = 0;
  }
  st.riseT -= dt;
  for (const a of men) {
    // the moment: everyone back on the cup, a beat apart
    if (a.react > 0) { a.react -= dt; if (a.react <= 0) { a.act = 'shoot'; a.left = a.quiet; a.aim = null; a.leanTo = 0; if (a.kind === 'over') a.wantOver = true; if (a.rises) a.standT = Math.max(a.standT, 6); } }
    a.quiet = Math.max(0, a.quiet - dt);
    a.left -= dt;
    if (a.left <= 0 && !a.moving) {
      if (a.act !== 'shoot') { a.act = 'shoot'; a.left = (st.up ? 4 : 2.5) + a.r() * 3.5; a.aim = null; a.leanTo = 0; }
      else {
        const k = a.r(), standing = a.kneel < 0.05;
        if (k < 0.42 && a.quiet <= 0) { a.act = 'chimp'; a.left = 1.3 + a.r() * 1.1; }
        else if (k < 0.62 && !st.up) { a.act = 'look'; a.left = 1.2 + a.r() * 1.3; a.aim = OTHERS[Math.floor(a.r() * OTHERS.length)]; }
        else if (k < 0.85 && standing) { a.act = 'lean'; a.left = 2.5 + a.r() * 2; a.leanTo = a.r() < 0.5 ? -1 : 1; }
        else if (a.kind === 'over' && a.quiet <= 0) { a.act = 'level'; a.left = 3 + a.r() * 2.5; a.wantOver = !a.wantOver; }
        else a.left = 1 + a.r() * 2;
      }
    }
    if (a.act === 'shoot' && a.kind === 'over' && st.up) a.wantOver = true;
    // the kneeler who gets up: for the lift, and now and then on his own
    if (a.rises) {
      if (st.riseT <= 0) { a.standT = ACT.riseFor; }
      if (st.up) a.standT = Math.max(a.standT, 2);
      a.standT = Math.max(0, a.standT - dt);
      a.kneel = toward(a.kneel, a.standT > 0 ? 0 : 1, dt / ACT.kneel);
    }
    // walking to a new place: along the row, the one who goes behind swinging out toward the boards
    if (a.moving) {
      const d = Math.hypot(a.home[0] - a.from[0], a.home[1] - a.from[1]) || 1, was = a.go;
      a.go = Math.min(1, a.go + dt * ACT.speed / d * (0.25 + 0.75 * Math.sin(Math.PI * a.go)));          // off slowly, 0.75 m/s in the middle, slowing in
      const k = a.go, x = a.from[0] + (a.home[0] - a.from[0]) * k, z = a.from[1] + (a.home[1] - a.from[1]) * k - (a.behind ? ACT.behind * Math.sin(Math.PI * k) : 0);
      a.vx = (x - a.px) / dt; a.vz = (z - a.pz) / dt; a.px = x; a.pz = z;
      if (a.go >= 1 && was >= 1) { a.moving = false; a.vx = a.vz = 0; a.act = 'shoot'; a.left = 2 + a.r() * 3; }
    } else { a.vx = a.vz = 0; }
    const carry = a.moving || (a.rises && a.kneel > 0.08 && a.kneel < 0.92);        // camera down while he walks or gets up
    a.chest = toward(a.chest, a.act === 'chimp' || carry ? 1 : 0, dt / ACT.chest);
    a.down = toward(a.down, a.act === 'chimp' ? 1 : 0, dt / 0.3);
    a.over = toward(a.over, a.wantOver && !carry && a.act !== 'chimp' ? 1 : 0, dt / 0.6);
    a.lean = ease(a.lean, a.moving ? 0 : a.leanTo, dt, 2.2);
    // weight from one leg to the other every few seconds
    a.sideT -= dt; if (a.sideT <= 0) { a.sideT = 3 + a.r() * 5; a.sideTo = a.sideTo > 0 ? -1 : 1; }
    a.side = ease(a.side, a.sideTo || 0, dt, 1.6);
    // re-framing: a small quick shift of the aim every second or two
    a.nudgeT -= dt; if (a.nudgeT <= 0) { a.nudgeT = 0.9 + a.r() * 2.2; a.nudge = [(a.r() - 0.5) * 0.09, (a.r() - 0.5) * 0.06]; }
  }
  if (st.riseT <= 0) st.riseT = ACT.riseEvery;
  return men;
}
