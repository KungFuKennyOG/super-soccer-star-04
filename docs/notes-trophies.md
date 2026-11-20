# Notes: the '04-look trophies (branch `trophies`)

Second design. Kenny on the first pair (a crown of flame tongues with a star; a fluted urn with bracket
handles on a black box, on a red drum): "they look cheap". Both were thrown away and redrawn, with new
metal, bases and plinth. Built and looked at on the test page; **not wired into the ceremony**
(`game/trophy.js` and `game/main.js` are untouched). Nothing seen in a headset.

## What exists

| File | What |
| --- | --- |
| `game/ps2/trophygeo.js` | The shapes (pure three, no DOM): `worldParts()`, `clubParts()`, hand-holds `GRIPS2` / `HOLDS`, thickness `HOLD_D` |
| `game/ps2/trophysketch.js` | The silhouettes that lost (`worldSketch('wings' \| 'comet')`, `clubSketch('tulip' \| 'amphora')`) |
| `game/ps2/metal.js` | Geometry helpers, no DOM: `smooth` (curves through profile keys, corners kept), `curveFn`, `revolve` (lathe, optional uvs), `band` (a strip with uvs), `grid` (a loft that isn't round), `tube`, `starGeo`, `merge` (bakes each part's painted shade into vertex colours) |
| `game/ps2/trophymat.js` | The painted stadium the metal reflects, gold, silver, malachite, black marble, the engraved sheet (plaque + laurel band), lacquer and velvet for the plinth |
| `game/ps2/trophyuv.js` | Where the plaque and the laurel band sit on the engraved sheet |
| `game/ps2/trophies.js` | `buildTrophy2(kind)` ('world' / 'club') and `buildPlinth2()` (top at `REST_Y` 1.02 m) |
| `tools/trophylook.js` | The look-page shots, loaded by `tools/ps2look.html` |
| `tests/unit/trophies.test.js` | Budget, heights, the hand-holds (where, thickness, roundness, finger room), sketches build, helpers |

Interface unchanged: `buildTrophy2(kind)` returns a Group, front toward -z;
`userData = { kind, grips, holds, holdD, height, width, tris, calls }`; `grips[0]` is on +x for your left
hand. To swap in: `buildTrophy(kind)` → `buildTrophy2(kind)`, `GRIPS[kind]` → `trophy.userData.grips`,
the plinth + cloth meshes → `buildPlinth2()`. `HOLD` in trophy.js stays right (both holds are round a
vertical axis). Mesh names changed: `metal`, `stone`, `engraved` (was metal / stone or dark / plate).

## The designs

### The Star Cup (nations): gold, 0.63 m, 0.20 m across the base

One body from collar to tip. A slim gold ring under a band of malachite (5.7 cm, a curved engraved
plaque let into its front: WORLD ★ CHAMPIONS), a gold moulding with an engraved laurel band, a long hollow
trumpet foot to a single bead collar, a slender round waist (6 cm, where the hands go), and then the body
opens in one S-curve and is cut into two tongues of flame of unequal height: a tall one (to 0.63 m)
behind and a short one in front, the rim dropping low at the sides, the whole thing turned about 60°
round the axis as it rises, a soft ridge running up each tongue to its tip. A faceted five-pointed star
is set against the inside of the tall tongue, facing you. Big calm polished surfaces; the only fine
detail is at the base.

Not a real cup: no figures, no globe or ball, no spiral of bodies (the World Cup trophy), no winged
figure holding a bowl (Jules Rimet), no ball (Ballon d'Or), no ribbon winding round a ball (Women's World
Cup). What it keeps is only what Kenny liked and we agreed: solid gold over a band of green stone. One
band, not two.

### The Champions Cup (clubs): silver, 0.72 m, 0.45 m across the arms

A drum of black marble (thin pale veins) on a step, a slim silver band, a curved engraved plaque
(CHAMPIONS CUP ★ SUPER SOCCER STAR). A spreading foot, a slender stem with one knop, a deep bell of a bowl
(an S from calyx to lip, 21.6 cm across the belly) with an engraved laurel-and-star band between two
reeds at its waist, a low domed cover, a small baluster finial and a faceted star. The handles are the
arms of a lyre: each grows out of the belly, sweeps out and up, stands upright through the hand-hold,
and thins as it rises past the lip into a small scroll turned outward with a bead on its end. They
never come back to the bowl.

Not a real cup: the Champions League cup is a lidless vase with two huge closed loops from rim to body
and no stem; this is covered, stemmed, on stone, and its handles are open arms, not loops. The FA Cup
and the Webb Ellis are covered cups with closed scroll handles and are squatter; the Henri Delaunay has
no stem and tiny handles; the Libertadores has a figure on top. A covered two-handled cup is the generic
form of hundreds of trophies; the open lyre arms are what make this one its own.

### Sketches and the choice (`?shot=worldsketch`, `clubsketch`: black on white, chosen in the middle)

- Nations: **wings** (the body cut into two wings left and right with the star between: built first, and
  from the front it is a crescent with a star in it, which is a religious and national emblem: out),
  **flame** (chosen: a flame is the same shape from nowhere else, it has one tip you'd know as a shadow,
  and the star sits against polished gold instead of sky), **comet** (a ribbon winding up a spire to a
  star: thin, busy, and a ribbon spiralling up to a thing on top is the nearest of the three to real
  trophies). A single tongue (one scoop with the star in it) was also built: it read as a shell niche.
- Clubs: **tulip** (an open flaring vase with loop handles: the Champions League cup's proportions,
  out), **lyre** (chosen), **amphora** (a shouldered jar with small neck handles: dumpy, and the Henri
  Delaunay's family). Before the lyre arms the chosen bowl had closed handles, twice: a tall loop from
  lip to calyx (big ears) and a squared loop from lip to belly (a jug's handle; kept as `LOOP`).

## Sizes and the hands

`HOLDS` in `trophygeo.js`, also `userData.holds`: per hold `{ at, axis, d }`, trophy-local metres, index 0
your left hand (+x). Both axes vertical, both sections round.

| Cup | Hand | at (x, y, z) | axis | d |
| --- | --- | --- | --- | --- |
| Star Cup (world) | left | (0.07, 0.245, 0) | (0, 1, 0) | 0.060 m |
| Star Cup (world) | right | (-0.07, 0.245, 0) | (0, 1, 0) | 0.060 m |
| Champions Cup (club) | left | (0.168, 0.47, 0) | (0, 1, 0) | 0.032 m |
| Champions Cup (club) | right | (-0.168, 0.47, 0) | (0, 1, 0) | 0.032 m |

**Changed from the first design:** the Star Cup's waist is 6.0 cm (was 6.6) and the hold is 5 mm higher;
the Champions Cup's holds are at (±0.168, 0.47) (were ±0.175, 0.37). Read them from `userData`.

- Star Cup: a fist either side of the waist, as in trophy.js (the hold point is the middle of the fist,
  7 cm off the axis). The waist is round and within 1.5 mm of 6 cm for 6 cm of height and swells under
  6 mm over the 9 cm a fist covers (tested); the collar is 5.5 cm below the hold, the body opens above.
- Champions Cup: each fist round the upright run of an arm, 3.2 cm round (the thinnest the hands are
  tested on) for about 9 cm, 5.3 cm or more clear of the bowl (tested: 4 cm or more). The arm is thinner
  everywhere else (down to 1.1 cm at the scroll), so a hand placed much higher or lower than the hold
  would not be closed on it.

## Numbers

- Triangles: Star Cup **5,132** (gold 4,952, malachite 80, engraved 100); Champions Cup **6,724** (silver
  6,080, marble 480, engraved 164): over the "about 6,000" asked for, spent on the bowl (36 round) and
  the arms; a player is about 6,400. Plinth 2,300 (the folds of the cloth are 112 round; could be halved).
- Draw calls: 3 per cup (polished metal, stone, engraved metal), 3 for the plinth (lacquer, gold, velvet).
- Materials: MeshStandardMaterial, metalness 1 on the metals, vertex colours as a painted shade (the
  inside of the flame, the underside). Gold has four lines added to its shader (`onBeforeCompile`): where
  what it reflects is dark it goes deeper and redder, so shadows are umber instead of khaki. Gold
  `#ffcf7a` roughness 0.10; silver `#f7f8fb` roughness 0.055.
- Reflections: a 1024 x 512 half-float equirect painted in code as lit values (`stadiumAt` in
  `trophymat.js`: a sky that pales to the roofs, cloud, the sun at 26x white behind it, black stands with
  a lit roof edge and one line of ad boards, four floodlight banks at 20x, a pitch that is dark under the
  stands and pale grey-green nearer you), turned into a PMREM by three once, on first use. No float
  textures that need an extension, no post-processing, no network.
- Textures, painted once: malachite 1024 x 128, marble 512 x 128, one engraved sheet per cup 1024 x 256.
- Not measured: build time for the env (about half a million pixels of arithmetic; a fraction of a second
  on a desktop) and anything at all on a Quest.

## What was learned about the metal (so nobody redoes it)

- Polished metal is only a picture of its surroundings. The first pass reflected a mid-grey-green pitch
  and a mid sky: no darks, no lights, so it read as plastic. Contrast in the painted stadium is the fix.
- Held at chest height you look down on the cup, so most of what it reflects is below the horizon. A
  green ground made the silver green and the gold olive; a dark one made the silver pewter. It is now
  near-black under the stands (one clean horizon line) and pale further down.
- Anything fine in the picture (a string of roof lamps, a floodlight grid, crowd speckle, mown stripes
  toward the horizon) comes out as a comb or zebra fringe round the reflections. All removed.
- Tight fluting does the same from the other side. There is none: the detail is engraved (a texture on
  slightly rougher metal) and in thin reeds.

## Look-page shots

`tools/ps2look.html?shot=` `pair`, `worldheld`, `clubheld` (35 cm from your eyes), `worldside`,
`clubside`, `worldabove`, `clubabove`, `worldbelow`, `clubbelow` (lifted, looking up), `worldwide`,
`clubwide` (on the plinth, 3 m), `worldspin`, `clubspin` (`FILM=6 node tools/ps2shots.mjs out worldspin`),
`worldsketch`, `clubsketch`. `&grips=1` draws the hand-holds as red wire balls.

## Short of real / not checked

- Nothing seen in a headset: whether the gold holds its colour on the Quest's display, how the reflections
  swim as you turn the cup in your hands (they will, which is what sells metal), and the frame cost of a
  metal object filling the view (per-pixel PBR with a PMREM lookup; unmeasured).
- The reflections are a painted generic daytime ground, not the one you're standing in, and the cups don't
  reflect each other, your hands or their own handles. At a night ground they'd want a darker picture.
- From the side at 40 cm the silver bowl shows the black stands as a dark oval with a pale rim: true to
  chrome, but it is the least pretty view of it, and its edge is slightly angular (the PMREM is 256 a face).
- The Star Cup straight from the side is a curved blade with the star edge-on beside it; the 'wings'
  sketch was dropped for reading as a crescent and star, and this view is the nearest the chosen one
  comes to that. From the front, back and three-quarters it is a flame.
- The star is flat-faceted on a short boss you can see from the side; the scrolls on the arms are coarse
  (8-sided) at 30 cm; the silver cup's knop is 16-sided from below.
- The plaques' small second lines wash out when they reflect bright sky.
- The plinth is a clean dark column with a velvet cloth and a gold cord: tidy, not lavish.
- Not wired into the ceremony; trophy.js must take the holds from `userData` when it is.
