// Screenshots of the '04 menus and HUD in the real game (index.html in headless Chromium, browser mode):
// title, every menu screen, a match with the kick-off banner, bug and subtitle, a goal with its banner and
// the replay CRT, the dance lane, a training card, the trophy card and full time.
//   node tools/uigame.mjs out/dir [menus|match|dance|fulltime|ceremony|training ...]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
const LOCAL_THREE = fileURLToPath(new URL('../node_modules/three/build/three.module.js', import.meta.url));
const out = process.argv[2] || 'out/uigame';
await mkdir(out, { recursive: true });
const server = await startServer(+(process.env.PORT || 8125));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page;
async function fresh() {
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(180000);
  page.on('pageerror', e => console.log('[page error]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
  await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
  await page.goto(`${server.url}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sssOK === true);
}
const shot = async (name, wait = 600) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}.png` }); console.log(name); };
const S = fn => page.evaluate(fn);
// a cup match (scenario banner, bug), commentary as text so the subtitle shows
async function cupMatch() {
  await page.click('#play');
  await S(async () => {
    const s = window.__sss, c = await import('/rules/cup.js'), t = await import('/rules/teams.js');
    s.settings.commentary = 1; s.settings.weather = 1;
    s.game.kind = 'world'; s.game.team = t.byId('ENG'); s.game.cup = c.createCup('world', 'ENG'); s.game.fixture = c.currentFixture(s.game.cup);
    s.game.opp = t.byId(s.game.fixture.opp); s.game.scenario = c.scenarioFor(s.game.cup, s.game.fixture); s.startMatch();
  });
  await page.waitForFunction(() => window.__sss.mode === 'play');
  await S(() => { for (const id of ['d1', 'd2', 'd3']) window.__sss.world.byId[id].stun = 999; const d = window.__sss.desk; d.yaw = 0; d.pitch = 0; });
}
const only = process.argv.slice(3);
const want = n => !only.length || only.includes(n);
try {
  if (want('menus')) {
    await fresh();
    await shot('title', 1200);
    await page.click('#play');
    await shot('menu');
    await S(() => window.__sss.menus.open('settings', { settings: window.__sss.settings }, 2)); await shot('settings', 1500);
    await S(async () => { const t = await import('/rules/teams.js'); window.__sss.menus.open('team', { mode: 'world', teams: t.NATIONS, start: 'ITA' }); });
    await shot('worldmap', 2500);
    await S(async () => { const t = await import('/rules/teams.js'); window.__sss.menus.open('team', { mode: 'club', teams: t.CLUBS, start: 'LIV' }); });
    await shot('clubselect', 4000);
    await S(async () => { const c = await import('/rules/cup.js'); const cup = c.createCup('world', 'ESP'); c.playUser(cup, 2, 0); window.__sss.menus.open('hub', { cup }); });
    await shot('group', 1500);
    await S(async () => { const c = await import('/rules/cup.js'); const cup = c.createCup('club', 'MAD'); c.playUser(cup, 2, 0); window.__sss.menus.open('hub', { cup }); });
    await shot('bracket', 1500);
  }
  if (want('match')) {
    await fresh(); await cupMatch();
    await shot('match-kickoff', 900);
    await shot('match-subtitle', 1500);
    // a goal: the ball put into the net, then its banner and the replay on the CRT
    await S(() => { const s = window.__sss, w = s.world, b = w.ball; w.owner = null; if (w.byId.gk) w.byId.gk.stun = 999; Object.assign(b, { x: 1, y: 0.6, z: s.GOAL.z + 0.4, vx: 0, vy: 0, vz: -14 }); });
    await shot('goal-banner', 1200);
    await shot('replay-crt', 4000);
  }
  if (want('dance')) {
    await fresh(); await cupMatch();
    await S(() => window.__sss.startDance(0.1));
    await shot('dance', 3000);
  }
  if (want('fulltime')) {
    await fresh(); await cupMatch();
    await S(() => { window.__sss.match.clock = 0.2; });
    await shot('fulltime-banner', 1500);
    await shot('fulltime', 4000);
  }
  if (want('ceremony')) {
    await fresh(); await cupMatch();
    await S(() => window.__sss.startCeremony());
    await shot('ceremony', 4000);
  }
  if (want('training')) {
    await fresh(); await page.click('#play');
    await S(() => { const s = window.__sss; s.game.kind = 'training'; s.game.cup = null; s.game.scenario = null; s.startMatch(); });
    await page.waitForFunction(() => window.__sss.training.active && window.__sss.mode === 'play');
    await S(() => { const d = window.__sss.desk; d.yaw = 0; d.pitch = 0; });
    await shot('training', 2500);
  }
} finally { await browser.close(); await server.close(); }
