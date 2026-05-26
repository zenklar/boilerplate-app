import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutChangeEvent,
  Platform,
  PanResponder,
  Animated,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Polygon } from 'react-native-svg';
import { fitPreview } from './game/previewFrame';
import GameControlsInfo from './game/GameControlsInfo';
import { useGameUIStore } from '../store/gameStore';
import { useShipStore } from '../store/shipStore';
import { useCoinStore } from '../store/coinStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useEnemyCodexStore } from '../store/enemyCodexStore';
import { SHIPS } from '../constants/ships';
import ShipPreview from './ShipPreview';
import ArcadeCoin from './ArcadeCoin';
import ENEMY_IMAGES, { ENEMY_DESIGN_IDS } from '../constants/enemyImages';
import { playShoot, playThrustStart, playExplosion, playCoinInsert, playCountdownBeep, playCountdownGo, playShipHit, playShipDestroyed, playEnemyShoot } from '../utils/sounds';

/* ─── Constants ─────────────────────────────────────────────────────── */
const TICK_MS = 16;
const SHIP_SIZE = 44;
const ENEMY_BULLET_SPEED_BASE = 5.0;
const BULLET_SPEED = ENEMY_BULLET_SPEED_BASE * 1.32;
const BULLET_LEN = 14;
const BULLET_W = 3;
const BULLET_LIFETIME = 95;
const THRUST_PWR = 0.13;
const FRICTION = 0.988;
const MAX_SPD = 7;
const ROT_SPD = 4.5;
const FIRE_CD = 12;
const SAFE_R = 130;
const INVINCIBLE = 180;
// Mobile: controls overlay at bottom. Web: full canvas height.
const CTRL_H = Platform.OS === 'web' ? 0 : 140;
const JOY_MAX = 52;
const JOY_THUMB_R = 24;
const JOY_DEAD = JOY_MAX * 0.18;

const PARTICLE_MAX_LIFE = 16;
const PARTICLE_SPAWN = 2;
const PARTICLE_SPREAD = 0.5;

const RADII = { large: 44, medium: 26, small: 14 } as const;
const SPEEDS: Record<string, [number, number]> = {
  large: [0.5, 1.4],
  medium: [0.9, 2.3],
  small: [1.6, 3.4],
};
const SCORE_MAP: Record<string, number> = { large: 20, medium: 50, small: 100 };

/* ── Enemy saucers ─── classic Asteroids UFO ── */
const ENEMY_RADIUS = 26;
const ENEMY_SPRITE = ENEMY_RADIUS * 2.1;
const ENEMY_MAX_HP = 3;
const ENEMY_SCORE = 250;
const ENEMY_BULLET_SPEED = ENEMY_BULLET_SPEED_BASE;
const ENEMY_BULLET_LIFETIME = 110;
/** First level at which a saucer can appear. Below this it's pure asteroids. */
const ENEMY_FIRST_LEVEL = 2;
/** How many saucers spawn for a given level. */
const enemyCountForLevel = (lvl: number): number => {
  if (lvl < ENEMY_FIRST_LEVEL) return 0;
  if (lvl < ENEMY_FIRST_LEVEL + 3) return 1;
  if (lvl < ENEMY_FIRST_LEVEL + 6) return 2;
  return Math.min(4, 2 + Math.floor((lvl - ENEMY_FIRST_LEVEL - 6) / 2));
};
/** Fire cooldown (in ticks) — shorter at higher levels but never brutal. */
const enemyFireCDForLevel = (lvl: number): number =>
  Math.max(70, 150 - (lvl - ENEMY_FIRST_LEVEL) * 8);
/** How accurately the saucer aims (radians of random spread). Higher = sloppier. */
const enemyAimSpreadForLevel = (lvl: number): number =>
  Math.max(0.08, 0.35 - (lvl - ENEMY_FIRST_LEVEL) * 0.025);

type Size = 'large' | 'medium' | 'small';
type Phase = 'idle' | 'demo' | 'intro' | 'playing' | 'gameover';

interface Asteroid {
  id: number;
  x: number; y: number; vx: number; vy: number;
  radius: number; size: Size;
  rot: number; rotSpeed: number;
  verts: number[]; // per-vertex radius offsets, evenly spaced angles
  // Precomputed SVG polygon "points" string — verts never change after creation,
  // so we cache the parsed string to avoid rebuilding it 60×/sec on every asteroid.
  pts: string;
}
interface Bullet {
  x: number; y: number; vx: number; vy: number; life: number;
  // Velocity is fixed at creation, so cache the rotation in degrees once.
  angle: number;
}
interface Enemy {
  id: number;
  /** Which sprite from constants/enemyImages.ts to render. */
  designId: number;
  x: number; y: number; vx: number; vy: number;
  /** Facing angle in degrees (0 = up, like the player ship). */
  angle: number;
  hp: number;
  fireCD: number;
  /** Ticks until next random direction change. */
  driftCD: number;
  /** Ticks remaining of the deflection shield flash (after an asteroid bounce). */
  shieldFlash: number;
}
interface EnemyBullet { x: number; y: number; vx: number; vy: number; life: number; angle: number; }
interface Particle {
  id: number; x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  kind: 'thrust' | 'debris';
}
interface GS {
  phase: Phase;
  sx: number; sy: number; svx: number; svy: number;
  sAngle: number; sInv: number;
  bullets: Bullet[];
  asteroids: Asteroid[];
  enemies: Enemy[];
  enemyBullets: EnemyBullet[];
  particles: Particle[];
  score: number; lives: number; level: number;
  bulletsShot: number;
  asteroidsDestroyed: number;
  startTime: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
let _nid = 1;
const uid = () => _nid++;
const rand = (a: number, b: number) => Math.random() * (b - a) + a;
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const toR = (d: number) => (d * Math.PI) / 180;
const d2 = (ax: number, ay: number, bx: number, by: number) =>
  (ax - bx) ** 2 + (ay - by) ** 2;

function mkAsteroid(
  W: number, H: number, size: Size,
  ox?: number, oy?: number, px?: number, py?: number,
): Asteroid {
  const r = RADII[size];
  const [sMin, sMax] = SPEEDS[size];
  const spd = rand(sMin, sMax);
  const dir = rand(0, Math.PI * 2);
  let x: number, y: number;
  if (px !== undefined) { x = px; y = py!; }
  else {
    let tries = 0;
    do { x = rand(r, W - r); y = rand(r, H - r); tries++; }
    while (ox !== undefined && d2(x, y, ox, oy!) < SAFE_R ** 2 && tries < 40);
  }
  // Classic asteroid polygon — N vertices evenly spaced around a circle,
  // each with its own radius so the outline is jagged and irregular.
  const nv = Math.round(rand(7, 13)); // 7–12 vertices like the original game
  const verts: number[] = [];
  for (let i = 0; i < nv; i++) {
    const u = Math.random();
    if (u < 0.22) {
      verts.push(r * rand(0.45, 0.65)); // concave indent — the classic "bite"
    } else if (u < 0.45) {
      verts.push(r * rand(0.65, 0.80)); // shallow dip
    } else {
      verts.push(r * rand(0.85, 1.20)); // normal outer vertex
    }
  }
  // Precompute SVG polygon points string once (verts are immutable after this).
  const step = (Math.PI * 2) / verts.length;
  let pts = '';
  for (let i = 0; i < verts.length; i++) {
    const ang = i * step - Math.PI / 2;
    pts += (i ? ' ' : '') + (r + Math.cos(ang) * verts[i]) + ',' + (r + Math.sin(ang) * verts[i]);
  }
  return {
    id: uid(), x, y,
    vx: Math.cos(dir) * spd, vy: Math.sin(dir) * spd,
    radius: r, size, rot: rand(0, 360), rotSpeed: rand(-1.5, 1.5),
    verts,
    pts,
  };
}

function mkLevel(lvl: number, W: number, H: number, sx: number, sy: number): Asteroid[] {
  // Raised cap so higher levels keep ramping the asteroid count.
  return Array.from({ length: Math.min(3 + lvl, 20) }, () =>
    mkAsteroid(W, H, 'large', sx, sy));
}

function mkEnemy(W: number, H: number, lvl: number, avoidX: number, avoidY: number): Enemy {
  // Spawn off one of the side edges so the player has time to see it arrive.
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? -ENEMY_RADIUS : W + ENEMY_RADIUS;
  const y = rand(H * 0.15, H * 0.85);
  // Don't crowd the player at the moment of spawn.
  const safeY = Math.abs(y - avoidY) < 80 ? y + (y < avoidY ? -120 : 120) : y;
  const baseSpd = 1.2 + Math.min(1.4, (lvl - ENEMY_FIRST_LEVEL) * 0.12);
  const vx = (fromLeft ? 1 : -1) * baseSpd;
  const designId = ENEMY_DESIGN_IDS[Math.floor(Math.random() * ENEMY_DESIGN_IDS.length)];
  return {
    id: uid(), designId,
    x, y: Math.max(ENEMY_RADIUS, Math.min(H - ENEMY_RADIUS, safeY)),
    vx, vy: 0,
    angle: fromLeft ? 90 : 270, // start facing where they're moving
    hp: ENEMY_MAX_HP,
    fireCD: 60 + Math.floor(rand(0, 40)),
    driftCD: 40 + Math.floor(rand(0, 40)),
    shieldFlash: 0,
  };
}

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

/** Static asteroid polygon. Props never change after the asteroid spawns
 *  (radius and pts are immutable), so React.memo lets the inner SVG skip
 *  reconcile on every game tick — only the outer transform changes. */
const AsteroidShape = React.memo(function AsteroidShape({ d, pts }: { d: number; pts: string }) {
  return (
    <Svg width={d} height={d}>
      <Polygon points={pts} fill="white" stroke="#CCC" strokeWidth={1.5} />
    </Svg>
  );
});

/** Demo-mode AI: rotates the ship toward the nearest asteroid (with bullet
 *  lead) and fires when aligned. Ship doesn't thrust — it drifts only after a
 *  collision teleport. */
function runDemoAI(g: GS, c: { left: boolean; right: boolean; thrust: boolean; fire: boolean; fireCD: number }) {
  c.left = false; c.right = false; c.thrust = false; c.fire = false;
  if (g.asteroids.length === 0) return;
  let nearest = g.asteroids[0];
  let nDist = d2(g.sx, g.sy, nearest.x, nearest.y);
  for (const a of g.asteroids) {
    const dd = d2(g.sx, g.sy, a.x, a.y);
    if (dd < nDist) { nDist = dd; nearest = a; }
  }
  const dist = Math.sqrt(nDist);
  const leadT = dist / BULLET_SPEED;
  const tx = nearest.x + nearest.vx * leadT;
  const ty = nearest.y + nearest.vy * leadT;
  const targetAngle = Math.atan2(ty - g.sy, tx - g.sx) * (180 / Math.PI) + 90;
  let diff = ((targetAngle - g.sAngle + 540) % 360) - 180;
  const step = Math.min(ROT_SPD, Math.abs(diff));
  g.sAngle += Math.sign(diff) * step;
  c.fire = Math.abs(diff) < 5;
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function AsteroidsGame() {
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [gameAreaSize, setGameAreaSize] = useState({ w: 0, h: 0 });
  const [, setTick] = useState(0);
  const [newHS, setNewHS] = useState(false);

  // Coin insert + countdown flow
  type InsertPhase = 'coinanim' | 'countdown' | null;
  const [insertPhase, setInsertPhase] = useState<InsertPhase>(null);
  const [countNum, setCountNum] = useState<number>(3);
  // Animated coin: starts above canvas, falls to center
  const coinY     = useRef(new Animated.Value(-60)).current;
  const coinScale = useRef(new Animated.Value(0.5)).current;
  const coinOpacity = useRef(new Animated.Value(0)).current;
  // Countdown number animation
  const cdScale   = useRef(new Animated.Value(1)).current;
  const cdOpacity = useRef(new Animated.Value(0)).current;

  const highScore = useGameUIStore((s) => s.highScore);
  const updateHighScore = useGameUIStore((s) => s.updateHighScore);
  const loadHighScore = useGameUIStore((s) => s.loadHighScore);
  const addRun = useGameUIStore((s) => s.addRun);
  const loadRuns = useGameUIStore((s) => s.loadRuns);
  const selectedShipId = useShipStore((s) => s.selectedShipId);
  const loadSelectedShip = useShipStore((s) => s.loadSelectedShip);
  const selectedShip = React.useMemo(
    () => SHIPS.find((s) => s.id === selectedShipId) ?? SHIPS[0],
    [selectedShipId],
  );

  const gsRef = useRef<GS | null>(null);
  const thrustSoundRef = useRef<{ stop: () => void } | null>(null);
  // Game object bounds (game area height = canvas height - ctrl overlay height)
  const dimRef = useRef({ w: 0, h: 0 });
  const ctrl = useRef({ left: false, right: false, thrust: false, fire: false, fireCD: 0 });
  const frame = useRef(0);
  const pendingStart = useRef(false);
  const pendingFlyInTicks = useRef<number | undefined>(undefined);
  // Web mouse aim
  const rootRef = useRef<View>(null);
  const canvasOrigin = useRef({ x: 0, y: 0 });
  const mousePos = useRef({ x: 0, y: 0 });
  // Joystick state (mobile)
  const joyActive = useRef(false);
  const joyCtr = useRef({ x: 70, y: 70 });
  const joyOff = useRef({ x: 0, y: 0 });

  const setIsGamePlaying = useGameUIStore((s) => s.setIsGamePlaying);
  const coins    = useCoinStore((s) => s.coins);
  const spendCoin = useCoinStore((s) => s.spendCoin);
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);

  /* ── Load persisted state ── */
  useEffect(() => {
    loadHighScore();
    loadSelectedShip();
    loadRuns();
    useCoinStore.getState().loadCoins();
    useSubscriptionStore.getState().loadSubscription();
    useEnemyCodexStore.getState().load();
  }, []);

  /* ── Web keyboard + mouse controls ── */
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') {
        const g = gsRef.current;
        if (g && g.phase === 'playing') {
          if (thrustSoundRef.current) { thrustSoundRef.current.stop(); thrustSoundRef.current = null; }
          playShipDestroyed();
          g.phase = 'gameover';
          setNewHS(g.score > useGameUIStore.getState().highScore);
          updateHighScore(g.score);
          useGameUIStore.getState().addRun({
            id: String(Date.now()),
            score: g.score,
            bulletsShot: g.bulletsShot,
            asteroidsDestroyed: g.asteroidsDestroyed,
            durationMs: Date.now() - g.startTime,
            date: Date.now(),
          });
          // Keep chrome hidden through the game-over screen so the overlay
          // is the only thing on screen; MENU button flips it back.
          setTick((t) => t + 1);
        }
        return;
      }
      switch (e.code) {
        case 'Space': e.preventDefault(); ctrl.current.fire = true; break;
        case 'ArrowLeft': case 'KeyA': ctrl.current.left = true; break;
        case 'ArrowRight': case 'KeyD': ctrl.current.right = true; break;
        case 'ArrowUp': case 'KeyW': ctrl.current.thrust = true; break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Space': ctrl.current.fire = false; break;
        case 'ArrowLeft': case 'KeyA': ctrl.current.left = false; break;
        case 'ArrowRight': case 'KeyD': ctrl.current.right = false; break;
        case 'ArrowUp': case 'KeyW': ctrl.current.thrust = false; break;
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      // Detect if LMB was released outside the window (mouseup missed)
      if (!(e.buttons & 1)) ctrl.current.thrust = false;
    };
    const onMouseDown = (e: MouseEvent) => { if (e.button === 0) ctrl.current.thrust = true; };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 0) ctrl.current.thrust = false; };
    // Release all controls if the window loses focus
    const onBlur = () => {
      ctrl.current = { left: false, right: false, thrust: false, fire: false, fireCD: 0 };
    };
    // Prevent right-click context menu swallowing mouseup
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  /* ── Single long-running game loop ── */
  // On Android we still SIMULATE at 60 Hz, but only push a React render every
  // other frame (30 fps display). The game state lives in gsRef.current so
  // physics stays accurate; React just paints at half the rate, which cuts
  // reconcile + Yoga + view-bridge cost in half on slow devices/emulators.
  const ANDROID_HALF_RENDER = Platform.OS === 'android';
  // On Android cap the particle pool — particle storms during combat were a
  // dominant cause of frame drops on lower-end devices.
  const MAX_PARTICLES = Platform.OS === 'android' ? 60 : 240;
  useEffect(() => {
    const id = setInterval(() => {
      const { w: W, h: H } = dimRef.current;
      if (!W || !H) { setTick((t) => t + 1); return; }

      const g = gsRef.current;

      /* ── Intro: ship flies in from below, no asteroids yet ── */
      if (g?.phase === 'intro') {
        g.sy += g.svy;
        g.sx = wrap(g.sx + g.svx, W);
        // Thrust particles while flying up
        const exhaustAngle = toR(g.sAngle + 90);
        const ex = g.sx + Math.cos(exhaustAngle) * (SHIP_SIZE / 2);
        const ey = g.sy + Math.sin(exhaustAngle) * (SHIP_SIZE / 2);
        for (let i = 0; i < PARTICLE_SPAWN + 1; i++) {
          const spread = rand(-PARTICLE_SPREAD, PARTICLE_SPREAD);
          const pDir = exhaustAngle + spread;
          const pSpd = rand(1.4, 3.2);
          g.particles.push({
            id: uid(), x: ex + rand(-3, 3), y: ey + rand(-3, 3),
            vx: Math.cos(pDir) * pSpd, vy: Math.sin(pDir) * pSpd,
            life: 22, maxLife: 22, size: rand(2, 4.5), kind: 'thrust',
          });
        }
        for (let i = g.particles.length - 1; i >= 0; i--) {
          const p = g.particles[i];
          p.x += p.vx; p.y += p.vy; p.life--; p.size *= 0.92;
          if (p.life <= 0) g.particles.splice(i, 1);
        }
        // Reached center — hand off to playing
        if (g.sy <= H / 2) {
          g.sy = H / 2; g.svx = 0; g.svy = 0;
          g.sInv = 0;
          g.phase = 'playing';
          g.asteroids = mkLevel(1, W, H, g.sx, g.sy);
          g.startTime = Date.now();
          if (Platform.OS === 'web' && thrustSoundRef.current) {
            thrustSoundRef.current.stop(); thrustSoundRef.current = null;
          }
        }
        setTick((t) => t + 1);
        return;
      }

      if (!g || (g.phase !== 'playing' && g.phase !== 'demo')) { setTick((t) => t + 1); return; }

      const isDemo = g.phase === 'demo';
      frame.current++;
      // Demo (title-screen autoplay) on native runs at 30 fps to free the JS
      // thread before the player taps Play. Real gameplay stays at 60 fps.
      if (isDemo && Platform.OS !== 'web' && (frame.current & 1) === 0) {
        setTick((t) => t + 1);
        return;
      }
      const c = ctrl.current;

      /* Demo: AI controls the ship (sets sAngle directly + ctrl.fire) */
      if (isDemo) runDemoAI(g, c);

      /* Mouse aim on web (overrides arrow-key rotation if mouse moved recently) */
      if (!isDemo && Platform.OS === 'web') {
        const { x: mx, y: my } = mousePos.current;
        const { x: ox, y: oy } = canvasOrigin.current;
        const dx = mx - ox - g.sx;
        const dy = my - oy - g.sy;
        // Only apply mouse aim if mouse has moved away from ship
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          g.sAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        }
        // Arrow keys still work on web for rotation (override mouse aim)
        if (c.left) g.sAngle -= ROT_SPD;
        if (c.right) g.sAngle += ROT_SPD;
      } else if (!isDemo) {
        if (c.left) g.sAngle -= ROT_SPD;
        if (c.right) g.sAngle += ROT_SPD;
      }

      /* Thrust + particle spawn + thrust sound */
      if (c.thrust) {
        const r = toR(g.sAngle - 90);
        g.svx += Math.cos(r) * THRUST_PWR;
        g.svy += Math.sin(r) * THRUST_PWR;
        const spd = Math.sqrt(g.svx ** 2 + g.svy ** 2);
        if (spd > MAX_SPD) {
          g.svx = (g.svx / spd) * MAX_SPD;
          g.svy = (g.svy / spd) * MAX_SPD;
        }
        // Start thrust sound once
        if (Platform.OS === 'web' && !thrustSoundRef.current) {
          thrustSoundRef.current = playThrustStart();
        }
        const exhaustR = toR(g.sAngle + 90);
        const ex = g.sx + Math.cos(exhaustR) * (SHIP_SIZE / 2);
        const ey = g.sy + Math.sin(exhaustR) * (SHIP_SIZE / 2);
        for (let i = 0; i < PARTICLE_SPAWN; i++) {
          const spread = rand(-PARTICLE_SPREAD / 2, PARTICLE_SPREAD / 2);
          const pDir = exhaustR + spread;
          const pSpd = rand(0.8, 2.0);
          g.particles.push({
            id: uid(),
            x: ex + rand(-2, 2), y: ey + rand(-2, 2),
            vx: Math.cos(pDir) * pSpd + g.svx * 0.25,
            vy: Math.sin(pDir) * pSpd + g.svy * 0.25,
            life: PARTICLE_MAX_LIFE, maxLife: PARTICLE_MAX_LIFE,
            size: rand(1.5, 3.5),
            kind: 'thrust',
          });
        }
      } else if (Platform.OS === 'web' && thrustSoundRef.current) {
        thrustSoundRef.current.stop();
        thrustSoundRef.current = null;
      }

      /* Friction & move */
      g.svx *= FRICTION; g.svy *= FRICTION;
      if (isDemo) {
        // Keep the demo ship anchored at center so the preview composition
        // stays clean and consistent across platforms.
        g.sx = W / 2;
        g.sy = H / 2;
        g.svx = 0;
        g.svy = 0;
      } else {
        g.sx = wrap(g.sx + g.svx, W);
        g.sy = wrap(g.sy + g.svy, H);
      }
      if (g.sInv > 0) g.sInv--;

      /* Fire */
      if (c.fire && c.fireCD <= 0) {
        const r = toR(g.sAngle - 90);
        const tip = SHIP_SIZE / 2 + 4;
        const bvx = Math.cos(r) * BULLET_SPEED + g.svx;
        const bvy = Math.sin(r) * BULLET_SPEED + g.svy;
        g.bullets.push({
          x: g.sx + Math.cos(r) * tip,
          y: g.sy + Math.sin(r) * tip,
          vx: bvx, vy: bvy,
          life: BULLET_LIFETIME,
          angle: (Math.atan2(bvy, bvx) * 180) / Math.PI,
        });
        c.fireCD = FIRE_CD;
        g.bulletsShot++;
        if (Platform.OS === 'web' && !isDemo) playShoot();
      }
      if (c.fireCD > 0) c.fireCD--;

      /* Bullets — mutate in place, no per-frame array/object allocations */
      for (let i = g.bullets.length - 1; i >= 0; i--) {
        const b = g.bullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
          g.bullets.splice(i, 1);
        }
      }

      /* Particles — mutate in place */
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.x += p.vx; p.y += p.vy; p.life--; p.size *= 0.92;
        if (p.life <= 0) g.particles.splice(i, 1);
      }

      /* Asteroids — mutate in place (verts/pts/radius never change) */
      for (let i = 0; i < g.asteroids.length; i++) {
        const a = g.asteroids[i];
        a.x = wrap(a.x + a.vx, W);
        a.y = wrap(a.y + a.vy, H);
        a.rot += a.rotSpeed;
      }

      /* Bullet–asteroid collisions */
      const deadA = new Set<number>(), deadB = new Set<number>();
      const born: Asteroid[] = [];
      for (const a of g.asteroids) {
        for (let bi = 0; bi < g.bullets.length; bi++) {
          if (deadA.has(a.id) || deadB.has(bi)) continue;
          const b = g.bullets[bi];
          if (d2(b.x, b.y, a.x, a.y) < a.radius ** 2) {
            deadA.add(a.id); deadB.add(bi);
            g.score += SCORE_MAP[a.size];
            g.asteroidsDestroyed++;
            // Debris burst — more particles, bigger, faster, longer-lived
            const numDebris = a.size === 'large' ? 22 : a.size === 'medium' ? 14 : 8;
            const maxSpd = a.size === 'large' ? 5.5 : a.size === 'medium' ? 4.0 : 3.0;
            for (let di = 0; di < numDebris; di++) {
              const dDir = rand(0, Math.PI * 2);
              const dSpd = rand(0.8, maxSpd);
              const dLife = Math.round(rand(24, 42));
              g.particles.push({
                id: uid(), x: a.x, y: a.y,
                vx: Math.cos(dDir) * dSpd, vy: Math.sin(dDir) * dSpd,
                life: dLife, maxLife: dLife,
                size: rand(2.5, a.size === 'large' ? 7 : 5), kind: 'debris',
              });
            }
            if (Platform.OS === 'web' && !isDemo) playExplosion(a.size);
            if (a.size === 'large') {
              born.push(mkAsteroid(W, H, 'medium', undefined, undefined, a.x, a.y));
              born.push(mkAsteroid(W, H, 'medium', undefined, undefined, a.x, a.y));
            } else if (a.size === 'medium') {
              born.push(mkAsteroid(W, H, 'small', undefined, undefined, a.x, a.y));
              born.push(mkAsteroid(W, H, 'small', undefined, undefined, a.x, a.y));
            }
          }
        }
      }
      g.asteroids = [...g.asteroids.filter((a) => !deadA.has(a.id)), ...born];
      g.bullets = g.bullets.filter((_, i) => !deadB.has(i));

      /* Enemy saucers — drift around, turn to face player, fire forward */
      const ENEMY_ROT_SPD = 2.5; // degrees per tick — slower than the player
      for (const e of g.enemies) {
        // Drift movement
        e.driftCD--;
        if (e.driftCD <= 0) {
          const baseSpd = 1.2 + Math.min(1.4, (g.level - ENEMY_FIRST_LEVEL) * 0.12);
          const dir = rand(0, Math.PI * 2);
          e.vx = Math.cos(dir) * baseSpd;
          e.vy = Math.sin(dir) * baseSpd * 0.55;
          e.driftCD = 60 + Math.floor(rand(0, 80));
        }
        e.x = wrap(e.x + e.vx, W);
        e.y += e.vy;
        if (e.y < ENEMY_RADIUS) { e.y = ENEMY_RADIUS; e.vy = Math.abs(e.vy); }
        if (e.y > H - ENEMY_RADIUS) { e.y = H - ENEMY_RADIUS; e.vy = -Math.abs(e.vy); }

        // Rotate to face the player (sprite-style angle: 0 = up)
        const targetAngle = Math.atan2(g.sy - e.y, g.sx - e.x) * (180 / Math.PI) + 90;
        let diff = ((targetAngle - e.angle + 540) % 360) - 180;
        const turn = Math.min(ENEMY_ROT_SPD, Math.abs(diff));
        e.angle += Math.sign(diff) * turn;

        if (e.shieldFlash > 0) e.shieldFlash--;

        // Fire forward only when roughly aligned (skip during demo just in case)
        e.fireCD--;
        if (e.fireCD <= 0 && !isDemo && Math.abs(diff) < 12) {
          const spread = enemyAimSpreadForLevel(g.level);
          const r = toR(e.angle - 90) + rand(-spread, spread);
          const evx = Math.cos(r) * ENEMY_BULLET_SPEED;
          const evy = Math.sin(r) * ENEMY_BULLET_SPEED;
          g.enemyBullets.push({
            x: e.x + Math.cos(r) * (ENEMY_RADIUS + 4),
            y: e.y + Math.sin(r) * (ENEMY_RADIUS + 4),
            vx: evx, vy: evy,
            life: ENEMY_BULLET_LIFETIME,
            angle: (Math.atan2(evy, evx) * 180) / Math.PI,
          });
          e.fireCD = enemyFireCDForLevel(g.level) + Math.floor(rand(0, 40));
          if (Platform.OS === 'web') playEnemyShoot();
        }
      }

      /* Enemy ↔ asteroid collisions — saucers are immune; the asteroid
       * shatters (or vanishes if it's already small) and the enemy briefly
       * shows a deflection shield. */
      const astroDeadFromEnemy = new Set<number>();
      const astroBorn: Asteroid[] = [];
      for (const e of g.enemies) {
        for (const a of g.asteroids) {
          if (astroDeadFromEnemy.has(a.id)) continue;
          if (d2(e.x, e.y, a.x, a.y) < (ENEMY_RADIUS + a.radius * 0.85) ** 2) {
            astroDeadFromEnemy.add(a.id);
            e.shieldFlash = 12;
            // Spawn replacements like a player kill — minus the score / sfx.
            if (a.size === 'large') {
              astroBorn.push(mkAsteroid(W, H, 'medium', undefined, undefined, a.x, a.y));
              astroBorn.push(mkAsteroid(W, H, 'medium', undefined, undefined, a.x, a.y));
            } else if (a.size === 'medium') {
              astroBorn.push(mkAsteroid(W, H, 'small', undefined, undefined, a.x, a.y));
              astroBorn.push(mkAsteroid(W, H, 'small', undefined, undefined, a.x, a.y));
            }
            // Small dust puff so the deflection is visible
            for (let k = 0; k < 10; k++) {
              const dDir = rand(0, Math.PI * 2);
              const dSpd = rand(0.6, 2.2);
              g.particles.push({
                id: uid(), x: a.x, y: a.y,
                vx: Math.cos(dDir) * dSpd, vy: Math.sin(dDir) * dSpd,
                life: 18, maxLife: 18, size: rand(2, 4), kind: 'debris',
              });
            }
          }
        }
      }
      if (astroDeadFromEnemy.size > 0) {
        g.asteroids = [
          ...g.asteroids.filter((a) => !astroDeadFromEnemy.has(a.id)),
          ...astroBorn,
        ];
      }

      /* Enemy bullets — advance and cull in place */
      for (let i = g.enemyBullets.length - 1; i >= 0; i--) {
        const b = g.enemyBullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
          g.enemyBullets.splice(i, 1);
        }
      }

      /* Player bullets → enemies (3 hp each) */
      const enemyDead = new Set<number>();
      const pbConsumed = new Set<number>();
      for (const e of g.enemies) {
        for (let bi = 0; bi < g.bullets.length; bi++) {
          if (enemyDead.has(e.id) || pbConsumed.has(bi)) continue;
          const b = g.bullets[bi];
          if (d2(b.x, b.y, e.x, e.y) < (ENEMY_RADIUS + 4) ** 2) {
            pbConsumed.add(bi);
            e.hp--;
            for (let k = 0; k < 6; k++) {
              const dDir = rand(0, Math.PI * 2);
              const dSpd = rand(0.8, 2.5);
              g.particles.push({
                id: uid(), x: e.x, y: e.y,
                vx: Math.cos(dDir) * dSpd, vy: Math.sin(dDir) * dSpd,
                life: 18, maxLife: 18, size: rand(1.5, 3), kind: 'debris',
              });
            }
            if (e.hp <= 0) {
              enemyDead.add(e.id);
              g.score += ENEMY_SCORE;
              useEnemyCodexStore.getState().markKilled(e.designId);
              for (let k = 0; k < 22; k++) {
                const dDir = rand(0, Math.PI * 2);
                const dSpd = rand(1, 4.5);
                const dLife = Math.round(rand(26, 44));
                g.particles.push({
                  id: uid(), x: e.x, y: e.y,
                  vx: Math.cos(dDir) * dSpd, vy: Math.sin(dDir) * dSpd,
                  life: dLife, maxLife: dLife, size: rand(2.5, 6), kind: 'debris',
                });
              }
              if (Platform.OS === 'web' && !isDemo) playExplosion('medium');
            }
          }
        }
      }
      g.enemies = g.enemies.filter((e) => !enemyDead.has(e.id));
      g.bullets = g.bullets.filter((_, i) => !pbConsumed.has(i));

      /* Local death handler — used by both asteroid and enemy-bullet collisions */
      const killPlayer = () => {
        if (isDemo) {
          g.sx = W / 2; g.sy = H / 2;
          g.svx = 0; g.svy = 0;
          g.sInv = 60;
          return;
        }
        g.lives--;
        if (g.lives <= 0) {
          if (Platform.OS === 'web' && thrustSoundRef.current) {
            thrustSoundRef.current.stop();
            thrustSoundRef.current = null;
          }
          if (Platform.OS === 'web') playShipDestroyed();
          g.phase = 'gameover';
          setNewHS(g.score > useGameUIStore.getState().highScore);
          updateHighScore(g.score);
          useGameUIStore.getState().addRun({
            id: String(Date.now()),
            score: g.score,
            bulletsShot: g.bulletsShot,
            asteroidsDestroyed: g.asteroidsDestroyed,
            durationMs: Date.now() - g.startTime,
            date: Date.now(),
          });
        } else {
          if (Platform.OS === 'web') playShipHit();
          g.sx = W / 2; g.sy = H / 2;
          g.svx = 0; g.svy = 0; g.sAngle = 0;
          g.sInv = INVINCIBLE;
        }
      };

      /* Ship–asteroid collision */
      if (g.sInv === 0) {
        for (const a of g.asteroids) {
          if (d2(g.sx, g.sy, a.x, a.y) < (a.radius * 0.8 + 9) ** 2) {
            killPlayer();
            break;
          }
        }
      }

      /* Ship–enemy bullet collision */
      if (g.sInv === 0 && g.phase === 'playing') {
        for (let i = 0; i < g.enemyBullets.length; i++) {
          const b = g.enemyBullets[i];
          if (d2(b.x, b.y, g.sx, g.sy) < 12 ** 2) {
            g.enemyBullets.splice(i, 1);
            killPlayer();
            break;
          }
        }
      }

      /* Level clear — only when asteroids AND enemies are gone. */
      if (!isDemo && g.asteroids.length === 0 && g.enemies.length === 0) {
        g.level++;
        g.asteroids = mkLevel(g.level, W, H, g.sx, g.sy);
        const nEnemies = enemyCountForLevel(g.level);
        for (let i = 0; i < nEnemies; i++) {
          const ne = mkEnemy(W, H, g.level, g.sx, g.sy);
          g.enemies.push(ne);
          useEnemyCodexStore.getState().markEncountered(ne.designId);
        }
      }
      // Demo: keep the field populated but never spawn saucers (clean visual).
      if (isDemo && g.asteroids.length === 0) {
        g.asteroids = mkLevel(1, W, H, g.sx, g.sy);
      }

      // Trim oversized particle pools (Android cap). Drop the oldest first so
      // the visual fade-out is uninterrupted.
      if (g.particles.length > MAX_PARTICLES) {
        g.particles.splice(0, g.particles.length - MAX_PARTICLES);
      }

      // Render at half rate on Android (simulation already ran above).
      if (ANDROID_HALF_RENDER && (frame.current & 1) !== 0) return;
      setTick((t) => t + 1);
    }, TICK_MS);

    return () => clearInterval(id);
  }, []); // single interval, always reads current refs

  /* ── Init or restart game with given dimensions ──
   * If flyInTicks is provided, the ship starts at the bottom of the visible
   * area and travels to center over that many game ticks (used so the fly-in
   * lines up with the 3-2-1-GO countdown). Otherwise it uses the default
   * fast fly-in from below the screen. */
  const initNewGame = (W: number, H: number, flyInTicks?: number) => {
    setNewHS(false);
    // Start thrust sound for intro fly-in
    if (Platform.OS === 'web' && !thrustSoundRef.current) {
      thrustSoundRef.current = playThrustStart();
    }
    const startSy = flyInTicks ? H - SHIP_SIZE * 1.2 : H + SHIP_SIZE * 2;
    const svy = flyInTicks ? -((startSy - H / 2) / flyInTicks) : -5;
    gsRef.current = {
      phase: 'intro',
      sx: W / 2, sy: startSy,
      svx: 0, svy,
      sAngle: 0, sInv: 0,
      bullets: [], particles: [], asteroids: [], enemies: [], enemyBullets: [],
      score: 0, lives: 3, level: 1,
      bulletsShot: 0, asteroidsDestroyed: 0, startTime: Date.now(),
    };
    setTick((t) => t + 1);
  };

  /* ── Start game ── */
  const handleStartGame = (flyInTicks?: number) => {
    const alreadyFullscreen = useGameUIStore.getState().isGamePlaying;
    if (alreadyFullscreen) {
      // Layout unchanged (play again from game-over): use current dims directly
      const { w: W, h: H } = dimRef.current;
      if (W > 0 && H > 0) initNewGame(W, H, flyInTicks);
    } else {
      // Idle → playing: hiding header/nav changes layout, wait for onLayout
      pendingStart.current = true;
      pendingFlyInTicks.current = flyInTicks;
      setIsGamePlaying(true);
    }
  };

  /* ── Give up (ESC / mobile button) ── */
  const handleGiveUp = useCallback(() => {
    const g = gsRef.current;
    if (!g || g.phase !== 'playing') return;
    if (Platform.OS === 'web' && thrustSoundRef.current) {
      thrustSoundRef.current.stop();
      thrustSoundRef.current = null;
    }
    if (Platform.OS === 'web') playShipDestroyed();
    g.phase = 'gameover';
    setNewHS(g.score > useGameUIStore.getState().highScore);
    updateHighScore(g.score);
    useGameUIStore.getState().addRun({
      id: String(Date.now()),
      score: g.score,
      bulletsShot: g.bulletsShot,
      asteroidsDestroyed: g.asteroidsDestroyed,
      durationMs: Date.now() - g.startTime,
      date: Date.now(),
    });
    // Keep chrome hidden through the game-over screen.
    setTick((t) => t + 1);
  }, [updateHighScore, setIsGamePlaying]);

  /* ── Back to menu ── */
  const handleBackToMenu = () => {
    if (Platform.OS === 'web' && thrustSoundRef.current) {
      thrustSoundRef.current.stop();
      thrustSoundRef.current = null;
    }
    setIsGamePlaying(false);
    const { w: W, h: H } = dimRef.current;
    if (gsRef.current) {
      gsRef.current.phase = 'demo';
      const sx = W / 2, sy = H / 2;
      gsRef.current.sx = sx; gsRef.current.sy = sy;
      gsRef.current.svx = 0; gsRef.current.svy = 0;
      gsRef.current.sAngle = 0; gsRef.current.sInv = 0;
      gsRef.current.score = 0; gsRef.current.lives = 3; gsRef.current.level = 1;
      gsRef.current.bullets = [];
      gsRef.current.particles = [];
      gsRef.current.asteroids = W > 0 && H > 0 ? mkLevel(1, W, H, sx, sy) : [];
      gsRef.current.enemies = [];
      gsRef.current.enemyBullets = [];
    }
    ctrl.current = { left: false, right: false, thrust: false, fire: false, fireCD: 0 };
    joyActive.current = false;
    joyOff.current = { x: 0, y: 0 };
    setNewHS(false);
    setTick((t) => t + 1);
  };

  /* ── Countdown ── */
  const runCountdown = useCallback((n: number) => {
    setCountNum(n);
    cdScale.setValue(2.2);
    cdOpacity.setValue(1);
    if (Platform.OS === 'web') {
      if (n > 0) playCountdownBeep(n as 1 | 2 | 3);
      else playCountdownGo();
    }
    Animated.parallel([
      Animated.timing(cdScale,   { toValue: n > 0 ? 0.8 : 1.1, duration: 600, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(n > 0 ? 550 : 400),
        Animated.timing(cdOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      if (!finished) return;
      if (n > 1) {
        setTimeout(() => runCountdown(n - 1), 80);
      } else if (n === 1) {
        setTimeout(() => runCountdown(0), 80); // "GO!"
      } else {
        // Done — clear overlay. The intro fly-in started at countdown begin and
        // should be arriving at center now; if for any reason it hasn't, snap.
        setTimeout(() => {
          setInsertPhase(null);
          const g = gsRef.current;
          if (g && g.phase === 'intro') {
            const { w: W, h: H } = dimRef.current;
            g.sy = H / 2; g.svx = 0; g.svy = 0; g.sInv = 0;
            g.phase = 'playing';
            g.asteroids = mkLevel(1, W, H, g.sx, g.sy);
            g.startTime = Date.now();
            if (Platform.OS === 'web' && thrustSoundRef.current) {
              thrustSoundRef.current.stop(); thrustSoundRef.current = null;
            }
          }
        }, 120);
      }
    });
  }, []);

  /* ── Coin animation then countdown ── */
  const runCoinAnimation = useCallback(() => {
    const targetY = area.h / 2 - 30;
    coinY.setValue(-60);
    coinScale.setValue(0.5);
    coinOpacity.setValue(1);
    setInsertPhase('coinanim');
    if (Platform.OS === 'web') playCoinInsert();

    Animated.parallel([
      Animated.timing(coinY,     { toValue: targetY, duration: 520, useNativeDriver: true }),
      Animated.timing(coinScale, { toValue: 1.3,     duration: 520, useNativeDriver: true }),
    ]).start(() => {
      // Coin "inserts" — quick punch then vanish
      Animated.sequence([
        Animated.timing(coinScale,   { toValue: 0.2, duration: 180, useNativeDriver: true }),
        Animated.timing(coinOpacity, { toValue: 0,   duration: 80,  useNativeDriver: true }),
      ]).start(() => {
        setInsertPhase('countdown');
        // Start the ship fly-in NOW so it arrives at center as "GO" fires.
        // Countdown spans ~2.7s ≈ 170 game ticks (16ms each); use 165 to give
        // a small buffer so the ship lands just before the overlay clears.
        handleStartGame(165);
        runCountdown(3);
      });
    });
  }, [area.h]);

  /* ── Insert coin entry point (replaces direct handleStartGame calls) ── */
  const handleInsertCoin = useCallback(() => {
    if (!isSubscribed && coins <= 0) {
      router.push('/(app)/shop' as any);
      return;
    }
    if (!isSubscribed) spendCoin();
    // Freeze the demo so it doesn't keep playing behind the coin/countdown UI
    if (gsRef.current && gsRef.current.phase === 'demo') {
      gsRef.current.phase = 'idle';
      gsRef.current.asteroids = [];
      gsRef.current.bullets = [];
      gsRef.current.particles = [];
      gsRef.current.enemies = [];
      gsRef.current.enemyBullets = [];
    }
    // Clear any control state left over from the AI (otherwise fire=true
    // from the last AI tick will make the ship auto-shoot on game start).
    ctrl.current = { left: false, right: false, thrust: false, fire: false, fireCD: 0 };
    runCoinAnimation();
  }, [isSubscribed, coins, spendCoin, runCoinAnimation]);

  /* ── Layout handler ── */
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const measuredW = width > 2 ? width : demoBoardPxW;
    const measuredH = height > 2 ? height : demoBoardPxH;
    // Reserve space for the mobile joystick/fire bar only when we're actually
    // about to render them — i.e. during gameplay. In demo / idle the bar is
    // hidden, so the game world should use the full canvas height (otherwise
    // the ship is rendered at the upper half of the preview frame).
    const reserveBottom = isDemoLayout ? 0 : CTRL_H;
    const gameH = Math.max(1, measuredH - reserveBottom);
    dimRef.current = { w: measuredW, h: gameH };
    setArea({ w: measuredW, h: measuredH });

    // Measure root position for web mouse-to-canvas coordinate conversion
    if (Platform.OS === 'web' && rootRef.current) {
      (rootRef.current as any).measureInWindow((x: number, y: number) => {
        canvasOrigin.current = { x, y };
      });
    }

    if (pendingStart.current && measuredW > 0 && measuredH > 0) {
      pendingStart.current = false;
      const ft = pendingFlyInTicks.current;
      pendingFlyInTicks.current = undefined;
      initNewGame(measuredW, gameH, ft);
    } else if (!gsRef.current && measuredW > 0 && measuredH > 0) {
      const sx = measuredW / 2, sy = gameH / 2;
      gsRef.current = {
        phase: 'demo',
        sx, sy, svx: 0, svy: 0, sAngle: 0, sInv: 0,
        bullets: [], particles: [], asteroids: mkLevel(1, measuredW, gameH, sx, sy),
        enemies: [], enemyBullets: [],
        score: 0, lives: 3, level: 1,
        bulletsShot: 0, asteroidsDestroyed: 0, startTime: 0,
      };
      setTick((t) => t + 1);
    }
  };

  /* ── Joystick PanResponder (mobile only) ── */
  const joystickPR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        joyActive.current = true;
        const rawDx = evt.nativeEvent.locationX - joyCtr.current.x;
        const rawDy = evt.nativeEvent.locationY - joyCtr.current.y;
        const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
        const clamped = Math.min(dist, JOY_MAX);
        const angle = Math.atan2(rawDy, rawDx);
        joyOff.current = { x: Math.cos(angle) * clamped, y: Math.sin(angle) * clamped };
        if (dist > JOY_DEAD && gsRef.current) {
          gsRef.current.sAngle = angle * (180 / Math.PI) + 90;
        }
      },
      onPanResponderMove: (evt) => {
        const rawDx = evt.nativeEvent.locationX - joyCtr.current.x;
        const rawDy = evt.nativeEvent.locationY - joyCtr.current.y;
        const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
        const clamped = Math.min(dist, JOY_MAX);
        const angle = Math.atan2(rawDy, rawDx);
        joyOff.current = { x: Math.cos(angle) * clamped, y: Math.sin(angle) * clamped };
        if (dist > JOY_DEAD && gsRef.current) {
          gsRef.current.sAngle = angle * (180 / Math.PI) + 90;
        }
      },
      onPanResponderRelease: () => {
        joyOff.current = { x: 0, y: 0 };
        joyActive.current = false;
      },
      onPanResponderTerminate: () => {
        joyOff.current = { x: 0, y: 0 };
        joyActive.current = false;
      },
    }),
  ).current;

  /* ── Render helpers ── */
  const g = gsRef.current;
  const isPlaying = g?.phase === 'playing';
  const shipVisible = !g || g.sInv === 0 || frame.current % 6 < 3;
  // Title-screen "boxed preview" treatment — same idea as the Tetris demo:
  // the simulation runs inside a bordered area in the middle of the screen
  // so the TITLE sits cleanly above and INSERT COIN sits cleanly below.
  const isDemoLayout = (!g || g.phase === 'idle' || g.phase === 'demo') && insertPhase === null;

  // Demo-box dimensions — shared with Tetris / Snake / Pong via previewFrame.ts
  // so every arcade title shows the same-sized preview on the menu.
  const preview = fitPreview(gameAreaSize.w, gameAreaSize.h);
  const demoBoardPxW = preview.w;
  const demoBoardPxH = preview.h;

  // Fallback demo bootstrapping for platforms/layout timing where the canvas
  // onLayout may not initialize gsRef immediately.
  useEffect(() => {
    if (!isDemoLayout) return;
    if (gsRef.current) return;
    if (demoBoardPxW <= 0 || demoBoardPxH <= 0) return;

    const sx = demoBoardPxW / 2;
    const sy = demoBoardPxH / 2;
    dimRef.current = { w: demoBoardPxW, h: demoBoardPxH };
    gsRef.current = {
      phase: 'demo',
      sx,
      sy,
      svx: 0,
      svy: 0,
      sAngle: 0,
      sInv: 0,
      bullets: [],
      particles: [],
      asteroids: mkLevel(1, demoBoardPxW, demoBoardPxH, sx, sy),
      enemies: [],
      enemyBullets: [],
      score: 0,
      lives: 3,
      level: 1,
      bulletsShot: 0,
      asteroidsDestroyed: 0,
      startTime: 0,
    };
    setTick((t) => t + 1);
  }, [isDemoLayout, demoBoardPxW, demoBoardPxH]);

  return (
    <View ref={rootRef} style={s.root}>
      {/* ── Measurement + centering wrapper (mirrors TetrisGame's gameArea) ── */}
      <View
        style={[
          s.gameArea,
          // Explicit values in both branches so Yoga clears them on transition
          // (otherwise the demo padding sticks after demo→play on Android).
          {
            paddingTop: isDemoLayout ? 160 : 0,
            paddingBottom: isDemoLayout ? 150 : 0,
            justifyContent: isDemoLayout ? 'center' : 'flex-start',
            alignItems: isDemoLayout ? 'center' : 'stretch',
          },
        ]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setGameAreaSize({ w: width, h: height });
        }}
      >
      {/* ── Game canvas — full-screen during play, boxed during demo ──
            We MUST set width/height/flex explicitly (rather than conditionally
            spreading them) so Yoga clears them when switching modes. Otherwise
            on Android new-arch the demo box dimensions stick after demo→play
            transition and the canvas stays small at the top of the screen. */}
      <View
        style={[
          s.canvas,
          isDemoLayout && s.canvasDemo,
          {
            width: isDemoLayout ? demoBoardPxW : undefined,
            height: isDemoLayout ? demoBoardPxH : undefined,
            minWidth: isDemoLayout ? demoBoardPxW : undefined,
            minHeight: isDemoLayout ? demoBoardPxH : undefined,
            maxWidth: isDemoLayout ? demoBoardPxW : undefined,
            maxHeight: isDemoLayout ? demoBoardPxH : undefined,
            flex: isDemoLayout ? 0 : 1,
            flexShrink: isDemoLayout ? 0 : 1,
            alignSelf: isDemoLayout ? 'center' : 'stretch',
          },
        ]}
        onLayout={onLayout}
      >

        {/* Game objects. Hidden entirely during game-over so the overlay is
            the only thing on screen. */}
        <View style={[
          StyleSheet.absoluteFillObject,
        ]}>
        {g?.phase !== 'gameover' && <>

        {/* Asteroids — jagged polygons via react-native-svg (works on web too) */}
        {g?.asteroids.map((a) => {
          const d = a.radius * 2;
          return (
            <View
              key={a.id}
              style={{
                position: 'absolute',
                left: a.x - a.radius,
                top: a.y - a.radius,
                width: d,
                height: d,
                transform: [{ rotate: `${a.rot}deg` }],
              }}
              pointerEvents="none"
            >
              <AsteroidShape d={d} pts={a.pts} />
            </View>
          );
        })}

        {/* Bullets — during active play or demo (green laser bolts) */}
        {(g?.phase === 'playing' || g?.phase === 'demo') && g.bullets.map((b, i) => (
          <View
            key={i}
            style={[
              s.bullet,
              { left: b.x - BULLET_LEN / 2, top: b.y - BULLET_W / 2, transform: [{ rotate: `${b.angle}deg` }] },
            ]}
          />
        ))}

        {/* Enemy saucers — sprite (rotated to face player) + HP bar + shield flash */}
        {g?.phase === 'playing' && g.enemies.map((e) => {
          const barW = ENEMY_SPRITE * 0.8;
          const segW = (barW - (ENEMY_MAX_HP - 1) * 2) / ENEMY_MAX_HP;
          const src = ENEMY_IMAGES[e.designId];
          const shieldR = ENEMY_RADIUS + 6;
          return (
            <View
              key={e.id}
              style={{
                position: 'absolute',
                left: e.x - ENEMY_SPRITE / 2,
                top: e.y - ENEMY_SPRITE / 2,
                width: ENEMY_SPRITE,
                height: ENEMY_SPRITE,
              }}
              pointerEvents="none"
            >
              {/* Deflection shield ring — pops briefly when an asteroid bounces */}
              {e.shieldFlash > 0 && (
                <View style={{
                  position: 'absolute',
                  left: ENEMY_SPRITE / 2 - shieldR,
                  top: ENEMY_SPRITE / 2 - shieldR,
                  width: shieldR * 2, height: shieldR * 2, borderRadius: shieldR,
                  borderWidth: 2, borderColor: '#FF6A1F',
                  backgroundColor: 'rgba(255,106,31,0.22)',
                  opacity: e.shieldFlash / 12,
                }} />
              )}
              {src && (
                <View style={{
                  width: ENEMY_SPRITE, height: ENEMY_SPRITE,
                  transform: [{ rotate: `${e.angle}deg` }],
                }}>
                  <Image
                    source={src}
                    style={{ width: ENEMY_SPRITE, height: ENEMY_SPRITE }}
                    resizeMode="contain"
                  />
                </View>
              )}
              {/* Health bar (stays upright, not rotated) */}
              <View style={{
                position: 'absolute',
                left: (ENEMY_SPRITE - barW) / 2, top: -10,
                flexDirection: 'row', gap: 2,
              }}>
                {Array.from({ length: ENEMY_MAX_HP }).map((_, i) => (
                  <View key={i} style={{
                    width: segW, height: 4,
                    backgroundColor: i < e.hp ? '#FF3030' : '#3A0000',
                    borderWidth: 1, borderColor: '#000',
                  }} />
                ))}
              </View>
            </View>
          );
        })}

        {/* Enemy bullets — red laser bolts */}
        {g?.phase === 'playing' && g.enemyBullets.map((b, i) => (
          <View
            key={`eb${i}`}
            style={[
              s.enemyBullet,
              { left: b.x - BULLET_LEN / 2, top: b.y - BULLET_W / 2, transform: [{ rotate: `${b.angle}deg` }] },
            ]}
          />
        ))}

        {/* Particles (thruster = white→blue, debris = bright white→gray→fade) */}
        {(g?.phase === 'playing' || g?.phase === 'intro' || g?.phase === 'demo') && g.particles.map((p) => {
          const t = p.life / p.maxLife;
          let rgb: string;
          let opacity: number;
          if (p.kind === 'debris') {
            // Start bright white, cool to mid-gray, fade out
            const c = Math.round(200 + 55 * Math.min(1, t * 2));
            rgb = `rgb(${c},${c},${c})`;
            opacity = Math.min(1, t * 1.5);  // fully opaque for most of life, quick fade at end
          } else {
            // Thruster: white (t=1) → light blue (t=0.5) → blue (t=0)
            const rv = Math.round(Math.min(255, 255 * t * 1.6));
            const gv = Math.round(Math.min(255, 220 * t * 1.6));
            rgb = `rgb(${rv},${gv},255)`;
            opacity = t * 0.9;
          }
          return (
            <View
              key={p.id}
              style={{
                position: 'absolute',
                width: p.size, height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: rgb,
                opacity,
                left: p.x - p.size / 2,
                top: p.y - p.size / 2,
              }}
            />
          );
        })}

        {/* Ship — rendered on top of particles */}
        {g && (g.phase === 'playing' || g.phase === 'intro' || g.phase === 'demo') && (g.phase === 'intro' || shipVisible) && (
          <View style={{
            position: 'absolute',
            left: g.sx - SHIP_SIZE / 2,
            top: g.sy - SHIP_SIZE / 2,
            transform: [{ rotate: `${g.sAngle}deg` }],
          }}>
            <ShipPreview ship={selectedShip} size={SHIP_SIZE} />
          </View>
        )}
        </>}{/* end gameover-skip wrapper */}

        </View>{/* end game objects scale wrapper */}

        {/* ── HUD (score + high score + lives) — hidden during gameover */}
        {g && g.phase !== 'demo' && g.phase !== 'gameover' && (
          <>
            <View style={s.hud}>
              <Text style={[s.hudScore, { fontFamily: MONO }]}>
                {String(g.score).padStart(5, '0')}
              </Text>
            </View>
            {isPlaying && (
              <View style={s.livesRow}>
                {Array.from({ length: Math.max(0, g.lives) }).map((_, i) => (
                  <Text key={i} style={s.lifeIcon}>♥</Text>
                ))}
              </View>
            )}
            {isPlaying && (
              <Text style={[s.levelBadge, { fontFamily: MONO }]}>LV {g.level}</Text>
            )}
          </>
        )}

        {/* Web: controls info trigger */}
        {Platform.OS === 'web' && isPlaying && (
          <View style={s.controlsFloating}>
            <GameControlsInfo
              gameTitle="ASTEROIDS"
              mobileControls={[
                { keyText: 'JOYSTICK', actionText: 'Steer the ship.' },
                { keyText: 'MOVE (HOLD)', actionText: 'Apply thrust while held.' },
                { keyText: 'FIRE (HOLD)', actionText: 'Continuously fire while held.' },
              ]}
              webControls={[
                { keyText: 'MOUSE', actionText: 'Aim the ship direction.' },
                { keyText: 'LEFT MOUSE (HOLD)', actionText: 'Apply thrust while held.' },
                { keyText: 'SPACE', actionText: 'Fire weapons.' },
                { keyText: 'ARROWS OR WASD', actionText: 'Steer with keyboard input.' },
              ]}
            />
          </View>
        )}

        {/* ── Coin insert animation overlay ── */}
        {insertPhase === 'coinanim' && (
          <View style={[s.insertOverlay, { width: area.w, height: area.h }]} pointerEvents="none">
            <Animated.View
              style={[
                s.fallingCoin,
                {
                  left: area.w / 2 - 28,
                  transform: [{ translateY: coinY }, { scale: coinScale }],
                  opacity: coinOpacity,
                },
              ]}
            >
              <ArcadeCoin size={56} />
            </Animated.View>
          </View>
        )}

        {/* ── Countdown overlay ── */}
        {insertPhase === 'countdown' && (
          <View style={[s.countdownOverlay, { width: area.w, height: area.h }]}>
            <Animated.Text
              style={[
                s.countdownText,
                { fontFamily: MONO },
                { transform: [{ scale: cdScale }], opacity: cdOpacity },
              ]}
            >
              {countNum === 0 ? 'START' : String(countNum)}
            </Animated.Text>
          </View>
        )}

        {/* ── Game over screen ── */}
        {g?.phase === 'gameover' && insertPhase === null && (
          <View style={[s.gameOverOverlay, { width: area.w, height: area.h }]}>
            <Text style={[s.titleText, { fontFamily: MONO }]}>GAME OVER</Text>
            <Text style={[s.finalScore, { fontFamily: MONO }]}>{g.score}</Text>
            {newHS && (
              <Text style={[s.newHsText, { fontFamily: MONO }]}>NEW HIGH SCORE!</Text>
            )}
            <View style={s.btnRow}>
              <Pressable onPress={handleInsertCoin} style={s.goBtn}>
                <Text style={[s.goBtnTxt, { fontFamily: MONO }]}>
                  {coins > 0 ? 'PLAY AGAIN' : 'GET COINS'}
                </Text>
              </Pressable>
              <Pressable onPress={handleBackToMenu} style={[s.goBtn, s.goBtnSecondary]}>
                <Text style={[s.goBtnTxt, s.goBtnSecondaryTxt, { fontFamily: MONO }]}>
                  MENU
                </Text>
              </Pressable>
            </View>
            {coins === 0 && (
              <Text style={[s.noCoinsHint, { fontFamily: MONO }]}>
                NO COINS — VISIT SHOP TO GET MORE
              </Text>
            )}
          </View>
        )}

        {/* Give up button (mobile) */}
        {Platform.OS !== 'web' && isPlaying && (
          <Pressable
            onPress={handleGiveUp}
            style={{
              position: 'absolute', top: 12, right: 12,
              backgroundColor: '#CC0000',
              paddingHorizontal: 12, paddingVertical: 6,
              borderRadius: 4, zIndex: 20,
            }}
          >
            <Text style={{ color: '#fff', fontFamily: MONO, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>GIVE UP</Text>
          </Pressable>
        )}

        {/* ── Mobile controls (joystick + fire) ── */}
        {Platform.OS !== 'web' && isPlaying && (
          <View style={s.ctrlOverlay}>
            {/* Fixed joystick */}
            <View
              style={s.joyArea}
              {...joystickPR.panHandlers}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                joyCtr.current = { x: width / 2, y: height / 2 };
              }}
            >
              {/* Base ring — always visible */}
              <View style={[s.joyBase, {
                left: joyCtr.current.x - JOY_MAX,
                top: joyCtr.current.y - JOY_MAX,
              }]} />
              {/* Thumb */}
              <View style={[s.joyThumb, {
                left: joyCtr.current.x + joyOff.current.x - JOY_THUMB_R,
                top: joyCtr.current.y + joyOff.current.y - JOY_THUMB_R,
              }]} />
            </View>

            {/* MOVE + FIRE buttons stacked on the right */}
            <View style={s.rightBtns}>
              {/* Move / thrust button */}
              <Pressable
                style={({ pressed }: { pressed: boolean }) => [
                  s.moveBtn,
                  pressed && s.moveBtnActive,
                ]}
                onPressIn={() => { ctrl.current.thrust = true; }}
                onPressOut={() => { ctrl.current.thrust = false; }}
              >
                <Text style={[s.fireBtnTxt, { fontFamily: MONO }]}>MOVE</Text>
              </Pressable>

              {/* Fire button */}
              <Pressable
                style={({ pressed }: { pressed: boolean }) => [
                  s.fireBtn,
                  pressed && s.fireBtnActive,
                ]}
                onPressIn={() => { ctrl.current.fire = true; }}
                onPressOut={() => { ctrl.current.fire = false; }}
              >
                <Text style={[s.fireBtnTxt, { fontFamily: MONO }]}>FIRE</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
      </View>{/* end gameArea */}

      {/* ── Idle / title screen — sibling of the canvas so the title can sit
            above the boxed preview and INSERT COIN can sit below it. ── */}
      {isDemoLayout && (
        <>
          <View style={s.overlayTop} pointerEvents="box-none">
            <Text style={[s.titleText, { fontFamily: MONO }]}>ASTEROIDS</Text>
            <Text style={[s.hiLabel, { fontFamily: MONO }]}>
              HIGH SCORE   {highScore}
            </Text>
          </View>
          <View style={s.overlayBottom} pointerEvents="box-none">
            <Pressable onPress={handleInsertCoin} style={[s.menuBtn, coins === 0 && s.menuBtnNoCoins]}>
              <Text style={[s.menuBtnTxt, { fontFamily: MONO }]}>
                {coins > 0 ? 'INSERT COIN' : 'GET COINS'}
              </Text>
            </Pressable>
            <View style={s.controlsInline}>
              <GameControlsInfo
                gameTitle="ASTEROIDS"
                mobileControls={[
                  { keyText: 'JOYSTICK', actionText: 'Steer the ship.' },
                  { keyText: 'MOVE (HOLD)', actionText: 'Apply thrust while held.' },
                  { keyText: 'FIRE (HOLD)', actionText: 'Continuously fire while held.' },
                ]}
                webControls={[
                  { keyText: 'MOUSE', actionText: 'Aim the ship direction.' },
                  { keyText: 'LEFT MOUSE (HOLD)', actionText: 'Apply thrust while held.' },
                  { keyText: 'SPACE', actionText: 'Fire weapons.' },
                  { keyText: 'ARROWS OR WASD', actionText: 'Steer with keyboard input.' },
                ]}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  gameArea: { flex: 1 },
  canvas: { flex: 1, overflow: 'hidden' },
  canvasDemo: {
    backgroundColor: '#050505',
    borderWidth: 2,
    borderColor: '#222',
    overflow: 'hidden',
  },

  // Note: on Android, per-frame shadowRadius re-rasterizes the bullet sprite
  // every tick — extremely expensive with many bullets in flight. iOS and web
  // handle this fine, so we keep the glow there.
  bullet: {
    position: 'absolute',
    width: BULLET_LEN, height: BULLET_W, borderRadius: BULLET_W / 2,
    backgroundColor: '#7FE3FF',
    ...(Platform.OS === 'android' ? {} : {
      shadowColor: '#7FE3FF', shadowOpacity: 1, shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
    }),
  },
  enemyBullet: {
    position: 'absolute',
    width: BULLET_LEN, height: BULLET_W, borderRadius: BULLET_W / 2,
    backgroundColor: '#FF3030',
    ...(Platform.OS === 'android' ? {} : {
      shadowColor: '#FF0000', shadowOpacity: 1, shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
    }),
  },

  hud: {
    position: 'absolute', top: 14, left: 14, right: 14,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  hudScore: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  hudHi: { color: '#888', fontSize: 13 },
  livesRow: {
    position: 'absolute', top: 44, left: 14,
    flexDirection: 'row', gap: 5,
  },
  lifeIcon: {
    color: '#FF2A3C', fontSize: 18,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 3,
  },
  levelBadge: {
    position: 'absolute',
    bottom: CTRL_H + 10,
    right: 14,
    color: '#777', fontSize: 12,
  },

  controlsFloating: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    alignItems: 'center',
  },
  controlsInline: {
    marginTop: 2,
  },

  // Title/idle overlay — transparent so the autoplay demo shows through.
  // Title pinned to the top, button + hints pinned to the bottom.
  overlayTop: {
    position: 'absolute', top: 40, left: 0, right: 0,
    alignItems: 'center', gap: 10,
  },
  overlayBottom: {
    position: 'absolute', bottom: 50, left: 0, right: 0,
    alignItems: 'center', gap: 10,
  },
  // Game-over overlay — solid black so nothing bleeds through.
  // zIndex keeps it above the game canvas + give-up button + controls on
  // Android new-arch, where sibling stacking can otherwise misbehave.
  gameOverOverlay: {
    position: 'absolute', top: 0, left: 0,
    backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center', gap: 18,
    zIndex: 50,
  },

  titleText: {
    color: '#FFF', fontSize: 34, fontWeight: '800', letterSpacing: 8,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  yearText: { color: '#888', fontSize: 14, letterSpacing: 2 },
  hiLabel: {
    color: '#FFD700', fontSize: 14, letterSpacing: 1,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6,
  },
  finalScore: { color: '#FFF', fontSize: 52, fontWeight: '700', letterSpacing: 6 },
  newHsText: { color: '#FFD700', fontSize: 15, fontWeight: '700', letterSpacing: 3 },

  btnRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  // Title screen button
  menuBtn: {
    borderWidth: 1.5, borderColor: '#B8860B',
    backgroundColor: '#FFD700',
    paddingHorizontal: 24, paddingVertical: 12,
  },
  menuBtnNoCoins: { backgroundColor: '#555', borderColor: '#333' },
  menuBtnTxt: { color: '#000', fontSize: 13, letterSpacing: 4, fontWeight: '800' },
  // Coin hint below INSERT COIN button
  coinHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  coinHintBadge: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#FFD700', borderWidth: 1, borderColor: '#B8860B',
    alignItems: 'center', justifyContent: 'center',
  },
  coinHintBadgeLetter: { color: '#6B4500', fontSize: 6, fontWeight: '900' },
  coinHint: { color: '#888', fontSize: 8, letterSpacing: 1 },
  // Game-over buttons — larger, clearly separated
  goBtn: {
    borderWidth: 2, borderColor: '#FFF',
    paddingHorizontal: 28, paddingVertical: 14,
    minWidth: 130, alignItems: 'center',
  },
  goBtnTxt: { color: '#FFF', fontSize: 14, letterSpacing: 4 },
  goBtnSecondary: { borderColor: '#666' },
  goBtnSecondaryTxt: { color: '#999' },
  noCoinsHint: { color: '#555', fontSize: 9, letterSpacing: 1, marginTop: 4 },

  // Coin insert animation
  insertOverlay: {
    position: 'absolute', top: 0, left: 0,
    zIndex: 30,
  },
  fallingCoin: {
    position: 'absolute',
    top: 0,
    width: 56, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  fallingCoinInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FFD700',
    borderWidth: 3, borderColor: '#B8860B',
    alignItems: 'center', justifyContent: 'center',
    position: 'absolute',
  },
  fallingCoinLetter: { color: '#6B4500', fontSize: 24, fontWeight: '900' },
  fallingCoinRing: {
    position: 'absolute',
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 2, borderColor: '#FFD70060',
  },

  // Countdown overlay
  countdownOverlay: {
    position: 'absolute', top: 0, left: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    pointerEvents: 'none',
    zIndex: 40,
  },
  countdownText: {
    color: '#FFF', fontSize: 96, fontWeight: '900', letterSpacing: 8,
    textShadowColor: '#FFD700',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },

  /* Controls overlay */
  ctrlOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: CTRL_H,
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 24,
  },

  /* Joystick */
  joyArea: { flex: 1, height: CTRL_H },
  joyBase: {
    position: 'absolute',
    width: JOY_MAX * 2, height: JOY_MAX * 2, borderRadius: JOY_MAX,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  joyThumb: {
    position: 'absolute',
    width: JOY_THUMB_R * 2, height: JOY_THUMB_R * 2, borderRadius: JOY_THUMB_R,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
  },

  /* Fire button */
  rightBtns: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginRight: 30,
  },
  moveBtn: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  moveBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.8)',
  },
  fireBtn: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: '#8B0000',
    backgroundColor: 'rgba(139,0,0,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  fireBtnActive: {
    backgroundColor: 'rgba(220,0,0,0.5)',
    borderColor: '#FF3333',
  },
  fireBtnTxt: { color: '#FFF', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
});
