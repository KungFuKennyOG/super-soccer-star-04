// Every team in the game: 32 nations for the World Cup, 17 city clubs for the Champions Cup (each cup draws 16).
// Kits are colors and patterns only (no crests, sponsors or club names). Strength is 1 (weak) to 5 (giant).
// Pure data plus a few helpers; no three, no DOM.
//
// kit: { pattern, shirt, alt, shorts, socks, band, trim, trim2, number, outline?, sleeve? }
//   pattern: 'solid' | 'stripes' (vertical) | 'hoops' (horizontal) | 'checks' | 'band' (one centre stripe)
//            | 'halves' (left half shirt, right half alt)
//            | 'sleeves' (body in shirt, sleeves in alt)
//   alt: the pattern's second color. sleeve: sleeve color (defaults to shirt, or alt for 'sleeves').
//   Only the '04 look reads these two (game/ps2/kit.js; left out, each is picked from the kit's colors):
//   cut: 0 side panels edged with piping | 1 piping curving from the collar to the armhole | 2 side panels in the trim color.
//   hoops: sock tops, 1 = two thin hoops, 0 = one band.
// A team may also carry `away`: its own change kit (same fields), worn on a clash in place of the plain one awayKit makes.
// How to design them, step by step: docs/kits.md; `node tools/kitcheck.mjs` checks them, `node tools/kitshots.mjs` draws them.

export const k = (pattern, shirt, alt, shorts, socks, trim, number, extra = {}) =>
  ({ pattern, shirt, alt: alt || shirt, shorts, socks, band: extra.band || trim, trim, trim2: extra.trim2 || trim, number, ...extra });

const W = '#f2f1ea', BLK = '#161618', NAVY = '#14204f', RED = '#c8102e', GOLD = '#f2c21a', GREEN = '#1b7a3a', SKY = '#7cbbe8';

export const NATIONS = [
  // Europe
  { id: 'GER', name: 'GERMANY', s: 5, kit: k('solid', W, null, BLK, W, BLK, BLK, { trim2: RED, cut: 0, hoops: 0 }),
    away: k('solid', BLK, null, BLK, W, '#8a1c2b', W, { cut: 0, hoops: 0 }) },
  { id: 'ITA', name: 'ITALY', s: 5, kit: k('solid', '#1d4fa8', null, W, '#1d4fa8', W, W, { trim2: W, cut: 0, hoops: 0 }),
    away: k('solid', W, null, '#1d4fa8', W, '#1d4fa8', '#1d4fa8', { trim2: W, cut: 0, hoops: 0 }) },
  { id: 'FRA', name: 'FRANCE', s: 5, kit: k('solid', '#1a3a8a', null, W, RED, RED, W, { trim2: W, cut: 0, hoops: 0 }),
    away: k('solid', W, null, W, W, '#1a3a8a', '#1a3a8a', { trim2: RED, cut: 0, hoops: 0 }) },
  { id: 'ENG', name: 'ENGLAND', s: 4, kit: k('solid', W, null, NAVY, W, RED, NAVY, { trim2: NAVY, cut: 1, hoops: 0 }),
    away: k('solid', RED, null, W, RED, W, W, { trim2: NAVY, cut: 1, hoops: 0 }) },
  { id: 'ESP', name: 'SPAIN', s: 4, kit: k('solid', RED, null, NAVY, NAVY, GOLD, GOLD, { cut: 1, hoops: 1 }),
    away: k('solid', W, null, W, W, RED, NAVY, { trim2: GOLD, cut: 1, hoops: 1 }) },
  { id: 'NED', name: 'NETHERLANDS', s: 4, kit: k('solid', '#f47a20', null, W, '#f47a20', W, W, { trim2: NAVY, cut: 1, hoops: 0 }),
    away: k('solid', W, null, '#f47a20', W, '#f47a20', '#f47a20', { cut: 1, hoops: 0 }) },
  { id: 'POR', name: 'PORTUGAL', s: 4, kit: k('solid', '#a8142a', null, GREEN, '#a8142a', GREEN, GOLD, { cut: 2, hoops: 0 }),
    away: k('solid', W, null, GREEN, '#a8142a', '#a8142a', '#a8142a', { trim2: GREEN, cut: 0, hoops: 0 }) },
  { id: 'BEL', name: 'BELGIUM', s: 3, kit: k('solid', RED, null, RED, RED, BLK, GOLD, { trim2: GOLD, cut: 0, hoops: 1 }),
    away: k('solid', W, null, BLK, W, RED, RED, { trim2: BLK, cut: 0, hoops: 1 }) },
  { id: 'CRO', name: 'CROATIA', s: 4, kit: k('checks', W, RED, W, W, '#1d3f94', '#1d3f94', { trim2: RED, cut: 2, hoops: 1 }),
    away: k('solid', '#1d3f94', null, '#1d3f94', '#1d3f94', RED, W, { trim2: W, cut: 0, hoops: 1 }) },
  { id: 'DEN', name: 'DENMARK', s: 3, kit: k('solid', RED, null, W, RED, W, W, { cut: 0, hoops: 0 }),
    away: k('solid', W, null, RED, W, RED, RED, { cut: 0, hoops: 0 }) },
  { id: 'SWE', name: 'SWEDEN', s: 3, kit: k('solid', '#ffd400', null, '#1b4fa0', '#ffd400', '#1b4fa0', '#1b4fa0', { cut: 2, hoops: 1 }),
    away: k('solid', '#1b4fa0', null, W, '#1b4fa0', '#ffd400', '#ffd400', { cut: 2, hoops: 1 }) },
  { id: 'ROU', name: 'ROMANIA', s: 3, kit: k('solid', '#f5d10a', null, '#1b4fa0', RED, '#1b4fa0', '#1b4fa0', { trim2: RED, cut: 0, hoops: 0 }),
    away: k('solid', RED, null, RED, RED, '#f5d10a', '#f5d10a', { cut: 0, hoops: 0 }) },
  { id: 'BUL', name: 'BULGARIA', s: 3, kit: k('solid', W, null, GREEN, W, GREEN, GREEN, { trim2: RED, cut: 1, hoops: 1 }),
    away: k('solid', GREEN, null, W, GREEN, W, W, { trim2: RED, cut: 1, hoops: 1 }) },
  { id: 'NOR', name: 'NORWAY', s: 3, kit: k('solid', RED, null, W, NAVY, NAVY, W, { trim2: W, cut: 2, hoops: 1 }),
    away: k('solid', W, null, NAVY, W, RED, NAVY, { trim2: NAVY, cut: 0, hoops: 1 }) },
  // South America
  { id: 'BRA', name: 'BRAZIL', s: 5, kit: k('solid', '#ffd800', null, '#1f4fb0', W, GREEN, GREEN, { cut: 1, hoops: 0 }),
    away: k('solid', '#1f4fb0', null, W, '#1f4fb0', W, W, { trim2: '#ffd800', cut: 1, hoops: 0 }) },
  { id: 'ARG', name: 'ARGENTINA', s: 5, kit: k('stripes', SKY, W, BLK, W, NAVY, NAVY, { outline: W, cut: 1, hoops: 1 }),
    away: k('solid', NAVY, null, BLK, NAVY, SKY, SKY, { cut: 1, hoops: 1 }) },
  { id: 'URU', name: 'URUGUAY', s: 3, kit: k('solid', '#74b4e8', null, BLK, BLK, W, BLK, { trim2: BLK, cut: 0, hoops: 1 }),
    away: k('solid', W, null, BLK, W, '#74b4e8', BLK, { cut: 0, hoops: 1 }) },
  { id: 'COL', name: 'COLOMBIA', s: 3, kit: k('solid', '#ffd200', null, '#1b3f9a', RED, '#1b3f9a', '#1b3f9a', { trim2: RED, cut: 1, hoops: 0 }),
    away: k('solid', '#1b3f9a', null, W, '#1b3f9a', '#ffd200', '#ffd200', { trim2: RED, cut: 1, hoops: 0 }) },
  { id: 'CHI', name: 'CHILE', s: 3, kit: k('solid', RED, null, '#1b3f9a', W, W, W, { trim2: '#1b3f9a', cut: 0, hoops: 0 }),
    away: k('solid', W, null, '#1b3f9a', '#1b3f9a', RED, '#1b3f9a', { trim2: '#1b3f9a', cut: 0, hoops: 0 }) },
  // Africa
  { id: 'NGA', name: 'NIGERIA', s: 3, kit: k('solid', '#1a8a3a', null, '#1a8a3a', '#1a8a3a', W, W, { cut: 2, hoops: 0 }),
    away: k('solid', W, null, W, W, '#1a8a3a', '#1a8a3a', { cut: 2, hoops: 0 }) },
  { id: 'CMR', name: 'CAMEROON', s: 3, kit: k('solid', '#1a8a3a', null, RED, GOLD, GOLD, GOLD, { trim2: RED, cut: 1, hoops: 1 }),
    away: k('solid', GOLD, null, '#1a8a3a', GOLD, '#1a8a3a', '#1a8a3a', { trim2: RED, cut: 1, hoops: 1 }) },
  { id: 'MAR', name: 'MOROCCO', s: 2, kit: k('solid', RED, null, GREEN, RED, GREEN, W, { cut: 0, hoops: 1 }),
    away: k('solid', GREEN, null, W, GREEN, RED, W, { trim2: W, cut: 0, hoops: 1 }) },
  { id: 'SEN', name: 'SENEGAL', s: 3, kit: k('solid', W, null, W, W, GREEN, GREEN, { trim2: GOLD, cut: 1, hoops: 1 }),
    away: k('solid', GREEN, null, GREEN, GREEN, GOLD, GOLD, { trim2: RED, cut: 1, hoops: 1 }) },
  { id: 'GHA', name: 'GHANA', s: 2, kit: k('solid', W, null, W, W, BLK, BLK, { trim2: GOLD, cut: 2, hoops: 0 }),
    away: k('solid', GOLD, null, GOLD, GOLD, BLK, BLK, { trim2: RED, cut: 2, hoops: 0 }) },
  // Asia and Oceania
  { id: 'JPN', name: 'JAPAN', s: 2, kit: k('solid', '#1a3f9a', null, W, '#1a3f9a', RED, W, { trim2: W, cut: 1, hoops: 1 }),
    away: k('solid', W, null, '#1a3f9a', W, '#1a3f9a', '#1a3f9a', { trim2: RED, cut: 1, hoops: 1 }) },
  { id: 'KOR', name: 'SOUTH KOREA', s: 2, kit: k('solid', RED, null, NAVY, RED, W, W, { trim2: NAVY, cut: 2, hoops: 0 }),
    away: k('solid', W, null, RED, W, RED, NAVY, { trim2: NAVY, cut: 2, hoops: 0 }) },
  { id: 'KSA', name: 'SAUDI ARABIA', s: 1, kit: k('solid', W, null, GREEN, W, GREEN, GREEN, { cut: 2, hoops: 0 }),
    away: k('solid', GREEN, null, W, GREEN, W, W, { cut: 2, hoops: 0 }) },
  { id: 'IRN', name: 'IRAN', s: 2, kit: k('solid', W, null, W, W, RED, GREEN, { trim2: GREEN, cut: 0, hoops: 1 }),
    away: k('solid', RED, null, RED, RED, W, W, { trim2: GREEN, cut: 0, hoops: 1 }) },
  { id: 'AUS', name: 'AUSTRALIA', s: 2, kit: k('solid', '#ffc72c', null, GREEN, '#ffc72c', GREEN, GREEN, { cut: 2, hoops: 1 }),
    away: k('solid', NAVY, null, NAVY, NAVY, '#ffc72c', '#ffc72c', { cut: 2, hoops: 1 }) },
  // North America
  { id: 'MEX', name: 'MEXICO', s: 3, kit: k('solid', '#127a3a', null, W, RED, W, W, { trim2: RED, cut: 1, hoops: 0 }),
    away: k('solid', W, null, '#127a3a', W, '#127a3a', '#127a3a', { trim2: RED, cut: 1, hoops: 0 }) },
  { id: 'USA', name: 'USA', s: 2, kit: k('solid', W, null, NAVY, W, RED, NAVY, { trim2: NAVY, cut: 2, hoops: 1 }),
    away: k('solid', NAVY, null, W, NAVY, RED, W, { trim2: W, cut: 2, hoops: 1 }) },
  { id: 'CAN', name: 'CANADA', s: 2, kit: k('solid', RED, null, RED, RED, W, W, { trim2: BLK, cut: 1, hoops: 1 }),
    away: k('solid', W, null, W, W, RED, RED, { trim2: BLK, cut: 1, hoops: 1 }) },
];

// Where each nation sits on the map: [longitude, latitude] of roughly the middle of the country.
export const NATION_POS = {
  GER: [10, 51], ITA: [12.5, 42.5], FRA: [2, 46.5], ENG: [-1.5, 52.5], ESP: [-3.7, 40.2], NED: [5.5, 52.3], POR: [-8.2, 39.6],
  BEL: [4.5, 50.6], CRO: [16, 45.2], DEN: [9.5, 56], SWE: [16, 61], ROU: [25, 45.9], BUL: [25.5, 42.7], NOR: [9, 61.5],
  BRA: [-51, -10], ARG: [-64, -34], URU: [-56, -32.8], COL: [-74, 4], CHI: [-71, -30],
  NGA: [8, 9.5], CMR: [12.5, 5.5], MAR: [-7, 32], SEN: [-14.5, 14.5], GHA: [-1.2, 7.8],
  JPN: [138, 36], KOR: [128, 36.5], KSA: [45, 24], IRN: [53, 32], AUS: [134, -25],
  MEX: [-102, 23.5], USA: [-98, 39], CAN: [-106, 56],
};

// The nation you reach by pushing the stick in a direction on the map ('left' | 'right' | 'up' | 'down'):
// the closest one that way, wrapping round the globe left and right. null if there's none.
export function nationToward(fromId, dir, ids = NATIONS.map(n => n.id)) {
  const [x0, y0] = NATION_POS[fromId];
  const want = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] }[dir];
  let best = null, bestScore = Infinity;
  for (const id of ids) {
    if (id === fromId) continue;
    const [x, y] = NATION_POS[id];
    const dx = ((x - x0 + 540) % 360) - 180, dy = y - y0, d = Math.hypot(dx, dy);
    const cos = (dx * want[0] + dy * want[1]) / d;
    if (cos < 0.35) continue;
    const score = d * (1 + 2.5 * (1 - cos));
    if (score < bestScore) { bestScore = score; best = id; }
  }
  return best;
}

export const CLUBS = [
  { id: 'MAD', name: 'MADRID', s: 5, kit: k('solid', W, null, W, W, '#2b2f6b', '#2b2f6b', { trim2: '#d9b23a', cut: 0, hoops: 0 }),
    away: k('solid', '#1a2350', null, '#1a2350', '#1a2350', SKY, SKY, { cut: 0, hoops: 0 }) },
  { id: 'BAR', name: 'BARCELONA', s: 5, kit: k('stripes', '#1d3f94', '#9a1c3c', NAVY, NAVY, NAVY, GOLD, { band: '#9a1c3c', sleeve: '#9a1c3c', outline: NAVY, trim2: GOLD, cut: 1, hoops: 1 }),
    away: k('solid', W, null, W, W, '#1d3f94', '#1d3f94', { trim2: '#9a1c3c', cut: 1, hoops: 1 }) },
  { id: 'MUN', name: 'MUNICH', s: 5, kit: k('solid', '#d00027', null, '#162a6b', '#d00027', W, W, { trim2: '#162a6b', cut: 1, hoops: 0 }),
    away: k('solid', W, null, W, W, '#8a8d93', '#5a5d63', { trim2: '#d00027', cut: 1, hoops: 0 }) }, // red and navy, so it never reads as Liverpool
  { id: 'MRB', name: 'MILAN RED/BLACK', s: 5, kit: k('stripes', '#c4161c', BLK, W, BLK, W, W, { outline: BLK, cut: 0, hoops: 1 }),
    away: k('solid', W, null, W, W, '#c4161c', BLK, { trim2: BLK, cut: 0, hoops: 1 }) },
  { id: 'MAN', name: 'MANCHESTER', s: 4, kit: k('solid', '#d0101e', null, W, BLK, BLK, W, { trim2: W, cut: 0, hoops: 0 }),
    away: k('solid', BLK, null, BLK, BLK, '#d0101e', W, { cut: 0, hoops: 0 }) },
  { id: 'LIV', name: 'LIVERPOOL', s: 4, kit: k('solid', RED, null, RED, RED, W, W, { cut: 2, hoops: 1 }),
    away: k('solid', W, null, BLK, W, RED, RED, { trim2: BLK, cut: 2, hoops: 1 }) },
  { id: 'LDR', name: 'LONDON RED', s: 4, kit: k('sleeves', '#db0007', W, W, W, W, W, { band: '#db0007', trim2: '#db0007', cut: 0, hoops: 0 }),
    away: k('solid', '#f5d10a', null, NAVY, '#f5d10a', NAVY, NAVY, { cut: 0, hoops: 0 }) },
  { id: 'LDB', name: 'LONDON BLUE', s: 4, kit: k('solid', '#034694', null, '#034694', W, W, W, { cut: 0, hoops: 1 }),
    away: k('band', W, null, '#034694', W, '#034694', '#034694', { band: '#034694', cut: 0, hoops: 1 }) },
  { id: 'TUR', name: 'TURIN', s: 4, kit: k('stripes', BLK, W, W, W, BLK, GOLD, { outline: BLK, sleeve: BLK, trim2: GOLD, cut: 2, hoops: 0 }),
    away: k('solid', '#e88aae', null, BLK, '#e88aae', BLK, BLK, { trim2: W, cut: 2, hoops: 0 }) },
  { id: 'MBB', name: 'MILAN BLUE/BLACK', s: 4, kit: k('stripes', '#0a3ea0', BLK, BLK, BLK, GOLD, W, { outline: BLK, cut: 1, hoops: 1 }),
    away: k('solid', W, null, W, W, '#0a3ea0', BLK, { trim2: BLK, cut: 1, hoops: 1 }) },
  { id: 'DOR', name: 'DORTMUND', s: 4, kit: k('solid', '#fde100', null, BLK, '#fde100', BLK, BLK, { cut: 2, hoops: 0 }),
    away: k('solid', BLK, null, BLK, BLK, '#fde100', '#fde100', { cut: 2, hoops: 0 }) },
  { id: 'PAR', name: 'PARIS', s: 4, kit: k('band', '#0b2a5b', RED, '#0b2a5b', '#0b2a5b', RED, W, { trim2: W, cut: 1, hoops: 1 }),
    away: k('sleeves', W, RED, '#0b2a5b', W, RED, '#0b2a5b', { trim2: '#0b2a5b', cut: 1, hoops: 1 }) },
  { id: 'AMS', name: 'AMSTERDAM', s: 3, kit: k('band', W, '#d2122e', W, W, '#d2122e', BLK, { cut: 0, hoops: 0 }),
    away: k('solid', NAVY, null, W, NAVY, '#f2c21a', W, { cut: 0, hoops: 0 }) },
  { id: 'PRT', name: 'PORTO', s: 3, kit: k('stripes', '#1f3e93', W, '#1f3e93', '#1f3e93', W, GOLD, { outline: '#1f3e93', sleeve: '#1f3e93', cut: 2, hoops: 1 }),
    away: k('solid', '#8e3a9e', null, BLK, BLK, BLK, W, { cut: 2, hoops: 1 }) },
  { id: 'LIS', name: 'LISBON', s: 3, kit: k('solid', RED, null, W, RED, W, W, { cut: 1, hoops: 0 }),
    away: k('solid', W, null, W, W, RED, RED, { cut: 1, hoops: 0 }) },
  { id: 'GLA', name: 'GLASGOW', s: 2, kit: k('hoops', GREEN, W, W, W, W, BLK, { trim2: GREEN, cut: 0, hoops: 1 }),
    away: k('solid', '#f2c21a', null, GREEN, '#f2c21a', GREEN, GREEN, { cut: 0, hoops: 1 }) },
  { id: 'IST', name: 'ISTANBUL', s: 3, kit: k('halves', '#f6b81a', '#b5121b', '#b5121b', '#b5121b', '#b5121b', W, { outline: '#7a0c12', trim2: '#f6b81a', cut: 1, hoops: 0 }),
    away: k('solid', W, null, W, W, '#b5121b', '#b5121b', { trim2: '#f6b81a', cut: 1, hoops: 0 }) },
];

export const ALL = [...NATIONS, ...CLUBS];
export const byId = id => ALL.find(t => t.id === id);
export const teamsFor = cup => (cup === 'world' ? NATIONS : CLUBS);

/* ---------- kit helpers ---------- */

const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const colorDist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const light = hex => { const [r, g, b] = rgb(hex); return 0.3 * r + 0.59 * g + 0.11 * b; };

// Do two kits look too alike to play each other?
export function kitsClash(a, b) {
  return colorDist(a.shirt, b.shirt) < 110 || (colorDist(a.shirt, b.alt) < 90 && colorDist(a.alt, b.shirt) < 90);
}

// A plain change kit: white with the home colors as trim, or dark navy if the home kit is pale.
export function awayKit(kit) {
  const pale = light(kit.shirt) > 170;
  const shirt = pale ? '#1a2350' : '#f2f1ea', other = pale ? '#f2f1ea' : kit.shirt;
  return { pattern: 'solid', shirt, alt: shirt, shorts: pale ? '#1a2350' : '#f2f1ea', socks: shirt, band: other, trim: other, trim2: other, number: other };
}

// A team's change kit: its own if it has one, else the plain one.
export const awayFor = team => team.away || awayKit(team.kit);

// The opponent's kit for a match against `home`: their own, or the change kit on a clash.
export function matchKit(opp, home) {
  return kitsClash(opp.kit, home.kit) ? awayFor(opp) : opp.kit;
}

// Goalkeeper kit: green, or yellow if the team plays in green.
export function keeperKit(teamKit) {
  const greenish = colorDist(teamKit.shirt, '#1b7a3a') < 120;
  const shirt = greenish ? '#e8c820' : '#29a35a';
  return { pattern: 'solid', shirt, alt: shirt, shorts: '#151515', socks: shirt, band: '#111111', trim: '#111111', trim2: '#e8e050', number: '#111111', gloves: true };
}
