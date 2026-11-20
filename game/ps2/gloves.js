// Goalkeeper's gloves for the PS2-look keeper, the kind worn around 2003: a wide elasticated cuff with a
// strap wrapped round it, a padded back of the hand with a moulded panel over the knuckles, a thick latex
// palm that rolls round the sides of the fingers and over their tips ("roll finger"), and fingers about
// twice a bare finger's thickness. They replace the bare hand (limbs.js keeps the arm to the wrist), use
// the same bones (forearm and hand), so every pose drives them unchanged, and are painted on the keeper's
// own kit sheet (in the corner the unused neck patch had), so he stays one mesh and one draw.
// The hand is open, fingers fanned a little and only slightly bent: a keeper's ready hand, not the
// half-closed hanging hand of an outfield player. Marks are invented (a star on the strap).
import * as THREE from 'three';
import { P } from '../body.js';
import { sstep, gauss, hex, fbm, eachPixel, lum } from './paint.js';
import { TURN } from './limbs.js';

// sheet rectangles (on the kit sheet): cuff and palm share one, the four fingers another, the thumb its own
export const GL = { hand: { x: 352, y: 448, w: 96, h: 64 }, finger: { x: 448, y: 448, w: 32, h: 64 }, thumb: { x: 480, y: 448, w: 32, h: 64 } };
const CUFF_V = 0.42;                                   // where the cuff ends and the palm begins on GL.hand

// The hand's own frame: b toward the back of the hand, d down it from the wrist, t toward the thumb.
// The arm hangs with the palm to the body and the thumb forward, turned TURN like the bare hand.
function frame(s) {
  const ax = s * P.shoulderX, wy = P.shoulderY + P.wristDY, c = Math.cos(TURN), sn = Math.sin(TURN);
  const spin = ([x, y, z]) => [x * c - s * z * sn, y, s * x * sn + z * c];
  const dir = ([b, d, t]) => spin([s * b, -d, t]);                         // a direction, world (bind pose)
  const at = p => { const v = dir(p); return [ax + v[0], wy + v[1], v[2]]; };
  return { at, dir, local: p => dir(p) };                                  // local: offset from the wrist joint (= in the hand bone's own frame)
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const less = (a, n) => { const k = dot(a, n); return [a[0] - n[0] * k, a[1] - n[1] * k, a[2] - n[2] * k]; };

// A tube along points in the hand's frame. pts: [{ p: [b, d, t], back, palm, th, lit (half sizes), n, v, w }].
// Each ring stands square across the line; its ax is world x (as the bare hand's), so u on the sheet runs the
// same on both hands: 0 the little-finger edge, 0.25 the palm, 0.5 the thumb edge, 0.75 the back.
function tube(b, s, F, pts, region, opt = {}) {
  const W = pts.map(q => F.at(q.p));
  const rings = pts.map((q, i) => {
    const tan = unit(sub(W[Math.min(i + 1, W.length - 1)], W[Math.max(i - 1, 0)]));
    const x = unit(less(F.dir([s, 0, 0]), tan)), z = unit(less(less(F.dir([0, 0, 1]), tan), x));
    return { c: W[i], ax: x, az: z, rx: s > 0 ? [q.back, q.palm] : [q.palm, q.back], rz: [q.th, q.lit], n: q.n || 2.2, v: q.v, w: q.w, q };
  });
  b.loft(rings, region, { seg: opt.seg || 8, a0: Math.PI, mirror: s < 0, capEnd: opt.capEnd, capStart: opt.capStart, shape: opt.shape });
}
// a bend: the line from p turned toward the palm by curl and fanned toward the thumb by fan, len further on
const step = (p, curl, fan, len) => [p[0] - Math.sin(curl) * len, p[1] + Math.cos(curl) * Math.cos(fan) * len, p[2] + Math.cos(curl) * Math.sin(fan) * len];

// [across the hand (toward the thumb), length, fan (toward the thumb), how much it is bent]
const FINGERS = [[0.039, 0.086, 0.15, 0.85], [0.0135, 0.095, 0.045, 1], [-0.0125, 0.089, -0.065, 1.05], [-0.037, 0.073, -0.19, 1.15]];
const KNUCK = 0.098;                                   // wrist to the knuckles inside the glove

export function glove(b, s, n) {
  const fa = 'foreArm' + n, hd = 'hand' + n, F = frame(s), H = { [hd]: 1 };
  const wrist = p => { const k = sstep(-0.035, 0.012, -(p[1] - (P.shoulderY + P.wristDY))); return { [fa]: 1 - k, [hd]: k }; };   // above the wrist with the forearm
  const f0 = b.pos.length / 3;
  // the cuff: [d, back, palm, thumb side, little-finger side]. Open at the top (turned in), the strap's band
  // standing proud of it from 1 to 4.5 cm up the wrist.
  const CF = [[-0.086, 0.03, 0.03, 0.036, 0.036], [-0.083, 0.038, 0.037, 0.045, 0.044], [-0.07, 0.04, 0.039, 0.047, 0.046], [-0.047, 0.041, 0.04, 0.048, 0.047],
    [-0.044, 0.045, 0.043, 0.051, 0.05], [-0.012, 0.043, 0.042, 0.05, 0.049], [-0.009, 0.039, 0.039, 0.047, 0.046], [0.012, 0.031, 0.034, 0.05, 0.047]];
  tube(b, s, F, CF.map(([d, bk, pm, th, lt], i) => ({ p: [0, d, 0.002], back: bk, palm: pm, th, lit: lt, n: 2.3, v: CUFF_V * i / (CF.length - 1), w: wrist })), GL.hand, { seg: 16 });
  // the hand: flat and broad, padded thick on the palm side, the back's panel raised over the knuckles
  const PM = [[0.006, 0.03, 0.033, 0.05, 0.047, 0], [0.03, 0.027, 0.036, 0.057, 0.05, -0.002], [0.058, 0.026, 0.035, 0.061, 0.052, -0.004],
    [0.084, 0.025, 0.031, 0.062, 0.052, -0.006], [0.104, 0.02, 0.024, 0.06, 0.05, -0.008], [0.113, 0.011, 0.013, 0.05, 0.042, -0.009]];
  const knuckles = (a, r) => { const back = Math.max(0, s * Math.sin(a)); return back ? Object.values(F.dir([0.0055 * back * back * gauss(r.q.p[1], 0.088, 0.022), 0, 0])) : null; };
  tube(b, s, F, PM.map(([d, bk, pm, th, lt, bend], i) => ({ p: [bend, d, 0.002], back: bk, palm: pm, th, lit: lt, n: 2.6, v: CUFF_V + 0.03 + (1 - CUFF_V - 0.04) * i / (PM.length - 1), w: H })), GL.hand, { seg: 16, capEnd: true, shape: knuckles });
  // fingers: each from inside the palm, three joints, only a little bent, fanned apart; a glove finger is a
  // finger in a padded sleeve, about 3 cm across
  for (const [t, len, fan, k] of FINGERS) {
    const r = len < 0.08 ? 0.0138 : 0.0152, pts = [];
    let p = [-0.006, KNUCK - 0.016, t], curl = 0.05;
    pts.push({ p, back: r * 0.95, palm: r * 1.1, th: r * 1.05, lit: r * 1.05, v: 0.02, w: H });
    p = step(p, curl, fan * 0.5, 0.016); pts.push({ p, back: r, palm: r * 1.1, th: r * 1.08, lit: r * 1.08, v: 0.14, w: H });
    [[0.17, 0.46], [0.24, 0.3], [0.16, 0.2]].forEach(([bend, part], j) => {
      curl += bend * k; p = step(p, curl, fan, len * part * (j === 2 ? 0.8 : 1));
      const e = 1 - 0.06 * (j + 1);
      pts.push({ p, back: r * e, palm: r * 1.08 * e, th: r * 1.04 * e, lit: r * 1.04 * e, v: 0.14 + 0.62 * (j + 1) / 3, w: H });
    });
    p = step(p, curl + 0.3, fan, len * 0.07); pts.push({ p, back: r * 0.62, palm: r * 0.72, th: r * 0.7, lit: r * 0.7, v: 0.94, w: H });
    tube(b, s, F, pts, GL.finger, { seg: 10, capEnd: true });
  }
  // the thumb: off the front of the palm low down, well open from the hand (abducted) and turned to face the fingers
  const tp = [[[-0.012, 0.012, 0.042], 0.016, 0.0], [[-0.018, 0.034, 0.06], 0.0175, 0.18], [[-0.026, 0.058, 0.077], 0.0165, 0.45], [[-0.032, 0.08, 0.087], 0.0155, 0.72], [[-0.036, 0.094, 0.09], 0.0105, 0.95]];
  tube(b, s, F, tp.map(([p, r, v]) => ({ p, back: r * 0.92, palm: r * 1.05, th: r, lit: r, v, w: H })), GL.thumb, { seg: 8, capEnd: true });
  b.soft.push([f0, b.pos.length / 3, 0.45]);            // the fingers would shade each other black
}

// The middle of the palm's face, in the hand bone's own frame (bind pose, metres): where a held ball touches.
export function palmPoint(s) { return frame(s).local([-0.038, 0.072, 0.008]); }
// The way the palm faces, in the hand bone's frame.
export function palmNormal(s) { return frame(s).dir([-1, 0, 0]); }

// Where a ball held in both gloves sits (world space, into out, a THREE.Vector3; tmp another): touching both
// palms, as near their midpoint as that allows. Each palm is a plane (its middle, the way it faces); the ball's
// centre is put one radius r off both, at the point of that line nearest the midpoint. Where the palms close
// to less than a ball apart (the chest hug's forearms fold in further than that), it is pushed out along the
// way they open, so the gloves cradle it instead of going through it. For game/main.js holdInGloves once the
// look is wired in, in place of the wrists' midpoint (handsOf), which is 7 cm short of the palms.
const BACK = 0.012, CLEAR = 0.115, UP = new THREE.Vector3();
const PA = [0, 0, 0], PB = [0, 0, 0], NA = [0, 0, 0], NB = [0, 0, 0];
function palmWorld(m, s, P, N, v) {
  const h = m.bone[s > 0 ? 'handL' : 'handR'];
  h.localToWorld(v.set(...palmPoint(s))); P[0] = v.x; P[1] = v.y; P[2] = v.z;
  v.set(...palmNormal(s)).transformDirection(h.matrixWorld); N[0] = v.x; N[1] = v.y; N[2] = v.z;
}
export function gripPoint(m, out, tmp, r = 0.12) {
  m.root.updateMatrixWorld(true);
  palmWorld(m, 1, PA, NA, tmp); palmWorld(m, -1, PB, NB, tmp);
  const mid = [(PA[0] + PB[0]) / 2, (PA[1] + PB[1]) / 2, (PA[2] + PB[2]) / 2];
  // c = mid + a NA + b NB with NA·c = NA·PA + r and NB·c = NB·PB + r
  const k = dot(NA, NB), ea = dot(NA, PA) + r - dot(NA, mid), eb = dot(NB, PB) + r - dot(NB, mid), det = 1 - k * k;
  let a, b;
  if (det > 0.15) { a = (ea - k * eb) / det; b = (eb - k * ea) / det; } else { a = ea / 2; b = eb / 2; }   // (palms near parallel: halfway)
  out.set(mid[0] + a * NA[0] + b * NB[0], mid[1] + a * NA[1] + b * NB[1], mid[2] + a * NA[2] + b * NB[2]);
  // palms facing each other closer than a ball (the chest hug): the ball goes in behind the arms, against his
  // chest, out of the plane his hands and forearms lie in, far enough that palms and cuffs clear it
  const gap = Math.hypot(PA[0] - PB[0], PA[1] - PB[1], PA[2] - PB[2]);
  if (det <= 0.15 && k < 0 && gap < 2 * r) {
    const L = unit(sub(PA, PB)), W = sub(PA, (m.bone.handL.getWorldPosition(UP), [UP.x, UP.y, UP.z])), u = unit(less(W, L));
    m.bone.chest.getWorldPosition(UP);
    const n = unit(less(less(sub([UP.x, UP.y, UP.z], mid), L), u));
    out.set(mid[0], mid[1], mid[2]).add(UP.set(...n).multiplyScalar(-Math.max(Math.sqrt(Math.max(0, (r + BACK) ** 2 - (gap / 2) ** 2)), CLEAR)));
  }
  return out;
}

/* ---------- paint ---------- */

const LATEX = [214, 213, 204];
// kit: the keeper's kit (rules/teams.js keeperKit). The back is the kit's dark trim with a panel in the shirt's
// color; the strap in the shirt's color with an invented star; the palm pale grey latex.
export function paintGloves(ctx, kit, seed = 0) {
  const base = hex(kit.trim), panel = hex(kit.shirt), accent = hex(kit.trim2 || kit.shirt);
  const dark = lum(base) < 0.35, seam = base.map(v => (dark ? v + 70 : v * 0.6));
  const put = (c, col, m) => { c[0] = col[0] * m; c[1] = col[1] * m; c[2] = col[2] * m; };
  const round = (u, c) => { const d = Math.abs(u - c) % 1; return Math.min(d, 1 - d); };
  // latex: matte, a fine stipple, a little darker and dirtier in the middle of the palm where it takes the ball
  const latex = (c, u, v, px, py, wear) => { const g = 0.94 + 0.06 * fbm(px * 0.9, py * 0.9, seed + 3) - 0.035 * fbm(px * 0.11, py * 0.11, seed + 9) * wear; put(c, LATEX, g); c[1] *= 0.995; c[2] *= 0.985; };
  eachPixel(ctx, GL.hand, (u, v, c, px, py) => {
    const blot = 0.93 + 0.1 * fbm(px * 0.08, py * 0.08, seed, 8), back = gauss(round(u, 0.75), 0, 0.2);
    if (v < CUFF_V) {                                   // the cuff: ribbed elastic, the strap wrapped round it, a star on its tab
      const k = v / CUFF_V, rib = 0.95 + 0.05 * Math.sin(py * 2.6);
      put(c, base, (0.85 + 0.12 * back) * rib * blot);
      if (k < 0.08) put(c, base, 0.6);                   // the turned-in top
      const strap = k > 0.47 && k < 0.92;
      if (strap) {
        put(c, panel, (0.86 + 0.14 * back) * blot);
        if (Math.abs(k - 0.49) < 0.02 || Math.abs(k - 0.9) < 0.02) put(c, panel, 0.62);                       // its edges, stitched
        if ((Math.abs(k - 0.53) < 0.012 || Math.abs(k - 0.86) < 0.012) && (px & 3) < 2) put(c, accent, 0.9);
        // the tab: the strap's end lying over itself on the back of the wrist, with the mark
        const tu = round(u, 0.68), ty = (k - 0.695) / 0.17;
        if (tu < 0.13 && Math.abs(ty) < 1) {
          put(c, panel, 1.02 * blot); if (tu > 0.115) put(c, panel, 0.55);
          const x = (u - 0.68) * 29, y = (k - 0.695) * 9.8, a = Math.atan2(y, x), r = Math.hypot(x, y), star = 0.55 + 0.3 * Math.cos(5 * (a + Math.PI / 2));   // (cm round the wrist and along it)
          if (r < star) put(c, accent, 1.05);
          else if (r < star + 0.22) put(c, base, dark ? 1.2 : 0.9);
        }
      }
      return;
    }
    const k = (v - CUFF_V) / (1 - CUFF_V), pr = round(u, 0.25);
    if (pr < 0.235 + 0.03 * k) {                        // the latex palm, rolling round the edges, its join with the back a raised seam
      latex(c, u, v, px, py, gauss(pr, 0, 0.12) * sstep(0.2, 0.6, k));
      c.forEach((_, i) => { c[i] *= 1 - 0.13 * gauss(pr, 0.225 + 0.03 * k, 0.012); });
      if (k < 0.08) put(c, base, 0.8);                   // a band where it is stitched to the cuff
      c.forEach((_, i) => { c[i] *= 1 - 0.12 * gauss(k, 0.62, 0.025) * gauss(pr, 0, 0.13); });   // the palm's flex line
      return;
    }
    put(c, base, (0.88 + 0.12 * back) * blot);          // the back: padded, with a moulded panel over the knuckles
    const bu = (u - 0.75) / 0.2, top = 0.3 + 0.22 * bu * bu, side = 0.88 - 0.3 * sstep(0.6, 0.2, k);   // the panel: a shield over the knuckles, its point toward the wrist
    if (k > top && Math.abs(bu) < side && k < 0.97) {
      put(c, panel, (0.84 + 0.16 * back) * blot);
      const e = Math.min(k - top, side - Math.abs(bu)) * 1.6;
      if (e < 0.05) c.forEach((_, i) => { c[i] *= 0.62 + 0.38 * e / 0.05; });
      for (const j of [-0.45, 0, 0.45]) if (Math.abs(bu - j) < 0.03 && k > 0.6) c.forEach((_, i) => { c[i] *= 0.7; });   // the panel's flex grooves
    }
    if (Math.abs(round(u, 0.75) - 0.2) < 0.01 && (py & 3) < 2) put(c, seam, 1);
  });
  // a finger (and the thumb): latex on the palm half and round over the tip, the back padded with a rib
  // in the panel's color; a gusset seam where they meet
  const finger = r => eachPixel(ctx, r, (u, v, c, px, py) => {
    const pr = round(u, 0.25), blot = 0.93 + 0.09 * fbm(px * 0.2, py * 0.1, seed + r.x, 4), back = gauss(round(u, 0.75), 0, 0.22);
    if (pr < 0.25 || v > 0.9) {
      latex(c, u, v, px, py, 0.5);
      c.forEach((_, i) => { c[i] *= 1 - 0.12 * (gauss(v, 0.47, 0.025) + gauss(v, 0.71, 0.022)) * gauss(pr, 0, 0.15) - 0.15 * gauss(pr, 0.25, 0.015) * (v < 0.9); });
      if (v < 0.06) put(c, LATEX, 0.8);
      return;
    }
    put(c, base, (0.86 + 0.14 * back) * blot);
    if (round(u, 0.75) < 0.085 && v > 0.12 && v < 0.86) {
      put(c, panel, (0.85 + 0.15 * back) * blot * (1 - 0.15 * (gauss(v, 0.47, 0.03) + gauss(v, 0.71, 0.03))));
      if (round(u, 0.75) > 0.072) c.forEach((_, i) => { c[i] *= 0.65; });
    }
    c.forEach((_, i) => { c[i] *= 1 - 0.18 * (gauss(v, 0.47, 0.018) + gauss(v, 0.71, 0.016)) * back; });   // the knuckle creases
  });
  finger(GL.finger); finger(GL.thumb);
}
