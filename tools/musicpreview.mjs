// Renders the game's music to WAV files so it can be listened to outside the game:
//   node tools/musicpreview.mjs out/dir [seconds] [track ...]
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { startServer } from './serve.mjs';

const [out = 'out/music', secs = '48', ...names] = process.argv.slice(2);
const tracks = names.length ? names : ['terrace', 'floodlights', 'sol', 'champions'];
mkdirSync(out, { recursive: true });
const server = await startServer(0);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(server.url + '/tools/lab.html', { waitUntil: 'domcontentloaded' });
for (const name of tracks) {
  const r = await page.evaluate(async ({ name, secs }) => {
    const { renderInto } = await import('/game/music.js');
    const sr = 44100, ctx = new OfflineAudioContext(1, sr * secs, sr);
    renderInto(ctx, ctx.destination, name, secs - 0.5);
    const d = (await ctx.startRendering()).getChannelData(0);
    let peak = 0, sq = 0;
    for (const v of d) { peak = Math.max(peak, Math.abs(v)); sq += v * v; }
    const pcm = new Int16Array(d.length);
    for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-1, Math.min(1, d[i])) * 32767;
    let s = ''; const u = new Uint8Array(pcm.buffer);
    for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192));
    return { b64: btoa(s), peak, rms: Math.sqrt(sq / d.length), sr };
  }, { name, secs: +secs });
  const pcm = Buffer.from(r.b64, 'base64'), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(r.sr, 24); h.writeUInt32LE(r.sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  writeFileSync(`${out}/${name}.wav`, Buffer.concat([h, pcm]));
  console.log(name, 'peak', r.peak.toFixed(2), 'rms', r.rms.toFixed(3));
}
await browser.close(); await server.close();
