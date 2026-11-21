// The match HUD painted in the '04 style (game/ps2/ui.js): the scoreboard bug, the stadium's big board,
// event banners, the pass target's tag, the commentary subtitle, the training card and the wrist radar.
// Flat and small like an early-2000s TV score bug: near-black translucent bars, a thin light outline, plain white
// type, maroon for the score and the headline that's yours. Pure painting onto 2D canvases; game/hud.js,
// commentary.js and training.js own the planes they sit on.
import { PAL, text, measure, wrap, box, maroon, rr, teamChip, glyph, sc, NAME } from './ui.js';

// The scoreboard bug: chip, short name, score, short name, chip, then the clock; in Score Attack (no opponent
// score) your goals. Points in a small strip under it. BW x BH, transparent round it.
export const BW = 640, BH = 128;
export function paintBug(ctx, { home, away, us, them, goals, points, clock, flash }) {
  ctx.clearRect(0, 0, BW, BH);
  const h = 66, y = 4, cup = us !== undefined, cw = 140;
  const scoreW = cup ? 118 : 160;
  let x = 18;
  x += teamChip(ctx, home, x, y + 19, 30) + 10;
  x += text(ctx, home.id, x, y + h / 2, { size: 36 }) + 14;
  maroon(ctx, x, y + 2, scoreW, h - 4);
  text(ctx, cup ? `${us}-${them}` : `${goals}`, x + (cup ? scoreW / 2 : 34), y + h / 2, { size: 38, align: 'center', weight: 900 });
  if (!cup) text(ctx, goals === 1 ? 'Goal' : 'Goals', x + 64, y + h / 2, { size: 28, color: PAL.soft });
  x += scoreW + 14;
  if (cup) { x += text(ctx, away.id, x, y + h / 2, { size: 36 }) + 10; x += teamChip(ctx, away, x, y + 19, 30); x += 14; }
  ctx.fillStyle = 'rgba(230,230,230,0.9)'; ctx.fillRect(x - 6, y + 2, 2, h - 4);
  if (flash) maroon(ctx, x - 4, y + 2, cw + 2, h - 4);
  text(ctx, flash ? 'GOAL!' : clock, x + cw / 2 - 6, y + h / 2, { size: flash ? 34 : 38, align: 'center', weight: flash ? 900 : 700, max: cw - 16 });
  // the bar under all that, hugging it, and its outline over it
  const w = x + cw - 4;
  ctx.save(); ctx.globalCompositeOperation = 'destination-over'; rr(ctx, 2, y, w, h, 4); ctx.fillStyle = 'rgba(8,8,10,0.82)'; ctx.fill(); ctx.restore();
  box(ctx, 2, y, w, h, { r: 4, fill: null });
  // points under it
  const pts = `${points} pts`, pw = measure(ctx, pts, 30) + 32;
  box(ctx, 2, y + h + 4, pw, 44, { r: 4, fill: 'rgba(8,8,10,0.82)' });
  text(ctx, pts, 2 + pw / 2, y + h + 26, { size: 30, align: 'center', color: PAL.gold });
}

// The big screen over the stand behind the goal: SW x SH.
export const SW = 512, SH = 192;
export function paintBoard(ctx, { goals, clock, points, flash, score }) {
  ctx.fillStyle = '#050506'; ctx.fillRect(0, 0, SW, SH);
  maroon(ctx, 0, 0, SW, 40);
  text(ctx, NAME, SW / 2, 20, { size: 26, align: 'center', weight: 900 });
  if (flash) {
    const on = Math.floor(performance.now() / 150) % 2;
    text(ctx, flash, SW / 2, 104, { size: 96, align: 'center', weight: 900, color: on ? PAL.gold : PAL.ink });
  } else if (score) {
    text(ctx, score, SW / 2, 76, { size: 46, align: 'center', weight: 900 });
    text(ctx, clock, SW / 2, 128, { size: 58, align: 'center', weight: 900, color: PAL.gold });
  } else {
    text(ctx, 'Goals', 24, 66, { size: 28, color: PAL.muted });
    text(ctx, String(goals).padStart(2, '0'), 24, 116, { size: 72, weight: 900 });
    text(ctx, 'Time', SW - 24, 66, { size: 28, color: PAL.muted, align: 'right' });
    text(ctx, clock, SW - 24, 116, { size: 72, weight: 900, align: 'right', color: PAL.gold });
  }
  text(ctx, `${points} pts`, SW / 2, 168, { size: 32, align: 'center', color: PAL.soft });
}

// An event banner: the headline on a flat bar (maroon when it's good for you, near-black otherwise, the text red
// when it's bad), up to three lines under it in a box. Kept compact: it shares the sky with the stadium board.
export const NW = 768, NH = 256;
export function paintBanner(ctx, b) {
  ctx.clearRect(0, 0, NW, NH);
  const size = b.text.length > 15 ? 44 : 54, bh = size * 1.5;
  const tw = Math.min(NW - 20, measure(ctx, b.text, size, { weight: 900 }) + 90), x = (NW - tw) / 2, top = 6;
  if (b.tone === 'good') { maroon(ctx, x, top, tw, bh, 5); box(ctx, x, top, tw, bh, { r: 5, fill: null }); } else box(ctx, x, top, tw, bh, { r: 5, fill: 'rgba(8,8,10,0.84)' });
  text(ctx, b.text, NW / 2, top + bh / 2, { size, align: 'center', weight: 900, color: b.tone === 'bad' ? PAL.bad : PAL.ink, max: tw - 40 });
  const subs = (b.sub ? b.sub.split('\n') : []).slice(0, 3).map(l => sc(l));
  if (!subs.length) return;
  const ss = 30, lh = 40, sw = Math.min(NW - 40, Math.max(...subs.map(l => measure(ctx, l, ss))) + 60);
  box(ctx, (NW - sw) / 2, top + bh + 4, sw, subs.length * lh + 14, { r: 5, fill: 'rgba(8,8,10,0.78)' });
  subs.forEach((l, i) => text(ctx, l, NW / 2, top + bh + 11 + lh / 2 + i * lh, { size: ss, align: 'center', max: sw - 30 }));
}

// The tag over the teammate you'd pass to: his number, and "Lob" when the pass will go over the top.
export const TW = 256, TH = 96;
export function paintTag(ctx, { num, lob }) {
  ctx.clearRect(0, 0, TW, TH);
  const w = lob ? 210 : 100, x = (TW - w) / 2;
  box(ctx, x, 14, w, 68, { r: 6, fill: 'rgba(8,8,10,0.84)', lw: 3 });
  if (lob) {
    maroon(ctx, x + 3, 17, 88, 62);
    text(ctx, num ? String(num) : '', x + 47, 48, { size: 44, align: 'center', weight: 900 });
    text(ctx, 'Lob', x + 150, 48, { size: 42, align: 'center', color: '#9fd6ff' });
  } else text(ctx, num ? String(num) : '', TW / 2, 48, { size: 46, align: 'center', weight: 900 });
}

// The commentary subtitle: up to two lines, sentence case, in a dark box with a thin outline.
export const UW = 1024, UH = 128;
export function paintSubtitle(ctx, s) {
  ctx.clearRect(0, 0, UW, UH);
  const size = 38, lines = wrap(ctx, sc(s), UW - 80, size).slice(0, 2);
  const w = Math.min(UW - 8, Math.max(...lines.map(l => measure(ctx, l, size))) + 56), h = lines.length * 48 + 16;
  const x = (UW - w) / 2, y = (UH - h) / 2;
  box(ctx, x, y, w, h, { r: 5, fill: 'rgba(8,8,10,0.8)' });
  lines.forEach((l, i) => text(ctx, l, UW / 2, y + 8 + 24 + i * 48, { size, align: 'center', max: UW - 60 }));
}

// The training card: drill number and name on a maroon row, the instructions, a progress bar and the skip key.
export const CW = 896, CH = 208;
export function paintTraining(ctx, { i, total, title, lines, need, n, unit, done, finished, vr }) {
  ctx.clearRect(0, 0, CW, CH);
  box(ctx, 0, 0, CW, CH, { r: 6, fill: 'rgba(8,8,10,0.9)' });
  maroon(ctx, 2, 2, CW - 4, 54);
  ctx.fillStyle = PAL.sep; ctx.fillRect(2, 56, CW - 4, 2);
  text(ctx, `${i}/${total}`, 24, 29, { size: 28, color: PAL.gold });
  text(ctx, sc(title), 120, 29, { size: 32, weight: 900, max: CW - 330 });
  const kx = CW - 150;
  glyph(ctx, vr ? 'X' : 'N', kx, 29, 40);
  text(ctx, 'Skip', kx + 52, 29, { size: 28 });
  if (done) {
    text(ctx, finished ? 'Training complete!' : 'Nice one!', CW / 2, 132, { size: 54, align: 'center', weight: 900, color: PAL.good });
    return;
  }
  // the drill's lines are cased as one text (a line that carries on a sentence stays lower case), kept as written
  const words = sc(lines.join(' ')).split(' ');
  let at = 0;
  lines.slice(0, 3).forEach((l, j) => { const n = l.split(' ').length; text(ctx, words.slice(at, at + n).join(' '), 26, 86 + j * 36, { size: 29, max: CW - 52 }); at += n; });
  const bx = 26, by = CH - 34, bw = CW - 230, f = Math.max(0, Math.min(1, n / need));
  rr(ctx, bx, by, bw, 18, 3); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
  if (f > 0) maroon(ctx, bx, by, Math.max(6, bw * f), 18, 3);
  box(ctx, bx, by, bw, 18, { r: 3, fill: null, lw: 1.5 });
  text(ctx, `${Math.floor(n)} / ${need}${unit ? ' ' + unit.toLowerCase() : ''}`, CW - 26, by + 9, { size: 27, align: 'right', color: PAL.soft });
}

// The wrist radar: the half pitch with every player, and your goals and points under it. RW x RH.
export const RW = 128, RH = 120, RMAP = 92;
export function paintRadar(ctx, world, goals, points, px, pz, goalW) {
  ctx.clearRect(0, 0, RW, RH);
  box(ctx, 0, 0, RW, RH, { r: 5, fill: 'rgba(8,8,10,0.88)', lw: 1.5 });
  ctx.save(); ctx.beginPath(); ctx.rect(4, 4, RW - 8, RMAP - 4); ctx.clip();
  ctx.fillStyle = 'rgba(58,92,56,0.95)'; ctx.fillRect(4, 4, RW - 8, RMAP - 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(px(-16), 4, px(16) - px(-16), pz(goalW.box) - 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(px(-3.66), 3, px(3.66) - px(-3.66), 4);
  for (const p of world.players) {
    const col = p.role === 'you' ? PAL.gold : p.team === 'home' ? '#f2f1ea' : p.role === 'gk' ? '#29d06a' : '#e0453a';
    ctx.beginPath(); ctx.arc(px(p.x), pz(p.z), p.role === 'you' ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(px(world.ball.x), pz(world.ball.z), 2.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
  text(ctx, `G ${goals}`, 10, RMAP + 14, { size: 22, color: PAL.gold });
  text(ctx, String(points), RW - 10, RMAP + 14, { size: 22, align: 'right' });
}
