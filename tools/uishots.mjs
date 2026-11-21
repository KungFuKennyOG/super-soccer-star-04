// Writes every '04 menu and HUD canvas (tools/uilook.html) as PNGs: name.png at full size and name-vr.png at
// the size it has in a Quest 3 eye, smoothed down like a mipmapped texture. Prints each one's headset width
// and paint time.
//   node tools/uishots.mjs out/dir [name ...]
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
const LOCAL_THREE = fileURLToPath(new URL('../node_modules/three/build/three.module.js', import.meta.url));
const [out = 'out/ui', ...want] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const server = await startServer(+(process.env.PORT || 8124));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', e => console.log('[page error]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
  await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
  await page.goto(`${server.url}/tools/uilook.html`);
  await page.waitForFunction(() => window.__ui && window.__ui.ready, null, { timeout: 60000 });
  const names = want.length ? want : await page.evaluate(() => window.__ui.names);
  const png = d => Buffer.from(d.split(',')[1], 'base64');
  for (const n of names) {
    await writeFile(`${out}/${n}.png`, png(await page.evaluate(x => window.__ui.full(x), n)));
    await writeFile(`${out}/${n}-vr.png`, png(await page.evaluate(x => window.__ui.headset(x), n)));
  }
  const info = await page.evaluate(() => window.__ui.info());
  for (const n of names) console.log(n, JSON.stringify(info[n]));
} finally { await browser.close(); await server.close(); }
