// Checks every team's kits (rules/teams.js) for the things a picture won't always tell you: bad fields, numbers
// that can't be read, a change kit or a keeper that clashes, two teams in one cup that can't be told apart.
//   node tools/kitcheck.mjs [GER ITA ...]      ERROR lines must be fixed (exit code 1); WARN lines are worth a look
import { NATIONS, CLUBS, ALL, byId, kitsClash, awayFor, matchKit, keeperKit, colorDist } from '../rules/teams.js';

const PATTERNS = ['solid', 'stripes', 'hoops', 'checks', 'band', 'halves', 'sleeves'], HEX = /^#[0-9a-f]{6}$/i;
const COLORS = ['shirt', 'alt', 'shorts', 'socks', 'band', 'trim', 'trim2', 'number'], OPTIONAL = ['outline', 'sleeve'];
const lin = c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255); };
// how far apart two colors are in brightness: 1 = the same, 21 = black on white. A number needs about 2.5 to be read.
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const want = process.argv.slice(2), only = id => !want.length || want.includes(id);
let errors = 0, warns = 0;
const err = (id, msg) => { if (only(id)) { errors++; console.log(`ERROR ${id}: ${msg}`); } };
const warn = (id, msg) => { if (only(id)) { warns++; console.log(`WARN  ${id}: ${msg}`); } };
for (const id of want) if (!byId(id)) { console.log(`ERROR ${id}: no team with that id`); errors++; }

function fields(id, what, kit) {
  let ok = true;
  if (!PATTERNS.includes(kit.pattern)) { err(id, `${what}: pattern '${kit.pattern}' is not one of ${PATTERNS.join(', ')}`); ok = false; }
  for (const f of COLORS) if (!HEX.test(kit[f] || '')) { err(id, `${what}: ${f} is '${kit[f]}', not a color like #1a2b3c`); ok = false; }
  for (const f of OPTIONAL) if (kit[f] !== undefined && !HEX.test(kit[f])) { err(id, `${what}: ${f} is '${kit[f]}', not a color like #1a2b3c`); ok = false; }
  if (kit.cut !== undefined && ![0, 1, 2].includes(kit.cut)) { err(id, `${what}: cut is ${kit.cut}, must be 0, 1 or 2`); ok = false; }
  if (kit.hoops !== undefined && ![0, 1].includes(kit.hoops)) { err(id, `${what}: hoops is ${kit.hoops}, must be 0 or 1`); ok = false; }
  for (const f of Object.keys(kit)) if (![...COLORS, ...OPTIONAL, 'pattern', 'cut', 'hoops', 'gloves', 'flag'].includes(f)) { err(id, `${what}: unknown field '${f}'`); ok = false; }
  return ok;
}
function readable(id, what, kit) {
  // the painter outlines a pale number in near-black by itself, and puts a plain shirt-colored panel behind a number on a busy pattern
  const outline = kit.outline || (lum(kit.number) > 0.21 ? '#161618' : null);
  const best = Math.max(contrast(kit.number, kit.shirt), outline ? contrast(outline, kit.shirt) : 0);
  if (best < 2.5) err(id, `${what}: the number (${kit.number}${kit.outline ? ', outline ' + kit.outline : ''}) can't be read on the shirt (${kit.shirt}): contrast ${best.toFixed(1)}, needs 2.5. Change number or add an outline`);
  if (colorDist(kit.trim, kit.shirt) < 60 && colorDist(kit.trim2, kit.shirt) < 60) warn(id, `${what}: trim (${kit.trim}) and trim2 (${kit.trim2}) are nearly the shirt's color (${kit.shirt}): collar, cuffs and piping won't show`);
  const second = kit.pattern === 'band' ? kit.band : kit.alt;                  // (a band is painted in `band`, every other pattern in `alt`)
  if (kit.pattern !== 'solid' && kit.pattern !== 'sleeves' && colorDist(kit.shirt, second) < 60) warn(id, `${what}: the pattern's two colors (${kit.shirt}, ${second}) are too alike for '${kit.pattern}' to show`);
}

for (const t of ALL) {
  if (!fields(t.id, 'home', t.kit)) continue;
  readable(t.id, 'home', t.kit);
  const away = awayFor(t), keeper = keeperKit(t.kit);
  if (t.away) { if (!fields(t.id, 'away', away)) continue; readable(t.id, 'away', away); }
  if (kitsClash(away, t.kit)) err(t.id, `the change kit (shirt ${away.shirt}) clashes with the home kit (shirt ${t.kit.shirt}): it has to look clearly different`);
  if (kitsClash(keeper, t.kit) || kitsClash(keeperKit(away), away)) warn(t.id, 'the keeper is close to his own outfield players in color');
}
for (const [cup, teams] of [['World Cup', NATIONS], ['Champions Cup', CLUBS]]) for (const a of teams) for (const b of teams) {
  if (a === b) continue;
  const worn = matchKit(b, a);                    // what b wears against a (a is in its home kit)
  if (kitsClash(worn, a.kit)) err(b.id, `${cup}: against ${a.id} (shirt ${a.kit.shirt}) this team would wear shirt ${worn.shirt}, which still clashes. Give ${b.id} an away kit that differs from ${a.id}'s home kit`);
  const same = f => (a.kit[f] ?? null) === (b.kit[f] ?? null);
  if (a.id < b.id && a.kit.pattern === b.kit.pattern && colorDist(a.kit.shirt, b.kit.shirt) < 45 && colorDist(a.kit.shorts, b.kit.shorts) < 45 && colorDist(a.kit.trim, b.kit.trim) < 45 && same('cut'))
    warn(a.id, `${cup}: looks the same as ${b.id} (same pattern, shirt, shorts, trim and cut). Tell them apart with cut, trim2, socks or sleeve`);
}
console.log(`${errors} error${errors === 1 ? '' : 's'}, ${warns} warning${warns === 1 ? '' : 's'}${want.length ? ' (for ' + want.join(', ') + ')' : ''}`);
process.exit(errors ? 1 : 0);
