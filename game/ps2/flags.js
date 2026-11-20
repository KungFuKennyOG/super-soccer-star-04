// Each nation's flag, painted small for the shield on its shirt (Kenny: the countries' shields as the badge for the
// international teams). Flags only: the federations' own crests are their logos and are never drawn.
// A flag is a list of steps on a w x h field: ['h' | 'v', colors, shares?] bands across or down; ['cross', color,
// thickness, x] a Nordic cross (x: where the upright stands, 0..1) or a centred one (x 0.5); ['disc', color, r, cx, cy];
// ['rect', color, x0, y0, x1, y1]; ['star', color, r, cx, cy]; ['diamond', color]. All in shares of w and h.
const W = '#f2f1ea', K = '#161618', R = '#c8102e', B = '#1d3f94', G = '#12803c', Y = '#f2c21a', SKY = '#74b4e8', N = '#14204f';
export const FLAGS = {
  GER: [['h', [K, R, Y]]], ITA: [['v', [G, W, R]]], FRA: [['v', [B, W, R]]], ENG: [['h', [W]], ['cross', R, 0.2, 0.5]],
  ESP: [['h', [R, Y, R], [1, 2, 1]]], NED: [['h', [R, W, B]]], POR: [['v', [G, R], [2, 3]], ['disc', Y, 0.17, 0.4, 0.5]],
  BEL: [['v', [K, Y, R]]], CRO: [['h', [R, W, B]], ['rect', R, 0.38, 0.3, 0.62, 0.7], ['rect', W, 0.38, 0.3, 0.5, 0.5], ['rect', W, 0.5, 0.5, 0.62, 0.7]],
  DEN: [['h', [R]], ['cross', W, 0.16, 0.36]], SWE: [['h', ['#1f5fa8']], ['cross', Y, 0.18, 0.36]], ROU: [['v', [B, Y, R]]],
  BUL: [['h', [W, G, R]]], NOR: [['h', [R]], ['cross', W, 0.28, 0.36], ['cross', N, 0.13, 0.36]],
  BRA: [['h', [G]], ['diamond', Y], ['disc', B, 0.2, 0.5, 0.5]], ARG: [['h', [SKY, W, SKY]], ['disc', Y, 0.11, 0.5, 0.5]],
  URU: [['h', [W, B, W, B, W, B, W, B, W]], ['rect', W, 0, 0, 0.42, 0.5], ['disc', Y, 0.13, 0.21, 0.25]],
  COL: [['h', [Y, B, R], [2, 1, 1]]], CHI: [['h', [W, R]], ['rect', B, 0, 0, 0.36, 0.5], ['star', W, 0.13, 0.18, 0.25]],
  NGA: [['v', [G, W, G]]], CMR: [['v', [G, R, Y]], ['star', Y, 0.15, 0.5, 0.5]], MAR: [['h', [R]], ['star', G, 0.26, 0.5, 0.5]],
  SEN: [['v', [G, Y, R]], ['star', G, 0.15, 0.5, 0.5]], GHA: [['h', [R, Y, G]], ['star', K, 0.15, 0.5, 0.5]],
  JPN: [['h', [W]], ['disc', R, 0.24, 0.5, 0.5]], KOR: [['h', [W]], ['disc', R, 0.22, 0.5, 0.5], ['rect', B, 0.28, 0.5, 0.72, 0.72]],
  KSA: [['h', [G]], ['rect', W, 0.22, 0.42, 0.78, 0.5], ['rect', W, 0.3, 0.6, 0.7, 0.65]], IRN: [['h', [G, W, R]], ['disc', R, 0.08, 0.5, 0.5]],
  AUS: [['h', [N]], ['rect', R, 0, 0, 0.42, 0.45], ['rect', W, 0.18, 0, 0.24, 0.45], ['rect', W, 0, 0.19, 0.42, 0.26], ['star', W, 0.1, 0.72, 0.3], ['star', W, 0.1, 0.72, 0.72], ['star', W, 0.1, 0.24, 0.74]],
  MEX: [['v', [G, W, R]], ['disc', '#7a4a1e', 0.1, 0.5, 0.5]],
  USA: [['h', [R, W, R, W, R, W, R]], ['rect', N, 0, 0, 0.45, 0.57], ['star', W, 0.1, 0.22, 0.28]],
  CAN: [['v', [R, W, R], [1, 2, 1]], ['star', R, 0.2, 0.5, 0.5]],
};

// Paints flag `id` into the box (x, y, w, h); the caller clips it to its shield. False if there is no such flag.
export function paintFlag(ctx, id, x, y, w, h) {
  const f = FLAGS[id];
  if (!f) return false;
  for (const [op, a, b, c, d, e] of f) {
    if (op === 'h' || op === 'v') {
      const sh = b || a.map(() => 1), sum = sh.reduce((s, v) => s + v, 0);
      let at = 0;
      a.forEach((col, i) => {
        const p0 = at / sum, p1 = (at += sh[i]) / sum;
        ctx.fillStyle = col;
        if (op === 'h') ctx.fillRect(x, y + h * p0, w, h * (p1 - p0) + 0.5); else ctx.fillRect(x + w * p0, y, w * (p1 - p0) + 0.5, h);
      });
    } else if (op === 'cross') {
      ctx.fillStyle = a; ctx.fillRect(x + w * c - h * b / 2, y, h * b, h); ctx.fillRect(x, y + h * 0.5 - h * b / 2, w, h * b);
    } else if (op === 'disc') {
      ctx.fillStyle = a; ctx.beginPath(); ctx.arc(x + w * c, y + h * d, w * b, 0, Math.PI * 2); ctx.fill();
    } else if (op === 'rect') {
      ctx.fillStyle = a; ctx.fillRect(x + w * b, y + h * c, w * (d - b), h * (e - c));
    } else if (op === 'star') {
      ctx.fillStyle = a; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + i * Math.PI / 5, q = (i % 2 ? 0.42 : 1) * w * b; ctx.lineTo(x + w * c + Math.cos(t) * q, y + h * d + Math.sin(t) * q); }
      ctx.fill();
    } else if (op === 'diamond') {
      ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(x + w * 0.5, y + h * 0.12); ctx.lineTo(x + w * 0.92, y + h * 0.5); ctx.lineTo(x + w * 0.5, y + h * 0.88); ctx.lineTo(x + w * 0.08, y + h * 0.5); ctx.fill();
    }
  }
  return true;
}
