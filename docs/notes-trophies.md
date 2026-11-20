# Notes: the '04-look trophies (branch `trophies`)

Two original cups to replace the deliberately-PS1 ones in `game/trophy.js`. Built and looked at on the test
page; **not wired into the ceremony** (`game/trophy.js` and `game/main.js` are untouched).

## What exists

| File | What |
| --- | --- |
| `game/ps2/trophygeo.js` | The shapes (pure three, no DOM): `worldParts(variant)`, `clubParts(variant)`, hand-holds `GRIPS2`, hold thickness `HOLD_D` |
| `game/ps2/metal.js` | Geometry helpers (`revolve` with hard edges and per-angle radius, `tube`, faceted `starGeo`, `merge`), the painted stadium the metal reflects, gold / silver / black lacquer / malachite / engraved-plate materials |
| `game/ps2/trophies.js` | `buildTrophy2(kind)` ('world' / 'club') and `buildPlinth2()` (the ceremony pedestal, top at `REST_Y` 1.02 m) |
| `tools/trophylook.js` | The look-page shots (listed at its top), loaded by `tools/ps2look.html` |
| `tests/unit/trophies.test.js` | Triangle budget, heights, grip thickness and roundness, finger room behind the bars, every hold inside 3.2 to 6.6 cm |

Interface, matching `trophy.js`: `buildTrophy2(kind)` returns a Group with the cup's front toward -z (the way
the PS1 cups face you on the plinth). `userData = { kind, grips, holds, holdD, height, width, tris, calls }`;
`grips[0]` is on +x for your left hand, `grips[1]` on -x for your right, in trophy-local metres, exactly
what `GRIPS[kind]` is in trophy.js. To swap in: `buildTrophy(kind)` → `buildTrophy2(kind)`,
`GRIPS[kind]` → `trophy.userData.grips`, the plinth + cloth meshes → `buildPlinth2()` (same 1.0 m pedestal,
cloth on top). The hand-hold quaternion `HOLD` in trophy.js stays right: both cups are held round a
vertical axis as before.

## The designs

### The Star Cup (nations), solid gold, 0.55 m

An octagonal gold foot, a band of polished green stone (malachite banding painted in code) with an
engraved gold plate set into its front facet ("WORLD CHAMPIONS" and a star), a faceted octagonal taper,
a round waisted grip, then a shallow calyx from which five broad tongues of flame rise, swell and flick
outward at the tips, with five short ones between them. They cradle a large faceted five-pointed star
(each point two facets meeting in a ridge) standing upright, facing you. The star ties it to the game's
name (Super Soccer STAR) and its invented shield-with-a-star badge.

How it differs from real cups: there are no figures, no spiral, no globe or ball at all (the real World Cup
trophy is two figures spiralling up to hold a globe; ours is a symmetric crown of flames holding a star).
The only shared idea is the one Kenny liked and we agreed to keep: solid gold with a green stone band at
the base. Not a Jules Rimet (no winged figure, no cup on top, no lapis base), not a Ballon d'Or-type ball.

### The Champions Cup (clubs), polished silver on black, 0.645 m

A square stepped plinth in black lacquer with a thin silver band and an engraved silver plate ("CHAMPIONS
CUP", "* SUPER SOCCER STAR *"). A silver foot and knop, then an amphora: sixteen sharp-ridged flutes
(gadroons) round the lower body, a raised band at the shoulder studded with eight small stars, a narrow
neck, a rolled rim, a stepped lid and a star finial on a short post. Two slim straight-sided bracket
handles: a straight strut out from the body, a vertical fluted bar you hold, a strut back in to the neck,
a small spike on the top corner.

How it differs from real cups: the big rounded "ear" handles of the Champions League cup are what make it
recognisable; ours are short, angular, straight-barred brackets well inside the cup's silhouette, and the
body is a lidded fluted urn, not a tall open vase. Things I checked it against so it isn't mistaken for
them: the FA Cup (lidded too, but a plain goblet with curved handles and a figure on the lid; ours is
fluted, angular-handled and star-topped), the Copa Libertadores (a figure on top, wooden base covered in
plaques), the Henri Delaunay (an open silver vase with no real handles), the Copa America. The lid is the
nearest thing to a shared feature with the FA Cup; if Kenny feels it reads that way, the 'tulip' sketch
(open rim) is the fallback.

### Sketches and the choice

`?shot=worldsketch` and `?shot=clubsketch` show three each side by side (chosen one in the middle).

- Nations: **spire** (a faceted obelisk with a small star on top: clean but dull, reads as an award
  pillar), **flame** (chosen: the richest silhouette, holds up close, and the star reads from across the
  pitch), **wreath** (a ring of laurel round a star on a stem: iconic but reads as a medal on a stick, and
  a laurel ring is close to many real awards).
- Clubs: **tulip** (an open tall vase with full-height bracket handles: the most like the real Champions
  League cup in proportion, so out), **amphora** (chosen: the most clearly its own, and the flutes and
  shoulder stars give it detail at 30 cm), **hex** (the same urn faceted in six: reads as low-poly PS1,
  wrong for the '04 look).

## Sizes and the hands

- Nations: 0.55 m tall, 0.19 m across the base. Hand-holds unchanged from trophy.js: (±0.07, 0.24, 0),
  hands either side of a round grip **6.6 cm across** (the PS1 cup's column there is the same).
- Clubs: 0.645 m tall to the finial star's tip, 0.41 m across the handles. Each fist closes round a
  round vertical bar **3.2 cm across** (trophy.js's ear boxes were 3 cm; 3.2 is the thinnest the new hands'
  'hold' pose is tested on), centred on the hand-hold.
  **Changed:** the hand-holds are at **(±0.19, 0.37, 0)**, 38 cm apart, where trophy.js has (±0.25, 0.39, 0),
  50 cm apart round its big ears. Keeping 0.25 meant brackets sticking 12 cm out from the body (they read as
  a frame, not handles); at 0.19 there are 4.1 cm between the bar and the body for the fingers (tested).
  Anything that reads the holds should take them from `userData.holds` / `userData.grips`, not trophy.js's GRIPS.

### Hand-holds for the new hands (`buildHand(side, 'hold', kit, skin, { d, at })`)

`HOLDS` in `trophygeo.js`, also `userData.holds` on each built cup: per hold `{ at, axis, d }`, trophy-local
metres, index 0 for your left hand (+x), 1 for your right (-x). Both axes vertical, both sections round.

| Cup | Hand | at (x, y, z) | axis | d |
| --- | --- | --- | --- | --- |
| Star Cup (world) | left | (0.07, 0.24, 0) | (0, 1, 0) | 0.066 m |
| Star Cup (world) | right | (-0.07, 0.24, 0) | (0, 1, 0) | 0.066 m |
| Champions Cup (club) | left | (0.19, 0.37, 0) | (0, 1, 0) | 0.032 m |
| Champions Cup (club) | right | (-0.19, 0.37, 0) | (0, 1, 0) | 0.032 m |

On the Star Cup both hands close on the same 6.6 cm round grip from either side (the hold point is the
middle of each fist, 7 cm off the axis, as in trophy.js), so the two fists sit side by side round one
column; the collars above and below are 5.3 and 8 cm from the middle of the fist. Whether two hands on a
6.6 cm column look right, or one wants to be above the other, is a headset call; the grip is 9 cm tall
between collars, room for one fist height, not two stacked. `at` in grip space for the hand is the swap-in's
job (the hold point is where trophy.js puts the hand's origin today).

## Numbers

- Triangles: Star Cup 5,168 (gold 5,140, stone 16, plate 12); Champions Cup 6,428 (silver 6,360,
  black plinth 56, plate 12). Pedestal 320 more.
- Draw calls: 3 per cup (metal, stone or black plinth, plate), plus 2 for the pedestal (column, cloth).
- Materials: MeshStandardMaterial, metalness 1 on the metals. The reflections are a 512 x 256 float
  equirect painted in code (`stadiumEnv` in `metal.js`: sky with clouds, a dark roof edge, crowd speckle,
  ad boards, a dark pitch, four floodlight banks and four more lamps pushed to 4 to 9x white, a lit roof
  underside), shared by all the trophy materials; three converts it to a PMREM once, on first use. No
  network, no post-processing. Gold: colour #ffc25a, roughness 0.24, a faint amber emissive so the dark
  reflections turn deep amber, not black. Silver: #f4f6fa, roughness 0.09. Textures: malachite 512 x 64,
  plates 192 x 128 and 384 x 108, painted once and cached.
- Build time, headless Chrome (software GL): both cups and the pedestal well under the page's 2 to 3 s
  build (which is mostly the six players). Not measured on a Quest.

## Look-page shots

`tools/ps2look.html?shot=` `worldwide`, `clubwide` (on the pedestal on the pitch, turned to the main
stand), `worldheld`, `clubheld` (35 cm from your eyes, held at chest height), `worldside`, `clubside`,
`worldabove`, `clubabove`, `worldbelow`, `clubbelow` (lifted over your head, looking up), `pair`,
`worldspin`, `clubspin` (turntable: `FILM=6 node tools/ps2shots.mjs out worldspin`), `worldsketch`,
`clubsketch`. `&grips=1` draws the hand-holds as red wire balls the thickness of what the hand closes on.

## Short of real / not checked

- Nothing seen in a headset. In particular: whether the gold reads as gold (not orange) through the Quest's
  display, whether the silver's dark lower half looks like reflection or dirt, and the frame cost of a
  full-screen metal object with an env map at 30 cm (two of the materials are per-pixel PBR with PMREM
  lookups; at framebuffer scale 0.7 I expect it to be fine, but it's unmeasured).
- The reflections are of a painted generic stadium, not the real ground around you (no live cube camera:
  too costly on a Quest). They don't move with the club's ground or time of day; a night ground would want
  a darker env.
- The flame tongues are the same five, symmetric; no chased or engraved surface detail on them (a ridge
  only). The column's lines are reflections, not grooves.
- The engraved plates are canvas text (serif) on a box; their thin edges show the texture squashed.
- The finial star and the shoulder stars are flat-faceted (deliberately, to sparkle); everything else is
  smooth-shaded.
- Not wired into the ceremony; the hand-hold change for the clubs' cup needs trophy.js to take holds from
  `userData.grips` when it is.
