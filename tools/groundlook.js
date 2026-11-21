// Stadium shots for tools/ps2look.html: the '04-look grounds (game/ps2/stadium.js) built from the
// recipes in game/grounds.js, with the page's players standing on the pitch for scale.
//   ground       from the pitch at eye height (1.68 m), 15 m out, looking at the goal: what you see in VR
//   groundleft   the same spot, turned to the left-hand stand; groundright, groundback (the stand behind you)
//   groundcurva  near the penalty spot looking up at the home end, its curva, flags and banners
//   groundnet    the goal and net close up; groundbulge: a shot just hit the net (film it)
//   groundfans   the side stand's front rows close up, from the touchline
//   groundwide   wide from the TV gantry on the left stand; groundtop: from above, for the layout
// Query: &team=ID (a club's own ground; a nation plays at the national stadium), &opp=ID, &share=0.78,
// &time=day|dusk|night (overrides the recipe's), &wx=rain|snow, &cheer=1 (your fans jumping),
// &counter=1 (theirs), &ooh=1 (a near miss at 0.1 s), &goal=secs (your goal at that moment, for
// filming), &poses=1 (every fan in one of the 16 poses, groundfans). Shots are 1024 x 1024 at 90 degrees (as a Quest eye sees) unless noted.
import * as THREE from 'three';
import { buildStadium, TIMES2 } from '../game/ps2/stadium.js';
import { createWeather } from '../game/ps2/weather.js';
import { groundFor, GROUNDS } from '../game/grounds.js';
import { byId, awayFor } from '../rules/teams.js';
import { GOAL } from '../rules/tuning.js';
import { CLUBS } from '../rules/teams.js';

const fans = kit => [kit.shirt, kit.alt, kit.shorts, kit.trim, '#f2f1ea'];
const off = null;

export function groundLook(q, players, ball) {
  if (!(q.get('shot') || '').startsWith('ground')) return { shots: {}, active: () => false, render() {}, info: () => ({}) };   // built only for its own shots
  const scene = new THREE.Scene(), stadium = buildStadium(scene), weather = createWeather(scene);
  const team = byId(q.get('team') || 'MAN') || byId('MAN'), opp = byId(q.get('opp') || (team.id === 'MAD' ? 'BAR' : 'MAD')) || byId('MAD');
  const isClub = CLUBS.some(c => c.id === team.id);
  let recipe = isClub ? groundFor(team.id) : GROUNDS.default;
  if (q.get('time')) recipe = { ...recipe, time: q.get('time') };
  const oppKit = opp.id === team.id ? awayFor(team) : opp.kit;
  const t0 = performance.now();
  const g = stadium.setGround(recipe, fans(team.kit), fans(oppKit), +(q.get('share') || 0.78));
  const ms = Math.round(performance.now() - t0);
  const wx = q.get('wx') || 'clear';
  stadium.setWeather(wx); weather.set(wx); weather.bright(stadium.weatherBright);
  if (q.get('cheer')) stadium.cheer(true);
  if (q.get('poses')) g.meshes.fans.material.uniforms.uPoses.value = 1;           // every fan in one of the 16 poses
  // a stand-in for the HUD's scoreboard and the replay's big screen, where ground.board says (page only)
  const sb = new THREE.Mesh(new THREE.BoxGeometry(19, 7.6, 0.6), new THREE.MeshBasicMaterial({ color: '#15171c' }));
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(12, 6.75), new THREE.MeshBasicMaterial({ color: '#2a5a8a' }));
  sb.position.set(0, g.board.y, g.board.z - 0.35); sc.position.set(0, g.board.y, g.board.z + 0.5); scene.add(sb, sc);

  const { sideX, plan } = g, roofL = plan.stands[1].p.roof;
  const eye = [3, 1.68, -18.5];
  // the players: keeper on his line, two defenders, two teammates, a man on the ball ahead of you
  const team6 = () => [[0.4, GOAL.z + 0.6, 0, 0, 0, 0, 'gk'], [-3, -27, 0.2, 0, 0], [4.5, -26, -0.4, 0, 1], [-9, -22, 2.6, 2, 2], [10, -20, -2.4, 1.5, 3], [1.5, -15.2, Math.PI, 0, 4]];
  const S = {
    ground: { fov: 90, cam: eye, at: [0.5, 2.4, -40], set: team6 },
    groundleft: { fov: 90, cam: eye, at: [-40, 6, -16], set: team6 },
    groundright: { fov: 90, cam: eye, at: [40, 6, -18], set: team6 },
    groundback: { fov: 90, cam: eye, at: [2, 5, 20], set: team6 },
    groundcurva: { fov: 80, cam: [3, 1.68, -24], at: [-6, 8, -60], set: team6 },
    groundnet: { fov: 60, cam: [2.5, 1.5, -28.5], at: [0, 1.1, -35.5], set: () => [[0.4, GOAL.z + 0.6, 0, 0, 0, 0, 'gk'], off, off, off, off, off] },
    groundbulge: { fov: 45, cam: [5.5, 1.6, -39.4], at: [0.4, 1.1, -36], set: () => [off, off, off, off, off, off], hit: [1.2, 1.4] },
    groundwide: { fov: 50, cam: [-sideX + (roofL ? roofL.zFront : -4) + 1.5, roofL ? roofL.y - 1.4 : 18, -17], at: [12, 0, -19], set: team6 },
    groundcrowd: { fov: 28, cam: eye, at: [sideX + 6, 5, -24], set: team6 },
    groundfans: { fov: 34, cam: [sideX - 5, 1.68, -20], at: [sideX + 6, 5.2, -21], set: team6 },          // the side stand's front rows from the touchline
    groundtop: { fov: 60, cam: [0, 150, -12], at: [0, 0, -14], set: () => [off, off, off, off, off, off], up: true },
  };
  // &cam=x,y,z&at=x,y,z&fov=n: any camera, for looking into a corner
  if (q.get('cam')) S.groundcam = { fov: +(q.get('fov') || 60), cam: q.get('cam').split(',').map(Number), at: (q.get('at') || '0,0,-20').split(',').map(Number), set: team6 };
  let last = null;
  for (const [k, s] of Object.entries(S)) {
    s.ball = s.hit ? t => [s.hit[0], GOAL.z - Math.min(GOAL.depth, t * 9), s.hit[1]] : [1.5, -15.9];
    s.tick = t => {
      const dt = last === null ? 0 : Math.max(0, t - last); last = t;
      if (s.hit && t >= 0.2 && t - dt < 0.2) stadium.netHit(...s.hit);
      if (q.get('counter') && t >= 0.1 && t - dt < 0.1) stadium.theirs();
      if (q.get('ooh') && t >= 0.1 && t - dt < 0.1) stadium.ooh();
      if (q.get('goal') && t >= +q.get('goal') && t - dt < +q.get('goal')) stadium.cheer(true);   // &goal=secs: your goal goes in then (film it)
      stadium.update(dt, t);
    };
    S[k] = s;
  }
  let moved = false;
  return {
    shots: S,
    active: shot => shot.startsWith('ground'),
    render(renderer, camera, shot, t) {
      if (!moved) { for (const { m } of players) scene.add(m.root, m.shadow); scene.add(ball); moved = true; }
      if (S[shot].up) camera.up.set(0, 0, -1), camera.lookAt(...S[shot].at); else camera.up.set(0, 1, 0);
      weather.update(t, camera.position);
      renderer.render(scene, camera);
    },
    info: () => ({ ground: { name: recipe.name, time: recipe.time, ms, ...g.stats, flags: g.ultras.flags, board: g.board, times: Object.keys(TIMES2) } }),
  };
}
