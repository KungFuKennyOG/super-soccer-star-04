// The menu screens painted in the '04 style (game/ps2/ui.js): mode select, settings and locker, team select
// (club carousel, world map for nations), the cup hub (group table or bracket) and message screens.
// Pure painting: game/menus.js owns the screens, the selection and the input, and calls these with what to show.
import { PAL, text, measure, wrap, panel, gloss, header, hints, rowHighlight, backdrop, stars, teamChip, shirt, logo, button, rr, tab } from './ui.js';
import { drawWorldMap } from '../worldmap.js';
import { byId } from '../../rules/teams.js';
import { table, userGroup, currentFixture, STAGE_NAMES, KO } from '../../rules/cup.js';

export const MW = 1024, MH = 768;              // menu canvas (the panel is 2.2 x 1.65 m)
const WORD = ['', 'UNDERDOG', 'DECENT', 'SOLID', 'STRONG', 'GIANT'];
const on2 = t => Math.floor(t * 2) % 2 === 1;

export function paintMode(ctx, { modes, sel }) {
  ctx.clearRect(0, 0, MW, MH); backdrop(ctx, MW, MH);
  logo(ctx, MW / 2, 26, 170);
  const x = 212, w = MW - 424, h = 70, gap = 16, top = 222;
  modes.forEach((m, i) => {
    const y = top + i * (h + gap);
    if (i === sel) rowHighlight(ctx, x, y, w, h); else gloss(ctx, x, y, w, h, { kind: 'blue', r: h * 0.3 });
    text(ctx, m.name, x + 34, y + h / 2, { size: 42, italic: true, weight: 900, color: i === sel ? PAL.deep : PAL.ink, shadow: i !== sel, max: w - 60 });
  });
  text(ctx, modes[sel].sub, MW / 2, 664, { size: 32, align: 'center', color: PAL.accent, weight: 700, max: MW - 120 });
  hints(ctx, MW, MH, [['A', 'SELECT']], { h: 46 });
}

export function paintSettings(ctx, { rows, settings, sel }) {
  ctx.clearRect(0, 0, MW, MH); backdrop(ctx, MW, MH);
  header(ctx, MW, 'SETTINGS');
  const lockAt = rows.findIndex(r => r.locker), x = 70, w = MW - 140, h = 42, pitch = 47;
  panel(ctx, x - 22, 104, w + 44, lockAt * pitch + 18);
  panel(ctx, x - 22, 104 + lockAt * pitch + 30, w + 44, (rows.length - lockAt) * pitch + 62);
  rows.forEach((r, i) => {
    const y = 114 + i * pitch + (r.locker ? 82 : 0), on = sel === i;
    if (i === lockAt) tab(ctx, x - 6, y - 52, 220, 44, 'LOCKER', false, 28);
    if (on) rowHighlight(ctx, x + 14, y, w - 14, h);
    else if (i % 2) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x + 14, y, w - 14, h); }
    text(ctx, r.name, x + 34, y + h / 2, { size: 30, weight: 800, color: on ? PAL.deep : PAL.soft, shadow: !on });
    const v = r.opts[settings[r.key]] || r.opts[0], col = on ? PAL.deep : PAL.ink;
    if (on && r.opts.length > 1) {
      const vw = measure(ctx, v, 30, { weight: 900 }), rx = x + w - 30;
      arrow(ctx, rx, y + h / 2, 1, col); text(ctx, v, rx - 30, y + h / 2, { size: 30, align: 'right', weight: 900, color: col, shadow: false });
      arrow(ctx, rx - 54 - vw, y + h / 2, -1, col);
    } else text(ctx, v, x + w - 30, y + h / 2, { size: 30, align: 'right', weight: 900, color: col, shadow: !on });
  });
  hints(ctx, MW, MH, [['◀ ▶', 'CHANGE'], ['B', 'BACK']], { h: 46 });
}
function arrow(ctx, x, cy, dir, col) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x + dir * 9, cy); ctx.lineTo(x - dir * 7, cy - 11); ctx.lineTo(x - dir * 7, cy + 11); ctx.closePath(); ctx.fill(); ctx.restore();
}

// World Cup: the map. Club cups: one team at a time with < > to browse.
export function paintTeam(ctx, { mode, teams, sel, blink, cupName }) {
  ctx.clearRect(0, 0, MW, MH); backdrop(ctx, MW, MH);
  const t = teams[sel];
  if (mode === 'world') {
    header(ctx, MW, 'PICK YOUR NATION', { sub: cupName });
    panel(ctx, 30, 106, MW - 60, 96);
    const cw = teamChip(ctx, t, 54, 124, 60);
    text(ctx, t.name, 54 + cw + 22, 154, { size: 50, italic: true, weight: 900, max: MW - 470 });
    stars(ctx, t.s, MW - 300, 140, 34);
    text(ctx, WORD[t.s], MW - 56, 178, { size: 24, align: 'right', color: PAL.muted, weight: 700 });
    drawWorldMap(ctx, 30, 214, MW - 60, MH - 214 - 78, t.id, blink);
    hints(ctx, MW, MH, [['STICK', 'MOVE ON THE MAP'], ['A', 'PICK'], ['B', 'BACK']], { h: 46 });
    return;
  }
  header(ctx, MW, 'PICK YOUR TEAM', { sub: cupName });
  panel(ctx, 96, 120, MW - 192, 520);
  const cw = 132 * 0.82;
  teamChip(ctx, t, MW / 2 - cw / 2, 146, 132);
  text(ctx, t.name, MW / 2, 330, { size: 74, align: 'center', italic: true, weight: 900, max: MW - 300 });
  text(ctx, t.id, MW / 2, 392, { size: 34, align: 'center', color: PAL.muted, weight: 800 });
  stars(ctx, t.s, MW / 2, 448, 46, { align: 'center' });
  text(ctx, WORD[t.s], MW / 2, 498, { size: 30, align: 'center', color: PAL.soft, weight: 700 });
  shirt(ctx, t.kit, MW / 2 - 70, 530, 92);
  shorts(ctx, t.kit, MW / 2 + 70, 538, 76);
  for (const [dx, d] of [[-1, '◀'], [1, '▶']]) {
    const bx = MW / 2 + dx * (MW / 2 - 70) - 32, by = 352;
    gloss(ctx, bx, by, 64, 64, { kind: 'amber', r: 32, glow: on2(blink) ? 'rgba(255,190,60,0.7)' : null });
    text(ctx, d, bx + 32, by + 33, { size: 30, align: 'center', color: PAL.deep, shadow: false, squash: 1 });
  }
  text(ctx, `${sel + 1} / ${teams.length}`, MW - 124, 150, { size: 28, align: 'right', color: PAL.muted, weight: 800 });
  hints(ctx, MW, MH, [['◀ ▶', 'BROWSE'], ['A', 'PICK'], ['B', 'BACK']], { h: 46 });
}
function shorts(ctx, k, cx, y, s) {
  ctx.save(); ctx.beginPath();
  ctx.moveTo(cx - 0.5 * s, y); ctx.lineTo(cx + 0.5 * s, y); ctx.lineTo(cx + 0.58 * s, y + 0.62 * s); ctx.lineTo(cx + 0.06 * s, y + 0.66 * s);
  ctx.lineTo(cx, y + 0.3 * s); ctx.lineTo(cx - 0.06 * s, y + 0.66 * s); ctx.lineTo(cx - 0.58 * s, y + 0.62 * s); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.fillStyle = k.shorts; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
  ctx.fillStyle = k.socks; ctx.fillRect(cx - 0.42 * s, y + 0.78 * s, 0.3 * s, 0.34 * s); ctx.fillRect(cx + 0.12 * s, y + 0.78 * s, 0.3 * s, 0.34 * s);
  ctx.strokeRect(cx - 0.42 * s, y + 0.78 * s, 0.3 * s, 0.34 * s); ctx.strokeRect(cx + 0.12 * s, y + 0.78 * s, 0.3 * s, 0.34 * s);
  ctx.restore();
}

export function paintHub(ctx, { cup, blink, cupName }) {
  ctx.clearRect(0, 0, MW, MH); backdrop(ctx, MW, MH);
  const me = byId(cup.user), fx = currentFixture(cup);
  header(ctx, MW, cupName, { sub: me.name });
  // continues as three lit balls, the stage on the right
  text(ctx, 'CONTINUES', 40, 124, { size: 26, color: PAL.muted, weight: 700 });
  for (let i = 0; i < 3; i++) ball(ctx, 186 + i * 36, 124, 14, i < cup.continues);
  const stage = cup.stage === 'group' ? `GROUP STAGE · GAME ${cup.matchday + 1} OF 3` : STAGE_NAMES[cup.stage] || '';
  text(ctx, stage, MW - 40, 124, { size: 30, align: 'right', color: PAL.accent, italic: true, weight: 900 });
  if (cup.stage === 'group') paintGroup(ctx, cup); else paintBracket(ctx, cup, 168);
  if (fx) {
    const opp = byId(fx.opp), y = MH - 160, h = 78;
    gloss(ctx, 30, y, MW - 60, h, { kind: ['#c8323a', '#6a0c18'], r: 18 });
    text(ctx, 'NEXT', 52, y + h / 2, { size: 28, italic: true, weight: 900, color: PAL.accent });
    let x = 140;
    x += teamChip(ctx, me, x, y + 16, 46) + 12; x += text(ctx, me.id, x, y + h / 2, { size: 38, weight: 900 }) + 18;
    x += text(ctx, 'v', x, y + h / 2, { size: 30, color: PAL.soft, italic: true }) + 18;
    x += teamChip(ctx, opp, x, y + 16, 46) + 12; x += text(ctx, opp.id, x, y + h / 2, { size: 38, weight: 900 }) + 16;
    text(ctx, opp.name, x, y + h / 2, { size: 28, color: PAL.soft, weight: 700, max: MW - 360 - x });
    if (on2(blink)) { button(ctx, 'A', MW - 300, y + h / 2, 46); text(ctx, 'TO PLAY', MW - 250, y + h / 2, { size: 32, italic: true, weight: 900, color: PAL.accent, glow: 'rgba(255,200,60,0.8)' }); }
  }
  hints(ctx, MW, MH, [['B', 'QUIT TO MENU']], { h: 46 });
}
function ball(ctx, cx, cy, r, lit) {
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, lit ? '#ffffff' : '#56607a'); g.addColorStop(1, lit ? '#8fb0e0' : '#20283c');
  if (lit) { ctx.shadowColor = 'rgba(140,200,255,0.9)'; ctx.shadowBlur = r; }
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
}

function paintGroup(ctx, cup) {
  const g = userGroup(cup), rows = table(g), x = 30, w = MW - 60;
  panel(ctx, x, 156, w, 434);
  tab(ctx, x + 20, 166, 230, 48, `GROUP ${g.id}`, true, 30);
  const cols = [['P', 560], ['W', 625], ['D', 690], ['L', 755], ['GD', 830], ['PTS', 920]];
  for (const [h, cx] of cols) text(ctx, h, cx, 192, { size: 26, align: 'center', color: PAL.muted, weight: 800 });
  rows.forEach((r, i) => {
    const y = 226 + i * 62, h = 54, me = r.id === cup.user, t = byId(r.id);
    if (me) rowHighlight(ctx, x + 40, y, w - 60, h);
    else gloss(ctx, x + 40, y, w - 60, h, { kind: i % 2 ? ['#24324f', '#141d31'] : ['#2b3b5c', '#18223a'], r: 10 });
    if (i < 2) { ctx.fillStyle = PAL.good; ctx.fillRect(x + 40, y + 6, 6, h - 12); }
    const col = me ? PAL.deep : PAL.ink;
    text(ctx, String(i + 1), x + 70, y + h / 2, { size: 30, weight: 900, color: col, shadow: !me, align: 'center' });
    const cw = teamChip(ctx, t, x + 96, y + 11, 32);
    text(ctx, t.name, x + 108 + cw, y + h / 2, { size: 30, weight: 800, color: col, shadow: !me, max: 520 - 140 - cw });
    const vals = [r.p, r.w, r.d, r.l, (r.gf - r.ga > 0 ? '+' : '') + (r.gf - r.ga), r.pts];
    vals.forEach((v, j) => text(ctx, String(v), cols[j][1], y + h / 2, { size: 30, align: 'center', weight: j === 5 ? 900 : 700, color: col, shadow: !me }));
  });
  // this matchday's other results in the group
  const done = g.fixtures.filter(f => f.ga !== null);
  done.slice(-4).forEach((f, i) => text(ctx, `${f.a}  ${f.ga} - ${f.gb}  ${f.b}`, x + 80 + (i % 2) * 450, 488 + Math.floor(i / 2) * 42 + 4, { size: 28, color: PAL.muted, weight: 700 }));
}

// A two-sided bracket: the left half of the draw runs in from the left edge, the right half from the
// right edge, and they meet in the final in the middle.
function paintBracket(ctx, cup, top) {
  const ROW = 52, BW = 112, BH = 42, L = [36, 168, 300, 448], R = [MW - 36 - BW, MW - 168 - BW, MW - 300 - BW, MW - 448 - BW];
  panel(ctx, 20, top - 16, MW - 40, ROW * 8 + 28);
  const slot = (t, which, x, y) => {
    const id = t ? (which ? t.b : t.a) : null;
    if (!id) { rr(ctx, x, y, BW, BH, 8); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill(); text(ctx, '—', x + BW / 2, y + BH / 2, { size: 24, align: 'center', color: PAL.dim }); return; }
    const me = id === cup.user, won = t.winner === id, lost = t.winner && !won;
    if (me) gloss(ctx, x, y, BW, BH, { kind: 'amber', r: 8, glow: 'rgba(255,170,40,0.6)' });
    else gloss(ctx, x, y, BW, BH, { kind: lost ? ['#232a3c', '#151a28'] : ['#3b5384', '#1b2a4c'], r: 8 });
    const col = me ? PAL.deep : lost ? '#8a98b8' : PAL.ink;
    text(ctx, id, x + 12, y + BH / 2, { size: 26, weight: 900, color: col, shadow: !me });
    const gl = which ? t.gb : t.ga;
    if (gl !== null && gl !== undefined) text(ctx, String(gl) + (t.pens && won ? 'P' : ''), x + BW - 10, y + BH / 2, { size: 26, align: 'right', weight: 900, color: col, shadow: !me });
  };
  // connectors: each pair of slots joins the slot it feeds in the next round
  const yOf = (ri, n, side) => Math.round((ri === 3 ? top + 3.5 * ROW + (side ? 30 : -30) : top + (n * (1 << ri) + ((1 << ri) - 1) / 2) * ROW) + BH / 2);
  ctx.save(); ctx.strokeStyle = 'rgba(150,180,230,0.45)'; ctx.lineWidth = 3;
  for (let ri = 0; ri < 3; ri++) for (const side of [0, 1]) for (let n = 0; n < (8 >> ri); n++) {
    const x0 = side ? R[ri] : L[ri] + BW, x1 = side ? R[ri + 1] + BW : L[ri + 1], xm = (x0 + x1) / 2;
    const y0 = yOf(ri, n, side), y1 = yOf(ri + 1, ri === 2 ? 0 : n >> 1, side);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, y0); ctx.lineTo(xm, y1); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.restore();
  KO.forEach((r, ri) => {
    const ties = cup.rounds[r] || [], half = (8 >> ri) / 2;
    for (let i = 0; i < Math.max(1, half) * 2; i++) {
      const side = ri === 3 ? i : i < half ? 0 : 1;
      const k = ri === 3 ? 0 : i % half;
      const t = ties[ri === 3 ? 0 : side * half + k];
      for (const which of [0, 1]) {
        if (ri === 3 && which !== i) continue;
        const n = ri === 3 ? 0 : k * 2 + which, span = 1 << ri;
        const y = ri === 3 ? top + 3.5 * ROW + (which ? 30 : -30) : top + (n * span + (span - 1) / 2) * ROW;
        slot(t, which, side ? R[ri] : L[ri], Math.round(y));
      }
    }
  });
  text(ctx, 'FINAL', MW / 2, top + 3.5 * ROW - 72, { size: 32, align: 'center', italic: true, weight: 900, color: PAL.accent, glow: 'rgba(255,190,60,0.6)' });
  if (cup.done && cup.champion) text(ctx, `WINNER  ${byId(cup.champion).name}`, MW / 2, top + 3.5 * ROW + 110, { size: 30, align: 'center', weight: 900, color: PAL.accent });
}

// Message screens (full time, results, training done). lines: [{ text, big?, color? }]
export function paintMessage(ctx, { title, lines, ok, blink }) {
  ctx.clearRect(0, 0, MW, MH); backdrop(ctx, MW, MH);
  header(ctx, MW, title || '');
  const out = [];
  for (const l of lines) {
    const size = l.big ? 60 : 38, ws = wrap(ctx, l.text, MW - 160, size, { weight: l.big ? 900 : 800 });
    for (const s of ws) out.push({ ...l, text: s, size });
  }
  const total = out.reduce((a, l) => a + l.size * 1.45, 0), y0 = Math.max(130, 120 + (480 - total) / 2);
  panel(ctx, 60, y0 - 26, MW - 120, total + 52);
  let y = y0;
  for (const l of out) {
    text(ctx, l.text, MW / 2, y + l.size * 0.72, { size: l.size, align: 'center', italic: !!l.big, weight: l.big ? 900 : 800, color: l.color ? remap(l.color) : PAL.ink, max: MW - 160 });
    y += l.size * 1.45;
  }
  const s = ok || 'PRESS A', y1 = MH - 96, w = Math.min(MW - 200, measure(ctx, s, 34, { weight: 900 }) + 120);
  gloss(ctx, (MW - w) / 2, y1 - 34, w, 68, { kind: on2(blink) ? 'amber' : 'grey', r: 22, glow: on2(blink) ? 'rgba(255,170,40,0.7)' : null });
  text(ctx, s, MW / 2, y1, { size: 34, align: 'center', italic: true, weight: 900, color: on2(blink) ? PAL.deep : PAL.ink, shadow: !on2(blink), max: w - 40 });
}
// The old screens' colours (results.js picks them) mapped onto the '04 palette.
const remap = c => ({ '#f2c21a': PAL.accent, '#ff4040': PAL.bad, '#40ff60': PAL.good, '#9aa8e0': PAL.muted }[c] || c);
