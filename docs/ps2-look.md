# The '04 look and the new animation: where it stands

Status, 20 Nov 2026. This repo began as a copy of `KungFuKennyOG/super-soccer-star-96`, branch `ps2-look`, at commit `2d10bb1` (draft PR #3 there). `CLAUDE.md` has the detail; this is the summary for picking the work up.

## What Kenny asked for

- A graphical overhaul toward FIFA Football 2004 on PS2, judged against three screenshots he supplied (not in the repo: they show real players and brands).
- No real badges, sponsors, kit-maker logos, EA/FIFA branding or player likenesses. Take the style, not the content.
- Same game: VR for Quest 3, 3 v 3 plus a keeper on a half pitch. "VR is the focus." An 11 v 11 flat-screen version is a later idea, not this work.
- 72 Hz on a Quest 3, measured.
- Look test first, honest comparisons, rollout only once he says the look is good.
- Later he widened it: redo the bodies, overhaul the animation system ("stiff as hell", then "could be 10000x better"), add a light physics layer.

## What exists

- **PS2-look players, pitch, stand, ball** in `game/ps2/`, seen through the test page `tools/ps2look.html` and rendered headless by `tools/ps2shots.mjs`. Not wired into the game (`game/main.js`) yet: the game itself still draws the PS1 look.
- **Bodies**: 5,900 to 6,500 triangles on the game's own skeleton. Three passes; after the third (tucked shirt, longer shorts, sloping shoulders, real hands) Kenny: "good work". Round collars only, tight at the throat (his call).
- **Animation** (drives the PS1 bodies too):
  - walking, jogging and running forward off the ball are motion capture (CMU mocap library), stretched to the game's ground speed, with the ball of a planted foot pinned to the pitch;
  - a sprint drive on hard acceleration (body pitched forward, straight push leg, knee drive, pumping arms). Kenny's reference was a photo of a player taking off; his verdict: "that is actually really good";
  - a rebuilt procedural gait for everything else: standing, side-steps, backing off, turns, braking steps, defenders jockeying, first-person boots;
  - springs on trunk, arms and shoulders for weight; shorts and sleeves that move slightly.
- 178 unit tests and the 3 smoke tests pass. The boot is still on the ball to the centimetre on strikes and touches.

## Kenny's feedback, in order

1. Necks too long, bodies not realistic, "built from tubes" → body rebuilt.
2. "Something is off with the bodies", "stiff as hell" → proportions pass and animation overhaul.
3. Procedural animation "could be 10000x better" → motion capture.
4. First captured clip: "so much wrong with it"; the sprint start should look like a real take-off; "why does he have broken wrists" → sprint drive, captured wrists dropped.
5. "That is actually really good."
6. No V-necks; expose the neck less → done.
7. Hand-built standing is fine for now (the library's standing takes were unusable).
8. Cloth movement: shown side by side, barely visible; he left the call to Claude: kept, no more time on it.
9. "Everything right-footed" → about three outfield players in ten are now left-footed and do everything with the left boot.
10. Asked whether tricks, moves and dribbling got the realistic treatment: not the legs (see below).

## Still short (told to Kenny)

- Cuts have no plant-and-push on the outside foot; a stop ends with the feet easing into place.
- **Running with the ball is on the captured strides now** (`game/dribblecap.js`: quick short steps when slow, the boot steered onto the ball for every touch, laces at pace and the inside at a walk; details and what is still short in CLAUDE.md, "Running with the ball"). The kicking leg and every trick are still the earlier hand-built poses, laid over that stride.
- Side-steps are procedural, not captured. Each player uses one foot for everything (no weak-foot strikes); you are right-footed.
- Sprint sleeves wing out when the arm swings far back.
- Faces are painted and clean where FIFA's are photo-derived; everyone shares one skull shape.
- Standing is hand-built: stance, weight shift, breathing, hands on hips.

## Not done

- **Nothing has been seen in a headset or measured on a Quest.** Every judgment so far is from a flat camera on a software renderer.
- Wiring the look into the game: players in `main.js`, keepers and gloves, first-person boots and hands, every ground in `grounds.js`, rain and snow, replays, a far-distance LOD if fps needs it.
- The keeper's animation is untouched.

## Decisions

- Decided 20 Nov: the new look and the new animation live only in this repo. The '96 repo stays exactly as it is; its PR #3 was closed unmerged (the `ps2-look` branch is still there).

Still open:

- The name on the title screen and logo still says '96.
- Hosting: GitHub Pages isn't set up for this repo.
