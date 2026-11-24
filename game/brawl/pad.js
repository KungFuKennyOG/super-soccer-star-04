// Controls for the flat-screen brawl: keyboard and any standard gamepad, turned into the sim's input
// (rules/brawl/sim.js). The camera looks across the pitch from the +x touchline, so on screen right is -z
// and up (away from you) is -x: the stick is turned into the world here.
//   Keyboard: WASD / arrows run, Shift sprint, J pass, K shoot (hold to power it), L tackle (on the ball:
//   barge), Space switch man, P pause.
//   Pad: left stick run, RT or R1 sprint, A pass, B shoot (hold), X tackle, LB switch, Start pause.
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const was = {};
const edge = (name, on) => { const e = on && !was[name]; was[name] = on; return e; };

export function readInput() {
  const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(g => g && g.connected);
  const b = i => !!(gp && gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
  let sx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let sy = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  if (gp && Math.hypot(gp.axes[0], gp.axes[1]) > 0.18) { sx = gp.axes[0]; sy = -gp.axes[1]; }
  const l = Math.hypot(sx, sy);
  if (l > 1) { sx /= l; sy /= l; }
  const pass = !!keys.KeyJ || b(0), shoot = !!keys.KeyK || b(1), tackle = !!keys.KeyL || b(2), sw = !!keys.Space || b(4);
  const call = !!keys.KeyI || b(3), dg = !!keys.KeyU || b(5);
  const pause = !!keys.KeyP || !!keys.Escape || b(9);
  return {
    move: { x: -sy, z: -sx },
    sprint: !!(keys.ShiftLeft || keys.ShiftRight) || b(7),
    pass: edge('pass', pass), shoot, tackle: edge('tackle', tackle), switch: edge('switch', sw), call: edge('call', call), dodge: edge('dodge', dg), pause: edge('pause', pause),
    pad: !!gp,
  };
}
