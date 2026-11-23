// Where a head-locked panel can go in your view without covering anything else that is on screen. Pure (unit
// tested): everything is in degrees as seen from your eyes, yaw to the right and elevation up from the middle of
// the view. Used by the celebration prompt (game/celebration.js), which must never sit on the GOAL / HAT TRICK
// banner, the commentator's subtitle or the scoreboard bug.
// rects: what is showing, each { y0, y1 (yaw, left to right), e0, e1 (elevation, bottom to top) }.
// w, h: the panel's size. o: top (its top edge when nothing is in the way), gap (kept clear round things),
// low (the lowest its bottom edge may go: the edge of what you can see), side (the furthest out its far edge may go).
// Returns { yaw (its middle), top, ok }: straight ahead and as high as it can be under whatever is in the way;
// if that would take it off the bottom of the view, out to the right of everything instead, and failing that to
// the left; ok is false only if nothing fits (the caller hides it).
export function slot(rects, w, h, { top = -3, gap = 1.5, low = -44, side = 50 } = {}) {
  const hits = (yaw, t, r) => r.y1 + gap > yaw - w / 2 && r.y0 - gap < yaw + w / 2 && r.e1 + gap > t - h && r.e0 - gap < t;
  // under everything that is over the middle
  let t = top;
  for (let n = 0; n < 8; n++) { const was = t; for (const r of rects) if (hits(0, t, r)) t = Math.min(t, r.e0 - gap); if (t === was) break; }
  if (t - h >= low) return { yaw: 0, top: t, ok: true };
  // beside everything, at its usual height: right, then left
  for (const sd of [1, -1]) {
    let yaw = 0;
    for (let n = 0; n < 8; n++) { const was = yaw; for (const r of rects) if (hits(yaw, top, r)) yaw = sd > 0 ? Math.max(yaw, r.y1 + gap + w / 2) : Math.min(yaw, r.y0 - gap - w / 2); if (yaw === was) break; }
    if (Math.abs(yaw) + w / 2 <= side) return { yaw, top, ok: true };
  }
  return { yaw: 0, top, ok: false };
}

// Do two rects (as above) overlap?
export const overlap = (a, b) => a.y1 > b.y0 && a.y0 < b.y1 && a.e1 > b.e0 && a.e0 < b.e1;
