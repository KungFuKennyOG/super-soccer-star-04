// The '04 markers over the match: the pass timing rings, the ring on the grass under the man you'd pass to,
// the shot reticle on the goal and its power ring, and the arrow over a teammate on the ball. Painted smooth
// on canvases (game/ps2/ui.js's look: thin light lines with a soft dark edge, gold, maroon), where the PS1
// game drew them in hard 16 px pixels. Rings are painted white and tinted by the material's color.
import * as THREE from 'three';
import { PAL, uiTex, uiMat } from './ui.js';

const once = (() => { const m = new Map(); return (k, f) => (m.has(k) ? m.get(k) : (m.set(k, f()), m.get(k))); })();
function paint(w, h, draw, o) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return uiTex(c, o);
}
// a circle stroked with a soft dark edge under it
function ringLine(x, cx, cy, r, lw, color = '#fff', edge = 0.55) {
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
  x.strokeStyle = `rgba(0,0,0,${edge})`; x.lineWidth = lw + 6; x.stroke();
  x.strokeStyle = color; x.lineWidth = lw; x.stroke();
}

export const COLORS = {
  ring: PAL.gold, lob: '#6cc4f2', perfect: PAL.good, good: PAL.gold, bad: PAL.bad,
  power: PAL.gold, full: '#f08a2e', over: '#ff3a30',
};

// Pass timing: the fixed circle and the shrinking live ring (same texture, the ring sits at its edge).
export const ringTex = () => once('ring', () => paint(256, 256, (x, w) => ringLine(x, w / 2, w / 2, w / 2 - 14, 12)));

// The marker on the grass: a ring with a fainter inner ring and a light fill, lying flat.
export const groundTex = () => once('ground', () => paint(256, 256, (x, w) => {
  const c = w / 2;
  const g = x.createRadialGradient(c, c, c * 0.3, c, c, c - 10);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.32)');
  x.fillStyle = g; x.beginPath(); x.arc(c, c, c - 10, 0, Math.PI * 2); x.fill();
  ringLine(x, c, c, c - 18, 22, '#fff', 0.35);
  ringLine(x, c, c, c * 0.62, 7, 'rgba(255,255,255,0.75)', 0.2);
}));

// The reticle: a thin ring with four ticks pointing in and a maroon dot in the middle.
export const reticleTex = () => once('reticle', () => paint(256, 256, (x, w) => {
  const c = w / 2;
  ringLine(x, c, c, 70, 7);
  const tick = (ax, ay) => {
    x.beginPath(); x.moveTo(c + ax * 120, c + ay * 120); x.lineTo(c + ax * 82, c + ay * 82);
    x.lineCap = 'round'; x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 15; x.stroke();
    x.strokeStyle = '#fff'; x.lineWidth = 9; x.stroke();
  };
  tick(0, -1); tick(0, 1); tick(-1, 0); tick(1, 0);
  x.beginPath(); x.arc(c, c, 13, 0, Math.PI * 2); x.fillStyle = 'rgba(0,0,0,0.55)'; x.fill();
  x.beginPath(); x.arc(c, c, 9, 0, Math.PI * 2); x.fillStyle = PAL.maroonHi; x.fill();
}));

// Shot power: a dark track round the reticle that fills clockwise from the top. One canvas, repainted when the
// fill or its color changes. r0..r1: the ring's inner and outer radius in metres on a plane `size` across.
export function buildPower(size = 2.1, r0 = 0.78, r1 = 0.98) {
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W;
  const x = c.getContext('2d'), t = uiTex(c, { mips: false }), k = W / size, mid = (r0 + r1) / 2 * k, lw = (r1 - r0) * k;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), uiMat(t, { depthTest: false }));
  m.renderOrder = 12;
  let key = '';
  return {
    mesh: m,
    set(fill, color) {
      const steps = Math.round(Math.max(0, Math.min(1, fill)) * 60), kk = steps + color;
      if (kk === key) return;
      key = kk;
      x.clearRect(0, 0, W, W);
      x.beginPath(); x.arc(W / 2, W / 2, mid, 0, Math.PI * 2);
      x.strokeStyle = 'rgba(8,8,10,0.6)'; x.lineWidth = lw; x.stroke();
      if (steps > 0) {
        x.beginPath(); x.arc(W / 2, W / 2, mid, -Math.PI / 2, -Math.PI / 2 + steps / 60 * Math.PI * 2);
        x.strokeStyle = color; x.lineWidth = lw - 4; x.stroke();
      }
      for (const r of [mid - lw / 2, mid + lw / 2]) { x.beginPath(); x.arc(W / 2, W / 2, r, 0, Math.PI * 2); x.strokeStyle = PAL.line; x.lineWidth = 1.5; x.stroke(); }
      t.needsUpdate = true;
    },
  };
}

// The arrow over a teammate on the ball: a gold triangle pointing down, a soft dark edge.
export const arrowTex = () => once('arrow', () => paint(128, 128, x => {
  x.beginPath(); x.moveTo(18, 30); x.lineTo(110, 30); x.lineTo(64, 104); x.closePath();
  x.lineJoin = 'round'; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 12; x.stroke();
  x.fillStyle = PAL.gold; x.fill();
  x.strokeStyle = 'rgba(255,240,200,0.9)'; x.lineWidth = 2.5; x.stroke();
}));
export function buildArrow04() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), uiMat(arrowTex(), { side: THREE.DoubleSide }));
  m.visible = false;
  return m;
}
