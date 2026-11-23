# Notes: cuts, stops, side-steps, shot variety, the pile-on (branch `moves3`)

23 Nov 2026, one helper session. Page side only (`game/`, `tools/`, `tests/`): **nothing in `rules/` changed**. Kenny's
rule: animation "based on real stuff". Nothing here has been seen in a headset.

## Files

| File | What |
| --- | --- |
| `game/footwork.js` (new) | A cut's plant on the outside foot; a stop's braking steps and settling step. Feet held in the pitch's space |
| `game/shuffle.js` (new) | Recorded strides under side-steps and backing off |
| `game/kickcap.js` | A second recorded take for shots and for passes, picked per strike (`kickOf`, `strikeDice`) |
| `game/beaten.js` | A guard that keeps a thrown arm clear of his own head (`handToHead`) |
| `game/cheers.js` | The pile-on's two teammates rebuilt as a hug |
| `game/actors.js` | Three hooks: `shuffleLegs`, `footwork`, `footBody` |
| `tools/build-anim.mjs`, `game/assets/anim/clips.js` | Six new clips: `shuffle`, `back`, `cutA`, `stopC`, `kickShotB`, `kickPassB` (26 clips, 672 KB, was 548; the old 20 are byte-identical). New options: `keep` (a stride faced the way the pelvis faces, with the way he goes in `go`), `cycle` (one turn of a gait given outright), `from` / `to`, `floor: 'low'` |
| `tools/moves3look.js` (new) | Look-page shots `m3cut`, `m3stop`, `m3arrive`, `m3zig`, `m3side`, `m3back` (+ `front`, `top`); `&old=1` shows any of them as it was before; `&ang=`, `&v=`. He is moved as the sim moves a man (18 m/s2 toward the velocity he wants), 72 steps a second |
| `tests/unit/moves3.test.js` (new), `cheers.test.js`, `beaten.test.js`, `kick.test.js`, `boot.test.js` | 7 new tests (316 in all) |

`game/main.js` is untouched. `tools/ps2look.html` changed in four lines (an import and a hook).

## Job 1: cuts

**Recorded:** CMU 127_13 "Run Side Step Left" (`cutA`, 0.6 s): the step where he plants his right foot wide and goes
left. From it: the pelvis's tip and sink, the trunk, the arms (70%), mirrored for a cut to the right. The plant's
width was measured in that take (33 to 37 cm out from the hips).
**Built:** when it happens and where the foot goes. The page watches his velocity: pushed across his way at over
9 m/s2 for 0.08 s at 2.4 m/s or more is a cut (a nudge to his line isn't). The foot on the outside of the turn is
carried in 0.07 s to a spot 22 cm out from under its hip (plus the lean the gait already gives him), placed from
where his hips will be half way through the push, and held on that spot of the pitch. His stride is re-timed so
that foot is in its stance (the push comes off it), hips 8 cm down plus the recording's. It is let go when the
push ends, when the leg can't reach it, or after 0.42 s; then not again for 0.55 s.
**Takes looked at and not used:** 127_15 / 127_16 "Run Turn" (an arc of 60 degrees over half a second, no plant);
78_28 / 102_26 "DefensiveMoveZigZag" (drop steps while guarding, not a run); 78_24 (a run at an angle). Not
fetched: 16_51 to 16_54 "run, 90-degree turn", 78_15 / 78_16 "OffensiveMoveGo".

**Measured** (`m3cut`, 6 m/s, 80 degrees, bare skeleton; before → after):
- the outside foot is on the grass and still (0.01 m/s) for 5 of the 7 frames it is held (0.10 s); it is 39 cm
  outside his hips; his hips drop 12 cm. Before: no plant; feet on the grass through the turn moved at 3.7 m/s
  (nine frames in ten).
- worst jump of a joint between frames: 5.9 cm → 24 cm (the foot going out to the plant in 0.07 s, and the stride
  re-timed under it). His ordinary run's worst is 18 to 27 cm.
- 50, 80, 120 degrees and both sides tested; a 12 degree change isn't a cut.

## Job 2: stops

**Recorded:** 127_17 "Run Stop Run" (`stopC`, 1.2 s): 3.1 m/s to standing in two braking steps. From it: pelvis
sink and tip, trunk and arms (70%), played 1.25x.
**Built:** the feet. Braking at over 8 m/s2 from 2.2 m/s or more: the foot on the ground stays where it is, the
other comes down ahead of where his hips will be (0.12 to 0.42 m by the speed he still has; the sim's 18 m/s2 says
where that is), then the other the same if he is still going at over 1.2 m/s, each held where it lands. A foot his
leg can't reach any more is let go. Once he stands, a foot more than 6 cm from where he stands is picked up and put
there (0.2 s, 7 cm high), once each. `stopA` / `stopB` (the beaten defender's) are not used here: they are
off-balance stops.

**Measured** (before → after):
- `m3stop` (7.2 m/s to nothing): planted feet 1.59 m/s nine frames in ten, 3.68 worst → 0.00 and 0.12. A braking
  foot is down more than 25 cm ahead of his hips. Worst joint jump 10.0 → 8.2 cm.
- `m3arrive` (pulling up on a spot the way the sim's players do): 0.48 → 0.00 nine frames in ten; the worst single
  frame is unchanged (3.3 m/s, one landing frame).
- From flat out it is three braking steps and two settling steps: busy. From a jog it is one and one.

## Job 3: side-steps and backing off

**Recorded:** `shuffle` = 78_30 "DefensiveMoveSideToSide", one turn of a basketball defender's slide to his left
at 2.9 m/s (0.47 s: trailing foot lands, lead foot lands, both off the floor); to the right is its mirror.
`back` = 141_31 "Walk Backwards" (1.3 m/s). Pelvis and legs only, played at the gait's own phase, reached to the
ground the gait covers, the weight-bearing foot pinned to the pitch.
**Built:** the trunk and arms stay the game's (the basketball stance is bent double with hands up); under 3.2 m/s
the hop is scaled down (to 45% at a walk) and the ankles are kept 27 cm apart across his way (retargeted, they
touched in the air); backing off is that walk turned over about twice as fast as recorded with the hips 3 cm
lower and the carried foot lifted 3.5 cm (the recording skims the floor). **Nobody in the library backpedals at a
defender's pace: this is a quickened walk, not a recorded backpedal.**
**Takes looked at and not used:** 141_33 / 143_40 (single slow side steps with a stand between), 143_39 / 136_25
(backward walks at 0.5 to 0.8 m/s), 76_11 (three big backward steps, turning).

**Measured**, honestly: by the numbers the old procedural feet gripped better.
- side-step at 2.4 m/s: planted feet median 0.01 → 0.00 m/s, but nine in ten 0.06 → 1.57 (a foot is let go and
  caught again for a frame as it rolls off). What changed is the look: before, he stood tall and skated; now he
  sits and pushes off (films).
- backing off: median 0.01 → 0.00, nine in ten 0.09 → 0.00, worst 0.27 → 1.60 (one frame).

## Job 4: beaten defenders' arms

Measured over every reaction (7 moves x 3 runs x both feet, both recorded stops and their mirrors): the nearest a
hand, wrist, forearm, elbow or upper arm comes to the middle of his head is 34 cm (an upper arm; hands 41 cm), and
no forearm or elbow comes nearer than 15 cm to the line through his trunk. So the arm "near his head" in the earlier
notes is not there by measurement; it may have been an angle. A guard is in anyway (`beatBody`: an arm whose hand
comes within 26 cm of the head's middle is eased back toward the run's), with a test.

## Job 5: shot variety

**Recorded:** `kickShotB` = 10_06 (11.4 m/s at the ankle, moving through the ball: a placed side-foot finish, more
upright, shorter follow-through) and `kickPassB` = 10_05. A strike is one take throughout: soft shots are 10_06,
hard ones 11_01, in between it goes by the strike's own dice (its power and aim, so a replay shows the kick that
was played); passes are one or the other, half each. Follow-through length varies by an eighth either way
(built). The boot is still turned to the laces on the ball for every shot.
**Re-checked with fresh eyes and still not usable:** 143_24 "Kicking" and 79_91 "football" (no foot goes over
9 m/s in either), 10_02 (as 10_01), 10_03 (sits 23 cm low), subject 74 (front kicks). 86_03 / 86_06 fetched, not
gone through (6 MB of mixed exercise each).
**Measured:** boot 0.0 cm on the strike frame as before (boot, kick, windup tests all pass). One threshold moved:
a left-footer's pass, boot to ball three frames after, 15 → 12 cm (the second pass take follows the ball closer:
14 cm).
**Short:** it is two shots, not many. The two differ in the follow-through and the arms more than in the approach,
which the 6-frame wind-up hides anyway. Chip and volley are unchanged.

## Job 6: the pile-on

**Built** (the library has no hug): the sim stands the two teammates 0.62 and 0.58 m from you, an arm's length, so
their arms were straight (elbows 168 degrees). Now their hips are brought in (to 0.40 and 0.36 m, pose only), the
kneeling one's hands come round onto the back of your ribs, one high and one low, and the one behind jumps onto
your back (both feet 8 cm or more off the grass), chest on your shoulders, arms over them and crossed on your
chest, head beside yours, then hangs there bouncing.
**Measured** (`cheers.test.js`): elbows 99 and 134 degrees on average (straightest 127 and 147); no forearm or hand
nearer than 12.7 cm to the middle of anyone's trunk or 19.4 cm to the middle of a head; heads 26 cm apart at the
nearest (they were 65).
**Short:** three men, so a huddle, not a heap. Your own arms in it are as they were. The films had a beaten
defender walk through the shot. In first person a teammate's head is now about 26 cm from yours: near-plane
clipping is a headset question.

## Short of real, overall

- A cut's plant lasts 0.1 s because the sim keeps him at 5 m/s through it; a real player slows into the plant.
  One plant per cut: a long turn (120 degrees takes 0.6 s) is one plant, then leaning strides.
- The cut and the stop begin when the page sees the velocity change, so the plant is a reaction, 0.08 s late.
- Footwork is off for a man on the ball, for your own boots, the keeper and beaten defenders. So you, cutting
  with the ball in a replay, still run round the corner.
- Side-steps: one recorded cycle, at one pace, from basketball. Reversing direction goes through the stop.
- Teammates' and defenders' arrivals at a spot (the sim slows them gently) rarely reach 8 m/s2, so most of their
  stops are still the gait's own easing; the hard stop is yours in a replay and anyone the sim halts.

## Needs a headset

Whether cuts and stops read at playing distance and at 72 fps (no new draw calls or triangles; a few dozen
quaternion operations more per player per frame, and 124 KB more clip data); defenders jockeying in front of you
(the slide is what you look at most); the pile-on from inside it.

## Look page and films

`tools/ps2look.html?shot=m3cut` (`m3cutfront`, `m3cuttop`, `&ang=`, `&old=1`), `m3stop`, `m3arrive`, `m3zig`,
`m3side`, `m3back`; `?shot=strike&power=0.4` (placed) against `&power=0.95` (driven).
Films and strips from this session: `/home/claude/moves3-shots/` (`final/*-before-after.png`: before on top;
`final/before|after/*.mp4`; `pile-before-front.png`, `pile-after-front.png` and the `.mp4`s; `a1/strikes.png`).
