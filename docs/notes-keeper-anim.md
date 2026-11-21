# Notes: the goalkeeper's animation (branch `keeper-anim`)

Rebuilt Nov 2026 (two Opus helpers, finished by the orchestrator). Kenny: "improve their animations to reflect
the new Gen graphics", and all animation must be "based on real stuff". Rules untouched: the sim still says
`p.save { y, kind, id, eta }`, `p.dive`, `p.holding`; this only poses him.

## Files

| File | What |
| --- | --- |
| `game/keeperpose.js` | The set position, the shuffle on planted feet, the split step, holding the ball, blending between states, `heldBall` |
| `game/keepersave.js` | Dives (low and high, catch / parry / beaten), standing saves (scoop, chest, overhead), the get-up |
| `game/keeperhands.js` | Palms on the ball (grips), arm IK, the head, nothing under the grass |
| `game/keepercap.js` | The recorded get-up (a 'once' clip) |
| `tools/keeplook.js` | Look-page shots: `keepready`, `keepshuffle`, `keeplow`, `keephigh`, `keepstand`, `keephold`, each also `...front`, `...side`, `...near` |
| `tests/unit/keeperpose.test.js` | Hands on the ball on the save frame, the held ball between the palms, nothing under the grass, feet still while planted |

`game/main.js` changed in two small places (nothing else of the new work is wired in there): the split step is
triggered on your wind-up as well as on a strike, and the held ball is drawn where the pose put it (`heldBall`)
in place of the midpoint of the wrists.

## What is real, what is built, what is a guess

**Recorded (CMU motion capture):**
- Getting up off the grass after a dive: 140_03 "get up laying on side", from sitting on the hip with the legs to
  one side, up through a crouch. Played faster than recorded; mirrored for a dive to his right.

**Measured from a recording, then built:**
- The shuffle's numbers come from 102_28 (the same take as 78_30), a basketball "defensive move side to side":
  a low stance sliding about 1.3 m each way at up to 2.5 to 3 m/s. Measured on our skeleton: the feet never cross
  and never come nearer than 0.28 m (ours: 0.27); a stepping ankle rises 0.10 to 0.15 m at speed (ours: 0.05 at a
  creep to 0.11 at 3 m/s); a step takes about 0.2 s (ours 0.22 to 0.17); the hips ride up 10 cm and more as he
  pushes across and sink as he stops (ours: up to 5 cm; a keeper's set is higher than a basketball guard's, 0.8 m
  against 0.61 to 0.70 m, so there is less to rise from). It is not baked as a clip: the legs are still IK to feet
  planted in the world, because the sim moves him at any speed and direction and a recorded slide would skate.

**Built from published measurements of real dives** (Ibrahim, Kingma, de Boode, Faber, van Dieën: J. Sports Sci.
2019 "Kinematic and kinetic analysis of the goalkeeper's diving save in football"; Front. Sports Act. Living 2019
"The effect of preparatory posture on goalkeeper's diving save performance"; 2020 "Angular velocity, moment and
power analysis..."; ten and seven elite keepers, balls at 0.3 m and 1.9 m):
- The set position: knees bent about 58 degrees, hips about 63, feet a third to a half of leg length apart
  (ours: 0.46 m, hips 0.8 m).
- The order of the push: the leg away from the dive pushes first and leaves the grass first, the leg on the dive's
  side last. A step toward the ball first; between the two pushes the stance opens to about 90% of leg length
  (ours: the near foot steps out 0.38 m, to 0.84 m).
- He sinks before he goes: 8 to 14 cm for a high ball, 12 to 18 cm for a low one (ours: 10 and up to 20).

**Built from how it is coached** (no recording of it exists in the free library, which has no goalkeeping at all):
- Hands lead the dive; a low ball is trapped with one hand behind it and one on top, landing on the side (lower
  leg, hip, shoulder); a high one is taken with the top hand coming over, the trailing knee driven up; a parry is
  with the heel of the hand, wrist stiff; catches at the chest are a W (thumbs together), low ones a scoop.
- The split step as a shot is struck; never crossing the feet in the shuffle.

**Guessed:** flight after take-off (the sim gives a time and a place, not a path), the landing's small slide,
how the arms come down after a parry, the head.

## Short of real

- The sim's save times are short (it times a save to the ball's flight, a few tenths of a second). A real dive
  takes about a second from the first move to the ball; here the sink and the two pushes are squeezed into the
  first part of whatever time there is.
- No small step away before a low dive (real keepers take one).
- One dive per height band: every low dive is the same dive, mirrored.
- The shuffle is built, not recorded; at the sim's top keeper speeds he steps very quickly.
- Standing saves are plain.
- After a parry he lies a moment and gets up the same way every time (one get-up take).
- Nothing has been seen in a headset.

## Fixed along the way

- The chest hug: the ball is held between the palms at the chest (it was 24 cm of ball between palms 16 cm apart).
- The low dive's hands were 0.43 m under the grass at the touch; nothing goes under the pitch now (tested).
- After a high parry his arms stood straight up in the air while he lay on the grass; they come down beyond his
  head as he lands.

## Later the same day (Kenny's review of the videos)

- "broken wrist", "the stance doesn't look right", "the dive looked broken": the set position is now the coached one
  (feet shoulder width, knees a little bent, nose in front of the toes, elbows narrow, hands in front a ball's width
  apart); a wrist bends at most about 30 degrees off the forearm; the dive's body path is smooth (it bounced 20 to
  30 cm), he sinks and leans into it with his hands in front of his chest, drives off, and is long and low on his
  side with his arms stretched to the ball; for a low ball he is down by the time he gets to it.
- "his arms still go through his body": a palm asked to be across his chest is brought to the front of it and the
  elbow goes forward, the shoulder rolls forward when an arm reaches across, palms keep off his head
  (`placeHand` in keeperhands.js, all smooth: a search for a clear elbow was tried and made the arms flicker).
  `armInside` measures it (trunk, thighs, shins, head) and the tests hold it under 10 cm and 26 frames a save.
- "why not put this in?" (the coached get-up): done. `poseUp` in keepersave.js is the pendulum leg: the top leg
  swings up and forward and is driven down to post its foot, the bottom leg is shot under his seat, he rocks up over
  that knee and drives off the posted foot, no hands, about 0.9 s. Built from coaching points, not recorded. The
  recorded get-up (140_03) is no longer used (keepercap.js and the clip are still there).
- "whys the inside transparent?": the kit is drawn on both sides (game/ps2/player.js), the inside in shade, so you
  can't see through a sleeve or a short's leg.
- Gloves: merged in from the `gloves` branch.

## Standing saves and footwork rebuilt (branch `keeper2`, Nov 2026)

Kenny's standard: "look up how gks do irl, man and replicate that". The dives, set position and get-up had been
rebuilt to it; the standing saves, the shuffle and the split step had not. Rules untouched (`gk.save`, `gk.dive`,
`gk.holding` as before). `game/main.js` untouched.

| File | What |
| --- | --- |
| `game/keeperfeet.js` (new) | The set position, the shuffle, one-off steps, the split step, standing with the ball (`SET`, `GAIT`, `SPLIT`) |
| `game/keeperstand.js` (new) | Standing saves by height: scoop, cup, W, overhead; parries (`STAND`) |
| `game/keeperpose.js` | Now only: latching a save, the way back to his spot, blending between states |
| `game/keepersave.js` | Dives and the get-up only (the standing saves moved out) |
| `game/keeperhands.js` | New grips (`w`, `over`, `hug`, `block`, `lowblock`, `tip`); `readyGrip` / `lerpGrip` / `chestPoint` moved here; `placeHands(..., free, lim)` |
| `tools/keeplook.js` | Shots `keepscoop`, `keepcup`, `keepw`, `keephead`, `keepover`, `keepjump`, `keepwside`, `keepcupside`, `keepblock`, `keeplowblock`, `keeptip`, `keeplrl`, `keepcreep`, `keepinout`, `keepsplit`; views that go with him: `...cfront`, `...cside`, `...cq`, `...chigh`, `...chighside` |
| `tests/unit/keeperpose.test.js` | 60 tests: every standing save (gloves on the ball, arms out of the body, one smooth movement), four kinds of footwork, the split step |

### Where each thing comes from

**Coaching material** (read Nov 2026): Guam FA Goalkeeping Coaching Handbook (set position, the "K", cup, W, high ball,
deflecting); FIFA Goalkeeping manual (ground balls with the arms inside the knees, stomach-height balls clamped to
the chest, head-height balls caught in front of the head with elbows in, the high ball off one leg with the knee up,
side steps for short distances and crossover steps for long ones, tipping over the bar with one open hand); Keeper
Portal's guide to the W (thumbs behind the ball, hands on its top half, elbows bent, about 15 inches in front of the
face); a US youth club's coaching points (thumbs together at chest height and above, little fingers together below;
shuffle under 2 yards, cross-step over); KeeperStop on footwork (quick balanced steps, hips square, hands ready, on the
balls of the feet).
- Which technique at which height (`STAND`): scoop under 0.5 m, cup to 1.15 m (below the chest), W to 1.8 m, overhead
  above. The heights themselves are ours, from the model's knee, chest and head.
- Scoop: the foot nearest the ball beside its line, the far knee turned in and down behind it (the K), hands down,
  palms to the ball, little fingers together, arms inside the knees, up the forearms into the chest, then up.
- Cup: feet planted, palms up, elbows tucked, into the midriff, hips give back, chest over it.
- W: hands early, thumbs behind, on the top half, elbows bent and low, met 35 to 40 cm in front of his chest and face
  (coached: 15 to 18 inches), the arms give about 15 cm, then into the chest.
- Overhead: at the top of his reach; over 2.02 m he jumps off the near foot with the far knee up.
- Parries: open palms behind it, wrists stiff, pushed down and wide; over his head one palm under it, up and back.
- Feet first: a side-step (near foot, then the far one closes) puts his body behind a ball up to 0.5 m wide of him.
- Shuffle: never crossing, never together, low, hips level, hands kept in the set position.
- Split step: a small hop landing on both forefeet as the ball is struck.

**Measured from the recorded slide** (CMU 102_28, basketball "defensive move side to side", measured again from the
raw BVH, scaled to our 0.86 m leg): at 2 to 3 m/s the ankles go from 0.12 to 0.97 m apart across him once per 0.46 s;
he bounds (both feet off at the closest point, hips up 6 to 10 cm). Used: the cycle time (`GAIT.cycle` 0.44 s at top
speed), that the far foot is off before the near one is down (`GAIT.lag`, `GAIT.duty`: both feet off about a third of
the time at 3 m/s), the widest stance (ours 0.84 to 0.94 m). Not used, because goalkeeping coaching says otherwise:
his feet nearly meeting (ours never under 0.275 m, `GAIT.gap`) and the bounce (ours: hips level; they only sit 6 cm
lower at speed, smoothly).

**Physics:** the split step's time in the air is what a 2 cm hop takes (0.128 s); a jump's rise time is from its
height.

**Guessed:** the slow shuffle's rhythm (0.36 s a cycle; nothing recorded at a creep), how far he sinks into the split
step (5.5 cm), every timing after the ball is in his hands, the head.

### Measured (bare skeleton, the real sim; `KEEPER_REPORT=1 node --test tests/unit/keeperpose.test.js`)

- Feet: a planted foot moves 0.0 cm/s (it is fixed in the world; before: only 4% of planted frames were still in a
  fast shuffle). Ankles 27.5 to 94 cm apart in a 3 m/s shuffle, 37 to 64 cm in a creep. 4.5 to 4.9 steps a second
  flat out, 2.8 creeping (before: 8 to 10 a second). Hips: 14 to 15 m/s2 at most (before: 385 to 440, a visible
  jerk), 5 to 6 cm between a stand and a flat-out shuffle and about 1 cm in a creep (before: 7 to 9 cm of bobbing).
- Split step: feet off on the frame the wind-up begins, down 3 frames (42 ms) after the ball is struck, hips up 1 cm,
  stance 44 to 52 cm.
- Standing saves: both palms 0.4 to 0.5 cm from the ball's surface when they meet it and on the sim's save frame;
  hips 2.0 m/s at most, hands 6.6 m/s at most (before: a 23 cm jump in one frame in the scoop); wrists 30 degrees at
  most, 40 for the W; no arm more than 3 cm inside his body in any of the eleven.

### Short of real

- No crossover step. He shuffles at every speed up to the sim's 3.5 m/s; a real keeper crosses his feet to cover
  more than about 2 m quickly. Not built: it needs the hips turned to the run with the chest kept square, and a way
  in and out of it.
- The split step can't land exactly as the ball is struck: the page hears of a shot 83 ms before it (the wind-up),
  and a 2 cm hop takes 128 ms. A real keeper reads the backswing. Starting it when you begin charging a shot would
  need the sim to say so (`intent.charging` is not an event the page sees for him).
- The sim gives a standing save 0.3 to 0.5 s. With 0.5 s he gets down into the K; with 0.3 s (a hard shot) he only
  stoops behind it with his palms down.
- A parried ball leaves his hands where the sim sends it, not where his palms pushed it.
- One version of each save. The scoop always kneels on the leg away from the ball.
- Holding: he stands with it hugged to his chest and looks up the pitch; no bounce, no walk to the edge of the box.
- Low dives: the far upper arm still passes 4 to 8 cm into the top of his chest for 3 frames at take-off. Tried: the
  far hand brought round further forward (worse: 8 to 9 cm), the chest turned to the ball (no better). It wants the
  shoulder itself to come forward (the collarbone), which `placeHand` only does a little.
- Getting up after a dive (not part of this job): a hand passes 4 to 8 cm into his head's sphere for about ten frames.
- Nothing has been seen in a headset.
