// The menu screens painted in the '04 style (game/ps2/ui.js): mode select, settings and locker, team select
// (club list, world map for nations), the cup hub (group table or bracket) and message screens. Every screen is
// the letterbox: title in the black top band, the backdrop picture in the middle (game/ps2/menuscene.js, passed
// in as `back`), the rows over it, hints and a status line in the black bottom band.
// Pure painting: game/menus.js owns the screens, the selection and the input, and calls these with what to show.
import { PAL, text, wrap, box, maroon, stack, bands, header, hints, star, tc, sc, NAME, YEAR } from './ui.js';
import { drawWorldMap } from '../worldmap.js';
import { byId } from '../../rules/teams.js';
import { table, userGroup, currentFixture, STAGE_NAMES, KO } from '../../rules/cup.js';

export const MW = 1024, MH = 768;              // menu canvas (the panel is 2.2 x 1.65 m)
const WORD = ['', 'UNDERDOG', 'DECENT', 'SOLID', 'STRONG', 'GIANT'];
const RH = 54, FS = 29;                         // row height and type size: bigger than the reference's for the headset
const IDS = new Set(['VR', 'PTS', 'GK', 'PS1']);

export function paintMode(ctx, { modes, sel, back }) {
  const b = bands(ctx, MW, MH, back);
  header(ctx, MW, b.top, `${NAME} ${YEAR}`);
  const w = 540, x = 300, y = b.top + Math.round(b.mid * 0.24);
  stack(ctx, x, y, w, RH, modes.map(m => ({ label: tc(m.name) })), sel, { size: FS });
  hints(ctx, MW, MH, [['A', 'Select']], sc(modes[sel].sub));
}

export function paintSettings(ctx, { rows, settings, sel, back }) {
  const b = bands(ctx, MW, MH, back);
  header(ctx, MW, b.top, 'SETTINGS');
  const lockAt = rows.findIndex(r => r.locker), row = r => ({ label: tc(r.name), value: tc(r.opts[settings[r.key]] || r.opts[0]) });
  const y = b.top + 26, rh = 50;
  stack(ctx, 36, y, 580, rh, rows.slice(0, lockAt).map(row), sel < lockAt ? sel : -1, { arrows: 'lr', size: 27 });
  const lock = [{ label: 'Locker', color: PAL.muted, fill: 'rgba(0,0,0,0.88)' }, ...rows.slice(lockAt).map(row)];
  stack(ctx, 640, y, 348, rh, lock, sel >= lockAt ? sel - lockAt + 1 : -1, { arrows: 'lr', size: 27 });
  const r = rows[sel];
  hints(ctx, MW, MH, [['◀ ▶', 'Change'], ['B', 'Back']], `${tc(r.name)}: ${tc(r.opts[settings[r.key]] || r.opts[0])}`);
}

// World Cup: the map. Club cups: one team at a time with < > to browse.
export function paintTeam(ctx, { mode, teams, sel, blink, cupName, back }) {
  const b = bands(ctx, MW, MH, back), t = teams[sel];
  if (mode === 'world') {
    header(ctx, MW, b.top, 'PICK YOUR NATION', tc(cupName, IDS));
    drawWorldMap(ctx, 24, b.top + 14, MW - 48, b.mid - 28, t.id, blink);
    stack(ctx, 44, b.bottom - 14 - 18 - RH, 560, RH, [{ chip: t, label: tc(t.name), stars: t.s }], 0, { arrows: null, size: FS });
    hints(ctx, MW, MH, [['STICK', 'Move'], ['A', 'Pick'], ['B', 'Back']], `${tc(t.name)}: ${tc(WORD[t.s])}`);
    return;
  }
  header(ctx, MW, b.top, 'PICK YOUR TEAM', tc(cupName, IDS));
  const x = 300, w = 560, y = b.top + Math.round(b.mid * 0.2);
  stack(ctx, x, y, w, RH, [
    { chip: t, label: tc(t.name), value: t.id },
    { label: 'Strength', stars: t.s },
    { label: 'Rating', value: tc(WORD[t.s]) },
    { label: 'Club', value: `${sel + 1} of ${teams.length}` },
  ], 0, { arrows: 'lr', size: FS });
  hints(ctx, MW, MH, [['◀ ▶', 'Browse'], ['A', 'Pick'], ['B', 'Back']], `${tc(t.name)}: ${tc(WORD[t.s])}`);
}

export function paintHub(ctx, { cup, cupName, back }) {
  const b = bands(ctx, MW, MH, back);
  const me = byId(cup.user), fx = currentFixture(cup);
  const stage = cup.stage === 'group' ? `Group stage, game ${cup.matchday + 1} of 3` : tc(STAGE_NAMES[cup.stage] || '');
  header(ctx, MW, b.top, cupName.toUpperCase(), stage);
  if (cup.stage === 'group') paintGroup(ctx, cup, b); else paintBracket(ctx, cup, b);
  const cont = `Continues ${cup.continues}`;
  const status = fx ? `Next: ${me.id} v ${fx.opp}, ${tc(byId(fx.opp).name)}   ·   ${cont}` : cont;
  hints(ctx, MW, MH, fx ? [['A', 'Play'], ['B', 'Quit to menu']] : [['B', 'Quit to menu']], status);
}

function paintGroup(ctx, cup, b) {
  const g = userGroup(cup), rows = table(g), x = 60, w = MW - 120, y = b.top + 22, rh = 52;
  const sel = rows.findIndex(r => r.id === cup.user) + 1;
  stack(ctx, x, y, w, rh, [{ label: `Group ${g.id}`, color: PAL.muted, fill: 'rgba(0,0,0,0.88)' },
    ...rows.map((r, i) => ({ chip: byId(r.id), label: `${i + 1}   ${tc(byId(r.id).name)}` }))], sel, { arrows: null, glyphK: null, size: 27, indent: 22 });
  const cols = [['P', 560], ['W', 622], ['D', 684], ['L', 746], ['GD', 820], ['Pts', 900]];
  for (const [h, cx] of cols) text(ctx, h, cx, y + rh / 2, { size: 24, align: 'center', color: PAL.muted });
  rows.forEach((r, i) => {
    const cy = y + (i + 1) * (rh + 2) + rh / 2;
    if (i < 2) star(ctx, x + w - 22, cy, 20);
    const vals = [r.p, r.w, r.d, r.l, (r.gf - r.ga > 0 ? '+' : '') + (r.gf - r.ga), r.pts];
    vals.forEach((v, j) => text(ctx, String(v), cols[j][1], cy, { size: 27, align: 'center', weight: j === 5 ? 900 : 700 }));
  });
  // this matchday's other results in the group
  const done = g.fixtures.filter(f => f.ga !== null).slice(-4);
  if (!done.length) return;
  const ry = y + 5 * (rh + 2) + 18, rbh = Math.ceil(done.length / 2) * 42 + 16;
  box(ctx, x, ry, w, rbh);
  done.forEach((f, i) => text(ctx, `${f.a}  ${f.ga} - ${f.gb}  ${f.b}`, x + 40 + (i % 2) * (w / 2), ry + 8 + 21 + Math.floor(i / 2) * 42, { size: 26, color: PAL.soft }));
}

// A two-sided bracket: the left half of the draw runs in from the left edge, the right half from the
// right edge, and they meet in the final in the middle.
function paintBracket(ctx, cup, b) {
  const top = b.top + 18, ROW = 56, BW = 112, BH = 42, L = [34, 166, 298, 446], R = [MW - 34 - BW, MW - 166 - BW, MW - 298 - BW, MW - 446 - BW];
  box(ctx, 18, top - 10, MW - 36, ROW * 8 + 8, { fill: 'rgba(0,0,0,0.55)' });
  const yOf = (ri, n, side) => Math.round((ri === 3 ? top + 3.5 * ROW + (side ? 30 : -30) - BH / 2 : top + (n * (1 << ri) + ((1 << ri) - 1) / 2) * ROW) + BH / 2);
  ctx.save(); ctx.strokeStyle = 'rgba(220,220,220,0.6)'; ctx.lineWidth = 2;
  for (let ri = 0; ri < 3; ri++) for (const side of [0, 1]) for (let n = 0; n < (8 >> ri); n++) {
    const x0 = side ? R[ri] : L[ri] + BW, x1 = side ? R[ri + 1] + BW : L[ri + 1], xm = (x0 + x1) / 2;
    const y0 = yOf(ri, n, side), y1 = yOf(ri + 1, ri === 2 ? 0 : n >> 1, side);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, y0); ctx.lineTo(xm, y1); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.restore();
  const slot = (t, which, x, y) => {
    const id = t ? (which ? t.b : t.a) : null;
    if (!id) { box(ctx, x, y, BW, BH, { r: 4, lw: 1.5, line: 'rgba(200,200,200,0.45)' }); return; }
    const me = id === cup.user, won = t.winner === id, lost = t.winner && !won;
    if (me) { maroon(ctx, x, y, BW, BH, 4); box(ctx, x, y, BW, BH, { r: 4, lw: 1.5, fill: null }); } else box(ctx, x, y, BW, BH, { r: 4, lw: 1.5 });
    const col = lost ? '#9a9a9a' : PAL.ink;
    text(ctx, id, x + 12, y + BH / 2, { size: 25, color: col });
    const gl = which ? t.gb : t.ga;
    if (gl !== null && gl !== undefined) text(ctx, String(gl) + (t.pens && won ? 'p' : ''), x + BW - 10, y + BH / 2, { size: 25, align: 'right', color: col });
  };
  KO.forEach((r, ri) => {
    const ties = cup.rounds[r] || [], half = (8 >> ri) / 2;
    for (let i = 0; i < Math.max(1, half) * 2; i++) {
      const side = ri === 3 ? i : i < half ? 0 : 1;
      const k = ri === 3 ? 0 : i % half;
      const t = ties[ri === 3 ? 0 : side * half + k];
      for (const which of [0, 1]) {
        if (ri === 3 && which !== i) continue;
        const n = ri === 3 ? 0 : k * 2 + which;
        slot(t, which, side ? R[ri] : L[ri], yOf(ri, n, ri === 3 ? which : side) - BH / 2);
      }
    }
  });
  text(ctx, 'Final', MW / 2, top + 3.5 * ROW - 72, { size: 27, align: 'center', color: PAL.gold });
  if (cup.done && cup.champion) text(ctx, `Winner: ${tc(byId(cup.champion).name)}`, MW / 2, top + 3.5 * ROW + 96, { size: 27, align: 'center', color: PAL.gold });
}

// Message screens (full time, results, training done). lines: [{ text, big?, color? }]; ok: what A does.
export function paintMessage(ctx, { title, lines, ok, back }) {
  const b = bands(ctx, MW, MH, back);
  header(ctx, MW, b.top, (title || '').toUpperCase());
  const out = [];
  for (const l of lines) {
    const size = l.big ? 42 : 30, ws = wrap(ctx, sc(l.text, IDS), 640, size);
    for (const s of ws) out.push({ ...l, text: s, size });
  }
  const pad = 26, total = out.reduce((a, l) => a + l.size * 1.5, 0), w = 720, x = (MW - w) / 2, y = b.top + Math.max(16, (b.mid - total - pad * 2) / 2);
  box(ctx, x, y, w, total + pad * 2);
  maroon(ctx, x + 2, y + 2, 8, total + pad * 2 - 4);
  let yy = y + pad;
  for (const l of out) {
    text(ctx, l.text, MW / 2, yy + l.size * 0.75, { size: l.size, align: 'center', weight: l.big ? 900 : 700, color: l.color ? remap(l.color) : PAL.ink, max: w - 60 });
    yy += l.size * 1.5;
  }
  hints(ctx, MW, MH, [['A', okLabel(ok)]], null);
}
// "PRESS A TO TRY AGAIN" → "Try again"; "PRESS A FOR THE MENU" → "Menu"; "PRESS A" → "Continue".
export const okLabel = ok => {
  const s = String(ok || 'PRESS A').replace(/^PRESS A\s*/, '').replace(/^(TO|FOR THE)\s+/, '');
  return s ? sc(s) : 'Continue';
};
// The old screens' colours (results.js picks them) mapped onto the '04 palette.
const remap = c => ({ '#f2c21a': PAL.gold, '#ff4040': PAL.bad, '#40ff60': PAL.good, '#9aa8e0': PAL.muted }[c] || c);
