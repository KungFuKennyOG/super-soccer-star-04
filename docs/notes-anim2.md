# Notes: beaten defenders and the shot wind-up (branch `anim2`)

Nov 2026, one helper session. Page side only (`game/`, `tools/`, `tests/`): nothing in `rules/` changed. Kenny's
rule: animation "based on real stuff". Nothing here has been seen in a headset.

## Files

| File | What |
| --- | --- |
| `game/beaten.js` | A beaten defender's reaction, and going in for the ball and missing |
| `game/windup.js` | Shaping to shoot while the trigger (or the pass ring) is held |
| `game/inertia.js` | Carrying one movement into another without a jump (inertialization) |
| `game/kickcap.js` | The wind-up starts from where the run left him; plant-foot rules; the boot follows the ball; landing on the kicking foot |
| `game/replay.js` | Replays play the whole recorded approach to every strike, record your charge and the defenders' reactions |
| `game/actors.js`, `game/gait.js`, `game/main.js`, `game/strike.js`, `game/dribblecap.js` | Hooks, and three small fixes (below) |
| `tools/build-anim.mjs`, `game/assets/anim/clips.js` | Two new clips, `stopA` and `stopB` (16 clips, 421 KB; the others are byte-identical) |
| `tools/anim2look.js` | Look-page shots `a2shot`, `a2beat` (+ `front`, `back`, `top`, `you`), played by the real sim |
| `tests/unit/windup.test.js`, `tests/unit/beaten.test.js` | 12 new tests (259 in all) |

`game/main.js` changed in three lines: it tells your model about the hold (`models.you.charge`), passes it to the
replay's recorder, and calls `beaten()` on `skill` and `drag` events.

## Job 1: beaten defenders

**How the sim marks it.** `p.stun` (seconds, quarter speed while it lasts): step-over 0.6 (and the sim moves him
0.5 m toward the fake in one step), roulette 0.45, nutmeg 1.1, rainbow 1.5, drag-back 0.6 (`AI.dragStun`).
The `skill` event's `ok` and the `drag` event's `read` say whether he fell for it. A tackle is `p.tackleT`
counting up while he is within reach of the ball; nothing marks one that fails, so the page watches the count
stop without him winning the ball. Training drills park defenders with `stun = 99`: ignored.

**Recorded (CMU motion capture).** Two hard stops out of a run, baked as `once` clips:
- `stopA` = 127_05 "run to quick stop": 4.5 m/s to nothing in half a second, an arm thrown up, hips down to 0.62 m,
  the body turned side-on, upright again by 1.5 s.
- `stopB` = 127_19 "run quick stop run": arms flung wide, sat back.

From the recording: the pelvis (55% of its turn and tip, its sink up to 20 cm) and everything above it (trunk, both
arms). Not from the recording: his feet. They stay the run's own braking steps (`game/gait.js`), because the sim
keeps moving him at quarter speed and recorded legs would skate. Mirrored for the side he opens to; one or the
other by his seed; a little quicker than life (up to 1.4x) when the sim's moment is short.

**Built from how it happens, no recording** (said plainly: these are key poses, not captures):
- the step-over's fake: the half metre is taken over 0.2 s as a side-step onto the outside foot, and he opens
  that way;
- nutmeg: knees together late (measured: under 17 cm apart), hips down 6 cm, bent forward, head down, then round
  after the ball;
- rainbow: head back to follow the ball, weight back, arms out;
- going in: the leg nearer the ball reaches for it, toes out, hips low, over the time the sim counts (0.22 s); a
  miss leaves the leg out, his trunk going on over it, for 0.4 s.

Nobody falls: the shortest moment is 0.45 s and none is long enough to get up from the grass.

**Takes looked at and not used:** 16_08 / 16_57 "run/jog, sudden stop" (an easy jog pulling up, no loss of
balance), 104_13 "stumble walk" (a clowning drunk), 22_12 "A stumbles into B" (a walk), 91_59 "360 small stumble"
(the stumble is the landing of a jump turn), 127_13 "run side step left" (a clean side-step), 90_17 / 90_18
(falls). Not fetched: the basketball defender takes (78_24 to 78_30): the library's defender is never beaten in
them.

**Measured** (`tests/unit/beaten.test.js`, bare skeleton, 6 moves x 3 runs + 3 missed tackles, he arrives at 5 to
6 m/s):
- planted feet over the grass during a reaction: median 0.22 to 0.39 m/s (his ordinary run in the same clips: 0.14
  to 0.22); the two worst runs 0.74 (a roulette) and 1.49 (a miss);
- worst jump of any joint between frames (second difference): 6 to 17 cm during a reaction; his ordinary run's own
  worst in the same clips is 18 to 27 cm;
- on the page he never moves more than 16 cm in a frame through a step-over's fake (the sim: 50 cm), right- and
  left-footed;
- the reaction ends within 0.2 s of the stun, no pop at the end, no ankle under the grass.

## Job 2: the shot wind-up

**What was wrong, measured before anything changed.** In the six frames after you let go, the kicking ankle jumped
30 to 70 cm between frames and the plant foot up to 90 cm (cross-faded into the kick in two frames). Half a second
later the plant foot jumped again 50 cm (it was being pushed round where the ball had been, then let go).

**What is built.**
- *Release* (`inertia.js`, `kickcap.js`): the recorded downswing has him from the first frame, and what he was
  doing is carried into it as an offset with its speed, eased to nothing exactly on the strike frame. The downswing
  starts from where his kicking leg already is (between the wind-up's own length and the top of the backswing),
  leaning to a bigger backswing for more power.
- *Plant foot*: on the grass when you let go, it stays on that spot (he sits lower over it, his hips hang back
  toward it, and it is let go past the leg's reach); in the air and near, it comes down beside the ball; too far
  off (trailing at a sprint), it carries on and he strikes it in stride.
- *While charging* (`windup.js`): above the hips he is drawn toward the top of the same recorded backswing (60% at
  full charge: the far arm out, measured 26 cm from where the run has it), the pelvis opens a little, the trailing
  kicking leg's heel comes up. His run goes on underneath. Your own first-person boots are not touched while
  charging.
- *After*: he comes down on the kicking foot. The run's cycle is moved so that foot is landing as the
  follow-through ends, which is what the "hang in a long stride" was.
- *Replays* know the strike is coming: every shot and pass there gets the whole recorded approach at life speed
  (0.3 s: the last stride onto the plant foot, heel up to 0.5 m behind him, the downswing), and his run is brought
  into step for it over the second before, by quicker steps. This is where the kick reads as a real kick.

**Fixed along the way** (all pre-existing):
- after a chip at a sprint the right boot reached 1.6 m up for the ball in the air (a 3 m jump in a frame);
- the contact pose was held for two frames (the boot stood still while the ball left);
- a struck ball left his legs in time with touches for the rest of the strike, so the stride changed rate 0.2 s
  later with a 30 cm foot jump.

**Measured** (`tests/unit/windup.test.js`: held 0.1 / 0.4 / 1.2 s, standing / walk / jog / sprint, four release
points each, first person and whole body):
- boot to ball on the strike frame 0.0 cm, always six frames after release;
- worst jump in the wind-up now 5 to 26 cm (kicking foot at most 18), in the half second after 3 to 26 cm (the worst is your own left boot at a walk as the stride changes cadence; the rest are under 16);
- dribbling touches while charging 0.0 cm; your hips centred and unturned;
- a planted plant foot is still (0.1 to 0.3 m/s) while it is held; it is held for about four of the six frames at
  a jog before the leg runs out.

**Teammates** have no charge to read and the page can't see their strikes coming: left as they were (the boot is on
the ball the frame it goes). In replays they get the full approach like you.

## Short of real

- **Live, the kick is only as good as the stride you let go on.** Let go with the kicking leg trailing and you get
  a downswing from near the top. Let go with it in front (about half the stride) and it is a short stab in stride
  with no backswing, because six frames is all there is. Nothing on the page can fix that.
- **The rules change that would** (not made): strike on the stride. Keep `STRIKE.shot` as the least, and let the
  wind-up run until the plant foot is down and the kicking boot next comes through, 0.08 to about 0.3 s. Same
  idea as `STRIKE.rainbow`. It changes timing under pressure, so the bots would need re-measuring.
- In first person you see boots only, and you aim shots with your head, so your own boots are below your view
  when you shoot. The shaping-up is seen in replays, not live.
- The replay's run-in quickens his steps by up to double for a moment; his touches then don't line up with the
  ball's small movements in that last second.
- One take per kind still: every shot is the same shot. The trunk is pitched well forward through the replayed
  kick (the recording's own posture plus the run's lean).
- Beaten defenders: two stop takes, so reactions repeat; legs are the gait's braking steps, not a recorded
  stagger; the arm thrown up in `stopA` comes close to his head on some frames; nutmeg, rainbow and the missed
  tackle are built poses. No stumble over a planted foot, no fall.
- A missed tackle is only seen if the sim had him within reach for 0.06 s or more.
- Still in the plain gait, not touched: a foot jump of 18 to 27 cm on some frames of a hard stop or a change of
  cadence (the stride's length is rescaled in one frame).

## Needs a headset

Whether the release feels the same (timing is untouched, but the boot now carries in instead of snapping); whether
a defender pulling up reads at playing distance; fps (no new draw calls or triangles; per player a few dozen
quaternion operations more per frame); the replay's approach on the 256x144 screen.

## Look page

`tools/ps2look.html?shot=a2shot` (`&speed=stand|walk|jog|sprint&hold=0.5&at=1.0`, `&kind=pass`, `&replay=1`,
`&cancel=1`), `?shot=a2beat` (`&move=stepover|stepoverin|roulette|nutmeg|rainbow|drag|miss&n=1|2|3`), each also
`...front`, `...back`, `...top`, `...you`; `&rate=0.25` slows it. `SIZE=800x600` is new in `tools/ps2shots.mjs`.
Films and strips from this session: `/home/claude/anim2-shots/`.
