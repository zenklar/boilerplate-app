import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform, LayoutChangeEvent, Animated,
  GestureResponderEvent, PanResponder,
} from 'react-native';
import { router } from 'expo-router';
import { usePongStore, PongRun } from '../store/pongStore';
import { useCoinStore } from '../store/coinStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import ArcadeCoin from './ArcadeCoin';
import {
  playCoinInsert, playCountdownBeep, playCountdownGo, playShipDestroyed, playShoot,
} from '../utils/sounds';

// ── Constants ─────────────────────────────────────────────────────────────
const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const TICK_MS = 16;
const CTRL_H = Platform.OS === 'web' ? 0 : 90;   // mobile reserves BOOST button row

const FRAME_RATIO = 0.62;          // w / h — vertical playfield
const PADDLE_W_FRAC = 0.16;        // paddle width as fraction of frame width
const PADDLE_H = 8;
const BALL_SIZE = 11;
const PADDLE_MARGIN = 22;          // distance from top/bottom edge to paddle
const BASE_SPEED = 6.0;
const SPEED_GROWTH = 1.05;         // ball speeds up 5% per paddle hit
const MAX_SPEED = 18.0;
const CPU_TRACK = 0.075;           // how aggressively CPU follows the ball
const CPU_DEMO_TRACK = 0.11;       // demo opponent is perfect-ish
const WIN_SCORE = 7;

// Boost (smash) — extra 10% on top of normal hit growth
const BOOST_MULT = 1.10;
const BOOST_ACTIVE_TICKS   = 14;   // ~0.22s window
const BOOST_COOLDOWN_TICKS = 80;   // ~1.3s
const CPU_BOOST_CHANCE_PER_TICK = 0.06; // when ball is in striking range

// Speed lights — perimeter-orbiting glow zones. Hitting one with the ball
// adds 20% speed. Number of lights scales with the rally round.
const LIGHT_LEN = 28;              // segment length along the perimeter (px)
const LIGHT_THICKNESS = 5;
const LIGHT_BASE_SPEED = 0.0030;   // perimeter fraction / tick
const LIGHT_HIT_MULT = 1.20;
const MAX_LIGHTS = 4;

// Demo/idle layout: reserve space top + bottom so the play frame matches the
// preview size used by other games (the frame must NOT fill the whole area).
const DEMO_RESERVE_TOP = 150;
const DEMO_RESERVE_BOTTOM = 130;

// ── Types ──────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'demo' | 'coinanim' | 'countdown' | 'playing' | 'gameover';

type Light = { pos: number; dir: 1 | -1; speed: number };

type GS = {
  ballX: number; ballY: number;
  ballVX: number; ballVY: number;
  playerX: number;                  // paddle centre x (player, bottom)
  cpuX: number;                     // paddle centre x (cpu, top)
  playerScore: number;
  cpuScore: number;
  rally: number;                    // current rally length
  longestRally: number;
  startTime: number;
  serveCD: number;                  // tick countdown before ball moves after a serve
  serveDir: 1 | -1;                 // which way ball serves (+1 = toward cpu)
  round: number;                    // increments each serve; drives light count
  lights: Light[];
  playerBoostActive: number;
  playerBoostCD: number;
  cpuBoostActive: number;
  cpuBoostCD: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Map a perimeter position (0..1, clockwise from top-left) to a screen
 *  point on the frame edge, plus the side it lies on. */
function perimeterToXY(pos: number, W: number, H: number) {
  const perim = 2 * (W + H);
  let d = ((pos % 1) + 1) % 1 * perim;
  if (d < W)         return { x: d, y: 0, side: 'top' as const };
  d -= W;
  if (d < H)         return { x: W, y: d, side: 'right' as const };
  d -= H;
  if (d < W)         return { x: W - d, y: H, side: 'bottom' as const };
  d -= H;
  return { x: 0, y: H - d, side: 'left' as const };
}

/** Did any light overlap the given hit point on the specified side? */
function lightOnSideHit(
  lights: Light[], side: 'top' | 'right' | 'bottom' | 'left',
  hitPos: number, W: number, H: number,
): boolean {
  const halfLen = LIGHT_LEN / 2;
  for (const l of lights) {
    const xy = perimeterToXY(l.pos, W, H);
    if (xy.side !== side) continue;
    const sidePos = (side === 'top' || side === 'bottom') ? xy.x : xy.y;
    if (Math.abs(sidePos - hitPos) < halfLen) return true;
  }
  return false;
}

/** Build the light arrangement for the given round.
 *  Round 1 → 1 light. Round 3 → 2. Round 5 → 3. Round 7+ → 4. */
function lightsForRound(round: number): Light[] {
  const count = Math.min(MAX_LIGHTS, 1 + Math.floor((round - 1) / 2));
  const out: Light[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      pos: Math.random(),
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: LIGHT_BASE_SPEED * (0.75 + Math.random() * 0.9),
    });
  }
  return out;
}

function applyLightBoost(g: GS) {
  const speed = Math.min(MAX_SPEED, Math.hypot(g.ballVX, g.ballVY) * LIGHT_HIT_MULT);
  const cur = Math.hypot(g.ballVX, g.ballVY) || 1;
  g.ballVX = (g.ballVX / cur) * speed;
  g.ballVY = (g.ballVY / cur) * speed;
}

function serve(g: GS, frameW: number, frameH: number, dir: 1 | -1) {
  g.ballX = frameW / 2;
  g.ballY = frameH / 2;
  const angle = (Math.random() - 0.5) * (Math.PI / 3); // ±30°
  g.ballVX = Math.sin(angle) * BASE_SPEED;
  g.ballVY = Math.cos(angle) * BASE_SPEED * dir;
  g.serveCD = 36;                   // ~0.6s pause before play
  g.serveDir = dir;
  g.rally = 0;
  g.round += 1;
  g.lights = lightsForRound(g.round);
  g.playerBoostActive = 0;
  g.cpuBoostActive = 0;
}

function makeInitialState(frameW: number, frameH: number): GS {
  const g: GS = {
    ballX: frameW / 2, ballY: frameH / 2,
    ballVX: 0, ballVY: 0,
    playerX: frameW / 2,
    cpuX: frameW / 2,
    playerScore: 0, cpuScore: 0,
    rally: 0, longestRally: 0,
    startTime: Date.now(),
    serveCD: 36, serveDir: -1,
    round: 0,                       // serve() bumps to 1 below
    lights: [],
    playerBoostActive: 0, playerBoostCD: 0,
    cpuBoostActive: 0,   cpuBoostCD: 0,
  };
  serve(g, frameW, frameH, -1);
  return g;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PongGame() {
  const setIsGamePlaying = usePongStore((s) => s.setIsGamePlaying);
  const updateHighScore  = usePongStore((s) => s.updateHighScore);
  const addRun           = usePongStore((s) => s.addRun);
  const highScore        = usePongStore((s) => s.highScore);
  const loadHighScore    = usePongStore((s) => s.loadHighScore);
  const coins            = useCoinStore((s) => s.coins);
  const spendCoin        = useCoinStore((s) => s.spendCoin);
  const isSubscribed     = useSubscriptionStore((s) => s.isSubscribed);

  const [phase, setPhase]       = useState<Phase>('idle');
  const [, setTick]             = useState(0);
  const [countNum, setCountNum] = useState(3);
  const [newHS, setNewHS]       = useState(false);
  const [area, setArea]         = useState({ w: 1, h: 1 });

  const gsRef       = useRef<GS | null>(null);
  const frameRef    = useRef({ w: 0, h: 0 });
  // Input: target x for the player paddle (driven by keyboard or drag)
  const targetXRef  = useRef<number | null>(null);
  const keyRef      = useRef({ left: false, right: false });

  // Animations
  const coinY        = useRef(new Animated.Value(-60)).current;
  const coinScale    = useRef(new Animated.Value(0.5)).current;
  const coinOpacity  = useRef(new Animated.Value(1)).current;
  const cdScale      = useRef(new Animated.Value(1)).current;
  const cdOpacity    = useRef(new Animated.Value(1)).current;

  useEffect(() => { loadHighScore(); }, []);

  // Auto-start demo when on idle
  useEffect(() => {
    if (phase === 'idle' && frameRef.current.w > 0) {
      const t = setTimeout(() => startDemo(), 600);
      return () => clearTimeout(t);
    }
  }, [phase, area.w, area.h]);

  const triggerPlayerBoost = useCallback(() => {
    const g = gsRef.current;
    if (!g) return;
    if (g.playerBoostCD > 0 || g.playerBoostActive > 0) return;
    g.playerBoostActive = BOOST_ACTIVE_TICKS;
    g.playerBoostCD = BOOST_COOLDOWN_TICKS;
  }, []);

  // Web keyboard
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handle = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a')  { keyRef.current.left = down;  e.preventDefault(); }
      else if (k === 'arrowright' || k === 'd') { keyRef.current.right = down; e.preventDefault(); }
      else if (k === ' ' && down) {
        e.preventDefault();
        if (phase === 'idle' || phase === 'gameover') handleInsertCoin();
        else if (phase === 'playing') triggerPlayerBoost();
      }
      else if ((k === 'arrowup' || k === 'w' || k === 'shift') && down && phase === 'playing') {
        e.preventDefault(); triggerPlayerBoost();
      }
    };
    const dn = handle(true); const up = handle(false);
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, [phase, triggerPlayerBoost]);

  // Touch drag (mobile + web) — set target x for the paddle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { targetXRef.current = e.nativeEvent.locationX; },
      onPanResponderMove: (e) => { targetXRef.current = e.nativeEvent.locationX; },
      onPanResponderRelease: () => { targetXRef.current = null; },
      onPanResponderTerminate: () => { targetXRef.current = null; },
    }),
  ).current;

  // Main tick
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'demo') return;
    const frame = frameRef.current;
    if (!frame.w) return;
    let raf: any;
    const step = () => {
      const g = gsRef.current;
      if (!g) { raf = setTimeout(step, TICK_MS); return; }
      const isDemo = phase === 'demo';
      const paddleW = Math.max(40, frame.w * PADDLE_W_FRAC);
      const halfP   = paddleW / 2;
      const halfB   = BALL_SIZE / 2;

      // ── Player paddle input ──
      if (isDemo) {
        // In demo, the "player" paddle is also AI
        const aim = g.ballVY > 0 ? g.ballX : frame.w / 2;
        g.playerX += (aim - g.playerX) * CPU_DEMO_TRACK * 0.85;
      } else if (targetXRef.current != null) {
        g.playerX += (targetXRef.current - g.playerX) * 0.35;
      } else {
        // Keyboard
        const SP = 7;
        if (keyRef.current.left)  g.playerX -= SP;
        if (keyRef.current.right) g.playerX += SP;
      }
      g.playerX = Math.max(halfP, Math.min(frame.w - halfP, g.playerX));

      // ── CPU paddle ──
      const cpuAim = g.ballVY < 0 ? g.ballX : frame.w / 2;
      const trackRate = isDemo ? CPU_DEMO_TRACK : CPU_TRACK;
      g.cpuX += (cpuAim - g.cpuX) * trackRate;
      g.cpuX = Math.max(halfP, Math.min(frame.w - halfP, g.cpuX));

      // ── Boost timers ──
      if (g.playerBoostActive > 0) g.playerBoostActive -= 1;
      if (g.playerBoostCD > 0)     g.playerBoostCD -= 1;
      if (g.cpuBoostActive > 0)    g.cpuBoostActive -= 1;
      if (g.cpuBoostCD > 0)        g.cpuBoostCD -= 1;

      // CPU boost AI: trigger when ball is closing in on the CPU paddle
      const cpuYAI = PADDLE_MARGIN + PADDLE_H;
      const cpuReady = g.cpuBoostCD === 0 && g.cpuBoostActive === 0;
      if (cpuReady && g.ballVY < 0 && (g.ballY - cpuYAI) < 70 && Math.abs(g.ballX - g.cpuX) < paddleW * 0.9) {
        if (Math.random() < CPU_BOOST_CHANCE_PER_TICK) {
          g.cpuBoostActive = BOOST_ACTIVE_TICKS;
          g.cpuBoostCD = BOOST_COOLDOWN_TICKS;
        }
      }

      // ── Speed lights orbit the frame ──
      for (const l of g.lights) {
        l.pos = (l.pos + l.speed * l.dir + 1) % 1;
      }

      // ── Ball ──
      if (g.serveCD > 0) {
        g.serveCD -= 1;
      } else {
        g.ballX += g.ballVX;
        g.ballY += g.ballVY;

        // Side walls (and check if a light is camped on the hit point)
        if (g.ballX - halfB <= 0 && g.ballVX < 0) {
          g.ballX = halfB; g.ballVX *= -1;
          if (lightOnSideHit(g.lights, 'left', g.ballY, frame.w, frame.h)) {
            applyLightBoost(g);
          }
        } else if (g.ballX + halfB >= frame.w && g.ballVX > 0) {
          g.ballX = frame.w - halfB; g.ballVX *= -1;
          if (lightOnSideHit(g.lights, 'right', g.ballY, frame.w, frame.h)) {
            applyLightBoost(g);
          }
        }

        // Paddle collision — player (bottom)
        const playerY = frame.h - PADDLE_MARGIN;
        if (g.ballVY > 0 && g.ballY + halfB >= playerY && g.ballY + halfB <= playerY + PADDLE_H + Math.abs(g.ballVY)) {
          if (Math.abs(g.ballX - g.playerX) <= halfP + halfB) {
            const hit = (g.ballX - g.playerX) / halfP;     // -1..1
            let mult = SPEED_GROWTH;
            if (g.playerBoostActive > 0) {
              mult *= BOOST_MULT;
              g.playerBoostActive = 0; // consumed
            }
            const speed = Math.min(MAX_SPEED, Math.hypot(g.ballVX, g.ballVY) * mult);
            const angle = hit * (Math.PI / 3);             // up to ±60°
            g.ballVX = Math.sin(angle) * speed;
            g.ballVY = -Math.cos(angle) * speed;
            g.ballY = playerY - halfB - 1;
            g.rally += 1;
            if (g.rally > g.longestRally) g.longestRally = g.rally;
            if (Platform.OS === 'web' && !isDemo) playShoot();
          }
        }

        // Paddle collision — cpu (top)
        const cpuY = PADDLE_MARGIN + PADDLE_H;
        if (g.ballVY < 0 && g.ballY - halfB <= cpuY && g.ballY - halfB >= cpuY - PADDLE_H - Math.abs(g.ballVY)) {
          if (Math.abs(g.ballX - g.cpuX) <= halfP + halfB) {
            const hit = (g.ballX - g.cpuX) / halfP;
            let mult = SPEED_GROWTH;
            if (g.cpuBoostActive > 0) {
              mult *= BOOST_MULT;
              g.cpuBoostActive = 0;
            }
            const speed = Math.min(MAX_SPEED, Math.hypot(g.ballVX, g.ballVY) * mult);
            const angle = hit * (Math.PI / 3);
            g.ballVX = Math.sin(angle) * speed;
            g.ballVY = Math.cos(angle) * speed;
            g.ballY = cpuY + halfB + 1;
            g.rally += 1;
            if (g.rally > g.longestRally) g.longestRally = g.rally;
            if (Platform.OS === 'web' && !isDemo) playShoot();
          }
        }

        // Scoring
        if (g.ballY > frame.h + BALL_SIZE) {
          g.cpuScore += 1;
          if (Platform.OS === 'web' && !isDemo) playShipDestroyed();
          if (!isDemo && g.cpuScore >= WIN_SCORE) { finishRun(g); }
          else serve(g, frame.w, frame.h, -1);
        } else if (g.ballY < -BALL_SIZE) {
          g.playerScore += 1;
          if (Platform.OS === 'web' && !isDemo) playShipDestroyed();
          if (!isDemo && g.playerScore >= WIN_SCORE) { finishRun(g); }
          else serve(g, frame.w, frame.h, 1);
        }
      }

      setTick((t) => t + 1);
      raf = setTimeout(step, TICK_MS);
    };
    raf = setTimeout(step, TICK_MS);
    return () => clearTimeout(raf);
  }, [phase, area.w, area.h]);

  function finishRun(g: GS) {
    const score = g.playerScore;
    const isNewHS = score > usePongStore.getState().highScore;
    setNewHS(isNewHS);
    updateHighScore(score);
    const run: PongRun = {
      id: String(Date.now()),
      score,
      durationMs: Date.now() - g.startTime,
      date: Date.now(),
      cpuScore: g.cpuScore,
      longestRally: g.longestRally,
    };
    addRun(run);
    setPhase('gameover');
    setIsGamePlaying(false);
  }

  function startFreshGame() {
    const f = frameRef.current;
    gsRef.current = makeInitialState(f.w, f.h);
    keyRef.current = { left: false, right: false };
    targetXRef.current = null;
    setIsGamePlaying(true);
    setPhase('playing');
  }

  function startDemo() {
    const f = frameRef.current;
    if (!f.w) return;
    gsRef.current = makeInitialState(f.w, f.h);
    setPhase('demo');
  }

  // Coin → countdown
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
      if (n > 1) setTimeout(() => runCountdown(n - 1), 80);
      else if (n === 1) setTimeout(() => runCountdown(0), 80);
      else setTimeout(() => startFreshGame(), 120);
    });
  }, []);

  const runCoinAnimation = useCallback(() => {
    const f = frameRef.current;
    coinY.setValue(-60);
    coinScale.setValue(0.5);
    coinOpacity.setValue(1);
    setPhase('coinanim');
    if (Platform.OS === 'web') playCoinInsert();
    Animated.parallel([
      Animated.timing(coinY,     { toValue: f.h / 2 - 30, duration: 520, useNativeDriver: true }),
      Animated.timing(coinScale, { toValue: 1.3,           duration: 520, useNativeDriver: true }),
    ]).start(() => {
      Animated.sequence([
        Animated.timing(coinScale,   { toValue: 0.2, duration: 180, useNativeDriver: true }),
        Animated.timing(coinOpacity, { toValue: 0,   duration: 80,  useNativeDriver: true }),
      ]).start(() => {
        setPhase('countdown');
        runCountdown(3);
      });
    });
  }, []);

  const handleInsertCoin = useCallback(() => {
    if (!isSubscribed && coins <= 0) {
      router.push('/(app)/shop' as any);
      return;
    }
    if (!isSubscribed) spendCoin();
    gsRef.current = null;
    runCoinAnimation();
  }, [isSubscribed, coins, spendCoin, runCoinAnimation]);

  const handleBackToMenu = useCallback(() => {
    gsRef.current = null;
    setIsGamePlaying(false);
    setNewHS(false);
    setPhase('idle');
  }, []);

  // Layout
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  };

  const isDemoLayout = phase === 'idle' || phase === 'demo';

  // Frame sized to fit, keeping a tall portrait aspect. In demo/idle we
  // reserve space top + bottom for the title and INSERT COIN so the play
  // frame is the same size you'd see across other arcade games.
  const playableH = area.h - CTRL_H;
  const reserved  = isDemoLayout ? (DEMO_RESERVE_TOP + DEMO_RESERVE_BOTTOM) : 16;
  const maxW = area.w - 16;
  const maxH = playableH - reserved;
  let frameW = maxW;
  let frameH = frameW / FRAME_RATIO;
  if (frameH > maxH) { frameH = maxH; frameW = frameH * FRAME_RATIO; }
  frameW = Math.floor(frameW);
  frameH = Math.floor(frameH);
  frameRef.current = { w: frameW, h: frameH };

  const g = gsRef.current;
  const showField = !!(g && (phase === 'playing' || phase === 'demo' || phase === 'gameover'));
  const paddleW = Math.max(40, frameW * PADDLE_W_FRAC);

  // Centre dashed net
  const netDashes: React.ReactNode[] = [];
  if (showField) {
    const dashH = 8, gap = 8;
    let y = 0;
    while (y < frameH) {
      netDashes.push(
        <View key={`n${y}`} style={{
          position: 'absolute', left: frameW / 2 - 1, top: y,
          width: 2, height: dashH, backgroundColor: '#222',
        }} />
      );
      y += dashH + gap;
    }
  }

  // Speed lights — orbiting glow segments on the frame perimeter
  const lightNodes: React.ReactNode[] = [];
  if (showField && g) {
    for (let li = 0; li < g.lights.length; li++) {
      const l = g.lights[li];
      const xy = perimeterToXY(l.pos, frameW, frameH);
      const horizontal = xy.side === 'top' || xy.side === 'bottom';
      const length = LIGHT_LEN;
      const thick = LIGHT_THICKNESS;
      const left = horizontal ? xy.x - length / 2 : xy.x - thick / 2;
      const top  = horizontal ? xy.y - thick  / 2 : xy.y - length / 2;
      const w = horizontal ? length : thick;
      const h = horizontal ? thick  : length;
      // Halo: a wider/taller semi-transparent block under the core
      const haloW = horizontal ? length + 14 : thick + 10;
      const haloH = horizontal ? thick + 10  : length + 14;
      lightNodes.push(
        <View key={`lh${li}`} pointerEvents="none" style={{
          position: 'absolute',
          left: (horizontal ? xy.x - haloW / 2 : xy.x - haloW / 2),
          top:  (horizontal ? xy.y - haloH / 2 : xy.y - haloH / 2),
          width: haloW, height: haloH,
          backgroundColor: 'rgba(0, 240, 255, 0.18)',
          borderRadius: 4,
        }} />,
        <View key={`l${li}`} pointerEvents="none" style={{
          position: 'absolute',
          left, top, width: w, height: h,
          backgroundColor: '#7FFAFF',
          borderRadius: 2,
          shadowColor: '#00F0FF',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 8,
        }} />
      );
    }
  }

  // Paddle visuals — colour shifts with boost state
  const playerBoostReady  = !!g && g.playerBoostCD === 0 && g.playerBoostActive === 0;
  const playerBoostActive = !!g && g.playerBoostActive > 0;
  const cpuBoostActive    = !!g && g.cpuBoostActive > 0;
  const playerColor = playerBoostActive ? '#FFF44C' : (playerBoostReady ? '#FFD700' : '#7A5A00');
  const cpuColor    = cpuBoostActive    ? '#A8FFFF' : '#FFFFFF';

  return (
    <View style={s.root} onLayout={onLayout}>
      <View style={s.center}>
        <View
          style={[s.frame, { width: frameW, height: frameH }]}
          {...panResponder.panHandlers}
        >
          {/* Net */}
          {netDashes}

          {/* Score readout — large faded digits behind play */}
          {showField && (
            <>
              <Text style={[s.scoreTopBig, { fontFamily: MONO }]}>{g!.cpuScore}</Text>
              <Text style={[s.scoreBotBig, { fontFamily: MONO }]}>{g!.playerScore}</Text>
            </>
          )}

          {/* Speed lights (under paddles/ball so they don't cover them) */}
          {lightNodes}

          {/* CPU paddle (top) */}
          {showField && (
            <View style={{
              position: 'absolute',
              left: g!.cpuX - paddleW / 2, top: PADDLE_MARGIN,
              width: paddleW, height: PADDLE_H,
              backgroundColor: cpuColor,
              shadowColor: cpuBoostActive ? '#00F0FF' : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: cpuBoostActive ? 1 : 0,
              shadowRadius: cpuBoostActive ? 10 : 0,
            }} />
          )}

          {/* Player paddle (bottom) */}
          {showField && (
            <View style={{
              position: 'absolute',
              left: g!.playerX - paddleW / 2, top: frameH - PADDLE_MARGIN - PADDLE_H,
              width: paddleW, height: PADDLE_H,
              backgroundColor: playerColor,
              shadowColor: playerBoostActive ? '#FFD700' : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: playerBoostActive ? 1 : 0,
              shadowRadius: playerBoostActive ? 12 : 0,
            }} />
          )}

          {/* Ball */}
          {showField && (
            <View style={{
              position: 'absolute',
              left: g!.ballX - BALL_SIZE / 2, top: g!.ballY - BALL_SIZE / 2,
              width: BALL_SIZE, height: BALL_SIZE,
              backgroundColor: '#FFF',
            }} />
          )}

          {/* Coin animation */}
          {phase === 'coinanim' && (
            <View style={StyleSheet.absoluteFill as any} pointerEvents="none">
              <Animated.View style={{
                position: 'absolute', top: 0,
                left: frameW / 2 - 28,
                width: 56, height: 56,
                alignItems: 'center', justifyContent: 'center',
                transform: [{ translateY: coinY }, { scale: coinScale }],
                opacity: coinOpacity,
              }}>
                <ArcadeCoin size={56} />
              </Animated.View>
            </View>
          )}

          {/* Countdown */}
          {phase === 'countdown' && (
            <View style={s.countdownOverlay} pointerEvents="none">
              <Animated.Text style={[
                s.countdownText, { fontFamily: MONO },
                { transform: [{ scale: cdScale }], opacity: cdOpacity },
              ]}>
                {countNum === 0 ? 'GO!' : String(countNum)}
              </Animated.Text>
            </View>
          )}

          {/* Game over */}
          {phase === 'gameover' && (
            <View style={s.gameOverOverlay}>
              <Text style={[s.titleText, { fontFamily: MONO }]}>
                {(g?.playerScore ?? 0) >= WIN_SCORE ? 'YOU WIN' : 'GAME OVER'}
              </Text>
              <Text style={[s.finalScore, { fontFamily: MONO }]}>
                {g?.playerScore ?? 0} : {g?.cpuScore ?? 0}
              </Text>
              {newHS && (
                <Text style={[s.newHsText, { fontFamily: MONO }]}>NEW HIGH SCORE!</Text>
              )}
              <View style={s.btnRow}>
                <Pressable onPress={handleInsertCoin} style={s.goBtn}>
                  <Text style={[s.goBtnTxt, { fontFamily: MONO }]}>
                    {(coins > 0 || isSubscribed) ? 'PLAY AGAIN' : 'GET COINS'}
                  </Text>
                </Pressable>
                <Pressable onPress={handleBackToMenu} style={[s.goBtn, s.goBtnSecondary]}>
                  <Text style={[s.goBtnTxt, s.goBtnSecondaryTxt, { fontFamily: MONO }]}>
                    MENU
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Title + INSERT COIN — positioned in the reserved space ABOVE and
          BELOW the frame, mirroring Tetris/Snake. */}
      {isDemoLayout && (
        <View style={s.overlay} pointerEvents="box-none">
          <View style={[s.overlayTop, { height: DEMO_RESERVE_TOP }]} pointerEvents="box-none">
            <Text style={[s.titleText, { fontFamily: MONO }]}>PONG</Text>
            {highScore > 0 && (
              <Text style={[s.hiLabel, { fontFamily: MONO }]}>
                HIGH SCORE   {highScore}
              </Text>
            )}
          </View>
          <View style={[s.overlayBottom, { height: DEMO_RESERVE_BOTTOM }]} pointerEvents="box-none">
            <Pressable
              onPress={handleInsertCoin}
              style={[s.menuBtn, coins === 0 && !isSubscribed && s.menuBtnNoCoins]}
            >
              <Text style={[s.menuBtnTxt, { fontFamily: MONO }]}>
                {(coins > 0 || isSubscribed) ? 'INSERT COIN' : 'GET COINS'}
              </Text>
            </Pressable>
            <Text style={[s.hint, { fontFamily: MONO }]}>
              {Platform.OS === 'web'
                ? 'Drag · Arrows  move  ·  Space  BOOST'
                : 'Drag to move  ·  tap BOOST to smash'}
            </Text>
          </View>
        </View>
      )}

      {/* Mobile BOOST button (below the frame) */}
      {Platform.OS !== 'web' && phase === 'playing' && (
        <View style={s.boostBar}>
          <Pressable
            onPress={triggerPlayerBoost}
            style={[
              s.boostBtn,
              playerBoostActive && s.boostBtnActive,
              !playerBoostReady && !playerBoostActive && s.boostBtnCooldown,
            ]}
          >
            <Text style={[s.boostBtnTxt, { fontFamily: MONO },
              playerBoostActive && { color: '#000' }]}>
              {playerBoostActive ? 'SMASH!' : playerBoostReady ? 'BOOST' : 'WAIT'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },

  frame: {
    backgroundColor: '#000',
    borderWidth: 2, borderColor: '#222',
    overflow: 'hidden',
    position: 'relative',
  },

  scoreTopBig: {
    position: 'absolute', top: '14%', left: 0, right: 0,
    color: '#1A1A1A', fontSize: 96, fontWeight: '900',
    textAlign: 'center', letterSpacing: 4,
  },
  scoreBotBig: {
    position: 'absolute', bottom: '14%', left: 0, right: 0,
    color: '#1A1500', fontSize: 96, fontWeight: '900',
    textAlign: 'center', letterSpacing: 4,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between', alignItems: 'center',
  },
  overlayTop:    { alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', paddingTop: 30 },
  overlayBottom: { alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', paddingBottom: 20 },

  boostBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 90, alignItems: 'center', justifyContent: 'center',
  },
  boostBtn: {
    paddingHorizontal: 36, paddingVertical: 14,
    borderWidth: 2, borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.10)',
  },
  boostBtnActive: { backgroundColor: '#FFD700', borderColor: '#FFEE40' },
  boostBtnCooldown: { borderColor: '#555', backgroundColor: 'rgba(120,120,120,0.10)' },
  boostBtnTxt: { color: '#FFD700', fontSize: 16, letterSpacing: 4, fontWeight: '800' },

  titleText: {
    color: '#FFF', fontSize: 36, fontWeight: '800', letterSpacing: 10,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  hiLabel: {
    color: '#FFD700', fontSize: 14, letterSpacing: 1,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6,
  },
  hint: {
    color: '#888', fontSize: 11, letterSpacing: 1,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4,
  },
  menuBtn: {
    borderWidth: 1.5, borderColor: '#B8860B',
    backgroundColor: '#FFD700',
    paddingHorizontal: 24, paddingVertical: 12,
  },
  menuBtnNoCoins: { backgroundColor: '#555', borderColor: '#333' },
  menuBtnTxt: { color: '#000', fontSize: 13, letterSpacing: 4, fontWeight: '800' },

  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  countdownText: {
    color: '#FFF', fontSize: 84, fontWeight: '900', letterSpacing: 8,
    textShadowColor: '#FFD700', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24,
  },

  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  finalScore: { color: '#FFF', fontSize: 48, fontWeight: '700', letterSpacing: 4 },
  newHsText:  { color: '#FFD700', fontSize: 15, fontWeight: '700', letterSpacing: 3 },
  btnRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  goBtn: {
    borderWidth: 2, borderColor: '#FFF',
    paddingHorizontal: 24, paddingVertical: 12,
    minWidth: 130, alignItems: 'center',
  },
  goBtnTxt:           { color: '#FFF', fontSize: 14, letterSpacing: 4 },
  goBtnSecondary:     { borderColor: '#666' },
  goBtnSecondaryTxt:  { color: '#999' },
});
