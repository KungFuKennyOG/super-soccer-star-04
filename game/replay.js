// Goal replays. Every frame of play is recorded (ball and players) into a ring buffer; after a goal
// the last few seconds play back, slowing down for the finish, filmed by a TV camera on the gantry
// and shown on an old CRT that floats in front of you plus the stadium's big screen. The replay uses
// its own copies of the players (built per match) so the live ones are never disturbed.
import * as THREE from 'three';
import { ps1, pixelTex, canvasTex } from './ps1.js';
import { drawText } from './tex.js';
import { buildBall, animate, placeModel } from './actors.js';
import { startStrike, struck } from './strike.js';
import { buildSet } from './squad.js';
import { STRIKE } from '../rules/tuning.js';
import { startBeat, beatKind, BEATS } from './beaten.js';

const FPS = 72, KEEP = 8;                          // record rate and seconds kept
const SLOTS = FPS * KEEP;
const BEFORE = 4.2, AFTER = 0.9, SLOW_FROM = 1.3, SLOW = 0.45;   // seconds around the goal; slow-mo for the finish
const KINDS = ['', 'header', 'volley', 'bicycle'];
const PER = 8;                                     // numbers kept per player: x, z, vx, vz, fx, fz, flags, stride
// A replay knows a strike is coming, so everyone gets the whole recorded approach to it at life speed (game/kickcap.js:
// the last stride onto the plant foot, the backswing, the downswing), where the live game has six frames or none.
// SWING: it starts this long before the ball goes. And his run is brought into step for it over the second before
// (IN): the cycle of his legs is slid so that as the approach begins he is where the man recorded was, pushing off
// the kicking foot (STEP: that moment in the run's cycle, rad). Slid forward, mostly: quicker, shorter steps into
// the ball, as players take them; held back by BACK rad at most (legs that all but stop look like skating). It is
// let go again afterwards.
const SWING = 0.3, IN = 1, STEP = 1.1, OUT = [0.3, 1.2], BACK = 0.9;
export const APPROACH = { SWING, IN, STEP, OUT };
// the slide that puts a stride that would be at `ph` on STEP: the short way back if that is little, else forward
export const slideTo = ph => { const d = wrap(STEP - ph); return d < -BACK ? d + TAU : d; };
// How far a player's stride is slid at `cursor` (rad). list: his strikes in order, each { t: when the ball goes,
// from: the slide before it, d: the slide it needs }.
export function slideAt(list, cursor) {
  let slide = 0;
  for (const k of list) {
    if (cursor > k.t - SWING - IN) slide = k.from + (k.d - k.from) * smooth((cursor - (k.t - SWING - IN)) / IN);
    if (cursor > k.t + OUT[0] && k === list[list.length - 1]) slide *= 1 - smooth((cursor - k.t - OUT[0]) / OUT[1]);
  }
  return slide;
}
const TAU = Math.PI * 2, wrap = a => a - TAU * Math.round(a / TAU), smooth = x => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
// Your tricks and skill moves are recorded too (x 32 in your flags), so the replay's whole-body you plays them
// (game/tricks.js): 1 knock-on, 2 flick-up, 3 nutmeg, 4 drag-back, 5 step-over, 6 roulette, 7 rainbow begun, 8 its flick
const TRICKS = [null, null, null, 'nutmeg', 'drag', 'stepover', 'roulette', 'rainbow'];
const trickOf = e => (e.type === 'knock' ? 1 : e.type === 'flick' ? 2 : e.type === 'drag' ? 4 : e.type === 'launched' ? 8 : e.type === 'skill' ? TRICKS.indexOf(e.move) : 0);
// what game/main.js does with those events, done to the replay's you. f: the frame; o: where your numbers are in it
function playTrick(m, code, f, o) {
  const sp = Math.hypot(f[4], f[6]), face = { x: f[o + 4], z: f[o + 5] }, way = sp > 0.5 ? { x: f[4] / sp, z: f[6] / sp } : face;
  if (code === 1 || code === 3) struck(m, 'poke', way, 0.4);
  if (code === 2) struck(m, 'scoop', way, 0.4);
  if (code === 7) startStrike(m, { kind: 'rainbow', wind: STRIKE.rainbow, dir: face, power: 0.4 });
  if (code === 8) struck(m, 'rainbow', face, 0.5);
  if (TRICKS[code]) m.special = { kind: TRICKS[code], t: 0, side: 1 };
}

export function createReplay(scene, renderer) {
  let ids = [], stride = 0, buf = null, head = 0, count = 0, simT = 0;
  const stuns = {}, tackles = {};
  let ghosts = {}, strikes = [], clip = null, cursor = 0, active = false, pendingT = -1, goalAt = 0, frameSkip = 0;
  const ball = buildBall();
  ball.mesh.visible = ball.shadow.visible = false;
  scene.add(ball.mesh, ball.shadow);

  // the TV camera and what it films into
  const rt = new THREE.WebGLRenderTarget(256, 144);   // PS1-ish TV picture, cheap to fill
  const cam = new THREE.PerspectiveCamera(22, 16 / 9, 0.3, 200);
  const look = new THREE.Vector3();

  // a CRT on a stand in front of you
  const tv = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.64, 1.04, 0.62), ps1({ color: '#2a2a30' }));
  body.position.z = -0.32; tv.add(body);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.81), ps1({ map: rt.texture, lit: false, fog: false }));
  screen.position.z = 0.002; tv.add(screen);
  const tag = canvasTex(48, 10, () => {});
  const tagMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.07), ps1({ map: pixelTex(tag), lit: false, transparent: true, fog: false }));
  tagMesh.position.set(-0.52, 0.33, 0.004); tv.add(tagMesh);
  const tctx = tag.getContext('2d');
  tctx.fillStyle = '#c8102e'; tctx.fillRect(1, 2, 6, 6); drawText(tctx, 'REPLAY', 10, 2, '#ffffff');
  tv.visible = false; scene.add(tv);
  // and on the stadium's big screen, over the scoreboard
  const jumbo = new THREE.Mesh(new THREE.PlaneGeometry(12, 6.75), ps1({ map: rt.texture, lit: false, fog: false }));
  jumbo.visible = false; scene.add(jumbo);

  const headPos = new THREE.Vector3(), headDir = new THREE.Vector3();
  let tvYaw = null;

  function frameAt(i) { return buf.subarray(i * stride, i * stride + stride); }

  return {
    get active() { return active; },
    // playing, or about to start after a goal
    get busy() { return active || pendingT >= 0; },
    // per match: who's playing, and fresh replay copies of the players (you as a whole player)
    // locker: { boots, heads, ballName } so the replay copies match what's on the pitch
    setup(world, home, away, board, locker = {}) {
      for (const m of Object.values(ghosts)) scene.remove(m.root, m.shadow);
      ghosts = buildSet(world, home, away, { fullYou: true, look: locker });
      ball.setDesign(locker.ballName || 'CLASSIC');
      for (const m of Object.values(ghosts)) { m.root.visible = m.shadow.visible = false; scene.add(m.root, m.shadow); }
      ids = world.players.map(p => p.id);
      stride = 8 + ids.length * PER;
      buf = new Float32Array(SLOTS * stride);
      head = count = 0; simT = 0; active = false; pendingT = -1;
      jumbo.position.set(0, board.y, board.z + 0.5);
    },
    // every sim step: what happened, so it can be played back. ev: the step's events. charge: your hold, if one
    // is on ({ kind: 'shot' | 'pass' }: game/windup.js), so the replay's you shapes up to strike it too.
    record(world, ev, dt, charge = null) {
      if (!buf) return;
      simT += dt;
      const f = frameAt(head), b = world.ball;
      // f[7]: the kind of strike this frame (KINDS), plus 8 x (who has the ball at his feet + 1)
      f[0] = simT; f[1] = b.x; f[2] = b.y; f[3] = b.z; f[4] = b.vx; f[5] = b.vy; f[6] = b.vz; f[7] = world.dead ? 0 : 8 * (ids.indexOf(world.owner) + 1);
      world.players.forEach((p, i) => {
        const o = 8 + i * PER;
        let flags = 0;
        for (const e of ev) if ((e.type === 'kick' || e.type === 'pass') && e.by === p.id) { flags |= e.type === 'pass' ? 17 : 1; if (e.kind) f[7] += KINDS.indexOf(e.kind); }
        if (p.dive < 0) flags |= 2; if (p.dive > 0) flags |= 4; if (p.holding) flags |= 8;
        if (p.id === 'you') for (const e of ev) if (trickOf(e) > 0) flags |= 32 * trickOf(e);
        if (p.id === 'you' && charge) flags |= charge.kind === 'pass' ? 1024 : 512;
        // a defender beaten on this frame (x 2048: 1 + the kind's place in BEATS), and one going in for the ball (16384): game/beaten.js
        if (p.role === 'def') {
          if (p.stun > (stuns[p.id] || 0) + 0.15 && p.stun < 5) flags += 2048 * (1 + Math.max(0, BEATS.indexOf(ev.map(beatKind).find(Boolean) || 'drag')));
          stuns[p.id] = p.stun;
          if (p.tackleT > (tackles[p.id] || 0) && world.owner !== p.id) flags += 16384;
          tackles[p.id] = p.tackleT;
        }
        f[o] = p.x; f[o + 1] = p.z; f[o + 2] = p.vx; f[o + 3] = p.vz; f[o + 4] = p.fx; f[o + 5] = p.fz; f[o + 6] = flags; f[o + 7] = p.stride;
      });
      head = (head + 1) % SLOTS; count = Math.min(SLOTS, count + 1);
      if (pendingT >= 0 && simT >= pendingT) this.start();
    },
    // a goal just went in: play it back once a moment after it has been recorded too
    goal() { if (buf) { goalAt = simT; pendingT = simT + AFTER; } },
    start() {
      pendingT = -1;
      const frames = [];
      for (let k = count - 1; k >= 0; k--) {
        const f = frameAt((head - 1 - k + SLOTS * 2) % SLOTS);
        if (f[0] >= goalAt - BEFORE) frames.push(Float32Array.from(f));
      }
      if (frames.length < 10) return;
      clip = frames; cursor = frames[0][0]; active = true; tvYaw = null;
      // each player's strikes with the foot, and how far his legs' cycle has to slide to be in step for each
      strikes = ids.map((id, j) => {
        const o = 8 + j * PER, out = [];
        frames.forEach((f, i) => {
          const kind = KINDS[f[7] % 8];
          if (!(f[o + 6] & 1) || kind === 'header' || kind === 'bicycle') return;
          const sp = Math.hypot(f[4], f[6]) || 1, t0 = f[0] - SWING, at = frames.find(g => g[0] >= t0) || frames[0];
          const last = out[out.length - 1], d = t0 - frames[0][0] > 0.2 ? slideTo(at[o + 7] + (last ? last.d : 0)) : 0;      // (no time to get in step: he strikes it as he is)
          out.push({ t: f[0], d: (last ? last.d : 0) + d, from: last ? last.d : 0, how: { kind: f[o + 6] & 16 ? 'pass' : kind === 'volley' ? 'volley' : 'shot', wind: SWING, dir: { x: f[4] / sp, z: f[6] / sp }, power: Math.min(1, sp / 30) }, special: kind });
        });
        return out;
      });
      for (const m of Object.values(ghosts)) { m.strike = null; m.dive = null; m.special = null; m.trick = null; m.gait = null; m.inert = m.charge = m.beat = m.land = null; m.phOff = m.chargeK = m.kickK = m.cheerK = 0; }   // (the gait starts afresh: nobody turns round from where the last replay left him)
    },
    stop() {
      active = false; pendingT = -1; tv.visible = jumbo.visible = false;
      for (const m of Object.values(ghosts)) m.root.visible = m.shadow.visible = false;
      ball.mesh.visible = ball.shadow.visible = false;
    },
    // advance the playback; slow motion over the finish. camera: your head, to place the TV.
    update(dt, t, camera) {
      if (!active) return;
      const speed = cursor > goalAt - SLOW_FROM ? SLOW : 1;
      const prev = cursor;
      cursor += dt * speed;
      if (cursor >= clip[clip.length - 1][0]) { this.stop(); return; }
      let i = 0;
      while (i < clip.length - 2 && clip[i + 1][0] <= cursor) i++;
      const a = clip[i], b = clip[i + 1], k = Math.min(1, Math.max(0, (cursor - a[0]) / ((b[0] - a[0]) || 1)));
      const L = (o) => a[o] + (b[o] - a[o]) * k;
      const bl = { x: L(1), y: L(2), z: L(3), vx: L(4), vy: L(5), vz: L(6) }, owner = Math.floor(a[7] / 8) - 1;
      ball.update(bl, dt * speed);
      ids.forEach((id, j) => {
        const o = 8 + j * PER, m = ghosts[id];
        // tricks as they were done; strikes (game/strike.js) with the approach begun before the frame the ball was
        // struck on, so the boot gets there as it leaves; on that frame the boot is on the ball
        for (const f of clip) if (f[o + 6] >= 32 && f[0] > prev && f[0] <= cursor) {
          playTrick(m, (f[o + 6] >> 5) & 15, f, o);
          const code = (f[o + 6] >> 11) & 7;
          if (code) startBeat(m, { vx: f[o + 2], vz: f[o + 3] }, BEATS[code - 1], 0);
        }
        const slide = slideAt(strikes[j], cursor);
        for (const k of strikes[j]) {
          if (k.how.kind !== 'volley' && !m.strike && k.t - SWING > prev && k.t - SWING <= cursor) startStrike(m, k.how);
          if (k.t > prev && k.t <= cursor) { struck(m, k.how.kind, k.how.dir, k.how.power); if (id === 'you' && k.special) m.special = { kind: k.special, t: 0 }; }
        }
        const flags = a[o + 6];
        const p = { x: L(o), z: L(o + 1), vx: L(o + 2), vz: L(o + 3), fx: L(o + 4), fz: L(o + 5), stride: L(o + 7) + slide, role: id === 'gk' ? 'gk' : id === 'you' ? 'mate' : id[0] === 'd' ? 'def' : 'mate',
          dive: flags & 2 ? -1 : flags & 4 ? 1 : 0, holding: !!(flags & 8), tackleT: flags & 16384 ? (m.tk = (m.tk || 0) + 1) : (m.tk = 0) };      // (counting while he goes in)
        if (p.dive) p.save = { y: Math.max(0.3, L(2)), kind: 'parry', id: 'replay' }; else m.saveId = null;
        if (id === 'you') { const c = flags & 1536; m.charge = c ? { kind: c & 1024 ? 'pass' : 'shot', t: (m.charge ? m.charge.t : 0) + dt * speed } : null; }
        placeModel(m, p);
        if (id === 'you' && Math.hypot(p.vx, p.vz) > 0.5) m.root.rotation.y = Math.atan2(p.vx, p.vz);   // like your own legs on the pitch: you face the way you run
        animate(m, p, dt * speed, t, false, null, bl, owner === j);
      });
      // the TV camera: up on the gantry along the near touchline, following the ball
      look.lerp(ball.mesh.position, look.lengthSq() ? Math.min(1, dt * 4) : 1);
      cam.position.set(19, 6.5, look.z + 5);
      cam.lookAt(look.x * 0.7, 0.9, look.z);
      // the CRT floats in front of you, easing round as you turn
      camera.getWorldPosition(headPos); camera.getWorldDirection(headDir);
      const yaw = Math.atan2(headDir.x, headDir.z);
      tvYaw = tvYaw === null ? yaw : tvYaw + Math.atan2(Math.sin(yaw - tvYaw), Math.cos(yaw - tvYaw)) * Math.min(1, dt * 2);
      tv.position.set(headPos.x + Math.sin(tvYaw) * 2.3, headPos.y - 0.15, headPos.z + Math.cos(tvYaw) * 2.3);
      tv.lookAt(headPos.x, headPos.y - 0.15, headPos.z);
      tv.visible = jumbo.visible = true;
      tagMesh.visible = Math.floor(t * 2) % 2 === 0;
    },
    // film the replay: swap the live players for the replay copies, render into the screen's texture,
    // swap back. live: objects to hide while filming (live players, ball, HUD).
    render(live) {
      if (!active) return;
      // a 24 fps TV picture in the headset (every third frame), every other frame in the browser
      frameSkip = (frameSkip + 1) % (renderer.xr.isPresenting ? 3 : 2);
      if (frameSkip) return;
      const was = live.map(o => o.visible);
      live.forEach(o => { o.visible = false; });
      tv.visible = jumbo.visible = false;
      for (const m of Object.values(ghosts)) m.root.visible = m.shadow.visible = true;
      ball.mesh.visible = ball.shadow.visible = true;
      // In the headset the frame's render target is the XR layer's framebuffer, set by three.js before
      // this frame: put that back afterwards (setting null here sent the next view to the canvas
      // instead of the headset, so frames were dropped and the picture juddered).
      const xrOn = renderer.xr.enabled, prevRT = renderer.getRenderTarget();
      renderer.xr.enabled = false;
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.xr.enabled = xrOn;
      renderer.setRenderTarget(prevRT);
      for (const m of Object.values(ghosts)) m.root.visible = m.shadow.visible = false;
      ball.mesh.visible = ball.shadow.visible = false;
      live.forEach((o, i) => { o.visible = was[i]; });
      tv.visible = jumbo.visible = true;
    },
  };
}
