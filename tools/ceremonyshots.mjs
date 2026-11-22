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
  behind: [[0, 3.3, 3.1], [0, 1.9, -1], 62],
};
const EYES = { eyes: [0, 0], eyesup: [0, 0.75], back: [Math.PI, 0.1], left: [2.1, 0.05], right: [-2.1, 0.05] };
await mkdir(out, { recursive: true });
const server = await startServer(+(process.env.PORT || 8171));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(240000);
page.on('pageerror', e => console.log('[page error]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
await page.route(THREE_URL, r => r.fulfill({ path: LOCAL_THREE, contentType: 'text/javascript' }));
await page.goto(`${server.url}/index.html?film=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__sssOK === true);
await page.click('#play');
await page.evaluate(async ({ kind, team, time, VIEWS }) => {
  const s = window.__sss, c = await import('/rules/cup.js'), t = await import('/rules/teams.js'), g = await import('/game/grounds.js'), THREE = await import('three');
  for (const r of Object.values(g.GROUNDS)) r.time = time;
  s.settings.commentary = 0; s.settings.weather = 1;
  s.game.kind = kind; s.game.team = t.byId(team); s.game.cup = c.createCup(kind, team); s.game.fixture = c.currentFixture(s.game.cup);
  s.game.opp = t.byId(s.game.fixture.opp); s.game.scenario = c.scenarioFor(s.game.cup, s.game.fixture); s.startMatch();
  for (let i = 0; i < 10; i++) s.loop.step(1 / 30);
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
    info() { const i = s.renderer.info.render; return { calls: i.calls, tris: i.triangles, lifted: s.ceremony.lifted, cost: s.ceremony.cost }; },
  };
}, { kind, team, time, VIEWS });
const tag = `${kind}-${time}`;
const save = async (name, data) => { await writeFile(`${out}/${name}.png`, Buffer.from(data.split(',')[1], 'base64')); };
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
    const [view, secs = 6] = film, fps = 30, dir = `${out}/film-${tag}-${view}`;
    await mkdir(dir, { recursive: true });
    for (let i = 0; i < secs * fps; i++) {
      const tt = i / fps, keys = { Space: tt > 0.8 && tt < 1, KeyW: tt > 1 && tt < (+process.env.DOWN_AT || 99), KeyS: tt >= (+process.env.DOWN_AT || 99) };
      await step(1 / fps, keys);
      await writeFile(`${dir}/f${String(i).padStart(4, '0')}.png`, Buffer.from((await page.evaluate(([v, e]) => window.__cer.shot(v, e), [view, EYES[view] || null])).split(',')[1], 'base64'));
    }
    try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${dir}/f%04d.png`, '-pix_fmt', 'yuv420p', '-crf', '20', `${out}/${tag}-${view}.mp4`]); console.log(`${out}/${tag}-${view}.mp4`); } catch (e) { console.log('no ffmpeg: frames are in', dir); }
  } else {
    await step(0.2, { Space: true }); await step(0.4, { Space: false });
    for (const v of ['eyes', 'squad']) if (want.includes(v)) await snap(v, 'held');
    await step(1.6, { KeyW: true });
    for (const t of [1.2, 3.5]) {
      await step(t === 1.2 ? 0.9 : 2.3, { KeyW: true });
      for (const v of [...want, 'eyesup']) await snap(v, `lift${t}`);
    }
    console.log('lifted', JSON.stringify(await page.evaluate(() => window.__cer.info())));
  }
} finally { await browser.close(); await server.close(); }
