// The brawl's menus (DOM panels in brawl.html) and its settings, which live in the page's URL: picking
// teams or the size reloads the page, because the stadium is built for one pitch size.
import { NATIONS, CLUBS, byId } from '../../rules/teams.js';

const $ = id => document.getElementById(id);

export function readSettings() {
  const q = new URLSearchParams(location.search);
  const id = (k, d) => (byId(q.get(k) || '') ? q.get(k) : d);
  let home = id('home', 'BRA'), away = id('away', 'GER');
  if (away === home) away = home === 'GER' ? 'BRA' : 'GER';
  return {
    n: q.get('n') === '6' ? 6 : 11, home, away,
    chaos: Math.max(0, Math.min(2.5, +(q.get('chaos') || 0))),      // 0: plain football; above it the brawl
    len: Math.max(30, +(q.get('len') || 240)),
    wx: ['rain', 'snow'].includes(q.get('wx')) ? q.get('wx') : 'clear',
    play: q.has('play') || q.has('demo'), demo: q.has('demo'), film: q.has('film'),
  };
}

const urlFor = (s, extra = {}) => {
  const q = new URLSearchParams({ n: s.n, home: s.home, away: s.away, chaos: s.chaos, len: s.len, wx: s.wx, ...extra });
  return `${location.pathname}?${q}`;
};
export const restart = s => { location.href = urlFor(s, s.demo ? { demo: 1 } : { play: 1 }); };
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
  if (![...$('mChaos').options].some(o => o.value === String(s.chaos))) $('mChaos').value = '0';
  if (![...$('mLen').options].some(o => o.value === String(s.len))) $('mLen').value = '240';
  const pick = () => ({ n: +$('mN').value, home: $('mHome').value, away: $('mAway').value, chaos: +$('mChaos').value, len: +$('mLen').value, wx: $('mWx').value });
  $('mGo').onclick = () => restart({ ...pick(), demo: false });
  $('mDemo').onclick = () => restart({ ...pick(), demo: true });
  $('menu').hidden = false;
}

// The pause and full-time panels. on: { resume }.
export function panels(s, on) {
  $('pResume').onclick = () => on.resume();
  $('pRestart').onclick = () => restart(s);
  $('pMenu').onclick = $('fMenu').onclick = () => toMenu(s);
  $('fAgain').onclick = () => restart(s);
  return {
    pause(show, text) { $('pause').hidden = !show; if (text) $('pScore').textContent = text; },
    full(score, stats) { $('fScore').textContent = score; $('fStats').innerHTML = stats; $('full').hidden = false; },
  };
}
