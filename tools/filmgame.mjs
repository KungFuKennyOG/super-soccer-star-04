// Films the real game (index.html?film=1) a frame at a time for trailers: the page's loop is stepped by a fixed
// 1/30 s (engine/loop.js film mode) and its clock (performance.now) is the film's, so a slow headless capture
// still plays at an even pace. A scene file (an ES module) drives it:
//   export default async function (f) { await f.start(...); await f.run(secs, perFrame); ... }
//   node tools/filmgame.mjs scene.mjs out/dir        (JPEG frames 00000.jpg ...; SIZE=1920x1080)
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { startServer } from './serve.mjs';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
const LOCAL_THREE = fileURLToPath(new URL('../node_modules/three/build/three.module.js', import.meta.url));
const [sceneFile, out = 'out/film'] = process.argv.slice(2);
const [W, H] = (process.env.SIZE || '1920x1080').split('x').map(Number);
await mkdir(out, { recursive: true });
const server = await startServer(+(process.env.PORT || 8127));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(600000);
page.on('pageerror', e => console.log('[page error]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
// the film's clock: performance.now and timers follow the frames, not the wall
// SEED=n: Math.random is a seeded generator, so a take can be tried without drawing (DRY=1) and then filmed the same
await page.addInitScript(seed => {
  if (seed) { let a = seed >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let now = 0; const timers = [];
  performance.now = () => now;
  window.__film = {
    tick(dt) {
      now += dt * 1000;
      for (const t of timers.filter(t => t.at <= now).sort((a, b) => a.at - b.at)) { timers.splice(timers.indexOf(t), 1); try { t.fn(); } catch (e) { console.error(e); } }
    },
  };
  window.setTimeout = (fn, ms = 0) => { const t = { fn, at: now + ms }; timers.push(t); return t; };
  window.clearTimeout = t => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); };
}, +(process.env.SEED || 0));
await page.goto(`${server.url}/index.html?film=1${process.env.Q ? '&' + process.env.Q : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__sssOK === true);
const DRY = !!process.env.DRY;
if (DRY) await page.evaluate(() => { window.__sss.renderer.render = () => {}; });
let n = 0, dir = out;
const f = {
  page, W, H, DRY,
  // later frames go to out/name, numbered from 0
  async to(name) { dir = `${out}/${name}`; n = 0; await mkdir(dir, { recursive: true }); },
  // one still of the page as it is now
  still: name => page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 92 }),
  eval: (fn, arg) => page.evaluate(fn, arg),
  // advance without filming (menus settling, warm-up)
  async skip(secs, each) {
    for (let k = Math.round(secs * 30); k > 0; k--) {
      await page.evaluate(([src]) => {
        const r = window.__sss.renderer, draw = r.render; r.render = () => {};      // nothing drawn while skipping
        try { if (src) (0, eval)(src)(window.__sss); window.__film.tick(1 / 30); window.__sss.loop.step(1 / 30); } finally { r.render = draw; }
      }, [each ? each.toString() : '']);
    }
  },
  // film secs at 30 fps; each(s) runs in the page before every frame (drive the player there)
  async run(secs, each) {
    for (let k = Math.round(secs * 30); k > 0; k--) {
      await page.evaluate(([src]) => { if (src) (0, eval)(src)(window.__sss); window.__film.tick(1 / 30); window.__sss.loop.step(1 / 30); }, [each ? each.toString() : '']);
      if (!DRY) await page.screenshot({ path: `${dir}/${String(n).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
      n++;
    }
  },
  key: (code, down) => page.evaluate(([c, d]) => { window.__sss.desk.keys[c] = d; dispatchEvent(new window.KeyboardEvent(d ? 'keydown' : 'keyup', { code: c })); }, [code, down]),
};
try {
  const scene = (await import(pathToFileURL(resolve(sceneFile)).href)).default;
  const t0 = Date.now();
  await scene(f);
  console.log(`${n} frames in ${Math.round((Date.now() - t0) / 1000)} s`);
} finally { await browser.close(); await server.close(); }
