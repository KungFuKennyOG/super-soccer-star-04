# The flat-screen game's own animations (branch `flat-11v11-anim`)

23 Nov 2026. Getting up, falling over, the throw-in and the referee's signals for `brawl.html`. None of it is
wired into `game/brawl/view.js` yet (the lead session does that); the old plank get-up still runs there.
Nothing has been seen in a real match or on a real GPU: only on the look page and on bare skeletons.

See them: `npm run serve`, then `/tools/animlook.html?shot=fall&vx=4&vy=3&vz=-3&seed=2` (a man knocked over,
then getting up; `&lie=side`, `&face=rad`, `&view=front`, `&slow=0.25`), `?shot=throw`, `?shot=ref&kind=card`.
Contact sheets: `node tools/animshots.mjs out/anim` (all of them, about 5 minutes), or name some:
`getup-back getup-front getup-side getup-turn trip launch throw ref-free ref-indirect ref-penalty ref-card
ref-red ref-advantage ref-whistle ref-fulltime ref-freeblow`.

## The API

```js
// game/brawl/getup.js
GETUP_TIME                       // 1.5 s: set BODY.getup to it
startGetUp(m)                    // on the sim's 'getup' event while m.rag is live; ends the ragdoll (m.rag = null), sets m.getUp
                                 // returns { x, z, fx, fz }: where and which way the recording alone would bring him up
poseGetUp(m, p, t)               // every frame after placeModel + animate; t = seconds since startGetUp; clears m.getUp at GETUP_TIME

// game/brawl/throwin.js
THROW = { hold: 0.5, windup: 0.42, release: 0.14, follow: 0.55 }
poseThrowIn(m, t)                // after animate; t = 0 is the ball held over his head; the ball goes at t = windup + release
throwInBall(m, out)              // the ball between his palms (world), or null when he hasn't got it

// game/brawl/refpose.js
REF_SIGNALS                      // seconds each lasts: free 2, indirect 2, penalty 2, card 2.2, advantage 1.2, whistle 0.5, halftime 2, fulltime 2
poseRefSignal(m, sig, t)         // after animate; sig = { kind, dir: { x, z }, hold?, red? }; false once it is over
cardTransform(m, pos, quat)      // the card in his hand while it is out; false otherwise

// game/brawl/ragdoll.js: startRagdoll / stepRagdoll / poseRagdoll as before
```

Wiring notes for whoever does it:

- In `view.js`: on `getup`, `startGetUp(m); m.upT = 0;` then each frame after `animate()`:
  `if (m.getUp) { poseGetUp(m, p, m.upT); m.upT += dt; }`. `holdForGetUp` / `getUpBlend` in `ragdoll.js` are the
  old blend, kept only so the page runs until then: delete them.
- **Facing.** The recording brings him up facing a way of its own (from his back: toward where his feet were;
  from his front: where his head was). `startGetUp` returns it. If the sim sets `p.fx, p.fz` to that on the
  `getup` event, the get-up is the recording with nothing added. If it doesn't, he is turned to the sim's
  facing as he comes up, his feet stepping round: fine up to about a quarter turn, hurried at a half turn.
- **Spot.** A man gets up over his feet, about half a metre from where his hips lay. `stepRagdoll` now slides
  the lying body so that spot is under the sim's `p.x, p.z` (it used to centre his middle on it), so keep
  passing `at` while he is `down`.
- **Throw-in.** Time runs from `-THROW.hold` (ball in both hands at his chest) through 0 (over his head) to
  `THROW.windup + THROW.release` (it leaves his hands: launch it from `throwInBall` a frame before, along his
  facing and up) and `THROW.follow` more. It throws the way the model faces, which is where `animate()` turned
  him: a standing man turns to the sim's ball, so keep the ball in front of him (or on him) while he waits.
- **Referee.** Call the whistle after the other signal in the same frame when both play; it has his left hand.
  A direct free kick or penalty uses the arm on the side `dir` is. `sig.hold` (seconds) stretches any signal:
  an indirect free kick's arm should stay up until the kick is taken. `sig.red` adds the other arm pointing
  him off. The card is 0.075 x 0.105 in its own x-y plane, facing `dir` along +z.

## Getting up

Three recorded get-ups from the CMU library (`game/brawl/anim/getups.js`, 198 KB, baked by
`node tools/build-getup.mjs dir-of-bvh`; `--scan 140_09` prints a take's timeline). The credit line is in the file.

| Lying on | Take | What the man does | As recorded |
| --- | --- | --- | --- |
| back | 140_09 | knees up, sits up, rocks forward over his feet with no hand down, squats, stands | 4.3 s |
| front | 139_16 | press-up, knees under, one foot then the other brought up, stands | 2.7 s |
| side | 139_18 | rolls onto his front and a hand, knees under, up | 4.0 s |

Which one, and which way round, is read off the ragdoll's last pose (chest to the sky, the grass or neither; a
man on his right side gets the side take in a mirror; on his back or front the mirror image is used when his
limbs fell nearer to it).

What isn't the recording:

- **Speed.** `GETUP_TIME` is 1.5 s; the people recorded took 2.7 to 4.3 s, so it plays 1.8 to 2.9 times
  quicker than life, the sit-up and the roll squeezed most, the push off the grass least (`keys` in `KINDS`).
- **The first 0.4 s** eases from however the ragdoll's limbs fell into the take's lying pose. A blend.
- **The last 0.5 s** eases from the take's ready crouch (the people recorded all end crouched, trunk 40 degrees
  forward) into the game's standing pose.
- **Where and which way** (above). Hands and feet marked as bearing on the grass in the bake are pinned to
  their spots by two-bone IK while he is turned and carried; a foot more than 18 cm out of place (less when
  the leg is folded) takes a step of 0.13 s.
- Nothing may be under the grass: the trunk is lifted, hands, feet, knees and elbows are bent up out of it.

Measured on a bare skeleton (`tests/unit/getup.test.js`, six falls ending on his back, front and side): first
frame within 2 mm of the ragdoll's pose, the frame at `GETUP_TIME` is the animation's pose exactly and the one
before is within 2 cm; lowest joint 1.5 cm over the grass; a pinned hand or foot within 3 cm of its spot;
fastest joint under 18 m/s facing the take's own way, under 24 m/s made to face any way.

Short of real:

- It is hurried. A real player often takes 2 s or more, and sits a moment first. A longer `GETUP_TIME` would
  only need `GETUP_TIME` changed (the keys are shares of it).
- One take per way of lying, so every get-up from the back is the same sit-up. A footballer more often rolls
  to a side and pushes up off a hand than rocks straight up from sitting.
- The ease-in is a blend: a limb that fell far from the take's lying pose crosses the grass at up to 12 m/s.
- Made to face the other way he spins on hands and knees or in the squat. Feet step, but knees and the seat
  of his shorts slide.
- A ragdoll seldom rests on its side (it rolls off), so the side take plays mostly for a man called up while
  still rolling. Its sheet is filmed from a man rolled onto his side by the look page (`&lie=side`).
- Hands don't press flat, fingers don't spread; no boot studs digging in; the shirt doesn't crease.

## Falling (the ragdoll)

`ragdoll.js` is the same Verlet body with four things a rag hasn't got (`TONE`): arms thrown out the way he is
falling, a landed arm that holds 0.12 s and gives over 0.4 s, the head kept up off the grass, legs that keep
some length for the first 0.9 s. Full strength for a knock under about 4.5 m/s (a trip), a quarter of it at
9 m/s and over (a brawl launch). A trip also tumbles far less: he pitches forward onto his hands and chest
and slides, where the old numbers took him right over his head. Hand-built from how people fall, not captured:
the library's falls (90_16 'fall on face', 90_18 'RugPullFall', 85_15) were not looked at.

Measured (same test): tripped at 2.2 to 4 m/s over four seeds, a hand is down in front of him before his chest
every time, his feet never pass 1 m up, and he ends on his front in at least 8 of 12 (the rest roll onto their
back). A launch at 9.8 m/s still takes his hips over 1.6 m up.

Short: it is still a ragdoll. No stumble before the fall, no roll out of it, no holding a shin afterwards;
the knees can fold either way; hands land but the fingers are not posed.

## Throw-in

Hand-built from the Laws (Law 15) and how it is coached: hands behind and to the sides of the ball, back
behind the head with the elbows out, knees bent and back arched with the hips forward, then the trunk snaps
forward and the arms whip over, the ball let go above and just in front of the head while the hands are still
speeding up (about 14 m/s, level or a little down: the sim sets the ball's own flight), arms following through at the target. The library has no two-handed overhead
throw (111_33 and 113_24 'Throwing' are one-armed throws and chest passes).

Measured (`tests/unit/throwin.test.js`): feet and toes within 2 mm of where they stood throughout; both palms
within 1.5 cm of the ball's surface while he has it; the ball goes behind his head, clears the top of it and
its middle is never nearer than 22 cm to the middle of his head; he starts from and returns to the standing pose exactly.

Short: both feet flat and parallel the whole way (no run-up, no step, no dragged back foot, no rising onto the
toes); one throw, the same every time (no short lob, no long throw with a run); he picks the ball up out of
thin air at his chest; head and eyes don't pick out a man.

## Referee

Hand-built over `animate()`'s pose: arms, a turn of the trunk and the head only; legs and hips untouched, so
it works standing, walking or running. Sources: Law 13's words for the indirect free kick ('raising the arm
above the head', held until the kick is taken and the ball touches another player) and the approved signals
drawn under Law 5 for the rest. From watching referees, not from the Laws: the whistle in the hand that isn't
signalling, the card out of the breast pocket first, full time as an arm straight up then brought down to point.

| kind | what he does |
| --- | --- |
| `free` | the arm on that side out 22 degrees above level, pointing along `dir`; trunk turned a little |
| `indirect` | right arm straight up |
| `penalty` | the arm on that side pointing 22 degrees below level at the mark, looking at it |
| `card` | right hand to the breast pocket (0.3 s), then straight up at full stretch, head to the player; `red`: left arm points him off |
| `advantage` | both arms swept forward and up (32 degrees) the way play goes, a shoulder's width apart |
| `whistle` | left hand to his lips |
| `halftime` / `fulltime` | whistle at his lips and the right arm straight up for a second, then the arm down to point along `dir` |

Measured (`tests/unit/refpose.test.js`): each of those angles; legs identical to the animation's every frame at
0, 1.6 and 5 m/s; first and last frames are the animation's pose; the card over 25 cm above his head, its face
within 11 degrees of the player.

Short: one fixed timing each; fingers are not posed (no pointing finger, no whistle or card in a closed hand:
the card floats at his fingertips); the pocket is always the breast pocket; on the run the signalling arm
loses its swing but his trunk still rocks as a runner's. `layerRefRun` (a more upright referee's run) was not
built: nothing to base it on but impression.
