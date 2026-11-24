// The brawl's menus (DOM panels in brawl.html) and its settings, which live in the page's URL: picking
// teams or the size reloads the page, because the stadium is built for one pitch size.
import { NATIONS, CLUBS, byId } from '../../rules/teams.js';
import { createCup, currentFixture, playUser, table, userGroup, STAGE_NAMES } from '../../rules/cup.js';

const $ = id => document.getElementById(id);

export function readSettings() {
  const q = new URLSearchParams(location.search);
  const id = (k, d) => (byId(q.get(k) || '') ? q.get(k) : d);
  let home = id('home', 'BRA'), away = id('away', 'GER');
  if (away === home) away = home === 'GER' ? 'BRA' : 'GER';
  return {
    n: q.get('n') === '6' ? 6 : 11, home, away,
    chaos: Math.max(0, Math.min(2.5, +(q.get('chaos') ?? 1))),      // 0: by the book; above it the brawl with its favours (the default)
    len: Math.max(30, +(q.get('len') || 240)),
    wx: ['rain', 'snow'].includes(q.get('wx')) ? q.get('wx') : 'clear',
    play: q.has('play') || q.has('demo'), demo: q.has('demo'), film: q.has('film'), cup: q.has('cup'),
  };
}

const urlFor = (s, extra = {}) => {
  const q = new URLSearchParams({ n: s.n, home: s.home, away: s.away, chaos: s.chaos, len: s.len, wx: s.wx, ...extra });
  return `${location.pathname}?${q}`;
};
export const restart = s => { location.href = urlFor(s, s.demo ? { demo: 1 } : s.cup ? { play: 1, cup: 1 } : { play: 1 }); };
export const toMenu = s => { location.href = urlFor(s); };

export function showMenu(s) {
  $('load').hidden = true;
  const fill = (sel, val) => {
    sel.innerHTML = '';
    for (const [label, list] of [['Nations', NATIONS], ['Clubs', CLUBS]]) {
      const g = document.createElement('optgroup'); g.label = label;
      for (const t of list) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name || t.id; g.appendChild(o); }
      sel.appendChild(g);
    }
    sel.value = val;
  };
  fill($('mHome'), s.home); fill($('mAway'), s.away);
  $('mN').value = String(s.n); $('mChaos').value = String(s.chaos); $('mLen').value = String(s.len); $('mWx').value = s.wx;
  if (![...$('mChaos').options].some(o => o.value === String(s.chaos))) $('mChaos').value = '1';
  if (![...$('mLen').options].some(o => o.value === String(s.len))) $('mLen').value = '240';
  const pick = () => ({ n: +$('mN').value, home: $('mHome').value, away: $('mAway').value, chaos: +$('mChaos').value, len: +$('mLen').value, wx: $('mWx').value });
  $('mGo').onclick = () => restart({ ...pick(), demo: false });
  // a cup: the World Cup for a nation, the Champions Cup for a club (rules/cup.js), saved between matches
  $('mCup').onclick = () => { const s2 = pick(); newCup(s2); goCup(); };
  const saved = loadCup();
  if (saved && !saved.cup.done) {
    const fx = currentFixture(saved.cup);
    $('mCupGo').hidden = false;
    $('mCupGo').textContent = `CONTINUE THE CUP: ${byId(saved.cup.user).name}, ${fx.label} v ${byId(fx.opp).name}`;
    $('mCupGo').onclick = goCup;
  }
  $('mDemo').onclick = () => restart({ ...pick(), demo: true });
  $('menu').hidden = false;
}

// The cup run, kept in localStorage between matches: { cup, s } (s: the settings it was started with).
const KEY = 'ss04-flat-cup';
export function loadCup() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
const saveCup = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode */ } };
function newCup(s) {
  const kind = NATIONS.some(t => t.id === s.home) ? 'world' : 'champions';
  const cup = createCup(kind, s.home);
  cup.continues = 0;                                  // no second chances here: lose a knockout and you're out
  saveCup({ cup, s });
}
// Off to your next cup match.
export function goCup() {
  const c = loadCup(), fx = c && currentFixture(c.cup);
  if (!fx) return toMenu(readSettings());
  restart({ ...c.s, home: c.cup.user, away: fx.opp, cup: true, demo: false });
}
// This match in the cup: { label, knockout } (or null if this isn't a cup match).
export function cupMatch(s) {
  const c = s.cup && loadCup(), fx = c && currentFixture(c.cup);
  return fx && fx.opp === s.away ? { label: fx.label, knockout: fx.stage !== 'group' } : null;
}
// Record the result. pens: won (true) or lost (false) a shoot-out. → the lines for the full-time panel.
export function cupResult(us, them, pens) {
  const c = loadCup();
  if (!c) return null;
  const r = playUser(c.cup, us, them, Math.random, pens);
  saveCup(c);
  const cup = c.cup, fx = currentFixture(cup);
  let text = r.champion ? '<b>CHAMPIONS!</b>' : r.out ? `Out of the cup${cup.champion ? `. ${byId(cup.champion).name} won it.` : '.'}` : r.advanced && cup.stage !== 'group' ? `Through to the <b>${STAGE_NAMES[cup.stage]}</b>.` : '';
  if (cup.stage === 'group' || (r.advanced && cup.groups.length && !cup.rounds.qf)) {
    const g = userGroup(cup);
    if (g) text += '<br>' + table(g).map((row, i) => `${i + 1}. ${byId(row.id).name} ${row.pts} pts (${row.gf}-${row.ga})`).join('<br>');
  }
  return { text, next: fx ? `NEXT: ${fx.label} v ${byId(fx.opp).name}` : null };
}

// The pause and full-time panels. on: { resume }.
export function panels(s, on) {
  $('pResume').onclick = () => on.resume();
  $('pRestart').onclick = () => restart(s);
  $('pMenu').onclick = $('fMenu').onclick = () => toMenu(s);
  $('fAgain').onclick = () => restart(s);
  return {
    pause(show, text) { $('pause').hidden = !show; if (text) $('pScore').textContent = text; },
    full(score, stats, next = null) {
      $('fScore').textContent = score; $('fStats').innerHTML = stats; $('full').hidden = false;
      $('fNext').hidden = !next; if (next) { $('fNext').textContent = next; $('fNext').onclick = goCup; }
      $('fAgain').hidden = !!s.cup;
    },
  };
}
