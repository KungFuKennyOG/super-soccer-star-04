// What the commentator says in the brawl. He calls the football as he always has (the recorded clips in
// game/assets/voice) and never once admits that anything unusual is happening: the hits get the driest
// lines he has (subtitles, and the browser's own voice if it has a British one; they aren't recorded).
// Pure: pickLine(event, w, rnd) → { id?, text, pri } or null. id: a recorded clip.

const CLIPS = {
  kickoff: ['kickoff1', 'kickoff2', 'kickoff3'],
  goal: ['goal1', 'goal2', 'goal3', 'goal4', 'goal5', 'goal6', 'goal7', 'goal8'],
  saved: ['saved1', 'saved2', 'saved3', 'saved4', 'saved5'],
  post: ['post1', 'post2'],
  tackled: ['tackled1', 'tackled2', 'tackled3'],
  shot: ['shot1', 'shot2', 'shot3', 'shot4'], wide: ['wide1', 'wide2'], over: ['over1', 'over2'], parried: ['parried1', 'parried2'],
  claim: ['claim1', 'claim2'], cross: ['cross1', 'cross2'], level: ['level1'],
  fulltime: ['fulltime1', 'fulltime2', 'fulltime3'],
};
// the subtitles of those clips (game/assets/voice/lines.json)
export const CLIP_TEXT = {
  kickoff1: 'HERE WE GO!', kickoff2: "AND WE'RE UNDER WAY!", kickoff3: 'THE CROWD ARE ON THEIR FEET!',
  goal1: 'GOAL! GOAL! GOAL!', goal2: 'WHAT A GOAL!', goal3: 'HE SCORES!', goal4: "IT'S IN THE BACK OF THE NET!", goal5: "OH, THAT'S A BEAUTY!",
  goal6: "AND IT'S THERE!", goal7: 'WHAT A FINISH!', goal8: "HE'S ONLY GONE AND DONE IT!",
  saved1: 'GREAT SAVE!', saved2: 'SAVED BY THE KEEPER!', saved3: 'THE KEEPER GETS DOWN WELL!', saved4: 'WHAT A STOP!', saved5: 'DENIED BY THE KEEPER!',
  post1: 'OFF THE POST!', post2: 'HITS THE WOODWORK!',
  shot1: 'HE SHOOTS!', shot2: 'LETS FLY!', shot3: 'GOES FOR GOAL!', shot4: 'HE HAS A GO!', wide1: 'JUST WIDE!', wide2: 'DRAGGED WIDE!',
  over1: 'OVER THE BAR!', over2: "THAT'S GONE INTO THE STANDS!", parried1: 'PARRIED AWAY!', parried2: "SPILLED! IT'S LOOSE!",
  claim1: 'THE KEEPER COMES OUT AND CLAIMS IT.', claim2: 'SWEPT UP BY THE KEEPER!', cross1: "HERE'S THE CROSS!", cross2: 'CROSSED IN!', level1: "IT'S ALL SQUARE!",
  tackled1: 'GREAT TACKLE!', tackled2: 'LOST IT!', tackled3: "HE'S BEEN DISPOSSESSED!",
  fulltime1: "AND THAT'S FULL TIME!", fulltime2: 'THE REFEREE BLOWS FOR FULL TIME.', fulltime3: "IT'S ALL OVER!",
};

// The referee's calls and the stoppages: not recorded (subtitles, and the browser's voice if it has one).
export const CALLS = {
  foul: ['Free kick.', "That's a foul.", 'The referee blows for a foul.', 'He caught him there.'],
  penalty: ['PENALTY!', "IT'S A PENALTY!", 'The referee points to the spot!'],
  yellow: ["He's going in the book.", 'A yellow card.', 'Booked.'],
  red: ["RED CARD! HE'S OFF!", 'Sent off!', "That's a red. He's going for an early bath."],
  second: ["Second yellow! He's off!"],
  offside: ["The flag's up. Offside.", 'Offside.', 'Flagged offside.'],
  halftime: ["And that's half time.", 'The referee blows for half time.'],
  shootout: ["IT'S GOING TO PENALTIES!", 'Level after ninety minutes. Penalties!'],
  corner: ['Corner.', 'A corner kick.'], scored: ['SCORES!', 'IN!', 'Sends the keeper the wrong way!'], missed: ['MISSED!', 'SAVED!', "He's missed it!"],
};

export const DRY = {
  big: ['A firm challenge there.', "He'll feel that one in the morning.", 'Strong in the tackle.', 'The referee waves play on.',
    "That's a coming-together.", 'Committed. Very committed.', "He's let him know he's there.", 'Plenty of contact on that one.',
    "I don't think the referee saw that. I'm not sure anybody did.", 'Robust stuff from the visitors.', "And he's down. Physical game, this."],
  far: ["He's travelled a long way there.", 'Looking for a free kick, I think.', 'Some distance, that.', 'And that will be in the second tier.'],
  domino: ["And he's taken a few of them with him.", "That's two for the price of one.", 'A chain reaction in midfield.', 'Skittles.'],
  shot: ["He's blocked that with his whole body.", 'Put his body on the line there. All of it.', 'Brave. Very brave. Possibly unconscious.'],
  boards: ['Into the advertising hoardings.', 'Off the pitch altogether, that one.', "He'll want a word with the groundsman."],
  miss: ["He's gone in with everything and found nothing.", 'Mistimed, that. By some distance.', "He'll want that one back."],
  cheap: ['Off the ball, that. Nobody saw it.', 'A little reminder, off the ball.'],
  barge: ['Shrugged off.', "He's just gone straight through him.", 'Strength on the ball there.'],
};

const pick = (a, rnd) => a[Math.floor(rnd() * a.length) % a.length];
const clip = (k, rnd, pri) => { const id = pick(CLIPS[k], rnd); return { id, text: CLIP_TEXT[id] || '', pri }; };

export function pickLine(e, w, rnd = Math.random) {
  switch (e.type) {
    case 'kickoff': return w.clock < 1 ? clip('kickoff', rnd, 2) : null;
    case 'goal': return w.score.home === w.score.away && rnd() < 0.4 ? clip('level', rnd, 5) : clip('goal', rnd, 5);
    case 'saved': return e.kind === 'parry' && rnd() < 0.5 ? clip('parried', rnd, 3) : clip('saved', rnd, 3);
    case 'post': return clip('post', rnd, 3);
    case 'fulltime': return clip('fulltime', rnd, 6);
    case 'tackled': return rnd() < 0.5 ? clip('tackled', rnd, 1) : null;
    case 'shot': return w.phase === 'play' && rnd() < 0.45 ? clip('shot', rnd, 1) : null;
    case 'out': return e.byShot ? clip(rnd() < 0.5 ? 'wide' : 'over', rnd, 2) : null;
    case 'claim': return rnd() < 0.5 ? clip('claim', rnd, 1) : null;
    case 'whistle': return { text: pick(e.kind === 'penalty' ? CALLS.penalty : CALLS.foul, rnd), pri: e.kind === 'penalty' ? 4 : 2 };
    case 'card': return { text: pick(e.second ? CALLS.second : CALLS[e.color], rnd), pri: e.color === 'red' ? 4 : 3 };
    case 'offside': return { text: pick(CALLS.offside, rnd), pri: 2 };
    case 'halftime': return { text: pick(CALLS.halftime, rnd), pri: 5 };
    case 'shootout': return { text: pick(CALLS.shootout, rnd), pri: 5 };
    case 'pen': return { text: pick(e.scored ? CALLS.scored : CALLS.missed, rnd), pri: 4 };
    case 'taking': return e.kind === 'corner' ? clip('cross', rnd, 1) : null;
    case 'launch':
      if (e.kind === 'domino') return { text: pick(DRY.domino, rnd), pri: 2 };
      if (e.kind === 'shot') return { text: pick(DRY.shot, rnd), pri: 3 };
      if (e.kind === 'barge') return rnd() < 0.5 ? { text: pick(DRY.barge, rnd), pri: 1 } : null;
      if (e.kind === 'big' || e.power > 9) return { text: pick(DRY.big, rnd), pri: 2 };
      return rnd() < 0.25 ? { text: pick(DRY.big, rnd), pri: 1 } : null;
    case 'landed': return e.flown > 22 ? { text: pick(DRY.far, rnd), pri: 2 } : null;
    case 'boards': return rnd() < 0.5 ? { text: pick(DRY.boards, rnd), pri: 1 } : null;
    case 'miss': return e.quiet ? null : { text: pick(DRY.miss, rnd), pri: 1 };
    case 'cheap': return rnd() < 0.6 ? { text: pick(DRY.cheap, rnd), pri: 1 } : null;
    default: return null;
  }
}
