// The PS2-look pitch and ball. The pitch is one quad: a fine grass texture up close, wide mown
// stripes worked out from where the pixel is on the pitch, and a sheen that lightens the grass
// toward the horizon. Lines are thin quads just above it.
import * as THREE from 'three';
import { canvas, hash, vnoise, eachPixel, smoothTex } from './paint.js';
import { buildBall04 } from './ball.js';

function grassTex() {
  const c = canvas(256, 256), ctx = c.getContext('2d');
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 256, 256);
  eachPixel(ctx, { x: 0, y: 0, w: 256, h: 256 }, (u, v, col, px, py) => {
    // blades: short streaks, stretched up the texture; kept near mid grey (the shader multiplies it in)
    const blade = vnoise(px * 0.8, py * 0.3, 1, 0) * 0.6 + vnoise(px * 0.4 + 40, py * 0.16, 2, 0) * 0.4;
    const clump = (vnoise(px / 32 * 4, py / 32 * 4, 3, 32) + vnoise(px / 64 * 4, py / 64 * 4, 4, 16)) * 0.5;
    const g = 128 + 104 * (blade - 0.5) + 44 * (clump - 0.5) + 22 * (hash(px, py, 5) - 0.5);
    col[0] = col[1] = col[2] = g;
  });
  return smoothTex(c, { repeat: [1, 1], aniso: 8 });
}

// size: [length along x, width along z]. stripe: width of one mown band (m).
export function buildPitch({ size = [140, 100], stripe = 5.5 } = {}) {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uGrass: { value: null }, uStripe: { value: stripe }, uLight: { value: new THREE.Color('#486b2a') }, uDark: { value: new THREE.Color('#3d5d26') }, uWet: { value: 0 } }]),
    vertexShader: `varying vec3 vW; varying vec3 vV;
${THREE.ShaderChunk.fog_pars_vertex}
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vV = cameraPosition - w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
${THREE.ShaderChunk.fog_vertex}
}`,
    fragmentShader: `uniform sampler2D uGrass; uniform float uStripe; uniform vec3 uLight; uniform vec3 uDark; uniform float uWet; varying vec3 vW; varying vec3 vV;
${THREE.ShaderChunk.fog_pars_fragment}
      void main() {
        float band = vW.x / uStripe, edge = fwidth(band) * 1.5 + 0.02;
        float s = abs(fract(band * 0.5) - 0.5) * 2.0;                       // a triangle wave: 0..1..0 every two bands
        float k = smoothstep(0.5 - edge, 0.5 + edge, s);
        vec3 col = mix(uDark, uLight, k);
        float d = length(vV), near = 0.5 * (texture2D(uGrass, vW.xz * 0.45).r + texture2D(uGrass, vW.zx * 0.39 + 0.3).r), far = texture2D(uGrass, vW.zx * 0.06).r;
        col *= 0.36 + 0.9 * mix(near, 0.5, smoothstep(5.0, 28.0, d)) + 0.36 * far;
        float graze = 1.0 - abs(normalize(vV).y);
        col = mix(col, vec3(0.5, 0.63, 0.4), (0.34 + 0.25 * uWet) * pow(graze, 5.0));   // the sheen toward the horizon
        gl_FragColor = vec4(col, 1.0);
        ${THREE.ShaderChunk.fog_fragment}
      }`,
  });
  mat.extensions = { derivatives: true };
  mat.uniforms.uGrass.value = grassTex();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// White lines: [[x1, z1, x2, z2]], each 12 cm wide. One draw call.
export function buildLines(segs, w = 0.12) {
  const pos = [], idx = [];
  for (const [x1, z1, x2, z2] of segs) {
    const dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2, ex = dx / l * w / 2, ez = dz / l * w / 2, b = pos.length / 3;
    pos.push(x1 - ex + nx, 0.006, z1 - ez + nz, x1 - ex - nx, 0.006, z1 - ez - nz, x2 + ex + nx, 0.006, z2 + ez + nz, x2 + ex - nx, 0.006, z2 + ez - nz);
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xe9efe2, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: THREE.DoubleSide }));
}

// The ball (game/ps2/ball.js), just its mesh, for the look page.
export const buildBall2 = () => buildBall04().mesh;
