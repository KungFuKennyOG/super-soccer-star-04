# Goal celebrations (branch `hattrick`)

Kenny: the hat-trick celebration should be "more modern (we can do our own celebrations)"; he chose **pick a
celebration**; then: "celebration possible for every goal imo". So the rhythm dance is gone and after **every goal
of yours** you can pick one of six celebrations; teammates join in, the beaten side trudges back.

## How it plays

- Your goal → its replay if replays are on (as before) → a small prompt in front of you ("Celebrate", or "Hat
  trick!"): six rows in the '04 menu style, a gold bar running down.
- Pick: stick up / down and **A or X** (browser: W / S and Enter), or strike a pose with your arms for 0.45 s:
  both arms out wide = Aeroplane, a hand by each ear = Cup your ears, one hand high over your head with the other
  down = Point to the sky. Never a trigger.
- Do nothing for 2.5 s and the highlighted one plays. The highlight starts one further down the list after each
  celebration, so doing nothing still gives a different one each goal. Moving the highlight buys 2 s.
- **B** (browser: C) skips at any point: during the prompt or mid-celebration, the restart follows 0.5 s later.
- The match clock doesn't run: it never ran while the ball is dead (`tickMatch`), and it is held for the whole
  celebration exactly as it is for a replay.
- Scoring: ordinary goals pay nothing new. A hat trick's celebration (3rd, 6th... goal), played to the end, pays a
  flat **+600** (the dance paid 75 or 150 a beat and 300 for a full combo: 0 to 1200). Skipping it pays nothing.
  A hat trick also gets the crowd's goal burst and roar a second time as the celebration starts, the "Hat trick!"
  title on the prompt, the HAT TRICK! banner with the bonus, and the commentator's old dance line ("He's got the
  moves!"). No new voice lines.
- Teammates' goals: no prompt; they celebrate as before (arms and jumps for 2.4 s). Training: none.
- With replays ON, the big screen and a small TV set off to one side of your view show the celebration live from
  the touchline with a whole-bodied you (the replay's copies). With replays OFF there is no picture.

How long from goal to restart (measured in the real game, headless, 30 steps a second):

| | replays off | replays on (replay not skipped) |
| --- | --- | --- |
| before this branch | 2.4 s | about 10.5 s |
| skipped with B at once | about 0.6 s | replay + about 0.6 s |
| picked at once | 5.0 to 6.0 s | + about 8 s of replay |
| nothing pressed (default) | 7.5 to 8.5 s | + about 8 s of replay |

(celebrations run 4.0 s: ears, point, backflip; 4.5 s: knee slide with room; 4.8 s: pile-on; 5.0 s: aeroplane; the
restart comes 1 s after.)

## The six

| | what you do | teammates | recorded / built |
| --- | --- | --- | --- |
| Knee slide | carried forward the way you face: a run-up, down on your knees, a slide that stops by friction (4.4 m/s², up to 4.6 m from 6.4 m/s; shorter if a line is near), kneel with both arms up, up through one knee. Your view drops 0.6 m and comes back | they chase you; one slides in on his knees beside you, the other arrives behind with his arms up | built (kneeling, slide, getting up). The teammate's arms: recorded (79_69) |
| Aeroplane | carried at 5.4 m/s where you look (turning at most 1.5 rad/s; it swings back toward the middle before a line) | follow in a V behind you, arms out, banking | legs: the recorded run strides as always; arms and banking built |
| Cup your ears | stand; a hand behind each ear, head turning end to end | either side ahead of you whipping up the crowd, arms swept from waist to overhead | built |
| Point to the sky | a few jogged steps and stop; one arm straight up, head back | one beside you with both arms up, the other pointing at you with a straight arm, fist pumping | built |
| Pile-on | down on your knees, arms open; view drops 0.5 m | one drops to his knees in front and to your left with his arms round you, the other bends over your back with a hand on each shoulder | built |
| Backflip | a standing backflip; your view goes up 0.55 m and down with your hips (never turned), you land 0.72 m back; your own boots are hidden while you're upside down | one cheers, the other follows you with a backflip of his own 1.1 s later | **recorded whole** (CMU 88_01); then arms thrown up, recorded (79_69) |

The beaten side (all six): they walk back toward their places at 0.7 to 0.95 m/s, some after standing a moment with
hands on hips or on their heads. Walking trunk, bowed head and hanging arms are recorded sad walks (91_13
"SadWalk", head down about 48°; 82_10 "sad walk forward") over their own walking legs; the standing poses are built.

No celebration is anyone's signature move; none is named after a player.

## Where things are

- `rules/celebrate.js` (new, pure, `tests/unit/celebrate.test.js`): the list, the prompt (`createPick`, `stepPick`),
  arm poses (`gestureFromHands`), each timeline, `carry` (your velocity), `mateTarget`, `oppTarget`, `slidePlan`,
  `roomAlong`, the backflip's numbers (`FLIP`, taken from the recording).
- `rules/sim.js` (**rules change, celebration only, ball dead**): `startCelebration`, `pickCelebration`; while
  `w.dead && w.celebrate` you are moved by `carry`, teammates and defenders by the targets above (a target may be
  `exact`: the teammate's backflip landing), and `stepSim` advances it. Nothing in live play changes; `resetPlay`
  clears it. `rules/dance.js` and its test are deleted.
- `game/cheers.js` (new): every pose, `viewDrop` (how far your eyes move), `cheerOf`, `tests/unit/cheers.test.js`.
- `game/celebration.js` (rewritten): the prompt, the caption telling you what to do with your arms (headset only),
  the flow. `game/actors.js`: `animate()` calls `cheerPose` last (after a left-footer is mirrored back); its sixth
  argument is now "a celebration is on" (nobody watches the ball). `game/poses.js`: `dancePose` removed, `ride`
  exported. `game/replay.js`: `cut()` (the live picture), `showing`, `ghosts`. `game/music.js`: the dance track removed.
- `game/main.js`: `cheerNext` (was `danceNext`), the rig's height follows `viewDrop` (eased), hooks
  `__sss.celebrate(hat, delay)`, `__sss.celebration.pick(world, id)`, `__sss.models`, `__sss.replay`.
- `tools/build-anim.mjs`: `joy` (79_69, 0.85 to 4.25 s), `flip` (88_01, 0.13 to 1.3 s), `sad` (91_13), `sadB` (82_10).
  Clips file 421 KB → 548 KB.
- `tools/cheerfilm.mjs`: a scene for `tools/filmgame.mjs` (cherry-picked from branch `trailer`, commit d1d4474, with
  its `?film=1` hook in `engine/loop.js`): `KIND=slide VIEW=eyes|side|front|back|high AT=x,z YAW= HAT=1 PROMPT=1
  PICK=default|skip node tools/filmgame.mjs tools/cheerfilm.mjs out`. Side views swap in the replay's whole-bodied
  copies, so you are seen.

## Measured (`tests/unit/cheers.test.js`, bare skeletons moved by the real sim)

- Nothing under the grass in any of the six (lowest joint 0.9 cm above it: the ball of the foot in the backflip's crouch).
- Knee slide: knees 4 to 7.5 cm (the joint's own depth) off the grass throughout; standing again at the end.
- Backflip, you and the teammate: hips to over 1.3 m, head below hips; before take-off and after landing the ball of
  a planted foot moves under 0.7 m/s (it drifts about 3 cm in the last 0.07 s as he goes up on his toes: the
  retargeted boot is stiff where a foot bends).
- Pile-on: their hands within 36 cm of one of your shoulder joints (round your back), no two heads within 24 cm.
- Ears and pile-on: your feet move under 5 cm/s.
- Your view: at most 5.7 cm a frame (the drop onto your knees: 0.6 m in 0.22 s) and 12.7 cm a frame in the backflip's
  take-off (the recording's hips: 0.54 m in 0.1 s); the page eases it further. Level again at the end of each.
- Rules: you never leave the pitch, your speed never jumps (except leaving and landing the flip), nobody ends inside
  anybody, defenders never exceed 1.2 m/s.

Cost: no new draw calls or triangles on the pitch. The live picture is the replay's own pass (256x144, every third
frame in the headset) with its seven copies posed every frame while a celebration is on. The prompt is one 512-wide
canvas redrawn about 16 times a second while it's up.

## Short of real / guesses

- Sources: the knee slide, pile-on, ears, point and aeroplane are built from how they're done, not from footage I
  could study frame by frame (one coaching page was readable: slide on the front of the knees and shins, legs a
  little behind, arms for balance, wet grass; the others I tried returned nothing). The slide's friction is a
  physics estimate.
- Knee slide: the drop is a 0.22 s blend from a running stride to kneeling, not a recorded drop; shins and insteps
  are flat at once. The teammate "sliding in" kneels over his last metre or so while the sim's easing brings him
  to rest: it is not a second planned slide. The other teammate only arrives behind you; nobody jumps on the slider.
- Getting up (slide, pile-on): right foot through, stand, left foot follows; the last 0.15 s blends to the standing
  pose and the feet can shuffle up to about 10 cm.
- Pile-on: it's a three-man huddle (the side has you and two teammates), not a heap, and nobody leaves the ground.
  The hugging arms are near straight. From the side the three bodies overlap a little as you all get up.
- Aeroplane: no lean of the whole body into the turn from the feet beyond what the run already has; the arms sit
  about 10° above level.
- Backflip: one take, so yours and the teammate's are identical; it blends in over 0.14 s from however you stand.
- Beaten side: they walk straight through the celebration if their places are beyond it; no collision avoidance.
- The ball stays wherever the sim left it (in the net after a real goal).
- The prompt shares A with knock-on and B with drag-back: harmless while the ball is dead. In the browser the keys
  are W / S, Enter or Space, and C or Backspace to skip.
- The CMU "joy" take stands with hands at his chest between throws; only the two throws are played, crossfaded.

## Not seen in a headset (nobody could check here)

- The view moving: the drop onto your knees, the slide at 6 m/s at knee height, the backflip's hop (up 0.55 m, back
  0.72 m in a third of a second, no rotation), the aeroplane steering by where you look.
- Arm poses as picks: thresholds are from arithmetic on grip positions relative to the headset (ears: each fist 7 to
  30 cm out from the head's middle, within 16 cm of eye height; wide: fists over 0.5 m out each side; sky: one fist
  22 cm above the eyes, the other 25 cm below them). Whether hands at your sides ever misfire, or ears is hard to hit.
- The prompt's size and place (1.0 m wide at 2.1 m, 24° to the right of where you look and 0.3 m under your eye line, so it clears the goal banner and the subtitle), the caption, the live TV set (0.5
  scale, 54° to your left, a little low).
- Faces close to yours in the pile-on (the kneeling teammate's head passes your left shoulder about 0.3 m away),
  the other's forearms over your shoulders, near-plane clipping.
- Frame rate with the live picture on.
