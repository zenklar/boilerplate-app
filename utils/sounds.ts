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

/** Short square-wave blip — classic laser shot */
export function playShoot(): void {
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.connect(gain); gain.connect(a.destination);
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

  src.connect(filt); filt.connect(gain); gain.connect(a.destination);
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

/** Noise-burst explosion — size controls duration, pitch and volume */
export function playExplosion(size: 'small' | 'medium' | 'large'): void {
  const a = ac(); if (!a) return;
  const dur   = size === 'large' ? 0.65 : size === 'medium' ? 0.35 : 0.18;
  const freq  = size === 'large' ? 90   : size === 'medium' ? 200  : 450;
  const vol   = size === 'large' ? 0.55 : size === 'medium' ? 0.38 : 0.22;

  const bufLen = Math.round(a.sampleRate * dur);
  const buf = a.createBuffer(1, bufLen, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.4);
  }

  const src = a.createBufferSource();
  src.buffer = buf;

  const filt = a.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = freq;

  const gain = a.createGain();
  gain.gain.value = vol;

  src.connect(filt); filt.connect(gain); gain.connect(a.destination);
  src.start();
}
