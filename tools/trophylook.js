// Trophy shots for tools/ps2look.html (game/ps2/trophies.js). The cups stand on the ceremony pedestal at
// the middle of the stage, their fronts toward -z; cameras are in front unless the shot says otherwise.
//   worldwide | clubwide       on the pedestal on the pitch
//   worldheld | clubheld       as held in both hands at chest height, 35 cm from your eyes
//   worldabove | clubabove     from above, 40 cm
//   worldbelow | clubbelow     lifted over your head, looking up at it
//   worldside | clubside       held, from the side
//   pair                       the two side by side
//   worldspin | clubspin       a turntable (film it: FILM=6)
//   worldsketch | clubsketch   the three sketches side by side (chosen one in the middle)
// &grips=1 shows the hand-holds as red balls the thickness of what the hand closes round.
import * as THREE from 'three';
import { buildTrophy2, buildPlinth2, REST_Y } from '../game/ps2/trophies.js';

export function trophyShots(scene, q) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const make = (kind, v) => {
    const c = buildTrophy2(kind, v);
    if (q.get('grips')) for (const p of c.userData.grips) { const s = new THREE.Mesh(new THREE.SphereGeometry(c.userData.holdD / 2 + 0.002, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff2020', wireframe: true })); s.position.set(...p); c.add(s); }
    return c;
  };
  const cups = { world: make('world'), club: make('club') };
  const plinth = buildPlinth2(); root.add(plinth);
  const sketch = { world: ['spire', 'flame', 'wreath'], club: ['tulip', 'amphora', 'hex'] };
  const sk = {};
  for (const k of ['world', 'club']) { sk[k] = new THREE.Group(); sketch[k].forEach((v, i) => { const c = make(k, v); c.position.x = (1 - i) * (k === 'world' ? 0.42 : 0.6); sk[k].add(c); }); root.add(sk[k]); }
  root.add(cups.world, cups.club);
  const info = {};
  for (const k of ['world', 'club']) info[k] = cups[k].userData;
  // show(kind | 'pair' | 'sketch:kind', where the cup is, its turn)
  const show = (what, at = [0, REST_Y, 0], ry = 0, onPlinth = true) => {
    root.visible = true; plinth.visible = onPlinth;
    for (const k of ['world', 'club']) { cups[k].visible = what === k || what === 'pair'; sk[k].visible = what === 'sketch:' + k; cups[k].position.set(...at); cups[k].rotation.set(0, ry, 0); sk[k].position.set(...at); }
    if (what === 'pair') { cups.world.position.x = at[0] + 0.15; cups.club.position.x = at[0] - 0.17; }
  };
  const off = () => [null, null, null, null, null, null];
  const S = {}, HELD = 1.22, UP = 1.8;
  for (const k of ['world', 'club']) {
    const h = info[k].height, mid = k === 'world' ? 0.36 : 0.38;
    Object.assign(S, {
      [k + 'wide']: { fov: 40, cam: [-0.9, 1.6, 2.6], at: [0, 1.15, 0], tick: () => show(k, undefined, Math.PI) },   // (turned to face the main stand)
      [k + 'held']: { fov: 80, cam: [0.03, HELD + mid + 0.16, -0.36], at: [0, HELD + mid + 0.01, 0], tick: () => show(k, [0, HELD, 0], 0, false) },
      [k + 'side']: { fov: 70, cam: [-0.42, HELD + mid + 0.15, -0.12], at: [0, HELD + mid - 0.03, 0], tick: () => show(k, [0, HELD, 0], 0, false) },
      [k + 'above']: { fov: 60, cam: [0, HELD + h + 0.3, -0.16], at: [0, HELD + h * 0.55, 0], tick: () => show(k, [0, HELD, 0], 0, false) },
      [k + 'below']: { fov: 80, cam: [0, 1.6, -0.4], at: [0, UP + mid * 0.8, 0], tick: () => show(k, [0, UP, 0], 0, false) },
      [k + 'spin']: { fov: 34, cam: [0, REST_Y + h * 0.75, -1.35], at: [0, REST_Y + h * 0.5, 0], tick: t => show(k, [0, REST_Y, 0], t * 1.05) },
      [k + 'sketch']: { fov: 34, cam: [0, REST_Y + 0.42, k === 'world' ? -2.0 : -2.7], at: [0, REST_Y + 0.28, 0], tick: () => show('sketch:' + k) },
    });
  }
  S.pair = { fov: 34, cam: [0.05, REST_Y + 0.5, -1.45], at: [0, REST_Y + 0.28, 0], tick: () => show('pair') };
  for (const s of Object.values(S)) { s.ball = [60, 60]; s.set = off; }
  return { shots: S, hide: () => { root.visible = false; }, info };
}
