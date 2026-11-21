// Renders squad-look sheets (tools/looks.html) with headless Chrome: one row per team, n players each.
//   node tools/lookshots.mjs out/dir JPN KOR NGA ...     (no ids: every team)
//   env: TEAMS_PER (rows per picture, default 8), N (players per row, default 8), SEED, Q='heads=1' / 'hands=1' / 'body=ps1'
//   → out/dir/looks-1.png, looks-2.png ... (with a suffix for heads / hands / ps1)
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { ALL, byId } from '../rules/teams.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
const LOCAL_THREE = fileURLToPath(new URL('../node_modules/three/build/three.module.js', import.meta.url));
const [out = 'out', ...want] = process.argv.slice(2);
const ids = want.length ? want : ALL.map(t => t.id);
for (const id of ids) if (!byId(id)) { console.error(`no team with id ${id}`); process.exit(1); }
const per = +(process.env.TEAMS_PER || 8), n = +(process.env.N || 8), extra = process.env.Q || '';
const tag = extra.includes('heads') ? '-heads' : extra.includes('hands') ? '-hands' : '';
const suffix = tag + (extra.includes('ps1') ? '-ps1' : '');
await mkdir(out, { recursive: true });
const server = await startServer(+(process.env.PORT || 8125));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (let i = 0; i < ids.length; i += per) {
    const group = ids.slice(i, i + per), [w, rh] = tag === '-heads' ? [1600, 190] : tag === '-hands' ? [1600, 150] : [Math.round(118 * n), 330], h = rh * group.length;
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => console.log('[page error]', e.message));
    await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
    await page.goto(`${server.url}/tools/looks.html?teams=${group.join(',')}&n=${n}&w=${w}&h=${h}&seed=${process.env.SEED || 0}${extra ? '&' + extra : ''}`);
    await page.waitForFunction(() => window.__looks && window.__looks.ready, null, { timeout: 300000 });
    const file = `${out}/looks-${i / per + 1}${suffix}.png`;
    await page.screenshot({ path: file });
    console.log(file, group.join(' '), JSON.stringify(await page.evaluate(() => window.__looks)));
    await page.close();
  }
} finally { await browser.close(); await server.close(); }
