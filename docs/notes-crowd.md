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
