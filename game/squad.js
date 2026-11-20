// Dresses the players on the pitch for a match: your team's kit on you and your teammates, the
// opponent's kit (or their change kit on a clash) on the defenders, and a keeper kit that stands out.
import { buildPlayer, buildYou } from './actors.js';
import { matchKit, keeperKit } from '../rules/teams.js';
import { pickSquad } from '../rules/looks.js';

const seedOf = id => [...id].reduce((a, c) => a + c.charCodeAt(0), 0);

// How each sim player looks this match (rules/looks.js): each team's players are drawn from that team's
// weights, stratified over the side so a small squad still matches its mix. One seed per match (per world),
// so the replay's copies get the same faces; a new match, a new draw.
const seeds = new WeakMap();
export function squadLooks(world, home, away, seed = null) {
  if (seed === null) { if (!seeds.has(world)) seeds.set(world, (Math.random() * 2 ** 31) | 0); seed = seeds.get(world); }
  const nums = side => world.players.filter(p => p.team === side).map(p => p.num);
  const h = pickSquad(home.id, nums('home'), seed), a = pickSquad(away.id, nums('away'), seed + 1);
  return Object.fromEntries(world.players.map(p => [p.id, (p.team === 'home' ? h : a)[p.num]]));
}

// One model per sim player. fullYou: you as a whole player (the replay camera sees you), not just boots.
// look: the locker's { boots, heads } (your boot color, big heads on everyone). make: the body (buildPlayer, or
// game/ps2/player.js's buildPlayer2). seed: the looks' seed (default: one per world, above).
export function buildSet(world, home, away, { fullYou = false, look: lk = {}, make = buildPlayer, seed = null } = {}) {
  const awayK = matchKit(away, home), gkK = keeperKit(awayK), models = {}, aps = squadLooks(world, home, away, seed);
  for (const p of world.players) {
    const look = p.num * 7 + seedOf(p.team === 'home' ? home.id : away.id), ap = aps[p.id];   // (look still picks the left-footers)
    models[p.id] = p.role === 'you' ? (fullYou ? make(home.kit, p.num, look, { boots: lk.boots || 0, ap }) : buildYou(home.kit, lk.boots || 0))
      : p.team === 'home' ? make(home.kit, p.num, look, { ap })
      : make(p.role === 'gk' ? gkK : awayK, p.num, look, { ap });
    models[p.id].bigHead = !!lk.heads;
    // 27% of outfield players are left-footed, the share counted among elite professionals (always the same ones: game/actors.js poses them); you are right-footed
    if (p.role !== 'you' && p.role !== 'gk' && (Math.imul(look + 11, 2654435761) >>> 0) % 100 < 27) models[p.id].foot = 'L';
  }
  return models;
}

export function createSquads(scene) {
  let models = {};
  return {
    get models() { return models; },
    // home, away: team objects from rules/teams.js
    dress(world, home, away, look = {}) {
      for (const m of Object.values(models)) scene.remove(m.root, m.shadow);
      models = buildSet(world, home, away, { look });
      for (const m of Object.values(models)) scene.add(m.root, m.shadow);
      return models;
    },
  };
}
