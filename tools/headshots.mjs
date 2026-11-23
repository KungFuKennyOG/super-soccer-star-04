// Renders tools/headlook.html with headless Chrome (software GL): node tools/headshots.mjs out/dir name?query ...
// e.g. node tools/headshots.mjs out front?view=front 34?view=34 before?skull=0. SIZE=1800x700 (default).
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
const LOCAL_THREE = fileURLToPath(new URL('../node_modules/three/build/three.module.js', import.meta.url));
const [out = 'out/heads', ...want] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const [w, h] = (process.env.SIZE || '1800x700').split('x').map(Number);
const server = await startServer(+(process.env.PORT || 8126));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const s of want.length ? want : ['front?view=front']) {
    const [name, query = ''] = s.split('?');
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => console.log('[page error]', e.message));
    page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
    await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
    await page.goto(`${server.url}/tools/headlook.html?${query}`);
    await page.waitForFunction(() => window.__heads && window.__heads.ready, null, { timeout: 240000 });
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log(name, JSON.stringify(await page.evaluate(() => window.__heads)));
    await page.close();
  }
} finally { await browser.close(); await server.close(); }
