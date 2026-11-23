// The celebration prompt against everything else that can be on screen (the GOAL banner, the commentator's
// subtitle, the scoreboard bug): stills from your eyes in the real game (index.html?film=1, browser mode) with the
// head level, up and down, and a check that the prompt's outline touches none of the others.
//   node tools/promptshots.mjs out/dir [hat]
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
const LOCAL_THREE = fileURLToPath(new URL('../node_modules/three/build/three.module.js', import.meta.url));
const [out = 'out/prompt', hat] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const server = await startServer(+(process.env.PORT || 8173));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(240000);
page.on('pageerror', e => console.log('[page error]', e.message));
await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
await page.goto(`${server.url}/index.html?film=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__sssOK === true);
await page.click('#play');
let bad = 0;
try {
  await page.evaluate(() => { const s = window.__sss; s.settings.replays = 0; s.settings.weather = 1; s.settings.commentary = 1; s.startMatch(); for (let i = 0; i < 90; i++) s.loop.step(1 / 30); });
  // each case: head pitch (radians, up is positive), what is up beside the prompt
  for (const [name, pitch, banner, sub] of [['level', 0.05, 1, 1], ['down', -0.45, 1, 1], ['up', 0.5, 1, 1], ['upmore', 0.75, 1, 1], ['alone', 0.05, 0, 0], ['subonly', 0.05, 0, 1]]) {
    const r = await page.evaluate(([pitch, banner, sub, hat]) => {
      const s = window.__sss, step = n => { for (let i = 0; i < n; i++) s.loop.step(1 / 30); };
      s.celebration.cancel(); step(95);                                    // (the last banner and subtitle are gone)
      s.desk.yaw = 0; s.desk.pitch = pitch;
      Object.assign(s.world.you, { x: 3, z: -20, vx: 0, vz: 0 });
      if (banner) s.hud.banner({ text: hat ? 'HAT TRICK!' : 'GOAL!', sub: 'TOP CORNER +250', tone: 'good', big: true });
      s.celebrate(!!hat, 0.3);
      if (sub) s.commentary.event({ type: 'goal', by: 'you' }, {});
      step(14);
      if (sub) s.commentary.mesh.visible = true;                           // (whatever line it last painted, if the event picked none)
      step(2);
      const l = s.celebration.layout, hits = l && l.panel ? l.rects.filter(r => r.y1 > l.panel.y0 && r.y0 < l.panel.y1 && r.e1 > l.panel.e0 && r.e0 < l.panel.e1).length : -1;
      return { png: s.renderer.domElement.toDataURL('image/png'), layout: l, hits, picking: s.celebration.picking };
    }, [pitch, banner, sub, hat]);
    await writeFile(`${out}/prompt-${name}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
    const f = v => v.toFixed(1), box = b => `yaw ${f(b.y0)}..${f(b.y1)} el ${f(b.e0)}..${f(b.e1)}`;
    console.log(`${name}: picking ${r.picking}; ${r.layout ? `prompt ${r.layout.panel ? box(r.layout.panel) : 'hidden'}; showing: ${r.layout.rects.map(box).join(' | ') || 'nothing'}; overlaps: ${r.hits}` : 'no layout (the old prompt)'}`);
    if (r.hits > 0) bad++;
  }
} finally { await browser.close(); await server.close(); }
if (bad) { console.log(`${bad} case(s) overlap`); process.exitCode = 1; }
