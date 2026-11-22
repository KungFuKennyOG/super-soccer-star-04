// Films a goal celebration in the real game (a scene for tools/filmgame.mjs), from your own eyes or from a camera
// beside the pitch that sees the replay's whole-bodied copies (you included):
//   KIND=slide VIEW=eyes|side|front|back|high SIZE=960x540 node tools/cheerfilm.mjs-scene: run as
//   KIND=slide VIEW=side node tools/filmgame.mjs tools/cheerfilm.mjs out/dir
// Also: AT=x,z (where you scored, default 3,-20), YAW=rad (which way you face; 0 is at the goal), EVERY=n (keep every
// nth frame, default 2: 15 a second), PROMPT=1 (stop on the prompt and take one still), HAT=1, PICK=default|skip.
const E = process.env, KIND = E.KIND || 'slide', VIEW = E.VIEW || 'eyes', EVERY = +(E.EVERY || 2);
const [AX, AZ] = (E.AT || '3,-20').split(',').map(Number), YAW = +(E.YAW || 0);

export default async function scene(f) {
  const { page } = f, step = (n = 1, draw = true) => page.evaluate(([k, d]) => {
    const r = window.__sss.renderer, was = r.render; if (!d) r.render = () => {};
    try { for (let i = 0; i < k; i++) { window.__film.tick(1 / 30); window.__sss.loop.step(1 / 30); } } finally { r.render = was; }
  }, [n, draw]);
  await page.evaluate(([x, z, yaw, view]) => {
    const s = window.__sss;
    document.getElementById('overlay').hidden = true; document.getElementById('hud').style.display = 'none';
    s.settings.replays = 1; s.settings.weather = 1;
    s.startMatch();
    Object.assign(s.world.you, { x, z }); s.desk.yaw = yaw; s.desk.pitch = 0.1;
    // a camera of our own beside the play: the live players are swapped for the replay's copies while it draws
    if (view !== 'eyes') {
      const r = s.renderer, draw = r.render.bind(r), cam = s.camera.clone();
      r.render = (scene, c) => {
        if (c !== s.camera || !s.world.celebrate) return draw(scene, c);
        const y = s.world.you, k = s.world.celebrate, fx = k.kind ? k.dx : y.fx, fz = k.kind ? k.dz : y.fz, rx = -fz, rz = fx;
        const [df, dr, h, fov] = { side: [0.3, 5.2, 1.25, 30], front: [5.5, 0.8, 1.3, 30], back: [-6, 1.2, 1.6, 30], high: [-1, 9, 5.5, 34] }[view];
        cam.fov = fov; cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
        cam.position.set(y.x + fx * df + rx * dr, h, y.z + fz * df + rz * dr); cam.lookAt(y.x, 0.95, y.z);
        const live = Object.values(s.models).flatMap(m => [m.root, m.shadow]), ghosts = Object.values(s.replay.ghosts).flatMap(m => [m.root, m.shadow]);
        const was = live.map(o => o.visible), on = s.replay.showing;
        if (on) { live.forEach(o => { o.visible = false; }); ghosts.forEach(o => { o.visible = true; }); }
        draw(scene, cam);
        if (on) { ghosts.forEach(o => { o.visible = false; }); live.forEach((o, i) => { o.visible = was[i]; }); }
      };
    }
  }, [AX, AZ, YAW, VIEW]);
  await step(20, false);
  await page.evaluate(([x, z, hat]) => { const s = window.__sss; Object.assign(s.world.you, { x, z, vx: 0, vz: 0 }); s.celebrate(hat, 0.3); }, [AX, AZ, !!E.HAT]);
  await step(E.PROMPT ? 23 : 40, false); if (E.PROMPT) await step(1);
  if (E.PROMPT) { await f.still(`prompt${E.HAT ? '-hat' : ''}`); return; }
  if (E.PICK === 'skip') { await f.key('KeyC', true); await step(1); await f.key('KeyC', false); }
  else if (E.PICK !== 'default') await page.evaluate(k => { const s = window.__sss; s.celebration.pick(s.world, k); }, KIND);
  await f.to(`${KIND}-${VIEW}`);
  let n = 0, k = 0;
  for (;;) {
    await step(1, k % EVERY === 0);
    const st = await page.evaluate(() => { const s = window.__sss, c = s.world.celebrate; return { on: s.celebration.active, t: c ? c.t : -1, dead: s.world.dead, y: s.camera.parent.position.y, pts: s.match.points }; });
    if (k++ % EVERY === 0) await page.screenshot({ path: `${process.argv[3]}/${KIND}-${VIEW}/${String(n++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
    if (!st.dead || k > 30 * 12) { console.log(`${KIND}: back in play after ${(k / 30).toFixed(2)} s, points ${st.pts}`); break; }
  }
}
