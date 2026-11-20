// Draws teams' kits in the '04 look, one picture per team: home kit front and back (number 10), change kit front
// and back (number 7), the keeper (number 1). For looking kits over while designing them (docs/kits.md).
//   node tools/kitshots.mjs out/dir GER ITA ...     (no ids: every team)   → out/dir/GER.png ...
//   SHEETS=1 also writes the home kit's flat painted sheet to out/dir/GER-sheet.png
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { ALL, byId } from '../rules/teams.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
const LOCAL_THREE = fileURLToPath(new URL('../node_modules/three/build/three.module.js', import.meta.url));
const [out = 'out', ...want] = process.argv.slice(2);
const ids = want.length ? want : ALL.map(t => t.id);
for (const id of ids) if (!byId(id)) { console.error(`no team with id ${id}`); process.exit(1); }
await mkdir(out, { recursive: true });
const server = await startServer(+(process.env.PORT || 8124));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => console.log('[page error]', e.message));
    await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
    await page.goto(`${server.url}/tools/ps2look.html?shot=kitcard&still=1&w=1280&h=720&team=${id}`);
    await page.waitForFunction(() => window.__look && window.__look.ready, null, { timeout: 120000 });
    await page.screenshot({ path: `${out}/${id}.png` });
    if (process.env.SHEETS) await writeFile(`${out}/${id}-sheet.png`, Buffer.from((await page.evaluate(() => window.__look.sheet(0, 0))).split(',')[1], 'base64'));
    console.log(`${id} → ${out}/${id}.png`);
    await page.close();
  }
} finally { await browser.close(); await server.close(); }
