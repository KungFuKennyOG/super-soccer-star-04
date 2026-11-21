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
| `ultras2.js` | Flags on poles: one instanced draw for both ends, swinging and rippling, harder when that side's hype is up. Banners draped over the end's front wall with generic words (FORZA, ULTRAS, CURVA, ALLEZ, VAMOS, SEMPRE, NEVER ALONE, ALE ALE). |
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
