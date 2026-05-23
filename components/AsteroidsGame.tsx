import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ─── Constants ─────────────────────────────────────────────────────── */
const HIGH_SCORE_KEY = '@asteroids/high_score';
const TICK_MS = 16;
const SHIP_W = 20;
const SHIP_H = 26;
const BULLET_SPEED = 8;
const BULLET_LIFETIME = 62;
const THRUST = 0.13;
const FRICTION = 0.988;
const MAX_SPD = 7;
const ROT_SPD = 4.5;
const FIRE_CD = 12;
const SAFE_R = 130;
const INVINCIBLE = 180;
const CTRL_H = 130;

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
  br: [number, number, number, number];
}

interface Bullet { x: number; y: number; vx: number; vy: number; life: number; }

interface GS {
  phase: Phase;
  sx: number; sy: number; svx: number; svy: number;
  sAngle: number; sInv: number;
  bullets: Bullet[];
  asteroids: Asteroid[];
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
  ox?: number, oy?: number,
  px?: number, py?: number,
): Asteroid {
  const r = RADII[size];
  const [sMin, sMax] = SPEEDS[size];
  const spd = rand(sMin, sMax);
  const dir = rand(0, Math.PI * 2);
  let x: number, y: number;
  if (px !== undefined) {
    x = px; y = py!;
  } else {
    let tries = 0;
    do {
      x = rand(r, W - r); y = rand(r, H - r); tries++;
    } while (ox !== undefined && d2(x, y, ox, oy!) < SAFE_R ** 2 && tries < 40);
  }
  const br: [number, number, number, number] = [
    r * rand(0.55, 1.45), r * rand(0.55, 1.45),
    r * rand(0.55, 1.45), r * rand(0.55, 1.45),
  ];
  return {
    id: uid(), x, y,
    vx: Math.cos(dir) * spd, vy: Math.sin(dir) * spd,
    radius: r, size, rot: rand(0, 360), rotSpeed: rand(-1.5, 1.5), br,
  };
}

function mkLevel(lvl: number, W: number, H: number, sx: number, sy: number): Asteroid[] {
  return Array.from({ length: Math.min(3 + lvl, 14) }, () =>
    mkAsteroid(W, H, 'large', sx, sy));
}

function mkGS(W: number, H: number): GS {
  const cx = W / 2, cy = H / 2;
  return {
    phase: 'idle',
    sx: cx, sy: cy, svx: 0, svy: 0, sAngle: 0, sInv: 0,
    bullets: [],
    asteroids: mkLevel(1, W, H, cx, cy),
    score: 0, lives: 3, level: 1,
  };
}

const MONO: string = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

/* ─── Component ──────────────────────────────────────────────────────── */
export default function AsteroidsGame() {
  const [area, setArea] = useState({ w: 0, h: 0 });
  const canvasH = Math.max(0, area.h - CTRL_H);

  const [, setTick] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [newHS, setNewHS] = useState(false);
  const hsRef = useRef(0);

  const gsRef = useRef<GS | null>(null);
  const ctrl = useRef({ left: false, right: false, thrust: false, fire: false, fireCD: 0 });
  const frame = useRef(0);

  /* Load high score */
  useEffect(() => {
    AsyncStorage.getItem(HIGH_SCORE_KEY).then(v => {
      const n = v ? parseInt(v, 10) : 0;
      hsRef.current = n;
      setHighScore(n);
    });
  }, []);

  /* Init game state when canvas is ready */
  useEffect(() => {
    if (area.w > 0 && canvasH > 0 && !gsRef.current) {
      gsRef.current = mkGS(area.w, canvasH);
      setTick(t => t + 1);
    }
  }, [area.w, canvasH]);

  /* Game loop */
  useEffect(() => {
    if (!area.w || !canvasH) return;
    const W = area.w, H = canvasH;

    const id = setInterval(() => {
      const g = gsRef.current;
      if (!g || g.phase !== 'playing') { setTick(t => t + 1); return; }

      frame.current++;
      const c = ctrl.current;

      /* Rotate */
      if (c.left) g.sAngle -= ROT_SPD;
      if (c.right) g.sAngle += ROT_SPD;

      /* Thrust */
      if (c.thrust) {
        const r = toR(g.sAngle - 90);
        g.svx += Math.cos(r) * THRUST;
        g.svy += Math.sin(r) * THRUST;
        const spd = Math.sqrt(g.svx ** 2 + g.svy ** 2);
        if (spd > MAX_SPD) { g.svx = (g.svx / spd) * MAX_SPD; g.svy = (g.svy / spd) * MAX_SPD; }
      }

      /* Friction & move */
      g.svx *= FRICTION; g.svy *= FRICTION;
      g.sx = wrap(g.sx + g.svx, W); g.sy = wrap(g.sy + g.svy, H);
      if (g.sInv > 0) g.sInv--;

      /* Fire */
      if (c.fire && c.fireCD <= 0) {
        const r = toR(g.sAngle - 90);
        const tip = SHIP_H / 2 + 5;
        g.bullets.push({
          x: g.sx + Math.cos(r) * tip, y: g.sy + Math.sin(r) * tip,
          vx: Math.cos(r) * BULLET_SPEED + g.svx,
          vy: Math.sin(r) * BULLET_SPEED + g.svy,
          life: BULLET_LIFETIME,
        });
        c.fireCD = FIRE_CD;
      }
      if (c.fireCD > 0) c.fireCD--;

      /* Bullets */
      g.bullets = g.bullets
        .map(b => ({ ...b, x: b.x + b.vx, y: b.y + b.vy, life: b.life - 1 }))
        .filter(b => b.life > 0 && b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10);

      /* Asteroids */
      g.asteroids = g.asteroids.map(a => ({
        ...a,
        x: wrap(a.x + a.vx, W), y: wrap(a.y + a.vy, H),
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
      g.asteroids = [...g.asteroids.filter(a => !deadA.has(a.id)), ...born];
      g.bullets = g.bullets.filter((_, i) => !deadB.has(i));

      /* Ship–asteroid collision */
      if (g.sInv === 0) {
        for (const a of g.asteroids) {
          if (d2(g.sx, g.sy, a.x, a.y) < (a.radius * 0.8 + 9) ** 2) {
            g.lives--;
            if (g.lives <= 0) {
              g.phase = 'gameover';
              if (g.score > hsRef.current) {
                hsRef.current = g.score;
                setHighScore(g.score);
                setNewHS(true);
                AsyncStorage.setItem(HIGH_SCORE_KEY, String(g.score));
              } else {
                setNewHS(false);
              }
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

      setTick(t => t + 1);
    }, TICK_MS);

    return () => clearInterval(id);
  }, [area.w, canvasH]);

  const startGame = () => {
    const W = area.w, H = canvasH;
    if (!W || !H) return;
    setNewHS(false);
    gsRef.current = {
      phase: 'playing',
      sx: W / 2, sy: H / 2, svx: 0, svy: 0, sAngle: 0, sInv: INVINCIBLE,
      bullets: [],
      asteroids: mkLevel(1, W, H, W / 2, H / 2),
      score: 0, lives: 3, level: 1,
    };
    setTick(t => t + 1);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== area.w || height !== area.h) {
      setArea({ w: width, h: height });
    }
  };

  const g = gsRef.current;
  const thrustOn = g?.phase === 'playing' && ctrl.current.thrust;
  const shipVisible = !g || g.sInv === 0 || frame.current % 6 < 3;

  /* Thrust flame world position (opposite to thrust direction) */
  let flameX = 0, flameY = 0;
  if (g && thrustOn) {
    const fr = toR(g.sAngle + 90);
    flameX = g.sx + Math.cos(fr) * (SHIP_H / 2 + 2);
    flameY = g.sy + Math.sin(fr) * (SHIP_H / 2 + 2);
  }

  return (
    <View style={s.root} onLayout={onLayout}>
      {/* ── Canvas ── */}
      {canvasH > 0 && (
        <View style={[s.canvas, { height: canvasH }]}>
          {/* Asteroids */}
          {g?.asteroids.map(a => (
            <View
              key={a.id}
              style={[s.asteroid, {
                width: a.radius * 2,
                height: a.radius * 2,
                borderTopLeftRadius: a.br[0],
                borderTopRightRadius: a.br[1],
                borderBottomRightRadius: a.br[2],
                borderBottomLeftRadius: a.br[3],
                left: a.x - a.radius,
                top: a.y - a.radius,
                transform: [{ rotate: `${a.rot}deg` }],
              }]}
            />
          ))}

          {/* Bullets */}
          {g?.bullets.map((b, i) => (
            <View key={i} style={[s.bullet, { left: b.x - 2.5, top: b.y - 2.5 }]} />
          ))}

          {/* Thrust flame */}
          {thrustOn && shipVisible && (
            <View style={[s.flame, { left: flameX - 4, top: flameY - 5 }]} />
          )}

          {/* Ship */}
          {g && g.phase !== 'idle' && shipVisible && (
            <View style={[s.ship, {
              left: g.sx - SHIP_W / 2,
              top: g.sy - SHIP_H / 2,
              transform: [{ rotate: `${g.sAngle}deg` }],
            }]} />
          )}

          {/* HUD */}
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
              <View style={s.livesRow}>
                {Array.from({ length: Math.max(0, g.lives) }).map((_, i) => (
                  <Text key={i} style={s.lifeIcon}>▲</Text>
                ))}
              </View>
              {g.phase === 'playing' && (
                <Text style={[s.levelBadge, { fontFamily: MONO }]}>LV {g.level}</Text>
              )}
            </>
          )}

          {/* Idle screen */}
          {(!g || g.phase === 'idle') && (
            <View style={s.overlay}>
              <Text style={[s.titleText, { fontFamily: MONO }]}>ASTEROIDS</Text>
              <Text style={[s.subtitleText, { fontFamily: MONO }]}>1979</Text>
              {highScore > 0 && (
                <Text style={[s.hiLabel, { fontFamily: MONO }]}>
                  HIGH SCORE   {highScore}
                </Text>
              )}
              <Pressable onPress={startGame} style={s.startBtn}>
                <Text style={[s.startTxt, { fontFamily: MONO }]}>INSERT COIN</Text>
              </Pressable>
            </View>
          )}

          {/* Game over screen */}
          {g?.phase === 'gameover' && (
            <View style={s.overlay}>
              <Text style={[s.titleText, { fontFamily: MONO }]}>GAME OVER</Text>
              <Text style={[s.finalScore, { fontFamily: MONO }]}>{g.score}</Text>
              {newHS && (
                <Text style={[s.newHsText, { fontFamily: MONO }]}>NEW HIGH SCORE!</Text>
              )}
              <Pressable onPress={startGame} style={s.startBtn}>
                <Text style={[s.startTxt, { fontFamily: MONO }]}>PLAY AGAIN</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* ── Controls ── */}
      <View style={s.controls}>
        <View style={s.ctrlGroup}>
          <Pressable
            style={({ pressed }: { pressed: boolean }) => [s.ctrlBtn, pressed && s.ctrlBtnPressed]}
            onPressIn={() => { ctrl.current.left = true; }}
            onPressOut={() => { ctrl.current.left = false; }}
          >
            <Text style={s.ctrlTxt}>◀</Text>
          </Pressable>
          <Pressable
            style={({ pressed }: { pressed: boolean }) => [s.ctrlBtn, pressed && s.ctrlBtnPressed]}
            onPressIn={() => { ctrl.current.right = true; }}
            onPressOut={() => { ctrl.current.right = false; }}
          >
            <Text style={s.ctrlTxt}>▶</Text>
          </Pressable>
        </View>
        <View style={s.ctrlGroup}>
          <Pressable
            style={({ pressed }: { pressed: boolean }) => [s.ctrlBtn, s.thrustBtn, pressed && s.ctrlBtnPressed]}
            onPressIn={() => { ctrl.current.thrust = true; }}
            onPressOut={() => { ctrl.current.thrust = false; }}
          >
            <Text style={s.ctrlTxt}>▲</Text>
          </Pressable>
          <Pressable
            style={({ pressed }: { pressed: boolean }) => [s.ctrlBtn, s.fireBtn, pressed && s.ctrlBtnPressed]}
            onPressIn={() => { ctrl.current.fire = true; }}
            onPressOut={() => { ctrl.current.fire = false; }}
          >
            <Text style={[s.ctrlTxt, s.fireTxt]}>FIRE</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  canvas: { width: '100%', overflow: 'hidden' },

  asteroid: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: 'transparent',
  },
  bullet: {
    position: 'absolute',
    width: 5, height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFF',
  },
  ship: {
    position: 'absolute',
    width: 0, height: 0,
    borderLeftWidth: SHIP_W / 2,
    borderRightWidth: SHIP_W / 2,
    borderBottomWidth: SHIP_H,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFF',
    backgroundColor: 'transparent',
  },
  flame: {
    position: 'absolute',
    width: 8, height: 10,
    borderRadius: 4,
    backgroundColor: '#FF6600',
    opacity: 0.85,
  },

  hud: {
    position: 'absolute', top: 12, left: 14, right: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  hudScore: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  hudHi: { color: '#888', fontSize: 13 },
  livesRow: {
    position: 'absolute', top: 40, left: 14,
    flexDirection: 'row', gap: 5,
  },
  lifeIcon: { color: '#FFF', fontSize: 13 },
  levelBadge: {
    position: 'absolute', bottom: 6, right: 14,
    color: '#555', fontSize: 12,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', gap: 14,
  },
  titleText: {
    color: '#FFF', fontSize: 34, fontWeight: '800', letterSpacing: 8,
  },
  subtitleText: { color: '#555', fontSize: 14, letterSpacing: 2 },
  hiLabel: { color: '#FFD700', fontSize: 13, letterSpacing: 1 },
  finalScore: { color: '#FFF', fontSize: 40, fontWeight: '700', letterSpacing: 4 },
  newHsText: { color: '#FFD700', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  startBtn: {
    marginTop: 10,
    borderWidth: 1.5, borderColor: '#FFF',
    paddingHorizontal: 28, paddingVertical: 11,
  },
  startTxt: { color: '#FFF', fontSize: 15, letterSpacing: 4 },

  controls: {
    height: CTRL_H,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 28, paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1A1A1A',
  },
  ctrlGroup: { flexDirection: 'row', gap: 14 },
  ctrlBtn: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 1.5, borderColor: '#333',
    backgroundColor: '#0D0D0D',
    justifyContent: 'center', alignItems: 'center',
  },
  ctrlBtnPressed: { backgroundColor: '#1E1E1E', borderColor: '#555' },
  thrustBtn: { borderColor: '#444' },
  fireBtn: { borderColor: '#C0392B', backgroundColor: '#160000' },
  ctrlTxt: { color: '#DDD', fontSize: 22, fontWeight: '600' },
  fireTxt: { fontSize: 13, letterSpacing: 1 },
});
