// Polished metal and stone for the '04 look, with no downloads and no post-processing: a small stadium
// (sky, floodlights, stands, pitch) is painted in code into an equirect picture with the lights pushed
// past white, and MeshStandardMaterial reflects it (three turns an equirect envMap into a PMREM itself,
// once). Also the geometry helpers the trophies are built with: a lathe whose radius can vary round the
// turn (flutes, facets), with hard edges where the profile says, a tube along a polyline, a faceted
// star, and a merge so each material is one draw call.
import * as THREE from 'three';
import { canvas, fbm, hash, mix, clamp01 } from './paint.js';

// ---------- geometry (pure three, no DOM: unit tested in Node) ----------

// Revolve a profile [[r, y, hard?], ...] round the y axis in seg steps. mod(a, y, k) scales the radius
// at angle a (0 = toward -z, the trophy's front) and profile point k. A hard point is a crease: its ring
// is doubled so the faces either side keep their own normals. flat: every face its own normal (facets).
export function revolve(profile, seg, { mod, flat = false, a0 = 0 } = {}) {
  const pos = [], idx = [], rings = [];
  profile.forEach(([r, y, hard], k) => {
    const n = hard && k > 0 && k < profile.length - 1 ? 2 : 1;
    for (let d = 0; d < n; d++) {
      const start = pos.length / 3;
      for (let i = 0; i < seg; i++) {
        const a = a0 + (i / seg) * Math.PI * 2, rr = r * (mod ? mod(a, y, k) : 1);
        pos.push(Math.sin(a) * rr, y, -Math.cos(a) * rr);
      }
      rings.push({ start, dup: d === 0 && n === 2 });
    }
  });
  for (let k = 0; k < rings.length - 1; k++) {
    if (rings[k].dup) continue;                                  // the doubled ring: no face between the pair
    const a = rings[k].start, b = rings[k + 1].start;
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      idx.push(a + i, b + i, a + j, a + j, b + i, b + j);
    }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  if (flat) g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

// A tube of `sides` round a polyline [[x, y, z], ...]; r: its radius, r(t) along it (t 0..1) or one per point; squash: the
// section is that much narrower across the plane the line lies in (an oval bar).
export function tube(pts, r, sides = 10, { squash = 1, up = [0, 0, 1], caps = true } = {}) {
  const P = pts.map(p => new THREE.Vector3(...p)), n = P.length, pos = [], idx = [];
  const U = new THREE.Vector3(...up), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  let len = 0; const L = [0]; for (let i = 1; i < n; i++) L.push(len += P[i].distanceTo(P[i - 1]));
  for (let i = 0; i < n; i++) {
    T.subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
    N.copy(U).sub(T.clone().multiplyScalar(U.dot(T))).normalize(); B.crossVectors(T, N);
    const rr = typeof r === 'function' ? r(L[i] / len) : Array.isArray(r) ? r[i] : r;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2, c = Math.cos(a) * rr * squash, d = Math.sin(a) * rr;
      pos.push(P[i].x + N.x * c + B.x * d, P[i].y + N.y * c + B.y * d, P[i].z + N.z * c + B.z * d);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let s = 0; s < sides; s++) {
    const a = i * sides, b = a + sides, j = (s + 1) % sides;
    idx.push(a + s, a + j, b + s, a + j, b + j, b + s);
  }
  if (caps) for (const [i, flip] of [[0, true], [n - 1, false]]) {
    const c = pos.length / 3; pos.push(P[i].x, P[i].y, P[i].z);
    for (let s = 0; s < sides; s++) { const a = i * sides + s, b = i * sides + (s + 1) % sides; idx.push(...(flip ? [c, b, a] : [c, a, b])); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// A five-pointed star standing in the xy plane, facing -z: every point is two facets meeting in a
// ridge, rising from the rim (half-thickness edge) to the middle (half-thickness depth). Flat shaded.
export function starGeo(R, ri, depth, edge, points = 5) {
  const rim = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2, r = i % 2 ? ri : R;
    rim.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  const pos = [], m = rim.length, push = (...v) => pos.push(...v);
  for (let i = 0; i < m; i++) {
    const [x0, y0] = rim[i], [x1, y1] = rim[(i + 1) % m];
    push(0, 0, -depth, x0, y0, -edge, x1, y1, -edge);            // front facet
    push(0, 0, depth, x1, y1, edge, x0, y0, edge);               // back facet
    push(x0, y0, -edge, x0, y0, edge, x1, y1, -edge, x1, y1, -edge, x0, y0, edge, x1, y1, edge);   // the edge band
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}

// Many geometries into one (position, normal, and uv when all of them have it), indexed.
export function merge(list) {
  const out = new THREE.BufferGeometry(), pos = [], nor = [], uv = [], idx = [];
  const withUv = list.every(g => g.attributes.uv);
  let base = 0;
  for (const g0 of list) {
    const g = g0, p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); if (withUv) uv.push(g.attributes.uv.getX(i), g.attributes.uv.getY(i)); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) idx.push(base + i);
    base += p.count;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (withUv) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
export const tris = g => (g.index ? g.index.count : g.attributes.position.count) / 3;

// ---------- the painted stadium the metal reflects ----------

let ENV = null;
// 512 x 256 equirect, lit values: sky 0.5..1, floodlight cores up to 9 (past white, so they glint),
// dark stands, pitch green below the horizon. v = 0 is straight up.
export function stadiumEnv() {
  if (ENV) return ENV;
  const W = 512, H = 256, c = canvas(W, H), x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, H * 0.3);
  sky.addColorStop(0, '#3c4c6c'); sky.addColorStop(0.7, '#9fb2c8'); sky.addColorStop(1, '#dfe7ee');
  x.fillStyle = sky; x.fillRect(0, 0, W, H * 0.3);
  // soft cloud banks
  for (let i = 0; i < 26; i++) { const cx = hash(i, 1) * W, cy = H * (0.08 + hash(i, 2) * 0.17), r = 18 + hash(i, 3) * 40; const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, 'rgba(240,244,250,.55)'); gr.addColorStop(1, 'rgba(240,244,250,0)'); x.fillStyle = gr; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
  // the stands: a dark roof edge, tiers of crowd, a lit ad band, then the pitch
  const yRoof = H * 0.29, yAds = H * 0.475, yPitch = H * 0.5;
  x.fillStyle = '#15171d'; x.fillRect(0, yRoof, W, yAds - yRoof);
  for (let py = yRoof + 3; py < yAds - 1; py += 2) for (let px = 0; px < W; px += 2) {
    const h = hash(px, py, 5); if (h < 0.45) continue;
    const k = 40 + 90 * h; x.fillStyle = h > 0.93 ? `rgb(${k * 1.4},${k * 0.6},${k * 0.55})` : h > 0.8 ? `rgb(${k},${k},${k * 1.2})` : `rgb(${k * 0.6},${k * 0.6},${k * 0.7})`; x.fillRect(px, py, 1, 1);
  }
  x.fillStyle = '#0b0c10'; x.fillRect(0, yRoof, W, 4);
  for (let i = 0; i < 40; i++) { const k = 70 + 90 * hash(i, 7); x.fillStyle = `rgb(${k},${k},${k + 12})`; x.fillRect(i * W / 40, yAds, W / 40, yPitch - yAds); }   // ad boards, soft
  const pitch = x.createLinearGradient(0, yPitch, 0, H);
  pitch.addColorStop(0, '#4c5644'); pitch.addColorStop(0.3, '#2c3428'); pitch.addColorStop(1, '#161a14');   // the pitch, greyed: a low green-grey, so a cup's lower half is dark but not black or bright green
  x.fillStyle = pitch; x.fillRect(0, yPitch, W, H - yPitch);
  for (let i = 0; i < 24; i += 2) { x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(i * W / 24, yPitch, W / 24, H - yPitch); }
  x.fillStyle = 'rgba(240,240,235,.8)'; x.fillRect(0, yPitch + 9, W, 2); x.fillRect(0, yPitch + 40, W, 3);   // touchline and halfway line
  // read it back as lit values, then the floodlights: four banks over the stands, hot cores and a halo
  const d = x.getImageData(0, 0, W, H).data, f = new Float32Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { const j = ((H - 1 - Math.floor(i / W)) * W + (i % W)) * 4; f[j] = d[i * 4] / 255; f[j + 1] = d[i * 4 + 1] / 255; f[j + 2] = d[i * 4 + 2] / 255; f[j + 3] = 1; }   // (a data texture's first row is the bottom)
  const lamp = (u, v, s, k) => {
    for (let py = Math.max(0, Math.floor((v - s * 3) * H)); py < Math.min(H, (v + s * 3) * H); py++) for (let px = Math.floor((u - s * 6) * W); px < (u + s * 6) * W; px++) {
      const du = (px / W - u) / 2, dv = py / H - v, e = Math.exp(-(du * du + dv * dv) / (s * s)), i = ((H - 1 - py) * W + ((px % W) + W) % W) * 4;
      f[i] += e * k; f[i + 1] += e * k * 0.97; f[i + 2] += e * k * 0.9;
    }
  };
  for (let py = Math.round(yRoof) + 5; py < yRoof + 7; py++) for (let px = 0; px < W; px++) { const j = ((H - 1 - py) * W + px) * 4; f[j] += 0.9; f[j + 1] += 0.9; f[j + 2] += 0.85; }   // the lit underside of the roof
  for (let k = 0; k < 4; k++) { const u = 0.125 + k * 0.25; lamp(u, 0.22, 0.012, 9); lamp(u - 0.012, 0.23, 0.007, 4); lamp(u + 0.012, 0.23, 0.007, 4); lamp(u, 0.22, 0.05, 0.45); lamp(u + 0.125, 0.25, 0.008, 5); }
  lamp(0.62, 0.08, 0.06, 0.9);                                    // a bright patch of sky (the sun behind cloud)
  // half floats: filterable on every WebGL2 device (32-bit float filtering is an extension the Quest may lack)
  const h16 = new Uint16Array(f.length); for (let i = 0; i < f.length; i++) h16[i] = THREE.DataUtils.toHalfFloat(Math.min(f[i], 60000));
  const t = new THREE.DataTexture(h16, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  t.mapping = THREE.EquirectangularReflectionMapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  ENV = t;
  return t;
}

// ---------- materials ----------

// gold: warm and deep, reflections tinted, the dark of the stands turning it bronze-brown
export const goldMat = (o = {}) => new THREE.MeshStandardMaterial({ color: '#e6a646', metalness: 1, roughness: 0.16, emissive: '#2a1604', envMap: stadiumEnv(), envMapIntensity: 1.5, ...o });
// silver: near white, sharp, so the stands read as dark streaks in it
export const silverMat = (o = {}) => new THREE.MeshStandardMaterial({ color: '#f4f6fa', metalness: 1, roughness: 0.09, envMap: stadiumEnv(), envMapIntensity: 1.1, ...o });
// black lacquered stone for the club cup's plinth
export const ebonyMat = () => new THREE.MeshStandardMaterial({ color: '#0d0e12', metalness: 0.2, roughness: 0.16, envMap: stadiumEnv(), envMapIntensity: 0.9 });

// Malachite: concentric bands warped round a few eyes, dark lines between them, polished.
export function malachiteMat() {
  const W = 512, H = 64, c = canvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H);
  const eyes = [[0.1, 0.9], [0.37, -0.3], [0.62, 1.2], [0.86, 0.1]];
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const u = px / W, v = py / H;
    let dmin = 9; for (const [eu, ev] of eyes) { let du = Math.abs(u - eu); du = Math.min(du, 1 - du); dmin = Math.min(dmin, Math.hypot(du * 4, (v - ev) * 0.5)); }
    const w = dmin * 26 + fbm(u * 24, v * 3, 4, 24) * 3.2, b = w - Math.floor(w), line = Math.exp(-((b - 0.08) ** 2) / 0.0012);
    const tone = mix(0.35, 1, 0.5 + 0.5 * Math.sin(w * 1.7)) * (1 - 0.65 * line) * (0.85 + 0.3 * fbm(u * 60, v * 8, 9, 60));
    const i = (py * W + px) * 4, k = clamp01(tone);
    img.data[i] = 10 + 40 * k; img.data[i + 1] = 40 + 150 * k; img.data[i + 2] = 26 + 82 * k; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, metalness: 0, roughness: 0.12, envMap: stadiumEnv(), envMapIntensity: 0.55 });
}

// An engraved plate: the words cut in (dark, with a bright lower lip where the cut catches the light)
// on brushed metal; lines: [[text, px], ...]. tint: gold or silver.
export function plateMat(lines, tint, { w = 256, h = 128 } = {}) {
  const c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, w, h);
  for (let py = 0; py < h; py++) { x.fillStyle = `rgba(255,255,255,${0.25 * hash(1, py, 3)})`; x.fillRect(0, py, w, 1); }   // brushed
  x.strokeStyle = '#3a3a3a'; x.lineWidth = 3; x.strokeRect(7, 7, w - 14, h - 14);
  x.strokeStyle = '#ffffff'; x.lineWidth = 1; x.strokeRect(10, 10, w - 20, h - 20);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach(([text, px], i) => {
    const y = h * (i + 1) / (n + 1);
    x.font = `bold ${px}px Georgia, 'Times New Roman', serif`;
    if (text === '*') { star2d(x, w / 2, y, px * 0.55); return; }
    x.fillStyle = '#ffffff'; x.fillText(text, w / 2 + 1, y + 1.5);
    x.fillStyle = '#262422'; x.fillText(text, w / 2, y);
  });
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  return (tint === 'gold' ? goldMat : silverMat)({ map: t, roughness: 0.28 });
}
function star2d(x, cx, cy, r) {
  const path = off => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, rr = i % 2 ? r * 0.42 : r; x[i ? 'lineTo' : 'moveTo'](cx + off + Math.sin(a) * rr, cy + off - Math.cos(a) * rr); } x.closePath(); };
  path(1.2); x.fillStyle = '#ffffff'; x.fill(); path(0); x.fillStyle = '#262422'; x.fill();
}
