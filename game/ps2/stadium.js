// The '04-look stadium, with the same interface as game/stadium.js so the game can swap one import:
//   const stadium = buildStadium(scene);
//   stadium.setGround(recipe, ours, theirs, oursShare)  -> ground { board: { y, z }, recipe, topY, ... }
//   stadium.setWeather('clear' | 'rain' | 'snow')       (after setGround)
//   stadium.netHit(x, y), stadium.cheer(on), stadium.theirs(), stadium.ooh(), stadium.update(dt, t), stadium.ground
// (ooh: a near miss, a save or the woodwork: your fans' hands go to their heads; game/main.js calls it)
// Recipes are game/grounds.js's (GROUNDS, groundFor, venueFor stay there). The time of day sets the
// light every ground material shares (groundmat.js), the scene's two lights (they light the players
// and the posts) and the sky; the weather sits on top of it. Rain and snow particles are
// game/ps2/weather.js.
import * as THREE from 'three';
import { GROUNDS } from '../grounds.js';
import { LIGHT_DIR } from './player.js';
import { groundLight } from './groundmat.js';
import { buildGround2 } from './ground.js';
import { buildTurf, buildMarkings } from './turf.js';
import { buildGoal2 } from './goal2.js';
import { cloudTexture } from './groundtex.js';

// amb / sun / flood: what the baked weights mix (0..1 each channel). hemi / key: the scene's lights.
export const TIMES2 = {
  day: { sky: ['#d3e2ee', '#4a86d2'], clouds: 1, stars: 0, fog: ['#c9d6e2', 90, 420], amb: [0.6, 0.61, 0.62], sun: [0.55, 0.52, 0.47], flood: [0, 0, 0], lamp: 0, hemi: ['#dfe6f0', '#38372c', 0.62], key: ['#fff0d6', 0.68], day: 1, shadow: 0.42, wx: 1 },
  dusk: { sky: ['#f2a46e', '#2a2856'], clouds: 0.7, stars: 0, fog: ['#7a5a64', 90, 380], amb: [0.42, 0.36, 0.4], sun: [0.46, 0.31, 0.2], flood: [0.3, 0.29, 0.27], lamp: 0.75, hemi: ['#ffd8c0', '#3a3020', 0.52], key: ['#ffc890', 0.64], day: 0.6, shadow: 0.25, wx: 0.85 },
  night: { sky: ['#18213f', '#02040c'], clouds: 0, stars: 1, fog: ['#0d1328', 110, 440], amb: [0.15, 0.16, 0.22], sun: [0, 0, 0], flood: [0.74, 0.74, 0.72], lamp: 1, hemi: ['#c8d4ff', '#20281c', 0.5], key: ['#f4f6ff', 0.74], day: 0, shadow: 0, wx: 1.1 },
};

function skyDome() {
  const uniforms = { uHorizon: { value: new THREE.Color() }, uTop: { value: new THREE.Color() }, uClouds: { value: 0 }, uStars: { value: 0 }, uOvercast: { value: 0 }, uGrey: { value: new THREE.Color('#7c838e') }, uMap: { value: cloudTexture() } };
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms,
    vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uHorizon, uTop, uGrey; uniform float uClouds, uStars, uOvercast; uniform sampler2D uMap; varying vec3 vD;
void main() {
  vec3 d = normalize(vD); float e = max(d.y, 0.0);
  vec3 c = mix(uHorizon, uTop, pow(e, 0.55));
  float az = atan(d.x, d.z) / 6.2832 + 0.5;
  float cl = texture2D(uMap, vec2(az * 3.0, clamp(e * 2.6, 0.0, 1.0))).r * uClouds * (1.0 - smoothstep(0.25, 0.4, e));
  c = mix(c, mix(vec3(1.0), uHorizon, 0.25), cl * 0.85);
  vec3 g = floor(d * 260.0); float h = fract(sin(dot(g, vec3(12.99, 78.23, 37.71))) * 43758.55);
  c += vec3(step(0.9975, h) * uStars * smoothstep(0.08, 0.3, e) * 0.8);
  c = mix(c, uGrey * mix(1.0, 0.75, e), uOvercast);
  gl_FragColor = vec4(c, 1.0);
}`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(210, 24, 12), m);          // inside the game camera's 260 m far plane from anywhere on the pitch
  mesh.position.z = -15; mesh.renderOrder = -10; mesh.frustumCulled = false;
  return { mesh, uniforms };
}

export function buildStadium(scene) {
  scene.background = new THREE.Color('#0d1328');
  scene.fog = new THREE.Fog('#0d1328', 110, 440);
  const hemi = new THREE.HemisphereLight('#dfe6f0', '#38372c', 0.62); scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff0d6', 0.68); key.position.copy(LIGHT_DIR).multiplyScalar(50); scene.add(key);
  const light = groundLight(), jump = { uJumpOurs: { value: 0 }, uJumpTheirs: { value: 0 }, uOoh: { value: 0 }, uGoalT: { value: 99 }, uTheirT: { value: 99 } }, hype = { uHypeH: { value: 0 }, uHypeA: { value: 0 } };
  const sky = skyDome(); scene.add(sky.mesh);
  const turf = buildTurf(light); scene.add(turf.mesh);
  const marks = buildMarkings(light); scene.add(marks);
  const goal = buildGoal2(light); scene.add(goal.group);

  let ground = null, time = TIMES2.night, weather = 'clear', jumpOurs = 0, jumpTheirs = 0, cheering = false, ooh = 0, goalT = 99, theirT = 99;
  const drop = g => {
    scene.remove(g.group);
    g.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.uniforms) for (const u of Object.values(o.material.uniforms)) if (u.value && u.value.isTexture && u.value !== g.atlas && !u.value.userData.keep) u.value.dispose(); });
  };
  // the time of day with the weather over it
  function light2() {
    const T = time, rain = weather === 'rain', snow = weather === 'snow', dim = rain ? 0.82 : snow ? 1.02 : 1, sunK = rain ? 0.35 : snow ? 0.5 : 1;
    light.uAmb.value.setRGB(...T.amb).multiplyScalar(dim); light.uSun.value.setRGB(...T.sun).multiplyScalar(sunK); light.uFlood.value.setRGB(...T.flood);
    light.uLamp.value = T.lamp; light.uWet.value = rain ? 1 : 0; light.uSnow.value = snow ? 1 : 0;
    // a grey sky over the stands in rain or snow; the floodlights come on in the gloom of a rainy day
    if ((rain || snow) && T.lamp === 0) { light.uLamp.value = 0.55; light.uFlood.value.setRGB(0.18, 0.18, 0.18); }
    sky.uniforms.uHorizon.value.set(T.sky[0]); sky.uniforms.uTop.value.set(T.sky[1]); sky.uniforms.uClouds.value = T.clouds; sky.uniforms.uStars.value = rain || snow ? 0 : T.stars;
    sky.uniforms.uOvercast.value = rain ? 0.85 * T.wx * (T.day ? 1 : 0.5) : snow ? 0.75 * (T.day ? 1 : 0.4) : 0;
    sky.uniforms.uGrey.value.set(T.day ? (snow ? '#aab0ba' : '#7c838e') : '#20242e');
    const fog = scene.fog, fc = new THREE.Color(T.fog[0]);
    if (rain) fc.lerp(new THREE.Color(T.day ? '#646b76' : '#262b36'), 0.7);
    if (snow) fc.lerp(new THREE.Color(T.day ? '#bcc3ce' : '#3a404c'), 0.7);
    fog.color.copy(fc); fog.near = rain ? 30 : snow ? 24 : T.fog[1]; fog.far = rain ? 170 : snow ? 150 : T.fog[2];
    scene.background.copy(fc);
    hemi.color.set(T.hemi[0]); hemi.groundColor.set(T.hemi[1]); hemi.intensity = T.hemi[2] * (rain ? 0.9 : 1);
    key.color.set(T.key[0]); key.intensity = T.key[1] * (rain ? 0.65 : snow ? 0.8 : 1);
    if (ground) { turf.set(ground.recipe, ground.plan, T.shadow * sunK); ground.meshes.glows.visible = light.uLamp.value > 0; ground.meshes.seats.material.uniforms.uDay.value = ground.meshes.fans.material.uniforms.uDay.value = T.day; }
  }
  const api = {
    netHit: goal.hit,
    cheer: on => { if (on && !cheering) goalT = 0; cheering = on; },
    theirs: () => { jumpTheirs = 1; theirT = 0; },
    ooh: () => { ooh = 1; },
    get ground() { return ground; },
    get light() { return light; },
    setGround(recipe = GROUNDS.default, ours = ['#f2f1ea'], theirs = ['#3a3a4a'], oursShare = 0.75) {
      if (ground) drop(ground);
      ground = buildGround2(recipe, ours, theirs, oursShare, light, jump, hype);
      ground.atlas = ground.meshes.structure.material.uniforms.uMap.value;
      ground.uniforms = { uTime: light.uTime, uJumpOurs: jump.uJumpOurs, uJumpTheirs: jump.uJumpTheirs };   // as game/grounds.js hands them out
      scene.add(ground.group);
      time = TIMES2[recipe.time] || TIMES2.night; weather = 'clear';
      light2();
      return ground;
    },
    setWeather(kind) { weather = kind; light2(); },
    // how bright rain and snow should be drawn (game/ps2/weather.js bright()): lit by floodlights at night
    get weatherBright() { return time.wx; },
    update(dt, t) {
      goal.update(dt);
      light.uTime.value = t;
      jumpOurs += ((cheering ? 1 : 0) - jumpOurs) * Math.min(1, dt * 3);
      jumpTheirs = Math.max(0, jumpTheirs - dt * 0.15);                   // their end celebrates for about 6 s
      ooh = Math.max(0, ooh - dt * 0.55); goalT += dt; theirT += dt;
      jump.uJumpOurs.value = jumpOurs; jump.uJumpTheirs.value = jumpTheirs; jump.uOoh.value = ooh; jump.uGoalT.value = goalT; jump.uTheirT.value = theirT;
      if (ground) { const co = ground.curvaOurs; ground.ultras.update(dt, t, co ? jumpOurs : jumpTheirs, co ? jumpTheirs : jumpOurs); }
    },
  };
  api.setGround();
  return api;
}
