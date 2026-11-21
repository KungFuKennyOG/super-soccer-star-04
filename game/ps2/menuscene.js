// The picture behind the menus: a daylight stand and pitch on the left and a close crop of a player's shirt on the
// right, out of focus and a little washed out, like the front end of a 2003-04 console football game. Built from our
// own '04 assets (game/ps2/stand.js, pitch.js, player.js: an invented kit with our shield, no wordmark), rendered once
// per kit into a render target, read back into a 2D canvas and softened there. The menus draw it into their middle band.
import * as THREE from 'three';
import { buildPlayer2, LIGHT_DIR } from './player.js';
import { buildPitch, buildLines } from './pitch.js';
import { buildStand, buildSky } from './stand.js';
import { animate, placeModel } from '../actors.js';

let set = null;
const cache = new Map();

function buildSet() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#b9c3cc', 40, 170);
  scene.add(new THREE.HemisphereLight('#dfe6f0', '#38372c', 0.62));
  const sun = new THREE.DirectionalLight('#fff0d6', 0.68); sun.position.copy(LIGHT_DIR).multiplyScalar(50); scene.add(sun);
  scene.add(buildSky(), buildPitch());
  scene.add(buildLines([[-60, -34, 40, -34], [-20, -34, -20, 30], [-20, -14, -3, -14], [-3, -14, -3, 6]]));
  const back = buildStand({ len: 110, home: '#8a8f98' }); back.position.set(-20, 0, -46); scene.add(back);
  const side = buildStand({ len: 70, home: '#8a8f98' }); side.position.set(-58, 0, 0); side.rotation.y = Math.PI / 2; scene.add(side);
  const cam = new THREE.PerspectiveCamera(34, 2, 0.1, 400);
  return { scene, cam, players: new Map() };
}

// kit: a kit from rules/teams.js; key: something to cache it by (the team id). Returns a canvas w x h.
export function renderBackdrop(renderer, kit, key, w = 1024, h = 492) {
  const id = `${key}|${w}x${h}`;
  if (cache.has(id)) return cache.get(id);
  if (!set) set = buildSet();
  const { scene, cam } = set;
  // the player: a metre and a bit in front of the camera and to its right, turned a little toward its left
  for (const m of set.players.values()) m.root.visible = false;
  let m = set.players.get(key);
  if (!m) { m = buildPlayer2(kit, 10, 3); set.players.set(key, m); scene.add(m.root); }
  m.root.visible = true;
  const p = { x: 0, z: 0, fx: Math.sin(-0.35), fz: Math.cos(-0.35), vx: 0, vz: 0, role: 'mate', stride: 0, id: 'menu' };
  const ball = { x: -6, y: 0.11, z: -9 };
  placeModel(m, p);
  for (let i = 0; i < 40; i++) animate(m, p, 1 / 30, i / 30, false, null, ball, false);
  m.root.updateMatrixWorld(true);
  cam.aspect = w / h; cam.updateProjectionMatrix();
  cam.position.set(-0.75, 1.36, 1.3); cam.lookAt(-3.2, 1.05, -9);
  // render into a target with the headset off, then put everything back as it was (game/replay.js does the same)
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 0 });
  const xrOn = renderer.xr.enabled, prevRT = renderer.getRenderTarget();
  renderer.xr.enabled = false;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  const px = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
  renderer.setRenderTarget(prevRT);
  renderer.xr.enabled = xrOn;
  rt.dispose();
  m.root.visible = false;
  // GL rows run bottom up
  const raw = document.createElement('canvas'); raw.width = w; raw.height = h;
  const img = raw.getContext('2d').createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  raw.getContext('2d').putImageData(img, 0, 0);
  // out of focus, washed out a little, a touch darker so white type reads over it
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const o = out.getContext('2d');
  o.filter = `blur(${Math.max(1, Math.round(w / 500))}px) saturate(0.72) contrast(0.92) brightness(0.86)`;
  o.drawImage(raw, 0, 0); o.filter = 'none';
  cache.set(id, out);
  return out;
}
