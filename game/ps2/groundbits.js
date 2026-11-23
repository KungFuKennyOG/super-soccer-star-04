// The rest of an '04-look ground: floodlight pylons (lattice towers with a bank of lamps aimed at
// the pitch), lamps on poles along an open stand's top, Milan's ramp towers, the pitchside ad boards
// and the TV gantry. All of it goes into the ground's structure, lattice and glow meshes.
import * as THREE from 'three';
import { frameAt } from './groundgeo.js';
import { region, adRegion } from './groundtex.js';
import { straightRun, strip } from './ground.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export function lightsAndBits(G, L, glow, plan, recipe) {
  const out = { pylons: plan.lights.pylons.length, lamps: 0 };
  const [ax, , az] = plan.lights.aim;
  // floodlight pylons: four lattice faces tapering from 3.2 m to 1 m, a head of 4 x 2 lamp boxes
  for (const { x, z, h } of plan.lights.pylons) {
    const yaw = Math.atan2(ax - x, az - z), f = frameAt(x, z, yaw);
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = c[k], [x1, z1] = c[(k + 1) % 4], b = 1.6, t = 0.5;
      const pts = [f(x0 * b, 0, z0 * b), f(x1 * b, 0, z1 * b), f(x1 * t, h - 1.5, z1 * t), f(x0 * t, h - 1.5, z0 * t)];
      L.poly(pts, [[0, 0], [0, 1], [h / 2.6, 1], [h / 2.6, 0]], { reg: region('lattice'), color: [0.75, 0.76, 0.8] });
    }
    // the head, tipped down toward the pitch: a dark frame and the lamps' faces
    const hy = h + 0.5, tilt = 0.45;
    G.box(f, [0, hy, -0.5], [7.4, 4.2, 0.6], { reg: region('dark'), uv: [0, 0, 2, 1] });
    for (let r = 0; r < 2; r++) for (let q = 0; q < 4; q++) {
      const cx = -2.7 + q * 1.8, cy = hy - 1 + r * 2, s = 0.8, dz = Math.sin(tilt) * s;
      G.quad(f(cx - s, cy - s * 0.95, -0.15 + dz), f(cx + s, cy - s * 0.95, -0.15 + dz), f(cx + s, cy + s * 0.95, -0.15 - dz), f(cx - s, cy + s * 0.95, -0.15 - dz), { reg: region('lamp'), uv: [0, 0, 1, 1], glow: 1, face: f(cx, cy - 3, 10) });
      glow.add(f(cx, cy, 0.6), 2.6); out.lamps++;
    }
    glow.add(f(0, hy, 1.5), 11);
  }
  // an open stand with lamps along its top: poles every 8 m, a lamp box on each
  if (plan.lights.kind === 'roof') for (const s of plan.stands) {
    if (s.p.roof) continue;
    const run = straightRun(s.x, s.z, s.yaw, s.len), p = s.p, n = Math.max(2, Math.round(s.len / 8));
    for (let k = 0; k < n; k++) {
      const lx = -s.len / 2 + (k + 0.5) * s.len / n, top = p.wallTop;
      G.box(run.f, [lx, top + 3, p.back - 0.15], [0.35, 6, 0.35], { reg: region('concrete'), uv: [0, 0, 0.2, 2] });
      const y = top + 6.3, zf = p.back + 0.5;
      G.quad(run.f(lx - 1.1, y - 0.6, zf + 0.25), run.f(lx + 1.1, y - 0.6, zf + 0.25), run.f(lx + 1.1, y + 0.6, zf - 0.25), run.f(lx - 1.1, y + 0.6, zf - 0.25), { reg: region('lamp'), uv: [0, 0, 1.5, 0.75], glow: 1, face: run.f(lx, y - 4, 20) });
      G.box(run.f, [lx, y, zf - 0.45], [2.4, 1.4, 0.5], { reg: region('dark'), uv: [0, 0, 1, 1] }, 'all');
      glow.add(run.f(lx, y, zf + 1), 3.2); out.lamps++;
    }
  }
  // Milan's towers: spiral ramps round a drum at each corner
  for (const { x, z, r, h } of plan.towers) {
    const n = 14;
    for (let k = 0; k < n; k++) {
      const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, p = a => v(x + Math.sin(a) * r, 0, z + Math.cos(a) * r);
      const A = p(a0), B = p(a1), u0 = k / n * 2 * Math.PI * r / 6, u1 = (k + 1) / n * 2 * Math.PI * r / 6;
      G.poly([A, B, v(B.x, h, B.z), v(A.x, h, A.z)], [[u0, 0], [u1, 0], [u1, h / 6], [u0, h / 6]], { reg: region('helix'), face: v(x + Math.sin((a0 + a1) / 2) * 50, h / 2, z + Math.cos((a0 + a1) / 2) * 50) });
      G.poly([v(x, h, z), v(B.x, h, B.z), v(A.x, h, A.z)], [[0, 0], [1, 0], [0, 1]], { reg: region('concrete'), face: v(x, h + 10, z) });
    }
  }
  // the ad boards round the half pitch (as game/stadium.js stands them), lit a little at night
  const { x: BX, z: BZ, len: BL, h: BH } = plan.boards;
  let i = 0;
  const board = (x, z, yaw) => {
    const f = frameAt(x, z, yaw);
    G.box(f, [0, BH / 2, -0.08], [BL - 0.1, BH, 0.12], { reg: region('dark'), uv: [0, 0, 1, 1] });
    G.quad(f(-BL / 2 + 0.05, 0.02, -0.015), f(BL / 2 - 0.05, 0.02, -0.015), f(BL / 2 - 0.05, BH, -0.015), f(-BL / 2 + 0.05, BH, -0.015), { reg: adRegion(i++), uv: [0, 0, 1, 1], glow: 0.22, face: f(0, 0.5, 5) });
  };
  for (let x = -BX + BL / 2; x < BX; x += BL) board(x, BZ, 0);
  for (let z = BZ + BL / 2; z < (plan.boards.full ? -BZ : 4); z += BL) { board(-BX, z, Math.PI / 2); board(BX, z, -Math.PI / 2); }
  if (plan.boards.full) for (let x = -BX + BL / 2; x < BX; x += BL) board(x, -BZ, Math.PI);      // a whole pitch: the other end's boards
  // the TV gantry under the left stand's roof (where the replay camera films from)
  const left = plan.stands[1];
  if (left.p.roof) {
    const run = straightRun(left.x, left.z, left.yaw, left.len), y = left.p.roof.y + 0.6 - 2.6, zf = left.p.roof.zFront + 0.4;
    G.box(run.f, [0, y, zf - 1], [8, 1.6, 2], { reg: region('cladding'), uv: [0, 0, 2, 1], color: [0.55, 0.57, 0.6] });
    strip(L, { ...run, len: 8, pt: (t, lz, yy) => run.f(-4 + t * 8, yy, lz), at: () => 8 }, 0, 1, [zf, y - 0.8], [zf, y - 1.6], { reg: region('rail'), tile: [2, 0.8], face: 'pitch' });
  }
  return out;
}
