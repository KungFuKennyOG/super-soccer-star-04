# Notes: the '04 menus and HUD (branch `ui`)

A reskin of every menu and HUD canvas, from the '96 pixel font and 90s logo to a 2003-04 console football look,
taken as a style only: bold condensed italic sans-serif, glossy gradient bars, rounded tabs, dark glass panels over a
soft floodlit backdrop, an amber glowing picked row, controller-button chips in the hints, team chips (a nation's flag
from `game/ps2/flags.js`, a club's invented shield in its kit colours with a star). No real logos, layouts, sponsors
or competitions copied. Every screen, option, input and behaviour is as it was; `rules/` is untouched.

## The year

`YEAR` in `game/ps2/brand.js` is `'04` (Kenny hasn't decided '96 vs '04). It feeds the title page (`[data-year]`,
the tab title), the logo on the menus, the World Cup's name in the menus and hub (`WORLD CUP '04`) and the PS1
trophy plate in `game/trophy.js`. The mode is still called WORLD CUP (Kenny's name for it; the brief says invent
competition names, but renaming a mode is his call, not a reskin's). `rules/cup.js` has '96 in a comment only.

## What exists

- `game/ps2/ui.js`: the shared style. Palette (`PAL`), `font` / `text` (system font stack Roboto, Inter, Helvetica
  Neue, Arial; squeezed sideways in code to 0.86 so it reads condensed whatever font the browser has, then squeezed
  to 0.62 and shrunk to fit a `max` width), `wrap`, `rr`, `panel` (dark glass), `gloss` (the glossy bar, blue /
  amber / grey / any two colours, optional glow), `tab`, `rowHighlight`, `backdrop` (painted once per size: night sky,
  blurred floodlights, a crowd band, mown stripes, darkened and vignetted), `header`, `hints` (A green, B red, X
  blue, Y yellow discs, key caps for others), `stars`, `teamChip`, `shirt`, `logo`. Three side: `uiTex`
  (linear filtering and mipmaps, the PS1 game used hard pixels), `uiMat` (unlit, no fog, no tone mapping),
  `uiPlane`.
- `game/ps2/brand.js`: `YEAR`, `NAME`, `applyBrand()` (run by `index.html` before the game loads).
- `game/ps2/menudraw.js`: the menu screens as pure painters: mode select (logo, five glossy buttons, the picked
  mode's description), settings and locker (two glass panels, a LOCKER tab, `◀ value ▶` on the picked row),
  team select (world map for nations with the flag chip, name and stars over it; one club at a time with its
  shield, stars, a shirt and shorts in its kit, glowing ◀ ▶ buttons and n / 17), the cup hub (continues as three
  lit balls, the stage, a group table with flag chips and the top two marked green, or the two-sided bracket with
  connector lines, and the NEXT fixture bar with both chips), message screens (full time, cup results, training
  done; lines wrap instead of shrinking to a 1x pixel font).
- `game/ps2/hudpaint.js`: the scoreboard bug, the stadium board, banners (headline on a bar by tone: amber good,
  red bad, blue info; up to three lines on glass under it), the pass target's tag, the subtitle, the training card,
  the radar.
- `game/menus.js` now only owns the panel, turntable, selection and input; it paints through `menudraw.js` and only
  when something on screen changed (screen, selection, blink phase, settings). `MODES` and `ROWS` are exported for
  the look page. The turntable's plinth is steel with an amber ring.
- `game/worldmap.js` redrawn in the same style at any size (soft ocean, lit land with an edge, kit-coloured pins,
  a pulsing amber ring and a glossy label on the picked nation).
- `game/hud.js`, `commentary.js`, `training.js`, `celebration.js` (dance lane, stick figures as drawn lines on dark
  discs), `replay.js` (the CRT's REPLAY tab), `trophy.js` (the ceremony's sign) moved onto `ui.js`. `hud.js`'s unused
  `buildPanel` is gone.
- `index.html`: the title page in the same style. The Google Fonts link (Racing Sans One, Press Start 2P) and the CRT
  scanlines are gone; it's system fonts and CSS gradients only. The browser HUD's two boxes became the bug canvas
  (`#bug`, the same canvas the headset shows).
- Tools: `tools/uilook.html` + `tools/uilook.js` paint every canvas flat with made-up data; `node tools/uishots.mjs
  out/dir [name ...]` writes each as `name.png` (full size) and `name-vr.png` (the width it has in a Quest 3 eye at
  framebuffer scale 0.7, taken as 11 px per degree, smoothed down like a mipmapped texture). `node tools/uigame.mjs
  out/dir [menus|match|dance|fulltime|ceremony|training]` screenshots the real game in headless Chromium (title,
  menus, a cup match's kick-off banner, bug and subtitle, a goal banner and the replay CRT, the dance lane, full
  time, the trophy sign, a training card).

## Changes you'd notice beyond the look

- Scoreboard bug: new in the headset, a small plane on the camera, top left of your view (0.3 m wide at 0.72 m, about
  25° left and 19° up, tilted to face your eye), only while playing and not in training. Home chip, short name,
  score, away short name and chip (cup) or your goals (Score Attack), the clock (GOAL! in amber when you score),
  points under it. One extra draw call in play. In the browser it replaces the two boxes at the top.
- Pass target tag: the LOB tag is now a pill over whoever you'd pass to, with his number (amber), and `number | LOB`
  in blue when the pass will go over the top. That's the "name / number bar": players have no names, so it's numbers.
- Power: kept as the ring round the reticle (CLAUDE.md: Kenny dropped the separate power bar as redundant), so no
  bar was added, and the ring is as it was. The pass ring is as it was.
- Subtitles wrap onto two lines (they used to be cut off at about 36 characters). The strip sits a little lower to
  keep its top where it was.
- Message screens wrap long lines rather than dropping them to the small font.

## Numbers

- Canvases (was → now): menu 256x192 → 1024x768 on the same 2.2 x 1.65 m panel; banner 192x64 → 768x256; training
  card 224x50 → 896x208; subtitle 224x14 → 1024x128 (plane 0.64 x 0.04 → 0.64 x 0.08); stadium board 128x48 →
  512x192; radar 64x60 → 128x120; dance lane 256x80 → 512x160; trophy sign 192x40 → 768x160; REPLAY tag 48x10 →
  256x64; LOB tag 24x9 → 256x96; bug 640x128 (new).
- Texture memory: about 3.1 MB for the menu panel plus a third for mipmaps (was 0.2 MB); about 6 MB for everything.
- Uploads: the menu is repainted and uploaded only when something on it changes: a blink twice a second where a
  prompt blinks (hub, message screens, club arrows), four times a second on the world map (the pulse), else on input.
  Each is a 1024x768 upload with mipmaps; on the Quest that's maybe a few ms, a hitch to watch for (see below).
  Every frame in play: the radar (128x120, no mipmaps) as before; the dance lane (512x160, no mipmaps) while dancing.
  The board and bug repaint when the clock's second changes. Banners, tags, subtitles and the training card on change.
- Paint times in headless Chromium (software): a menu screen 2 to 10 ms (the backdrop is painted once, 40 to 70 ms),
  the HUD pieces 0.5 to 2 ms each.
- Legibility (at the headset widths from `uishots`): the menus at 505 px across: the smallest type (settings rows,
  table cells, hints) is 13 to 15 px tall there, every line readable in `docs/ui-shots/after-settings-vr.png`
  and `after-bracket-vr.png`. Banner, subtitle and training card at 480 to 527 px: 14 to 30 px type. The bug at
  259 px: names, score and clock 16 px, the points 15 px; the smallest thing in the HUD.
- Draw calls: +1 in play in the headset (the bug). Everything else replaced a mesh one for one.

## Pictures (`docs/ui-shots/`)

Before (smoke test, browser): `before-title.png`, `before-menu.png`, `before-settings.png`, `before-match.png`,
`before-training.png`. After, flat at full size: `after-mode.png`, `after-settings.png`, `after-worldmap.png`,
`after-club.png`, `after-group.png`, `after-bracket.png`, `after-fulltime.png`, `after-hud.png` (bugs, banners,
subtitle, training card, radar, tags, board); at headset size: `after-settings-vr.png`, `after-bracket-vr.png`,
`after-hud-vr.png`. After, in the game: `after-game-*.png` (title, menu, settings, worldmap, clubselect, group,
bracket, match-kickoff, goal-banner, replay-crt, dance, fulltime, ceremony, training). The PNGs are quantised to 256
colours to keep them small; `node tools/uishots.mjs` and `node tools/uigame.mjs` remake them at full quality.

## Short / not done

- Fonts: Roboto is assumed on the Quest browser; if it isn't there the stack falls back to Arial / sans-serif. The
  squeeze keeps widths sane either way, but the look was only seen with Roboto (headless Chromium here has it).
- The PS1 bits around the UI stay PS1: the turntable plinth, the CRT box, the trophies' engraved plates (pixel font),
  the pass and power rings and the reticle (`ringTex` / `reticleTex`, hard pixels), the ultras' banners (crowd art,
  not UI). The browser still renders the 3D at 480 lines (`LINES` in `display.js`), so in-world panels look soft in
  the browser; the canvases themselves are sharp.
- The setting is still called PS1 WOBBLE (an option, not look; rename it when PS1 is dropped).
- Pre-existing, not changed: in the browser the radar and key line stay on screen during the trophy ceremony; the
  training card and the TRAINING banner overlap at kick-off of training.
- The bracket marks a shoot-out win as `0P` (as before).

## Needs a headset

1. Open the game, ENTER VR. Main menu: is the type crisp and readable at arm's length, does the glow read, any
   shimmer on the glossy bars as you move your head (mipmaps should stop it)?
2. SETTINGS: can you read every row and the hints at the bottom without leaning in?
3. WORLD CUP: the map pulse and the label; then the hub's group table, and in a knockout the bracket's smallest
   numbers.
4. In a match: the bug top left. Is it in view without being in the way, readable without turning your eyes hard,
   and is the angle right (it's on your face, so it never moves)? If it's too far out, move `bug.m.position` in
   `hud.js` in toward the middle. Kick-off banner, a goal banner, the subtitle (two lines on a long one), the pass
   tag with the number and LOB.
5. Watch fps in the menus while the prompts blink and on the world map (a 1024x768 upload with mipmaps 2 to 4 times a
   second). If it hitches, drop the blink there or the menu canvas to 768x576.
6. Training card, the dance lane on a hat trick, the trophy sign.
