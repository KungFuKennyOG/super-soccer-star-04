// Smoke test for the flat-screen brawl (brawl.html): the menu opens, a match builds, and a few seconds
// played on the keyboard (run, sprint, pass, shoot, tackle, switch) throw nothing.
//   npm run smoke   (CHROME=/path/to/chrome to use an installed Chrome instead of Playwright's)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startServer } from '../../tools/serve.mjs';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
const LOCAL_THREE = new URL('../../node_modules/three/build/three.module.js', import.meta.url).pathname;
const OUT = new URL('./out/', import.meta.url);
let server, browser;

before(async () => {
  await mkdir(OUT, { recursive: true });
  server = await startServer(0);
  browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
});
after(async () => { await browser?.close(); await server?.close(); });

async function open(path) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(120000);
  await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => { if (/\.(m?js|html)$/.test(new URL(r.url()).pathname)) errors.push(`failed to load ${r.url()}`); });
  await page.goto(server.url + path, { waitUntil: 'load' });
  return { page, errors };
}

test('brawl: the menu opens', async () => {
  const { page, errors } = await open('/brawl.html');
  await page.waitForSelector('#menu:not([hidden])');
  assert.ok(await page.$$eval('#mHome option', o => o.length) > 40);
  assert.deepEqual(errors, []);
  await page.close();
});

test('brawl: a 6 v 6 match builds and plays on the keyboard', async () => {
  const { page, errors } = await open('/brawl.html?play=1&film=1&n=6');
  await page.waitForFunction(() => window.brawl);
  const step = s => page.evaluate(n => { for (let i = 0; i < n; i++) window.brawl.step(1 / 30, false); window.brawl.step(1 / 30, true); }, Math.round(s * 30));
  await step(1.5);
  for (const [keys, s] of [[['KeyD'], 0.6], [['KeyD', 'ShiftLeft'], 0.6], [['KeyJ'], 0.1], [['KeyW'], 0.4], [['Space'], 0.1], [['KeyL'], 0.1], [['KeyK'], 0.5], [['KeyA'], 0.5]]) {
    for (const k of keys) await page.keyboard.down(k);
    await step(s);
    for (const k of keys) await page.keyboard.up(k);
    await step(0.2);
  }
  await page.screenshot({ path: new URL('brawl.png', OUT).pathname });
  const st = await page.evaluate(() => ({ clock: window.brawl.w.clock, ok: window.brawl.w.players.every(p => Number.isFinite(p.x)) }));
  assert.ok(st.clock > 2 && st.ok);
  assert.deepEqual(errors, []);
  await page.close();
});
