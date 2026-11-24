# The flat-screen 11 v 11 (branch `flat-11v11`)

Status, 22 Nov 2026. A first playable prototype of the flat-screen game Kenny asked for: "a knock-off FIFA for
now", 11 v 11 (or 6 v 6) on a whole pitch, in the '04 look, on a TV camera, keyboard or pad. Tackles that send
people flying were built first and are now an option (Kenny: "no need for the tackles that launch players...
or just make it an option if u already made it"). Default is plain football.

Open `brawl.html` (`npm run serve`, then `/brawl.html`). The VR game (`index.html`) is untouched.

## What's there

- **Menu**: your team, opponent (all 49), 11 v 11 or 6 v 6, physicality (Normal football / Brawl: robust /
  Brawl: unhinged), match length, weather; KICK OFF or WATCH A MATCH (AI on both sides). Settings live in the
  URL (`?n=11&home=BRA&away=GER&chaos=0&len=240&wx=clear&play=1`); `chaos=0` is plain football.
- **Pitch**: 105 x 68 for 11 v 11, 72 x 48 for 6 v 6. The '04 stadium is built round the whole pitch: stands on
  all four sides, both goals, both boxes, the centre circle, ultras behind one goal. The ground code reads its
  size from `game/ps2/arena.js`; its default is the VR half pitch exactly as before (groundplan tests pass).
- **Players**: the '04 bodies and every animation the VR game has (mocap runs, dribble touches, kicks,
  keepers' saves), kits by `matchKit`, keeper kits, squad looks, left-footers.
- **Controls** (`game/brawl/pad.js`): WASD / arrows run, Shift sprint, J pass (to the man the stick points
  at; long or blocked ones are lofted), K shoot (hold for power, too long skies it, the stick aims across the
  goal), L tackle (sprinting: a slide; on the ball: a shoulder), Space switch man, P pause. Pad: stick, RT
  sprint, A pass, B shoot, X tackle, LB switch, Start. You become whoever the ball is passed to.
- **Match** (`rules/brawl/`, pure, `tests/unit/brawl.test.js`): two goals with posts, bar and nets, throw-ins,
  corners, goal kicks (simplified: the ball goes back on and the side that put it out waits), kick-offs, a
  4-minute match shown as 90. No offside, no fouls, no cards.
- **AI** (`rules/brawl/ai.js`): a formation (4-4-2, or 2-2-1 + keeper) that slides with the ball and pushes up
  in possession, forwards running beyond, one presser (two in your own half), carriers who dribble at goal,
  pass when pressed and shoot when they see it. Keepers stay on the line, claim loose balls and dive (catch,
  parry or beaten).
- **Commentary**: the recorded clips for kick-off, goals, saves, the woodwork, tackles and full time.
- **Brawl mode** (the option): hits send men flying as Verlet ragdolls (`game/brawl/ragdoll.js`: 18 point
  masses on the skeleton, sticks the length of the bones, the bones turned to lie along them), flying bodies
  flatten others, a thunderbolt shot takes out whoever it hits, off-the-ball hits, the get-up blends back
  into the animation. The commentator plays it dead straight (subtitles, plus the browser's British voice if
  it has one: those lines aren't recorded).

## Checked

- `npm run check` (lint + 320 unit tests), the brawl smoke test and the VR smoke tests (with an installed
  Chrome: `CHROME=/usr/bin/google-chrome`).
- AI v AI over many 4-minute matches, plain football: 11 v 11 about 15 shots, 9 saves, 4 to 5 goals a match;
  6 v 6 about 17 shots, 5 to 6 goals. Arcade-high on purpose; tune in `rules/brawl/tuning.js` (`KEEPER`,
  `BRAIN`) and the shot gates in `ai.js`.
- Stills: `node tools/brawlshots.mjs out/b 5 20` (AI v AI, seeded; `CLOSE=1` adds a close-up of anyone off his
  feet, `WIDE=1` the ground from above and behind each goal, `Q='n=6&chaos=1'`).

## Added 23 Nov 2026 (Kenny: fouls, offside, penalties, halves, cups, set-piece takers, an aim marker, a real get-up, a referee; animations by a Fable session)

- **Fouls and cards** (normal football only; the brawl's referee waves everything on): `rules/brawl/fouls.js`
  judges a tackle clean, a miss or a foul; the fouled man trips (a ragdoll fall) and gets up; yellow, red,
  a second yellow sends him off (`state: 'off'`, model hidden); defenders are careful in their own box.
  Numbers in `FOUL` (tuning). AI v AI: about 9 fouls, 2 yellows and 0.3 reds a 4-minute match.
- **Offside** (`rules/brawl/offside.js`): judged as the ball is played, caught on his touch, indirect free
  kick; never from a throw-in, corner or goal kick. The AI stays onside, so it's mostly you who gets caught.
- **Set pieces** (`rules/brawl/setpiece.js`): the taker walks to the ball, waits, runs up and strikes it;
  yours wait for you (J plays it, K holds and shoots). Throw-ins are picked up and thrown over the head.
  Free kicks near goal get a wall; everyone else stands 9.15 m off; attackers go into the box for corners.
  Penalties: the keeper guesses as it's struck (when it's against you, he dives the way you hold the stick).
- **Halves**: ends change at half time; the other side kicks off.
- **Shoot-outs** (`rules/brawl/shootout.js`): knockout ties level after 90 minutes; five each, then sudden death.
- **Cups** (menu: START A CUP / CONTINUE): the World Cup for a nation, the Champions Cup for a club
  (`rules/cup.js`, `playUser` now takes a shoot-out result), saved in localStorage, no continues.
- **Aim** (`game/brawl/aim.js`): a reticle on the goal where your shot is going while you hold shoot (red
  when held too long), and a ring under the man a pass would go to.
- **Referee** (`rules/brawl/referee.js`, model in `view.js`): runs the diagonal 10 to 20 m from the ball,
  walks over to book, signals free kicks, the spot, offside, half and full time, waves the brawl on. Black
  kit, yellow when a side wears a dark shirt.
- **Animations** (the Fable session; its notes are in `docs/brawl-anim.md`): get-ups from the back, front
  and side baked from CMU mocap (`game/brawl/getup.js`, `GETUP_TIME` 1.5 s), falls with the hands going
  out, the throw-in (`throwin.js`), the referee's signals and card (`refpose.js`). Look page
  `tools/animlook.html`, sheets `node tools/animshots.mjs out/anim`.
- Stills of moments in a real match: `UNTIL="w.sp && w.sp.kind === 'throw' && w.sp.stage === 'ready'"
  FOLLOW="w.byId[w.sp.taker]" node tools/brawlshots.mjs out/t 0.2 0.8 1.4` (`PRE=` changes the match first).

## Chaos (23 Nov 2026, evening): the default mode

Kenny: integrate violent, absurd elements, keep the realistic look, fun and not unfair; "it has to be
triggered by the player to give an advantage"; look at how the games that do this well do it. Menu: Rules =
Chaos (default) / Total chaos / By the book (the real-rules football above, unchanged). `rules/brawl/chaos.js`,
`game/brawl/chaosview.js`, `tests/unit/chaos.test.js`. Nothing happens by itself.

- **Favours.** Each side has a meter (under the score) filled by playing: passes, shots, saves, hits given
  and taken, conceding; a side that's behind fills quicker (`CHAOS.earn`). A full meter is a favour, held
  until you call it in (I / pad Y); the AI calls its own after a moment. About 6 a side in a 4-minute match.
  - FURNITURE: three things from the upper tier (fridge, sofa, vending machine, portable loo, wardrobe)
    land round their man on the ball. A shadow and ring 2.4 s before; flattens anyone under it, yours too.
  - MEDICAL BUGGY: crosses the pitch level with the ball, through whoever is in its lane (shown first).
  - A SUPPORTER: one of yours runs on and goes for their men; a tackle from them removes him.
  - THE HEAVY BALL: for 16 s your side's hard passes and shots flatten their men.
  - A WORD FROM THE REF: the referee blows, stares, then sprints at their last man to flatten one of
    yours (a ring under him). He gives up after 8 s.
  Never near a goalmouth (drops 12 m off the goal line, the buggy outside the boxes), never cancels a goal.
- **Super shot** (RedCard 2003's boost meter: spend the bar on a slow-motion super kick): with a favour
  in hand, hold shoot to a full bar and let go before it's overcooked. 34 m/s, through their men, the
  keeper's odds halved. It costs the favour. The AI does it 35% of the time it shoots with one.
- **Dodge** (Mario Strikers: a timed dodge beats a tackle and gives a burst): U / pad RB. Tackles,
  supporters and the referee go past; the tackler falls; 1.5 s of extra pace. The AI dodges now and then.
- **Late hits** (NFL Blitz): you can still flatten people while a goal is celebrated; 35% of the time one
  of theirs goes for your scorer. A late hit feeds the victims' meter.
- **The referee can be flattened** (Mutant Football League's ref attack): it stops him coming for your
  man, feeds the other side's meter, and he gets up and carries on.
- **The crowd**: a man knocked over the boards at speed disappears into the stand and is thrown back on.
- **It builds**: hits send men 0.8x as far early and 1.3x late (`CHAOS.ramp`).
- What was deliberately not copied: Mutant Football League's bribed referee and erased plays (reviewed as
  cheap: no warning, no counter), Strikers' two-goal shots and cartoon items.
- Measured, AI v AI, 10 matches each: favours used 6.7 v 6.7 (6 v 6) and 6.0 v 6.0 (11 v 11); shortest
  warning before anything landed 1.9 s; goals 6.7 and 3.1 a match.
- Short: no dodge animation (he just darts); a supporter is a player body in his side's shirt and jeans-blue
  shorts, hard to tell from a player in a white kit; the buggy has no driver; no dust or dents where things
  land; all the new commentary is subtitles only. Not seen on a real GPU, not played by a person.

## Not done / short

- Nothing measured on a real GPU (headless software GL only). 23 '04 bodies take about 7 to 10 s to build.
- No advantage, no extra time (knockouts go straight to penalties), no substitutions, no injury time.
- Free kicks are all direct in effect (an offside's indirect free kick can be shot straight in).
- Corners are rare in AI v AI (the ball seldom goes out over the goal line); throw-ins a couple a match.
- Penalties: no penalty-taker choice, no stutter run-up; the keeper doesn't move on his line before it.
- The get-up is quick (real players often take 2 s+), one take per lie; falls are still a ragdoll; the
  throw-in is one throw with the feet flat; the referee has no pointing finger and his card floats at his
  fingertips (see `docs/brawl-anim.md`).
- The commentator's lines for fouls, cards, offside and half time aren't recorded (subtitles, plus the
  browser's British voice if it has one).
- The AI is simple: no overlaps, crosses or one-twos on purpose.
- The deadpan brawl lines aren't recorded (the voice tool needs the TTS models).
