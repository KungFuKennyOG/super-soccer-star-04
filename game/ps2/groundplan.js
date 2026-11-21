// Where everything in a ground goes, worked out from its recipe in game/grounds.js (the same recipes
// the PS1 grounds are built from; nothing here changes them). Pure numbers, no three.js, so it is
// tested in Node (tests/unit/groundplan.test.js). game/ps2/ground.js builds the '04-look ground from it.
//
// A stand's own frame: x along its length, its front wall at z = 0, rising away from the pitch toward
// -z. A stand's profile is the cross-section: tiers, the fascia between them, the back wall, the roof.
import { GOAL, PITCH } from '../../rules/tuning.js';

export const FRONT = 1.2;           // the front wall's height (the first row sits just above it)
export const ROW = 0.8;             // one row of seats, front to back (m)
export const SEAT = 0.6;            // one fan's width (m)

// tiers: [[depth, rise], ...] as in the recipes. The next tier hangs over the back 40% of the one
// below with a 1.6 m fascia under its front, exactly as game/grounds.js lays them out.
export function profile(tiers, roof) {
  const out = { tiers: [], fascias: [], soffits: [] };
  let y = FRONT, z = 0;
  tiers.forEach(([depth, rise], i) => {
    const rows = Math.max(1, Math.round(depth / ROW));
    out.tiers.push({ y0: y, z0: z, y1: y + rise, z1: z - depth, rows });
    const top = y + rise;
    if (i < tiers.length - 1) {
      const nz = z - depth * 0.6, ny = top + 1.6;
      out.fascias.push({ z: nz, y0: ny - 1.6, y1: ny });
      // the underside of the tier above, from its fascia back to the top of the tier below's back wall
      out.soffits.push({ z0: nz, y0: ny - 1.6, z1: z - depth, y1: top + 1.4, lowTop: top });
      y = ny; z = nz;
    } else {
      out.top = top;
      out.back = z - depth - 0.3;                                  // the back wall's face
      out.depth = depth - z;                                       // front wall to the back of the last tier
    }
  });
  out.wallTop = out.top + 3;
  if (roof && roof !== 'none') {
    const span = roof === 'full' ? out.depth + 2 : out.depth * 0.55;
    out.roof = { y: out.top + 4, zBack: -(out.depth + 0.6), zFront: -(out.depth + 0.6) + span, span };
  }
  return out;
}

// The outline of a stand's end wall (gable) in its own (z, y): the ground, up the front wall, along the
// tiers and fascias, the back wall. y never falls as z goes back, so a fan from the back corner fills it.
export function gable(p) {
  const pts = [[0, 0], [0, FRONT]];
  p.tiers.forEach((t, i) => {
    const f = p.fascias[i];
    if (f) { const k = (f.z - t.z0) / (t.z1 - t.z0); pts.push([f.z, t.y0 + (t.y1 - t.y0) * k], [f.z, f.y1]); }
    else pts.push([t.z1, t.y1]);
  });
  pts.push([p.back, p.wallTop], [p.back, 0]);
  return pts;
}

// The whole ground. Stands: end (behind the goal), left and right sides, near (behind you), and
// corner sweeps round the meeting point of the stands either side. Fields the PS1 builder doesn't read
// (all optional): left / right (a side's own tiers), roofOn (which stands have a roof), corners as a
// list ('endL', 'endR', 'nearL', 'nearR'), cornerFill: 'block' (buildings instead of seats), kop
// (the home end packed end to end; the away fans move behind you), towers as a count (ramp towers
// round the outside) or 'access' (four corner stair towers).
export const CORNERS = { endL: [-1, 'end', 0, Math.PI / 2, 'left'], endR: [1, 'end', 0, -Math.PI / 2, 'right'], nearL: [-1, 'near', Math.PI / 2, Math.PI, 'left'], nearR: [1, 'near', -Math.PI / 2, -Math.PI, 'right'] };
export function planGround(recipe) {
  const W = PITCH.halfW, gap = recipe.gap;
  const endZ = GOAL.z - 3.4 - gap, sideX = W + 1.8 + gap, nearZ = 7 + gap, midZ = (GOAL.z + 7) / 2;
  const roofed = id => !recipe.roofOn || recipe.roofOn.includes(id);
  const tiersOf = id => (id === 'left' || id === 'right' ? recipe[id] || recipe.side : recipe[id]);
  const stand = (id, len, x, z, yaw, o = {}) => ({ id, len, x, z, yaw, tiers: tiersOf(id), p: profile(tiersOf(id), roofed(id) ? recipe.roof : 'none'), ...o });
  const stands = [
    stand('end', 2 * sideX, 0, endZ, 0, { isEnd: true }),
    stand('left', nearZ - endZ, -sideX, midZ, Math.PI / 2),
    stand('right', nearZ - endZ, sideX, midZ, -Math.PI / 2),
    stand('near', 2 * sideX, 0, nearZ, Math.PI),
  ];
  const which = recipe.corners === true ? Object.keys(CORNERS) : Array.isArray(recipe.corners) ? recipe.corners : [];
  const corners = which.map(k => { const [sx, at, a0, a1, side] = CORNERS[k]; return { id: k, x: sx * sideX, z: at === 'end' ? endZ : nearZ, a0, a1, side, block: recipe.cornerFill === 'block', tiers: tiersOf(side), p: profile(tiersOf(side), roofed(side) ? recipe.roof : 'none') }; });
  const topY = Math.max(...stands.map(s => s.p.top), ...corners.map(c => c.p.top));
  // the scoreboard (and big screen) hangs as game/grounds.js hangs it: under the end's roof edge, or over an open end
  const e = stands[0].p;
  let board;
  if (e.roof) board = { y: e.top + 3.7 - 4.2, z: endZ + e.roof.zFront + 0.6 };
  else board = { y: e.top + 7, z: endZ + e.back - 0.7 };
  const lights = { kind: recipe.lights, pylons: [], aim: [0, 0, GOAL.z + 16] };
  if (recipe.lights === 'pylons') for (const [x, z] of [[-sideX - 12, endZ - 10], [sideX + 12, endZ - 10], [-sideX - 12, nearZ + 6], [sideX + 12, nearZ + 6]]) lights.pylons.push({ x, z, h: topY + 16 });
  // towers outside the stands: the four corners, then along the sides and ends
  let towers = [];
  if (recipe.towers === 'access') towers = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => { const d = (-stands[1].p.back + 5) * Math.SQRT1_2; return { x: a * (sideX + d), z: b < 0 ? endZ - d : nearZ + d, r: 4.5, h: topY - 2 }; });
  else if (recipe.towers) {
    const n = recipe.towers === true ? 4 : recipe.towers, ox = sideX - stands[1].p.back + 4, z0 = endZ + e.back - 4, z1 = nearZ - stands[3].p.back + 4;
    const ring = [[-ox, z0], [ox, z0], [-ox, z1], [ox, z1], [0, z0 - 2], [-ox - 2, (z0 + z1) / 2], [ox + 2, (z0 + z1) / 2], [-ox * 0.5, z0 - 1], [ox * 0.5, z0 - 1], [-ox * 0.5, z1 + 1], [ox * 0.5, z1 + 1]];
    towers = ring.slice(0, n).map(([x, z], i) => ({ x, z, r: 3, h: topY + (i < 4 ? 9 : 1) }));
  }
  // a running track: the band between the pitch's surround and the stands (a rounded oval)
  const track = recipe.track ? { inX: W + 4, inZ0: GOAL.z - 6, inZ1: 3, outX: sideX - 0.3, outZ0: endZ + 0.3, outZ1: nearZ - 0.3 } : null;
  // ad boards round the half pitch, as game/stadium.js stands them
  const boards = { x: W + 1.6, z: GOAL.z - 3.2, len: 6, h: 0.9 };
  // the home end's curva and the away block, as fractions along the end stand (game/grounds.js); a kop
  // end is home fans end to end, and the away fans are in the stand behind you
  const curva = recipe.kop ? { from: -0.47, to: 0.47 } : { from: -0.36, to: 0.1 }, block = { from: 0.15, to: 0.5, on: recipe.kop ? 'near' : 'end' };
  return { W, gap, endZ, sideX, nearZ, midZ, stands, corners, topY, board, lights, towers, track, boards, curva, block };
}
