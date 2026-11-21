# Notes: the '04 menus and HUD (branch `ui`)

Second pass. Kenny on the first (glossy blue bars, amber glow, condensed italic type): "that's ugly as hell". His
reference is the front-end menu of a 2003-04 console football game. Everything was restyled to that language, taken
as a style and never its content: no publisher or game logos or names, no real shirt, sponsor or crest. Screens,
options, input and flow are as they were; `rules/` is untouched.

## The look (all in `game/ps2/ui.js`)

- Letterbox. A solid black band across the top (16% of the height) holds the title, set in heavy upright white sans
  with a faint silver gradient, left-aligned after our own mark: a gold star on maroon inside a silver ring. A solid
  black band across the bottom (20%) holds the button hints (a round outlined glyph and a plain white label, like
  "(A) Select   (B) Back") and a status line with a small red ring in front of it.
- The middle band is a picture (`game/ps2/menuscene.js`): our own '04 stand, pitch and lines in daylight on the
  left, and on the right a close crop of one of our '04 players' shirt (`buildPlayer2`: our kit sheet with the
  invented shield, no wordmark). It's rendered once per kit into a render target, read back into a canvas, blurred,
  desaturated and washed toward light grey. Before a team is picked it wears Munich's red; after that it wears your
  team's kit. The title page uses the same picture.
- Lists are one compact bordered box. Rows are near-black at 76% opacity, 2 px apart on light grey separators,
  with a 2 px light outline and 6 px corners. Type is plain bold white, upright and mixed case, at a fixed indent.
  The picked row is flat maroon (#962c25 to #6e1c19), with the A glyph at its left and small gold up/down arrows at
  its right. Option rows show gold left/right arrows round the value instead. Small gold stars are the markers
  (team strength, the top two in a group).
- Palette: black, white, greys, that maroon, gold accents. No gloss, glow, italics, squeezed type or flares.
- Mixed case comes from the game's upper-case strings through `tc` (title case) and `sc` (sentence case). Kept as
  they are: words with digits, single letters (button names), VR, PTS and PS1. Words of team names keep a
  capital ("V Munich"). In result lines team ids stay upper case.

## Screens

- **Mode select:** the five modes as rows, a little right of middle. The picked mode's description goes on the
  status line.
- **Settings:** two boxes. Game settings sit on the left; on the right is the Locker (a dim header row, then Ball,
  Boots, Big Heads). Values sit at the right of each row, with arrows on the picked one. Up and down move through
  both boxes in the same order as before.
- **Team select:**
  - World Cup: the map fills the middle band in a dark outlined box. Nations are small kit-coloured pins; the picked
    one has a maroon pin, a pulsing white ring and a maroon label. A single picked row at the bottom left shows
    the flag, name and stars.
  - Clubs: a stack showing the club with its shield and id (◀ ▶ round the id), its strength stars, its rating
    and "n of 17".
- **Cup hub:**
  - Groups: a table in a stack. The header row is dim; your team's row is maroon; the top two have a gold star.
    The other results sit in a box under it.
  - Knockouts: the bracket as small outlined dark boxes with light connector lines. Your team is maroon, losers
    are grey.
  - The status line reads "Next: ENG v GER, Germany · Continues 3", with hints "(A) Play (B) Quit to menu". The
    old blinking "PRESS A TO PLAY" is now a plain hint (A still plays).
- **Messages** (full time, cup results, training done): a centred outlined box with a maroon edge, lines in
  sentence case, and the A hint saying what it does ("Try again", "Lift the cup", "Menu", "Continue").
- **HUD:**
  - Scoreboard bug: flat and small. A dark translucent bar with a thin outline: chip, id, the score in a maroon
    cell, id, chip, then a divider and the clock (maroon "GOAL!" when you score). Points sit in a small box under
    it.
  - Banners: a dark bar with the headline, which is maroon when it's yours and red text when it's bad. Sub-lines
    go in a box under it.
  - Pass tag: the number on a dark tag, with "number | Lob" on lobs.
  - Subtitles: a dark outlined box, up to two lines, sentence case.
  - Training card: a dark box with a maroon title row ("4/19 Knock-on ... (X) Skip"), the instructions, and a
    maroon progress bar.
  - Also restyled: the radar, the dance lane, the trophy sign, the REPLAY tab and the stadium board.
- **Title page** (`index.html`): the same bands and picture. Enter VR and Play in Browser are a row stack (maroon
  with the A glyph and arrows on hover or focus). How to play is an outlined box with a maroon header row. The
  bottom band holds hints and a status line ("Press start", best score). No downloaded fonts.
- **Kick-off overlap (fixed):** the banner now sits a little above where you're looking (pitch clamped to
  -0.35..0.12 rad) instead of a fixed +0.35 m. In the browser, whose camera looks down, it was sitting on the
  stadium board. In the headset it's where it was when you look level.

## The year

`YEAR` in `game/ps2/brand.js` is `'04` (Kenny hasn't decided). It sets the title on the page and the menus, the
tab title, "World Cup '04" and the PS1 trophy plate.

## Numbers

- Backdrop: built and rendered once per kit. In headless software rendering it took 1.2 to 7 s, most of it
  building the player and painting his sheets. On the Quest expect a few hundred ms: once at boot (title page) and
  once each time you return to the menus with a new team. It's a 1024x492 render target plus a 2 MB readback, then
  cached. One extra scene (stand x2, pitch, lines, sky, the player) lives in memory, never drawn in play.
- Menu canvas: 1024x768 on the 2.2 x 1.65 m panel. It's repainted and uploaded only on input, plus 4 times a
  second on the world map for the pulse; nothing else blinks now.
- Paint times (headless): menu screens 2 to 10 ms, HUD pieces 0.5 to 3 ms.
- Legibility at headset size (11 px per degree; `*-vr.png`): menus at 505 px across, where row type is about
  14 px and hints and status lines about 13 px. Banner, subtitle and training card are at 480 to 527 px. The bug
  is 259 px with 18 px names and score; its points strip is the smallest thing, at about 14 px.
- Draw calls: unchanged from the first pass (the bug is +1 in the headset during play).

## Pictures

- **Side by side with the reference:** `/home/claude/ui-shots/compare-final.png`. This is outside the repo,
  because the reference is someone else's screenshot.
- **Before:** `docs/ui-shots/before-*.png`.
- **After, flat:** `after-mode.png`, `after-settings.png`, `after-worldmap.png`, `after-club.png`,
  `after-group.png`, `after-bracket.png`, `after-fulltime.png`, `after-hud.png`.
- **After, at headset size:** `after-mode-vr.png`, `after-settings-vr.png`, `after-bracket-vr.png`,
  `after-hud-vr.png`.
- **After, in the game:** `after-game-*.png` (title, menu, settings, worldmap, clubselect, group, bracket,
  match-kickoff, goal-banner, replay-crt, dance, fulltime, ceremony, training).

Remake them with `node tools/uishots.mjs dir` (flat, `KIT=TEAM` for another shirt) and `node tools/uigame.mjs dir`.

Honest comparison with the reference:
- Same: band proportions, row stack, outline weight, maroon pick with glyph and arrows, hints and status line,
  and a backdrop with a shirt crop on the right.
- Ours is darker in the stands (the '04 stand is under a roof) and the shirt crop is less tight.
- Our title is upright where theirs leans slightly, as asked.
- Our rows are a little taller and the type bigger than theirs, for the headset.

## Short / not done

- The turntable plinth and the replay screen's casing are still PS1 shapes, recoloured only. The pass and power
  rings and the reticle are unchanged.
- The browser still renders the 3D at 480 lines, so in-world panels look soft there.
- Training instructions are cased as one text, so a line that starts a new sentence without a full stop starts in
  lower case ("W A S D to run / the ball stays at your feet").
- The setting is still called PS1 Wobble.
- Fonts: Roboto is assumed on the Quest browser (the fallback is Arial / sans-serif).

## Needs a headset

1. Menus: is the type crisp at panel distance? Does the backdrop read as a soft stadium and shirt, or as mush?
2. Is there a hitch as the backdrop renders: at boot, and when you come back to the menus after picking a team?
3. World map and the bracket: can you read the smallest numbers?
4. In a match: the bug top left (readable, not in the way?). The kick-off banner: does it now sit under the board
   when you look level and when you look down at the ball? Also check the subtitle, pass tag and training card.
5. FPS while on the world map (4 uploads a second).
