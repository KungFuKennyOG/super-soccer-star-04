# Stadiums in the '04 look (branch `stadium`)

## What exists

`game/ps2/stadium.js` builds the grounds in the new look. Its interface is the same as `game/stadium.js`'s, so wiring it in means changing one import in `game/main.js`:

- `buildStadium(scene)`
- `setGround(recipe, ours, theirs, share)` returns the ground with `board {y, z}`, `recipe`, `topY`, `endZ`, `sideX`, `ultras`, `curvaOurs`, `uniforms`, `lamps`
- `setWeather(kind)`, `netHit(x, y)`, `cheer(on)`, `theirs()`, `update(dt, t)` and the `ground` getter

Rain and snow come from `game/ps2/weather.js` `createWeather(scene)`, with the same interface as `game/weather.js` plus an optional `bright(stadium.weatherBright)`.

Nothing in `rules/`, `game/main.js` or `game/grounds.js` changed. Every ground is built from the recipes in `game/grounds.js` (`GROUNDS`, `groundFor` and `venueFor` stay there). That covers all 17 clubs (the two Milan clubs share a ground) plus the national stadium.

| File | What it does |
| --- | --- |
| `groundplan.js` | The layout from a recipe, as pure numbers: stands, tier profiles (same rules as `grounds.js`), corners, pylons, towers, track, boards, board position. Tested by `tests/unit/groundplan.test.js`. |
| `ground.js` | Builds the stands. Each has tiers with the crowd, fascias carrying a trim in the club's colour plus a row of ads, executive boxes under the overhangs, back walls, closed gable ends, and roofs on cantilever lattice trusses with a lattice beam along the front. Roof lamps where the recipe says `lights: 'roof'`. Corners are quarter sweeps of the side profile. |
| `groundbits.js` | Lattice floodlight pylons with lamp heads aimed at the pitch, lamp poles along an open stand's top (Barcelona), Milan's ramp towers, the pitchside boards (where `stadium.js` stands them) and the TV gantry. |
| `groundtex.js` | Everything painted in code: the structure atlas (concrete, roof sheeting, lattice, boxes, lamps, cladding, 8 ads), three crowd tiles plus a who-supports-whom table, flags, banners, the net, clouds. |
| `groundmat.js` | Shaders. Light is baked per vertex as two weights, how much a face takes the sun and how much it faces the floodlit pitch. The time of day sets three shared colours. |
| `turf.js` | The pitch quad, mown as the recipe says (stripes 6 m, wide 12 m, checks 12 m, starting on the goal line), with a worn goalmouth and spot, the stands' shadow on sunny days, a pool of floodlight at night, Turin's track (rounded oval with lanes), a wet sheen, snow cover and concrete outside the stands. Also the half-pitch lines, soft-edged; under snow they show as swept-clear grass. |
| `goal2.js` | Round posts, stanchions and corner flags in one lit mesh. The net is a painted 12 cm mesh, alpha blended, that bulges in its vertex shader when `netHit` is called. |
| `ultras2.js` | Flags on poles: one instanced draw for both ends, swinging and rippling, harder when that side's hype is up. Banners draped over the end's front wall with generic words (FORZA, ULTRAS, CURVA, ALLEZ, VAMOS, SEMPRE, AVANTI, ALE ALE). |
| `weather.js` | Rain streaks slanting with a little wind, and soft round snowflakes, in a box round your head. One draw each. |
| `stadium.js` | Times of day (`TIMES2`: day, dusk, night) with weather on top, the sky dome (clouds by day, stars at night, grey overcast in rain and snow), the scene's hemisphere and key lights for the players, and the crowd's jump. |

### Crowd reactions

These work as the PS1 ones do, but with no per-fan geometry.

- The crowd is painted on the tier slopes. The shader staggers the rows and reads per fan, from a 32x36 table, whether he is yours.
- `cheer(true)` makes your fans hop inside their own cells. `theirs()` does the same for theirs, fading over about 3 s. The ultras bounce all game.
- Flags wave harder when their side scores.

### Look page

The shots live in `tools/groundlook.js`, hooked into `tools/ps2look.html` with 5 lines:

- `ground`: from the pitch at eye height (1.68 m), 15 m out, facing the goal.
- `groundleft`, `groundright`, `groundback`: the same spot turned to each side and behind.
- `groundcurva`, `groundcrowd`: the home end, and the side stand through a long lens.
- `groundnet`, `groundbulge` (film it): the goal and net.
- `groundwide` (from the gantry) and `groundtop` (from above).
- `groundcam` takes `&cam=x,y,z&at=x,y,z&fov=`.

Query options: `&team=ID` (a nation gives the national stadium), `&opp=`, `&share=`, `&time=day|dusk|night`, `&wx=rain|snow`, `&cheer=1`, `&counter=1`. Example: `PORT=81xx Q='team=DOR&wx=rain' node tools/ps2shots.mjs out ground@1`.

The blue panel with a dark frame on the look page stands in for the HUD scoreboard and the replay's big screen at `ground.board`. It is page-only, because the game's own `hud.js` and `replay.js` draw those.

## Each ground and the real one it's modelled on (owner's ask: "get inspired by real stadiums and make it close to accurate")

**Limits.** These are architecture and colours only. There are no stadium or club names in the game (grounds keep their city names), no seat lettering, no crests, no real banners or advertisers.

**New fields.** The recipes in `game/grounds.js` gained fields that only the '04 look reads: `left` / `right`, `roofOn`, `corners` as a list, `cornerFill`, `kop`, `towers` as a count or `'access'`, `masts`, `girders`, `ribs`, `arches`, `roofColor`, `facade`, `front`, `skyline`. The PS1 builder ignores them; a list or a number in `corners` / `towers` is still truthy for it.

**PS1 side effects.** Tier sizes, gaps, light kinds and `roof` changed for several grounds, so the PS1 grounds change shape a little too. For example, the English grounds now use roof lights in place of pylons, as they had by 2003.

**Sources.** "Confirmed" means a source I read said it ([stadiumdb](https://stadiumdb.com), [archeyes](https://archeyes.com/san-siro-stadium-cugini-stacchini-ragazzi-hoffer/), [stadiumguide](https://www.stadiumguide.com), Wikipedia pages for Celtic Park, Delle Alpi and the Munich Olympic stadium, [tfcstadiums](https://tfcstadiums.com/design-parc-des-princes-explained/) on the Parc). "Memory" means general knowledge I didn't check. "Guess" means a design call.

### Third pass (branch `look3`, 23 Nov): each ground checked against a source

Kenny: "get inspired by real stadiums and make it close to accurate". Every ground was looked up as it stood
around 2003-04 (Wikipedia history sections, stadiumdb.com, the Delle Alpi roof engineer's own project page,
the Dragão architects' write-up). "Confirmed" below means a source read in this pass says it; "memory" is
general knowledge not checked; "guess" is a design call. Architecture and colours only, as before.

New recipe field: `cornerTiers` (a corner's own tiers, for corners lower than the sides they join;
`groundplan.js`). Changed recipes: MAD, BAR, MAN, TUR, DOR, PRT, IST. Each changed ground was rendered from
the gantry (before/after) and from the pitch at eye height (goal end and the right-hand stand).

#### MADRID: Bernabéu, 2003
- **Confirmed:** the 1982 roof covered the first and second tiers "except the east side"; 1992-94 added the
  upper tier (height 22 m to 45 m) and "four entrance towers... with a central spiral ramp" outside the
  corners; the east side was only expanded in 2001-06 (Wikipedia).
- **Changed:** the east (right) stand is two tiers with no roof; the roof is on the other three.
- **Guess:** that the east works hadn't yet raised it by 2003-04 (they were under way); seat colours; the
  lamp poles on the open east stand.

#### BARCELONA: Camp Nou
- **Confirmed:** three tiers, continuous oval with no open corners, "the main stand covered by a roof";
  seats garnet in tiers I and III, blue in tier II; the upper tier "rose as it moved away from the main stand,
  peaking on the east side" (stadiumdb, Wikipedia).
- **Changed:** seat colours were the wrong way round (tier I blue); the right (east) upper tier is taller.
- **Not drawn:** the seat lettering (club name and motto) on purpose. **Guess:** the end stands' upper tier
  is level, not rising along its length; the lamp poles.

#### MUNICH: Olympiastadion
- **Confirmed:** acrylic canopies on steel cables over about 45,000 seats; a roof over the east stands was
  planned and never built (Wikipedia).
- **Memory:** the running track (it was the 1972 Olympic athletics stadium). **Guess:** masts' count and
  place; the roof on the west side and its two corners only.

#### MILAN: San Siro after 1990 (both Milan clubs)
- **Confirmed (second pass):** third ring on 11 cylindrical ramp towers, red lattice girders over the roof on
  four taller towers, polycarbonate roof, no track. **Guess:** where the towers stand, seat colours.

#### MANCHESTER: Old Trafford, 2003-04
- **Confirmed:** North stand three tiers (1996), East and West (Stretford End) two tiers (second tiers 2000),
  South single tier and covered; the north corners got their *second* tiers only in 2005-06 (Wikipedia).
- **Changed:** the two corners by the three-tier (left) stand are filled with a single lower tier; the south
  corners stay open.
- **Memory:** lights along the roofs. **Guess:** seat colours, which end is the Stretford End.

#### LIVERPOOL: Anfield, 2003
- **Confirmed:** Kop single tier (12,390, no boxes); Centenary (Kemlyn Road) two tiers since 1992; Anfield
  Road two tiers since 1998; Main Stand roof on two thin uprights; lights along the Kemlyn Road and Main
  stand roofs since 1973 (Wikipedia). Matches the recipe; unchanged.
- **Guess:** the corners (the source doesn't say) and the Main Stand as one tier.

#### LONDON RED: Highbury
- **Confirmed:** art-deco East and West stands; North Bank two tiers (1993); Clock End roofed with 48 boxes
  (1989); pitch 100 x 67 m; 38,419 seats; big screens in two corners (Wikipedia). Unchanged.
- **Guess:** East/West as two tiers (memory), the floodlights on the roofs.

#### LONDON BLUE: Stamford Bridge, 2003
- **Confirmed:** East three tiers (1973), West three tiers (finished 2001), North (Matthew Harding) two tiers
  (1996-97), the Shed End rebuilt 1997; hotels and flats built into the complex by 2001 (Wikipedia).
  Unchanged.
- **Guess:** that the buildings fill the two Shed-end corners and their size.

#### TURIN: Delle Alpi
- **Confirmed:** running track; stands far from the pitch; 69,041 seats (Wikipedia). The roof: "The main
  pylons hang the roof panels, connected by a 6 cable ring covering the main sides of the stadium... The
  grandstand cover is made by teflon, while its main structure is made by steel" (Majowiecki, the roof's
  engineer). That settles the old conflict: a cable-hung PTFE roof over the sides, which is why Wikipedia says
  fans were exposed (the ends).
- **Changed:** roof on the two sides only, pale PTFE colour; the ends are open.
- **Guess:** the number and place of the pylons, two tiers (the source says "three-ring").

#### DORTMUND: Westfalenstadion, 2003-04
- **Confirmed:** "Four new stands were built to fill the corners" in 2002-03; the roof is held by "exterior
  pylons, which were painted yellow"; second tiers on the sides 1995-99; north and south enlarged after 1997;
  the south terrace the largest free-standing one in Europe, about 25,000; 83,000 capacity in 2003-05
  (Wikipedia).
- **Changed:** corners filled (were open).
- **Guess:** 8 pylons (2 a stand), the corners as tall as the sides.

#### PARIS: Parc des Princes
- **Confirmed (second pass):** continuous bowl, no open corners, 50 exterior ribs carrying the cantilevered
  roof. Unchanged. **Guess:** seat colours, rib spacing.

#### AMSTERDAM: ArenA (1996)
- **Confirmed:** a retractable roof (planned fixed, changed in the design); 54,990 seats; the grass wouldn't
  grow in the roof's shade (Wikipedia). Unchanged. **Guess:** the two long arches' shape, tiers, seat colours.
  The game draws the roof closed.

#### PORTO: Dragão (opened 16 Nov 2003)
- **Confirmed:** the lower tiers and pitch are dug below ground ("approximately halve the visible mass");
  the upper tiers "border the pitch to both east and west... designed like isolated buildings"; the north and
  south ends are low (Risco, the architects); 50,000 seats.
- **Changed:** ends are a single tier, corners carry the lower ring only (`cornerTiers`), the long sides have
  an upper tier, so the upper tiers end in walls as separate blocks.
- **Guess:** the roof's colour and how it is carried; that the ground level isn't modelled (the pitch is at 0).

#### LISBON: Luz (2003)
- **Confirmed:** three tiers with a wavy outline, a polycarbonate roof that lets light through, carried by
  four 43 m steel arches (stadiumdb). Unchanged. **Guess:** the arch colour (red), seat colours.

#### GLASGOW: Celtic Park after 1998
- **Confirmed (second pass):** two-tier horseshoe on three sides, the 1929 main stand as the fourth.
  Unchanged. **Guess:** seat colours, lights.

#### ISTANBUL: Ali Sami Yen
- **Confirmed:** "two identical lateral stands which were covered by a roof"; behind the goals the open
  Yeni Açık "with two tiers" and the Eski Açık with the scoreboard; 22,800 in 1996-2005; floodlights since
  1965, renewed 1993; in one of central Istanbul's most crowded quarters (Wikipedia).
- **Changed:** both sides roofed (was one), the home end two tiers, the end behind you one tier.
- **Guess:** which end the home fans are in, the pylons' place.

#### NATIONAL STADIUM
- **Guess** by design (a late-'90s national bowl with a hidden track and a full roof ring).

### Draw calls and rendering

- A ground with a skyline (Madrid, Munich, Manchester, Liverpool, London Red, Istanbul) costs one extra draw: 12 for the whole stadium.
- Every ground was rendered from eye height and from the gantry and compared with the descriptions above. The PNGs are in the report.
- Masts behind stands (Dortmund, Turin) and the ArenA arches are mostly out of view from the pitch at eye height. The girders, the Luz arches, the tent roof, the open ends and the skylines do show.

## Numbers

All measured in headless Chrome with software GL, so these are not fps.

- **Draw calls, a whole stadium: 11**, plus 1 for rain or snow.
  - Per ground: structure 1, lattice 1, crowd 1, glows 1, flags 1, banners 1.
  - Fixed: sky 1, pitch 1, lines 1, goal frame 1, net 1.
- The old PS1 grounds were around 40 or more draws.
- A full `ground` view with 6 players is about 30 to 37 calls in total. Most of those are the players and their shadows.

Ground triangles per club, excluding the goal:

| Ground | Triangles |
| --- | --- |
| London Blue | 2,470 |
| London Red | 2,870 |
| National stadium | 3,100 |
| Madrid | 3,660 |
| Glasgow | 3,940 |
| Milan | 4,000 |
| Liverpool | 4,130 |
| Barcelona | 4,260 |
| Turin | 4,580 |
| Dortmund | 5,070 |

- Goal and net: about 4,500 triangles. Flags: 31 to 82 instances in one draw. Rain: 3,600 quads. Snow: 1,800 quads.
- Build time per `setGround`: 50 to 230 ms, mostly painting the three crowd tiles (1024x432 each) and the banner and flag sheets.
- Textures:
  - The structure atlas (1024²) and the net are shared and kept.
  - About 4 crowd/flag/banner textures are made per ground and disposed when the ground changes.

## What it is built from

- The layout and its numbers are the recipes, unchanged: tiers, gaps, which corners, roof kind, light kind, time of day, mowing, seat colours, track, towers, and where the home curva and away block sit.
- The PS2-era treatment is built, not measured: painted crowd cards, ads on tier fascias, cantilever trusses, lattice pylons, executive boxes.
- The shadow direction is `LIGHT_DIR`, the same direction the players' projected shadows use.

## Short of real / not done

- **Nothing has been seen in a headset or measured on a Quest.** 11 draws and about 5k triangles should be cheap. Unknowns:
  - fill rate from the full-screen sky and the large blended net and glows;
  - five large 1024 textures per ground;
  - the crowd's per-pixel `texelFetch` plus `textureGrad`.
- **The board (scoreboard and big screen) hangs where `grounds.js` always put it.** At grounds with a half roof, or a low end stand like London Blue, it covers much of the home end from the pitch. A better place (corner or roof) would change `board` for `hud.js` and `replay.js` too, so I left it. It's Kenny's call.
- **The crowd is flat painted cards, as in 2003 games.** Seen up close, from the first rows, they are cartoon-like.
  - Rows look squashed when you look up a steep tier.
  - The 32-fan tile repeats about every 19 m.
  - A fan's jump is his picture sliding up inside his cell; there is no arm-waving.
- **Stand shadows on the pitch:** with the game's fixed sun (`LIGHT_DIR`), most stands' shadows fall short of the touchline. Only grounds with tall stands close to the pitch get a band on the pitch. Players aren't darkened when they're in the shade.
- **Corners** are swept from the side profile. Where the end stand differs (most bowls), its gable shows at the seam, and there is a thin dark seam between a side stand and its corner (Glasgow).
  - Crowd at the inner point of a corner is squeezed.
- **Night lighting** is one floodlit pool on the pitch. There is no multiple-shadow star under the players and no light falling into the crowd from the pylons.
- **Net bulge:** a single damped push at the hit point (about 0.6 m, settling in about 0.4 s). There is no wrap round the ball, and side and roof panels push the same way.
- **The day sky** is a painted cloud band. Dusk is a gradient.
- **No gloves, ball or keeper changes.** Not my job.
- `game/ps2/stand.js` and `pitch.js` (the earlier test stand) are untouched. The other look shots still use them.

## Wiring it in (for whoever does it)

In `game/main.js`:

1. Import `buildStadium` from `./ps2/stadium.js` and `createWeather` from `./ps2/weather.js`.
2. After `weather.set(wx)`, optionally call `weather.bright(stadium.weatherBright)`.

The camera far plane must stay at 260 m or more. The sky dome is 210 m round (0, 0, -15). The scene lights `buildStadium` adds are the hemisphere 0.62 plus key 0.68 that the PS2 players were tuned under (day); dusk and night change them.
