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

// One-time audio-mode init. We want game sounds to mix with the silent switch
// on iOS (playsInSilentMode), not interrupt music, and to keep playing while
// the device is in silent mode so the user actually hears the SFX.
let _modeInit = false;
function ensureAudioMode() {
  if (_modeInit) return;
  _modeInit = true;
  // setAudioModeAsync is async but we don't await — first sound may have to
  // wait a frame for the mode to settle, which is fine.
  setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
  }).catch(() => { /* silent — sounds will still play with default mode */ });
}

// Pool size per sound — small enough to keep memory low, large enough that
// the player can rapidly retrigger (e.g. firing in Asteroids).
const POOL_SIZE = 4;

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
  ensureAudioMode();
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
  trigger('rotate', SND.rotate, 1, 3);
}

export function playMove(): void {
  trigger('move', SND.move, 1, 3);
}

/** Eagerly init the audio mode and create the player pools for every
 *  sound this game will need, so the first call to play*() doesn't have to
 *  wait for expo-audio to load the asset (which it does asynchronously
 *  inside createAudioPlayer). Without this, the very first beep after a
 *  fresh app launch — typically the first countdown tick — can be
 *  swallowed because the WAV finishes loading after we already called
 *  play(). Safe to call multiple times. */
export function warmUpSounds(): void {
  ensureAudioMode();
  // Touch every pool once; getPool is idempotent and the players preload
  // their sources immediately on construction.
  for (const [id, src] of Object.entries(SND)) {
    // Default pool size; the looped thrust gets its dedicated player when
    // playThrustStart() is called, so we skip pre-creating it here.
    if (id === 'thrustLoop') continue;
    getPool(id, src as number);
  }
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

/** Looping thruster rumble. Returns a handle with stop() to silence it. */
export function playThrustStart(): { stop: () => void } {
  ensureAudioMode();
  // Single dedicated player so we can loop + stop deterministically.
  let player: AudioPlayer | null = null;
  try {
    player = createAudioPlayer(SND.thrustLoop);
    player.loop = true;
    player.volume = 0.7;
    player.seekTo(0);
    player.play();
  } catch (_) {
    return { stop: () => {} };
  }
  return {
    stop: () => {
      if (!player) return;
      try {
        player.pause();
        // Defer remove() so an in-flight play() call doesn't error.
        const p = player;
        setTimeout(() => { try { p.remove(); } catch (_) {} }, 50);
      } catch (_) { /* ignore */ }
      player = null;
    },
  };
}
