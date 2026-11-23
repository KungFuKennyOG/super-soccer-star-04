// In-world menus that work the same in the headset and the browser: mode select, team select with a
// player on a turntable wearing the kit, the cup hub (group table or bracket), and message screens.
// Navigate with a stick or the arrow keys, confirm with the trigger / A / Enter, back with B / Esc.
import * as THREE from 'three';
import { buildPlinth } from './ps2/props.js';
import { YEAR, uiPlane } from './ps2/ui.js';
import { renderBackdrop } from './ps2/menuscene.js';
import { MW, MH, paintMode, paintSettings, paintTeam, paintHub, paintMessage } from './ps2/menudraw.js';
import { buildPlayer2 as buildPlayer } from './ps2/player.js';
import { pickSquad } from '../rules/looks.js';
import { nationToward } from '../rules/teams.js';
import { currentFixture } from '../rules/cup.js';
import { WEATHER_SETTING } from '../rules/weather.js';
import { DIFFICULTY } from '../rules/tuning.js';
import { LOCKER } from './display.js';

const CUP_NAMES = { world: `WORLD CUP ${YEAR}`, club: 'CHAMPIONS CUP', attack: 'SCORE ATTACK' };
export const MODES = [
  { id: 'attack', name: 'SCORE ATTACK', sub: 'BEAT YOUR HIGH SCORE' },
  { id: 'world', name: `WORLD CUP ${YEAR}`, sub: '32 NATIONS: GROUPS + KNOCKOUTS' },
  { id: 'club', name: 'CHAMPIONS CUP', sub: '16 CLUBS: STRAIGHT KNOCKOUTS' },
  { id: 'training', name: 'TRAINING', sub: 'LEARN AND TEST EVERY MOVE' },
  { id: 'settings', name: 'SETTINGS', sub: 'OPTIONS AND YOUR LOCKER' },
];

// Settings, changed with left/right. Locker rows only offer what you've unlocked.
export const LENGTHS = [{ name: 'SHORT', mul: 0.6 }, { name: 'NORMAL', mul: 1 }, { name: 'LONG', mul: 1.5 }, { name: 'EPIC', mul: 2.5 }];
export const COMMENTARY = ['OFF', 'TEXT', 'VOICE'];
export const REPLAYS = ['OFF', 'ON'];
export const JUICE = ['OFF', 'ON'];
export const SKILLS = ['OFF', 'GESTURE', 'GRIP + GESTURE'];
export const ROWS = [
  { key: 'difficulty', name: 'DIFFICULTY', opts: DIFFICULTY.map(d => d.name) },
  { key: 'length', name: 'MATCH LENGTH', opts: LENGTHS.map(l => l.name) },
  { key: 'commentary', name: 'COMMENTARY', opts: COMMENTARY }, { key: 'replays', name: 'GOAL REPLAYS', opts: REPLAYS },
  { key: 'juice', name: 'HIT EFFECTS', opts: JUICE }, { key: 'skills', name: 'SKILL MOVES', opts: SKILLS },
  { key: 'weather', name: 'WEATHER', opts: WEATHER_SETTING },
  ...Object.entries(LOCKER).map(([k, l]) => ({ key: k, name: l.name, opts: l.options, locker: true })),
];
export function createMenus(scene, camera, renderer = null) {
  const { ctx, t: tex, m: panel } = uiPlane(MW, MH, 2.2, 1.65);
  panel.renderOrder = 12; panel.visible = false;
  const root = new THREE.Group(); root.visible = false; scene.add(root); root.add(panel);

  // the turntable: a plinth with a spotlight disc and whoever's kit you're looking at
  const table3d = new THREE.Group(); root.add(table3d);
  table3d.add(buildPlinth().group);                    // game/ps2/props.js: top at 0.18 m
  let model = null, modelFor = null;

  const head = new THREE.Vector3(), dir = new THREE.Vector3();
  let screen = null, sel = 0, data = {}, blink = 0;

  function place() {
    camera.getWorldPosition(head); camera.getWorldDirection(dir);
    const yaw = Math.atan2(dir.x, dir.z);
    root.position.set(head.x, 0, head.z); root.rotation.y = yaw;
    panel.position.set(screen === 'team' ? 0.75 : 0, head.y - 0.05, 2.6); panel.rotation.y = Math.PI;
    table3d.position.set(-1.05, 0, 2.4);
  }

  function showModel(team) {
    if (modelFor === team.id) return;
    if (model) table3d.remove(model.root);
    model = buildPlayer(team.kit, 10, 3 + team.id.charCodeAt(0), { ap: pickSquad(team.id, [10], 0)[10] });   // one of that team's looks (rules/looks.js)
    model.root.position.y = 0.18;
    table3d.add(model.root);
    modelFor = team.id;
  }

  /* ---------- drawing (game/ps2/menudraw.js paints, here only when something changed) ---------- */

  let shown = '', back = null, backFor = null;
  function draw() {
    const cupName = CUP_NAMES[screen === 'hub' ? data.cup.kind : data.mode];
    const blinkKey = screen === 'team' && data.mode === 'world' ? Math.floor(blink * 4) : 0;   // only the map's pulse moves
    const key = `${screen}|${sel}|${blinkKey}|${screen === 'settings' ? JSON.stringify(data.settings) : ''}`;
    if (key === shown) return;
    shown = key;
    if (screen === 'mode') paintMode(ctx, { modes: MODES, sel, back });
    else if (screen === 'settings') paintSettings(ctx, { rows: ROWS, settings: data.settings, sel, back });
    else if (screen === 'team') { paintTeam(ctx, { mode: data.mode, teams: data.teams, sel, blink, cupName, back }); showModel(data.teams[sel]); }
    else if (screen === 'hub') paintHub(ctx, { cup: data.cup, blink, cupName, back });
    else paintMessage(ctx, { ...data, blink, back });
    tex.needsUpdate = true;
  }

  return {
    get screen() { return screen; },
    get sel() { return sel; },
    // the picture behind the menus (game/ps2/menuscene.js), wearing this team's kit; rendered once per team
    backdrop(team) {
      if (!renderer || backFor === team.id) return;
      try { back = renderBackdrop(renderer, team.kit, team.id); backFor = team.id; shown = ''; } catch (e) { console.warn('menu backdrop', e); }
    },
    // screen: 'mode' | 'settings' | 'team' | 'hub' | 'message'. data depends on the screen:
    // mode {}, settings { settings }, team { mode, teams, start? },
    // hub { cup }, message { title, lines: [{ text, big?, color? }], ok? }
    open(s, d = {}, at = 0) {
      screen = s; data = d; sel = at; shown = '';
      if (s === 'team' && d.start) sel = Math.max(0, d.teams.findIndex(t => t.id === d.start));
      root.visible = panel.visible = true;
      table3d.visible = s === 'team';
      place(); draw();
    },
    close() { screen = null; root.visible = false; },
    // nav: { up, down, left, right, ok, back } edges. Returns an action or null:
    // { mode } | { team } | { play: true } | { quit: true } | { ok: true } | { back: true }
    update(dt, nav) {
      if (!screen) return null;
      blink += dt;
      if (model && table3d.visible) model.root.rotation.y += dt * 0.9;
      let act = null;
      if (screen === 'mode') {
        const n = MODES.length;
        if (nav.up) sel = (sel + n - 1) % n;
        if (nav.down) sel = (sel + 1) % n;
        if (nav.ok) act = { mode: MODES[sel].id };
      } else if (screen === 'settings') {
        const n = ROWS.length, st = data.settings, r = ROWS[sel];
        if (nav.up) sel = (sel + n - 1) % n;
        if (nav.down) sel = (sel + 1) % n;
        const dir = nav.right ? 1 : nav.left ? -1 : 0;
        if (dir) {
          const opts = r.opts.map((_, i) => i), at = Math.max(0, opts.indexOf(st[r.key] || 0));
          const to = opts[Math.max(0, Math.min(opts.length - 1, at + dir))];
          if (to !== st[r.key]) { st[r.key] = to; act = { settings: st }; }
        }
        if (nav.back) act = { back: true };
      } else if (screen === 'team' && data.mode === 'world') {
        for (const d of ['left', 'right', 'up', 'down']) {
          if (!nav[d]) continue;
          const to = nationToward(data.teams[sel].id, d);
          if (to) sel = data.teams.findIndex(t => t.id === to);
        }
        if (nav.ok) act = { team: data.teams[sel] };
        if (nav.back) act = { back: true };
      } else if (screen === 'team') {
        const n = data.teams.length;
        if (nav.left || nav.up) sel = (sel + n - 1) % n;
        if (nav.right || nav.down) sel = (sel + 1) % n;
        if (nav.ok) act = { team: data.teams[sel] };
        if (nav.back) act = { back: true };
      } else if (screen === 'hub') {
        if (nav.ok && currentFixture(data.cup)) act = { play: true };
        if (nav.back) act = { quit: true };
      } else if (nav.ok) act = { ok: true };
      draw();
      return act;
    },
  };
}
