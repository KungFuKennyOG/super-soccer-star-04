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
