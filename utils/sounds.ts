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

/** Punchy noise-burst explosion with optional sub-bass tone for large/medium */
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
