# Trailers (branch `trailer`)

Two videos made from the game itself, 1920x1080, 30 fps, H.264 + AAC: a cinematic trailer and a gameplay trailer.
The videos and everything used to cut them (scene scripts, music synth, edit scripts) live outside the repo in
`/home/claude/trailers/`. What's in the repo is only what films the game:

- **Film hook** (`engine/loop.js`): with `?film=1` in the URL the loop doesn't start on the wall clock;
  `window.__sss.loop.step(dt)` runs exactly one frame of `dt` seconds. Without the query nothing changes. It doesn't
  touch the rules; the sim just gets a fixed step (1/30 s while filming).
- **`tools/filmgame.mjs`**: films the real game (`index.html?film=1`) in headless Chrome a frame at a time as JPEGs.
  It also makes `performance.now` and `setTimeout` follow the film's clock (so subtitles, banners and timed lines
  last as long as they do in play), `SEED=n` swaps `Math.random` for a seeded one, and `DRY=1` runs a take without
  drawing (seconds instead of minutes) to check a scripted attack scores before filming it. A scene file drives it
  (`f.run(secs, perFrame)`, `f.skip`, `f.to(dir)`, `f.still(name)`); the player is driven with the browser keys and
  mouse-look (`desk.keys`, `desk.yaw/pitch`), so the HUD (pass ring, shot aim, call arrow) is the real one.
- **`tools/trailerlook.js`** (hooked into `tools/ps2look.html` with two lines): `&arena=TEAM` plays any look-page
  shot inside a real ground (`game/ps2/stadium.js`) with moving cameras: `&cam=orbit|track|path` (see the file),
  `&goal=` / `&net=1` for the crowd going up and the net bulging. Its `&place=x,z` puts the page's stage on the pitch.
- **`tools/ps2shots.mjs`**: `DT=` (seconds per filmed frame, for slow motion) and `JPG=1`.

What's real game and what's the look page is listed in the trailer report. Not seen in a headset: nothing here
changes play; the film hook is off unless the URL asks for it.
