// Contact sheets of the brawl's own animations (tools/animlook.html) with headless Chrome (software GL): a
// row of frames from the side over the same frames from the front (or other views).
//   node tools/animshots.mjs out/dir [shot ...]
// shots: getup-back | getup-front | getup-side (a man knocked over, then getting up), trip (the fall itself at a
// foul's speed), launch (the fall at a brawl hit's speed), throw, ref-free | ref-indirect | ref-penalty | ref-card |
// ref-red | ref-advantage | ref-whistle | ref-fulltime | ref-freeblow (the referee's signals), or name:query for anything the page takes
// (e.g. 'x:shot=fall&vx=3&vz=1&seed=4'). Options: N=12 frames, VIEWS=side,front, PORT=8141, SIZE=380x400,
// PHASE=rag|getup|throw with FROM / TO seconds within it.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
const LOCAL_THREE = fileURLToPath(new URL('../node_modules/three/build/three.module.js', import.meta.url));
// [query, phase filmed, from, to (s within the phase; null: the whole get-up)]
export const SHOTS = {
  'getup-back': ['shot=fall&vx=4&vy=3&vz=-3&seed=2', 'getup'],
  'getup-front': ['shot=fall&vx=-3&vy=2&vz=2&seed=1', 'getup'],
  'getup-side': ['shot=fall&vx=4&vy=3&vz=-3&seed=2&lie=side', 'getup'],      // (rolled onto his side by the page: see animlook.html)
  'getup-turn': ['shot=fall&vx=4&vy=3&vz=-3&seed=2&face=0.3', 'getup'],         // made to face another way than the get-up leaves him
  trip: ['shot=fall&vx=0&vy=0.6&vz=3&seed=2', 'rag', 0, 1.3],
  launch: ['shot=fall&vx=5&vy=5&vz=6&seed=3', 'rag', 0, 1.8],
  throw: ['shot=throw&y=1.05&dist=4.8', 'throw', -0.55, 1.1],
  'ref-free': ['shot=ref&kind=free&dir=50&team=GER&look=5&y=1.05&dist=4.8', 'ref', 0, 2], 'ref-indirect': ['shot=ref&kind=indirect&team=GER&look=5&y=1.05&dist=4.8', 'ref', 0, 2],
  'ref-penalty': ['shot=ref&kind=penalty&dir=-30&walk=1.6&team=GER&look=5&y=1.05&dist=4.8', 'ref', 0, 2], 'ref-card': ['shot=ref&kind=card&dir=15&team=GER&look=5&y=1.05&dist=4.8', 'ref', 0, 2.2],
  'ref-red': ['shot=ref&kind=card&red=1&dir=-20&team=GER&look=5&y=1.05&dist=4.8', 'ref', 0, 2.2], 'ref-advantage': ['shot=ref&kind=advantage&dir=20&walk=4&team=GER&look=5&y=1.05&dist=4.8', 'ref', 0, 1.2],
  'ref-whistle': ['shot=ref&kind=whistle&team=GER&look=5&y=1.05&dist=4.8', 'ref', 0, 0.5], 'ref-fulltime': ['shot=ref&kind=fulltime&dir=70&team=GER&look=5&y=1.05&dist=4.8', 'ref', 0, 2],
  'ref-freeblow': ['shot=ref&kind=free&dir=-60&blow=1&team=GER&look=5&y=1.05&dist=4.8', 'ref', 0, 2],
};
const [out = 'out/anim', ...want] = process.argv.slice(2);
const N = +(process.env.N || 12), VIEWS = (process.env.VIEWS || 'side,front').split(','), [w, h] = (process.env.SIZE || '380x400').split('x').map(Number), DT = 1 / 60;
await mkdir(out, { recursive: true });
const server = await startServer(+(process.env.PORT || 8141));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const name of want.length ? want : Object.keys(SHOTS)) {
    const [query, ph, a = 0, b = null] = name.includes(':') ? [name.slice(name.indexOf(':') + 1), process.env.PHASE || (/shot=(ref|throw)/.exec(name) || [0, 'getup'])[1], +(process.env.FROM || 0), process.env.TO ? +process.env.TO : null] : SHOTS[name];
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
    page.on('pageerror', e => console.log('[page error]', e.message));
    await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
    await page.goto(`${server.url}/tools/animlook.html?still=1&w=${w}&h=${h}&${query}`);
    await page.waitForFunction(() => window.__look && window.__look.ready, null, { timeout: 120000 });
    // run on to the phase, then to each frame's moment in it
    const info = await page.evaluate(([phase, dt]) => { let n = 0; while (window.__look.info().phase !== phase && n++ < 3000) window.__look.step(dt, true); return window.__look.info(); }, [ph, DT]);
    const to = b ?? info.GETUP_TIME, shots = VIEWS.map(() => []), label = [];
    for (let i = 0; i < N; i++) {
      const at = a + (to - a) * i / (N - 1);
      await page.evaluate(([phase, t, dt]) => { let n = 0; while (window.__look.info().phase === phase && window.__look.info().since < t - 1e-6 && n++ < 3000) window.__look.step(Math.min(dt, t - window.__look.info().since)); }, [ph, at, DT]);
      label.push(at.toFixed(2));
      for (const [k, v] of VIEWS.entries()) { await page.evaluate(x => window.__look.view(x), v); shots[k].push((await page.screenshot({ type: 'jpeg', quality: 90 })).toString('base64')); }
    }
    const end = await page.evaluate(() => window.__look.info());
    await page.close();
    // the sheet: a page of the frames, photographed
    const sheet = await browser.newPage({ viewport: { width: w * N, height: h * VIEWS.length } });
    await sheet.setContent(`<body style="margin:0;background:#000;font:13px monospace;color:#ff0">${shots.map((row, k) => `<div style="display:flex">${row.map((s, i) => `<div style="position:relative"><img src="data:image/jpeg;base64,${s}" style="display:block"><span style="position:absolute;left:4px;top:2px;background:#0008;padding:0 3px">${label[i]} s ${VIEWS[k]}</span></div>`).join('')}</div>`).join('')}</body>`);
    await sheet.screenshot({ path: `${out}/${name.split(':')[0]}.png` });
    await sheet.close();
    console.log(name, ph, `${a}..${to} s`, end.kind ? `lay on his ${end.kind}` : '', end.natural ? `natural spot ${end.natural.x.toFixed(2)}, ${end.natural.z.toFixed(2)}` : '');
  }
} finally { await browser.close(); await server.close(); }
