// All sound synthesized: kicks, net, post, whistle, and a crowd that murmurs, gasps and roars.
// startAudio() must run from a click or trigger press.

let ctx = null, master = null, crowd = null, crowdLevel = 0.12;

export function startAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new AudioContext(); } catch (e) { return; }
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  crowd = makeCrowd();
}

const now = () => ctx.currentTime;

// For the music player: the shared context and master bus (null until startAudio ran).
export const audioOut = () => (ctx ? { ctx, master } : null);

function noiseBuffer(secs) {
  const b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.3; d[i] = last; }
  return b;
}

function env(g, a, peak, d, t0 = now()) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function makeCrowd() {
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(4); src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = crowdLevel;
  src.connect(bp); bp.connect(g); g.connect(master); src.start();
  return { g, bp };
}

// swell the crowd to level over secs, then settle back
function crowdSwell(level, freq, secs) {
  if (!crowd) return;
  const t = now();
  crowd.g.gain.cancelScheduledValues(t); crowd.g.gain.setValueAtTime(crowd.g.gain.value, t);
  crowd.g.gain.linearRampToValueAtTime(level, t + 0.25);
  crowd.g.gain.linearRampToValueAtTime(crowdLevel, t + secs);
  crowd.bp.frequency.cancelScheduledValues(t); crowd.bp.frequency.setValueAtTime(crowd.bp.frequency.value, t);
  crowd.bp.frequency.linearRampToValueAtTime(freq, t + 0.3);
  crowd.bp.frequency.linearRampToValueAtTime(700, t + secs);
}

export function sfx(name, strength = 1) {
  if (!ctx) return;
  const t = now();
  if (name === 'tap') {
    // a dribbling touch: a soft low thud, much quieter than a kick
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.07);
    env(g, 0.003, 0.09 * strength, 0.08, t);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.12);
  } else if (name === 'kick' || name === 'pass' || name === 'touch') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(name === 'touch' ? 140 : 180, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    env(g, 0.003, name === 'touch' ? 0.25 : 0.4 + 0.5 * strength, 0.14, t);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
    const n = ctx.createBufferSource(), ng = ctx.createGain(), hp = ctx.createBiquadFilter();
    n.buffer = noiseBuffer(0.1); hp.type = 'highpass'; hp.frequency.value = 1800;
    env(ng, 0.001, 0.3 * strength, 0.05, t);
    n.connect(hp); hp.connect(ng); ng.connect(master); n.start(t);
  } else if (name === 'net') {
    const n = ctx.createBufferSource(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    n.buffer = noiseBuffer(0.6); bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 1.5;
    env(g, 0.01, 0.5, 0.45, t);
    n.connect(bp); bp.connect(g); g.connect(master); n.start(t);
  } else if (name === 'post') {
    for (const f of [880, 1320, 2093]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      env(g, 0.002, 0.18, 0.9, t);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 1);
    }
  } else if (name === 'whistle') {
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 2900; lfo.frequency.value = 38; lg.gain.value = 140;
    lfo.connect(lg); lg.connect(o.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.setValueAtTime(0.12, t + 0.35 * strength); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4 * strength);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + 0.5 * strength); lfo.stop(t + 0.5 * strength);
  } else if (name === 'perfect') {
    [988, 1319].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = f;
      env(g, 0.002, 0.06, 0.08, t + i * 0.06);
      o.connect(g); g.connect(master); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.12);
    });
  } else if (name === 'call') {        // a two-note whistle: "over here!"
    [[1650, 2300], [1900, 2600]].forEach(([a, b], i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), at = t + i * 0.16;
      o.type = 'sine'; o.frequency.setValueAtTime(a, at); o.frequency.exponentialRampToValueAtTime(b, at + 0.1);
      env(g, 0.01, 0.12, 0.06, at);
      o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.14);
    });
  } else if (name === 'swish') {       // the ball whipped round your feet
    const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noiseBuffer(0.25); bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.18);
    env(g, 0.02, 0.35 * strength, 0.2, t);
    n.connect(bp); bp.connect(g); g.connect(master); n.start(t); n.stop(t + 0.3);
  } else if (name === 'fanfare') {
    // the cup goes up: a short brass call (our own: three pick-up notes, a rising chord, held)
    const notes = [[392, 0, 0.13], [392, 0.15, 0.13], [392, 0.3, 0.13], [523.25, 0.45, 0.42], [659.25, 0.9, 0.2], [783.99, 1.12, 0.2], [1046.5, 1.35, 1.1], [659.25, 1.35, 1.1], [783.99, 1.35, 1.1]];
    for (const [f, at, len] of notes) for (const det of [-4, 5]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t + at); lp.frequency.linearRampToValueAtTime(2600, t + at + 0.06);
      g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(0.085 * strength, t + at + 0.03); g.gain.setValueAtTime(0.085 * strength, t + at + len * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
      o.connect(lp); lp.connect(g); g.connect(master); o.start(t + at); o.stop(t + at + len + 0.05);
    }
  } else if (name === 'cannon') {
    // confetti cannons and the jets: a thump of air, then a long hiss
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    env(g, 0.004, 0.7 * strength, 0.3, t); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
    const n = ctx.createBufferSource(), ng = ctx.createGain(), hp = ctx.createBiquadFilter();
    n.buffer = noiseBuffer(2.5); hp.type = 'highpass'; hp.frequency.value = 2600;
    env(ng, 0.02, 0.35 * strength, 2.2, t); n.connect(hp); hp.connect(ng); ng.connect(master); n.start(t);
  } else if (name === 'roar') crowdSwell(0.9, 1100, 4);
  else if (name === 'ooh') crowdSwell(0.45, 500, 1.8);
  else if (name === 'ole') crowdSwell(0.5, 900, 1.0);       // a skill comes off: the crowd's OLE
  else if (name === 'rise') crowdSwell(0.3, 650, 1.1);     // a shot flying on target: the crowd draws breath
  else if (name === 'groan') crowdSwell(0.3, 350, 1.4);
}
