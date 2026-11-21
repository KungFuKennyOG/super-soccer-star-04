// Trailer shots for tools/ps2look.html: any of the page's shots played inside a real ground (game/ps2/stadium.js)
// with a moving camera, for filming trailers. Off unless the query has &arena=.
//   &arena=TEAM      the ground (a club's own, else the national stadium) with TEAM's fans; &opp=ID their fans
//   &time=day|dusk|night, &wx=rain|snow, &goal=secs (your fans go up then), &ooh=secs, &net=1 (the net bulges
//                    when the ball crosses the line), &cheer=1 (your fans jumping from the start)
// &place=x,z moves it (default -7,0). The page's stage (x along the shot's run, the keeper shots' goal at x 34, z 7) is laid on the pitch so that
// +x runs at the far goal and the keeper shots' goal is the stadium's goal.
// Cameras (page coordinates, so they follow the page's players): &cam=
//   orbit   round a target: &r= metres, &ch= height, &a0= start angle (deg, 0 = from his right, +z), &av= deg/s, &ty= look height
//   track   a fixed offset from the target, eased: &off=x,y,z (&ty=)
//   path    keyframes in the STADIUM's coordinates: &k=t,x,y,z,ax,ay,az,fov;t,... (smoothstep between keys)
//   &tgt=p0..p5|ball|gk  what orbit and track follow (default p0), &lag= how fast they catch it up (default 4, 0 = locked), &fov=, &shake=amount (a handheld wobble)
import * as THREE from 'three';
import { buildStadium } from '../game/ps2/stadium.js';
import { createWeather } from '../game/ps2/weather.js';
import { groundFor, GROUNDS } from '../game/grounds.js';
import { byId, awayFor, CLUBS } from '../rules/teams.js';

const fans = kit => [kit.shirt, kit.alt, kit.shorts, kit.trim, '#f2f1ea'];
const num = (q, k, d) => (q.get(k) === null ? d : +q.get(k));
const ease = u => u * u * (3 - 2 * u);

export function trailerLook(q, pageScene, { players, ball, camera, keeper }) {
  if (!q.get('arena')) return { on: false };
  const hide = document.createElement('style'); hide.textContent = '.bar { display: none !important; }'; document.head.appendChild(hide);   // no name bars over the footage
  const scene = new THREE.Scene(), stadium = buildStadium(scene), weather = createWeather(scene);
  const team = byId(q.get('arena')) || byId('MAN'), opp = byId(q.get('opp') || (team.id === 'MAD' ? 'BAR' : 'MAD')) || byId('MAD');
  let recipe = CLUBS.some(c => c.id === team.id) ? groundFor(team.id) : GROUNDS.default;
  if (q.get('time')) recipe = { ...recipe, time: q.get('time') };
  stadium.setGround(recipe, fans(team.kit), fans(opp.id === team.id ? awayFor(team) : opp.kit), +(q.get('share') || 0.78));
  const wx = q.get('wx') || 'clear';
  stadium.setWeather(wx); weather.set(wx); weather.bright(stadium.weatherBright);
  if (q.get('cheer')) stadium.cheer(true);
  // the page's stage on the pitch: page (x, z) -> stadium (z - 7, -x)
  const sat = (q.get('place') || '-7,0').split(',').map(Number);   // &place=x,z: where the page's origin goes on the pitch
  const stage = new THREE.Group(); stage.rotation.y = Math.PI / 2; stage.position.set(sat[0], 0, sat[1]); scene.add(stage); stage.updateMatrixWorld();
  const kids = pageScene.children, env = new Set(kids.slice(0, kids.indexOf(players[0].m.root)));   // the page's own sky, pitch and stands (added before the players) stay behind
  const M = stage.matrixWorld, qStage = new THREE.Quaternion().setFromRotationMatrix(M), tmp = new THREE.Vector3(), look = new THREE.Vector3();
  const mode = q.get('cam'), fov = num(q, 'fov', 0), shake = num(q, 'shake', 0);
  const keys = (q.get('k') || '').split(';').filter(Boolean).map(s => s.split(',').map(Number));
  let last = null, eased = null, netDone = false;
  const at = (name, out) => {
    const k = q.get('tgt') || 'p0';
    if (k === 'ball') return out.copy(ball.position);
    if (k === 'gk' && keeper()) return out.copy(keeper().root.position);
    return out.copy(players[+(k.slice(1)) || 0].m.root.position);
  };
  return {
    on: true,
    render(renderer, t) {
      const dt = last === null ? 0 : Math.max(0, t - last); last = t;
      for (const o of pageScene.children.slice()) if (!env.has(o) && !o.isCamera && !o.isLight) { if (o.position.x === 34 && o.position.z === 7) o.visible = false; stage.add(o); }   // (the keeper shots' own goal: the ground has one)
      // the camera: the page's shot set it in page coordinates; ours goes over it
      if (mode === 'orbit' || mode === 'track') {
        const c = at(null, tmp), lag = num(q, 'lag', 4); if (!eased || !lag) eased = c.clone(); else eased.lerp(c, Math.min(1, dt * lag));   // &lag=0: no easing (slow motion)
        const ty = num(q, 'ty', 1.0);
        if (mode === 'orbit') {
          const a = (num(q, 'a0', 0) + num(q, 'av', 15) * t) * Math.PI / 180, r = num(q, 'r', 4);
          camera.position.set(eased.x + Math.sin(a) * r, num(q, 'ch', 1.2), eased.z + Math.cos(a) * r);
        } else { const o = (q.get('off') || '0,1.2,4').split(',').map(Number); camera.position.set(eased.x + o[0], o[1], eased.z + o[2]); }
        camera.lookAt(eased.x, ty, eased.z);
      }
      if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      camera.position.applyMatrix4(M); camera.quaternion.premultiply(qStage);
      if (mode === 'path' && keys.length) {
        let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
        const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], u = b[0] > a[0] ? ease(Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])))) : 0;
        const L = j => a[j] + (b[j] - a[j]) * u;
        camera.position.set(L(1), L(2), L(3)); look.set(L(4), L(5), L(6)); camera.up.set(0, 1, 0); camera.lookAt(look);
        if (a.length > 7) { camera.fov = L(7); camera.updateProjectionMatrix(); }
      }
      if (shake) { camera.rotation.x += Math.sin(t * 2.3) * shake * 0.01 + Math.sin(t * 5.1) * shake * 0.004; camera.rotation.y += Math.sin(t * 1.7 + 1) * shake * 0.01; }
      // the match moments
      const bw = tmp.copy(ball.position).applyMatrix4(M);
      if (q.get('net') && !netDone && bw.z < -34.05 && Math.abs(bw.x) < 3.7 && bw.y < 2.5) { netDone = true; stadium.netHit(bw.x, bw.y); stadium.cheer(true); }
      const fire = (k, fn) => { const s = q.get(k); if (s && t >= +s && t - dt < +s) fn(); };
      fire('goal', () => stadium.cheer(true)); fire('ooh', () => stadium.ooh());
      stadium.update(dt, t, bw);
      weather.update(t, camera.position);
      renderer.render(scene, camera);
    },
  };
}
