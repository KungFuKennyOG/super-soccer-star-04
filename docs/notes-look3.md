# Branch `look3` (23 Nov): crowd variety, grounds checked against sources, the last PS1 props

- Crowd: `docs/notes-crowd.md`, "Third pass".
- Grounds: `docs/notes-stadium.md`, "Third pass".

## The replay screen and the turntable (`game/ps2/props.js`)
- `buildMonitor(picture)`: the floating CRT (a 1.64 x 1.04 x 0.62 m grey box) is now a slim 2003-era broadcast
  monitor: a graphite bezel 4 cm round the picture (7 cm chin with a green power light), bevelled, a shallow
  rounded housing behind, all Phong with a fine grain painted in code (128 px). The picture is the same
  1.44 x 0.81 m at the same place, so the REPLAY / LIVE tag sits where it did. 3 lit meshes plus the light, the
  picture and a dark recess: 6 draws (was 2), about 1,400 triangles (was 12). The big screen's picture lost its
  PS1 dither (plain unlit material).
- `buildPlinth()`: the team-select turntable (16-sided PS1 cylinders, navy and flat gold) is a 72-segment
  lathe: a rounded lip, a slightly flared satin side, a brushed dark top with a soft pool of light in the
  middle (256 px painted texture) and a thin gold light ring at its foot. Top at 0.18 m as before. 3 draws
  (was 2), about 1,000 triangles.

## PS1 WOBBLE
Removed from the settings screen (`ROWS` in `game/menus.js`) and from the saved settings (`loadSettings`
drops an old `wobble` key, so old saves load). `applyWobble()` in `display.js` now just keeps the PS1
materials still (snap grid out of reach, no texture warp); `main.js` still calls it, unchanged.
PS1 materials still in the running game, all of them now still and only dithered:
- `game/hud.js`: the scoreboard frame and its two hanging cables (`ps1({ color: '#22222a' })`).
- `game/juice.js`: the shot streak (octahedra) and the turf bits (cubes).
- The PS1 grounds, ball, arrow and bodies in `game/grounds.js`, `stadium.js`, `ultras.js`, `actors.js`,
  `weather.js`, `hands.js` are no longer used by `main.js` (only by lab pages).
The smoke test's settings walk moved weather from row 7 to row 6.

## Headset check
1. Main menu → Champions Cup: the turntable under the player. It should look like a showroom plinth (dark
   brushed top, soft gold ring), not a navy can.
2. Settings: no PS1 Wobble row; values below it still change the right setting; your old settings kept.
3. Score a goal: the replay comes up on a thin dark monitor with a bezel; the REPLAY tag blinks top left.
   During the celebration the half-size LIVE monitor too.
4. Crowd: stand at a touchline and look into the first rows. Expect builds (heavy men, women, slim lads),
   beards and glasses, short sleeves as sleeves. FPS at Barcelona and the national stadium (the largest crowds)
   with your head turning: 72 is the bar. The first ground of a session paints the atlas (about 0.5 s headless).
5. Grounds: Dortmund's corners filled, Istanbul with both sides roofed, Turin's ends open, Porto's ends low,
   Madrid's east side lower and open.
