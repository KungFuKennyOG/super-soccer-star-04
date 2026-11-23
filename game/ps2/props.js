// Two '04-look props that were recoloured PS1 boxes: the replay's floating screen and the team-select
// turntable. Smooth geometry, lit like the players (Phong), the finish painted in code.
//   buildMonitor(picture): a slim 2003-era broadcast monitor, graphite bezel 4 cm round a 16:9 picture
//     (1.44 x 0.81 m as before, its face at z = 0), a shallow housing behind, a power light. 1 + 1 draws.
//   buildPlinth(): a low turntable, a brushed dark top with a soft spot of light in its middle, a satin
//     metal rim and a thin gold light ring at its foot. Its top is at y = 0.18 as before. 3 draws.
import * as THREE from 'three';
import { canvas, hash, smoothTex } from './paint.js';

const once = (() => { const m = new Map(); return (k, f) => (m.has(k) ? m.get(k) : (m.set(k, f()), m.get(k))); })();

// a rounded rectangle (w x h, corner radius r) round the origin, as a path
function rrect(path, w, h, r) {
  const x = -w / 2, y = -h / 2;
  path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

// Graphite plastic with a fine grain and a soft sheen from the top (2003 monitors were dark grey, not black).
const plastic = () => once('plastic', () => {
  const c = canvas(128, 128), x = c.getContext('2d'), img = x.createImageData(128, 128);
  for (let py = 0; py < 128; py++) for (let px = 0; px < 128; px++) {
    const n = 0.93 + 0.07 * hash(px, py, 11) + 0.04 * hash(px >> 3, py >> 2, 12), v = Math.round(255 * n), i = (py * 128 + px) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return smoothTex(c, { repeat: [6, 6] });
});

export function buildMonitor(picture) {
  const W = 1.44, H = 0.81, side = 0.04, chin = 0.07, D = 0.03;
  const OW = W + 2 * side, OH = H + side + chin, cy = (side - chin) / 2;   // the frame's middle: below the picture's, the chin is deeper
  const tex = plastic();
  const mat = new THREE.MeshPhongMaterial({ color: '#3a3c42', map: tex, shininess: 38, specular: '#3c3e44' });
  const g = new THREE.Group();
  // the bezel: a rounded frame round the picture, its edges bevelled
  const frame = rrect(new THREE.Shape(), OW, OH, 0.035);
  const hole = rrect(new THREE.Path(), W + 0.004, H + 0.004, 0.006);
  frame.holes = [new THREE.Path(hole.getPoints(4).map(p => new THREE.Vector2(p.x, p.y - cy)))];   // the picture sits above the chin
  const bez = new THREE.ExtrudeGeometry(frame, { depth: D, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 6 });
  bez.translate(0, cy, -D - 0.006);
  const bezel = new THREE.Mesh(bez, mat);
  // the housing behind: a shallower rounded box, then a smaller hump for the electronics
  const back = new THREE.Group();
  for (const [w, h, d, z] of [[OW - 0.04, OH - 0.04, 0.05, -D - 0.06], [OW * 0.62, OH * 0.6, 0.06, -D - 0.12]]) {
    const geo = new THREE.ExtrudeGeometry(rrect(new THREE.Shape(), w, h, 0.05), { depth: d, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 6 });
    geo.translate(0, cy, z);
    back.add(new THREE.Mesh(geo, mat));
  }
  // a power light on the chin, bottom right, and a faint lighter strip along the chin's top edge
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), new THREE.MeshBasicMaterial({ color: '#4cff7a', fog: false, toneMapped: false }));
  led.position.set(W / 2 - 0.03, -H / 2 - chin / 2, 0.0035);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: picture, fog: false, toneMapped: false }));
  screen.position.z = 0.002;
  // a dark recess just round the picture so the bezel's inner edge reads as a step
  const recess = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.012, H + 0.012), new THREE.MeshBasicMaterial({ color: '#0b0c0e', fog: false }));
  recess.position.z = -0.004;
  g.add(bezel, ...back.children, led, screen, recess);
  const tris = g.children.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
  return { group: g, screen, tris };
}

// the plinth's top: brushed dark steel in rings, lit in a soft pool in the middle, darker to the edge
const plinthTop = () => once('plinthTop', () => {
  const S = 256, c = canvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S);
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const dx = (px + 0.5) / S - 0.5, dy = (py + 0.5) / S - 0.5, r = Math.hypot(dx, dy) * 2;
    const brush = 0.94 + 0.06 * hash(Math.round(r * 420), 0, 21), pool = 0.55 + 0.5 * Math.exp(-r * r * 3.2), edge = r > 0.93 && r < 0.96 ? 1.25 : 1;
    const v = Math.min(255, 255 * 0.38 * brush * pool * edge), i = (py * S + px) * 4;
    img.data[i] = v; img.data[i + 1] = v * 1.02; img.data[i + 2] = v * 1.08; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return smoothTex(c, { aniso: 8 });
});

export function buildPlinth() {
  const g = new THREE.Group(), seg = 72;
  // the body: a lathe from the top's middle out over a rounded lip and down a slightly flared side
  const prof = [[0, 0.18], [0.5, 0.18], [0.535, 0.177], [0.553, 0.168], [0.56, 0.155], [0.565, 0.06], [0.6, 0.035], [0.62, 0.02], [0.62, 0]].map(([r, y]) => new THREE.Vector2(r, y));
  const side = new THREE.LatheGeometry(prof.slice(1).reverse(), seg);   // bottom up, so the faces look out
  const sideMat = new THREE.MeshPhongMaterial({ color: '#2c2f36', specular: '#8a8e98', shininess: 60 });
  const top = new THREE.CircleGeometry(0.5, seg); top.rotateX(-Math.PI / 2); top.translate(0, 0.1801, 0);
  const topMat = new THREE.MeshPhongMaterial({ color: '#ffffff', map: plinthTop(), specular: '#55585e', shininess: 24 });
  // the gold light ring at its foot (unlit, so it glows), and its glow on the floor
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.612, 0.007, 6, seg), new THREE.MeshBasicMaterial({ color: '#f2c14e', toneMapped: false }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.045;
  g.add(new THREE.Mesh(side, sideMat), new THREE.Mesh(top, topMat), ring);
  return { group: g, tris: (side.index.count + top.index.count + ring.geometry.index.count) / 3 };
}
