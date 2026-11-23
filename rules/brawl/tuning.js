// The flat-screen brawl: every number that sets how it feels. Pure data: no three, no DOM.
// Units: metres, seconds, m/s. The pitch lies on X/Z, length along Z. Home attacks the goal at z = -halfL,
// away attacks the goal at z = +halfL.

// Pitch and shape per side size. Formation slots: [x as a share of halfW, depth from your own goal line as a
// share of the pitch length (0 = your goal line, 0.5 = halfway), line: gk / def / mid / fwd].
export const SIZES = {
  6: {
    halfW: 24, halfL: 36,
    shape: [[0, 0.02, 'gk'], [-0.45, 0.2, 'def'], [0.45, 0.2, 'def'], [-0.5, 0.34, 'mid'], [0.5, 0.34, 'mid'], [0, 0.44, 'fwd']],
    nums: [1, 4, 5, 8, 7, 9],
  },
  11: {
    halfW: 34, halfL: 52.5,
    shape: [[0, 0.015, 'gk'],
      [-0.72, 0.17, 'def'], [-0.26, 0.14, 'def'], [0.26, 0.14, 'def'], [0.72, 0.17, 'def'],
      [-0.66, 0.32, 'mid'], [-0.22, 0.29, 'mid'], [0.22, 0.29, 'mid'], [0.66, 0.32, 'mid'],
      [-0.2, 0.45, 'fwd'], [0.2, 0.45, 'fwd']],
    nums: [1, 2, 5, 6, 3, 7, 4, 8, 11, 9, 10],
  },
};

export const GOAL2 = { halfW: 3.66, h: 2.44, depth: 2.0, post: 0.06 };

export const BALL2 = { r: 0.12, g: 9.81, rollFric: 1.3, rollDrag: 0.3, bounce: 0.55 };

export const RUN = {
  jog: 4.6, run: 6.4, sprint: 8.0,         // off the ball
  dribble: 5.6, dribbleSprint: 7.2,        // on it
  accel: 22, turn: 14,
  gk: 5.5,
};

// Passing and shooting. A ground pass is paced to arrive at about `arrive` m/s; a shot's speed is
// shot[0] + shot[1] x power (power 0..1, from how long the button was held).
export const KICK = {
  passMin: 9, passMax: 26, arrive: 7, lobAt: 26,       // a pass longer than lobAt m goes in the air
  shot: [17, 15], maxHold: 0.9, overHold: 1.25,         // held past overHold: skied
  pickup: 0.85, pickupUp: 1.1,                          // how near a player must be to take a loose ball (m), ball height limit
  noRetake: 0.3,                                        // the kicker can't take it back this soon
  control: 19,                                          // faster than this a ball bounces off whoever it hits
};

// Hits. A lunge is a burst forward for `t` s; anyone it reaches inside `reach` m is sent flying.
// launch: horizontal speed base + k x the hitter's speed (x big if he was sprinting), up [lo, hi] m/s.
// CHAOS multiplies how far everyone flies (the page's setting: 1 normal, 1.6 unhinged).
export const HIT = {
  lunge: 9.5, t: 0.34, reach: 1.15, cool: 0.9, miss: 0.55,      // a missed lunge: on the floor this long
  base: 4.5, k: 0.45, big: 1.5, up: [3, 7],
  jab: 0.38,                                                     // a lunge that isn't a big one: he's knocked over more than sent flying
  barge: 1.6,                                                    // the man on the ball shoves anyone inside this
  domino: 6.5, dominoR: 1.0, dominoKeep: 0.62,                    // a flying body flattens whoever it hits faster than this
  shotLaunch: 24,                                                // a shot faster than this sends the man it hits flying
};

// A body in the air: its middle (about hip height) under gravity, bouncing and sliding to a stop.
export const BODY = { y: 0.95, rest: 0.22, bounce: 0.3, slide: 12, down: [1.3, 2.1], getup: 0.75, ground: 0.25 };

// The AI. press: how many defenders go for the man on the ball; tackleAt: lunge from this far;
// aggro: how often a lunge is a full-speed sprint at him (a big hit) rather than a jab.
export const BRAIN = {
  think: 0.22, press: 2, tackleAt: 2.4, aggro: 0.4, lungeRate: 1.2, shootFrom: 24, shootOpen: 30,
  pressured: 3.2, passLook: 0.8, keepHold: 1.1,
};

export const KEEPER = { line: 1.2, track: 0.1, reach: 2.4, reachUp: 2.6, react: 0.12, dive: 7.5, claim: 9, catchBelow: 21 };

// The referee (rules/brawl/referee.js): behind the ball by `behind` m on a diagonal that reaches diag of the
// half-width at the goal lines, between near and far m from the ball; how long each signal lasts (s); calm:
// how long he leaves it before waving the brawl on again.
export const REF = {
  behind: 8, diag: 0.55, near: 10, far: 20, run: 6.5, jog: 3.8, accel: 6, calm: 4,
  sig: { whistle: 0.5, free: 2, indirect: 2, penalty: 2, card: 2.2, advantage: 1.2, halftime: 2, fulltime: 2 },
};

// The clock: a match lasts `real` seconds and the scoreboard shows 90 minutes over it.
export const CLOCK = { real: 240, kickoff: 1.2, goal: 3.2, restart: 1.4, half: 3 };

// Plain football's referee (rules/brawl/fouls.js). A tackle on the man on the ball: win (or slideWin) is
// how often it comes off, x behindWin from behind; a slide from behind that wins it is still a foul
// throughBack of the time; one that doesn't come off is a foul slideFoul (standFoul for a standing one).
// Cards: red for a slide from behind, yellow by kind of tackle; a second yellow is a red.
export const FOUL = {
  win: 0.62, slideWin: 0.8, behindWin: 0.6, throughBack: 0.25, slideFoul: 0.4, standFoul: 0.12,
  red: 0.03, yellowBehind: 0.35, yellowSlide: 0.15, yellowStand: 0.02, boxCare: 0.35, fall: [2.6, 1.4],      // a fouled man goes down: speed along his run, up
};

// Set pieces (rules/brawl/setpiece.js). The taker walks to the ball (teleported there after walkMax s),
// waits (the AI for aiWait s, a penalty penWait; you as long as you like, up to humanWait), then runs up
// from runup m behind it at runSpeed and strikes it. A throw-in is let go throwRelease s after he starts
// it (game/brawl/throwin.js's wind-up plus release). Free kicks within wallFrom m of goal get a wall.
export const TAKE = {
  reach: 0.4, walkMax: 5, aiWait: [0.8, 1.6], penWait: 1.4, humanWait: 12,
  runup: { free: 2.2, penalty: 3.2, corner: 1.6, goalkick: 2.2 }, runSpeed: 4.2, throwRelease: 0.55,
  gap: 9.15, wallFrom: 32, wall: { 6: 2, 11: 4 }, spot: 11,
};
