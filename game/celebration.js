// The goal dance on screen: waits for the teammates to come over, starts the dance music, reads your
// pose (hands in the headset, arrow keys in the browser), and draws the rhythm lane in front of you.
import * as THREE from 'three';
import { createDance, stepDance, poseFromHands, DANCE, beatLen } from '../rules/dance.js';
import { controllers } from '../engine/input.js';
import { uiPlane, PAL, text, panel, gloss } from './ps2/ui.js';
import { playMusic, stopMusic, musicPlaying, musicTime } from './music.js';
import { sfx } from './audio.js';

const W = 512, H = 160, HIT_X = 88, PX_PER_S = 300;   // canvas px (redrawn every frame, so 2x the old lane, no mipmaps)
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'out', Digit1: 'left', Digit2: 'right', Digit3: 'up', Digit4: 'out' };

export function createCelebration(scene, camera) {
  const { ctx, t: tex, m: lane } = uiPlane(W, H, 2.4, 0.75, { mips: false, mat: { depthTest: false } });
  lane.renderOrder = 12; lane.visible = false; scene.add(lane);

  let wait = 0, dance = null, clock = 0, judge = null, judgeT = 9;
  const head = new THREE.Vector3(), dir = new THREE.Vector3(), hand = new THREE.Vector3();

  function readPose(vr, keys) {
    if (!vr) { for (const k in KEYS) if (keys[k]) return KEYS[k]; return null; }
    camera.getWorldPosition(head); camera.getWorldDirection(dir);
    const f = Math.hypot(dir.x, dir.z) || 1, rx = -dir.z / f, rz = dir.x / f;
    const rel = c => { c.getWorldPosition(hand); return { x: (hand.x - head.x) * rx + (hand.z - head.z) * rz, y: hand.y - head.y }; };
    const L = controllers.find(c => c.userData.hand === 'left'), R = controllers.find(c => c.userData.hand === 'right');
    return poseFromHands(L ? rel(L) : null, R ? rel(R) : null);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    panel(ctx, 0, 30, W, 106, { r: 14, alpha: 0.8 });
    gloss(ctx, 6, 2, 130, 38, { kind: 'amber', r: 10, glow: 'rgba(255,170,40,0.6)' });
    text(ctx, 'DANCE!', 71, 21, { size: 28, align: 'center', italic: true, weight: 900, color: PAL.deep, shadow: false });
    text(ctx, `+${dance.score}`, W - 10, 21, { size: 30, align: 'right', weight: 900 });
    // hit zone, pulsing on the beat
    const beat = clock / beatLen(), pulse = 1 - (beat - Math.floor(beat));
    ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = pulse > 0.75 ? PAL.accent : 'rgba(150,180,230,0.7)';
    if (pulse > 0.75) { ctx.shadowColor = 'rgba(255,190,40,0.9)'; ctx.shadowBlur = 14; }
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(HIT_X - 34, 46, 68, 74, 12) : ctx.rect(HIT_X - 34, 46, 68, 74); ctx.stroke(); ctx.restore();
    for (const m of dance.moves) {
      const x = HIT_X + (m.t - clock) * PX_PER_S;
      if (x < -40 || x > W + 40) continue;
      if (m.grade && m.grade !== 'miss') continue;
      icon(ctx, m.move, Math.round(x), 83, m.grade === 'miss' ? PAL.bad : PAL.ink);
    }
    if (judge && judgeT < 0.5) {
      const col = judge === 'perfect' ? PAL.good : judge === 'good' ? PAL.accent : PAL.bad;
      text(ctx, judge.toUpperCase(), HIT_X + 52, 66, { size: 40, italic: true, weight: 900, color: col, glow: col });
    }
    tex.needsUpdate = true;
  }

  return {
    get active() { return wait > 0 || !!dance; },
    // The move your teammates should be showing right now (a beat ahead of you), for their animation.
    get guide() {
      if (!dance) return null;
      const m = dance.moves.find(x => x.t > clock - 0.25);
      return { move: m ? m.move : null, beat: clock / beatLen() };
    },
    get state() { return dance ? { moves: dance.moves, clock, score: dance.score } : null; },
    start(delay = 1.4) { wait = delay; dance = null; },
    cancel() { wait = 0; if (dance) stopMusic(0.2); dance = null; lane.visible = false; },
    // Returns { score, hits, count } on the frame the dance ends, otherwise null.
    update(dt, vr, keys) {
      if (wait > 0) {
        wait -= dt;
        if (wait <= 0) { dance = createDance(); clock = 0; judge = null; playMusic('dance'); }
        return null;
      }
      if (!dance) return null;
      clock = musicPlaying() === 'dance' ? musicTime() : clock + dt;
      judgeT += dt;
      for (const j of stepDance(dance, clock, readPose(vr, keys))) {
        judge = j.grade; judgeT = 0;
        sfx(j.grade === 'miss' ? 'touch' : 'perfect');
      }
      // keep the lane in front of the face, under the banner
      camera.getWorldPosition(head); camera.getWorldDirection(dir);
      const yaw = Math.atan2(dir.x, dir.z);
      lane.position.set(head.x + Math.sin(yaw) * 2.6, head.y - 0.6, head.z + Math.cos(yaw) * 2.6);
      lane.lookAt(head.x, head.y - 0.6, head.z);
      lane.visible = true;
      draw();
      if (dance.done) {
        const r = { score: dance.score, hits: dance.hits, count: DANCE.count };
        dance = null; lane.visible = false; stopMusic(0.6);
        return r;
      }
      return null;
    },
  };
}

// A little stick figure seen from behind (your left is on the left) for each move, on a dark disc.
function icon(ctx, move, cx, cy, col) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy - 17, 5, 0, Math.PI * 2); ctx.fill();                       // head
  const seg = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(cx + x0, cy + y0); ctx.lineTo(cx + x1, cy + y1); ctx.stroke(); };
  seg(0, -10, 0, 6); seg(0, 6, -6, 22); seg(0, 6, 6, 22);                                    // body, legs
  const up = s => seg(0, -7, s * 13, -22), down = s => seg(0, -7, s * 9, 10), out = s => seg(0, -7, s * 19, -7);
  if (move === 'left') { up(-1); down(1); }
  if (move === 'right') { up(1); down(-1); }
  if (move === 'up') { up(-1); up(1); }
  if (move === 'out') { out(-1); out(1); }
  ctx.restore();
}
