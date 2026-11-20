// How a team's players look: skin tone, hair color and hairstyle, drawn from weights per team so a squad
// looks the way that country's (or that club's 2003-04) players plausibly did. Every face is still an
// invented one: no real players, likenesses or names. Pure data and a seeded picker; no three, no DOM.
// Sources and reasoning per team: docs/notes-looks.md.
//
// A team's weights are over GROUPS, clusters of appearance (a range of tones, the hair colors and styles
// that go with them, a few paint-only face settings), not over nationalities: a Dutch side of Surinamese
// heritage and a French side of Caribbean heritage both draw from 'black' and 'mixed'.

// Skin tones, fair to deep (base colors; the '04 look warms them a little, game/ps2/player.js).
export const TONES = [
  '#ecc4a5',   // 0 fair, rosy
  '#e6bb95',   // 1 fair, warm
  '#d7a87d',   // 2 light olive
  '#e7c29b',   // 3 light, golden (East Asian)
  '#c79363',   // 4 olive / tan
  '#ab7448',   // 5 light brown
  '#8a5634',   // 6 brown
  '#6a3f26',   // 7 dark brown
  '#4e2d1b',   // 8 deep brown
  '#d8ad80',   // 9 golden, deeper (East Asian)
];
// Hair colors.
export const HAIRS = ['#0d0d0d', '#1a110a', '#3b2513', '#5a3b22', '#9a7034', '#c29a5c', '#6e3418'];
// 0 black, 1 near-black, 2 dark brown, 3 mid brown (also the dyed brown of 2002 Japan and Korea), 4 dark blonde, 5 blonde, 6 auburn
export const STYLES = ['crop', 'shaved', 'slick', 'long', 'curls'];
// as the bodies number them: the '04 look's HAIR2 (game/ps2/headgeo.js) and the PS1 look's HAIR_STYLES (game/hair.js;
// it has no slicked style, so slick is its crop; long alternates long and mullet)
export const STYLE_PS2 = { crop: 0, shaved: 1, slick: 2, long: 3, curls: 4 };
export const stylePS1 = (style, face) => ({ crop: face % 4 === 3 ? 5 : 0, shaved: 2, slick: 0, long: face % 2 ? 3 : 4, curls: 1 })[style];

// tone, hair, style: weights over TONES, HAIRS, STYLES (sparse: index or name → weight).
// eyes: which iris colors face.js may pick ('light' mostly blue, grey, green; 'any'; 'dark' browns only).
// stubble: chance of any stubble or beard. feat: paint-only face settings for game/ps2/face.js (all subtle:
// crease = how marked the upper lid's fold is, open = how wide the eye is open, tilt = lift at the outer
// corner, arch = how arched the brows are).
export const GROUPS = {
  north: { tone: { 0: 0.55, 1: 0.4, 2: 0.05 }, hair: { 5: 0.25, 4: 0.3, 3: 0.25, 2: 0.12, 6: 0.08 }, style: { crop: 0.45, slick: 0.25, shaved: 0.12, long: 0.13, curls: 0.05 }, eyes: 'light', stubble: 0.65 },
  west: { tone: { 0: 0.3, 1: 0.5, 2: 0.2 }, hair: { 5: 0.08, 4: 0.18, 3: 0.3, 2: 0.32, 1: 0.07, 6: 0.05 }, style: { crop: 0.5, slick: 0.22, shaved: 0.14, long: 0.09, curls: 0.05 }, eyes: 'any', stubble: 0.65 },
  south: { tone: { 1: 0.3, 2: 0.5, 4: 0.2 }, hair: { 3: 0.1, 2: 0.4, 1: 0.43, 0: 0.07 }, style: { crop: 0.42, slick: 0.25, long: 0.18, shaved: 0.1, curls: 0.05 }, eyes: 'any', stubble: 0.75 },
  mena: { tone: { 1: 0.1, 2: 0.4, 4: 0.4, 5: 0.1 }, hair: { 2: 0.1, 1: 0.45, 0: 0.45 }, style: { crop: 0.5, slick: 0.2, shaved: 0.2, curls: 0.1 }, eyes: 'dark', stubble: 0.88, feat: { arch: 0.8 } },
  eastAsia: { tone: { 3: 0.65, 9: 0.35 }, hair: { 0: 0.62, 1: 0.3, 3: 0.08 }, style: { crop: 0.5, slick: 0.32, shaved: 0.1, long: 0.08 }, eyes: 'dark', stubble: 0.35, feat: { crease: 0.4, open: 0.88, tilt: 0.004, arch: 0.55 } },
  mestizo: { tone: { 2: 0.25, 4: 0.5, 5: 0.25 }, hair: { 0: 0.55, 1: 0.45 }, style: { crop: 0.45, slick: 0.2, long: 0.2, shaved: 0.1, curls: 0.05 }, eyes: 'dark', stubble: 0.6, feat: { crease: 0.8, arch: 0.8 } },
  mixed: { tone: { 4: 0.1, 5: 0.45, 6: 0.45 }, hair: { 0: 0.55, 1: 0.45 }, style: { crop: 0.3, shaved: 0.3, curls: 0.3, slick: 0.1 }, eyes: 'dark', stubble: 0.6 },
  black: { tone: { 6: 0.3, 7: 0.45, 8: 0.25 }, hair: { 0: 1 }, style: { shaved: 0.45, crop: 0.3, curls: 0.25 }, eyes: 'dark', stubble: 0.55 },
};
export const GROUP_IDS = Object.keys(GROUPS);

// Per team: weights over GROUPS. Nations follow what their squads looked like around 2002-06 (where that
// differs from the census, the squad wins: docs/notes-looks.md has both), clubs their 2003-04 squads.
export const LOOKS = {
  // Europe
  GER: { west: 0.7, north: 0.12, south: 0.1, mixed: 0.05, black: 0.03 },
  ITA: { south: 0.85, west: 0.15 },
  FRA: { black: 0.45, mixed: 0.15, west: 0.25, south: 0.07, mena: 0.08 },
  ENG: { west: 0.63, north: 0.05, black: 0.2, mixed: 0.12 },
  ESP: { south: 0.9, west: 0.05, mixed: 0.05 },
  NED: { west: 0.5, north: 0.2, black: 0.17, mixed: 0.08, mestizo: 0.05 },
  POR: { south: 0.85, black: 0.08, mixed: 0.07 },
  BEL: { west: 0.8, north: 0.05, south: 0.05, black: 0.1 },
  CRO: { south: 0.65, west: 0.35 },
  DEN: { north: 0.85, west: 0.15 },
  SWE: { north: 0.8, west: 0.1, south: 0.06, mixed: 0.04 },
  ROU: { south: 0.8, west: 0.2 },
  BUL: { south: 0.85, west: 0.1, mena: 0.05 },
  NOR: { north: 0.85, west: 0.1, mixed: 0.05 },
  // South America
  BRA: { south: 0.3, mixed: 0.3, black: 0.4 },
  ARG: { south: 0.82, west: 0.08, mestizo: 0.1 },
  URU: { south: 0.82, mestizo: 0.08, black: 0.06, mixed: 0.04 },
  COL: { mestizo: 0.45, south: 0.15, black: 0.3, mixed: 0.1 },
  CHI: { mestizo: 0.55, south: 0.45 },
  // Africa
  NGA: { black: 1 },
  CMR: { black: 1 },
  MAR: { mena: 0.9, south: 0.05, black: 0.05 },
  SEN: { black: 1 },
  GHA: { black: 1 },
  // Asia and Oceania
  JPN: { eastAsia: 0.96, south: 0.04 },
  KOR: { eastAsia: 1 },
  KSA: { mena: 0.72, black: 0.18, mixed: 0.1 },
  IRN: { mena: 0.88, south: 0.12 },
  AUS: { west: 0.55, south: 0.3, north: 0.05, mena: 0.05, mixed: 0.05 },
  // North America
  MEX: { mestizo: 0.72, south: 0.26, mixed: 0.02 },
  USA: { west: 0.55, north: 0.05, south: 0.02, mestizo: 0.1, black: 0.2, mixed: 0.08 },
  CAN: { west: 0.55, north: 0.05, south: 0.1, black: 0.18, mixed: 0.1, eastAsia: 0.02 },
  // Clubs, 2003-04
  MAD: { south: 0.68, west: 0.1, mena: 0.05, mixed: 0.1, black: 0.07 },
  BAR: { south: 0.6, west: 0.1, mestizo: 0.05, mixed: 0.1, black: 0.15 },
  MUN: { west: 0.65, south: 0.1, mestizo: 0.07, mixed: 0.1, black: 0.08 },
  MRB: { south: 0.72, west: 0.1, mixed: 0.05, black: 0.13 },
  MAN: { west: 0.55, north: 0.05, south: 0.12, mixed: 0.1, black: 0.18 },
  LIV: { west: 0.5, north: 0.08, south: 0.1, mixed: 0.07, black: 0.25 },
  LDR: { west: 0.3, north: 0.05, south: 0.1, mixed: 0.12, black: 0.43 },
  LDB: { west: 0.45, north: 0.02, south: 0.15, mixed: 0.1, black: 0.28 },
  TUR: { south: 0.75, west: 0.1, mixed: 0.03, black: 0.12 },
  MBB: { south: 0.55, west: 0.03, mena: 0.05, mestizo: 0.1, mixed: 0.07, black: 0.2 },
  DOR: { west: 0.65, north: 0.03, south: 0.07, mena: 0.03, mixed: 0.12, black: 0.1 },
  PAR: { west: 0.35, south: 0.2, mena: 0.05, mixed: 0.1, black: 0.3 },
  AMS: { west: 0.45, north: 0.1, south: 0.1, mena: 0.06, mestizo: 0.04, mixed: 0.13, black: 0.12 },
  PRT: { south: 0.72, west: 0.02, mixed: 0.14, black: 0.12 },
  LIS: { south: 0.7, west: 0.02, mixed: 0.15, black: 0.13 },
  GLA: { west: 0.55, north: 0.2, south: 0.07, mixed: 0.06, black: 0.12 },
  IST: { mena: 0.6, south: 0.3, mestizo: 0.05, black: 0.05 },
};
// a team with no entry: an even spread, roughly the game's old mix
export const DEFAULT_LOOKS = { north: 0.15, west: 0.25, south: 0.25, mena: 0.05, mestizo: 0.05, mixed: 0.1, black: 0.15 };
export const looksOf = id => LOOKS[id] || DEFAULT_LOOKS;

/* ---------- the picker ---------- */

export function rng(seed) {                                   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedOf = s => [...String(s)].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
function draw(weights, r) {                                   // a key of a sparse weight table
  const ks = Object.keys(weights), tot = ks.reduce((a, k) => a + weights[k], 0);
  let x = r() * tot;
  for (const k of ks) { x -= weights[k]; if (x < 0) return k; }
  return ks[ks.length - 1];
}

// Which group each of n players comes from: systematic sampling, so every group gets floor or ceil of
// n x its weight (a 90/10 side never shows 2 of 4 from the 10%), with the leftover places falling where a
// random offset puts them, then shuffled over the players. Different seeds, different line-ups.
export function stratify(weights, n, r) {
  const ks = Object.keys(weights).filter(k => weights[k] > 0), tot = ks.reduce((a, k) => a + weights[k], 0), out = [];
  const u = r();
  let acc = 0, i = 0;
  for (const k of ks) {
    acc += weights[k] / tot * n;
    while (i < n && i + u < acc) { out.push(k); i++; }
  }
  while (out.length < n) out.push(ks[ks.length - 1]);        // (rounding at the very end)
  for (let j = n - 1; j > 0; j--) { const m = Math.floor(r() * (j + 1)); [out[j], out[m]] = [out[m], out[j]]; }
  return out;
}

// One player's look from a group: { group, tone, hair (indexes into TONES, HAIRS), style (a STYLES name),
// stubble, eyes, feat, face (an integer for face.js's paint: brows, eyes, nose, lips, moles) }.
export function lookFrom(group, r) {
  const g = GROUPS[group];
  return { group, tone: +draw(g.tone, r), hair: +draw(g.hair, r), style: draw(g.style, r), stubble: r() < g.stubble, eyes: g.eyes, feat: g.feat || {}, face: Math.floor(r() * 1e6) };
}

// The looks of a team's players for one match: keys (e.g. shirt numbers) → look. Deterministic in
// (team, keys, seed): replays rebuild the same faces from the same seed.
export function pickSquad(teamId, keys, seed = 0) {
  const r = rng(seedOf(teamId) ^ Math.imul(seed | 0, 2654435761));
  const groups = stratify(looksOf(teamId), keys.length, r);
  return Object.fromEntries(keys.map((k, i) => [k, lookFrom(groups[i], r)]));
}

// A team's expected share of each skin tone (for the notes and tests).
export function toneWeights(teamId) {
  const out = TONES.map(() => 0), w = looksOf(teamId), tot = Object.values(w).reduce((a, b) => a + b, 0);
  for (const [gk, gw] of Object.entries(w)) for (const [t, tw] of Object.entries(GROUPS[gk].tone)) out[+t] += gw / tot * tw;
  return out;
}
