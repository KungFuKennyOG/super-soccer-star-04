# Branch `heads3` (23 Nov): every player's own skull; a far LOD (not built, with numbers)

## Skulls (`game/ps2/skull.js`)
Every '04 player shared one skull (`headgeo.js`); only the paint differed. Now each look gets its own shape.

- **How:** `skullGeometry(geo, skull)` copies the built figure (index, uvs, skin weights and baked shade
  shared; its own positions and normals) and warps the head's vertices in the head's own (phi, t) frame.
  The scalp, the hair shell standing off it, the flick cards and the ponytail sit at the same (phi, t), so they
  move together and the hair still ends inside the painted hairline; uvs are untouched, so `face.js`'s paint
  lands where it did; the warp is weighted by the head bone and fades out down the neck (nothing under
  y 1.56 m moves, tested), so the neck joins as before. Each ear is carried with the skin at its root as one
  piece and sized about it (`headgeo.js` now records the ears' vertex ranges; `build.js` passes them on).
  Normals are recomputed with the same seam smoothing the builder uses (`smoothNormals`, moved out of
  `Builder.geometry`).
- **What varies** (`skullOf(seed, nose)`; seed = the look's `face` number, so replays and the turntable agree):
  head length +-4.5% (face forward, back of the head back), cranium breadth +-5%, occiput flat or round
  +-8%, forehead slope +-6 mm at the hairline, brow +-1.5 mm (kept gentle: a broad ledge shades as a dark band),
  cheekbones +-4.5 mm, jaw breadth +-14%, chin forward +-6 mm, face length +-10 mm (the chin lower), nose
  protrusion +-28% (plus rules/looks.js's painted nose width, so broad noses stand off a little more), bridge
  +-2 mm, ears +-9%. Each is a triangular spread, so most men sit near the middle; the ends are about +-2.5 SD
  of adult male anthropometry (head length 197 mm SD 7, breadth 152 SD 6, bigonial 107 SD 7, face height SD
  about 6 mm, ear length 63 SD 4). At +-2 SD from the front a line-up still read as one head; this is the most
  that stays inside real men.
- **Cost:** about 5 ms per player at build (headless), cached per figure and shape. No extra draws or
  triangles. Each distinct player holds his own positions and normals: about 90 KB.
- `buildPlayer2(..., { skull })`: default his own; `null` is the shared skull (the first-person boots use it,
  unchanged). The photographers (`press.js`) use `figureGeometry` directly and keep the shared skull.
- Tests (`tests/unit/skull.test.js`): the neutral skull changes nothing; only the head moves, by 2 mm to
  2.5 cm, nothing below the neck's base; hair standing off the scalp stays at least 75% of its lift off it
  for 41 shapes including every setting at its extreme at once; each ear moves as one piece.
- Look: `tools/headlook.html` (12 men from 12 teams in cells; `?view=front|34|side|back`, `&skull=0` for
  before, `&big=1`, `&styles=1` every hairstyle in turn, `&team=`), rendered by `node tools/headshots.mjs out
  name?query ...`.

### Short
- Shape only, not paint: eyes, mouth and brows still sit at the same (phi, t), so a longer face carries the same
  features spaced the same way down it (the chin and jaw move, the eyes don't).
- Not looked at in a headset. From 10 m and beyond the shape is what reads (jaw, face length, head breadth);
  the nose and brow only up close.
- Seen while checking, not mine and not changed: a pale band of skin at the nape under the hair on dark-skinned
  players (in `face.js`'s nape paint, there before this branch), and a dark line behind the ear lobe in profile.

## A far LOD: not built
Measured in the real game (headless, a World Cup match at the national stadium and a Champions Cup one at
Barcelona, four moments from kick-off on): 6 players drawn (you are first person), each 5,900 to 6,400
triangles plus his projected shadow (the same mesh again), so players are about 75k of the frame's 130 to
135k triangles. Distances from you: 6 to 17 m for everyone but the keeper, who is at 29.7 m. So beyond 20-25 m
there is usually one player: the keeper.

- Triangles saved by a 1.8k-triangle LOD beyond 22 m: (6,100 - 1,800) x 2 (body and shadow) = about 8.6k a
  frame, 6% of the frame's triangles, at most two players' worth on a half pitch.
- What the GPU would save: the frame is about 135k triangles per eye, about 19.5 million a second at 72 Hz in
  both eyes, a small share of what the Quest 3's GPU draws; it is fill-bound (full resolution, 4x MSAA, the
  crowd's alpha-tested cards), not triangle-bound. At 25 m a player is about 95 px tall at the Quest 3's ~23 px
  per degree, ~1,500 px of screen; his ~3,000 front triangles cost maybe 12k fragment invocations through
  overshading. A frame is about 4.5 million pixels per eye. The keeper's LOD would save well under 1% of the
  frame's fragment work.
- CPU: skinning matrices are per bone, so an LOD saves nothing there.
- So: not worth the swap logic and the risk of a visible pop. The real fps knobs are fill: `VR_SCALE` (0.85),
  MSAA, the crowd's card size (`LEGS` in `fanmat.js`). One place a cheap body could matter: the goal replay draws
  every player again into a 256 x 144 target every third frame in the headset, where each is a few pixels tall;
  if replays cost frames on the Quest, that's where to put one.

## Headset check
1. Kick off any match and look at the three defenders and your two teammates as they come close: they should read
   as different men by the shape of the jaw, face length and head breadth, not one head repainted.
2. Turn on BIG HEADS (settings): heads still sit right on the necks, hair on the scalps.
3. Team select: the turntable player looks normal.
4. Nothing should change in fps (no new draws or triangles).
