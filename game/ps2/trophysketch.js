// The sketches that lost (tools/ps2look.html?shot=worldsketch | clubsketch draws them as black shapes
// beside the chosen ones). Rough on purpose: only the silhouette matters here.
//   world: 'wings' (two wings and the star between: it read as a crescent and star), 'comet' (a ribbon winding up a spire to a star)
//   club:  'tulip' (an open flaring vase, small loops low down), 'amphora' (a shouldered jar and neck)
import { revolve, tube, starGeo, smooth, curveFn, place } from './metal.js';
import { worldFoot, clubFoot, flameBody, handle, FLAME } from './trophygeo.js';

export function worldSketch(v) {
  const { metal, stone, engraved } = worldFoot();
  if (v === 'wings') {
    const R = curveFn([[0.192, 0.031], [0.245, 0.03], [0.275, 0.0305], [0.3, 0.036], [0.325, 0.047], [0.355, 0.063], [0.39, 0.078], [0.43, 0.088], [0.47, 0.09], [0.51, 0.086], [0.545, 0.082], [0.575, 0.083], [0.6, 0.09]]);
    metal.push(flameBody({ peaks: 2, R, o: { ...FLAME, turn: 0, twist: 0.5, tip: 0.6, tip2: 0.548, front: 0.392, back: 0.452, sharp: 2.1 } }));
    metal.push(place(starGeo(0.064, 0.026, 0.02, 0.0045), 0, 0.462, 0));
  } else {
    metal.push(revolve(smooth([[0.031, 0.192], [0.03, 0.245], [0.03, 0.28], [0.022, 0.38], [0.012, 0.47], [0.004, 0.52], [0, 0.522]]), 24));
    const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * Math.PI * 2.6, r = 0.036 + 0.05 * Math.sin(t * Math.PI) ** 0.8 * (1 - 0.35 * t); pts.push([Math.sin(a) * r, 0.2 + 0.31 * t, -Math.cos(a) * r]); }
    metal.push(tube(pts, t => 0.004 + 0.022 * Math.sin(t * Math.PI) ** 0.6, 8, { squash: 0.22, up: [0, 1, 0] }));
    metal.push(place(starGeo(0.05, 0.02, 0.017, 0.004), 0, 0.56, 0));
  }
  return { metal, stone, engraved };
}
export function clubSketch(v) {
  const { metal, stone, engraved } = clubFoot();
  if (v === 'tulip') {
    metal.push(revolve(smooth([[0.02, 0.2365], [0.04, 0.26], [0.062, 0.31], [0.074, 0.38], [0.082, 0.46], [0.094, 0.54], [0.118, 0.61], [0.135, 0.65, 1], [0.128, 0.65, 1], [0.09, 0.54], [0, 0.4]]), 40));
    for (const s of [1, -1]) metal.push(handle(s, [[0.05, 0.28], [0.1, 0.285], [0.135, 0.31], [0.142, 0.35], [0.142, 0.4], [0.128, 0.44], [0.1, 0.46], [0.075, 0.455]], 0.012));
  } else {
    metal.push(revolve(smooth([[0.02, 0.2365], [0.06, 0.26], [0.105, 0.31], [0.125, 0.37], [0.118, 0.43], [0.085, 0.475], [0.055, 0.5], [0.048, 0.54], [0.06, 0.575], [0.07, 0.585, 1], [0.064, 0.595], [0.03, 0.615], [0.01, 0.625], [0.014, 0.64], [0, 0.655]]), 40));
    for (const s of [1, -1]) metal.push(handle(s, [[0.1, 0.45], [0.13, 0.475], [0.14, 0.52], [0.125, 0.56], [0.09, 0.572], [0.055, 0.565]], 0.011));
  }
  return { metal, stone, engraved };
}
