// Stills and film of the trophy presentation in the real game (index.html?film=1 in headless Chromium, browser
// mode, stepped a frame at a time so it plays at an even pace however slow the capture is).
//   node tools/ceremonyshots.mjs out/dir [world|club] [TEAM] [day|dusk|night]
//   FILM=view:secs node tools/ceremonyshots.mjs ...   also films the lift from that view (frames + ffmpeg mp4)
// Views: eyes, eyesup, back, left (your own eyes: ahead, up at the cup, turned round, over your shoulder) and free
// cameras in the stage's frame (VIEWS below): stands, wide, squad, squadL, squadR, feet, press, side, top.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
const LOCAL_THREE = fileURLToPath(new URL('../node_modules/three/build/three.module.js', import.meta.url));
const [out = 'out/ceremony', kind = 'world', team = kind === 'club' ? 'MAD' : 'ITA', time = 'night'] = process.argv.slice(2);
// free cameras: [eye, target, fov] in the stage's frame (you at the origin on the platform, facing -z)
const VIEWS = {
  stands: [[5, 11, -31], [0, 1.6, 0.5], 24], wide: [[13, 4.5, -13], [0, 1.8, 0.6], 38], squad: [[0, 2.3, -2.6], [0, 1.75, 2], 52],
  squadL: [[-1.3, 2.25, -0.6], [-1.6, 1.7, 2.2], 50], squadR: [[1.3, 2.25, -0.6], [1.6, 1.7, 2.2], 50], pair: [[0, 2.5, 0.6], [0, 2.3, 2.66], 42],
  feet: [[0, 1.0, -1.2], [0, 0.75, 2], 60], press: [[0, 3.0, 0.6], [0, 0.6, -4], 60], side: [[7.5, 2.4, 1.6], [0, 1.6, 1.8], 40], top: [[0, 13, 0.4], [0, 0, 0.5], 50],
  clapA: [[-1.9, 2.05, -0.4], [-1.9, 1.85, 1.25], 46], clapB: [[2.0, 2.0, -0.2], [2.2, 1.85, 1.2], 46], clapSide: [[-4.2, 2.0, 1.6], [-2.55, 1.85, 1.3], 30],
  yes: [[-2.3, 1.9, -1.9], [-2.55, 1.55, 1.2], 38], gk: [[2.3, 1.9, -1.9], [2.55, 1.55, 1.2], 38],
  medalF: [[-1.75, 2.3, 1.0], [-1.85, 2.24, 2.62], 24], medalS: [[-3.1, 2.3, 2.2], [-1.85, 2.22, 2.62], 22], medalB: [[-1.6, 2.5, 3.25], [-1.85, 2.4, 2.62], 50],
  pressF: [[0, 1.6, -0.9], [0, 0.9, -2.9], 62], pressL: [[-2.2, 1.5, -1.3], [-1.6, 0.95, -3.0], 50], pressS: [[5.2, 1.3, -2.8], [0, 0.9, -2.8], 34], pressBk: [[0.6, 2.2, -6.2], [0, 1.0, -2.8], 40],
  behind: [[0, 3.3, 3.1], [0, 1.9, -1], 62], swap: [[2.3, 1.5, -0.3], [2.3, 0.9, -3.1], 52],
  // (the quick page has no you: these stand where your eyes are)
  lookEyes: [[0, 2.17, 0], [0, 1.55, -2.4], 62], lookCup: [[0, 2.17, 0], [0, 1.75, -0.6], 50], lookUp: [[0, 2.17, 0], [0, 2.75, -0.5], 62], cupStands: [[3, 5, -14], [0, 1.9, -0.5], 9], cupSide: [[1.2, 2.3, -1.3], [0, 1.85, -0.6], 40],
};
// each photographer close up (where he starts): manN from the stage side, manSN from his right, manHN his hands
[[-2.3, -2.5, 0.75], [0.15, -2.6, 0.75], [2.35, -2.5, 0.95], [-3.4, -3.05, 1.2], [-1.1, -3.15, 1.4], [1.2, -3.1, 1.2], [3.5, -3.05, 1.4]].forEach(([x, z, y], i) => {
  VIEWS['man' + i] = [[x * 0.8, y + 0.35, z + 2.3], [x, y, z], 40]; VIEWS['manS' + i] = [[x - 2.1, y + 0.2, z + 0.9], [x, y, z], 40]; VIEWS['manH' + i] = [[x * 0.93 + 0.25, y + 0.5, z + 1.0], [x, y + 0.42, z + 0.15], 34];
});
const EYES = { eyes: [0, 0], eyesup: [0, 0.75], back: [Math.PI, 0.1], left: [2.1, 0.05], right: [-2.1, 0.05] };
await mkdir(out, { recursive: true });
const server = await startServer(+(process.env.PORT || 8171));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: +(process.env.DPR || 1) });
page.setDefaultTimeout(240000);
page.on('pageerror', e => console.log('[page error]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
const save = async (name, data) => { await writeFile(`${out}/${name}.png`, Buffer.from(data.split(',')[1], 'base64')); };
// LOOK=1: the quick page (tools/ceremonylook.html: stage, squad and press on a plain pitch, no stadium). Stills of
// VIEWS at each of T (seconds; the cup is taken at 1.5 and up from 2), or FILM=view:secs.
if (process.env.LOOK) {
  await page.goto(`${server.url}/tools/ceremonylook.html?team=${team}&kind=${kind}&time=${time}${process.env.Q ? '&' + process.env.Q : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__look && window.__look.ready);
  const UP = (process.env.UP || '2:99').split(':').map(Number), st = t => ({ held: t >= UP[0] - 0.5, up: t >= UP[0] && t < UP[1] }), views = (process.env.VIEWS || 'squad,pressF').split(',');
  let now = 0;
  const to = async t => { while (now < t - 1e-6) { const d = Math.min(process.env.MEASURE || process.env.FILM ? 1 / 30 : 0.25, t - now); await page.evaluate(([a, b]) => window.__look.step(a, b), [d, st(now)]); now += d; } };
  // MEASURE=secs (LOOK): how far any photographer's arm is inside his trunk, head or camera, and how near two of them come
  if (process.env.MEASURE) {
    const worst = [], seen = {}, medal = []; let near = 9;
    for (let i = 0; i < +process.env.MEASURE * 30; i++) {
      await to((i + 1) / 30);
      const [m, acts] = await page.evaluate(() => [window.__look.measure(), window.__look.acts()]);
      (await page.evaluate(() => window.__look.medals())).forEach((g, k) => { medal[k] = Math.min(medal[k] ?? 9, g); });
      near = Math.min(near, m.near);
      m.arms.forEach((a, k) => { const w = worst[k] || (worst[k] = { trunk: 0, head: 0, cam: 0 }); for (const n in a) if (a[n] > w[n]) { w[n] = a[n]; w[n + 'At'] = `${now.toFixed(2)} ${acts[k].act}`; } });
      acts.forEach(a => { (seen[a.i] || (seen[a.i] = new Set())).add(a.act + (a.kneel < 0.05 ? '' : a.kneel > 0.95 ? '-kneel' : '-rising')); });
    }
    worst.forEach((w, k) => console.log(`man ${k}: in trunk ${(w.trunk * 100).toFixed(1)} cm (${w.trunkAt || '-'}), in head ${(w.head * 100).toFixed(1)} cm (${w.headAt || '-'}), in camera ${(w.cam * 100).toFixed(1)} cm (${w.camAt || '-'}); did: ${[...seen[k]].join(' ')}`));
    console.log(`squad, nearest a hand came to his own medal (cm): ${medal.map(g => (g * 100).toFixed(1)).join(' ')}`);
    console.log(`nearest two men came: ${near.toFixed(2)} m`);
  } else
if (process.env.FILM) {
    const [view, secs = 5] = process.env.FILM.split(':'), dir = `${out}/film-${view}`; await mkdir(dir, { recursive: true });
    for (let i = 0; i < secs * 30; i++) { await to((i + 1) / 30); await writeFile(`${dir}/f${String(i).padStart(4, '0')}.png`, Buffer.from((await page.evaluate(v => window.__look.snap(v), VIEWS[view])).split(',')[1], 'base64')); }
  } else for (const t of (process.env.T || '1,3.2').split(',').map(Number)) { await to(t); for (const v of views) { await save(`look-${time}-${v}-${t}`, await page.evaluate(d => window.__look.snap(d), VIEWS[v])); } }
  console.log(JSON.stringify(await page.evaluate(() => window.__look.info())));
  await browser.close(); await server.close(); process.exit(0);
}
await page.goto(`${server.url}/index.html?film=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__sssOK === true);
await page.click('#play');
await page.evaluate(async ({ kind, team, time, VIEWS }) => {
  const s = window.__sss, c = await import('/rules/cup.js'), t = await import('/rules/teams.js'), g = await import('/game/grounds.js'), THREE = await import('three');
  for (const r of Object.values(g.GROUNDS)) r.time = time;
  s.settings.commentary = 0; s.settings.weather = 1;
  s.game.kind = kind; s.game.team = t.byId(team); s.game.cup = c.createCup(kind, team); s.game.fixture = c.currentFixture(s.game.cup);
  s.game.opp = t.byId(s.game.fixture.opp); s.game.scenario = c.scenarioFor(s.game.cup, s.game.fixture); s.startMatch();
  for (let i = 0; i < 120; i++) s.loop.step(1 / 30);
  s.startCeremony();
  const scene = s.camera.parent.parent, cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400), G = s.ceremony.stageGroup, yaw0 = s.desk.yaw;
  window.__cer = {
    step(secs, keys = {}) { Object.assign(s.desk.keys, keys); for (let n = Math.round(secs * 30); n > 0; n--) s.loop.step(1 / 30); },
    // a picture: from your eyes (yaw from the front, pitch up) or a free camera
    shot(view, eyes) {
      if (eyes) { s.desk.yaw = yaw0 + eyes[0]; s.desk.pitch = eyes[1] + 0.22; s.loop.step(0); s.desk.yaw = yaw0; s.desk.pitch = 0; }
      else {
        const [e, at, fov] = VIEWS[view];
        cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(e[0], e[1], e[2]).add(G.position); cam.lookAt(at[0] + G.position.x, at[1], at[2] + G.position.z);
        s.renderer.render(scene, cam);
      }
      return s.renderer.domElement.toDataURL('image/png');
    },
    // how far each planted boot (its toe within 3 cm of the floor, this frame and last) moved over the floor, m/s
    feet(dt) {
      const out = [], v = new THREE.Vector3();
      for (const c of s.ceremony.cast.cast) for (const n of ['toeL', 'toeR']) {
        c.m.bone[n].getWorldPosition(v); const k = c.num + n, was = (this.was || (this.was = {}))[k], low = v.y - c.y < 0.07;
        if (was && was.low && low) out.push([c.num, Math.hypot(v.x - was.x, v.z - was.z) / dt]);
        this.was[k] = { x: v.x, z: v.z, low };
      }
      return out;
    },
    info() { const i = s.renderer.info.render; return { calls: i.calls, tris: i.triangles, lifted: s.ceremony.lifted, cost: s.ceremony.cost }; },
  };
}, { kind, team, time, VIEWS });
const tag = `${kind}-${time}`;
const snap = async (view, label) => { await save(`${tag}-${label}-${view}`, await page.evaluate(([v, e]) => window.__cer.shot(v, e), [view, EYES[view] || null])); console.log(`${tag}-${label}-${view}`); };
const step = (secs, keys) => page.evaluate(([a, b]) => window.__cer.step(a, b), [secs, keys || {}]);
const want = (process.env.VIEWS || 'eyes,back,left,stands,wide,squad,squadL,squadR,feet,press,side').split(',');
const film = process.env.FILM ? process.env.FILM.split(':') : null;
try {
  await step(3);
  if (!film) for (const v of want) await snap(v, 'before');
  if (!film) console.log('before', JSON.stringify(await page.evaluate(() => window.__cer.info())));
  if (film) {
    // the film: a second and a half waiting, the cup taken and raised, the rest with it up
    const slide = {}, [view, secs = 6] = film, fps = 30, dir = `${out}/film-${tag}-${view}`;
    await mkdir(dir, { recursive: true });
    for (let i = 0; i < secs * fps; i++) {
      const tt = i / fps, keys = { Space: tt > 0.8 && tt < 1, KeyW: tt > 1 && tt < (+process.env.DOWN_AT || 99), KeyS: tt >= (+process.env.DOWN_AT || 99) };
      await step(1 / fps, keys);
      if (process.env.MEASURE) for (const [num, sp] of await page.evaluate(d => window.__cer.feet(d), 1 / fps)) (slide[num] || (slide[num] = [])).push(sp);
      if (process.env.MEASURE === 'only') continue;
      await writeFile(`${dir}/f${String(i).padStart(4, '0')}.png`, Buffer.from((await page.evaluate(([v, e]) => window.__cer.shot(v, e), [view, EYES[view] || null])).split(',')[1], 'base64'));
    }
    for (const [num, a] of Object.entries(slide)) { a.sort((x, y) => x - y); console.log(`no ${num}: planted-boot speed median ${a[a.length >> 1].toFixed(3)} m/s, 90% under ${a[Math.floor(a.length * 0.9)].toFixed(3)}, max ${a[a.length - 1].toFixed(2)} (${a.length} frames)`); }
    if (process.env.MEASURE === 'only') process.exitCode = 0; else try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${dir}/f%04d.png`, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-pix_fmt', 'yuv420p', '-crf', '20', `${out}/${tag}-${view}.mp4`]); console.log(`${out}/${tag}-${view}.mp4`); } catch (e) { console.log('no ffmpeg: frames are in', dir); }
  } else {
    await step(0.2, { Space: true }); await step(0.4, { Space: false });
    for (const v of ['eyes', 'squad']) if (want.includes(v)) await snap(v, 'held');
    await step(1.6, { KeyW: true });
    for (const t of [1.2, 3.5]) {
      await step(t === 1.2 ? 0.9 : 2.3, { KeyW: true });
      for (const v of [...want, 'eyesup']) await snap(v, `lift${t}`);
    }
    console.log('lifted', JSON.stringify(await page.evaluate(() => window.__cer.info())));
    // and out again: A / Enter once it says so, back to the menu with the rig on the grass
    await step(2.5, { KeyW: false }); await step(0.1, { Enter: true }); await step(0.3, { Enter: false });
    console.log('after', JSON.stringify(await page.evaluate(() => ({ mode: window.__sss.mode, rigY: window.__sss.rig.position.y, active: window.__sss.ceremony.active }))));
  }
} finally { await browser.close(); await server.close(); }
