// Menu music, sequenced live on WebAudio. Kenny (Nov 2026): "FIFA style menu music" in place of the '96 chiptune.
// A 2003-04 football game's menus played a jukebox of licensed songs (indie rock, big beat, latin-flavoured dance).
// These are original tunes in those three styles, played as a playlist: 'menu' goes round them, one song each.
// Nothing here is a real song, sample or riff. playMusic(name) after startAudio() has run from a click or trigger.
import { audioOut } from './audio.js';

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const midi = n => { const m = n.match(/^([A-G]#?)(\d)$/); return 12 * (+m[2] + 1) + NOTE[m[1]]; };
const freq = m => 440 * Math.pow(2, (m - 69) / 12);
const chord = c => { const m = c.match(/^([A-G]#?)(m?)$/); return { root: NOTE[m[1]], third: m[2] ? 3 : 4 }; };

// A song is parts played in `song` order. A part: chords (a bar each, repeated to fill the part's bars), and a 16-step
// pattern per instrument:
//   drums  K kick, S snare, C clap, h closed hat, o open hat        perc  r rim click, t tambourine
//   bass   R root, O octave, 5 fifth, 7 seventh below the octave    gtr   m palm-muted chug, x open power chord (rings to the next)
//   stab   x a short chord hit                                      pad   true: a held chord per bar
//   lead   a bar of 8 eighth notes each: a note, '.' to hold, '-' for silence
const TRACKS = {
  // indie rock: chugging guitars in the verse, open chords and a guitar hook in the chorus
  terrace: {
    bpm: 136, gtrTone: 3400,
    parts: {
      i: { chords: ['Am', 'Am', 'F', 'F'], drums: 'K---h---K---h-h-', gtr: 'm-m-m-m-m-m-m-m-' },
      v: { chords: ['Am', 'F', 'C', 'G'], drums: 'K-h-S-h-K-K-S-h-', bass: 'R-R-R-R-R-R-R-R5', gtr: 'm-m-m-m-m-m-m-mm' },
      c: {
        chords: ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'G'], drums: 'K-o-S-o-K-KoS-o-', bass: 'R-R-R-O-R-R-R-5-', gtr: 'x-----x-x---x-x-', perc: '--t---t---t---t-',
        lead: ['A4 . C5 . A4 G4 . .', 'G4 . E4 . G4 . C5 .', 'D5 . . B4 D5 . G5 .', 'E5 . . . C5 . A4 .', 'A4 . C5 . F5 E5 . .', 'E5 . G5 . E5 . C5 .', 'D5 . . . B4 . D5 .', 'D5 . G5 . . . . -'],
      },
      b: { chords: ['Dm', 'Dm', 'F', 'G'], drums: 'K---S---K-K-S-SS', bass: 'R---R---R-R-R-R-', gtr: 'x-------x---x---', pad: true },
    },
    song: 'i v v c v c b c c',
  },
  // big beat: a broken drum loop, a rolling filtered bass and offbeat stabs
  floodlights: {
    bpm: 124, gtrTone: 2200,
    parts: {
      i: { chords: ['Em', 'Em', 'Em', 'Em'], drums: 'K--h--h-K-h--Kh-', bass: 'R--R--R-R--R-O-7' },
      v: { chords: ['Em', 'Em', 'C', 'D'], drums: 'K-hK--S--hK-S-hh', bass: 'R--R--R-R--R-O-7', stab: '--x-----x--x----', perc: '----t-------t---' },
      c: {
        chords: ['Em', 'G', 'C', 'D', 'Em', 'G', 'A', 'B'], drums: 'K-hK-hS-KhK-S-oh', bass: 'R-RO-RR-O-R-R5O-', stab: '--x--x----x--x--', gtr: 'x---------------', perc: '--t---t---t---t-',
        lead: ['B4 . E5 . D5 . B4 .', 'D5 . . B4 G4 . . .', 'E5 . G5 . E5 . C5 .', 'F#5 . . . D5 . A4 .', 'B4 . E5 . G5 . B5 .', 'A5 . . G5 D5 . . .', 'A5 . . E5 C#5 . E5 .', 'F#5 . . . D#5 . . -'],
      },
      b: { chords: ['C', 'C', 'D', 'D'], drums: 'K---------h---hh', bass: 'R---------------', pad: true, stab: 'x-------x-------' },
    },
    song: 'i v v c v c b c c',
  },
  // latin house: four on the floor, a rim clave, a piano-style montuno and a tumbao bass
  sol: {
    bpm: 126, gtrTone: 2600,
    parts: {
      i: { chords: ['D', 'Bm', 'G', 'A'], drums: 'K---K---K---K---', perc: 'r--r--r---r-r---', stab: '--x--x-x--x--x-x' },
      v: { chords: ['D', 'Bm', 'G', 'A'], drums: 'K-h-C-h-K-h-C-hh', perc: 'r--r--r---r-r---', bass: 'R--5--O-R--5-O--', stab: '--x--x-x--x--x-x' },
      c: {
        chords: ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'], drums: 'K-o-C-o-K-o-C-oh', perc: 'r-tr--r-t-r-r-t-', bass: 'R--5--O-R--5-O-5', stab: 'x-x--x-x--x--x-x', pad: true,
        lead: ['B4 . D5 . G5 . F#5 .', 'E5 . . C#5 A4 . . .', 'A4 . C#5 . F#5 . E5 .', 'D5 . . . B4 . F#4 .', 'B4 . D5 . G5 . B5 .', 'A5 . . G5 E5 . C#5 .', 'D5 . . F#5 A5 . . .', 'F#5 . D5 . . . . -'],
      },
      b: { chords: ['Em', 'A', 'Em', 'A'], drums: 'K---K---K---K-CC', perc: 'r--r--r---r-r---', bass: 'R-----O-R-----5-', pad: true },
    },
    song: 'i v v c v c b c c',
  },
  // the cup winners' tune: a slow terrace anthem
  champions: {
    bpm: 112, gtrTone: 3000,
    parts: {
      v: {
        chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'], drums: 'K---S---K-K-S---', bass: 'R---R---R---R-5-', gtr: 'x-------x-------', pad: true, perc: '--t---t---t---t-',
        lead: ['G4 . C5 . E5 . G5 .', 'G5 . F5 E5 D5 . B4 .', 'C5 . E5 . A5 . . .', 'A5 . G5 F5 C5 . . -', 'E5 . G5 . C6 . . .', 'B5 . A5 G5 D5 . . .', 'A5 . C6 . A5 . F5 .', 'G5 . . . . . . -'],
      },
    },
    song: 'v',
  },
};
const PLAYLIST = ['terrace', 'floodlights', 'sol'];

let out = null, bus = null, gtrIn = null, gtrLP = null, timer = null, cur = null, trk = null, plan = null, list = 0, step = 0, nextT = 0;

// the order of bars in a song: [{ part, bar }]
function layout(tr) {
  const bars = [];
  for (const k of tr.song.split(' ')) { const p = tr.parts[k], n = Math.max(p.chords.length, p.lead ? p.lead.length : 0); for (let b = 0; b < n; b++) bars.push({ p, b }); }
  return bars;
}

// the mix every voice plays into: a guitar amp (drive and tone) and a compressor over everything
function rig(o, level) {
  out = o;
  const { ctx } = o, comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
  bus = ctx.createGain(); bus.gain.value = level; comp.connect(bus); bus.connect(o.master);
  const sh = ctx.createWaveShaper(), curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(5 * x); }
  sh.curve = curve; sh.oversample = '2x';
  gtrLP = ctx.createBiquadFilter(); gtrLP.type = 'lowpass'; gtrLP.Q.value = 0.8;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
  const g = ctx.createGain(); g.gain.value = 0.2;
  gtrIn = ctx.createGain(); gtrIn.connect(sh); sh.connect(gtrLP); gtrLP.connect(hp); hp.connect(g); g.connect(comp);
  return comp;
}
let mix = null;

function load(name) { trk = TRACKS[name]; plan = layout(trk); step = 0; gtrLP.frequency.value = trk.gtrTone; }

export function playMusic(name) {
  const a = audioOut();
  if (!a || cur === name) return;
  stopMusic(0.05);
  mix = rig(a, 0.5);
  cur = name;
  load(name === 'menu' ? PLAYLIST[list++ % PLAYLIST.length] : name);
  nextT = out.ctx.currentTime + 0.08;
  timer = setInterval(schedule, 25);
  schedule();
}

export function stopMusic(fade = 0.5) {
  if (!cur) return;
  clearInterval(timer); timer = null;
  const b = bus, t = out.ctx.currentTime;
  b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(0.0001, t + fade);
  setTimeout(() => b.disconnect(), (fade + 0.3) * 1000);
  cur = null;
}

export const musicPlaying = () => cur;

function schedule() {
  if (!trk) return;
  const ahead = out.ctx.currentTime + 0.15;
  while (nextT < ahead) {
    const s16 = 60 / trk.bpm / 4;
    playStep(step, nextT, s16); step++; nextT += s16;
    if (step >= plan.length * 16 && cur === 'menu') { load(PLAYLIST[list++ % PLAYLIST.length]); nextT += s16 * 8; }   // the next song, after half a bar's breath
  }
}

// A whole song into any audio context (an OfflineAudioContext for a preview file: tools/musicpreview.mjs).
export function renderInto(ctx, dest, name, seconds) {
  const keep = { out, bus, gtrIn, gtrLP, mix, trk, plan, step };
  mix = rig({ ctx, master: dest }, 0.5); load(name);
  for (let n = 0, t = 0.05; t < seconds; n++) { const s16 = 60 / trk.bpm / 4; playStep(n, t, s16); t += s16; }
  ({ out, bus, gtrIn, gtrLP, mix, trk, plan, step } = keep);
}

function playStep(n, t, s16) {
  const i = n % 16, at = plan[Math.floor(n / 16) % plan.length], p = at.p;
  const ch = chord(p.chords[at.b % p.chords.length]), tones = [ch.root, ch.root + ch.third, ch.root + 7];
  const lowRoot = 28 + ((ch.root - 4 + 12) % 12);   // the root between E1 and D#2

  const d = p.drums ? p.drums[i] : '-';
  if (d === 'K') kick(t);
  if (d === 'S') snare(t);
  if (d === 'C') clap(t);
  if (d === 'h') hat(t, 0.04, 0.13);
  if (d === 'o') hat(t, 0.16, 0.11);
  const pc = p.perc ? p.perc[i] : '-';
  if (pc === 'r') rim(t);
  if (pc === 't') hat(t, 0.07, 0.07, 9500);

  const b = p.bass ? p.bass[i] : '-';
  if (b !== '-') bass(t, lowRoot + ({ R: 0, O: 12, 5: 7, 7: 10 })[b], s16 * run(p.bass, i) * 0.9);

  const g = p.gtr ? p.gtr[i] : '-';
  if (g !== '-') guitar(t, lowRoot + 12, g === 'm' ? 0.085 : s16 * run(p.gtr, i) * 0.96, g === 'm');

  if (p.stab && p.stab[i] === 'x') for (const k of tones) voice('sawtooth', freq(60 + k), t, 0.11, 0.05, 2600);
  if (p.pad && i === 0) for (const k of tones) voice('triangle', freq(60 + k), t, s16 * 16, 0.045, 1800, 0.12);

  if (p.lead && i % 2 === 0) {
    const toks = p.lead[at.b % p.lead.length].split(' '), tok = toks[i / 2];
    if (tok && tok !== '.' && tok !== '-') {
      let len = 1;
      for (let k = i / 2 + 1; k < toks.length && toks[k] === '.'; k++) len++;
      lead(t, freq(midi(tok)), s16 * 2 * len * 0.94);
    }
  }
}
// how many steps a hit rings for: up to the next hit in its pattern
function run(pat, i) { let k = 1; while (i + k < 16 && pat[i + k] === '-') k++; return k; }

function env(g, t, len, vol, attack = 0.006) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack + 0.004, len - 0.04));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
}
function voice(type, f, t, len, vol, cut, attack) {
  const { ctx } = out, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = type; o.frequency.setValueAtTime(f, t); lp.type = 'lowpass'; lp.frequency.value = cut;
  env(g, t, len, vol, attack);
  o.connect(lp); lp.connect(g); g.connect(mix); o.start(t); o.stop(t + len + 0.02);
  return o;
}
function bass(t, m, len) {
  const { ctx } = out, o = ctx.createOscillator(), s = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(freq(m), t); s.type = 'sine'; s.frequency.setValueAtTime(freq(m), t);
  lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + Math.min(len, 0.18));
  env(g, t, len, 0.3);
  o.connect(lp); lp.connect(g); s.connect(g); g.connect(mix); o.start(t); s.start(t); o.stop(t + len + 0.02); s.stop(t + len + 0.02);
}
// a power chord (root, fifth, octave) into the amp; two slightly detuned saws a string
function guitar(t, m, len, muted) {
  const { ctx } = out, g = ctx.createGain();
  env(g, t, len, muted ? 0.16 : 0.22, 0.004);
  if (!muted) g.gain.setTargetAtTime(0.1, t + 0.05, 0.25);
  g.connect(gtrIn);
  for (const k of [0, 7, 12]) for (const det of [-5, 6]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq(m + k), t); o.detune.value = det;
    o.connect(g); o.start(t); o.stop(t + len + 0.02);
  }
}
function lead(t, f, len) {
  const a = voice('sawtooth', f, t, len, 0.07, 3200), b = voice('square', f, t, len, 0.03, 2400);
  b.detune.value = 9;
  if (len > 0.3) {
    const { ctx } = out, l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t + 0.12); lg.gain.linearRampToValueAtTime(f * 0.01, t + len);
    l.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency); l.start(t); l.stop(t + len + 0.05);
  }
}

let noise = null, noiseCtx = null;
function noiseBuf() {
  const { ctx } = out;
  if (noise && noiseCtx === ctx) return noise;
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseCtx = ctx;
  return (noise = b);
}
function burst(t, len, vol, type, f, q = 0.7) {
  const { ctx } = out, n = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
  n.buffer = noiseBuf(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  n.connect(fl); fl.connect(g); g.connect(mix); n.start(t); n.stop(t + len + 0.02);
}
function kick(t) {
  const { ctx } = out, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.09);
  g.gain.setValueAtTime(0.95, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g); g.connect(mix); o.start(t); o.stop(t + 0.22);
  burst(t, 0.012, 0.25, 'highpass', 3000);
}
function snare(t) {
  burst(t, 0.17, 0.5, 'bandpass', 2100, 0.6);
  const { ctx } = out, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  o.connect(g); g.connect(mix); o.start(t); o.stop(t + 0.12);
}
function clap(t) { for (const d of [0, 0.011, 0.023]) burst(t + d, d ? 0.12 : 0.03, 0.36, 'bandpass', 1500, 1.4); }
function hat(t, len, vol, f = 7200) { burst(t, len, vol, 'highpass', f); }
function rim(t) { burst(t, 0.03, 0.4, 'bandpass', 2600, 6); }
