// Web Audio API synthesis — classic arcade sounds, web-only.
let _ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = (window as any).AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!_ctx) _ctx = new AC() as AudioContext;
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// Shared compressor/limiter so we can boost explosion volumes without hard clipping
let _comp: DynamicsCompressorNode | null = null;
function comp(): DynamicsCompressorNode {
  const a = ac()!;
  if (!_comp) {
    _comp = a.createDynamicsCompressor();
    _comp.threshold.value = -4;
    _comp.knee.value = 2;
    _comp.ratio.value = 8;
    _comp.attack.value = 0.001;
    _comp.release.value = 0.12;
    _comp.connect(a.destination);
  }
  return _comp;
}

/** Short high-pitched chirp — used for Tetris piece rotation */
export function playRotate(): void {
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.connect(gain); gain.connect(comp());
  osc.type = 'square';
  osc.frequency.setValueAtTime(900, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1400, a.currentTime + 0.04);
  gain.gain.setValueAtTime(0.18, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.05);
  osc.start(a.currentTime);
  osc.stop(a.currentTime + 0.06);
}

/** Very short low click — used for Tetris piece left/right motion */
export function playMove(): void {
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.connect(gain); gain.connect(comp());
  osc.type = 'square';
  osc.frequency.setValueAtTime(420, a.currentTime);
  gain.gain.setValueAtTime(0.14, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.04);
  osc.start(a.currentTime);
  osc.stop(a.currentTime + 0.05);
}

/** No-op on web — the AudioContext is created lazily on first user
 *  gesture, no asset preload needed. Mirrors the native signature so call
 *  sites stay platform-agnostic. */
export function warmUpSounds(): void { /* no-op */ }

/** Short square-wave blip — classic laser shot */
export function playShoot(): void {
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.connect(gain); gain.connect(comp());
  osc.type = 'square';
  osc.frequency.setValueAtTime(640, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(90, a.currentTime + 0.1);
  gain.gain.setValueAtTime(0.22, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.1);
  osc.start(a.currentTime);
  osc.stop(a.currentTime + 0.11);
}

/** Lower, growlier triangle-wave shot used by enemies — easy to tell apart
 *  from the player's bright square-wave laser. */
export function playEnemyShoot(): void {
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.connect(gain); gain.connect(comp());
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, a.currentTime + 0.18);
  gain.gain.setValueAtTime(0.18, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.18);
  osc.start(a.currentTime);
  osc.stop(a.currentTime + 0.2);
}

/** Start a continuous filtered-noise thruster rumble. Call stop() to silence it. */
export function playThrustStart(): { stop: () => void } {
  const a = ac();
  if (!a) return { stop: () => {} };

  const bufLen = a.sampleRate * 2;
  const buf = a.createBuffer(1, bufLen, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;

  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const filt = a.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 75;
  filt.Q.value = 0.7;

  const gain = a.createGain();
  gain.gain.setValueAtTime(0, a.currentTime);
  gain.gain.linearRampToValueAtTime(0.14, a.currentTime + 0.08);

  src.connect(filt); filt.connect(gain); gain.connect(comp());
  src.start();

  return {
    stop: () => {
      const now = a.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.06);
      setTimeout(() => { try { src.stop(); } catch (_) {} }, 120);
    },
  };
}

/** Classic two-tone arcade coin insert */
export function playCoinInsert(): void {
  const a = ac(); if (!a) return;
  const tones = [880, 1320];
  tones.forEach((freq, i) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.connect(gain); gain.connect(comp());
    osc.type = 'square';
    const t = a.currentTime + i * 0.055;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.setValueAtTime(freq * 1.15, t + 0.012);
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.start(t); osc.stop(t + 0.1);
  });
}

/** Jubilant ascending arpeggio — played when daily reward coins are collected */
export function playCoinCollect(): void {
  const a = ac(); if (!a) return;
  // Rising major arpeggio: C5 E5 G5 C6 with a final sparkle
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((freq, i) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.connect(gain); gain.connect(comp());
    osc.type = i < 4 ? 'square' : 'sine';
    const t = a.currentTime + i * 0.07;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.setValueAtTime(freq * 1.04, t + 0.015);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.start(t); osc.stop(t + 0.2);
  });
}

/** Single countdown beep — higher pitch for final tick */
export function playCountdownBeep(n: 3 | 2 | 1): void {
  const a = ac(); if (!a) return;
  const freq = n === 1 ? 1100 : 660;
  const dur  = n === 1 ? 0.18 : 0.12;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.connect(gain); gain.connect(comp());
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.22, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  osc.start(a.currentTime); osc.stop(a.currentTime + dur + 0.01);
}

/** Ascending arpeggio for GO! */
export function playCountdownGo(): void {
  const a = ac(); if (!a) return;
  [440, 554, 659, 880].forEach((freq, i) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.connect(gain); gain.connect(comp());
    osc.type = 'square';
    osc.frequency.value = freq;
    const t = a.currentTime + i * 0.045;
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.start(t); osc.stop(t + 0.15);
  });
}

/** Sharp descending wail when the ship takes a hit but survives */
export function playShipHit(): void {
  const a = ac(); if (!a) return;

  // Sawtooth sweep: 880 → 110 Hz over 0.4 s
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.connect(gain); gain.connect(comp());
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(880, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(110, a.currentTime + 0.38);
  gain.gain.setValueAtTime(0.48, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.38);
  osc.start(a.currentTime);
  osc.stop(a.currentTime + 0.40);

  // Short high noise burst
  const bufLen = Math.round(a.sampleRate * 0.10);
  const buf = a.createBuffer(1, bufLen, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 0.7);
  const src = a.createBufferSource();
  src.buffer = buf;
  const nfilt = a.createBiquadFilter();
  nfilt.type = 'bandpass'; nfilt.frequency.value = 1400; nfilt.Q.value = 0.6;
  const ng = a.createGain(); ng.gain.value = 0.55;
  src.connect(nfilt); nfilt.connect(ng); ng.connect(comp());
  src.start();
}

/** Dramatic destruction sound — layered noise burst + deep descending wail */
export function playShipDestroyed(): void {
  const a = ac(); if (!a) return;

  // Noise explosion — same approach as large asteroid but bigger
  const dur = 1.1;
  const bufLen = Math.round(a.sampleRate * dur);
  const buf = a.createBuffer(1, bufLen, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 0.85);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filt = a.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = 800; filt.Q.value = 0.3;
  const gain = a.createGain(); gain.gain.value = 1.8;
  src.connect(filt); filt.connect(gain); gain.connect(comp());
  src.start();

  // Sub-bass pitch drop: 140 → 18 Hz (the "ship dying" tone)
  const osc1 = a.createOscillator();
  const og1 = a.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(140, a.currentTime);
  osc1.frequency.exponentialRampToValueAtTime(18, a.currentTime + dur * 0.7);
  og1.gain.setValueAtTime(1.2, a.currentTime);
  og1.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur * 0.65);
  osc1.connect(og1); og1.connect(comp());
  osc1.start(); osc1.stop(a.currentTime + dur);

  // High sawtooth wail 600 → 80 Hz — gives it the "dying spaceship" character
  const osc2 = a.createOscillator();
  const og2 = a.createGain();
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(600, a.currentTime + 0.06);
  osc2.frequency.exponentialRampToValueAtTime(80, a.currentTime + 0.85);
  og2.gain.setValueAtTime(0.4, a.currentTime + 0.06);
  og2.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.85);
  osc2.connect(og2); og2.connect(comp());
  osc2.start(a.currentTime + 0.06); osc2.stop(a.currentTime + 0.86);
}

export function playExplosion(size: 'small' | 'medium' | 'large'): void {
  const a = ac(); if (!a) return;
  const dur  = size === 'large' ? 0.85 : size === 'medium' ? 0.48 : 0.24;
  const vol  = size === 'large' ? 1.4  : size === 'medium' ? 0.95 : 0.55;
  const cutoff = size === 'large' ? 500 : size === 'medium' ? 1000 : 2200;

  // White noise with amplitude envelope baked in
  const bufLen = Math.round(a.sampleRate * dur);
  const buf = a.createBuffer(1, bufLen, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.1);
  }

  const src = a.createBufferSource();
  src.buffer = buf;

  // Wider lowpass than before — preserves more energy
  const filt = a.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = cutoff;
  filt.Q.value = 0.4;

  const gain = a.createGain();
  gain.gain.value = vol;

  src.connect(filt); filt.connect(gain); gain.connect(comp());
  src.start();

  // Sub-bass pitch-drop tone for large/medium — the classic arcade "boom"
  if (size !== 'small') {
    const osc = a.createOscillator();
    const og = a.createGain();
    osc.type = 'sine';
    const startFreq = size === 'large' ? 90 : 160;
    osc.frequency.setValueAtTime(startFreq, a.currentTime);
    osc.frequency.exponentialRampToValueAtTime(18, a.currentTime + dur * 0.55);
    og.gain.setValueAtTime(vol * 0.7, a.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur * 0.5);
    osc.connect(og); og.connect(comp());
    osc.start(a.currentTime);
    osc.stop(a.currentTime + dur);
  }
}

/** Soft wooden knock — Go stone placed on board */
export function playStonePlace(): void {
  const a = ac(); if (!a) return;
  // Short percussive noise burst shaped like a wooden knock
  const dur = 0.06;
  const bufLen = Math.round(a.sampleRate * dur);
  const buf = a.createBuffer(1, bufLen, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.8);
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const filt = a.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 900;
  filt.Q.value = 1.2;
  const gain = a.createGain();
  gain.gain.value = 0.5;
  src.connect(filt); filt.connect(gain); gain.connect(comp());
  src.start();

  // Resonant "clack" tone underneath
  const osc = a.createOscillator();
  const og = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, a.currentTime + 0.05);
  og.gain.setValueAtTime(0.18, a.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.06);
  osc.connect(og); og.connect(comp());
  osc.start(a.currentTime); osc.stop(a.currentTime + 0.07);
}

/** Quick multi-pop — played when opponent's stones are captured */
export function playStoneCapture(count: number = 1): void {
  const a = ac(); if (!a) return;
  const n = Math.min(count, 4);
  for (let i = 0; i < n; i++) {
    const t = a.currentTime + i * 0.04;
    const osc = a.createOscillator();
    const og = a.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600 - i * 60, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.07);
    og.gain.setValueAtTime(0.16, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(og); og.connect(comp());
    osc.start(t); osc.stop(t + 0.09);
  }
}

/** Low thud — illegal move attempt (e.g. suicide, ko) */
export function playIllegalMove(): void {
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.connect(gain); gain.connect(comp());
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, a.currentTime + 0.15);
  gain.gain.setValueAtTime(0.2, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.15);
  osc.start(a.currentTime); osc.stop(a.currentTime + 0.16);
}

/** Pass move chime */
export function playPassMove(): void {
  const a = ac(); if (!a) return;
  [523, 659].forEach((freq, i) => {
    const t = a.currentTime + i * 0.08;
    const osc = a.createOscillator();
    const og = a.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(og); og.connect(comp());
    osc.start(t); osc.stop(t + 0.24);
  });
}

/** Win fanfare */
export function playGoWin(): void {
  const a = ac(); if (!a) return;
  [523, 659, 784, 1047, 1319].forEach((freq, i) => {
    const t = a.currentTime + i * 0.1;
    const osc = a.createOscillator();
    const og = a.createGain();
    osc.type = i < 4 ? 'square' : 'sine';
    osc.frequency.value = freq;
    og.gain.setValueAtTime(0.22, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(og); og.connect(comp());
    osc.start(t); osc.stop(t + 0.24);
  });
}

/** Lose sound */
export function playGoLose(): void {
  const a = ac(); if (!a) return;
  [440, 350, 220].forEach((freq, i) => {
    const t = a.currentTime + i * 0.14;
    const osc = a.createOscillator();
    const og = a.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(og); og.connect(comp());
    osc.start(t); osc.stop(t + 0.26);
  });
}
