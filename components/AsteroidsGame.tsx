import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutChangeEvent,
  Platform,
  PanResponder,
} from 'react-native';
import { useGameUIStore } from '../store/gameStore';
import { useShipStore } from '../store/shipStore';
import { SHIPS } from '../constants/ships';
import ShipPreview from './ShipPreview';
import { playShoot, playThrustStart, playExplosion } from '../utils/sounds';

/* ─── Constants ─────────────────────────────────────────────────────── */
const TICK_MS = 16;
const SHIP_SIZE = 44;
const BULLET_SPEED = 8;
const BULLET_LIFETIME = 62;
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

type Size = 'large' | 'medium' | 'small';
type Phase = 'idle' | 'playing' | 'gameover';

interface Asteroid {
  id: number;
  x: number; y: number; vx: number; vy: number;
  radius: number; size: Size;
  rot: number; rotSpeed: number;
  aw: number; ah: number;  // render half-dimensions; radius is still used for collision
  br: [number, number, number, number];
}
interface Bullet { x: number; y: number; vx: number; vy: number; life: number; }
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
  particles: Particle[];
  score: number; lives: number; level: number;
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
  // Pick a random shape archetype for variety
  let br: [number, number, number, number];
  const roll = Math.random();
  if (roll < 0.25) {
    // Jagged — alternating sharp and round corners
    br = [r * rand(0.05, 0.35), r * rand(0.8, 2.0), r * rand(0.05, 0.3), r * rand(0.9, 2.0)];
  } else if (roll < 0.45) {
    // One sharp corner, rest rounded
    const b = r * rand(0.7, 1.4);
    br = [r * rand(0.05, 0.22), b, b * rand(0.7, 1.2), b * rand(0.6, 1.0)];
  } else if (roll < 0.7) {
    // Fully irregular — all four corners different
    br = [r * rand(0.1, 1.9), r * rand(0.1, 0.7), r * rand(0.8, 2.0), r * rand(0.1, 0.8)];
  } else {
    // Classic lumpy blob — all corners similar
    br = [r * rand(0.5, 1.5), r * rand(0.5, 1.5), r * rand(0.5, 1.5), r * rand(0.5, 1.5)];
  }
  const aw = r * rand(0.8, 1.35);
  const ah = r * rand(0.8, 1.35);
  return {
    id: uid(), x, y,
    vx: Math.cos(dir) * spd, vy: Math.sin(dir) * spd,
    radius: r, size, rot: rand(0, 360), rotSpeed: rand(-1.5, 1.5),
    aw, ah, br,
  };
}

function mkLevel(lvl: number, W: number, H: number, sx: number, sy: number): Asteroid[] {
  return Array.from({ length: Math.min(3 + lvl, 14) }, () =>
    mkAsteroid(W, H, 'large', sx, sy));
}

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

/* ─── Component ──────────────────────────────────────────────────────── */
export default function AsteroidsGame() {
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [, setTick] = useState(0);
  const [newHS, setNewHS] = useState(false);

  const highScore = useGameUIStore((s) => s.highScore);
  const updateHighScore = useGameUIStore((s) => s.updateHighScore);
  const loadHighScore = useGameUIStore((s) => s.loadHighScore);
  const selectedShipId = useShipStore((s) => s.selectedShipId);
  const loadSelectedShip = useShipStore((s) => s.loadSelectedShip);
  const selectedShip = SHIPS.find((s) => s.id === selectedShipId) ?? SHIPS[0];

  const gsRef = useRef<GS | null>(null);
  const thrustSoundRef = useRef<{ stop: () => void } | null>(null);
  // Game object bounds (game area height = canvas height - ctrl overlay height)
  const dimRef = useRef({ w: 0, h: 0 });
  const ctrl = useRef({ left: false, right: false, thrust: false, fire: false, fireCD: 0 });
  const frame = useRef(0);
  const pendingStart = useRef(false);
  // Web mouse aim
  const rootRef = useRef<View>(null);
  const canvasOrigin = useRef({ x: 0, y: 0 });
  const mousePos = useRef({ x: 0, y: 0 });
  // Joystick state (mobile)
  const joyActive = useRef(false);
  const joyCtr = useRef({ x: 0, y: 0 });
  const joyOff = useRef({ x: 0, y: 0 });

  const setIsGamePlaying = useGameUIStore((s) => s.setIsGamePlaying);

  /* ── Load persisted state ── */
  useEffect(() => {
    loadHighScore();
    loadSelectedShip();
  }, []);

  /* ── Web keyboard + mouse controls ── */
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
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
  useEffect(() => {
    const id = setInterval(() => {
      const { w: W, h: H } = dimRef.current;
      if (!W || !H) { setTick((t) => t + 1); return; }

      const g = gsRef.current;
      if (!g || g.phase !== 'playing') { setTick((t) => t + 1); return; }

      frame.current++;
      const c = ctrl.current;

      /* Mouse aim on web (overrides arrow-key rotation if mouse moved recently) */
      if (Platform.OS === 'web') {
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
      } else {
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
      g.sx = wrap(g.sx + g.svx, W);
      g.sy = wrap(g.sy + g.svy, H);
      if (g.sInv > 0) g.sInv--;

      /* Fire */
      if (c.fire && c.fireCD <= 0) {
        const r = toR(g.sAngle - 90);
        const tip = SHIP_SIZE / 2 + 4;
        g.bullets.push({
          x: g.sx + Math.cos(r) * tip,
          y: g.sy + Math.sin(r) * tip,
          vx: Math.cos(r) * BULLET_SPEED + g.svx,
          vy: Math.sin(r) * BULLET_SPEED + g.svy,
          life: BULLET_LIFETIME,
        });
        c.fireCD = FIRE_CD;
        if (Platform.OS === 'web') playShoot();
      }
      if (c.fireCD > 0) c.fireCD--;

      /* Bullets */
      g.bullets = g.bullets
        .map((b) => ({ ...b, x: b.x + b.vx, y: b.y + b.vy, life: b.life - 1 }))
        .filter((b) => b.life > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);

      /* Particles */
      g.particles = g.particles
        .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1, size: p.size * 0.92 }))
        .filter((p) => p.life > 0);

      /* Asteroids */
      g.asteroids = g.asteroids.map((a) => ({
        ...a,
        x: wrap(a.x + a.vx, W),
        y: wrap(a.y + a.vy, H),
        rot: a.rot + a.rotSpeed,
      }));

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
            // Debris burst
            const numDebris = a.size === 'large' ? 14 : a.size === 'medium' ? 9 : 5;
            for (let di = 0; di < numDebris; di++) {
              const dir = rand(0, Math.PI * 2);
              const spd = rand(0.4, a.size === 'large' ? 3.5 : 2.5);
              const dLife = Math.round(rand(12, 26));
              g.particles.push({
                id: uid(), x: a.x, y: a.y,
                vx: Math.cos(dir) * spd, vy: Math.sin(dir) * spd,
                life: dLife, maxLife: dLife,
                size: rand(1.5, 3.5), kind: 'debris',
              });
            }
            if (Platform.OS === 'web') playExplosion(a.size);
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

      /* Ship–asteroid collision */
      if (g.sInv === 0) {
        for (const a of g.asteroids) {
          if (d2(g.sx, g.sy, a.x, a.y) < (a.radius * 0.8 + 9) ** 2) {
            g.lives--;
            if (g.lives <= 0) {
              if (Platform.OS === 'web' && thrustSoundRef.current) {
                thrustSoundRef.current.stop();
                thrustSoundRef.current = null;
              }
              g.phase = 'gameover';
              setNewHS(g.score > useGameUIStore.getState().highScore);
              updateHighScore(g.score);
            } else {
              g.sx = W / 2; g.sy = H / 2;
              g.svx = 0; g.svy = 0; g.sAngle = 0;
              g.sInv = INVINCIBLE;
            }
            break;
          }
        }
      }

      /* Level clear */
      if (g.asteroids.length === 0) {
        g.level++;
        g.asteroids = mkLevel(g.level, W, H, g.sx, g.sy);
      }

      setTick((t) => t + 1);
    }, TICK_MS);

    return () => clearInterval(id);
  }, []); // single interval, always reads current refs

  /* ── Init or restart game with given dimensions ── */
  const initNewGame = (W: number, H: number) => {
    setNewHS(false);
    gsRef.current = {
      phase: 'playing',
      sx: W / 2, sy: H / 2, svx: 0, svy: 0, sAngle: 0, sInv: INVINCIBLE,
      bullets: [], particles: [],
      asteroids: mkLevel(1, W, H, W / 2, H / 2),
      score: 0, lives: 3, level: 1,
    };
    setTick((t) => t + 1);
  };

  /* ── Start game ── */
  const handleStartGame = () => {
    const alreadyFullscreen = useGameUIStore.getState().isGamePlaying;
    if (alreadyFullscreen) {
      // Layout unchanged (play again from game-over): use current dims directly
      const { w: W, h: H } = dimRef.current;
      if (W > 0 && H > 0) initNewGame(W, H);
    } else {
      // Idle → playing: hiding header/nav changes layout, wait for onLayout
      pendingStart.current = true;
      setIsGamePlaying(true);
    }
  };

  /* ── Back to menu ── */
  const handleBackToMenu = () => {
    if (Platform.OS === 'web' && thrustSoundRef.current) {
      thrustSoundRef.current.stop();
      thrustSoundRef.current = null;
    }
    setIsGamePlaying(false); // header/nav reappear, onLayout will fire
    if (gsRef.current) gsRef.current.phase = 'idle';
    // Reset fire state so buttons don't get stuck
    ctrl.current = { left: false, right: false, thrust: false, fire: false, fireCD: 0 };
    joyActive.current = false;
    joyOff.current = { x: 0, y: 0 };
    setNewHS(false);
    setTick((t) => t + 1);
  };

  /* ── Layout handler ── */
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const gameH = Math.max(1, height - CTRL_H);
    dimRef.current = { w: width, h: gameH };
    setArea({ w: width, h: height });

    // Measure root position for web mouse-to-canvas coordinate conversion
    if (Platform.OS === 'web' && rootRef.current) {
      (rootRef.current as any).measureInWindow((x: number, y: number) => {
        canvasOrigin.current = { x, y };
      });
    }

    if (pendingStart.current && width > 0 && height > 0) {
      pendingStart.current = false;
      initNewGame(width, gameH);
    } else if (!gsRef.current && width > 0 && height > 0) {
      // First layout: build idle background
      gsRef.current = {
        phase: 'idle',
        sx: width / 2, sy: gameH / 2, svx: 0, svy: 0, sAngle: 0, sInv: 0,
        bullets: [], particles: [],
        asteroids: mkLevel(1, width, gameH, width / 2, gameH / 2),
        score: 0, lives: 3, level: 1,
      };
      setTick((t) => t + 1);
    } else if (gsRef.current?.phase === 'idle' && width > 0 && height > 0) {
      // Returning to idle (after back-to-menu): refresh drifting asteroids
      gsRef.current.asteroids = mkLevel(1, width, gameH, width / 2, gameH / 2);
      gsRef.current.sx = width / 2;
      gsRef.current.sy = gameH / 2;
    }
  };

  /* ── Joystick PanResponder (mobile only) ── */
  const joystickPR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        joyCtr.current = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
        joyOff.current = { x: 0, y: 0 };
        joyActive.current = true;
      },
      onPanResponderMove: (_, gs) => {
        const dx = Math.max(-JOY_MAX, Math.min(JOY_MAX, gs.dx));
        const dy = Math.max(-JOY_MAX, Math.min(JOY_MAX, gs.dy));
        joyOff.current = { x: dx, y: dy };
        ctrl.current.left = dx < -JOY_DEAD;
        ctrl.current.right = dx > JOY_DEAD;
        ctrl.current.thrust = dy < -JOY_DEAD;
      },
      onPanResponderRelease: () => {
        joyOff.current = { x: 0, y: 0 };
        joyActive.current = false;
        ctrl.current.left = false;
        ctrl.current.right = false;
        ctrl.current.thrust = false;
      },
      onPanResponderTerminate: () => {
        joyOff.current = { x: 0, y: 0 };
        joyActive.current = false;
        ctrl.current.left = false;
        ctrl.current.right = false;
        ctrl.current.thrust = false;
      },
    }),
  ).current;

  /* ── Render helpers ── */
  const g = gsRef.current;
  const isPlaying = g?.phase === 'playing';
  const shipVisible = !g || g.sInv === 0 || frame.current % 6 < 3;

  return (
    <View ref={rootRef} style={s.root} onLayout={onLayout}>
      {/* ── Game canvas (fills all space) ── */}
      <View style={s.canvas}>

        {/* Drifting asteroids */}
        {g?.asteroids.map((a) => (
          <View
            key={a.id}
            style={[s.asteroid, {
              width: a.aw * 2, height: a.ah * 2,
              borderTopLeftRadius: a.br[0], borderTopRightRadius: a.br[1],
              borderBottomRightRadius: a.br[2], borderBottomLeftRadius: a.br[3],
              left: a.x - a.aw, top: a.y - a.ah,
              transform: [{ rotate: `${a.rot}deg` }],
            }]}
          />
        ))}

        {/* Bullets — only during active play */}
        {g?.phase === 'playing' && g.bullets.map((b, i) => (
          <View key={i} style={[s.bullet, { left: b.x - 2.5, top: b.y - 2.5 }]} />
        ))}

        {/* Particles (thruster = white→blue, debris = white→gray) */}
        {g?.phase === 'playing' && g.particles.map((p) => {
          const t = p.life / p.maxLife;
          let rgb: string;
          if (p.kind === 'debris') {
            const c = Math.round(160 + 95 * t);
            rgb = `rgb(${c},${c},${c})`;
          } else {
            // Thruster: white (t=1) → light blue (t=0.5) → blue (t=0)
            const rv = Math.round(Math.min(255, 255 * t * 1.6));
            const gv = Math.round(Math.min(255, 220 * t * 1.6));
            rgb = `rgb(${rv},${gv},255)`;
          }
          return (
            <View
              key={p.id}
              style={{
                position: 'absolute',
                width: p.size, height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: rgb,
                opacity: t * 0.9,
                left: p.x - p.size / 2,
                top: p.y - p.size / 2,
              }}
            />
          );
        })}

        {/* Ship — rendered on top of particles */}
        {g && g.phase === 'playing' && shipVisible && (
          <View style={{
            position: 'absolute',
            left: g.sx - SHIP_SIZE / 2,
            top: g.sy - SHIP_SIZE / 2,
            transform: [{ rotate: `${g.sAngle}deg` }],
          }}>
            <ShipPreview ship={selectedShip} size={SHIP_SIZE} />
          </View>
        )}

        {/* ── HUD (score + high score + lives) ── */}
        {g && (
          <>
            <View style={s.hud}>
              <Text style={[s.hudScore, { fontFamily: MONO }]}>
                {String(g.score).padStart(5, '0')}
              </Text>
              <Text style={[s.hudHi, { fontFamily: MONO }]}>
                HI  {String(highScore).padStart(5, '0')}
              </Text>
            </View>
            {isPlaying && (
              <View style={s.livesRow}>
                {Array.from({ length: Math.max(0, g.lives) }).map((_, i) => (
                  <Text key={i} style={s.lifeIcon}>▲</Text>
                ))}
              </View>
            )}
            {isPlaying && (
              <Text style={[s.levelBadge, { fontFamily: MONO }]}>LV {g.level}</Text>
            )}
          </>
        )}

        {/* Web: keyboard/mouse hint */}
        {Platform.OS === 'web' && isPlaying && (
          <Text style={s.webHint}>
            Mouse aim · LMB thrust · Space fire  ·  ← → ↑ keys
          </Text>
        )}

        {/* ── Idle / title screen ── */}
        {(!g || g.phase === 'idle') && (
          <View style={s.overlay}>
            <Text style={[s.titleText, { fontFamily: MONO }]}>ASTEROIDS</Text>
            <Text style={[s.yearText, { fontFamily: MONO }]}>1979</Text>
            {highScore > 0 && (
              <Text style={[s.hiLabel, { fontFamily: MONO }]}>
                HIGH SCORE   {highScore}
              </Text>
            )}
            {Platform.OS === 'web' && (
              <Text style={[s.webIdleHint, { fontFamily: MONO }]}>
                Mouse aim · LMB thrust · Space to fire
              </Text>
            )}
            <Pressable onPress={handleStartGame} style={s.menuBtn}>
              <Text style={[s.menuBtnTxt, { fontFamily: MONO }]}>INSERT COIN</Text>
            </Pressable>
          </View>
        )}

        {/* ── Game over screen ── */}
        {g?.phase === 'gameover' && (
          <View style={s.gameOverOverlay}>
            <Text style={[s.titleText, { fontFamily: MONO }]}>GAME OVER</Text>
            <Text style={[s.finalScore, { fontFamily: MONO }]}>{g.score}</Text>
            {newHS && (
              <Text style={[s.newHsText, { fontFamily: MONO }]}>NEW HIGH SCORE!</Text>
            )}
            <View style={s.btnRow}>
              <Pressable onPress={handleStartGame} style={s.goBtn}>
                <Text style={[s.goBtnTxt, { fontFamily: MONO }]}>PLAY AGAIN</Text>
              </Pressable>
              <Pressable onPress={handleBackToMenu} style={[s.goBtn, s.goBtnSecondary]}>
                <Text style={[s.goBtnTxt, s.goBtnSecondaryTxt, { fontFamily: MONO }]}>
                  MENU
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Mobile controls (joystick + fire) ── */}
        {Platform.OS !== 'web' && isPlaying && (
          <View style={s.ctrlOverlay}>
            {/* Floating joystick touch area */}
            <View style={s.joyArea} {...joystickPR.panHandlers}>
              {joyActive.current && (
                <>
                  {/* Base ring */}
                  <View style={[s.joyBase, {
                    left: joyCtr.current.x - JOY_MAX,
                    top: joyCtr.current.y - JOY_MAX,
                  }]} />
                  {/* Thumb */}
                  <View style={[s.joyThumb, {
                    left: joyCtr.current.x + joyOff.current.x - JOY_THUMB_R,
                    top: joyCtr.current.y + joyOff.current.y - JOY_THUMB_R,
                  }]} />
                </>
              )}
              {/* Hint when not touching */}
              {!joyActive.current && (
                <View style={s.joyHint}>
                  <View style={s.joyHintRing} />
                </View>
              )}
            </View>

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
        )}
      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1, overflow: 'hidden' },

  asteroid: {
    position: 'absolute',
    borderWidth: 2, borderColor: '#FFF', backgroundColor: 'transparent',
  },
  bullet: {
    position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFF',
  },

  hud: {
    position: 'absolute', top: 14, left: 14, right: 14,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  hudScore: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  hudHi: { color: '#555', fontSize: 13 },
  livesRow: {
    position: 'absolute', top: 44, left: 14,
    flexDirection: 'row', gap: 5,
  },
  lifeIcon: { color: '#FFF', fontSize: 13 },
  levelBadge: {
    position: 'absolute',
    bottom: CTRL_H + 10,
    right: 14,
    color: '#444', fontSize: 12,
  },

  webHint: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    color: '#2A2A2A', fontSize: 11, textAlign: 'center',
  },
  webIdleHint: { color: '#555', fontSize: 12, letterSpacing: 1 },

  // Title/idle overlay — transparent so drifting asteroids show through
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', gap: 14,
  },
  // Game-over overlay — solid black so nothing bleeds through
  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center', gap: 18,
  },

  titleText: { color: '#FFF', fontSize: 34, fontWeight: '800', letterSpacing: 8 },
  yearText: { color: '#444', fontSize: 14, letterSpacing: 2 },
  hiLabel: { color: '#FFD700', fontSize: 14, letterSpacing: 1 },
  finalScore: { color: '#FFF', fontSize: 52, fontWeight: '700', letterSpacing: 6 },
  newHsText: { color: '#FFD700', fontSize: 15, fontWeight: '700', letterSpacing: 3 },

  btnRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  // Title screen button
  menuBtn: {
    borderWidth: 1.5, borderColor: '#FFF',
    paddingHorizontal: 24, paddingVertical: 12,
  },
  menuBtnTxt: { color: '#FFF', fontSize: 13, letterSpacing: 4 },
  // Game-over buttons — larger, clearly separated
  goBtn: {
    borderWidth: 2, borderColor: '#FFF',
    paddingHorizontal: 28, paddingVertical: 14,
    minWidth: 130, alignItems: 'center',
  },
  goBtnTxt: { color: '#FFF', fontSize: 14, letterSpacing: 4 },
  goBtnSecondary: { borderColor: '#444' },
  goBtnSecondaryTxt: { color: '#666' },

  /* Controls overlay */
  ctrlOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: CTRL_H,
    flexDirection: 'row', alignItems: 'center',
  },

  /* Joystick */
  joyArea: { flex: 1, height: CTRL_H },
  joyBase: {
    position: 'absolute',
    width: JOY_MAX * 2, height: JOY_MAX * 2, borderRadius: JOY_MAX,
    borderWidth: 1.5, borderColor: '#2A2A2A',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  joyThumb: {
    position: 'absolute',
    width: JOY_THUMB_R * 2, height: JOY_THUMB_R * 2, borderRadius: JOY_THUMB_R,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  joyHint: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  joyHintRing: {
    width: JOY_MAX * 2, height: JOY_MAX * 2, borderRadius: JOY_MAX,
    borderWidth: 1, borderColor: '#1A1A1A',
  },

  /* Fire button */
  fireBtn: {
    width: 90, height: 90, borderRadius: 45,
    marginRight: 30, marginBottom: 4,
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
