import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform, LayoutChangeEvent, Animated,
  GestureResponderEvent, PanResponder,
} from 'react-native';
import { router } from 'expo-router';
import { usePongStore, PongRun } from '../store/pongStore';
import { useCoinStore } from '../store/coinStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { usePerformanceStore } from '../store/performanceStore';
import ArcadeCoin from './ArcadeCoin';
import { fitPreview } from './game/previewFrame';
import GameControlsInfo from './game/GameControlsInfo';
import {
  playCoinInsert, playCountdownBeep, playCountdownGo, playShipDestroyed, playShoot,
} from '../utils/sounds';

// ── Constants ─────────────────────────────────────────────────────────────
const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const BASE_SIM_FPS = 60;
const CTRL_H = Platform.OS === 'web' ? 0 : 0;    // boost button removed; slider space handled by SLIDER_H
const SLIDER_H = Platform.OS === 'web' ? 0 : 68;  // mobile slider control height

const FRAME_RATIO = 0.62;          // w / h — vertical playfield
const PADDLE_W_FRAC = 0.22;        // paddle width as fraction of frame width
const PADDLE_H = 13;
const BALL_SIZE = 11;
const PADDLE_MARGIN = 22;          // distance from top/bottom edge to paddle
const BASE_SPEED = 6.0;
const SPEED_GROWTH = 1.05;         // ball speeds up 5% per paddle hit
const MAX_SPEED = 18.0;
const CPU_TRACK = 0.075;           // how aggressively CPU follows the ball
const CPU_DEMO_TRACK = 0.11;       // demo opponent is perfect-ish
const WIN_SCORE = 3;               // points to win one game (round)
const MATCH_WIN = 3;               // rounds to win one match (best of 5)

// Point scoring
const PTS_PER_HIT      = 5;        // any player paddle hit
const PTS_BOOST_HIT    = 30;       // boosted hit bonus (on top of PTS_PER_HIT)
const PTS_GOAL         = 100;      // scoring a goal
const PTS_SPEED_BONUS  = 100;      // max extra based on ball speed at goal time
const PTS_RALLY_BONUS  = 12;       // per hit in rally at goal time (capped at 30 hits)
const PTS_ELECTRICITY  = 75;       // electricity active when goal scored
const PTS_ROUND_WIN    = 500;      // winning a round
const PTS_MATCH_WIN    = 2000;     // winning a match

// Boost (smash) — extra 10% on top of normal hit growth
const BOOST_MULT = 1.10;
const BOOST_ACTIVE_TICKS   = 14;   // ~0.22s window
const BOOST_COOLDOWN_TICKS = 80;   // ~1.3s
const CPU_BOOST_CHANCE_PER_TICK = 0.06; // when ball is in striking range
const BOOST_BOUNCE_PX = 18;

// Electricity — border glow that fires randomly for 3 s, then cools down.
// While active, bouncing off any wall adds 20 % speed.
const ELECTRICITY_DURATION   = 180;   // active ticks  (~3 s)
const ELECTRICITY_CD_MIN     = 500;   // min cooldown  (~8 s)
const ELECTRICITY_CD_MAX     = 900;   // max cooldown  (~15 s)
const ELECTRICITY_WALL_BOOST = 1.20;

// Demo/idle layout: reserve space top + bottom so the play frame matches the
// preview size used by other games (the frame must NOT fill the whole area).
// Match the other arcade titles so all four idle screens align identically.
const DEMO_RESERVE_TOP = 160;
const DEMO_RESERVE_BOTTOM = 150;

// ── Types ──────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'demo' | 'coinanim' | 'countdown' | 'playing' | 'gameover';

type Ball = { x: number; y: number; vx: number; vy: number; split?: boolean };
type Electricity = { active: boolean; ticksLeft: number; cooldownLeft: number };

type GS = {
  balls: Ball[];
  playerX: number;                  // paddle centre x (player, bottom)
  cpuX: number;                     // paddle centre x (cpu, top)
  playerScore: number;              // points this game
  cpuScore: number;
  matchPlayerWins: number;          // rounds won this match
  matchCpuWins: number;
  totalMatches: number;             // matches won this session
  sessionScore: number;             // cumulative points this session
  rally: number;                    // current rally length
  longestRally: number;
  startTime: number;
  serveCD: number;                  // tick countdown before ball moves after a serve
  serveDir: 1 | -1;                 // which way ball serves (+1 = toward player)
  round: number;
  electricity: Electricity;
  playerBoostActive: number;
  playerBoostCD: number;
  cpuBoostActive: number;
  cpuBoostCD: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Apply electricity wall-bounce speed boost to a ball. */
function applyWallBoost(ball: Ball) {
  const cur = Math.hypot(ball.vx, ball.vy) || 1;
  const speed = Math.min(MAX_SPEED, cur * ELECTRICITY_WALL_BOOST);
  ball.vx = (ball.vx / cur) * speed;
  ball.vy = (ball.vy / cur) * speed;
}

/**
 * Convert remaining boost ticks into a quick up-and-down paddle lift.
 * The paddle rises rapidly, then falls back during the same boost window.
 */
function boostLiftFromTicks(ticksLeft: number) {
  if (ticksLeft <= 0) return 0;
  const p = 1 - Math.min(1, ticksLeft / BOOST_ACTIVE_TICKS); // 0 -> 1 over boost window
  if (p < 0.35) return (p / 0.35) * BOOST_BOUNCE_PX;
  return Math.max(0, (1 - (p - 0.35) / 0.65) * BOOST_BOUNCE_PX);
}

function serve(g: GS, frameW: number, frameH: number, dir: 1 | -1) {
  const angle = (Math.random() - 0.5) * (Math.PI / 3); // ±30°
  g.balls = [{ x: frameW / 2, y: frameH / 2,
    vx: Math.sin(angle) * BASE_SPEED,
    vy: Math.cos(angle) * BASE_SPEED * dir,
  }];
  g.serveCD = 36;                   // ~0.6s pause before play
  g.serveDir = dir;
  g.rally = 0;
  g.round += 1;
  g.playerBoostActive = 0;
  g.cpuBoostActive = 0;
}

function makeInitialState(frameW: number, frameH: number): GS {
  const g: GS = {
    balls: [],
    playerX: frameW / 2,
    cpuX: frameW / 2,
    playerScore: 0, cpuScore: 0,
    matchPlayerWins: 0, matchCpuWins: 0,
    totalMatches: 0,
    sessionScore: 0,
    rally: 0, longestRally: 0,
    startTime: Date.now(),
    serveCD: 36, serveDir: -1,
    round: 0,
    electricity: { active: false, ticksLeft: 0, cooldownLeft: 300 },
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
  const fpsCap           = usePerformanceStore((s) => s.fpsCap);
  const effectsBudget    = usePerformanceStore((s) => s.adaptiveEffectsBudget);
  const setAdaptiveEffectsBudget = usePerformanceStore((s) => s.setAdaptiveEffectsBudget);

  const [phase, setPhase]       = useState<Phase>('idle');
  const [, setTick]             = useState(0);
  const [countNum, setCountNum] = useState(3);
  const [newHS, setNewHS]       = useState(false);
  const [playerWon, setPlayerWon] = useState(false);
  const [area, setArea]         = useState({ w: 1, h: 1 });

  const gsRef       = useRef<GS | null>(null);
  const frameRef    = useRef({ w: 0, h: 0 });
  // Input: target x for the player paddle (driven by mouse or touch drag)
  const targetXRef      = useRef<number | null>(null);
  // Paddle x captured at the moment a touch starts (delta-drag anchor)
  const paddleAtGrantRef = useRef<number>(0);
  // Stable ref for current phase (used inside stable event listeners)
  const phaseRef    = useRef<Phase>(phase);
  phaseRef.current  = phase;
  const frameViewRef    = useRef<any>(null);
  const insertCoinRef   = useRef<() => void>(() => {});
  const triggerBoostRef = useRef<() => void>(() => {});
  const effectsBudgetRef = useRef(1);
  const hitSfxGateRef = useRef(0);

  // Animations
  const coinY        = useRef(new Animated.Value(-60)).current;
  const coinScale    = useRef(new Animated.Value(0.5)).current;
  const coinOpacity  = useRef(new Animated.Value(1)).current;
  const cdScale      = useRef(new Animated.Value(1)).current;
  const cdOpacity    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadHighScore();
    usePerformanceStore.getState().load();
  }, []);

  useEffect(() => {
    effectsBudgetRef.current = effectsBudget;
  }, [effectsBudget]);

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
    if (phaseRef.current === 'playing') playShoot();
  }, []);
  triggerBoostRef.current = triggerPlayerBoost;

  // Web: track mouse position for paddle — fires without any click
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMove = (e: MouseEvent) => {
      const el = frameViewRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      targetXRef.current = e.clientX - rect.left;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Web: left-click on the play frame triggers boost (playing phase only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onDown = (e: MouseEvent) => {
      if (phaseRef.current !== 'playing') return;
      e.preventDefault();
      triggerPlayerBoost();
    };
    const el = frameViewRef.current;
    if (!el) return;
    el.addEventListener('mousedown', onDown);
    return () => el.removeEventListener('mousedown', onDown);
  }, [triggerPlayerBoost]);

  // Web keyboard (Shift / W as fallback boost shortcuts)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phaseRef.current === 'playing') {
        const g = gsRef.current; if (g) finishRun(g, false); return;
      }
      const k = e.key.toLowerCase();
      if ((k === 'w' || k === 'shift') && phaseRef.current === 'playing') {
        e.preventDefault(); triggerPlayerBoost();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerPlayerBoost]);

  // Touch drag (mobile + web) — delta-based so coordinate system of the
  // touched view (thumb vs track) never matters; paddle moves by the
  // distance the finger has travelled since touch-start.
  // A minimal-movement single tap triggers boost.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Capture paddle position as the drag origin — don't move yet
        paddleAtGrantRef.current = gsRef.current?.playerX ?? frameRef.current.w / 2;
      },
      onPanResponderMove: (_e, gs) => {
        targetXRef.current = paddleAtGrantRef.current + gs.dx;
      },
      onPanResponderRelease: (_e, gs) => {
        // Single-tap (minimal movement) -> boost; drag -> just release
        if (Math.abs(gs.dx) < 8 && Math.abs(gs.dy) < 8) {
          triggerBoostRef.current();
        }
        targetXRef.current = null;
      },
      onPanResponderTerminate: () => { targetXRef.current = null; },
    }),
  ).current;

  // Main tick with global FPS cap. We keep gameplay pacing stable by scaling
  // per-tick movement/timers relative to the original 60 Hz baseline.
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'demo') return;
    const frame = frameRef.current;
    if (!frame.w) return;
    const isDemo = phase === 'demo';
    const simFps = fpsCap;
    const tickMs = 1000 / simFps;
    const stepMul = BASE_SIM_FPS / simFps;
    const lerpForStep = (a: number) => 1 - Math.pow(1 - a, stepMul);
    let lastTickTs = Date.now();
    let budgetSampleMs = 0;

    const scoreBudgetFromFrame = (frameMs: number) => {
      const ratio = frameMs / tickMs;
      if (ratio <= 1.05) return 1;
      if (ratio <= 1.2) return 0.85;
      if (ratio <= 1.45) return 0.65;
      return 0.45;
    };

    const maybePlayHitSfx = (isDemoMode: boolean) => {
      if (isDemoMode) return;
      const fx = Platform.OS === 'web' ? 1 : effectsBudgetRef.current;
      const cadence = fx >= 0.85 ? 1 : fx >= 0.65 ? 2 : 3;
      hitSfxGateRef.current = (hitSfxGateRef.current + 1) % cadence;
      if (hitSfxGateRef.current === 0) playShoot();
    };

    const id = setInterval(() => {
      const now = Date.now();
      const dtMs = Math.min(50, now - lastTickTs);
      lastTickTs = now;
      budgetSampleMs += dtMs;
      if (budgetSampleMs >= 250) {
        budgetSampleMs = 0;
        setAdaptiveEffectsBudget(scoreBudgetFromFrame(dtMs));
      }

      const g = gsRef.current;
      if (!g) return;
      const effectsScale = Platform.OS === 'web' ? 1 : effectsBudgetRef.current;
      const splitChance = 0.2 * effectsScale;
      const paddleW = Math.max(40, frame.w * PADDLE_W_FRAC);
      const halfP   = paddleW / 2;
      const halfB   = BALL_SIZE / 2;

      // ── Player paddle input ──
      if (isDemo) {
        const playerThreat = g.balls.find(b => b.vy > 0);
        const aim = playerThreat ? playerThreat.x : frame.w / 2;
        g.playerX += (aim - g.playerX) * lerpForStep(CPU_DEMO_TRACK * 0.85);
      } else if (targetXRef.current != null) {
        // Mobile: snap directly (1:1 with finger); web: smooth lerp
        if (Platform.OS === 'web') {
          g.playerX += (targetXRef.current - g.playerX) * lerpForStep(0.35);
        } else {
          g.playerX = targetXRef.current;
        }
      }
      g.playerX = Math.max(halfP, Math.min(frame.w - halfP, g.playerX));

      // ── CPU paddle ──
      const cpuThreatBall = g.balls.find(b => b.vy < 0);
      const cpuAim = cpuThreatBall ? cpuThreatBall.x : frame.w / 2;
      const trackRate = isDemo ? CPU_DEMO_TRACK : CPU_TRACK;
      g.cpuX += (cpuAim - g.cpuX) * lerpForStep(trackRate);
      g.cpuX = Math.max(halfP, Math.min(frame.w - halfP, g.cpuX));

      // ── Boost timers ──
      if (g.playerBoostActive > 0) g.playerBoostActive -= stepMul;
      if (g.playerBoostCD > 0)     g.playerBoostCD -= stepMul;
      if (g.cpuBoostActive > 0)    g.cpuBoostActive -= stepMul;
      if (g.cpuBoostCD > 0)        g.cpuBoostCD -= stepMul;

      // CPU boost AI
      const cpuYAI = PADDLE_MARGIN + PADDLE_H;
      const cpuReady = g.cpuBoostCD === 0 && g.cpuBoostActive === 0;
      const cpuDanger = g.balls.find(
        b => b.vy < 0 && (b.y - cpuYAI) < 70 && Math.abs(b.x - g.cpuX) < paddleW * 0.9,
      );
      if (cpuReady && cpuDanger && Math.random() < CPU_BOOST_CHANCE_PER_TICK) {
        g.cpuBoostActive = BOOST_ACTIVE_TICKS;
        g.cpuBoostCD = BOOST_COOLDOWN_TICKS;
        if (!isDemo) playShoot();
      }

      // ── Electricity ──
      if (g.electricity.active) {
        g.electricity.ticksLeft -= stepMul;
        if (g.electricity.ticksLeft <= 0) {
          g.electricity.active = false;
          g.electricity.cooldownLeft = ELECTRICITY_CD_MIN +
            Math.floor(Math.random() * (ELECTRICITY_CD_MAX - ELECTRICITY_CD_MIN));
        }
      } else {
        if (g.electricity.cooldownLeft > 0) {
          g.electricity.cooldownLeft -= stepMul;
        } else {
          g.electricity.active = true;
          g.electricity.ticksLeft = ELECTRICITY_DURATION;
        }
      }

      // ── Balls ──
      if (g.serveCD > 0) {
        g.serveCD -= stepMul;
      } else {
        const surviving: Ball[] = [];
        let nextServeDir: 1 | -1 = g.serveDir;
        let skipBallUpdate = false;

        for (const ball of g.balls) {
          let scored = false;
          let spawn: Ball | null = null;

          ball.x += ball.vx * stepMul;
          ball.y += ball.vy * stepMul;

          // Side walls
          if (ball.x - halfB <= 0 && ball.vx < 0) {
            ball.x = halfB; ball.vx *= -1;
            if (g.electricity.active) applyWallBoost(ball);
          } else if (ball.x + halfB >= frame.w && ball.vx > 0) {
            ball.x = frame.w - halfB; ball.vx *= -1;
            if (g.electricity.active) applyWallBoost(ball);
          }

          // Paddle collision — player (bottom). Boost now physically lifts
          // the paddle, so timing the double tap changes the hit window.
          const playerLift = boostLiftFromTicks(g.playerBoostActive);
          const playerY = frame.h - PADDLE_MARGIN - playerLift;
          if (ball.vy > 0 && ball.y + halfB >= playerY &&
              ball.y + halfB <= playerY + PADDLE_H + Math.abs(ball.vy * stepMul)) {
            if (Math.abs(ball.x - g.playerX) <= halfP + halfB) {
              const hit = (ball.x - g.playerX) / halfP;
              let mult = SPEED_GROWTH;
              let boosted = false;
              if (g.playerBoostActive > 0) {
                mult *= BOOST_MULT; g.playerBoostActive = 0; boosted = true;
              }
              const speed = Math.min(MAX_SPEED, Math.hypot(ball.vx, ball.vy) * mult);
              const angle = hit * (Math.PI / 3);
              ball.vx = Math.sin(angle) * speed;
              ball.vy = -Math.cos(angle) * speed;
              ball.y = playerY - halfB - 1;
              g.rally += 1;
              if (g.rally > g.longestRally) g.longestRally = g.rally;
              maybePlayHitSfx(isDemo);
              if (!isDemo) {
                g.sessionScore += PTS_PER_HIT;
                if (boosted) g.sessionScore += PTS_BOOST_HIT;
              }
              // 20% split on boosted hit (cap at 3 total balls)
              if (boosted && Math.random() < splitChance && surviving.length + g.balls.length < 4) {
                const sAngle = -angle + 0.5;
                spawn = { x: ball.x, y: ball.y,
                  vx: Math.sin(sAngle) * speed,
                  vy: -Math.cos(sAngle) * speed, split: true };
              }
            }
          }

          // Paddle collision — cpu (top)
          const cpuLift = boostLiftFromTicks(g.cpuBoostActive);
          const cpuY = PADDLE_MARGIN + PADDLE_H + cpuLift;
          if (ball.vy < 0 && ball.y - halfB <= cpuY &&
              ball.y - halfB >= cpuY - PADDLE_H - Math.abs(ball.vy * stepMul)) {
            if (Math.abs(ball.x - g.cpuX) <= halfP + halfB) {
              const hit = (ball.x - g.cpuX) / halfP;
              let mult = SPEED_GROWTH;
              let boosted = false;
              if (g.cpuBoostActive > 0) {
                mult *= BOOST_MULT; g.cpuBoostActive = 0; boosted = true;
              }
              const speed = Math.min(MAX_SPEED, Math.hypot(ball.vx, ball.vy) * mult);
              const angle = hit * (Math.PI / 3);
              ball.vx = Math.sin(angle) * speed;
              ball.vy = Math.cos(angle) * speed;
              ball.y = cpuY + halfB + 1;
              g.rally += 1;
              if (g.rally > g.longestRally) g.longestRally = g.rally;
              maybePlayHitSfx(isDemo);
              if (boosted && Math.random() < splitChance && surviving.length + g.balls.length < 4) {
                const sAngle = -angle + 0.5;
                spawn = { x: ball.x, y: ball.y,
                  vx: Math.sin(sAngle) * speed,
                  vy: Math.cos(sAngle) * speed, split: true };
              }
            }
          }

          // Scoring — net: player goal = +1, CPU goal = -1 on playerScore
          if (ball.y > frame.h + BALL_SIZE) {
            g.playerScore -= 1; scored = true; nextServeDir = -1;
            if (!isDemo) playShipDestroyed();
            if (!isDemo && g.playerScore <= -WIN_SCORE) {
              g.matchCpuWins += 1;
              if (g.matchCpuWins >= MATCH_WIN) finishRun(g, false);
              else { g.playerScore = 0; serve(g, frame.w, frame.h, -1); }
              skipBallUpdate = true; break;
            }
          } else if (ball.y < -BALL_SIZE) {
            g.playerScore += 1; scored = true; nextServeDir = 1;
            if (!isDemo) playShipDestroyed();
            if (!isDemo) {
              // Goal points: base + speed bonus + rally depth + electricity bonus
              const spd = Math.hypot(ball.vx, ball.vy);
              const spdPts  = Math.floor((Math.min(spd, MAX_SPEED) / MAX_SPEED) * PTS_SPEED_BONUS);
              const rallyPts = Math.min(g.rally, 30) * PTS_RALLY_BONUS;
              const elecPts  = g.electricity.active ? PTS_ELECTRICITY : 0;
              g.sessionScore += PTS_GOAL + spdPts + rallyPts + elecPts;
            }
            if (!isDemo && g.playerScore >= WIN_SCORE) {
              g.sessionScore += PTS_ROUND_WIN;
              g.matchPlayerWins += 1;
              if (g.matchPlayerWins >= MATCH_WIN) {
                // Player won the match — bank bonus and end the game
                g.sessionScore += PTS_MATCH_WIN;
                finishRun(g, true);
                skipBallUpdate = true; break;
              }
              g.playerScore = 0;
              serve(g, frame.w, frame.h, 1);
              skipBallUpdate = true; break;
            }
          }

          if (!scored) {
            surviving.push(ball);
            if (spawn) surviving.push(spawn);
          }
        }

        if (!skipBallUpdate) {
          g.balls = surviving;
          if (g.balls.length === 0) serve(g, frame.w, frame.h, nextServeDir);
        }
      }

      setTick((t) => t + 1);
    }, tickMs);
    return () => clearInterval(id);
  }, [phase, area.w, area.h, fpsCap]);

  function finishRun(g: GS, won: boolean) {
    setPlayerWon(won);
    if (won) {
      const score = g.sessionScore;
      const isNewHS = score > usePongStore.getState().highScore;
      setNewHS(isNewHS);
      updateHighScore(score);
      const run: PongRun = {
        id: String(Date.now()),
        score,
        durationMs: Date.now() - g.startTime,
        date: Date.now(),
        cpuScore: g.matchCpuWins,
        longestRally: g.longestRally,
      };
      addRun(run);
    } else {
      setNewHS(false);
    }
    setPhase('gameover');
    // Keep isGamePlaying TRUE through the game-over screen so the GameShell
    // chrome stays hidden — only handleBackToMenu (MENU button) flips it back.
  }

  function startFreshGame() {
    const f = frameRef.current;
    gsRef.current = makeInitialState(f.w, f.h);
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
    if (n > 0) playCountdownBeep(n as 1 | 2 | 3);
    else playCountdownGo();
    Animated.parallel([
      Animated.timing(cdScale,   { toValue: n > 0 ? 0.8 : 1.1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      Animated.sequence([
        Animated.delay(n > 0 ? 550 : 400),
        Animated.timing(cdOpacity, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    ]).start(({ finished }) => {
      if (!finished) return;
      if (n > 1) setTimeout(() => runCountdown(n - 1), 80);
      else if (n === 1) setTimeout(() => runCountdown(0), 80);
      else setTimeout(() => startFreshGame(), 120);
    });
  }, []);

  const runCoinAnimation = useCallback(() => {
    const targetY = area.h / 2 - 30;
    coinY.setValue(-60);
    coinScale.setValue(0.5);
    coinOpacity.setValue(1);
    setPhase('coinanim');
    playCoinInsert();
    Animated.parallel([
      Animated.timing(coinY,     { toValue: targetY, duration: 520, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(coinScale, { toValue: 1.3,     duration: 520, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      Animated.sequence([
        Animated.timing(coinScale,   { toValue: 0.2, duration: 180, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(coinOpacity, { toValue: 0,   duration: 80,  useNativeDriver: Platform.OS !== 'web' }),
      ]).start(() => {
        setPhase('countdown');
        runCountdown(3);
      });
    });
  }, [area.h]);

  const handleInsertCoin = useCallback(() => {
    if (!isSubscribed && coins <= 0) {
      router.push('/(app)/shop' as any);
      return;
    }
    if (!isSubscribed) spendCoin();
    gsRef.current = null;
    runCoinAnimation();
  }, [isSubscribed, coins, spendCoin, runCoinAnimation]);
  insertCoinRef.current = handleInsertCoin;

  function handleBackToMenu() {
    gsRef.current = null;
    setIsGamePlaying(false);
    setNewHS(false);
    setPlayerWon(false);
    setPhase('idle');
  }

  // Layout
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  };

  const isDemoLayout = phase === 'idle' || phase === 'demo';

  // Frame sized to fit. On the title / demo screen the frame uses the
  // SHARED preview size so all four arcade games show an identical box.
  // During gameplay we use the natural FRAME_RATIO so the playfield matches
  // the web version's aspect.
  const playableH = area.h - CTRL_H;
  let frameW: number;
  let frameH: number;
  if (isDemoLayout) {
    // Use full area.h (controls aren't shown during demo) so the preview
    // matches Asteroids which measures its gameArea without CTRL_H.
    const preview = fitPreview(area.w, area.h);
    frameW = preview.w;
    frameH = preview.h;
  } else {
    const maxW = area.w - 16;
    const maxH = playableH - 16 - SLIDER_H - (SLIDER_H > 0 ? 8 : 0);
    frameW = maxW;
    frameH = frameW / FRAME_RATIO;
    if (frameH > maxH) { frameH = maxH; frameW = frameH * FRAME_RATIO; }
    frameW = Math.floor(frameW);
    frameH = Math.floor(frameH);
  }
  frameRef.current = { w: frameW, h: frameH };

  const g = gsRef.current;
  // Hide the playfield during game-over so the root-level overlay is the
  // only thing on screen (matches the web layout).
  const showField = !!(g && (phase === 'playing' || phase === 'demo'));
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

  // Electricity — flickering border glow when active.
  // On Android we omit shadowRadius (it forces per-frame rasterisation of the
  // border, which dominates the JS→UI bridge); the alpha-flicker carries the
  // effect by itself.
  const electricNodes: React.ReactNode[] = [];
  const showElectricFx = effectsBudget >= 0.65;
  if (showField && g && g.electricity.active && showElectricFx) {
    const t = Date.now();
    const f1 = 0.45 + 0.55 * Math.abs(Math.sin(t * 0.042));
    const f2 = 0.45 + 0.55 * Math.abs(Math.sin(t * 0.071 + 1.3));
    const thick = 3;
    const c1 = `rgba(255,255,255,${f1.toFixed(2)})`;
    const c2 = `rgba(255,255,255,${f2.toFixed(2)})`;
    const isAndroid = Platform.OS === 'android';
    const glow1 = isAndroid ? null : { boxShadow: `0px 0px 12px rgba(255,255,255,${f1.toFixed(2)})` };
    const glow2 = isAndroid ? null : { boxShadow: `0px 0px 12px rgba(255,255,255,${f2.toFixed(2)})` };
    electricNodes.push(
      <View key="et" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: thick,
        pointerEvents: 'none',
        backgroundColor: c1,
        ...glow1,
      }} />,
      <View key="eb" style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: thick,
        pointerEvents: 'none',
        backgroundColor: c2,
        ...glow2,
      }} />,
      <View key="el" style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: thick,
        pointerEvents: 'none',
        backgroundColor: c1,
        ...glow1,
      }} />,
      <View key="er" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: thick,
        pointerEvents: 'none',
        backgroundColor: c2,
        ...glow2,
      }} />,
    );
  }

  // Paddle visuals — colour shifts with boost state
  const playerBoostReady  = !!g && g.playerBoostCD === 0 && g.playerBoostActive === 0;
  const playerBoostActive = !!g && g.playerBoostActive > 0;
  const cpuBoostActive    = !!g && g.cpuBoostActive > 0;
  const playerBoostLift = g ? boostLiftFromTicks(g.playerBoostActive) : 0;
  const cpuBoostLift = g ? boostLiftFromTicks(g.cpuBoostActive) : 0;
  const playerColor = playerBoostReady ? '#FFD700' : '#7A5A00';
  const cpuColor    = '#FFFFFF';

  return (
    <View style={s.root} onLayout={onLayout}>
      <View style={s.center}>
        {phase !== 'gameover' && (
        <View
          ref={frameViewRef}
          style={[s.frame, { width: frameW, height: frameH }]}
        >
          {/* Net */}
          {netDashes}

          {/* Score readout — large faded digits behind play */}
          {showField && (
            <>
              <Text style={[s.scoreTopBig, { fontFamily: MONO }]}>{Math.max(0, -g!.playerScore)}</Text>
              <Text style={[s.scoreBotBig, { fontFamily: MONO }]}>{Math.max(0, g!.playerScore)}</Text>
            </>
          )}

          {/* Electricity border effect */}
          {electricNodes}

          {/* CPU paddle (top) */}
          {showField && cpuBoostActive && (
            <View style={{
              position: 'absolute',
              left: g!.cpuX - paddleW / 2 - 8, top: PADDLE_MARGIN + cpuBoostLift - 6,
              pointerEvents: 'none',
              width: paddleW + 16, height: PADDLE_H + 12,
              backgroundColor: 'rgba(255, 215, 0, 0.30)',
              borderRadius: 4,
            }} />
          )}
          {showField && (
            <View style={{
              position: 'absolute',
              left: g!.cpuX - paddleW / 2, top: PADDLE_MARGIN + cpuBoostLift,
              width: paddleW, height: PADDLE_H,
              backgroundColor: cpuColor,
              ...(Platform.OS === 'android' ? null : {
                boxShadow: cpuBoostActive ? '0px 0px 20px rgba(255, 215, 0, 0.9)' : 'none',
              }),
            }} />
          )}

          {/* Player paddle (bottom) */}
          {showField && playerBoostActive && (
            <View style={{
              position: 'absolute',
              left: g!.playerX - paddleW / 2 - 8,
              top: frameH - PADDLE_MARGIN - PADDLE_H - playerBoostLift - 6,
              pointerEvents: 'none',
              width: paddleW + 16, height: PADDLE_H + 12,
              backgroundColor: 'rgba(255, 215, 0, 0.30)',
              borderRadius: 4,
            }} />
          )}
          {showField && (
            <View style={{
              position: 'absolute',
              left: g!.playerX - paddleW / 2,
              top: frameH - PADDLE_MARGIN - PADDLE_H - playerBoostLift,
              width: paddleW, height: PADDLE_H,
              backgroundColor: playerColor,
              ...(Platform.OS === 'android' ? null : {
                boxShadow: playerBoostActive ? '0px 0px 20px rgba(255, 215, 0, 0.9)' : (playerBoostReady ? '0px 0px 6px rgba(255, 215, 0, 0.35)' : 'none'),
              }),
            }} />
          )}

          {/* Balls */}
          {showField && g!.balls.map((ball, i) => (
            <View key={`ball${i}`} style={{
              position: 'absolute',
              left: ball.x - BALL_SIZE / 2, top: ball.y - BALL_SIZE / 2,
              width: BALL_SIZE, height: BALL_SIZE,
              backgroundColor: '#FFF',
              borderRadius: BALL_SIZE / 2,
            }} />
          ))}

        </View>
        )}

        {/* Touch slider — mobile only, shown during all non-demo/gameover phases
            so the frame size stays stable, interactive only when playing */}
        {Platform.OS !== 'web' && !isDemoLayout && phase !== 'gameover' && (
          <View
            style={[s.sliderBar, { width: frameW, marginTop: 8 }]}
            {...(phase === 'playing' ? panResponder.panHandlers : {})}
          >
            <Text style={[s.sliderHintTop, { fontFamily: MONO }]}>
              TOUCH TO MOVE
            </Text>
            <View style={s.sliderTrack} />
            <Text style={[s.sliderHintBottom, { fontFamily: MONO }]}>
              SINGLE TAP TO BOUNCE
            </Text>
          </View>
        )}
      </View>

      {/* Coin animation — root-level overlay so it always centres on the
          actual screen, not the play frame. */}
      {phase === 'coinanim' && (
        <View style={[s.insertOverlay, { width: area.w, height: area.h }, { pointerEvents: 'none' }]}>
          <Animated.View style={[s.fallingCoin, {
            left: area.w / 2 - 28,
            transform: [{ translateY: coinY }, { scale: coinScale }],
            opacity: coinOpacity,
          }]}>
            <ArcadeCoin size={56} />
          </Animated.View>
        </View>
      )}

      {/* Countdown — root-level overlay so it always centres on the actual
          screen, not the play frame. */}
      {phase === 'countdown' && (
        <View style={[s.countdownOverlay, { width: area.w, height: area.h }, { pointerEvents: 'none' }]}>
          <Animated.Text style={[
            s.countdownText, { fontFamily: MONO },
            { transform: [{ scale: cdScale }], opacity: cdOpacity },
          ]}>
            {countNum === 0 ? 'GO!' : String(countNum)}
          </Animated.Text>
        </View>
      )}

      {/* Game over — root-level overlay so it covers the entire safe area,
          not just the play frame. */}
      {phase === 'gameover' && (
        <View style={[s.gameOverOverlay, { width: area.w, height: area.h }]}>
          <Text style={[
            s.titleText, { fontFamily: MONO },
            playerWon ? { color: '#FFD700' } : { color: '#FFF' },
          ]}>
            {playerWon ? 'YOU WIN!' : 'YOU LOSE'}
          </Text>
          {playerWon ? (
            <>
              <Text style={[s.finalScore, { fontFamily: MONO }]}>
                {g?.sessionScore ?? 0}
              </Text>
              <Text style={[s.hiLabel, { fontFamily: MONO, marginTop: -8 }]}>
                SCORE
              </Text>
              {newHS && (
                <Text style={[s.newHsText, { fontFamily: MONO }]}>NEW HIGH SCORE!</Text>
              )}
            </>
          ) : (
            <Text style={[s.hiLabel, { fontFamily: MONO, color: '#888', marginTop: 4 }]}>
              WIN TO REGISTER A VALID SCORE!
            </Text>
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

      {/* Title + INSERT COIN — positioned in the reserved space ABOVE and
          BELOW the frame, mirroring Tetris/Snake. */}
      {isDemoLayout && (
        <>
          <View style={[s.overlayTop, { height: DEMO_RESERVE_TOP }, { pointerEvents: 'box-none' }]}>
            <Text style={[s.titleText, { fontFamily: MONO }]}>PONG</Text>
            <Text style={[s.hiLabel, { fontFamily: MONO }]}>
              HIGH SCORE   {highScore}
            </Text>
          </View>
          <View style={[s.overlayBottom, { height: DEMO_RESERVE_BOTTOM }, { pointerEvents: 'box-none' }]}>
            <Pressable
              onPress={handleInsertCoin}
              style={[s.menuBtn, coins === 0 && !isSubscribed && s.menuBtnNoCoins]}
            >
              <Text style={[s.menuBtnTxt, { fontFamily: MONO }]}>
                {(coins > 0 || isSubscribed) ? 'INSERT COIN' : 'GET COINS'}
              </Text>
            </Pressable>
            <View style={s.controlsInline}>
              <GameControlsInfo
                gameTitle="PONG"
                mobileControls={[
                  { keyText: 'TOUCH + DRAG', actionText: 'Move your paddle left and right.' },
                  { keyText: 'SINGLE TAP', actionText: 'Trigger a BOOST smash.' },
                ]}
                webControls={[
                  { keyText: 'MOUSE MOVE', actionText: 'Move your paddle.' },
                  { keyText: 'CLICK / SHIFT / W', actionText: 'Trigger a BOOST smash.' },
                ]}
              />
            </View>
          </View>
        </>
      )}

      {/* Give up button (mobile) */}
      {Platform.OS !== 'web' && phase === 'playing' && (
        <Pressable
          onPress={() => { const g = gsRef.current; if (g) finishRun(g, false); }}
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

      {/* Centred score HUD — same row as GIVE UP button */}
      {phase === 'playing' && g && (
        <View style={[s.scoreHud, { pointerEvents: 'none' }]}>
          <View style={s.scoreHudRow}>
            <View style={s.hudBlock}>
              <Text style={[s.hudLabel, { fontFamily: MONO }]}>SCORE</Text>
              <View style={s.hudValueSlot}>
                <Text style={[s.hudValue, { fontFamily: MONO }]}>{g.sessionScore}</Text>
              </View>
            </View>
            <View style={s.hudBlock}>
              <Text style={[s.hudLabel, { fontFamily: MONO }]}>ROUND WINS</Text>
              <View style={s.hudValueSlot}>
                <View style={s.roundWinsRow}>
                  {[0, 1, 2].map(i => (
                  <View key={`hud-mp${i}`} style={[
                    s.roundDot,
                    { backgroundColor: i < g.matchPlayerWins ? '#FFD700' : '#2A2A2A' },
                  ]} />
                  ))}
                  <View style={{ width: 16 }} />
                  {[0, 1, 2].map(i => (
                  <View key={`hud-mc${i}`} style={[
                    s.roundDot,
                    { backgroundColor: i < g.matchCpuWins ? '#FFFFFF' : '#2A2A2A' },
                  ]} />
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Mobile BOOST button removed — boost is activated by tapping the slider button */}
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

  overlayTop:    { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 30 },
  overlayBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 20 },

  titleText: {
    color: '#FFF', fontSize: 36, fontWeight: '800', letterSpacing: 10,
  },
  hiLabel: {
    color: '#FFD700', fontSize: 14, letterSpacing: 1,
  },
  controlsInline: {
    marginTop: 2,
  },
  menuBtn: {
    borderWidth: 1.5, borderColor: '#B8860B',
    backgroundColor: '#FFD700',
    paddingHorizontal: 24, paddingVertical: 12,
  },
  menuBtnNoCoins: { backgroundColor: '#555', borderColor: '#333' },
  menuBtnTxt: { color: '#000', fontSize: 13, letterSpacing: 4, fontWeight: '800' },

  insertOverlay: { position: 'absolute', top: 0, left: 0, zIndex: 30 },
  fallingCoin: {
    position: 'absolute', top: 0,
    width: 56, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },

  countdownOverlay: {
    position: 'absolute', top: 0, left: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 40,
  },
  countdownText: {
    color: '#FFF', fontSize: 84, fontWeight: '900', letterSpacing: 8,
  },

  gameOverOverlay: {
    position: 'absolute', top: 0, left: 0,
    backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center', gap: 16,
    zIndex: 50,
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

  liveScore: {
    position: 'absolute', top: 8, right: 10,
    color: 'rgba(255,215,0,0.80)', fontSize: 13, fontWeight: '700', letterSpacing: 2,
  },

  scoreHud: {
    position: 'absolute', top: 10, left: 0, right: 0,
    alignItems: 'center', zIndex: 15,
  },
  scoreHudRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 30 },
  hudBlock: { alignItems: 'center' },
  hudLabel: { color: '#7A6000', fontSize: 9, letterSpacing: 3 },
  hudValue: { color: '#FFD700', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  hudValueSlot: { height: 22, justifyContent: 'center' },
  roundWinsRow: { flexDirection: 'row', alignItems: 'center' },
  roundDot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 3 },

  sliderBar: {
    height: 68,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#252525',
    backgroundColor: '#050505',
    borderRadius: 2,
    paddingHorizontal: 10,
    overflow: 'visible',
  },
  sliderTrack: {
    height: 0,
    borderTopWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  sliderHintTop: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#6C6C6C',
    fontSize: 10,
    letterSpacing: 2,
  },
  sliderHintBottom: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#6C6C6C',
    fontSize: 10,
    letterSpacing: 1.5,
  },
});
