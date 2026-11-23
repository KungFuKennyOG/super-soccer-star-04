// Stills of the flat-screen brawl (brawl.html), headless: the page runs frame by frame (?film=1) with the AI
// playing both sides, and a still is saved at each time asked for.
//   node tools/brawlshots.mjs out/brawl 2 6 12 20          (seconds into the match)
//   Q='n=6&chaos=1.6' node tools/brawlshots.mjs out/b6 4 9  (more page settings)
//   MENU=1 node tools/brawlshots.mjs out/menu               (the menu instead)
// Prints what happened (goals, hits, how far they flew) and any page errors.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
const LOCAL_THREE = fileURLToPath(new URL('../node_modules/three/build/three.module.js', import.meta.url));
const [out = 'out/brawl', ...times] = process.argv.slice(2);
const at = (times.length ? times : ['3', '8']).map(Number).sort((a, b) => a - b);
mkdirSync(out, { recursive: true });
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const server = await startServer(+(process.env.PORT || 8124));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  // the same match every run (SEED=n for another)
  await page.addInitScript(seed => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, +(process.env.SEED || 1));
  await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
  if (process.env.MENU) {
    await page.goto(`${server.url}/brawl.html`);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/menu.png` });
  } else {
    const t0 = Date.now();
    await page.goto(`${server.url}/brawl.html?demo=1&film=1&${process.env.Q || ''}`);
    await page.waitForFunction(() => window.brawl, null, { timeout: 180000 });
    console.log(`built in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    let t = 0;
    // PRE="w.knockout = true; w.real = 8": change the match before it starts (a short knockout to see a shoot-out)
    if (process.env.PRE) await page.evaluate(code => new Function('w', code)(window.brawl.w), process.env.PRE);
    if (process.env.UNTIL) {
      // run until a condition on the match holds (UNTIL="w.sp && w.sp.kind === 'corner' && w.sp.stage === 'ready'"),
      // then the times are counted from there
      const ok = await page.evaluate(cond => { const f = new Function('w', `return (${cond})`), b = window.brawl; for (let i = 0; i < 60 * 600; i++) { if (f(b.w)) return b.w.clock; b.step(1 / 60, false); } return null; }, process.env.UNTIL);
      console.log(ok === null ? 'UNTIL never happened' : `UNTIL held at ${ok.toFixed(1)} s of match clock`);
      at.unshift(0);
    }
    for (const s of at) {
      const ms = await page.evaluate(([from, to]) => { const a = performance.now(); for (let x = from; x < to - 1e-6; x += 1 / 30) window.brawl.step(1 / 30, to - x < 1 / 30 + 1e-6); return performance.now() - a; }, [t, s]);
      t = s;
      await page.screenshot({ path: `${out}/t${String(s).padStart(3, '0')}.png` });
      const st = await page.evaluate(() => { const w = window.brawl.w; return { score: w.score, hits: w.stats.hits, longest: +w.stats.longest.toFixed(1), phase: w.phase, flying: w.players.filter(p => p.state !== 'up').length }; });
      if (process.env.FOLLOW) {
        // a close-up of whoever FOLLOW names (FOLLOW="w.ref", FOLLOW="w.byId[w.sp.taker]"), fixed on where he was first
        await page.evaluate(([expr, s]) => { const w = window.brawl.w, p = new Function('w', `return (${expr})`)(w); if (p) window.__f = (s.fixed && window.__f) || { x: p.x, z: p.z }; const f = window.__f; if (f) window.brawl.look([f.x + 6, 2.6, f.z + 3], [f.x, 0.9, f.z]); window.brawl.look(null); }, [process.env.FOLLOW, { fixed: !!process.env.FIXED }]);
        await page.screenshot({ path: `${out}/t${String(s).padStart(3, '0')}-follow.png` });
      }
      if (process.env.CLOSE) {
        // a closer look at whoever is off his feet (or the ball)
        const ok = await page.evaluate(() => { const w = window.brawl.w, p = w.players.find(q => q.state === 'air') || w.players.find(q => q.state !== 'up'); const a = p ? (p.air || p) : w.ball; window.brawl.look([a.x + 7, 3.2, a.z + 4], [a.x, 0.6, a.z]); window.brawl.look(null); return !!p; });
        await page.screenshot({ path: `${out}/t${String(s).padStart(3, '0')}-close.png` });
        if (!ok) console.log('  (nobody down: close-up is of the ball)');
      }
      if (process.env.WIDE) {
        // the whole ground: from high over a corner, and from behind each goal
        const views = { high: [[30, 70, 30], [0, 0, 0]], endA: [[0, 7, -51], [0, 2, 0]], endB: [[4, 7, 51], [0, 2, 0]] };
        for (const [k, [a, b]] of Object.entries(views)) { await page.evaluate(([x, y]) => window.brawl.look(x, y), [a, b]); await page.screenshot({ path: `${out}/t${String(s).padStart(3, '0')}-${k}.png` }); }
        await page.evaluate(() => window.brawl.look(null));
      }
      console.log(`t=${s}s`, JSON.stringify(st), `(${(ms / Math.max(1, (s - (at[at.indexOf(s) - 1] || 0)) * 30)).toFixed(1)} ms a frame, software GL)`);
    }
  }
  if (errs.length) console.log('page errors:\n' + [...new Set(errs)].slice(0, 10).join('\n'));
} finally { await browser.close(); await server.close(); }
