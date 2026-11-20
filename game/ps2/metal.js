// Geometry helpers the '04-look trophies are built with (pure three, no DOM: unit tested in Node):
// smooth turned profiles, a lathe (hard edges only where the profile says, optional uvs), a band with
// uvs (stone, engraving, plaques), a grid of rings (lofts that aren't round), a tube along a curve, a
// faceted star, and a merge so each material is one draw call. Metal has no texture to hide in, so every
// part can carry a painted shade (userData.ao: a number, one per vertex, or f(x, y, z)) that merge bakes into vertex
// colours: the inside of a bowl and the creases reflect darker, as they do on the real thing.
// Profiles are [[r, y, hard?], ...], drawn anticlockwise in the (r, y) half-plane (out along the bottom,
// up the outside, in over the top, down the inside of a bowl) so faces look outward. Angle a = 0 is the
// trophy's front (-z); x = sin a.
import * as THREE from 'three';

const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
// A smooth curve through the keys (Catmull-Rom, `per` steps a span); a hard key is a corner: the curve
// stops and starts again there. Works on [r, y] profiles and on [x, y] paths alike.
export function smooth(keys, per = 5) {
  const out = [], runs = [];
  let run = [keys[0]];
  for (let i = 1; i < keys.length; i++) { run.push(keys[i]); if (keys[i][2] && i < keys.length - 1) { runs.push(run); run = [keys[i]]; } }
  runs.push(run);
  for (const r of runs) {
    const n = r.length, pts = [];
    if (n === 2) pts.push([r[0][0], r[0][1]], [r[1][0], r[1][1]]);
    else for (let i = 0; i < n - 1; i++) {
      const a = r[Math.max(0, i - 1)], b = r[i], c = r[i + 1], d = r[Math.min(n - 1, i + 2)];
      for (let k = 0; k < per; k++) pts.push([cr(a[0], b[0], c[0], d[0], k / per), cr(a[1], b[1], c[1], d[1], k / per)]);
      if (i === n - 2) pts.push([c[0], c[1]]);
    }
    pts.forEach((p, i) => {
      const hard = (i === 0 && r[0][2]) || (i === pts.length - 1 && r[n - 1][2]);
      if (i === 0 && out.length) { out[out.length - 1][2] = 1; return; }
      out.push([Math.max(0, p[0]), p[1], hard ? 1 : 0]);
    });
  }
  return out;
}
// The keys as a function: value at x (Catmull-Rom over evenly treated keys [[x, v], ...], clamped at the ends).
export function curveFn(keys) {
  return x => {
    const n = keys.length;
    if (x <= keys[0][0]) return keys[0][1];
    if (x >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0; while (keys[i + 1][0] < x) i++;
    const a = keys[Math.max(0, i - 1)], b = keys[i], c = keys[i + 1], d = keys[Math.min(n - 1, i + 2)], h = c[0] - b[0];
    const m0 = i === 0 ? (c[1] - b[1]) / h : (c[1] - a[1]) / (c[0] - a[0]), m1 = i + 2 > n - 1 ? (c[1] - b[1]) / h : (d[1] - b[1]) / (d[0] - b[0]);
    const t = (x - b[0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * b[1] + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * c[1] + (t3 - t2) * h * m1;
  };
}

// Revolve a profile round the y axis in seg steps. mod(a, y, k) scales the radius at angle a. A hard
// point is a crease (its ring is doubled). flat: facets. uv: a seam at the back and uvs (u round, v up
// the profile by length), for stone.
export function revolve(profile, seg, { mod, flat = false, a0 = 0, uv = false, ao } = {}) {
  const pos = [], idx = [], rings = [], uvs = [], cols = uv ? seg + 1 : seg;
  let len = 0; const L = profile.map((p, k) => (k ? (len += Math.hypot(p[0] - profile[k - 1][0], p[1] - profile[k - 1][1])) : 0));
  profile.forEach(([r, y, hard], k) => {
    const n = hard && k > 0 && k < profile.length - 1 ? 2 : 1;
    for (let d = 0; d < n; d++) {
      const start = pos.length / 3;
      for (let i = 0; i < cols; i++) {
        const a = a0 + (i / seg) * Math.PI * 2 + (uv ? Math.PI : 0), rr = r * (mod ? mod(a, y, k) : 1);
        pos.push(Math.sin(a) * rr, y, -Math.cos(a) * rr);
        if (uv) uvs.push(i / seg, L[k] / len);
      }
      rings.push({ start, dup: d === 0 && n === 2 });
    }
  });
  for (let k = 0; k < rings.length - 1; k++) {
    if (rings[k].dup) continue;                                  // the doubled ring: no face between the pair
    const a = rings[k].start, b = rings[k + 1].start;
    for (let i = 0; i < (uv ? seg : cols); i++) {
      const j = uv ? i + 1 : (i + 1) % seg;
      idx.push(a + i, b + i, a + j, a + j, b + i, b + j);
    }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (flat) g = g.toNonIndexed();
  g.computeVertexNormals();
  if (uv && !flat) { const nm = g.attributes.normal; for (const r of rings) for (let c = 0; c < 3; c++) { const v = (nm.array[r.start * 3 + c] + nm.array[(r.start + seg) * 3 + c]) / 2; nm.array[r.start * 3 + c] = nm.array[(r.start + seg) * 3 + c] = v; } }
  if (ao !== undefined) g.userData.ao = ao;
  return g;
}

// A strip of a turned surface with uvs: the profile [[r, y], ...] swept from angle a0 to a1 in seg
// steps, u from u0 to u1 round it and v from v0 (first point) to v1. Normals are the lathe's own.
export function band(profile, seg, { a0 = -Math.PI, a1 = Math.PI, u0 = 0, u1 = 1, v0 = 0, v1 = 1 } = {}) {
  const pos = [], nor = [], uv = [], idx = [], n = profile.length;
  let len = 0; const L = profile.map((p, k) => (k ? (len += Math.hypot(p[0] - profile[k - 1][0], p[1] - profile[k - 1][1])) : 0));
  for (let k = 0; k < n; k++) {
    const p = profile[k], q0 = profile[Math.max(0, k - 1)], q1 = profile[Math.min(n - 1, k + 1)], dr = q1[0] - q0[0], dy = q1[1] - q0[1], l = Math.hypot(dr, dy) || 1;
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (a1 - a0) * i / seg, s = Math.sin(a), c = Math.cos(a);
      pos.push(s * p[0], p[1], -c * p[0]); nor.push(s * dy / l, -dr / l, -c * dy / l);
      uv.push(u0 + (u1 - u0) * i / seg, v0 + (v1 - v0) * L[k] / len);
    }
  }
  for (let k = 0; k < n - 1; k++) for (let i = 0; i < seg; i++) { const a = k * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

// Rings of points [[x, y, z] x seg] x rows, closed round, bottom ring first: a loft that needn't be round.
export function grid(rings, { ao } = {}) {
  const pos = [], idx = [], seg = rings[0].length;
  for (const r of rings) for (const p of r) pos.push(p[0], p[1], p[2]);
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < seg; i++) {
    const a = k * seg, b = a + seg, j = (i + 1) % seg;
    idx.push(a + i, b + i, a + j, a + j, b + i, b + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (ao !== undefined) g.userData.ao = ao;
  return g;
}

// A tube of `sides` round a line [[x, y, z], ...]; r: its radius, r(t) along it (t 0..1 by length) or
// one per point; squash: the section is that much narrower across `up` (an oval bar or a ribbon).
export function tube(pts, r, sides = 10, { squash = 1, up = [0, 0, 1], caps = true, ao } = {}) {
  const P = pts.map(p => new THREE.Vector3(...p)), n = P.length, pos = [], idx = [];
  const U = new THREE.Vector3(...up), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  let len = 0; const L = [0]; for (let i = 1; i < n; i++) L.push(len += P[i].distanceTo(P[i - 1]));
  for (let i = 0; i < n; i++) {
    T.subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
    N.copy(typeof up === 'function' ? U.set(...up(i / (n - 1))) : U).sub(T.clone().multiplyScalar(U.dot(T))).normalize(); B.crossVectors(T, N);
    const rr = typeof r === 'function' ? r(L[i] / len) : Array.isArray(r) ? r[i] : r;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2, c = Math.cos(a) * rr, d = Math.sin(a) * rr * squash;
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
  if (ao !== undefined) g.userData.ao = ao;
  return g;
}

// A five-pointed star standing in the xy plane, facing -z: every point is two facets meeting in a
// ridge, rising from the rim (half-thickness edge) to the middle (half-thickness depth). Flat shaded:
// real edges, so each facet takes its own piece of the sky.
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

export const place = (g, x, y, z, ry = 0, rx = 0) => { g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); return g; };

// Many geometries into one: position, normal, a colour (each part's painted shade, white if it has
// none) and uv when all of them have it. Indexed.
export function merge(list) {
  const out = new THREE.BufferGeometry(), pos = [], nor = [], uv = [], col = [], idx = [];
  const withUv = list.every(g => g.attributes.uv);
  let base = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, ao = g.userData.ao;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = typeof ao === 'function' ? ao(x, y, z) : ao === undefined ? 1 : ao.length ? ao[i] : ao;
      pos.push(x, y, z); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(k, k, k);
      if (withUv) uv.push(g.attributes.uv.getX(i), g.attributes.uv.getY(i));
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) idx.push(base + i);
    base += p.count;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (withUv) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
export const tris = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
