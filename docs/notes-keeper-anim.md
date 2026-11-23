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
  most, 41 for the W and 35 for the chest-high parry; no arm more than 3 cm inside his body in any of them (2.6 cm at
  most, the low parry).

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

## Dives without arms in the body, the get-up, the crossover, variety, a livelier wait (branch `keeper3`, 23 Nov 2026)

Kenny: "the goalie looks a bit stiff", and before that "his arms go through his body", "the dive looked broken". Rules
untouched (nothing in `rules/` changed). `game/main.js` and `tools/ps2look.html` untouched.

### Two faults found on the way that were worse than the ones asked about

- **He jumped 1.4 m sideways on the frame every dive ended** and slid back over 0.3 s (0.2 to 0.5 m after a standing
  save with a side-step). The pose he blended from kept his hips where the dive had left them in the save's own frame
  after his root had been moved under them, and the last frame of a save was never posed, so his feet were "planted"
  where a resting skeleton has them. It had not been seen because every close view went with his hips. Fixed in
  `keeperpose.js` (the remembered pose is moved with the root) and `keepersave.js` / `keeperstand.js` (the last frame is
  posed). Measured: 97 to 157 m/s change of speed in one frame before, under 5 now (tested).
- **`armInside` measured his head against the wrong point** (a scratch vector the trunk and leg tests had overwritten),
  so the "hand in his head for ten frames of the get-up" in the list above was partly an artefact, and an elbow that
  really was 8 to 10 cm into his head at the ball in every dive went unseen. Fixed; the numbers below are with it right.
- He also **hopped 15 cm for 0.1 s at take-off** (a boot under the grass lifted the whole body) and was lifted or
  dropped 5 to 25 cm in single frames lying down and getting up. Now a leg in the air is swung clear from the hip, and
  on the grass he is let down or lifted at 1.1 m/s at most.

### What changed

| File | What |
| --- | --- |
| `game/keepersave.js` | The dive's hands, trunk and take-off leg; the ball secured on the grass; the get-up's arms; versions (`sv.var`, `variantOf`, `FORCE`) |
| `game/keeperhands.js` | `diveGrip` (hands in line with the reach), `turnToReach` (the chest turns to what he reaches for), `grip(..., q)` (a grip turned with his trunk), `lerpGrip` as one turn, settling on the grass at a limited speed, the head test fixed |
| `game/keeperfeet.js` | The crossover (`CROSS`), habits (`habitOf`, `HABIT`), the wait scaled up (`LIVE`) |
| `game/keeperstand.js` | Versions of the standing saves |
| `tools/keeplook.js` | Views that go with his hips (`...hfront`, `...hside`, `...hq`, `...htop`), the striker's eyes (`...eye`, `&eye=` m out), shots `keepidle`, `keepcross`; `&gk=0..1` which keeper, `&var=0..59` which version |
| `tests/unit/keeperpose.test.js` | 215 tests (was 60) |

**1. Low dives (and all the others).** What was wrong was not only the far upper arm: the hands were asked to point their
fingers up at the ball whatever the arm was doing, so in every dive the wrists and elbows folded and the bottom arm
went through his head. Now (`diveGrip`) the fingers point on along his reach; a ball near the grass has the bottom
hand behind it and the top hand on top; one off the grass is a W on its side; a parry is the heel of the bottom hand
(low) or the top hand come over (high). The far arm no longer lies across his chest because the chest turns to the ball
(`turnToReach`: an upper arm comes only about 26 degrees inside straight ahead, the rest is the trunk turning, up to 49
degrees, spine and chest sharing it) and the shoulders come up by his ears as the arms go out. He meets the ball 26 cm
in front of where he stood with his hips 30 cm behind it, so his arms pass in front of his face. Once laid out his
trunk no longer bends toward the ball (that put his head under his arm and into the grass, and his legs floated).
The take-off leg keeps its foot where it stepped until his hips have gone further than the leg is long, then trails at
full stretch, toes pointed (before: the leg snapped from one pose to another in 0.08 s); close to him it never leaves
the grass and he goes down over it, a collapse dive. After a parry the bottom arm lies long on the grass beyond his
head and the top hand comes down flat in front of his chest (before: both arms crossed in front of him).

**2. The get-up.** A caught ball went from beyond his head to his chest in a straight line: through his head. Now it
goes to the grass with him (the ball lands first, top hand on top), stays pinned 0.14 s, then is drawn in round in
front of his face over 0.42 s into a hug against his chest, and only then does he get up, the ball carried high on
his chest while his knee comes up under it, the far elbow out over the posted knee. The top leg's swing is a little
lower (it stood at 60 degrees).

**3. The crossover** (`CROSS`). Coaching: side-steps for short distances, crossover steps for long ones; "turn the hips
and run in the direction they want to go" with the upper body kept facing the ball; then a few quick shuffles to get
set (Sport Session Planner "Teaching the crossover step"; FIFA goalkeeping manual; the US youth club points already
listed above: shuffle under 2 yards). Built: when he has gone across at over 2.5 m/s for 0.2 s (about 0.6 m; it ends
under 1.8 m/s) his hips turn 46 degrees to the run, spine and chest turn most of it back (chest 6 degrees off the
ball), the feet take turns on two lines 28 cm apart, the trailing foot's in front, boots pointing into the run, each
step swung out round the other foot; each step is wholly a side-step or a crossover step from the moment the foot
lifts. Planted feet are still fixed in the world. Honest: the sim seldom moves him that far that fast (bursts of 0.2
to 0.4 s at 2.5 to 3.2 m/s; over 4.2 m/s he runs as an outfield player does), so in a match it will mostly be one or
two crossover steps inside a shuffle; the look shot and the tests script his path. Not captured: nothing in the CMU
library is a crossover run with the chest held square.

**4. Variety.** A version number from the save's own id and the keeper's seed (`sv.var`; replays get the same one).
- Dives: a parry with one arm at full stretch and the other left short, or with both arms long (one in two each);
  with both palms behind it one time in three when it is inside 1.7 m; the bottom hand for low balls, the top hand
  over 1.25 m and for half of those between 0.7 and 1.25 m; when the hands are thrown (22 to 30% of the way to the
  ball); how hard the trailing knee is driven up (55 to 100%). By distance, not chance: a collapse dive close in, a
  full-stretch one far out.
- Standing: the scoop kneels on either leg for a ball straight at him, and one time in three is a standing scoop
  (legs together, stooped); the W and the overhead catch have one hand a little higher round the ball (up to 10
  degrees either way); how far the arms give (70 to 130%).
- Each keeper (`habitOf`, from his seed): stance 40 to 51 cm wide, hips 2.5 cm lower to 2 cm higher, hands carried 6 cm
  lower to 9 cm higher and up to 5 cm wider, how bouncy (60 to 130%) and how quick the bounce, how much his weight
  wanders, how restless his feet are.
All of these are coached techniques; which one a keeper picks when is my choice, not measured from anything.

**5. The wait** (`LIVE`). Filmed from the striker's eyes at 15 m at the headset's pixels per degree (`keepidleeye`):
the first version moved his head 6.6 cm side to side and 3.4 cm up and down over 12 s, his hands 6 cm; at 15 m a
centimetre is two thirds of a pixel, so it read as a statue. Now: weight 7 to 13 cm side to side (5 to 8 px), hands 9
to 15 cm, a foot re-set by up to 10 cm every 0.8 to 1.9 s, a bounce that comes and goes (4 cm at the hips, head 5 to
6 cm; I had it at 12 cm at first and took it down: his head bobbed), inside 22 m of the ball (was 17). Nothing quick:
hips, head and hands under 5.1 m/s2 and 0.36 m/s. It fades as he moves, holds the ball or split-steps.

### Measured (bare skeleton, the real sim; `KEEPER_REPORT=1 node --test tests/unit/keeperpose.test.js`)

| | Before | Now |
| --- | --- | --- |
| Arm's middle line inside trunk, head or a leg, on the way to the ball (13 dives x 6 keepers x 6 versions) | 6.3 cm in the chest (low dives, 3 to 4 frames), 8 to 10 cm elbow in the head (every dive, 9 to 19 frames) | 2.0 cm at most (tested under 2) |
| The same on the grass and getting up | 5.5 cm (hand in the thigh); the ball through his head | 2.2 cm at most (tested under 2.5); the ball clears his head (tested) |
| Whole body moved in one frame as a dive ends | 1.35 to 2.2 m | under 7 cm |
| Lifted to keep a boot out of the grass at take-off | 15 cm for 6 frames | 0 |
| Largest change of speed in a frame, hips | 97 to 157 m/s | 2.2 to 6.2 m/s (the landing) |
| ... a hand / a foot | 14 / 22 to 31 m/s | 12 / 16 m/s (an arm thrown out at 12 to 14 m/s reaching full stretch; the take-off foot) |
| Crossover: planted foot / boots at the nearest / hips | - | 0.7 cm/s / 13 cm between middle lines / 27 m/s2 |
| Shuffle (sim): planted foot | 0.0 cm/s | 1.5 to 2.7 cm/s: the ball of the foot as the heel rides the bounce (tested under 3) |
| Waiting at 15 m, head side to side / up and down | 6.6 / 3.4 cm | 8.6 to 15.3 / 4.5 to 5.8 cm |

A test that was loosened: wrists in the shuffle were held under 23 degrees; with hands carried higher or lower by
habit they reach the wrist limit itself (30 degrees), which is what is tested now.

### Real, built, guessed

- From coaching (already listed above, plus the crossover session): hands leading, bottom hand behind and top hand on
  top, the ball as "the third hand", the top hand for high balls, the collapse dive close in, securing the ball to the
  chest before getting up, the crossover's hips and chest, the K on either knee, the standing scoop.
- From anatomy: how far an arm comes across the chest before the trunk turns, the shoulders rising with the arms. The
  angles are round numbers that kept the arm out of the chest, not measured from a recording.
- Guessed: every timing after the ball is in his hands, how often each version turns up, the size of each habit, how
  much he moves while he waits (sized so it shows at 15 m, kept under what looked like bobbing).

### Short of real

- The dive is still squeezed into the sim's few tenths of a second, and there is still no small step away first.
- A low dive rarely "flies": his near foot mostly stays on the grass until he is down (right for a low ball, but the
  full-stretch low dive off the ground is not really there).
- The get-up is one get-up (the pendulum leg); its kneel is set down on whatever is lowest, not placed by design.
- The top arm in a low catch arches over his head with the elbow high.
- On the grass after a parry he lies there 0.25 s and looks at the ball; no scramble after a loose rebound.
- The crossover's arms stay in the set position (a real keeper pumps them a little), and it starts on speed alone: the
  page doesn't know how far the sim means to send him.
- A hand at the end of a full-stretch reach stops in one frame (the arm IK has a hard limit).
- Standing saves were measured across keepers and versions, but only the scoop's versions were looked at large.
- Nothing has been seen in a headset.
