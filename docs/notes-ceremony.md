# Trophy presentation (branch `ceremony`)

Kenny: "make it more modern ... and def more realistic (have the players behind us while we lift the trophy on a
stage like in real life)". The plinth-on-the-grass ceremony is replaced by a staged cup presentation.

## What exists

- `game/ps2/stage.js`: the stage. A carpeted platform 9 x 3.7 m, 0.5 m high, a riser 0.4 m higher behind it, a
  backdrop board 4.3 m tall with angled wings (step-and-repeat of the game's own mark and name, `WORLD CUP '04` /
  `CHAMPIONS CUP '04` and `CHAMPIONS` across it), a fascia along the front, a carpet apron, a line of boards, 15
  photographers as flat cards (front toward you, a back view toward the stands), two confetti cannons, four pyro
  units. One mesh, one 1024 sheet painted in code, 236 triangles, 1 draw. Red and gold for the World Cup, navy
  and silver for the Champions Cup.
- `game/ceremonycast.js`: the squad. Eight players in your kit (no. 1 in the keeper's), medals on (ribbon and
  disc, one instanced draw for all eight), four on the platform and four on the riser. Waiting: clapping,
  bouncing on their toes, the two in the middle of the back row with an arm round each other, all watching the
  cup. Hands on the cup: quicker, some change over. Cup over your head: each goes off 0.1 to 0.6 s after it
  (jumping with both arms up, reaching on the toes, hopping with a fist pumped, the linked pair bouncing together),
  and the two inside men of the front row walk forward to stand either side of you (1.45 m out, half a metre
  behind your shoulders). Lower the cup and after 2.5 s they settle back to clapping; raise it and they go again.
- `game/ps2/confetti.js`: confetti (1,100 foil strips in your colours, white and gold, three blasts from the two
  cannons then falling from above, lying on the stage and grass where they land; lit by the scene's lights; one
  draw, all motion in the vertex shader), spark jets at the four corners (5.5 s the first time, 3 s every time the
  cup goes up again; one additive draw), camera flashes (the photographers' lenses plus about 420 seats sampled
  from the stadium's own fan cards; one Points draw, busier while the cup is up).
- `game/trophy.js`: the ceremony. Same grab and lift as before (each grip takes the hold on its side, the cup
  follows one hand or turns with two, the lift counts with a holding fist 12 cm over your eyes, after 20 s A
  continues anyway, 6 s after the lift A continues). New: the stage stands at a fixed place (your mark at x 0,
  z -13, facing the goal end with the big screen and the home curva); as it starts you are put on your mark once
  (rig turned so the way you are looking is the front, moved so your head is over the mark, raised 0.5 m onto the
  platform) and the rig is not touched again, so real steps still work. The plinth is 0.6 m in front of you as
  before. The hint card is now a small '04 plate floating over the cup (0.36 m wide), gone when you take hold;
  it comes back for `A CONTINUE`. A front light (television lights) is added while the ceremony runs so faces
  turned to you aren't in their own shade. Browser: Space or E takes the cup, W / Up raises it, S / Down lowers.
- The crowd's goal celebration is held throughout and set off afresh every time the cup goes up
  (`stadium.cheer`); the stadium board shows CHAMPIONS (one changed line in `game/main.js`).
- Sound (`game/audio.js`): `fanfare` (our own short brass call on the lift, then the existing `champions` tune
  1.9 s later), `cannon` (thump and hiss), the crowd's roar re-swelled every 3.2 s while the cup is up.
- `tools/ceremonyshots.mjs`: stills and film from the real game (your eyes and free cameras), planted-boot
  speeds with `MEASURE=1`. `engine/loop.js` got the `?film=1` hook, the same lines as branch `trailer`.
- `tests/unit/ceremony.test.js`: the takes loop, stand on their spot, mirror correctly.

## Recorded, built, guessed

- Recorded (CMU, baked by `tools/build-anim.mjs --set cheer` into `game/assets/anim/cheer.js`, 20 poses a second):
  clapping and the giddy bounce with hands at the chest (80_43 "happy"), both arms overhead on the toes with small
  jumps (14_07 and 13_10 "jump up to grab, reach for, tiptoe"), jumps and hops in place (49_03, 49_02 "jump up and
  down", used for legs). The walk forward is the game's captured gait through `animate()`.
- Built: which legs go with which arms (e.g. 49_03's jumps under 14_07's arms), the fist pumped overhead (arm IK,
  about two a second), the arm round a teammate (arm IK onto the other man each frame: the left man's over the
  shoulders, the right man's lower round the back so they never cross), heads turned to the cup, clap height
  lowered by 8 to 24 cm per man (the take claps at the chin; everyone doing that looked like praying), hands kept
  13 cm apart (the take's arms on our wider shoulders crossed at the wrists), planted boots pinned to their spot
  and legs re-bent to it, who does what when.
- Baked but not used: 79_69 "very happy". On our skeleton it reads as a shrug with hands on hips and its upper
  arms flip (1.1 rad in a frame).
- The library has no hugging, no group celebration, no trophy lift. Nothing is taken from one.
- Guessed: the staging itself. A web search for how presentations are staged gave nothing usable (news pages);
  the layout (low podium, riser, backdrop, cannons at the sides, gerbs at the corners, photographers kneeling and
  standing behind a line in front) is from general knowledge of 2000s finals, not from a source.

## Numbers (headless Chrome, software GL: no fps)

- Whole frame in the ceremony: 53 to 55 draw calls, about 163,000 to 166,000 triangles (the stadium is most of it).
- Added by the ceremony: stage 1 draw / 236 tris; squad 8 x (kit + head + flat shadow) = 24 draws and 8 soft
  blobs, 50,400 to 51,300 tris for the eight bodies (drawn twice with the shadow pass); medals 1 draw; confetti 1
  draw / 2,200 tris; jets 1 draw / 880 tris; flashes 1 draw (about 435 points); cup 3, plinth 3, prompt 1.
  The six match players are hidden meanwhile.
- Planted boots (toe within 7 cm of the floor on two frames running), 6 s through the lift: median 0.000 to
  0.002 m/s for all eight; nine frames in ten under 1 cm/s for the two outer front men, under 13 cm/s for the
  linked pair and no. 11, 45 to 73 cm/s for no. 5 and the two walkers (those frames are boots leaving the floor
  in a jump, the walk itself, and the 0.35 s they take to change from walking to celebrating, where feet do slide).
  Before the pin the medians were 6 to 15 cm/s.

## Short of real

- Before the lift five of the eight are clapping or have their hands together: it is one clap take and one
  "giddy" take at different heights, rates and mirrored. More variety needs takes the library doesn't have.
- Raised arms look much darker than faces at night (their undersides face the dark half of the sky light).
- The two walkers snap a little as they arrive (walk to celebration over 0.35 s) and ignore where you really are:
  if you have walked a metre and a half sideways one will stand in you.
- Nobody touches you or the cup, nobody hugs; the linked pair's lower arm is out of sight behind them, unchecked
  from behind.
- Seen from the stands there is no "you": the cup floats with two hands on it (nobody but the test camera sees it).
- The players' flat shadows fall on the floor they stand on and run off the edge of the riser in mid-air.
- Confetti doesn't land on people or the plinth (it passes through them) and comes round again every 13 to 18 s.
- Jets and flashes give no light to anything. Photographers are still cards; they don't move.
- No handshake line, no presentation party, no captain being handed the cup: it waits on the plinth.

## Nobody could check without a headset

- fps on the Quest 3 with eight '04 players close to you plus the stadium; the hitch when the ceremony starts
  (eight players are built and the added light recompiles the lit materials).
- That being raised 0.5 m onto the platform feels right, that the mark and facing are right after the one-off
  placement, and that the plinth is still in reach.
- The whole VR grab path: it is the old code moved into the new frame, exercised only through the browser keys.
- The prompt's size and place over the cup, confetti and jets in stereo, flashes (point sprites) in stereo.
- Sound levels of the fanfare and cannon.
