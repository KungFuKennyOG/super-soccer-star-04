// The match HUD painted in the '04 style (game/ps2/ui.js): the scoreboard bug, the stadium's big board,
// event banners, the pass target's tag, the commentary subtitle, the training card and the wrist radar.
// Pure painting onto 2D canvases; game/hud.js, commentary.js and training.js own the planes they sit on.
import { PAL, text, measure, wrap, panel, gloss, rr, teamChip, button, NAME } from './ui.js';

const toneBar = { good: 'amber', bad: ['#ff6a5a', '#9a1414'], info: 'blue' };

// The scoreboard bug: home chip, short name, score, away short name, chip, then the clock. In Score Attack
// (no opponent score) it's your goals and points. BW x BH; drawn with a transparent surround.
export const BW = 640, BH = 128;
export function paintBug(ctx, { home, away, us, them, goals, points, clock, flash }) {
  ctx.clearRect(0, 0, BW, BH);
  const h = 72, y = 6, cup = us !== undefined;
  gloss(ctx, 4, y, 452, h, { kind: ['#2c3a5c', '#0b1324'], r: 14 });
  gloss(ctx, 456, y, 180, h, { kind: flash ? 'amber' : ['#e04040', '#7a0c16'], r: 14, corners: [0, 14, 14, 0] });
  let x = 18;
  x += teamChip(ctx, home, x, y + 16, 40) + 12;
  x += text(ctx, home.id, x, y + h / 2, { size: 40, weight: 900 }) + 14;
  if (cup) {
    gloss(ctx, x, y + 10, 104, h - 20, { kind: ['#ffffff', '#c9d3e6'], r: 8 });
    text(ctx, `${us} - ${them}`, x + 52, y + h / 2, { size: 40, weight: 900, align: 'center', color: PAL.deep, shadow: false, squash: 0.9 });
    x += 118;
    x += text(ctx, away.id, x, y + h / 2, { size: 40, weight: 900 }) + 12;
    teamChip(ctx, away, x, y + 16, 40);
  } else {
    gloss(ctx, x, y + 10, 70, h - 20, { kind: ['#ffffff', '#c9d3e6'], r: 8 });
    text(ctx, String(goals), x + 35, y + h / 2, { size: 40, weight: 900, align: 'center', color: PAL.deep, shadow: false });
    x += 84;
    text(ctx, 'GOALS', x, y + h / 2, { size: 36, weight: 800, color: PAL.soft, max: 452 - x - 10 });
  }
  text(ctx, flash || clock, 546, y + h / 2, { size: flash ? 38 : 44, weight: 900, align: 'center', italic: !!flash, color: flash ? PAL.deep : PAL.ink, shadow: !flash, max: 166 });
  // points strip under it
  const pts = `${points} PTS`, pw = measure(ctx, pts, 38, { weight: 900 }) + 40;
  gloss(ctx, 14, y + h + 2, pw, 44, { kind: ['#3a4a6c', '#141d32'], r: 0, corners: [0, 0, 10, 10] });
  text(ctx, pts, 14 + pw / 2, y + h + 24, { size: 38, weight: 900, align: 'center', color: PAL.accent });
}

// The big screen over the stand behind the goal: SW x SH.
export const SW = 512, SH = 192;
export function paintBoard(ctx, { goals, clock, points, flash, score }) {
  const g = ctx.createLinearGradient(0, 0, 0, SH); g.addColorStop(0, '#0e1a33'); g.addColorStop(1, '#050a16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
  gloss(ctx, 0, 0, SW, 40, { kind: 'blue', r: 0 });
  text(ctx, NAME, SW / 2, 20, { size: 28, align: 'center', italic: true, weight: 900 });
  if (flash) {
    const on = Math.floor(performance.now() / 150) % 2;
    text(ctx, flash, SW / 2, 100, { size: 96, align: 'center', italic: true, weight: 900, color: on ? PAL.accent : PAL.ink, glow: 'rgba(255,190,40,0.8)' });
  } else if (score) {
    text(ctx, score, SW / 2, 74, { size: 46, align: 'center', weight: 900, color: PAL.accent });
    text(ctx, clock, SW / 2, 128, { size: 60, align: 'center', weight: 900 });
  } else {
    text(ctx, 'GOALS', 24, 64, { size: 28, weight: 800, color: PAL.info });
    text(ctx, String(goals).padStart(2, '0'), 24, 116, { size: 72, weight: 900, color: PAL.accent });
    text(ctx, 'TIME', SW - 24, 64, { size: 28, weight: 800, color: PAL.info, align: 'right' });
    text(ctx, clock, SW - 24, 116, { size: 72, weight: 900, align: 'right' });
  }
  text(ctx, `PTS ${points}`, SW / 2, 168, { size: 34, align: 'center', weight: 800, color: PAL.soft });
}

// An event banner: the headline on a glossy bar coloured by tone, up to three lines under it on dark glass.
export const NW = 768, NH = 256;
export function paintBanner(ctx, b) {
  ctx.clearRect(0, 0, NW, NH);
  const size = b.text.length > 15 ? 48 : 64, bh = size * 1.45;
  const tw = Math.min(NW - 110, measure(ctx, b.text, size, { weight: 900, italic: true }) + 80), x = (NW - tw) / 2;
  const tone = toneBar[b.tone] || 'blue';
  const top = 20;                         // room for the glow above the bar
  gloss(ctx, x, top, tw, bh, { kind: tone, r: bh * 0.3, glow: b.tone === 'good' ? 'rgba(255,170,40,0.7)' : b.tone === 'bad' ? 'rgba(255,60,40,0.6)' : 'rgba(80,160,255,0.6)' });
  text(ctx, b.text, NW / 2, top + bh / 2, { size, align: 'center', italic: true, weight: 900, color: b.tone === 'good' ? PAL.deep : PAL.ink, shadow: b.tone !== 'good', max: tw - 40 });
  const subs = (b.sub ? b.sub.split('\n') : []).slice(0, 3);
  if (!subs.length) return;
  const ss = 32, lh = 40, sw = Math.min(NW - 80, Math.max(...subs.map(s => measure(ctx, s, ss, { weight: 800 }))) + 60);
  panel(ctx, (NW - sw) / 2, top + bh + 6, sw, subs.length * lh + 16, { r: 12, alpha: 0.82 });
  subs.forEach((s, i) => text(ctx, s, NW / 2, top + bh + 14 + lh / 2 + i * lh, { size: ss, align: 'center', weight: 800, max: sw - 30 }));
}

// The tag over the teammate you'd pass to: his number, and LOB when the pass will go over the top.
export const TW = 256, TH = 96;
export function paintTag(ctx, { num, lob }) {
  ctx.clearRect(0, 0, TW, TH);
  const w = lob ? 236 : 120, x = (TW - w) / 2;
  gloss(ctx, x, 14, w, 68, { kind: lob ? ['#7fd6ff', '#1b6fb4'] : 'amber', r: 34 });
  if (lob) {
    text(ctx, num ? String(num) : '', x + 44, 48, { size: 42, align: 'center', weight: 900, color: PAL.ink });
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x + 86, 26, 3, 44);
    text(ctx, 'LOB', x + 160, 48, { size: 44, align: 'center', italic: true, weight: 900 });
  } else text(ctx, num ? String(num) : '', TW / 2, 48, { size: 46, align: 'center', weight: 900, color: PAL.deep, shadow: false });
}

// The commentary subtitle: up to two lines on a dark rounded strip with an amber underline.
export const UW = 1024, UH = 128;
export function paintSubtitle(ctx, s) {
  ctx.clearRect(0, 0, UW, UH);
  const size = 40, lines = wrap(ctx, s, UW - 80, size, { weight: 700 }).slice(0, 2);
  const w = Math.min(UW - 8, Math.max(...lines.map(l => measure(ctx, l, size, { weight: 700 }))) + 56), h = lines.length * 50 + 14;
  const x = (UW - w) / 2, y = (UH - h) / 2;
  panel(ctx, x, y, w, h, { r: 14, alpha: 0.84, rim: false });
  ctx.fillStyle = PAL.accent; ctx.fillRect(x + 14, y + h - 5, w - 28, 4);
  lines.forEach((l, i) => text(ctx, l, UW / 2, y + 7 + 25 + i * 50, { size, align: 'center', weight: 700, max: UW - 60 }));
}

// The training card: drill number and name on a tab, the instructions, a progress bar and the skip key.
export const CW = 896, CH = 208;
export function paintTraining(ctx, { i, total, title, lines, need, n, unit, done, finished, vr }) {
  ctx.clearRect(0, 0, CW, CH);
  panel(ctx, 0, 30, CW, CH - 30, { r: 18, alpha: 0.95 });
  gloss(ctx, 16, 2, CW - 32, 54, { kind: 'blue', r: 12, corners: [14, 14, 4, 4] });
  text(ctx, `${i} / ${total}`, 36, 29, { size: 30, weight: 900, color: PAL.accent });
  text(ctx, title, 140, 29, { size: 34, italic: true, weight: 900, max: CW - 330 });
  const k = vr ? 'X' : 'N', kx = CW - 160;
  button(ctx, k, kx, 29, 46);
  text(ctx, 'SKIP', kx + 52, 29, { size: 30, weight: 800, color: PAL.soft });
  if (done) {
    const msg = finished ? 'TRAINING COMPLETE!' : 'NICE ONE!';
    text(ctx, msg, CW / 2, 128, { size: 64, align: 'center', italic: true, weight: 900, color: PAL.good, glow: 'rgba(90,230,120,0.6)' });
    return;
  }
  lines.slice(0, 3).forEach((l, j) => text(ctx, l, 28, 82 + j * 36, { size: 30, weight: 700, max: CW - 56 }));
  const bx = 28, by = CH - 34, bw = CW - 240, f = Math.max(0, Math.min(1, n / need));
  rr(ctx, bx, by, bw, 20, 10); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  if (f > 0) gloss(ctx, bx, by, Math.max(20, bw * f), 20, { kind: [PAL.amberHi, PAL.amberLo], r: 10 });
  text(ctx, `${Math.floor(n)} / ${need}${unit ? ' ' + unit : ''}`, CW - 28, by + 10, { size: 28, align: 'right', weight: 800, color: PAL.soft });
}

// The wrist radar: the half pitch with every player, and your goals and points under it. RW x RH.
export const RW = 128, RH = 120, RMAP = 92;
export function paintRadar(ctx, world, goals, points, px, pz, goalW) {
  ctx.clearRect(0, 0, RW, RH);
  rr(ctx, 0, 0, RW, RH, 10); ctx.fillStyle = 'rgba(6,12,26,0.9)'; ctx.fill();
  ctx.save(); rr(ctx, 4, 4, RW - 8, RMAP - 4, 6); ctx.clip();
  const g = ctx.createLinearGradient(0, 4, 0, RMAP); g.addColorStop(0, 'rgba(60,140,70,0.9)'); g.addColorStop(1, 'rgba(30,90,40,0.9)');
  ctx.fillStyle = g; ctx.fillRect(4, 4, RW - 8, RMAP - 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(px(-16), 4, px(16) - px(-16), pz(goalW.box) - 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(px(-3.66), 3, px(3.66) - px(-3.66), 4);
  for (const p of world.players) {
    const col = p.role === 'you' ? PAL.accent : p.team === 'home' ? '#f2f1ea' : p.role === 'gk' ? '#29d06a' : '#ff5a4e';
    ctx.beginPath(); ctx.arc(px(p.x), pz(p.z), p.role === 'you' ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(px(world.ball.x), pz(world.ball.z), 2.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
  text(ctx, `G ${goals}`, 10, RMAP + 14, { size: 22, weight: 900, color: PAL.accent });
  text(ctx, String(points), RW - 10, RMAP + 14, { size: 22, weight: 900, align: 'right' });
}

