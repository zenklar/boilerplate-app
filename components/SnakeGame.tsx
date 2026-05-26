import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform, LayoutChangeEvent, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useSnakeStore } from '../store/snakeStore';
import { useCoinStore } from '../store/coinStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { usePerformanceStore } from '../store/performanceStore';
import ArcadeCoin from './ArcadeCoin';
import { fitPreview } from './game/previewFrame';
import GameControlsInfo from './game/GameControlsInfo';
import {
  playShoot, playCoinInsert, playCountdownBeep, playCountdownGo, playShipDestroyed,
} from '../utils/sounds';

// ── Board dimensions ───────────────────────────────────────────────────────
const BOARD_W = 14;
const BOARD_H = 25;
const BASE_SIM_FPS = 60;
const SCORE_PER_FOOD = 10;
const FOOD_PER_LEVEL = 5;

/** Number of 16ms ticks between snake steps. Decreases with level. */
function MOVE_FRAMES(level: number): number {
  return Math.max(4, 13 - (level - 1));
}
const DEMO_MOVE_FRAMES = 9;

// ── Pixel-art color palette ────────────────────────────────────────────────
const SNAKE_BODY = '#4ED31F';
const SNAKE_HEAD = '#8FFF44';
const FOOD_COLOR = '#FF3333';
const BG_COLOR   = '#000';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const CTRL_H = Platform.OS === 'web' ? 0 : 120;

// ── Types ──────────────────────────────────────────────────────────────────
type Dir = 'up' | 'down' | 'left' | 'right';
type Phase = 'idle' | 'demo' | 'coinanim' | 'countdown' | 'playing' | 'gameover';
type Point = { x: number; y: number };

type GS = {
  snake: Point[];
  dir: Dir;
  food: Point;
  score: number;
  foodEaten: number;
  level: number;
  moveAccum: number;
  startTime: number;
};

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};
const DELTAS: Record<Dir, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function initialSnake(): Point[] {
  const cx = Math.floor(BOARD_W / 2);
  const cy = Math.floor(BOARD_H / 2);
  return [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
}

function randomFood(snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  for (let attempt = 0; attempt < 500; attempt++) {
    const x = Math.floor(Math.random() * BOARD_W);
    const y = Math.floor(Math.random() * BOARD_H);
    if (!occupied.has(`${x},${y}`)) return { x, y };
  }
  // Deterministic fallback — board is nearly full
  for (let y = 0; y < BOARD_H; y++) {
    for (let x = 0; x < BOARD_W; x++) {
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

/** Simple greedy demo AI — moves toward food, avoids walls/self. */
function demoAI(g: GS): Dir {
  const head = g.snake[0];
  const occupied = new Set(g.snake.map((p) => `${p.x},${p.y}`));
  const dirs: Dir[] = ['up', 'down', 'left', 'right'];

  const safe = dirs.filter((d) => {
    if (d === OPPOSITE[g.dir]) return false;
    // Walls wrap, so only block on self-collision
    const nx = (head.x + DELTAS[d].x + BOARD_W) % BOARD_W;
    const ny = (head.y + DELTAS[d].y + BOARD_H) % BOARD_H;
    return !occupied.has(`${nx},${ny}`);
  });

  if (safe.length === 0) return g.dir;

  // Sort by wrapped Manhattan distance to food (closest first)
  safe.sort((a, b) => {
    const ax = (head.x + DELTAS[a].x + BOARD_W) % BOARD_W;
    const ay = (head.y + DELTAS[a].y + BOARD_H) % BOARD_H;
    const bx = (head.x + DELTAS[b].x + BOARD_W) % BOARD_W;
    const by = (head.y + DELTAS[b].y + BOARD_H) % BOARD_H;
    const da = Math.min(Math.abs(ax - g.food.x), BOARD_W - Math.abs(ax - g.food.x))
             + Math.min(Math.abs(ay - g.food.y), BOARD_H - Math.abs(ay - g.food.y));
    const db = Math.min(Math.abs(bx - g.food.x), BOARD_W - Math.abs(bx - g.food.x))
             + Math.min(Math.abs(by - g.food.y), BOARD_H - Math.abs(by - g.food.y));
    return da - db;
  });
  return safe[0];
}

// ── Sub-components ─────────────────────────────────────────────────────────
// Memoized so unchanged segments don't reconcile on every step.
const SnakeCell = React.memo(function SnakeCell({ size, isHead }: { size: number; isHead: boolean }) {
  const color = isHead ? SNAKE_HEAD : SNAKE_BODY;
  const b = Math.max(1, Math.floor(size * 0.15));
  return (
    <View style={{
      width: size, height: size,
      backgroundColor: color,
      borderTopWidth: b,    borderTopColor: 'rgba(255,255,255,0.40)',
      borderLeftWidth: b,   borderLeftColor: 'rgba(255,255,255,0.25)',
      borderBottomWidth: b, borderBottomColor: 'rgba(0,0,0,0.40)',
      borderRightWidth: b,  borderRightColor: 'rgba(0,0,0,0.25)',
    }} />
  );
});

const FoodCell = React.memo(function FoodCell({ size }: { size: number }) {
  const inset = Math.max(2, Math.floor(size * 0.22));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size - inset * 2, height: size - inset * 2,
        backgroundColor: FOOD_COLOR,
      }} />
    </View>
  );
});

/** Static grid lines — same on every frame so we memoise the whole subtree.
 *  Mirrors the BoardGrid optimisation in Tetris. */
const SnakeGrid = React.memo(function SnakeGrid({ cell, cellsW, cellsH }: { cell: number; cellsW: number; cellsH: number }) {
  const lines: React.ReactNode[] = [];
  for (let i = 1; i < BOARD_W; i++) {
    lines.push(
      <View key={`v${i}`} style={{
        position: 'absolute', left: i * cell, top: 0,
        width: 1, height: cellsH, backgroundColor: '#101010',
      }} />
    );
  }
  for (let i = 1; i < BOARD_H; i++) {
    lines.push(
      <View key={`h${i}`} style={{
        position: 'absolute', top: i * cell, left: 0,
        height: 1, width: cellsW, backgroundColor: '#101010',
      }} />
    );
  }
  return <>{lines}</>;
});

// ── Main component ─────────────────────────────────────────────────────────
export default function SnakeGame() {
  const [, setTick] = useState(0);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>('idle');
  const [countNum, setCountNum] = useState(3);
  const [newHS, setNewHS] = useState(false);

  const coinY       = useRef(new Animated.Value(-60)).current;
  const coinScale   = useRef(new Animated.Value(0.5)).current;
  const coinOpacity = useRef(new Animated.Value(0)).current;
  const cdScale     = useRef(new Animated.Value(1)).current;
  const cdOpacity   = useRef(new Animated.Value(0)).current;

  const highScore       = useSnakeStore((s) => s.highScore);
  const updateHighScore = useSnakeStore((s) => s.updateHighScore);
  const loadHighScore   = useSnakeStore((s) => s.loadHighScore);
  const addRun          = useSnakeStore((s) => s.addRun);
  const loadRuns        = useSnakeStore((s) => s.loadRuns);
  const setIsGamePlaying = useSnakeStore((s) => s.setIsGamePlaying);

  const coins      = useCoinStore((s) => s.coins);
  const spendCoin  = useCoinStore((s) => s.spendCoin);
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const fpsCap = usePerformanceStore((s) => s.fpsCap);
  const effectsBudget = usePerformanceStore((s) => s.adaptiveEffectsBudget);
  const setAdaptiveEffectsBudget = usePerformanceStore((s) => s.setAdaptiveEffectsBudget);

  const gsRef       = useRef<GS | null>(null);
  /** Buffered directional input (max 2 queued ahead). */
  const dirQueue    = useRef<Dir[]>([]);
  const effectsBudgetRef = useRef(1);
  const eatSfxGateRef = useRef(0);

  useEffect(() => {
    loadHighScore(); loadRuns();
    useCoinStore.getState().loadCoins();
    useSubscriptionStore.getState().loadSubscription();
    usePerformanceStore.getState().load();
  }, []);

  useEffect(() => {
    effectsBudgetRef.current = effectsBudget;
  }, [effectsBudget]);

  // Boot the demo when returning to idle.
  useEffect(() => {
    if (phase === 'idle' && !gsRef.current) startDemo();
  }, [phase]);

  /* ── Keyboard controls (web) ─────────────────────────────────────────── */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && phase === 'playing') { gameOver(); return; }
      if (phase !== 'playing') return;
      let d: Dir | null = null;
      switch (e.code) {
        case 'ArrowUp':    case 'KeyW': d = 'up';    break;
        case 'ArrowDown':  case 'KeyS': d = 'down';  break;
        case 'ArrowLeft':  case 'KeyA': d = 'left';  break;
        case 'ArrowRight': case 'KeyD': d = 'right'; break;
      }
      if (d) { e.preventDefault(); enqueueDir(d); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase]);

  function enqueueDir(d: Dir) {
    const q = dirQueue.current;
    if (q.length >= 2) return;
    const g = gsRef.current;
    const last = q.length > 0 ? q[q.length - 1] : (g?.dir ?? 'right');
    if (d === last || d === OPPOSITE[last]) return;
    q.push(d);
  }

  /* ── Game loop ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const tickMs = 1000 / fpsCap;
    const stepMul = BASE_SIM_FPS / fpsCap;
    let lastTickTs = Date.now();
    let budgetSampleMs = 0;

    const scoreBudgetFromFrame = (frameMs: number) => {
      const ratio = frameMs / tickMs;
      if (ratio <= 1.05) return 1;
      if (ratio <= 1.2) return 0.85;
      if (ratio <= 1.45) return 0.65;
      return 0.45;
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

      if (phase !== 'playing' && phase !== 'demo') return;
      const g = gsRef.current;
      if (!g) return;
      const isDemo = phase === 'demo';

      g.moveAccum += stepMul;
      const frames = isDemo ? DEMO_MOVE_FRAMES : MOVE_FRAMES(g.level);
      if (g.moveAccum < frames) return;
      g.moveAccum = 0;

      // Resolve next direction
      if (isDemo) {
        g.dir = demoAI(g);
      } else if (dirQueue.current.length > 0) {
        g.dir = dirQueue.current.shift()!;
      }

      const head = g.snake[0];
      const d = DELTAS[g.dir];
      // Wrap around walls Nokia-style — exiting one side re-enters the other.
      const newHead = {
        x: (head.x + d.x + BOARD_W) % BOARD_W,
        y: (head.y + d.y + BOARD_H) % BOARD_H,
      };

      // Self collision — the tail will be removed so exclude last segment
      const bodyCheck = g.snake.slice(0, g.snake.length - 1);
      if (bodyCheck.some((p) => p.x === newHead.x && p.y === newHead.y)) {
        if (isDemo) { resetDemoState(); }
        else { gameOver(); }
        setTick((t) => t + 1);
        return;
      }

      // Eat food or slide
      const ateFood = newHead.x === g.food.x && newHead.y === g.food.y;
      if (ateFood) {
        g.snake = [newHead, ...g.snake]; // grow by 1
        g.foodEaten++;
        if (!isDemo) {
          g.score += SCORE_PER_FOOD * g.level;
          if (g.foodEaten % FOOD_PER_LEVEL === 0) g.level++;
          const fx = Platform.OS === 'web' ? 1 : effectsBudgetRef.current;
          const cadence = fx >= 0.85 ? 1 : fx >= 0.65 ? 2 : 3;
          eatSfxGateRef.current = (eatSfxGateRef.current + 1) % cadence;
          if (eatSfxGateRef.current === 0) playShoot();
        }
        g.food = randomFood(g.snake);
      } else {
        g.snake = [newHead, ...g.snake.slice(0, g.snake.length - 1)];
      }

      setTick((t) => t + 1);
    }, tickMs);
    return () => clearInterval(id);
  }, [phase, fpsCap]);

  /* ── State helpers ───────────────────────────────────────────────────── */
  function makeInitialState(): GS {
    const snake = initialSnake();
    return {
      snake,
      dir: 'right',
      food: randomFood(snake),
      score: 0,
      foodEaten: 0,
      level: 1,
      moveAccum: 0,
      startTime: Date.now(),
    };
  }

  function resetDemoState() {
    gsRef.current = makeInitialState();
  }

  function gameOver() {
    const g = gsRef.current; if (!g) return;
    const isNewHS = g.score > useSnakeStore.getState().highScore;
    setNewHS(isNewHS);
    updateHighScore(g.score);
    addRun({
      id: String(Date.now()),
      score: g.score,
      foodEaten: g.foodEaten,
      level: g.level,
      durationMs: Date.now() - g.startTime,
      date: Date.now(),
    });
    playShipDestroyed();
    setPhase('gameover');
    // Keep isGamePlaying TRUE through the game-over screen so the GameShell
    // chrome (header + nav) stays hidden — the game-over overlay should be
    // the only thing on screen. It only flips back to false when the user
    // taps MENU (handleBackToMenu).
  }

  function startFreshGame() {
    gsRef.current = makeInitialState();
    dirQueue.current = [];
    setIsGamePlaying(true);
    setPhase('playing');
  }

  function startDemo() {
    gsRef.current = makeInitialState();
    setPhase('demo');
  }

  /* ── Coin → countdown → start flow ──────────────────────────────────── */
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
    dirQueue.current = [];
    runCoinAnimation();
  }, [isSubscribed, coins, spendCoin, runCoinAnimation]);

  const handleBackToMenu = useCallback(() => {
    gsRef.current = null;
    setIsGamePlaying(false);
    setNewHS(false);
    setPhase('idle');
  }, []);

  /* ── Layout calculations ─────────────────────────────────────────────── */
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  };

  const isDemoLayout = phase === 'idle' || phase === 'demo';
  const demoReserveTop    = 160;
  const demoReserveBottom = 150;
  const playableH  = area.h - CTRL_H;
  const reservedH  = isDemoLayout ? demoReserveTop + demoReserveBottom : 50;
  // Demo / idle uses the shared preview-frame size (same on every game);
  // gameplay uses the natural cell grid filling the available area.
  // Use full area.h for the demo preview (controls aren't shown then) so the
  // preview matches Asteroids which measures its gameArea without CTRL_H.
  const preview = fitPreview(area.w, isDemoLayout ? area.h : playableH);
  const maxByW = (isDemoLayout ? preview.w : area.w) / BOARD_W;
  const maxByH = (isDemoLayout ? preview.h : playableH - reservedH) / BOARD_H;
  const CELL       = Math.max(8, Math.floor(Math.min(maxByW, maxByH)));
  const cellsW     = CELL * BOARD_W;
  const cellsH     = CELL * BOARD_H;
  // Outer board: shared preview size on idle, exact cell grid on play.
  const boardPxW   = isDemoLayout ? preview.w : cellsW;
  const boardPxH   = isDemoLayout ? preview.h : cellsH;
  const cellsOffsetX = Math.floor((boardPxW - cellsW) / 2);
  const cellsOffsetY = Math.floor((boardPxH - cellsH) / 2);
  // Horizontal inset so the controls overlay matches the board width exactly.
  const ctrlInset = Platform.OS !== 'web' && !isDemoLayout && cellsW > 0
    ? Math.max(0, Math.floor((area.w - cellsW) / 2))
    : 0;

  const g         = gsRef.current;
  // During game-over, render NOTHING behind the overlay so the game-over
  // screen is the only thing visible. Web absolute-positioned overlays cover
  // siblings reliably; Android new-arch sometimes doesn't, hence belt and
  // braces — skip the board/snake entirely.
  const showBoard = !!(g && (phase === 'playing' || phase === 'demo'));

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <View style={s.root} onLayout={onLayout}>

      {/* ── Game area ── */}
      <View style={[
        s.gameArea,
        {
          paddingTop: isDemoLayout ? demoReserveTop : 0,
          paddingBottom: isDemoLayout ? demoReserveBottom : (Platform.OS !== 'web' ? CTRL_H : 0),
          justifyContent: isDemoLayout ? 'center' : 'flex-end',
        },
      ]}>

        {/* Score HUD (visible during active play) */}
        {!isDemoLayout && phase !== 'gameover' && (
          <View style={s.scoreHud}>
            <View style={s.hudItem}>
              <Text style={[s.hudLabel, { fontFamily: MONO }]}>SCORE</Text>
              <Text style={[s.hudValue, { fontFamily: MONO }]}>
                {g ? String(g.score).padStart(5, '0') : '00000'}
              </Text>
            </View>
            <View style={s.hudItem}>
              <Text style={[s.hudLabel, { fontFamily: MONO }]}>LEVEL</Text>
              <Text style={[s.hudValue, { fontFamily: MONO }]}>{g ? g.level : 1}</Text>
            </View>
            <View style={s.hudItem}>
              <Text style={[s.hudLabel, { fontFamily: MONO }]}>FOOD</Text>
              <Text style={[s.hudValue, { fontFamily: MONO }]}>{g ? g.foodEaten : 0}</Text>
            </View>
          </View>
        )}

        {/* Board — hidden during gameover so only the overlay shows */}
        {phase !== 'gameover' && (
        <View style={[s.board, { width: boardPxW, height: boardPxH }]}>

          {/* Inner cell-grid wrapper — centred inside the outer preview
              frame on idle (zero offset during play). */}
          <View style={{
            position: 'absolute',
            left: cellsOffsetX, top: cellsOffsetY,
            width: cellsW, height: cellsH,
          }}>

          {/* Grid lines — memoized so they don't reconcile on every snake step */}
          {effectsBudget >= 0.55 && <SnakeGrid cell={CELL} cellsW={cellsW} cellsH={cellsH} />}

          {/* Food pellet */}
          {showBoard && (
            <View style={{
              position: 'absolute',
              left: g!.food.x * CELL,
              top:  g!.food.y * CELL,
            }}>
              <FoodCell size={CELL} />
            </View>
          )}

          {/* Snake segments */}
          {showBoard && g!.snake.map((seg, i) => (
            <View key={`seg-${i}`} style={{
              position: 'absolute',
              left: seg.x * CELL,
              top:  seg.y * CELL,
            }}>
              <SnakeCell size={CELL} isHead={i === 0} />
            </View>
          ))}
          </View>
        </View>
        )}
      </View>

      {/* ── Title / demo overlay ── */}
      {(phase === 'idle' || phase === 'demo') && (
        <>
          <View style={[s.overlayTop, { pointerEvents: 'box-none' }]}>
            <Text style={[s.titleText, { fontFamily: MONO }]}>SNAKE</Text>
            <Text style={[s.hiLabel, { fontFamily: MONO }]}>
              HIGH SCORE   {highScore}
            </Text>
          </View>
          <View style={[s.overlayBottom, { pointerEvents: 'box-none' }]}>
            <Pressable
              onPress={handleInsertCoin}
              style={[s.menuBtn, coins === 0 && s.menuBtnNoCoins]}
            >
              <Text style={[s.menuBtnTxt, { fontFamily: MONO }]}>
                {coins > 0 ? 'INSERT COIN' : 'GET COINS'}
              </Text>
            </Pressable>
            <View style={s.controlsInline}>
              <GameControlsInfo
                gameTitle="SNAKE"
                mobileControls={[
                  { keyText: 'ON-SCREEN ARROWS', actionText: 'Tap to change direction.' },
                ]}
                webControls={[
                  { keyText: 'ARROW KEYS', actionText: 'Steer the snake.' },
                  { keyText: 'WASD', actionText: 'Alternative steering keys.' },
                ]}
              />
            </View>
          </View>
        </>
      )}

      {/* ── Coin insert animation ── */}
      {phase === 'coinanim' && (
        <View style={[s.insertOverlay, { width: area.w, height: area.h }, { pointerEvents: 'none' }]}>
          <Animated.View style={[
            s.fallingCoin,
            {
              left: area.w / 2 - 28,
              transform: [{ translateY: coinY }, { scale: coinScale }],
              opacity: coinOpacity,
            },
          ]}>
            <ArcadeCoin size={56} />
          </Animated.View>
        </View>
      )}

      {/* ── Countdown ── */}
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

      {/* ── Game Over ── */}
      {phase === 'gameover' && (
        <View style={[s.gameOverOverlay, { width: area.w, height: area.h }]}>
          <Text style={[s.titleText, { fontFamily: MONO }]}>GAME OVER</Text>
          <Text style={[s.finalScore, { fontFamily: MONO }]}>{g?.score ?? 0}</Text>
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
        </View>
      )}

      {/* Give up button (mobile) */}
      {Platform.OS !== 'web' && phase === 'playing' && (
        <Pressable
          onPress={gameOver}
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

      {/* ── Mobile arrow controls ── */}
      {Platform.OS !== 'web' && phase === 'playing' && (
        <View style={[s.ctrlOverlay, { left: ctrlInset, right: ctrlInset }]}>
          <View style={s.ctrlRow}>
            <Pressable style={s.ctrlBtn} onPress={() => enqueueDir('left')}>
              <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>◀</Text>
            </Pressable>
            <View style={s.ctrlCenter}>
              <Pressable style={s.ctrlBtn} onPress={() => enqueueDir('up')}>
                <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>▲</Text>
              </Pressable>
              <Pressable style={s.ctrlBtn} onPress={() => enqueueDir('down')}>
                <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>▼</Text>
              </Pressable>
            </View>
            <Pressable style={s.ctrlBtn} onPress={() => enqueueDir('right')}>
              <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>▶</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_COLOR },

  gameArea: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end',
  },

  board: {
    backgroundColor: '#050505',
    borderWidth: 2, borderColor: '#222',
    position: 'relative',
  },

  scoreHud: {
    flexDirection: 'row', gap: 28, marginBottom: 10, paddingHorizontal: 4,
  },
  hudItem: { alignItems: 'center', gap: 2 },
  hudLabel: { color: '#2D6010', fontSize: 9, letterSpacing: 2 },
  hudValue: { color: '#4ED31F', fontSize: 16, fontWeight: '700', letterSpacing: 1 },

  overlayTop: {
    position: 'absolute', top: 40, left: 0, right: 0,
    alignItems: 'center', gap: 10,
  },
  overlayBottom: {
    position: 'absolute', bottom: 50, left: 0, right: 0,
    alignItems: 'center', gap: 10,
  },

  titleText: {
    color: '#FFF', fontSize: 34, fontWeight: '800', letterSpacing: 10,
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
    color: '#FFF', fontSize: 96, fontWeight: '900', letterSpacing: 8,
  },

  gameOverOverlay: {
    position: 'absolute', top: 0, left: 0,
    backgroundColor: BG_COLOR,
    justifyContent: 'center', alignItems: 'center', gap: 18,
    zIndex: 50,
  },
  finalScore: { color: '#FFF', fontSize: 52, fontWeight: '700', letterSpacing: 6 },
  newHsText:  { color: '#FFD700', fontSize: 15, fontWeight: '700', letterSpacing: 3 },
  btnRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  goBtn: {
    borderWidth: 2, borderColor: '#FFF',
    paddingHorizontal: 28, paddingVertical: 14,
    minWidth: 130, alignItems: 'center',
  },
  goBtnTxt:           { color: '#FFF', fontSize: 14, letterSpacing: 4 },
  goBtnSecondary:     { borderColor: '#666' },
  goBtnSecondaryTxt:  { color: '#999' },

  // Mobile arrow controls
  ctrlOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: CTRL_H,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 6,
  },
  ctrlRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  ctrlBtn: {
    flex: 1,
    borderWidth: 1.5, borderColor: '#333',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlCenter: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
  },
  ctrlBtnTxt: { color: '#EEE', fontSize: 28, fontWeight: '700' },
});
