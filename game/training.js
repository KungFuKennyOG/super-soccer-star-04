// Training mode: the drills from rules/tutorial.js, with a card at the top of your view saying
// what to do, a progress bar, and how to skip. main.js feeds it each frame's events.
import { uiPlane } from './ps2/ui.js';
import { CW, CH, paintTraining } from './ps2/hudpaint.js';
import { STEPS, createTutorial, currentStep, setupDrill, clearDrill, stepTutorial, skipStep } from '../rules/tutorial.js';

export function createTraining(camera) {
  const { ctx, t: tex, m: card } = uiPlane(CW, CH, 0.64, 0.64 * CH / CW, { mat: { depthTest: false } });
  card.renderOrder = 25; card.position.set(0, 0.15, -0.72); card.rotation.x = -0.15; card.visible = false;
  camera.add(card);

  let tut = null, shown = '', vr = false;

  function draw() {
    const s = currentStep(tut), done = tut.doneT > 0;
    const key = `${tut.i}|${Math.floor(tut.n)}|${done}|${vr}|${tut.finished}`;
    if (key === shown) return;
    shown = key;
    paintTraining(ctx, {
      i: Math.min(tut.i + 1, STEPS.length), total: STEPS.length, title: s.title, lines: vr ? s.vr : s.pc, need: s.need, n: tut.n, unit: s.unit,
      done, finished: tut.finished || tut.i >= STEPS.length - 1, vr,
    });
    tex.needsUpdate = true;
  }

  return {
    get active() { return !!tut; },
    get step() { return tut ? currentStep(tut) : null; },
    get progress() { return tut ? tut.n : 0; },
    start(world, isVr) { tut = createTutorial(); vr = isVr; shown = ''; setupDrill(world, currentStep(tut)); card.visible = true; draw(); },
    stop(world) { tut = null; card.visible = false; if (world) clearDrill(world); },
    // the same drill again (Y / R, or after a dead ball)
    reset(world) { if (tut && !tut.finished) setupDrill(world, currentStep(tut)); },
    skip() { if (tut) skipStep(tut); },
    // f: { ev, intent, world, dt, vr, restart }. Returns 'done' | 'next' | 'finished' | null and sets
    // the pitch up for the next drill itself.
    update(f) {
      if (!tut) return null;
      vr = f.vr;
      card.position.y = vr ? 0.15 : 0.27;     // the browser view looks down a little, so sit higher there
      const r = stepTutorial(tut, f);
      if (r === 'next' || r === 'reset') setupDrill(f.world, currentStep(tut));
      draw();
      return r;
    },
  };
}
