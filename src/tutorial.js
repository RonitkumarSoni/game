// First-race driving coach. Progress is driven by real input rather than timers.
const STEPS = [
  { id: 'launch', eyebrow: 'ROOKIE TRIAL 01', title: 'READY TO RACE?', body: 'Press ENTER, SPACE, or tap the track to begin the countdown.', key: 'ENTER' },
  { id: 'accelerate', eyebrow: 'ROOKIE TRIAL 02', title: 'BUILD SPEED', body: 'Hold W, ↑, the gamepad trigger, or BOOST to accelerate.', key: 'W / BOOST' },
  { id: 'steer', eyebrow: 'ROOKIE TRIAL 03', title: 'TAKE CONTROL', body: 'Steer left and right. Touch racers can use arrows, the wheel, or TILT.', key: 'A D / STEER' },
  { id: 'drift', eyebrow: 'ROOKIE TRIAL 04', title: 'CHARGE A DRIFT', body: 'Hold SPACE or DRIFT while steering through a corner, then release for turbo.', key: 'SPACE' },
  { id: 'ability', eyebrow: 'ROOKIE TRIAL 05', title: 'USE AN ABILITY', body: 'Collect a glowing item box, then press E, SHIFT, or the ability button.', key: 'E / ABILITY' },
];

export class TutorialCoach {
  constructor(uiRoot) {
    this.active = false; this.step = 0; this.hold = 0;
    this.root = document.createElement('div');
    this.root.className = 'tutorial-coach hidden';
    this.root.innerHTML = `<button class="tutorial-skip" type="button">SKIP TUTORIAL</button><div class="tutorial-eyebrow"></div><div class="tutorial-title"></div><div class="tutorial-body"></div><div class="tutorial-footer"><span class="tutorial-key"></span><div class="tutorial-progress"></div></div>`;
    uiRoot.appendChild(this.root);
    this.eyebrow = this.root.querySelector('.tutorial-eyebrow'); this.title = this.root.querySelector('.tutorial-title');
    this.body = this.root.querySelector('.tutorial-body'); this.key = this.root.querySelector('.tutorial-key'); this.progress = this.root.querySelector('.tutorial-progress');
    this.root.querySelector('.tutorial-skip').addEventListener('click', () => this.complete(true));
  }
  get completed() { try { return localStorage.getItem('nrr-tutorial-complete') === '1'; } catch (e) { return false; } }
  start(force = false) { if (!force && this.completed) return false; this.active = true; this.step = 0; this.hold = 0; this.root.classList.remove('hidden', 'complete'); this._render(); return true; }
  _render() {
    const step = STEPS[this.step]; if (!step) return;
    this.eyebrow.textContent = step.eyebrow; this.title.textContent = step.title; this.body.textContent = step.body; this.key.textContent = step.key;
    this.progress.innerHTML = STEPS.map((_, i) => `<i class="${i < this.step ? 'done' : i === this.step ? 'active' : ''}"></i>`).join('');
    this.root.classList.remove('advance'); void this.root.offsetWidth; this.root.classList.add('advance');
  }
  advance() { if (!this.active) return; this.step++; this.hold = 0; if (this.step >= STEPS.length) this.complete(false); else this._render(); }
  complete(skipped) {
    if (!this.active) return; this.active = false;
    try { localStorage.setItem('nrr-tutorial-complete', '1'); } catch (e) { /* unavailable */ }
    if (skipped) { this.root.classList.add('hidden'); return; }
    this.eyebrow.textContent = 'ROOKIE TRIAL COMPLETE'; this.title.textContent = 'RIFT LICENSE EARNED';
    this.body.textContent = 'Race freely. Chain drifts, discover shortcuts, and fight for first place.'; this.key.textContent = 'GO!';
    this.progress.innerHTML = STEPS.map(() => '<i class="done"></i>').join(''); this.root.classList.add('complete');
    window.setTimeout(() => this.root.classList.add('hidden'), 3200);
  }
  update(dt, { state, input, player } = {}) {
    if (!this.active) return; this.root.classList.toggle('paused', state === 'paused');
    if (state === 'paused' || state === 'loading') return;
    const step = STEPS[this.step]?.id; let valid = false;
    if (step === 'launch') valid = state === 'countdown' || state === 'racing';
    else if (state !== 'racing') return;
    else if (step === 'accelerate') valid = (input?.throttle || 0) > .5;
    else if (step === 'steer') valid = Math.abs(input?.steer || 0) > .35;
    else if (step === 'drift') valid = !!input?.drift && Math.abs(player?.speed || 0) > 6;
    else if (step === 'ability') valid = !!input?.item;
    this.hold = valid ? this.hold + dt : Math.max(0, this.hold - dt * 1.5);
    const required = step === 'launch' ? .05 : step === 'ability' ? .01 : step === 'drift' ? .2 : .55;
    if (this.hold >= required) this.advance();
  }
  hide() { this.active = false; this.root.classList.add('hidden'); }
  dispose() { this.root.remove(); }
}
