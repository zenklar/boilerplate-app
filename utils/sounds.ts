/* Native (Android / iOS) arcade sound playback.
 *
 * The web build uses utils/sounds.web.ts (Web Audio API synthesis). React
 * Native has no Web Audio, so we ship pre-rendered WAVs in assets/sounds and
 * play them with expo-audio. The WAVs are produced by
 * scripts/generateSoundAssets.js using the same DSP math as the web version.
 *
 * Each non-loop sound gets a small player pool so rapid retriggers (multiple
 * bullets, overlapping explosions) don't truncate each other. */

import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

// Set the audio mode once at module load — fire-and-forget, completes well
// before any sound is played. We want game SFX to mix with the iOS silent
// switch (playsInSilentMode), not interrupt other audio, and keep playing
// while the device is in silent mode.
setAudioModeAsync({
  playsInSilentMode: true,
  allowsRecording: false,
  interruptionMode: 'mixWithOthers',
  shouldPlayInBackground: false,
}).catch(() => { /* sounds still play with the platform default mode */ });

// Pool size per sound. Keep this small — each entry holds a native
// AudioPlayer, and both iOS and Android have practical limits on how many
// can coexist before creation starts to fail. 2 is enough for any sound
// in this app: even Asteroids' rapid fire is capped by FIRE_CD so two
// players cycle comfortably without truncating each other.
const POOL_SIZE = 2;

type Pool = {
  players: AudioPlayer[];
  next: number;
};

const pools = new Map<string, Pool>();

function getPool(id: string, source: number, size = POOL_SIZE): Pool {
  let p = pools.get(id);
  if (!p) {
    const players: AudioPlayer[] = [];
    for (let i = 0; i < size; i++) {
      try {
        players.push(createAudioPlayer(source));
      } catch (_) { /* if creation fails the sound is silently skipped */ }
    }
    p = { players, next: 0 };
    pools.set(id, p);
  }
  return p;
}

function trigger(id: string, source: number, volume = 1, size = POOL_SIZE) {
  const pool = getPool(id, source, size);
  if (pool.players.length === 0) return;
  const player = pool.players[pool.next];
  pool.next = (pool.next + 1) % pool.players.length;
  try {
    player.volume = volume;
    // seekTo(0) then play() retriggers from the start; needed because the
    // player retains its previous position after a play-to-end.
    player.seekTo(0);
    player.play();
  } catch (_) { /* swallow — never let a sound failure crash the game */ }
}

/* ── Bundled sources ─────────────────────────────────────────────────────
 * Static require() so Metro can resolve the assets at bundle time. */
const SND = {
  shoot:           require('../assets/sounds/shoot.wav'),
  enemyShoot:      require('../assets/sounds/enemy_shoot.wav'),
  rotate:          require('../assets/sounds/rotate.wav'),
  move:            require('../assets/sounds/move.wav'),
  coinInsert:      require('../assets/sounds/coin_insert.wav'),
  coinCollect:     require('../assets/sounds/coin_collect.wav'),
  countdown1:      require('../assets/sounds/countdown_1.wav'),
  countdown2:      require('../assets/sounds/countdown_2.wav'),
  countdown3:      require('../assets/sounds/countdown_3.wav'),
  countdownGo:     require('../assets/sounds/countdown_go.wav'),
  shipHit:         require('../assets/sounds/ship_hit.wav'),
  shipDestroyed:   require('../assets/sounds/ship_destroyed.wav'),
  explosionSmall:  require('../assets/sounds/explosion_small.wav'),
  explosionMedium: require('../assets/sounds/explosion_medium.wav'),
  explosionLarge:  require('../assets/sounds/explosion_large.wav'),
  thrustLoop:      require('../assets/sounds/thrust_loop.wav'),
};

/* ── Public API — same signatures as utils/sounds.web.ts ─────────────────── */

export function playShoot(): void {
  trigger('shoot', SND.shoot, 1);
}

export function playEnemyShoot(): void {
  trigger('enemyShoot', SND.enemyShoot, 1);
}

export function playRotate(): void {
  trigger('rotate', SND.rotate, 1);
}

export function playMove(): void {
  trigger('move', SND.move, 1);
}

/** Preload the player pools for the few sounds that need to play with
 *  tight timing right after the game mounts — the coin-insert and the
 *  countdown beeps. createAudioPlayer() returns synchronously but decodes
 *  the WAV on a background thread, so the first play() call on a brand
 *  new player can be silent. For those sounds we can't tolerate a missed
 *  beep, so we create them ahead of time (size 1 — there's never more
 *  than one in flight). Other sounds stay lazy so we don't flood the
 *  native audio system with players we may never need; that flood was
 *  the actual cause of intermittent dropouts seen across both platforms. */
export function warmUpSounds(): void {
  getPool('coinInsert',   SND.coinInsert,   1);
  getPool('countdown1',   SND.countdown1,   1);
  getPool('countdown2',   SND.countdown2,   1);
  getPool('countdown3',   SND.countdown3,   1);
  getPool('countdownGo',  SND.countdownGo,  1);
}

export function playCoinInsert(): void {
  // Two-tone insert is baked into the WAV; small pool since this is one-shot
  // and unlikely to overlap.
  trigger('coinInsert', SND.coinInsert, 1, 2);
}

export function playCoinCollect(): void {
  trigger('coinCollect', SND.coinCollect, 1, 2);
}

export function playCountdownBeep(n: 3 | 2 | 1): void {
  const src = n === 1 ? SND.countdown1 : n === 2 ? SND.countdown2 : SND.countdown3;
  trigger(`countdown${n}`, src, 1, 2);
}

export function playCountdownGo(): void {
  trigger('countdownGo', SND.countdownGo, 1, 2);
}

export function playShipHit(): void {
  trigger('shipHit', SND.shipHit, 1, 2);
}

export function playShipDestroyed(): void {
  trigger('shipDestroyed', SND.shipDestroyed, 1, 2);
}

export function playExplosion(size: 'small' | 'medium' | 'large'): void {
  const src = size === 'large'  ? SND.explosionLarge
            : size === 'medium' ? SND.explosionMedium
            : SND.explosionSmall;
  trigger(`explosion-${size}`, src, 1);
}

// Persistent module-level thrust player — created once on first thrust and
// reused for the lifetime of the app. Avoids rapid native player
// create/destroy cycles when the user toggles thrust quickly (joystick dead
// zone), which can exhaust Android audio resources and cause native crashes.
let _thrustPlayer: AudioPlayer | null = null;

/** Looping thruster rumble. Returns a handle with stop() to silence it. */
export function playThrustStart(): { stop: () => void } {
  if (!_thrustPlayer) {
    try {
      _thrustPlayer = createAudioPlayer(SND.thrustLoop);
      _thrustPlayer.loop = true;
      _thrustPlayer.volume = 0.7;
    } catch (_) {
      return { stop: () => {} };
    }
  }
  try {
    _thrustPlayer.seekTo(0);
    _thrustPlayer.play();
  } catch (_) { /* ignore — sound will just be silent */ }
  return {
    stop: () => {
      try { _thrustPlayer?.pause(); } catch (_) {}
    },
  };
}
