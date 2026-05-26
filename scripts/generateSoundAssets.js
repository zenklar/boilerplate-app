#!/usr/bin/env node
/*
 * Generates the bundled WAV sound effects for native (Android / iOS).
 *
 * Web uses the Web Audio API at runtime (utils/sounds.ts). React Native has no
 * Web Audio, so we mirror the same DSP here in plain JS, render each effect to
 * a mono 16-bit PCM WAV, and ship the files in assets/sounds. utils/sounds.ts
 * dispatches to expo-audio on native, loading these files.
 *
 * Re-run when sound parameters change:
 *   node scripts/generateSoundAssets.js
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(OUT_DIR, { recursive: true });

/* ── Buffer helpers ─────────────────────────────────────────────────────── */
function makeBuffer(durSec) {
  return new Float32Array(Math.ceil(SAMPLE_RATE * durSec));
}
function mix(dst, src, offsetSec = 0, gain = 1) {
  const off = Math.round(offsetSec * SAMPLE_RATE);
  const n = Math.min(src.length, dst.length - off);
  for (let i = 0; i < n; i++) dst[off + i] += src[i] * gain;
}

/* ── Oscillator with frequency envelopes & gain envelope ────────────────── */
// Frequency env: array of { t, value, type: 'set'|'exp' } anchor points.
// Gain env: same shape. Linear or exp ramp between anchors.
function osc({ type, freqEnv, gainEnv, durSec }) {
  const out = makeBuffer(durSec);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const f = envValue(freqEnv, t);
    const g = envValue(gainEnv, t);
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
    let s;
    switch (type) {
      case 'sine':    s = Math.sin(phase); break;
      case 'square':  s = Math.sin(phase) >= 0 ? 1 : -1; break;
      case 'triangle':s = (2 / Math.PI) * Math.asin(Math.sin(phase)); break;
      case 'sawtooth':s = (phase / Math.PI) - 1; break;
      default: s = 0;
    }
    out[i] = s * g;
  }
  return out;
}

function envValue(env, t) {
  if (env.length === 0) return 0;
  if (t <= env[0].t) return env[0].value;
  for (let i = 1; i < env.length; i++) {
    const a = env[i - 1], b = env[i];
    if (t <= b.t) {
      const span = b.t - a.t;
      if (span <= 0 || b.type === 'set') return a.value;
      const u = (t - a.t) / span;
      if (b.type === 'exp') {
        const a0 = Math.max(1e-6, a.value);
        const b0 = Math.max(1e-6, b.value);
        return a0 * Math.pow(b0 / a0, u);
      }
      return a.value + (b.value - a.value) * u; // linear
    }
  }
  return env[env.length - 1].value;
}

/* ── Noise + filter primitives ──────────────────────────────────────────── */
function whiteNoise(durSec) {
  const n = Math.ceil(SAMPLE_RATE * durSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.random() * 2 - 1;
  return out;
}

// Two-pole biquad — translated from Audio EQ Cookbook (RBJ).
function biquad(samples, type, freq, Q) {
  const w0 = (2 * Math.PI * freq) / SAMPLE_RATE;
  const cosw = Math.cos(w0);
  const sinw = Math.sin(w0);
  const alpha = sinw / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass') {
    b0 = (1 - cosw) / 2; b1 = 1 - cosw; b2 = (1 - cosw) / 2;
    a0 = 1 + alpha;       a1 = -2 * cosw; a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cosw) / 2; b1 = -(1 + cosw); b2 = (1 + cosw) / 2;
    a0 = 1 + alpha;       a1 = -2 * cosw;   a2 = 1 - alpha;
  } else if (type === 'bandpass') {
    b0 = alpha; b1 = 0; b2 = -alpha;
    a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha;
  } else throw new Error('unknown filter type ' + type);
  // normalise
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }
  return out;
}

function applyEnvelope(samples, gainEnv) {
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= envValue(gainEnv, i / SAMPLE_RATE);
  }
  return samples;
}

/* ── Simple dynamics — soft clip mirroring the web compressor's effect ──── */
function softClip(samples, threshold = 0.95) {
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    if (x > threshold)  samples[i] = threshold + (1 - threshold) * Math.tanh((x - threshold) / (1 - threshold));
    if (x < -threshold) samples[i] = -threshold + (1 - threshold) * Math.tanh((x + threshold) / (1 - threshold));
  }
  return samples;
}

/* ── WAV writer (mono, 16-bit PCM) ──────────────────────────────────────── */
function writeWav(filename, samples) {
  // Find peak and normalize headroom — match the perceived loudness of the
  // web compressor's output (threshold -4 dB ≈ 0.63 peak).
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  // Headroom: target peak around 0.85 so we don't hit clip on slight envelope spikes.
  const target = 0.85;
  const norm = peak > target ? target / peak : 1;
  const n = samples.length;
  const dataBytes = n * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);            // PCM chunk size
  buf.writeUInt16LE(1, 20);             // PCM format
  buf.writeUInt16LE(1, 22);             // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32);             // block align
  buf.writeUInt16LE(16, 34);            // bits/sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < n; i++) {
    let s = samples[i] * norm;
    if (s > 1) s = 1; if (s < -1) s = -1;
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  console.log(`  → ${filename}  (${(dataBytes / 1024).toFixed(1)} KB, peak=${peak.toFixed(3)})`);
}

/* ── Sound definitions — mirror utils/sounds.ts ─────────────────────────── */

function shoot() {
  const dur = 0.11;
  const s = osc({
    type: 'square', durSec: dur,
    freqEnv: [{ t: 0, value: 640, type: 'set' }, { t: 0.1, value: 90, type: 'exp' }],
    gainEnv: [{ t: 0, value: 0.22, type: 'set' }, { t: 0.1, value: 0.001, type: 'exp' }],
  });
  return softClip(s);
}

function enemyShoot() {
  const dur = 0.2;
  const s = osc({
    type: 'triangle', durSec: dur,
    freqEnv: [{ t: 0, value: 220, type: 'set' }, { t: 0.18, value: 60, type: 'exp' }],
    gainEnv: [{ t: 0, value: 0.18, type: 'set' }, { t: 0.18, value: 0.001, type: 'exp' }],
  });
  return softClip(s);
}

function coinInsert() {
  // Two tones at 0 and 0.055 s.
  const out = makeBuffer(0.18);
  [880, 1320].forEach((freq, i) => {
    const start = i * 0.055;
    // Web code does setValueAtTime(freq) then setValueAtTime(freq*1.15) at +0.012
    // — a tiny pitch step up. Approximate as a stepped square.
    const tone = osc({
      type: 'square', durSec: 0.1,
      freqEnv: [
        { t: 0,     value: freq,        type: 'set' },
        { t: 0.012, value: freq * 1.15, type: 'set' },
        { t: 0.1,   value: freq * 1.15, type: 'set' },
      ],
      gainEnv: [{ t: 0, value: 0.28, type: 'set' }, { t: 0.09, value: 0.001, type: 'exp' }],
    });
    mix(out, tone, start);
  });
  return softClip(out);
}

function coinCollect() {
  const notes = [523, 659, 784, 1047, 1319];
  const out = makeBuffer(0.07 * notes.length + 0.22);
  notes.forEach((freq, i) => {
    const start = i * 0.07;
    const tone = osc({
      type: i < 4 ? 'square' : 'sine', durSec: 0.2,
      freqEnv: [
        { t: 0,     value: freq,        type: 'set' },
        { t: 0.015, value: freq * 1.04, type: 'set' },
        { t: 0.2,   value: freq * 1.04, type: 'set' },
      ],
      gainEnv: [{ t: 0, value: 0.22, type: 'set' }, { t: 0.18, value: 0.001, type: 'exp' }],
    });
    mix(out, tone, start);
  });
  return softClip(out);
}

function countdownBeep(n) {
  const freq = n === 1 ? 1100 : 660;
  const dur  = n === 1 ? 0.18 : 0.12;
  const s = osc({
    type: 'square', durSec: dur + 0.01,
    freqEnv: [{ t: 0, value: freq, type: 'set' }, { t: dur, value: freq, type: 'set' }],
    gainEnv: [{ t: 0, value: 0.22, type: 'set' }, { t: dur, value: 0.001, type: 'exp' }],
  });
  return softClip(s);
}

function countdownGo() {
  const notes = [440, 554, 659, 880];
  const out = makeBuffer(0.045 * notes.length + 0.16);
  notes.forEach((freq, i) => {
    const start = i * 0.045;
    const tone = osc({
      type: 'square', durSec: 0.15,
      freqEnv: [{ t: 0, value: freq, type: 'set' }, { t: 0.15, value: freq, type: 'set' }],
      gainEnv: [{ t: 0, value: 0.25, type: 'set' }, { t: 0.14, value: 0.001, type: 'exp' }],
    });
    mix(out, tone, start);
  });
  return softClip(out);
}

function shipHit() {
  const dur = 0.40;
  const out = makeBuffer(dur);
  // Sawtooth sweep 880 → 110 Hz
  const sweep = osc({
    type: 'sawtooth', durSec: 0.40,
    freqEnv: [{ t: 0, value: 880, type: 'set' }, { t: 0.38, value: 110, type: 'exp' }],
    gainEnv: [{ t: 0, value: 0.48, type: 'set' }, { t: 0.38, value: 0.001, type: 'exp' }],
  });
  mix(out, sweep, 0);
  // Short high noise burst (0.10 s) bandpassed around 1400 Hz
  let burst = whiteNoise(0.10);
  for (let i = 0; i < burst.length; i++) burst[i] *= Math.pow(1 - i / burst.length, 0.7);
  burst = biquad(burst, 'bandpass', 1400, 0.6);
  applyEnvelope(burst, [{ t: 0, value: 0.55, type: 'set' }]);
  mix(out, burst, 0);
  return softClip(out);
}

function shipDestroyed() {
  const dur = 1.1;
  const out = makeBuffer(dur);
  // Lowpassed noise explosion
  let noise = whiteNoise(dur);
  for (let i = 0; i < noise.length; i++) noise[i] *= Math.pow(1 - i / noise.length, 0.85);
  noise = biquad(noise, 'lowpass', 800, 0.3);
  mix(out, noise, 0, 1.8);
  // Sub-bass 140 → 18 Hz over 0.7*dur
  const sub = osc({
    type: 'sine', durSec: dur,
    freqEnv: [{ t: 0, value: 140, type: 'set' }, { t: dur * 0.7, value: 18, type: 'exp' }],
    gainEnv: [{ t: 0, value: 1.2, type: 'set' }, { t: dur * 0.65, value: 0.001, type: 'exp' }],
  });
  mix(out, sub, 0);
  // Sawtooth wail 600 → 80 Hz from 0.06 → 0.85
  const wail = osc({
    type: 'sawtooth', durSec: 0.85,
    freqEnv: [{ t: 0, value: 600, type: 'set' }, { t: 0.79, value: 80, type: 'exp' }],
    gainEnv: [{ t: 0, value: 0.4, type: 'set' }, { t: 0.79, value: 0.001, type: 'exp' }],
  });
  mix(out, wail, 0.06);
  return softClip(out);
}

function explosion(size) {
  const dur    = size === 'large' ? 0.85 : size === 'medium' ? 0.48 : 0.24;
  const vol    = size === 'large' ? 1.4  : size === 'medium' ? 0.95 : 0.55;
  const cutoff = size === 'large' ? 500  : size === 'medium' ? 1000 : 2200;
  const out = makeBuffer(dur);
  // Noise with bake-in amplitude envelope
  let noise = whiteNoise(dur);
  for (let i = 0; i < noise.length; i++) noise[i] *= Math.pow(1 - i / noise.length, 1.1);
  noise = biquad(noise, 'lowpass', cutoff, 0.4);
  mix(out, noise, 0, vol);
  if (size !== 'small') {
    const startFreq = size === 'large' ? 90 : 160;
    const sub = osc({
      type: 'sine', durSec: dur,
      freqEnv: [{ t: 0, value: startFreq, type: 'set' }, { t: dur * 0.55, value: 18, type: 'exp' }],
      gainEnv: [{ t: 0, value: vol * 0.7, type: 'set' }, { t: dur * 0.5, value: 0.001, type: 'exp' }],
    });
    mix(out, sub, 0);
  }
  return softClip(out);
}

function thrustLoop() {
  // 0.5 s of bandpassed noise around 75 Hz, designed to loop seamlessly.
  // Apply a tiny crossfade at the ends so loop joins don't click.
  const dur = 0.5;
  let noise = whiteNoise(dur);
  noise = biquad(noise, 'bandpass', 75, 0.7);
  const out = new Float32Array(noise.length);
  const fade = Math.round(SAMPLE_RATE * 0.02);
  for (let i = 0; i < noise.length; i++) {
    let g = 0.14;
    if (i < fade) g *= i / fade;
    if (i > noise.length - fade) g *= (noise.length - i) / fade;
    out[i] = noise[i] * g;
  }
  return softClip(out);
}

/* ── Render everything ──────────────────────────────────────────────────── */
console.log('Rendering arcade sound assets →', OUT_DIR);
writeWav('shoot.wav',          shoot());
writeWav('enemy_shoot.wav',    enemyShoot());
writeWav('coin_insert.wav',    coinInsert());
writeWav('coin_collect.wav',   coinCollect());
writeWav('countdown_1.wav',    countdownBeep(1));
writeWav('countdown_2.wav',    countdownBeep(2));
writeWav('countdown_3.wav',    countdownBeep(3));
writeWav('countdown_go.wav',   countdownGo());
writeWav('ship_hit.wav',       shipHit());
writeWav('ship_destroyed.wav', shipDestroyed());
writeWav('explosion_small.wav',  explosion('small'));
writeWav('explosion_medium.wav', explosion('medium'));
writeWav('explosion_large.wav',  explosion('large'));
writeWav('thrust_loop.wav',    thrustLoop());
console.log('Done.');
