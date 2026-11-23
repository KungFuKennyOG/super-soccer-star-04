# Trophy presentation (branch `ceremony`)

Kenny: "make it more modern ... and def more realistic (have the players behind us while we lift the trophy on a
stage like in real life)". The plinth-on-the-grass ceremony is replaced by a staged cup presentation.

## What exists

- `game/ps2/stage.js`: the stage. A carpeted platform 9 x 3.7 m, 0.5 m high, a riser 0.4 m higher behind it, a
  backdrop board 4.3 m tall with angled wings (step-and-repeat of the game's own mark and name, `WORLD CUP '04` /
  `CHAMPIONS CUP '04` and `CHAMPIONS` across it), a fascia along the front, a carpet apron, a line of boards, two confetti cannons, four pyro units (the photographers were flat cards here at first: see the
  second pass below). One mesh, one 1024 sheet painted in code, 1 draw. Red and gold for the World Cup, navy
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

## Second pass (branch `ceremony2`): medals and photographers

Kenny: "the medals are weird on the players and the photographers should be real models imo".

### Medals (`game/ps2/medal.js`)

What was wrong with the first ones (`docs/ceremony-shots/medal-before.png`): a stiff white V stuck to the chest
bone, standing a centimetre or two off the shirt, starting half way down the chest with nothing round the neck,
its two strips tapering like blades, a flat ten-sided coin fixed at its point; it turned as one piece with the
chest, and hands went through it.

Now: a ribbon 3.6 cm wide round the back of the neck, over the shoulders beside the collar and down the chest in a
V to the breastbone, with a gold disc 6.6 cm across (rim, raised star, a loop at the top) hanging from the point.
- The ribbon is laid on the player's own body: each of its points is dropped onto the nearest triangle of the
  shirt in the bind pose, lifted 4.5 to 9 mm, and given that triangle's skin weights. So it goes exactly where the
  collar, shoulders and chest go. Colours: whichever of white, the kit's second colour and its shorts stands out
  most on the shirt, with the shirt's colour as one stripe down the middle.
- The disc is skinned to the same spot and turned about the ribbon's point in the vertex shader by a small pendulum
  (per player, driven by how the chest is accelerating): side to side up to 40 degrees, and lifted off the chest up
  to 45 degrees when he drops away under it. It can only lift outward, never into him.
- One small skinned mesh per player on his skeleton (146 triangles, 1 draw each; the first version was one
  instanced draw for all eight).
- Looked at (`medal-after-front-side-back.png`, `medal-after-film.png`: every sixth frame through the jump): on
  the shirt from the front and side, round the neck from behind, the disc swinging and never inside the body, no
  clipping with arms raised. Not solved: a man clapping or with his hands together at his chest has his hands and
  wrists in front of the medal and now and then touching the ribbon (the take puts his hands there).
- Built, not captured. The pendulum is a guess at how a 50 g disc on a ribbon moves, tuned by eye.

### Photographers (`game/ps2/press.js`, `game/presscast.js`)

The 15 flat cards are gone from the stage's mesh. Seven people now, on the carpet between the platform and the
boards, 2.5 to 3 m in front of you: three down on one knee, four standing in the gaps behind them, two of those
holding the camera up over their heads.
- The '04 body with its kit sheet painted as working clothes: one dark cloth for jacket, trousers and shoes (the
  sheet's "skin" is that cloth too, so arms are sleeves and knees are trouser legs), and a hi-vis tabard in one of
  four invented colours with PHOTO and a number on the back, a small PHOTO and the number on the chest. Their own
  faces and hair. Three wear a cap.
- A modelled camera each (body, grip, prism, a long pale lens with a dark hood, a flash on top), all seven in one
  instanced draw; the caps in another; their soft shadows in one.
- Poses are built with IK from how the job is done (no photographer in the mocap library): on one knee with the
  other foot flat in front, back upright, elbows down and in, right hand on the grip, left under the lens, the
  camera at the eye; standing with feet apart and one ahead; overhead with both arms up and the camera tipped
  down. They turn and tilt to keep the cup in frame (so they all follow it up when you lift it) and shift a little.
  The flashes come from their flash units.
- Honest: the hands are in the cloth's colour (they read as gloves); the legs are the football body's, so shorts
  hems and sock tops show in the cloth as seams; fingers don't wrap the grip or the lens (the hand just follows
  the forearm to it); they never lower the camera, change place or stand up; no flat projected shadow, only a
  soft blob each.

### Numbers (headless Chrome, no fps)

- The whole ceremony frame is now 63 to 77 draw calls and about 200,000 to 213,000 triangles (it was 53 to 55 and
  163,000 to 166,000).
- Photographers: 17 draws (7 x kit + head, cameras, caps, shadows), about 46,100 triangles.
- Medals: 8 draws, 1,168 triangles (was 1 draw).
- The stage's mesh is down to 176 triangles.

### Not checked

- fps on the Quest with fifteen skinned people in view at once. If it is short, the first things to cut are two of
  the standing photographers, or the squad's flat shadows (8 draws, about 51,000 triangles).
- The Champions Cup at night was still not rendered; World Cup night and Champions Cup day were.
- The exit back to the menu was re-checked on the World Cup night run only.
- `tools/ceremonylook.html` (LOOK=1 in `tools/ceremonyshots.mjs`) is a quick page without the stadium for
  looking at the squad, medals and press; its lighting is the day or night lights but not the stadium's.

## Third pass (branch `ceremony3`): photographers' clothes and life, the silver cup's reflection, claps and medals, the celebration prompt

No rules changes. Shots and films: `docs/ceremony-shots/c3-*`.

### Photographers (`game/ps2/pressfigure.js`, `game/ps2/press.js`, `game/pressact.js`, `game/presscast.js`, `game/pressfeet.js`)

Kenny: built on the footballer, so shorts hems, sock tops, football boots and black hands (gloves).
- Clothes: the body builder takes a `dress` (`figureGeometry(style, gloves, dress)`, a few lines in `figure.js`; `arm()` in
  `limbs.js` takes `{ long, shut }`). A photographer's is `PRESS_DRESS`: trousers as one garment from the waist to a hem on
  the shoe (no hem at the knee, no sock top), plain shoes (the boot's loft with a rounder toe; painted with a flat dark sole
  and a welt, no studs), a jacket whose sleeves run to a cuff at the wrist, bare hands in his own skin tone. The right
  hand's fingers are closed 1.4x (round the grip), the left's opened to 0.6x (cupped under the lens). Trousers in five
  cloths (charcoal, khaki, black, stone, denim), three shoe leathers. Footballers are untouched (same geometry cache keys).
- Hands on the camera: each hand is turned so its palm lies on its place (right: flat on the outside of the grip, fingers
  forward round its front, thumb up behind; left: palm up under the barrel, fingers along it and up the far side) and the
  arm is bent to that wrist; the fingers are then swung on the palm toward the line of the forearm so the wrist isn't bent
  sideways past what a wrist does. Both hands stay on the camera in everything he does.
- Alive (`pressact.js`, pure, `tests/unit/pressact.test.js`): each shoots for 2.5 to 6 s, then one of: drops the camera to
  his chest and looks down at the screen for 1.3 to 2.4 s; swings off the cup to one of the squad and back; leans out to one
  side for a few seconds (standing men); the two overhead men come down to the eye or go back up. All the time: a small
  quick re-framing every 1 to 3 s, weight from one leg to the other every 3 to 8 s. The right-hand kneeler gets up (1.15 s,
  over his front foot, the back foot brought through, camera down while he does) for the lift and now and then on his own,
  and goes down again. Two of the back row change places every 26 s (first after 5 s): cameras down, side-stepping, one
  going round behind the other; a standing man's feet stay where they were put down and step after him (`pressfeet.js`).
  When the cup goes up everyone is back on it 0.1 to 0.5 s later and nobody checks a screen for 3.5 to 6 s.
- The boards behind them moved back 0.6 m (z -3.9) to give the back row room to pass.
- Built, not captured (the library has no photographer). From: camera makers' how-to-hold guides (Nikon: left hand cradles
  the lens from underneath, never over the top; elbows propped against the torso; one foot half a pace ahead), a press
  photographer's account of working in a pack (waiting, competing for a clear view, reviewing on the camera's screen), and
  general knowledge of photocalls (front row low, back row over the top, "Hail Mary" overhead). Timings are guesses.
- Measured (`LOOK=1 MEASURE=40 node tools/ceremonyshots.mjs out club MAD day`, 40 s with a lift in it, every frame): arms
  inside the trunk (as an oval column) at most 0.2 to 2.4 cm for six of them (elbows against the ribs while the camera is at
  the chest: the sleeve is 6.6 cm thick there and the measure counts it) and 4.9 cm for the man getting up, for a few frames
  as he goes back down with the camera coming up; inside the head 0.2 cm; inside the camera 0.1 cm (forearm against the
  barrel). Nearest two men: 0.55 m apart (the two passing).
- Short: a photographer still has the footballer's tucked-in waist under the tabard; trouser knees are a bent tube (they
  pinch on the kneelers); the hand on the grip has its wrist bent back about as far as a wrist goes; fingers are closed in
  the mesh, so they don't open when the camera comes down; side-steps are a shuffle with the knees apart, not a recorded
  walk; the man getting up has no hand to push off with; nobody turns his head to talk or looks at you; no straps, bags or
  second camera bodies; soft blob shadows only.

### The silver cup's blotch (`game/ps2/trophymat.js`)

It was the painted stadium the metal reflects: near-black stands with a thin pale line of ad boards through them. The
cup's belly is a convex mirror, so everything behind you came out a few centimetres across: a black patch with a ring in it
(`c3-silver-before-look.png`, Kenny's "lips"). Now the stands and the far pitch are one soft mid tone (0.33 by day), the roof edge is
a glow not a line, the crowd has almost no grain and the pitch no mown stripes (squeezed small they were a row of teeth).
The sky is still three times brighter than the stands, which is what reads as metal. A second picture for floodlit nights
(dark sky with haze over the roofs, hotter lamp banks, lit stands and pitch): `trophyTime(night)`, called as the ceremony
starts; the night picture is painted and filtered the first time it's needed (a hitch of its own, unmeasured on a Quest).
Looked at from your eyes before and after the lift, from the stands and on the quick page, both cups, day and night: no
blotch; the gold cup is as it was by day and a little deeper at night. Honest: the silver's belly is now a soft pale grey
with a faint darker oval where the stands are; it is less mirror-like than the lid. Only real reflections (a cube camera
at the ceremony) would put the squad and the carpet in it; not built.

### Claps and medals (`game/ceremonycast.js` `clearMedal`, `medalGap`)

A wrist the take puts in front of the ribbon or the disc is moved straight out from the chest (11.5 cm clear of the
ribbon), and one level with the disc also down under it (to 1.165 m, a clap at the belt), eased in by where the hand is,
the arm bent again to it. Nearest a hand (wrist, palm, fingertips) comes to the medal over 18 s, per man: 1.7 to 9.5 cm
before, 8.8 to 12.7 cm after. `c3-claps-before-after.png`: the disc is in plain sight in every frame after. Honest: the
low clap is a little formal (arms straighter); `CLEAR` in `ceremonycast.js` has the numbers.

### The celebration prompt (`game/celebration.js`, `game/hudslot.js`)

It was a metre-wide panel 2.1 m away, 24 degrees to the right of where you look, level with the horizon; the banner
(46 degrees wide at 3 m, trailing your head) and the subtitle (48 degrees wide, on your head) are both wider than that
gap, so their panels overlapped it (how much of the paint overlapped depended on the words). Now the prompt and the
arm-pose caption ride on your head like the subtitle and the bug (22 degrees wide, a metre away), and each frame they take
the highest free place straight ahead under the middle of the view that touches nothing showing: the outlines of the
banner (passed in from `main.js`, one line), the subtitle, the bug and anything else on the camera, with 2.5 degrees
clear. Nothing showing: its top 3 degrees under the middle. A subtitle up: under it (top at -15.6 degrees). No room below
(you are looking far up and the banner has come down): out to the right of everything. It moves away at once and comes
back eased. `tests/unit/hudslot.test.js` sweeps every head pitch with and without a subtitle;
`node tools/promptshots.mjs out` shoots six cases in the real game and prints the outlines (0 overlaps).
Honest: it is smaller than it was (22 degrees wide, was 27) and with a subtitle up it sits 16 to 32 degrees under the
middle of your view, which is a long way to drop your eyes in a headset; looking far up, the banner itself comes down onto
the subtitle (that is `game/hud.js`, not changed here). In the browser the bug is a DOM element at the top left, nowhere
near.

### Numbers (headless Chrome, no fps)

- Photographers: 17 draws as before (7 x clothes + head, cameras, caps, shadows now one instanced draw), 42,680 triangles
  (was 46,082: 3,400 saved, the trousers and long sleeves are fewer rings than shorts, thighs, socks and arms).
- Whole ceremony frame: 76 to 84 draws, 201,000 to 209,000 triangles (as before within the stadium's own variation).
- Nothing added for the cup (same materials; one more 1024 x 512 half-float picture and its filtered copy at night), the
  claps (arm IK on up to 16 hands a frame) or the prompt (same two planes).

### Not seen in a headset

- The photographers 2.5 to 3 m in front of you in stereo: hands on the cameras, the trousers at the knee, whether seven
  people fidgeting is too busy or about right; fps (unchanged triangle count, more IK per frame).
- The silver at arm's length and over your head; the night picture's first-use hitch.
- The prompt's size and place under the subtitle, and whether it should sit on the right instead.
