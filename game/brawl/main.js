// The flat-screen brawl (brawl.html): a menu, then a whole-pitch match in the '04 look on a TV camera,
// played with keyboard or pad. rules/brawl/ is the match; this file boots it, steps it, plays the sounds and
// the commentator, and draws the HUD.
import * as THREE from 'three';
import { setFullPitch } from '../ps2/arena.js';
import { SIZES } from '../../rules/brawl/tuning.js';
import { createBrawl, clockText } from '../../rules/brawl/world.js';
import { stepBrawl } from '../../rules/brawl/sim.js';
import { pickLine } from '../../rules/brawl/caster.js';
import { byId, CLUBS, matchKit } from '../../rules/teams.js';
import { readSettings, showMenu, panels, cupMatch, cupResult } from './menu.js';
import { readInput } from './pad.js';

const $ = id => document.getElementById(id);
const S = readSettings();
if (!S.play) showMenu(S);
else boot();

async function boot() {
  // the stadium is built round a whole pitch of this size: set it before any of the ground's modules load
  setFullPitch(SIZES[S.n].halfW, SIZES[S.n].halfL);
  const [{ buildStadium }, { venueFor }, { createWeather }, { dressSides, createView, createTvCamera }, { startAudio, sfx, audioOut }, { createAim }] = await Promise.all([
    import('../ps2/stadium.js'), import('../grounds.js'), import('../ps2/weather.js'), import('./view.js'), import('../audio.js'), import('./aim.js'),
  ]);
  const home = byId(S.home), away = byId(S.away);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.5, 600);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

  const stadium = buildStadium(scene);
  const v = venueFor(home, away, null, null, CLUBS.includes(home));
  const fans = kit => [kit.shirt, kit.alt, kit.shorts, kit.trim, '#f2f1ea'];
  const ground = stadium.setGround(v.recipe, fans(home.kit), fans(matchKit(away, home)), v.share);
  stadium.setWeather(S.wx);
  const weather = createWeather(scene); weather.set(S.wx); weather.bright?.(stadium.weatherBright);

  const cm = cupMatch(S);
  const w = createBrawl({ n: S.n, chaos: S.chaos, real: S.len, knockout: !!(cm && cm.knockout) });
  w.demo = S.demo;
  const models = dressSides(scene, w, home, away);
  const view = createView(scene, w, models), tv = createTvCamera(camera, w, ground.plan), aim = createAim(scene, w);
  if (cm) { $('stage').hidden = false; $('stage').textContent = cm.label; }
  tv.snap();

  // HUD
  $('hn').firstChild.textContent = home.id; $('an').firstChild.textContent = away.id;
  $('hc').style.background = home.kit.shirt; $('ac').style.background = matchKit(away, home).shirt;
  $('bug').hidden = false; $('load').hidden = true; $('hint').hidden = S.demo;
  setTimeout(() => { $('hint').style.opacity = 0.25; }, 9000);
  let paused = false, done = false, bannerT = 0, subT = 0, subPri = 0;
  const ui = panels(S, { resume: () => setPause(false) });
  function setPause(on) { paused = on; ui.pause(on, `${home.name} ${w.score.home} - ${w.score.away} ${away.name}`); }
  const banner = (text, secs = 2) => { $('banner').textContent = text; $('banner').classList.add('on'); bannerT = secs; };
  let cardT = 0;
  const showCard = color => { $('card').style.background = color === 'red' ? '#d8261e' : '#f2d22e'; $('card').hidden = false; cardT = 2; };
  const NAMES = { free: 'FREE KICK', corner: 'CORNER', throw: 'THROW-IN', goalkick: 'GOAL KICK', penalty: 'PENALTY!' };
  // the shoot-out: a dot per kick, green in, red missed
  function pensHud() {
    const so = w.so; if (!so) return;
    const row = team => so.log.filter(k => k.team === team).map(k => `<b class="${k.scored ? 'y' : 'n'}"></b>`).join('') + '<b></b>'.repeat(Math.max(0, 5 - so.taken[team]));
    $('pens').innerHTML = `${home.id} ${row('home')} ${so.score.home}<br>${away.id} ${row('away')} ${so.score.away}`;
    $('pens').hidden = false;
  }

  // the commentator: recorded clips for the football, subtitles (and the browser's British voice, if it has
  // one) for everything else
  const synth = window.speechSynthesis, Utter = window.SpeechSynthesisUtterance, Clip = window.Audio;
  const voices = () => (synth ? synth.getVoices().filter(x => /en[-_]GB/i.test(x.lang)) : []);
  let clip = null;
  function say(line) {
    if (!line || (subT > 0 && line.pri < subPri)) return;
    subT = 3; subPri = line.pri;
    $('sub').textContent = line.text; $('sub').style.opacity = 1;
    if (!audioOut()) return;
    if (clip) { clip.pause(); clip = null; }
    if (synth) synth.cancel();
    if (line.id) { clip = new Clip(`game/assets/voice/${line.id}.mp3`); clip.volume = 0.9; clip.play().catch(() => {}); }
    else if (voices().length) { const u = new Utter(line.text); u.voice = voices()[0]; u.rate = 0.95; u.pitch = 0.9; synth.speak(u); }
  }
  // a body hitting the grass (or the boards): a short low thump of noise
  function thud(k) {
    const a = audioOut(); if (!a) return;
    const { ctx, master } = a, t = ctx.currentTime, n = ctx.createBufferSource(), buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260 + 300 * k;
    const g = ctx.createGain(); g.gain.value = 0.5 + 0.9 * k;
    n.buffer = buf; n.connect(f).connect(g).connect(master); n.start(t);
  }
  const unlock = () => { startAudio(); removeEventListener('keydown', unlock); removeEventListener('pointerdown', unlock); };
  addEventListener('keydown', unlock); addEventListener('pointerdown', unlock);

  function onEvents(ev) {
    view.events(ev);
    for (const e of ev) {
      say(pickLine(e, w));
      switch (e.type) {
        case 'kickoff': sfx('whistle'); if (e.half === 2 && w.clock > 0) banner('SECOND HALF', 1.6); break;
        case 'whistle': sfx('whistle'); banner(e.kind === 'penalty' ? 'PENALTY!' : 'FOUL', 1.6); break;
        case 'card': showCard(e.color); banner(e.color === 'red' ? (e.second ? 'SECOND YELLOW' : 'RED CARD') : 'YELLOW CARD', 2); if (e.color === 'red') stadium.ooh(); break;
        case 'offside': sfx('whistle'); banner('OFFSIDE', 1.6); break;
        case 'halftime': sfx('whistle'); setTimeout(() => sfx('whistle'), 350); banner(`HALF TIME  ${w.score.home} - ${w.score.away}`, 2.8); break;
        case 'setpiece': if (e.kind !== 'penalty' && !w.so) banner(NAMES[e.kind], 1.2); break;
        case 'throw': sfx('pass', 0.3); break;
        case 'shootout': sfx('whistle'); banner('PENALTIES', 2.4); pensHud(); break;
        case 'pen': pensHud(); if (e.scored) { sfx('net'); sfx('roar'); stadium.netHit(w.ball.x, w.ball.y); if (e.team === 'home') stadium.cheer(true); else stadium.theirs(); } else { sfx('post'); stadium.ooh(); } break;
        case 'pass': case 'clear': sfx('pass', e.power || 0.5); break;
        case 'shot': sfx('kick', e.power || 0.7); if (e.speed > 24) sfx('rise'); break;
        case 'launch': thud(0.5); if (e.kind === 'big' || e.power > 9) sfx('ooh'); break;
        case 'thud': thud(e.hard); break;
        case 'boards': thud(1); break;
        case 'saved': case 'post': sfx('post'); stadium.ooh(); break;
        case 'goal': {
          sfx('net'); sfx('roar');
          const b = w.ball; if (b.z < 0) stadium.netHit(b.x, b.y); else stadium.netHitFar(b.x, b.y);
          if (e.team === 'home') stadium.cheer(true); else stadium.theirs();
          banner(e.own ? 'OWN GOAL!' : 'GOAL!', 2.4);
          break;
        }
        case 'tackled': sfx('touch'); break;
        case 'fulltime': {
          done = true; sfx('whistle');
          const s = w.stats, pens = e.pens ? ` (${e.pens.home} - ${e.pens.away} on penalties)` : '';
          let stats = !w.brawl ? `Fouls: ${w.fouls.home} - ${w.fouls.away}` :
            `Men sent flying: <b>${s.hits}</b><br>Longest flight: <b>${s.longest.toFixed(1)} m</b><br>Total distance flown: <b>${Math.round(s.flown)} m</b><br><i>A competitive game, played in good spirits.</i>`;
          const cr = cm && cupResult(w.score.home, w.score.away, e.pens ? e.winner === 'home' : null);
          if (cr) stats = `${cr.text}<br><br>${stats}`;
          ui.full(`${home.name} ${w.score.home} - ${w.score.away} ${away.name}${pens}`, stats, cr && cr.next);
          break;
        }
      }
      if (e.type === 'kickoff') stadium.cheer(false);
    }
  }

  let t = 0, last = performance.now(), dbgCam = null;
  function frame(dt, draw = true) {
    t += dt;
    const inp = readInput();
    if (inp.pause && !done) setPause(!paused);
    if (!paused) {
      if (S.demo) inp.auto = true;
      // the sim in steps of at most 1/60 s
      const n = Math.ceil(dt / (1 / 60) - 1e-6), h = dt / n;
      for (let i = 0; i < n; i++) onEvents(stepBrawl(w, inp, h));
      view.update(dt, t);
      aim.update(inp, camera, t);
      if (!dbgCam) tv.update(dt);
      stadium.update(dt, t, w.ball);
      weather.update(t, camera.position);
    }
    view.faceArrow(camera);
    // HUD
    $('sc').textContent = `${w.score.home} - ${w.score.away}`;
    $('clk').textContent = clockText(w);
    const you = w.byId[w.ctrl];
    $('who').hidden = !you || S.demo;
    if (you) $('who').textContent = `#${you.num} ${home.name}`;
    $('power').style.display = w.charge > 0 ? 'block' : 'none';
    if (w.charge > 0) $('power').firstChild.style.width = `${Math.min(100, w.charge / 0.9 * 100)}%`;
    if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('on');
    if (cardT > 0 && (cardT -= dt) <= 0) $('card').hidden = true;
    if (subT > 0 && (subT -= dt) <= 0) { $('sub').style.opacity = 0; subPri = 0; }
    if (draw) renderer.render(scene, camera);
  }
  window.brawl = {
    w, models, camera, stadium, step: (dt, draw) => frame(dt, draw),
    // look from (x, y, z) at (tx, ty, tz) instead of the TV camera (null: back to it), and draw
    look(at, to) { dbgCam = at; if (at) { camera.position.set(...at); camera.lookAt(...to); } renderer.render(scene, camera); },
  };      // for tools/brawlshots.mjs and the console
  if (S.film) return;
  renderer.setAnimationLoop(() => { const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt); });
}
