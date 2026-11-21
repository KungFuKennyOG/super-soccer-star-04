# The crowd (branch `crowd`)

Kenny: "i think the crowd could look better". Before this, the crowd was a texture painted on each tier's slope. From the pitch it read as wallpaper:

- every fan was the same size in a perfect staggered grid, with no arms;
- empty seats showed as coloured tiles;
- cheering was fans hopping inside painted cells;
- the Liverpool end had a storm of floating flag rectangles;
- one banner word was a real club's motto.

## What exists

Every seat has a fan. Each fan is a card standing on his own step of the tier, so rows stand behind and above each other and hide each other in stereo, as a real stand does. Each card turns about the upright to face you.

| File | What it does |
| --- | --- |
| `game/ps2/fantex.js` | Paints the fan sprites in code, once (they're shared by every ground). It also paints the seat tile. |
| `game/ps2/fanmat.js` | The fan shader and the seat shader. `FAN_STATE` (GLSL) decides what each fan is doing. |
| `game/ps2/fans.js` | `Crowd`: places a fan on every seat, row by row on the tier steps. Builds the two crowd meshes and picks the flag holders. |
| `game/ps2/ultras2.js` | Flags now sit in the hands of chosen fans (see Flags). Banners are as before, with generic words. |
| `game/ps2/ground.js` | `crowdStrip` is gone. Every tier band goes to `Crowd.strip`. |
| `game/ps2/groundmat.js`, `groundgeo.js`, `groundtex.js` | The old crowd shader, geometry and tiles are removed. `flagMaterial` is rewritten. `NEVER ALONE` is replaced by `AVANTI`. |
| `game/ultras.js` | The old PS1 ultras, which the game no longer uses: the same word swap. |
| `game/ps2/stadium.js` | Adds `ooh()`, the `uOoh`, `uGoalT` and `uTheirT` uniforms, and `uDay` for the crowd. Their counter-attack celebration now fades over about 6 s (it was 3.3 s). |
| `game/main.js` | One added line: `stadium.ooh()` on `saved`, `parried` or `post`. |
| `tools/groundlook.js` | Adds the `groundfans` shot, plus `&goal=secs`, `&ooh=1` and `&poses=1`. |
| `tests/unit/fans.test.js` | Checks the crowd on every ground (see Measured). |

### The fans (`fantex.js`)

- There are 8 people: different builds and hair, a cap, a beanie, a hood, long hair, curly hair, bald; replica shirts with collar, cuffs, stripes or a band; jackets and hoodies; scarves round the neck. Each is mirrored at random, so there are 16 looks.
- Each comes in 16 poses:
  - sitting, and sitting turned to look along the row
  - standing
  - clapping (2 frames)
  - arms up in a V, arms straight up
  - scarf held up taut, scarf held up and swaying
  - fist pumped high and low
  - hands on head
  - holding a flag pole
  - arms folded
  - clapping over the head
  - arms out wide
- Each sprite is 64 x 112 px (1.4 cm a pixel), the upper body from the seat up, with the mouth open when cheering.
- The colours are not in the sprite. The sprite holds light and shade plus four masks: shirt, second colour (scarf, cap, trim), skin and hair.
  - The shader colours each fan from the ground's palette: 5 of yours, 5 of theirs, 6 neutral jackets.
  - It also gives him one of 6 skin tones and one of 8 hair colours.
  - So one atlas serves every ground and both sides.
- The legs are drawn in the shader, not painted: trouser legs in jeans, black or grey, shoes, under the seat level. They cover the seat pan in front of a sitting fan and show when he stands.
- Textures:
  - A: 1024 x 896 RGBA (light x alpha, shirt, accent, alpha), premultiplied so the mips don't darken the edges.
  - B: 1024 x 896 RG (skin, hair).
  - Together 5.5 MB, about 7.3 MB with mips, painted once in about 130 ms.
  - The seat tile is 64 x 32.
  - The old crowd tiles were three 1024 x 432 RGBA per ground, about 7 MB with mips, painted on every ground change.

### Who sits where (`fans.js`)

- Seats are 0.52 m apart (`SEAT`); a standing end is packed at 0.46 m (`PACKED`). Rows come from the tier profile (0.8 m).
- Each fan is jittered a little along and into the row, and his size varies from 0.94 to 1.06. 3% are kids (0.8).
- A stairway runs through every tier about every 15 m. It's placed by fraction of the run, so in corners the stairways are radial and line up tier to tier. Seats in it are left empty, and the seat shader draws steps there.
- About 3.5% of seats are empty, with some patches of empty seats. The empty-seat texture is a dark seat in the ground's seat colour; tier by tier the seat colour alternates between the recipe's two colours.
- Who supports whom follows the old blocks:
  - the ordinary stands: `oursShare` (78% on the look page);
  - the home curva: 95% home fans;
  - the away block: 85% away fans.
- Shirt colours are weighted: shirt 56%, alternate 24%, then shorts, trim and white. 28% wear neutral jackets (12% in the ends).
- The curva and the away end's lower tier (the kop ends at Liverpool and Dortmund) stand all game and are packed tighter. Shade is per row: under a roof is darker, and the back rows are a little darker.

### What they do (`FAN_STATE` in `fanmat.js`, per fan, in the vertex shader)

- **Sitting during play:**
  - small sideways sway;
  - now and then he shifts and looks along the row;
  - 14% sit with arms folded;
  - 1.2% stand.
- **Standing ends (ultras):**
  - The end sings a different "song" about every 7 s. Each fan changes at his own moment within half a second.
  - Each fan picks one of:
    - clapping over the head in time (75 bpm);
    - scarf up and swaying;
    - fist pumped to the beat;
    - clapping;
    - standing;
    - arms folded.
  - In about half the songs the whole end bounces together (10 cm, in time).
- **Your goal** (`cheer(true)`):
  - Your fans get up out of their seats in a ripple across the stand, over about 0.5 s.
  - For the first 2.5 to 6 s they have arms up, fists, arms wide or scarves, and 60% jump.
  - Then they settle into clapping, scarves, or clapping over their heads, still standing, until the restart (`cheer(false)`), when they sit back down in a ripple.
  - Their fans get a moment of hands on heads (45%), then sit still or stand with arms folded.
- **Their goal on the counter** (`theirs()`): the same with the sides swapped, for about 6 s.
- **A near miss** (`ooh()`, new): on a save, a parry or the post, 80% of your fans rise halfway with hands on heads for about 1.5 s.

### Flags (`Crowd.flags`, `ultras2.js`)

- Flags are held by chosen fans in the standing ends, in rows 15 to 78% back. They're spread at least 3.2 m apart, with big flags 6.5 m from anything.
  - Small flags: up to 12 per curva (about one per 4.5 m of width) and up to 4 per away block.
  - Big flags: 1 or 2 per curva (2.1x scale: a 2.8 x 1.9 m flag on a 5 m pole) and 1 per away end.
- The holder's sprite holds the pole: lower hand at chest height, upper hand at forehead.
- The pole's foot is at his lower hand, and it rises and bounces with him, because the flag shader runs the same `FAN_STATE`.
- He sweeps it from side to side about his hands. The cloth trails the sweep, sags and ripples, and moves harder when his side's hype is up.
- Liverpool now has 18 flags (it had 83), and other grounds have 12 to 15. All are generic stripes, halves, diagonals and dots in kit colours.

## Numbers

Measured in headless Chrome with software GL, so these are not fps.

| Ground | Fans | Ground triangles (all of it) | Draws (whole ground) | setGround (ms) |
| --- | --- | --- | --- | --- |
| London Red | 6,755 | 15,170 | 8 | 72 |
| Liverpool | 8,839 | 19,738 | 8 | 46 |
| Dortmund | 10,869 | 23,902 | 7 | 56 |
| Munich | 14,528 | 33,000 | 8 | 63 |
| Milan | 17,623 | 40,706 | 7 | 90 |
| National | 22,808 | 50,824 | 7 | 99 |
| Barcelona | 24,335 | 54,198 | 7 | 115 |

- **Draws:** the crowd is 2 draws (seats and fans). The old crowd was 1, so a ground is now 7, or 8 with a skyline.
- **Triangles:** each fan is 2 triangles (4 vertices) in one instanced draw. Seats are 2 triangles per row segment.
  - A full `ground` view of Milan with the players is about 115k triangles. Before, it was 83k.
- **Instance data:** 14 floats per fan, about 1.4 MB for Barcelona.
- **Build time:** the atlas is painted once, at the first ground (about 130 ms). Every ground after that takes 46 to 115 ms, which is in line with before (50 to 230 ms, mostly crowd tile painting).

## Measured (`tests/unit/fans.test.js`, every ground)

- Every fan is on his own tier, between its front and back and on its slope (within 1 cm).
- No two neighbours in a row are under 0.3 m apart.
- Nobody sits within half a seat of a stairway's middle in an ordinary stand.
- Standing ends are packed tighter than seated stands.
- Every ground has 3 to 20 flags, with 1 to 3 big ones. All are held by standing fans in an end, and no two are closer than 3.2 m.
- Every ground has 4,000 to 30,000 fans.
- No banner word is a club motto.

## What it is built from

Everything here is **built**, not captured. No crowd mocap is used: the CMU library has none.

- The pose set and reactions come from how real crowds behave:
  - seated and still in play;
  - on a goal, up in a ripple with arms up, fists, scarves and jumping, then applause;
  - hands to heads on a near miss;
  - the curva standing and singing in songs, with synchronised bouncing, scarves up and clapping over heads;
  - flags swept side to side on a pole held two-handed.
- The proportions (a 1.4 cm pixel, 0.45 m shoulders, 0.52 m seats, 0.8 m rows) are ordinary seated anthropometry and stadium seat sizes.
- The PS2-era treatment (sprite cards, 2-frame cheering cycles, palette-coloured fans) is the style of FIFA 2004 and PES 3 crowds. No layouts or art are copied.

## Short of real / not checked

- **Nothing has been seen in a headset or measured on a Quest.** The real question is fill rate.
  - A fan card is about 0.5 x 1.45 m against a seat area of 0.42 m². With the stands covering about half the view, that's roughly 2 to 3 layers of alpha-tested fragments (2 texture reads each) over the crowd.
  - On top of that, about 100k vertices per eye for Barcelona.
  - It should fit, but it's the first thing to watch. Knobs if it doesn't:
    - `LEGS` in `fanmat.js` (0.5 m of card under the seat could go to 0.3);
    - a density cut for the top tiers in `Crowd.strip`;
    - two fans per card for far tiers (not built).
- **Alpha test with `discard`:** the game renders without MSAA (`antialias: false`), so the fans' edges alias and far tiers may shimmer when you move your head. Alpha-to-coverage would need MSAA.
- **Billboards:** every fan turns to face you. Fine from the pitch, but in a far corner of the bowl everyone faces you rather than the play. Nobody watches the ball: heads don't follow it.
- **Close up** (5 m, the `groundfans` shot), the figures are simple:
  - painted shapes, faces with dot eyes, arms that are thick lines;
  - everyone has the same height of torso.
  - At 10 m and beyond, the usual distance from the pitch, they read as people.
- **Cheering** is 2-frame sprite cycles (PS2-style), so the arms snap between frames rather than move through them.
- **Weather:** no rain jackets, umbrellas or hats in snow. Fans just darken in rain.
- **Clothing:** there is no away-colour mix inside the ordinary stands beyond the share (no single shirts of the other side), and no women's or children's sprites as such (long hair, and kids at 0.8 scale).
- **Empty seats:** they come from a seeded chance per seat, not ticket sales. Big empty blocks (a small crowd) aren't modelled.
- **`CLAUDE.md` is now out of date** about the crowd: the line saying "~10k instanced fan dots" and the stadium line saying "a tiling painted texture on the tier slopes". I didn't edit it (brief).

## Look page

All shots are `tools/ps2look.html?shot=` with `&team=ID`, for example `PORT=81xx Q='team=LIV&goal=0.6' FILM=3 node tools/ps2shots.mjs out groundcurva`.

- `groundfans`: the side stand's front rows from the touchline, 5 m away (the worst case).
  - `&poses=1` puts every fan in one of the 16 poses.
- `groundcrowd`: the side stand through a long lens.
- `groundcurva`: the home end.
- `ground`, `groundleft`, `groundright`, `groundwide`: as before.
- Options:
  - `&goal=secs`: your goal at that moment, for filming the ripple;
  - `&cheer=1`: already celebrating;
  - `&counter=1`: their goal;
  - `&ooh=1`: a near miss at 0.1 s.

# Second pass (branch `crowd2`)

Kenny: "make them a bit more realistic (them being flat is fine) and have the appropriate teams colours like in 96".

## Team colours (`sideWear` in `fans.js`)

- Like the '96 crowd, every fan wears his side's colours. The kit colours arrive as `[shirt, alt, shorts, trim, off-white]`. The off-white is always added, so it is dropped.
- **Tops:**
  - A coloured shirt: shirt colour 64%, then the kit's second colour 26% (the alt or the stripes, else the trim, else the shorts), then a third colour 10%.
  - A white shirt (Madrid, Germany, England): white only 50%, the trim / shorts colours 34% and 16%. So white sides read as white and navy, white and black, white, red and navy, not grey.
  - White is never a top unless the shirt is white.
- **Stripes:** striped shirts appear only when the kit has a pattern (alt is not the shirt).
- **Scarves and caps:** in the second colour (60%) or the shirt colour. A red side with white trim (Liverpool) gets red and white scarves.
- **Neutral jackets:** 5%, only in ordinary stands, never in the curva or the away block. Before, it was 28%, doubled for jackets.
- `share` decides who sits where in ordinary stands, as before.

## The figures (`fanpaint.js`, `fanhead.js`, `fantex.js`, `fanmat.js`)

A fan is now three layers on his card, put together in the fragment shader: arms over head over torso. Each layer is sampled only where it is, so a fragment does 1 to 3 reads of A plus 1 of B.

- **Torso** (16: 8 tops x slim / broad), 1 cm a pixel, drawn with canvas paths:
  - shoulders sloping to the neck, deltoids, sides to the waist;
  - folds from the armpits, creases over the belly, shade low down;
  - the tops: replica shirts with a collar and badge, stripes, a chest band, a scarf wrapped round the neck with barred hanging ends and fringe, a zip jacket with a stand-up collar and scarf, a hoodie with drawstrings and a pocket, a track jacket with shoulder-to-cuff stripes, a polo with a collar and placket;
  - trousers at the lap.
- **Arms** (24 poses x short or long sleeves), 1 cm a pixel:
  - limbs shaded round with the light from the upper left; sleeves with a hem shadow, cuffs and an elbow crease;
  - hands as shapes: an open hand with fingers and a thumb, a fist, a flat hand on the lap, a pointing hand;
  - two-colour bar scarves held between the hands, with fringes.
  - **Poses:** sitting, leaning on the knees, talking with one hand up, standing, arms folded, clapping (3 frames), arms up (low V, V, straight), scarf held up (level and tilted, the tilt mirrored for the other way), fist pump (low, mid, high), hands on head, hands to face, the flag pole, clapping overhead (2 frames), arms wide, pointing, waving.
- **Heads** (8 styles x 3 views x 3 mouths), 0.6 cm a pixel. Each is ray-marched in code from a few blended ellipsoids:
  - skull, face, jaw, brow, nose, ears, neck, with eye sockets carved in;
  - lit from the upper left, with the creases darkened (sockets, under the nose and jaw);
  - eyes as a white with an iris and a lid line, inside darker sockets; brows; a mouth shut, open (shouting or singing) or an O (a gasp);
  - hair as a shell with volume and a side parting: short, buzz, bald with a fringe ring, long, curly; a cap with a brim, a beanie, a hood (in the shirt's colour).
  - A head is about 23 cm, 1/7.6 of a 1.75 m man.
- **Where heads look:**
  - Each fan looks at his own point near the play (`uBall`, from `stadium.update(dt, t, world.ball)`), offset by up to ±17 m along the pitch and ±10 m across.
  - The vertex shader picks the view from where that is: facing you (within about 7.5 degrees), three-quarters, or near profile. The head is mirrored for left or right.
  - 10% of seated fans turn to talk to the neighbour on one side now and then (near profile, mouth moving, a hand up).
  - Without a ball (the look page passes one), they watch the viewer.
  - The card itself still turns to face you, so nobody goes edge-on.
- **Cheering** cycles through 3 or 4 frames (a b c b) instead of a hard flip between two:
  - claps go open, mid, shut;
  - arms go from shoulders, to a V, to straight up;
  - fists go low, mid, high;
  - scarves sway between tilted left, level and tilted right.
  - The singing and shouting mouth opens and shuts in time.
- **Atlas:** A (RGBA) and B (RG) are 1024 x 1176, 7.2 MB, about 9.6 MB with mips (it was 7.3 MB with mips).
  - Painted once, in 403 ms in headless Chrome (the heads are about 350 ms of that).
  - Per-ground builds: 46 to 146 ms.
  - Still one instanced draw for every fan, alpha tested. Per fan: 2 triangles, 18 floats of instance data.

## Main game

- `game/main.js` changes one existing line: `stadium.update(dt, t, world.ball)`, so the crowd looks at the ball.

## Short / not checked

- **Nothing has been seen in a headset.**
  - Fill cost went up: up to 3 texture reads of A per fragment where arms, head and torso overlap. Watch the fps at Barcelona and the national stadium.
- **Close up** (5 m) they are clearly painted people, PS2-style: stiff torsos all the same shape, short sleeves reading as bands on the upper arm, arms a little thin.
- **The torso doesn't turn** with the head. The body is always square to you; only the head turns.
- **Heads are the same few shapes.** One face per view (no beards, glasses or ages beyond grey hair); skin and hair colours give the variety.
- **The kit colours handed over** are the home kit's `[shirt, alt, shorts, trim]`. A nation's second colour that is only in `trim2` (Germany's red) never reaches the crowd.
