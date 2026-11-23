// The crowd's bodies and arms, painted in code with canvas paths at 1 cm a pixel: 40 torsos (8 kinds of
// top x 5 builds: slim, average, broad, heavy, a woman's) from the seat to the neck, and the arms in every
// pose, with short sleeves or long, as their own layer over the torso and the head (fanmat.js puts the
// three together and widens or narrows the arms to the build, BUILDS[].arms). Limbs are shaded round (lit
// from the upper left), with creases at the elbow, cuffs and hems; hands are shapes (an open hand, a fist).
// Three passes paint the same shapes: 'alb' light and shade, 'mask' (R shirt, G second colour, B skin)
// and 'hair' (nothing here is hair, so it stays black).

// the arms cell: 112 x 160 (x from -56 cm, y up from the seat); the torso cell: 64 x 72 (x from -32)
export const ARMS = { w: 112, h: 160, x0: -56 }, TORSO = { w: 64, h: 72, x0: -32 };
export const SHOULDER = [17.5, 55];                     // the arms' joints (cm from the middle, up from the seat)
// Builds: half widths (cm) at the neck, shoulder, chest, waist and hip; belly: how far the belly pushes out
// the sides (heavy); bust; arms: how much the arms layer is widened to meet the shoulders (and how thick
// the arms look). From adult anthropometry: shoulder breadth 36 to 44 cm in men, 33 to 37 in women.
export const BUILDS = [
  { name: 'slim', nw: 5.2, sw: 18, cw: 16, ww: 14.5, hw: 15, arms: 0.91 },
  { name: 'average', nw: 5.6, sw: 19.5, cw: 17.5, ww: 16.2, hw: 16.5, arms: 1 },
  { name: 'broad', nw: 6.1, sw: 21.5, cw: 20.5, ww: 18, hw: 18.5, arms: 1.1 },
  { name: 'heavy', nw: 6.3, sw: 21, cw: 21, ww: 23, hw: 21.5, belly: 1, arms: 1.1 },
  { name: 'woman', nw: 4.5, sw: 16.5, cw: 16.2, ww: 12.8, hw: 16.8, bust: 1, arms: 0.85, low: 2 },
];
// The poses: [elbow, wrist] of the arm on the right of the picture (cm), l: the other when it isn't the
// mirror; hand: 'open' | 'fist' | 'flat'; scarf: held between the hands.
export const POSES = [
  ['sit', { r: [[19.5, 31], [8, 9]], hand: 'flat' }],
  ['sitLean', { r: [[18, 26], [4, 22]], l: [[-18, 26], [-3, 20]], hand: 'fist' }],
  ['sitChat', { r: [[24, 33], [21, 50]], l: [[-19.5, 31], [-8, 9]], hand: 'open', lhand: 'flat' }],
  ['stand', { r: [[22, 31], [23, 6]], hand: 'flat' }],
  ['folded', { r: [[20, 35], [-9, 41]], l: [[-20, 35], [9, 37]], hand: 'fist' }],
  ['clapO', { r: [[21, 34], [11, 47]], hand: 'open' }],
  ['clapM', { r: [[20, 34], [7, 48]], hand: 'open' }],
  ['clapS', { r: [[19, 34], [2.8, 48]], hand: 'open' }],
  ['vLow', { r: [[31, 66], [29, 87]], hand: 'open' }],
  ['vMid', { r: [[30, 80], [39, 102]], hand: 'open' }],
  ['up', { r: [[23, 85], [19, 112]], hand: 'open' }],
  ['scarf', { r: [[31, 74], [27, 97]], hand: 'fist', scarf: true }],
  ['scarfTilt', { r: [[29, 80], [26, 106]], l: [[-30, 70], [-25, 88]], hand: 'fist', scarf: true }],
  ['fistLo', { r: [[33, 49], [27, 72]], l: [[-22, 31], [-23, 6]], hand: 'fist', lhand: 'flat' }],
  ['fistMid', { r: [[29, 70], [26, 93]], l: [[-22, 31], [-23, 6]], hand: 'fist', lhand: 'flat' }],
  ['fistHi', { r: [[22, 85], [21, 110]], l: [[-22, 31], [-23, 6]], hand: 'fist', lhand: 'flat' }],
  ['handsHead', { r: [[31, 79], [8, 88]], hand: 'flat' }],
  ['pole', { r: [[21, 40], [1.5, 50]], l: [[-22, 62], [-1.5, 76]], hand: 'fist' }],
  ['clapHiO', { r: [[25, 82], [11, 105]], hand: 'open' }],
  ['clapHiS', { r: [[23, 83], [3, 107]], hand: 'open' }],
  ['wide', { r: [[45, 61], [55, 78]], hand: 'open' }],
  ['point', { r: [[27, 62], [31, 80]], l: [[-22, 31], [-23, 6]], hand: 'point', lhand: 'flat' }],
  ['handsFace', { r: [[28, 42], [5, 64]], hand: 'flat' }],
  ['wave', { r: [[30, 80], [33, 104]], l: [[-22, 31], [-23, 6]], hand: 'open', lhand: 'flat' }],
];
// The tops: collar trim, stripes, a chest band, a scarf round the neck, a zip jacket with a scarf, a
// hoodie, a track jacket, a polo. long: sleeves to the wrist.
export const TOPS = [
  { kind: 'shirt', trim: 'collar' }, { kind: 'shirt', trim: 'stripes' }, { kind: 'shirt', trim: 'band' }, { kind: 'shirt', trim: 'collar', scarf: true },
  { kind: 'jacket', long: true, scarf: true }, { kind: 'hoodie', long: true }, { kind: 'track', long: true }, { kind: 'polo', trim: 'polo' },
];

export function painter(x, pass) {
  const solid = (kind, L) => {
    if (pass === 'alb') { const v = Math.round(255 * Math.max(0, Math.min(1, L))); return `rgb(${v},${v},${v})`; }
    if (pass === 'hair') return '#000';
    return kind === 'shirt' ? '#f00' : kind === 'acc' ? '#0f0' : kind === 'skin' ? '#00f' : '#000';
  };
  return {
    x, alb: pass === 'alb',
    // fill a path, shaded round across g0 -> g1 (g0 the lit side) in the light pass
    fill(kind, L, path, g0, g1) {
      if (pass === 'alb' && g0) {
        const g = x.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
        g.addColorStop(0, solid(kind, L * 0.78)); g.addColorStop(0.3, solid(kind, L * 1.04)); g.addColorStop(0.65, solid(kind, L * 0.9)); g.addColorStop(1, solid(kind, L * 0.58));
        x.fillStyle = g;
      } else x.fillStyle = solid(kind, L);
      x.beginPath(); path(x); x.fill();
    },
    stroke(kind, L, w, pts) { if (pass !== 'alb' && kind === 'shade') return; x.strokeStyle = kind === 'shade' ? `rgba(0,0,0,${L})` : solid(kind, L); x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.stroke(); },
  };
}

// a limb from a to b (px), widths wa and wb, round ends, shaded across
function limb(p, kind, L, a, b, wa, wb, capA = true, capB = true) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (nx + ny > 0) { nx = -nx; ny = -ny; }                      // n toward the upper left: the lit side
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], w = (wa + wb) / 4;
  p.fill(kind, L, c => {
    c.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2); c.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2); c.lineTo(b[0] - nx * wb / 2, b[1] - ny * wb / 2); c.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2); c.closePath();
    if (capA) { c.moveTo(a[0] + wa / 2, a[1]); c.arc(a[0], a[1], wa / 2, 0, 7); } if (capB) { c.moveTo(b[0] + wb / 2, b[1]); c.arc(b[0], b[1], wb / 2, 0, 7); }
  }, [m[0] + nx * w, m[1] + ny * w], [m[0] - nx * w, m[1] - ny * w]);
}

function hand(p, at, dir, kind) {
  const [hx, hy] = at, a = Math.atan2(dir[1], dir[0]), c = Math.cos(a), s = Math.sin(a), P = (u, v) => [hx + u * c - v * s, hy + u * s + v * c];
  if (kind === 'fist') { p.fill('skin', 0.9, x => { x.ellipse(...P(3, 0), 4.6, 4.2, a, 0, 7); }, P(3, -4), P(3, 4)); p.stroke('shade', 0.25, 0.8, [P(4.5, -3), P(4.5, 3)]); return; }
  // an open (or flat) hand: the palm and four fingers, the thumb out to one side
  const fl = kind === 'flat' ? 4.5 : 6;
  p.fill('skin', 0.92, x => { x.ellipse(...P(3.5, 0), 4.2, 4, a, 0, 7); }, P(3, -4), P(3, 4));
  for (const v of [-2.6, -0.9, 0.9, 2.6]) p.stroke('skin', 0.95, 1.6, [P(6, v * (kind === 'open' ? 1.15 : 0.9)), P(6 + fl - Math.abs(v) * 0.4, v * (kind === 'open' ? 1.5 : 0.95))]);
  if (kind === 'point') return;
  p.stroke('skin', 0.88, 1.8, [P(2, 3.6), P(4.5, 6.2)]);
}

// One pose's arms in the cell at (ox, oy); sleeve long or short.
export function paintArms(p, pose, long, ox, oy) {
  const X = (x, y) => [ox + ARMS.w / 2 + x, oy + ARMS.h - y];
  const r = pose.r, l = pose.l || r.map(([x, y]) => [-x, y]);
  const arms = [[r, 1, pose.hand], [l, -1, pose.lhand || pose.hand]];
  for (const [[e, wr], side, hk] of arms) {
    const S = X(side * SHOULDER[0], SHOULDER[1]), E = X(...e), Wr = X(...wr);
    // forearm: sleeve or skin, a cuff at the wrist; upper arm: the sleeve, short ones ending above the elbow
    if (long) { limb(p, 'shirt', 0.8, E, Wr, 10, 8); limb(p, 'shirt', 0.72, [E[0] + (Wr[0] - E[0]) * 0.88, E[1] + (Wr[1] - E[1]) * 0.86], Wr, 7.8, 7.8); }
    else limb(p, 'skin', 0.88, E, Wr, 9, 6.8);
    if (long) { limb(p, 'shirt', 0.84, S, E, 12.5, 10.5, false); p.fill('shirt', 0.84, c => { c.arc(S[0], S[1] + 0.5, 5, 0, 7); }, [S[0] - 4, S[1] - 4], [S[0] + 4, S[1] + 4]); }
    else {
      // a short sleeve: the bare upper arm out of it, the sleeve flaring a little to an open hem square
      // to the arm, its turned edge catching the light and a soft shadow on the skin under it (a dark
      // band straight across read as an armband)
      const k = 0.46, H = [S[0] + (E[0] - S[0]) * k, S[1] + (E[1] - S[1]) * k], dx = E[0] - S[0], dy = E[1] - S[1], len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
      limb(p, 'skin', 0.86, [S[0] + dx * 0.3, S[1] + dy * 0.3], E, 10, 9);
      limb(p, 'skin', 0.68, [H[0] - ux * 0.5, H[1] - uy * 0.5], [H[0] + ux * 2.2, H[1] + uy * 2.2], 10.2, 10, false, false);   // the sleeve's shadow on the skin
      limb(p, 'shirt', 0.86, S, H, 12, 13.4, false, false); p.fill('shirt', 0.86, c => { c.arc(S[0], S[1] + 0.5, 5, 0, 7); }, [S[0] - 4, S[1] - 4], [S[0] + 4, S[1] + 4]);
      p.stroke('shirt', 1.02, 1.1, [[H[0] + nx * 5.6 - ux * 0.9, H[1] + ny * 5.6 - uy * 0.9], [H[0] - nx * 5.6 - ux * 0.9, H[1] - ny * 5.6 - uy * 0.9]]);   // the hem's turned edge
    }
    p.stroke('shade', 0.22, 1, [[E[0] - 2.5, E[1] - 1.5], [E[0] + 1.5, E[1] + 1]]);       // the crease at the elbow
    if (pose.scarf && side === 1) scarfHeld(p, X(...wr), X(...l[1]));
    hand(p, Wr, [Wr[0] - E[0], Wr[1] - E[1]], hk);
  }
}

// a two-colour bar scarf stretched between the hands, its fringes hanging
function scarfHeld(p, a, b) {
  const n = 8, sag = 3;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, P = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * sag];
    const [x0, y0] = P(t0), [x1, y1] = P(t1);
    p.fill(i % 2 ? 'shirt' : 'acc', 0.86, c => { c.moveTo(x0, y0 - 3.6); c.lineTo(x1, y1 - 3.6); c.lineTo(x1, y1 + 3.6); c.lineTo(x0, y0 + 3.6); c.closePath(); }, [x0, y0 - 4], [x0, y0 + 4]);
  }
  for (const [e, s] of [[a, 1], [b, -1]]) for (let k = -2; k <= 2; k++) p.stroke('acc', 0.7, 0.8, [[e[0] + s * 1.5 + k, e[1] + 3], [e[0] + s * 2 + k * 1.2, e[1] + 9]]);
}

// One torso in the cell at (ox, oy): top t (TOPS), build b (BUILDS).
export function paintTorso(p, t, b, ox, oy) {
  const X = (x, y) => [ox + TORSO.w / 2 + x, oy + TORSO.h - y];
  const sw = b.sw, ww = b.ww, x = p.x, lo = b.low || 0;
  // the neck (under the head's), then the body: trapezius, deltoids, chest, waist, hips; smoothed
  // through the midpoints of the outline's points
  p.fill('skin', 0.78, c => { const [a, q] = X(-b.nw, 70); c.rect(a, q, 2 * b.nw, 14); }, X(-b.nw, 64), X(b.nw, 64));
  const R = [[b.nw + 0.4, 64 - lo / 2], [14 - lo, 63 - lo], [sw, 58 - lo], [sw + 2, 53 - lo], [sw - 0.5, 46 - lo], [b.cw + (b.bust ? 1 : 0), 39], [b.ww + (b.belly ? 2.5 : 0), 24], [b.hw, 11], [b.hw + 0.5, 0]];
  const body = c => {
    const pts = [...R.map(([px, py]) => [-px, py]).reverse(), ...R];
    c.moveTo(...X(...pts[0]));
    for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; c.quadraticCurveTo(...X(...pts[i]), ...X(...m)); }
    c.lineTo(...X(...pts[pts.length - 1])); c.closePath();
  };
  p.fill('shirt', 0.86, body, X(-sw, 40), X(sw, 40));
  if (p.alb) {                                                    // folds: from the armpits down, creases over the belly, shade low down
    x.save(); x.beginPath(); body(x); x.clip();
    for (const s of [-1, 1]) p.stroke('shade', 0.16, 2.2, [X(s * (sw - 3), 46 - lo), X(s * (sw - 8), 34), X(s * 7, 24)]);
    p.stroke('shade', 0.12, 1.6, [X(-ww + 2, 13), X(0, 11), X(ww - 2, 13)]); p.stroke('shade', 0.1, 1.4, [X(-ww + 4, 19), X(0, 17.5), X(ww - 4, 19)]);
    if (b.bust) for (const s of [-1, 1]) p.stroke('shade', 0.2, 2.4, [X(s * 11, 42), X(s * 6.5, 38.5), X(s * 2.5, 41)]);
    if (b.belly) { p.stroke('shade', 0.26, 3, [X(-ww + 1, 14), X(0, 9.5), X(ww - 1, 14)]); p.stroke('shade', 0.1, 6, [X(-ww + 3, 30), X(-ww + 1, 22)]); }
    const g = x.createLinearGradient(0, X(0, 30)[1], 0, X(0, 0)[1]); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.38)');
    x.fillStyle = g; x.fillRect(ox, oy, TORSO.w, TORSO.h);
    x.restore();
  }
  const clip = fn => { x.save(); x.beginPath(); body(x); x.clip(); fn(); x.restore(); };
  if (t.trim === 'stripes') clip(() => { for (const sx of [-12, -4, 4, 12]) p.fill('acc', 0.84, c => { const [a, b] = X(sx - 2, 66); c.rect(a, b, 4, 66); }, X(sx - 2, 0), X(sx + 2, 0)); });
  if (t.trim === 'band') clip(() => p.fill('acc', 0.84, c => { const [a, b] = X(-30, 44); c.rect(a, b, 60, 7); }, X(0, 44), X(0, 37)));
  if (t.trim === 'collar' || t.trim === 'stripes' || t.trim === 'band') {
    p.fill('acc', 0.8, c => { c.ellipse(...X(0, 63), 7, 2.8, 0, 0, Math.PI); c.ellipse(...X(0, 63.6), 5.6, 1.6, 0, Math.PI, 0, true); });
    p.fill('acc', 0.85, c => { c.ellipse(...X(-8, 52), 1.8, 2.2, 0, 0, 7); });            // the badge
  }
  if (t.trim === 'polo') { p.fill('acc', 0.85, c => { c.moveTo(...X(-6.5, 64)); c.lineTo(...X(-1, 58)); c.lineTo(...X(-3, 64)); c.closePath(); c.moveTo(...X(6.5, 64)); c.lineTo(...X(1, 58)); c.lineTo(...X(3, 64)); c.closePath(); }); p.stroke('shade', 0.3, 1, [X(0, 60), X(0, 50)]); }
  if (t.kind === 'jacket' || t.kind === 'track') {
    p.stroke('shade', 0.45, 1.1, [X(0.4, 62), X(0.4, 2)]);                               // the zip
    p.fill('shirt', 0.7, c => { c.moveTo(...X(-7, 65)); c.lineTo(...X(-3, 58)); c.lineTo(...X(0, 64)); c.lineTo(...X(3, 58)); c.lineTo(...X(7, 65)); c.lineTo(...X(5.5, 68)); c.lineTo(...X(-5.5, 68)); c.closePath(); });   // the collar stood up
    if (t.kind === 'track') { for (const s of [-1, 1]) p.fill('acc', 0.84, c => { const [a, b] = X(s * (sw - 3) - 1.2, 58); c.rect(a, b, 2.4, 50); }); p.fill('acc', 0.8, c => { const [a, q] = X(-b.hw, 4); c.rect(a, q, 2 * b.hw, 3.5); }); }
  }
  if (t.kind === 'hoodie') {
    p.fill('shirt', 0.68, c => { c.ellipse(...X(0, 63), 11, 4.5, 0, 0, 7); });              // the hood down behind the neck
    p.stroke('fixed', 0.82, 0.9, [X(-2.5, 61), X(-3, 50)]); p.stroke('fixed', 0.82, 0.9, [X(2.5, 61), X(3, 50)]);
    p.stroke('shade', 0.25, 1.2, [X(-9, 22), X(-7, 12), X(7, 12), X(9, 22), X(-9, 22)]);    // the pocket
  }
  if (t.scarf) {
    // wrapped round the neck, two ends hanging down the front, in bars with a fringe
    p.fill('acc', 0.85, c => { c.ellipse(...X(0, 64), 9.5, 4, 0, 0, 7); }, X(0, 68), X(0, 60));
    for (const [sx, len] of [[-3.5, 22], [3, 18]]) {
      for (let k = 0; k < len; k += 4) p.fill((k / 4) % 2 ? 'shirt' : 'acc', 0.82, c => { const [a, b] = X(sx - 3.2, 61 - k); c.rect(a, b, 6.4, 4.2); }, X(sx - 3, 0), X(sx + 3, 0));
      for (let k = -2; k <= 2; k++) p.stroke('acc', 0.7, 0.7, [X(sx + k * 1.3, 61 - len), X(sx + k * 1.4, 58 - len)]);
    }
  }
  p.fill('fixed', 0.2, c => { const [a, q] = X(-b.hw - 0.5, 5); c.rect(a, q, 2 * b.hw + 1, 5); });   // trousers at the bottom: his lap
}
