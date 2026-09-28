// Player input: keyboard (KEYS from config, by event.code) + Gamepad API.
// getInput() returns the kart.input shape; `item` is edge-triggered (true for one frame per press).
// consumePressed(action) returns true exactly once per press (keyboard or gamepad).
import { KEYS } from './config.js';
import { bus } from './events.js';

// Extra UI actions (menus may use these); gameplay actions come from KEYS.
const EXTRA_KEYS = {
  confirm: ['Enter', 'NumpadEnter', 'Space'],
  back: ['Escape', 'Backspace'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  mute: ['KeyM'],
};
const ACTION_KEYS = { ...EXTRA_KEYS, ...KEYS };

// Standard gamepad mapping.
const GP = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const GP_ACTIONS = {
  accelerate: [GP.A, GP.RT],
  brake: [GP.B, GP.LT],
  drift: [GP.RB, GP.X],
  item: [GP.LB, GP.Y],
  lookBack: [GP.R3, GP.L3],
  pause: [GP.START],
  left: [GP.LEFT],
  right: [GP.RIGHT],
  up: [GP.UP],
  down: [GP.DOWN],
  confirm: [GP.A, GP.START],
  back: [GP.B, GP.BACK],
  mute: [],
};

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const STICK_DEADZONE = 0.18;
const STEER_RAMP_TIME = 0.08;   // seconds from 0 -> full lock on keyboard
const STEER_RELEASE_TIME = 0.06;

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export class InputController {
  /** Most recently constructed live controller (Kart peeks it for the start-line rocket boost). */
  static active = null;

  constructor({ target = (typeof window !== 'undefined' ? window : null) } = {}) {
    this.target = target;
    this.keys = new Set();
    this.latch = Object.create(null);      // action -> pending press for consumePressed
    this.itemEdge = false;                  // pending press for getInput().item
    this.gpHeld = Object.create(null);      // action -> bool
    this.gpPrev = Object.create(null);
    this.gpSteer = 0;
    this.gpThrottle = 0;
    this.gpBrake = 0;
    this.gamepadConnected = false;
    this.lastDevice = 'keyboard';
    this.steer = 0;
    this.steeringSensitivity = 1;
    this.touch = { throttle: 0, brake: 0, steer: 0, drift: false, item: false, lookBack: false };
    this.touchMode = 'buttons';
    this._wheelTurn = 0;
    this._wheelLastAngle = 0;
    this._touchCleanups = [];
    this._touchHolds = new Map();
    this._touchHoldOrder = 0;
    this._touchSteerTapValue = 0;
    this._touchSteerTapUntil = 0;
    this.tiltEnabled = false;
    this._tiltNeutral = null;
    this._tiltTarget = 0;
    this._tiltSteer = 0;
    this._onOrientation = (e) => this._updateTilt(e);
    this._lastTime = now();
    this._lastPoll = -1;
    this._state = { throttle: 0, brake: 0, steer: 0, drift: false, item: false, lookBack: false };

    this._codeToActions = new Map();
    for (const [action, codes] of Object.entries(ACTION_KEYS)) {
      for (const code of codes || []) {
        if (!this._codeToActions.has(code)) this._codeToActions.set(code, []);
        this._codeToActions.get(code).push(action);
      }
    }

    this._onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;
      if (PREVENT.has(e.code)) e.preventDefault();
      this.lastDevice = 'keyboard';
      if (e.repeat || this.keys.has(e.code)) { this.keys.add(e.code); return; }
      const actions = this._codeToActions.get(e.code);
      if (actions) {
        for (const a of actions) {
          if (!this._keyHeld(a)) {
            this.latch[a] = true;
            if (a === 'item') this.itemEdge = true;
          }
        }
      }
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      this.keys.delete(e.code);
    };
    this._onBlur = () => { this.keys.clear(); };

    if (target?.addEventListener) {
      target.addEventListener('keydown', this._onKeyDown, { passive: false });
      target.addEventListener('keyup', this._onKeyUp, { passive: false });
      target.addEventListener('blur', this._onBlur);
    }
    this._buildTouchControls();
    InputController.active = this;
  }

  _buildTouchControls() {
    if (typeof document === 'undefined' || !document.body) return;
    const root = document.createElement('div');
    root.className = 'touch-controls';
    root.setAttribute('aria-label', 'On-screen driving controls');
    root.innerHTML = `
      <div class="touch-top">
        <button class="touch-btn view-cycle" data-press="cameraView" aria-label="Switch to front camera view"><span class="touch-icon camera-icon"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M4 5h6l2-3h8l2 3h6v17H4z"/><circle cx="16" cy="14" r="5"/></svg></span><small>FRONT</small></button>
        <button class="touch-btn rear-view" data-hold="lookBack" aria-label="Hold rear view"><span class="touch-icon">↶</span><small>REAR</small></button>
        <button class="touch-btn steer-mode" data-toggle="steer" aria-label="Change steering control"><span class="touch-icon">◉</span><small>WHEEL</small></button>
        <button class="touch-btn tilt-mode" data-toggle="tilt" aria-label="Enable tilt steering"><span class="touch-icon">↔</span><small>TILT</small></button>
      </div>
      <div class="touch-steering buttons-mode">
        <button class="touch-btn steer-key left" data-steer="-1" aria-label="Steer left"><span>‹</span></button>
        <button class="touch-btn steer-key right" data-steer="1" aria-label="Steer right"><span>›</span></button>
        <div class="steering-wheel" role="slider" aria-label="Steering wheel" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><i></i><i></i><i></i><button class="wheel-horn" type="button" aria-label="Sound horn">NR</button></div>
      </div>
      <div class="touch-actions">
        <button class="touch-btn ability" data-press="item" aria-label="Use ability"><span class="touch-icon">⚡</span><small>ABILITY</small></button>
        <button class="touch-btn drift" data-hold="drift" aria-label="Hop and drift"><span class="touch-icon">↗</span><small>DRIFT</small></button>
        <button class="touch-pedal brake" data-hold="brake" aria-label="Brake or reverse"><span>▾</span><small>BRAKE</small></button>
        <button class="touch-pedal accel" data-hold="throttle" aria-label="Accelerate"><span>▲</span><small>BOOST</small></button>
      </div>`;
    document.body.appendChild(root);
    this.touchRoot = root;

    const listen = (node, type, fn, opts) => {
      node.addEventListener(type, fn, opts);
      this._touchCleanups.push(() => node.removeEventListener(type, fn, opts));
    };
    const syncHoldAction = (action) => {
      const active = [...this._touchHolds.values()].filter((hold) => hold.action === action);
      if (action === 'steer') {
        active.sort((a, b) => a.order - b.order);
        this.touch.steer = active.length ? active[active.length - 1].value : 0;
      } else {
        this.touch[action] = active.length > 0;
      }
    };
    const bindHold = (button, action, value = true) => {
      const down = (e) => {
        e.preventDefault(); e.stopPropagation();
        button.setPointerCapture?.(e.pointerId);
        this._touchHolds.set(e.pointerId, { action, value, button, order: ++this._touchHoldOrder });
        button.classList.add('pressed');
        this.lastDevice = 'touch';
        if (action === 'steer') {
          this._touchSteerTapValue = value;
          this._touchSteerTapUntil = now() + 320;
        }
        syncHoldAction(action);
      };
      const up = (e) => {
        e.preventDefault(); e.stopPropagation();
        const hold = this._touchHolds.get(e.pointerId);
        if (!hold) return;
        this._touchHolds.delete(e.pointerId);
        const buttonStillHeld = [...this._touchHolds.values()].some((entry) => entry.button === button);
        button.classList.toggle('pressed', buttonStillHeld);
        if (hold.action === 'steer') {
          this._touchSteerTapValue = hold.value;
          this._touchSteerTapUntil = now() + 320;
        }
        syncHoldAction(hold.action);
      };
      listen(button, 'pointerdown', down, { passive: false });
      listen(button, 'pointerup', up, { passive: false });
      listen(button, 'pointercancel', up, { passive: false });
      listen(button, 'lostpointercapture', up, { passive: false });
    };
    root.querySelectorAll('[data-hold]').forEach((b) => bindHold(b, b.dataset.hold, true));
    root.querySelectorAll('[data-steer]').forEach((b) => bindHold(b, 'steer', Number(b.dataset.steer)));
    root.querySelectorAll('[data-press]').forEach((b) => listen(b, 'pointerdown', (e) => {
      e.preventDefault(); this.lastDevice = 'touch'; b.classList.add('pressed');
      const action = b.dataset.press; this.latch[action] = true;
      if (action === 'item') this.itemEdge = true;
      window.setTimeout(() => b.classList.remove('pressed'), 120);
    }, { passive: false }));

    const steering = root.querySelector('.touch-steering');
    const wheel = root.querySelector('.steering-wheel');
    const horn = root.querySelector('.wheel-horn');
    const toggle = root.querySelector('[data-toggle="steer"]');
    const tiltToggle = root.querySelector('[data-toggle="tilt"]');
    const hornDown = (e) => {
      e.preventDefault();
      horn.setPointerCapture?.(e.pointerId);
      horn.classList.add('pressed');
      window.setTimeout(() => bus.emit('input:hornStart', {}), 0);
    };
    const hornUp = (e) => {
      e.preventDefault();
      horn.classList.remove('pressed');
      bus.emit('input:hornStop', {});
    };
    listen(horn, 'pointerdown', hornDown, { passive: false });
    listen(horn, 'pointerup', hornUp, { passive: false });
    listen(horn, 'pointercancel', hornUp, { passive: false });
    listen(horn, 'lostpointercapture', hornUp, { passive: false });
    listen(tiltToggle, 'click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (this.tiltEnabled) this._disableTilt();
      else await this._enableTilt();
      tiltToggle.classList.toggle('active', this.tiltEnabled);
      tiltToggle.querySelector('small').textContent = this.tiltEnabled ? 'TILT ON' : 'TILT';
      tiltToggle.setAttribute('aria-label', this.tiltEnabled ? 'Disable tilt steering' : 'Enable tilt steering');
    });
    listen(toggle, 'click', (e) => {
      e.preventDefault(); this.touchMode = this.touchMode === 'buttons' ? 'wheel' : 'buttons';
      steering.classList.toggle('buttons-mode', this.touchMode === 'buttons');
      steering.classList.toggle('wheel-mode', this.touchMode === 'wheel');
      toggle.querySelector('small').textContent = this.touchMode === 'wheel' ? 'ARROWS' : 'WHEEL';
      for (const [pointerId, hold] of this._touchHolds) {
        if (hold.action === 'steer') this._touchHolds.delete(pointerId);
      }
      root.querySelectorAll('[data-steer]').forEach((button) => button.classList.remove('pressed'));
      this.touch.steer = 0; this._wheelTurn = 0; wheel.style.setProperty('--turn', '0deg');
    });
    const wheelAngle = (e) => {
      const r = wheel.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    };
    const wheelMove = (e) => {
      const angle = wheelAngle(e);
      let delta = angle - this._wheelLastAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      this._wheelLastAngle = angle;
      this._wheelTurn = Math.max(-135, Math.min(135, this._wheelTurn + delta));
      const steer = this._wheelTurn / 135;
      this.touch.steer = steer; this.lastDevice = 'touch';
      wheel.style.setProperty('--turn', `${this._wheelTurn}deg`); wheel.setAttribute('aria-valuenow', String(Math.round(steer * 100)));
    };
    listen(wheel, 'pointerdown', (e) => { if (e.target.closest('.wheel-horn')) return; e.preventDefault(); this._wheelPointer = e.pointerId; this._wheelLastAngle = wheelAngle(e); wheel.setPointerCapture?.(e.pointerId); wheel.classList.add('pressed'); }, { passive: false });
    listen(wheel, 'pointermove', (e) => { if (this._wheelPointer === e.pointerId) wheelMove(e); }, { passive: false });
    const wheelUp = (e) => { e.preventDefault(); if (this._wheelPointer !== e.pointerId) return; this._wheelPointer = null; this._wheelTurn = 0; wheel.classList.remove('pressed'); this.touch.steer = 0; wheel.style.setProperty('--turn', '0deg'); wheel.setAttribute('aria-valuenow', '0'); };
    listen(wheel, 'pointerup', wheelUp, { passive: false }); listen(wheel, 'pointercancel', wheelUp, { passive: false });
  }

  setCameraView(mode) {
    const label = this.touchRoot?.querySelector('.view-cycle small');
    const button = this.touchRoot?.querySelector('.view-cycle');
    if (!label || !button) return;
    const next = mode === 'hood' ? 'WIDE' : mode === 'wide' ? 'CHASE' : 'FRONT';
    label.textContent = next;
    button.setAttribute('aria-label', `Switch to ${next.toLowerCase()} camera view`);
  }
  setSteeringSensitivity(value) { this.steeringSensitivity = Math.max(.6, Math.min(1.4, Number(value) || 1)); }

  async _enableTilt() {
    if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') return false;
    try {
      const DOE = window.DeviceOrientationEvent;
      if (typeof DOE.requestPermission === 'function') {
        const permission = await DOE.requestPermission();
        if (permission !== 'granted') return false;
      }
      this._tiltNeutral = null;
      this._tiltTarget = 0;
      this._tiltSteer = 0;
      window.addEventListener('deviceorientation', this._onOrientation, { passive: true });
      this.tiltEnabled = true;
      return true;
    } catch (e) {
      console.warn('[input] tilt steering unavailable', e);
      return false;
    }
  }

  _disableTilt() {
    window.removeEventListener('deviceorientation', this._onOrientation);
    this.tiltEnabled = false;
    this._tiltNeutral = null;
    this._tiltTarget = 0;
    this._tiltSteer = 0;
  }

  _updateTilt(e) {
    if (!this.tiltEnabled) return;
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    let value = Number(e.gamma);
    if (Math.abs(angle) === 90) {
      value = Number(e.beta);
      if (angle === 90) value *= -1;
    }
    if (!Number.isFinite(value)) return;
    if (this._tiltNeutral == null) this._tiltNeutral = value;
    let delta = value - this._tiltNeutral;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    const sign = Math.sign(delta);
    const degrees = Math.max(0, Math.abs(delta) - 2.5);
    this._tiltTarget = Math.max(-1, Math.min(1, sign * degrees / 24));
  }

  _keyHeld(action) {
    const codes = ACTION_KEYS[action];
    if (!codes) return false;
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  _pollGamepad() {
    const t = now();
    if (t === this._lastPoll) return;
    this._lastPoll = t;
    let pads = null;
    try { pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null; } catch { pads = null; }
    let pad = null;
    if (pads) for (const p of pads) { if (p && p.connected !== false) { pad = p; break; } }
    this.gamepadConnected = !!pad;
    const held = this.gpHeld;
    for (const a in GP_ACTIONS) held[a] = false;
    this.gpSteer = 0; this.gpThrottle = 0; this.gpBrake = 0;
    if (pad) {
      const btn = (i) => {
        const b = pad.buttons?.[i];
        if (!b) return 0;
        return typeof b === 'object' ? (b.pressed ? Math.max(b.value || 0, 1) : (b.value || 0)) : (b ? 1 : 0);
      };
      for (const [action, idxs] of Object.entries(GP_ACTIONS)) {
        for (const i of idxs) if (btn(i) > 0.35) { held[action] = true; break; }
      }
      this.gpThrottle = Math.max(btn(GP.A) > 0.5 ? 1 : 0, btn(GP.RT));
      this.gpBrake = Math.max(btn(GP.B) > 0.5 ? 1 : 0, btn(GP.LT));
      const ax = pad.axes?.[0] ?? 0;
      const ay = pad.axes?.[1] ?? 0;
      if (Math.abs(ax) > STICK_DEADZONE) {
        this.gpSteer = Math.sign(ax) * Math.min(1, (Math.abs(ax) - STICK_DEADZONE) / (1 - STICK_DEADZONE));
      }
      if (held.left) this.gpSteer = -1;
      if (held.right) this.gpSteer = 1;
      // Stick as menu nav
      if (ax < -0.6) held.left = true;
      if (ax > 0.6) held.right = true;
      if (ay < -0.6) held.up = true;
      if (ay > 0.6) held.down = true;
      let any = false;
      for (const a in GP_ACTIONS) {
        if (held[a] && !this.gpPrev[a]) {
          this.latch[a] = true;
          if (a === 'item') this.itemEdge = true;
          any = true;
        }
      }
      if (any || this.gpSteer !== 0 || this.gpThrottle > 0) this.lastDevice = 'gamepad';
    }
    for (const a in GP_ACTIONS) this.gpPrev[a] = held[a];
  }

  isPressed(action) {
    this._pollGamepad();
    return this._keyHeld(action) || !!this.gpHeld[action];
  }

  consumePressed(action) {
    this._pollGamepad();
    if (this.latch[action]) { this.latch[action] = false; return true; }
    return false;
  }

  /** Raw throttle value (0..1) without consuming anything. */
  peekThrottle() {
    this._pollGamepad();
    return Math.max(this._keyHeld('accelerate') ? 1 : 0, this.gpThrottle, this.touch.throttle ? 1 : 0);
  }

  getInput() {
    this._pollGamepad();
    const t = now();
    const dt = Math.min(0.05, Math.max(0, (t - this._lastTime) / 1000));
    this._lastTime = t;

    const kbTarget = (this._keyHeld('right') ? 1 : 0) - (this._keyHeld('left') ? 1 : 0);
    if (this.gpSteer !== 0) {
      this.steer = this.gpSteer;
    } else {
      let s = this.steer;
      // Keyboard repeat events (for example holding W) must not steal steering
      // from an actively pressed on-screen arrow or steering wheel pointer.
      const touchSteeringActive = this._wheelPointer != null ||
        [...this._touchHolds.values()].some((hold) => hold.action === 'steer');
      const tappedSteeringActive = t < this._touchSteerTapUntil;
      const tiltStep = Math.min(1, dt * 10);
      this._tiltSteer += (this._tiltTarget - this._tiltSteer) * tiltStep;
      const target = touchSteeringActive
        ? this.touch.steer
        : tappedSteeringActive ? this._touchSteerTapValue
          : this.tiltEnabled ? this._tiltSteer : kbTarget;
      if (target === 0) {
        const step = dt / STEER_RELEASE_TIME;
        s = Math.abs(s) <= step ? 0 : s - Math.sign(s) * step;
      } else {
        if (Math.sign(s) === -target) s *= .35;
        const step = dt / (this.lastDevice === 'touch' ? .14 : STEER_RAMP_TIME);
        s = Math.abs(target - s) <= step ? target : s + Math.sign(target - s) * step;
      }
      this.steer = s;
    }

    const st = this._state;
    st.throttle = Math.max(this._keyHeld('accelerate') ? 1 : 0, this.gpThrottle, this.touch.throttle ? 1 : 0);
    st.brake = Math.max(this._keyHeld('brake') ? 1 : 0, this.gpBrake, this.touch.brake ? 1 : 0);
    st.steer = Math.max(-1, Math.min(1, this.steer * this.steeringSensitivity));
    st.drift = this._keyHeld('drift') || !!this.gpHeld.drift || !!this.touch.drift;
    st.item = this.itemEdge;
    this.itemEdge = false;
    st.lookBack = this._keyHeld('lookBack') || !!this.gpHeld.lookBack || !!this.touch.lookBack;
    // Return a fresh copy so callers can store/mutate it safely.
    return { ...st };
  }

  /** Clear all held/latched state (e.g. when pausing or switching screens). */
  reset() {
    this.keys.clear();
    for (const k in this.latch) this.latch[k] = false;
    this.itemEdge = false;
    this.steer = 0;
    this._touchHolds.clear();
    this._touchSteerTapValue = 0;
    this._touchSteerTapUntil = 0;
    this._tiltTarget = 0;
    this._tiltSteer = 0;
    this.touchRoot?.querySelectorAll('.pressed').forEach((node) => node.classList.remove('pressed'));
    Object.assign(this.touch, { throttle: 0, brake: 0, steer: 0, drift: false, item: false, lookBack: false });
  }

  dispose() {
    this._disableTilt();
    const target = this.target;
    if (target?.removeEventListener) {
      target.removeEventListener('keydown', this._onKeyDown);
      target.removeEventListener('keyup', this._onKeyUp);
      target.removeEventListener('blur', this._onBlur);
    }
    if (InputController.active === this) InputController.active = null;
    for (const off of this._touchCleanups) off();
    this._touchCleanups = [];
    this.touchRoot?.remove();
    this.keys.clear();
  }
}

function now() {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now());
}
