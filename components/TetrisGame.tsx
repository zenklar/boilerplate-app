import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform, LayoutChangeEvent, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useTetrisStore } from '../store/tetrisStore';
import { useCoinStore } from '../store/coinStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import ArcadeCoin from './ArcadeCoin';
import { fitPreview } from './game/previewFrame';
import GameControlsInfo from './game/GameControlsInfo';
import {
  TETROMINOS, TETROMINO_COLORS, TETROMINO_TYPES,
  TetrominoType, BOARD_W, BOARD_H, LINE_SCORE, DROP_FRAMES_PER_LEVEL,
} from '../constants/tetris';
import { playShoot, playExplosion, playCoinInsert, playCountdownBeep, playCountdownGo, playShipDestroyed } from '../utils/sounds';

/** Classic arcade-style block in a single View: solid color with asymmetric
 *  borders for the highlight/shadow bevel. One View per cell beats stacking
 *  five overlay Views — matters when the board fills up. Memoized so that
 *  unchanged locked cells don't reconcile on every gravity tick. */
const PixelBlock = React.memo(function PixelBlock({ size, color }: { size: number; color: string }) {
  const b = Math.max(2, Math.floor(size * 0.18));
  return (
    <View style={{
      width: size, height: size,
      backgroundColor: color,
      borderStyle: 'solid',
      borderTopWidth: b, borderTopColor: 'rgba(255,255,255,0.45)',
      borderLeftWidth: b, borderLeftColor: 'rgba(255,255,255,0.28)',
      borderBottomWidth: b, borderBottomColor: 'rgba(0,0,0,0.45)',
      borderRightWidth: b, borderRightColor: 'rgba(0,0,0,0.28)',
    }} />
  );
});

/** Locked-board layer: re-renders only when the board array reference changes
 *  (on piece lock or line clear). Most frames just move the active piece, so
 *  skipping this layer's reconcile is the single biggest perf win on Android. */
const LockedBoard = React.memo(function LockedBoard({ board, cell }: { board: Cell[][]; cell: number }) {
  const out: React.ReactNode[] = [];
  for (let y = 0; y < board.length; y++) {
    const row = board[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (!c) continue;
      out.push(
        <View key={`f-${y}-${x}`} style={{
          position: 'absolute',
          left: x * cell, top: y * cell,
        }}>
          <PixelBlock size={cell} color={TETROMINO_COLORS[c]} />
        </View>
      );
    }
  }
  return <>{out}</>;
});

const BoardGrid = React.memo(function BoardGrid({ cell }: { cell: number }) {
  const lines: React.ReactNode[] = [];
  for (let x = 1; x < BOARD_W; x++) {
    lines.push(
      <View key={`v${x}`} style={{
        position: 'absolute', left: x * cell, top: 0,
        width: 1, height: BOARD_H * cell, backgroundColor: '#101010',
      }} />
    );
  }
  for (let y = 1; y < BOARD_H; y++) {
    lines.push(
      <View key={`h${y}`} style={{
        position: 'absolute', left: 0, top: y * cell,
        width: BOARD_W * cell, height: 1, backgroundColor: '#101010',
      }} />
    );
  }
  return <>{lines}</>;
});

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const TICK_MS = 16;
const SOFT_DROP_DIVISOR = 6; // soft drop falls this many cells per gravity tick
const LOCK_DELAY_FRAMES = 30;
const NEXT_QUEUE_LEN = 3;
const CTRL_H = Platform.OS === 'web' ? 0 : 120;
const HUD_H = Platform.OS === 'web' ? 0 : 58;

type Phase = 'idle' | 'demo' | 'coinanim' | 'countdown' | 'playing' | 'gameover';
type Cell = TetrominoType | null;
type Active = { type: TetrominoType; rot: number; x: number; y: number };

type GS = {
  board: Cell[][];
  active: Active | null;
  nextQueue: TetrominoType[];
  bag: TetrominoType[];
  score: number;
  lines: number;
  level: number;
  dropAccum: number;
  lockTimer: number;
  startTime: number;
  topOut: boolean;
  // Line-clear flash: the rows about to vanish stay highlighted for a short
  // window before the board collapses. Cheaper than a particle system and
  // gives a strong arcade "pop".
  flashRows: number[];
  flashTimer: number;
  // Demo-only: AI target for the active piece, plus a tick countdown that
  // throttles how often the AI moves/rotates so the preview is watchable.
  demoTarget: { x: number; rot: number } | null;
  demoStepCD: number;
};

const FLASH_FRAMES = 12;

// How many ticks (16ms each) between AI actions in the title-screen demo.
// Higher = slower preview. Bumped to ~7 frames/step + a longer pause after
// each piece locks.
const DEMO_STEP_INTERVAL = 7;
const DEMO_LOCK_PAUSE = 30;
const DEMO_GRAVITY = 16;

let _nid = 1;
const uid = () => _nid++;
const rand = (a: number, b: number) => Math.random() * (b - a) + a;

const shape = (a: Active) => TETROMINOS[a.type][a.rot % TETROMINOS[a.type].length];

function emptyBoard(): Cell[][] {
  return Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill(null));
}

function collides(board: Cell[][], a: Active): boolean {
  const m = shape(a);
  for (let dy = 0; dy < m.length; dy++) {
    for (let dx = 0; dx < m[dy].length; dx++) {
      if (!m[dy][dx]) continue;
      const x = a.x + dx, y = a.y + dy;
      if (x < 0 || x >= BOARD_W || y >= BOARD_H) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
}

function place(board: Cell[][], a: Active): Cell[][] {
  const next = board.map((r) => r.slice());
  const m = shape(a);
  for (let dy = 0; dy < m.length; dy++) {
    for (let dx = 0; dx < m[dy].length; dx++) {
      if (m[dy][dx] && a.y + dy >= 0) next[a.y + dy][a.x + dx] = a.type;
    }
  }
  return next;
}

function clearFull(board: Cell[][]): { board: Cell[][]; cleared: number } {
  const keep = board.filter((row) => row.some((c) => c === null));
  const cleared = BOARD_H - keep.length;
  while (keep.length < BOARD_H) keep.unshift(Array(BOARD_W).fill(null));
  return { board: keep, cleared };
}

function refillBag(bag: TetrominoType[]): TetrominoType[] {
  if (bag.length > 0) return bag;
  const next = [...TETROMINO_TYPES];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function spawnActive(type: TetrominoType): Active {
  const m = TETROMINOS[type][0];
  const w = m[0].length;
  return { type, rot: 0, x: Math.floor((BOARD_W - w) / 2), y: type === 'I' ? -1 : 0 };
}

function ghostY(board: Cell[][], a: Active): number {
  let g = { ...a };
  while (!collides(board, { ...g, y: g.y + 1 })) g.y++;
  return g.y;
}

function fillQueueFromBag(queue: TetrominoType[], bag: TetrominoType[]): {
  queue: TetrominoType[]; bag: TetrominoType[];
} {
  let q = [...queue], b = [...bag];
  while (q.length < NEXT_QUEUE_LEN) {
    b = refillBag(b);
    q.push(b.shift()!);
  }
  return { queue: q, bag: b };
}

/** Pick a random valid (x, rot) landing target for the demo AI. */
function pickDemoTarget(g: GS): { x: number; rot: number } {
  if (!g.active) return { x: 0, rot: 0 };
  const a = g.active;
  const rots = TETROMINOS[a.type].length;
  for (let attempt = 0; attempt < 30; attempt++) {
    const rot = Math.floor(Math.random() * rots);
    const m = TETROMINOS[a.type][rot];
    const w = m[0].length;
    const x = Math.floor(Math.random() * (BOARD_W - w + 1));
    if (!collides(g.board, { ...a, rot, x, y: a.y })) return { x, rot };
  }
  return { x: a.x, rot: a.rot };
}

export default function TetrisGame() {
  const [, setTick] = useState(0);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>('idle');
  const [countNum, setCountNum] = useState(3);
  const [newHS, setNewHS] = useState(false);

  const coinY = useRef(new Animated.Value(-60)).current;
  const coinScale = useRef(new Animated.Value(0.5)).current;
  const coinOpacity = useRef(new Animated.Value(0)).current;
  const cdScale = useRef(new Animated.Value(1)).current;
  const cdOpacity = useRef(new Animated.Value(0)).current;

  const highScore = useTetrisStore((s) => s.highScore);
  const updateHighScore = useTetrisStore((s) => s.updateHighScore);
  const loadHighScore = useTetrisStore((s) => s.loadHighScore);
  const addRun = useTetrisStore((s) => s.addRun);
  const loadRuns = useTetrisStore((s) => s.loadRuns);
  const setIsGamePlaying = useTetrisStore((s) => s.setIsGamePlaying);

  const coins = useCoinStore((s) => s.coins);
  const spendCoin = useCoinStore((s) => s.spendCoin);
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);

  const gsRef = useRef<GS | null>(null);
  const heldRef = useRef<{ down: boolean }>({ down: false });
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHold = (action: () => void) => {
    action();
    holdTimeout.current = setTimeout(() => {
      holdInterval.current = setInterval(action, 80);
    }, 180);
  };

  const stopHold = () => {
    if (holdTimeout.current) { clearTimeout(holdTimeout.current); holdTimeout.current = null; }
    if (holdInterval.current) { clearInterval(holdInterval.current); holdInterval.current = null; }
  };
  // Web-only: tracks the column the mouse is currently over, or null when
  // the mouse is outside the board. Used to steer the active piece.
  const mouseTargetX = useRef<number | null>(null);
  // Board origin in window coords + current cell size, used to map mouse
  // events back to board columns from anywhere on the page.
  const boardOrigin = useRef({ x: 0, y: 0 });
  const cellRef = useRef(0);
  const boardSizeRef = useRef({ w: 0, h: 0 });
  const boardRef = useRef<View>(null);

  useEffect(() => {
    loadHighScore(); loadRuns();
    useCoinStore.getState().loadCoins();
    useSubscriptionStore.getState().loadSubscription();
  }, []);

  // Boot the demo loop on first mount (and whenever we return to the menu).
  useEffect(() => {
    if (phase === 'idle' && !gsRef.current) startDemo();
  }, [phase]);

  /* ── Keyboard controls (web) ── */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && phase === 'playing') { gameOver(); return; }
      if (phase !== 'playing') return;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA':
          if (!e.repeat) tryMove(-1, 0);
          break;
        case 'ArrowRight': case 'KeyD':
          if (!e.repeat) tryMove(1, 0);
          break;
        case 'ArrowDown': case 'KeyS':
          heldRef.current.down = true;
          break;
        case 'ArrowUp': case 'KeyW': case 'KeyX':
          if (!e.repeat) tryRotate(1);
          break;
        case 'KeyZ':
          if (!e.repeat) tryRotate(-1);
          break;
        case 'Space':
          e.preventDefault();
          if (!e.repeat) hardDrop();
          break;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') heldRef.current.down = false;
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onUp);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onUp);
    };
  }, [phase]);

  /* ── Mouse position → board column (web) ── */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMove = (e: MouseEvent) => {
      if (phase !== 'playing') return;
      const cell = cellRef.current;
      if (cell <= 0) return;
      const ox = boardOrigin.current.x;
      const oy = boardOrigin.current.y;
      const { w: bw, h: bh } = boardSizeRef.current;
      const lx = e.clientX - ox;
      const ly = e.clientY - oy;
      // Allow control when mouse is anywhere within (or just outside) the board
      if (lx < -cell || lx > bw + cell || ly < -bh || ly > bh + cell) {
        mouseTargetX.current = null;
      } else {
        mouseTargetX.current = Math.min(BOARD_W - 1, Math.max(0, Math.floor(lx / cell)));
      }
    };
    const onLeave = () => { mouseTargetX.current = null; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [phase]);

  /* ── Game loop ── */
  // Android render-skip — see AsteroidsGame for the rationale. Tetris's
  // locked-board layer is already memoised, but skipping React render on
  // alternate ticks still removes a meaningful chunk of work per second.
  const ANDROID_HALF_RENDER = Platform.OS === 'android';
  const tickFrame = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      if (phase !== 'playing' && phase !== 'demo') return;
      const g = gsRef.current;
      if (!g) return;
      tickFrame.current++;

      const isDemo = phase === 'demo';

      const shouldRender = !ANDROID_HALF_RENDER || (tickFrame.current & 1) === 0;

      // Line-clear flash: hold the cleared rows visible briefly, then collapse.
      if (g.flashTimer > 0) {
        g.flashTimer--;
        if (g.flashTimer === 0) {
          const { board: cleaned } = clearFull(g.board);
          g.board = cleaned;
          g.flashRows = [];
          spawnNext(isDemo);
        }
        if (shouldRender) setTick((t) => t + 1);
        return;
      }

      if (!g.active) { if (shouldRender) setTick((t) => t + 1); return; }

      // Demo AI: rotate toward target, slide toward target x, then drop.
      // Throttled by demoStepCD so the preview is calm and readable.
      if (isDemo) {
        if (g.demoStepCD > 0) {
          g.demoStepCD--;
        } else {
          if (!g.demoTarget) g.demoTarget = pickDemoTarget(g);
          const t = g.demoTarget;
          if (g.active.rot !== t.rot) {
            tryRotate(1);
            g.demoStepCD = DEMO_STEP_INTERVAL;
          } else if (g.active.x < t.x) {
            tryMove(1, 0);
            g.demoStepCD = DEMO_STEP_INTERVAL;
          } else if (g.active.x > t.x) {
            tryMove(-1, 0);
            g.demoStepCD = DEMO_STEP_INTERVAL;
          } else {
            // Aligned — drop to landing, lock, then pause before next piece.
            const dropY = ghostY(g.board, g.active);
            g.active = { ...g.active, y: dropY };
            lockPiece(true);
            g.demoStepCD = DEMO_LOCK_PAUSE;
            if (shouldRender) setTick((tt) => tt + 1);
            return;
          }
        }
      } else if (Platform.OS === 'web' && mouseTargetX.current !== null) {
        // Player steering: snap the piece toward the mouse column this
        // very frame — keep stepping until aligned, blocked, or out of
        // safety budget. Makes mouse control feel instant rather than
        // 1-cell-per-tick laggy.
        let safety = BOARD_W + 2;
        while (safety-- > 0) {
          const a = g.active;
          if (!a) break;
          const m = shape(a);
          const w = m[0].length;
          const center = a.x + Math.floor((w - 1) / 2);
          const want = mouseTargetX.current;
          if (want == null || center === want) break;
          const dir = center < want ? 1 : -1;
          if (!tryMove(dir, 0)) break;
        }
      }

      const gravity = isDemo ? DEMO_GRAVITY : DROP_FRAMES_PER_LEVEL(g.level);
      const effective = !isDemo && heldRef.current.down
        ? Math.max(1, Math.floor(gravity / SOFT_DROP_DIVISOR))
        : gravity;

      g.dropAccum++;
      if (g.dropAccum >= effective) {
        g.dropAccum = 0;
        const moved = { ...g.active, y: g.active.y + 1 };
        if (!collides(g.board, moved)) {
          g.active = moved;
          g.lockTimer = 0;
          if (!isDemo && heldRef.current.down) g.score += 1; // soft drop bonus
        }
      }
      // Lock delay: count raw 16ms ticks while piece rests on a surface.
      // Previously counted gravity cycles (very slow at low levels). Now
      // LOCK_DELAY_FRAMES × 16ms gives a consistent ~480 ms across all levels.
      if (g.active && collides(g.board, { ...g.active, y: g.active.y + 1 })) {
        g.lockTimer++;
        if (g.lockTimer >= LOCK_DELAY_FRAMES) {
          lockPiece(isDemo);
        }
      }
      if (shouldRender) setTick((t) => t + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  function shiftQueue(g: GS): TetrominoType {
    const t = g.nextQueue.shift()!;
    const refilled = fillQueueFromBag(g.nextQueue, g.bag);
    g.nextQueue = refilled.queue;
    g.bag = refilled.bag;
    return t;
  }

  function spawnNext(isDemo: boolean) {
    const g = gsRef.current!;
    const t = shiftQueue(g);
    g.active = spawnActive(t);
    g.dropAccum = 0;
    g.lockTimer = 0;
    g.demoTarget = null;
    if (collides(g.board, g.active)) {
      if (isDemo) {
        // Reset the board so the preview never freezes
        g.board = emptyBoard();
        g.flashRows = [];
        g.flashTimer = 0;
        // Try again from a clean slate
        if (collides(g.board, g.active)) {
          // Shouldn't happen, but bail safely
          g.active = null;
        }
      } else {
        gameOver();
      }
    }
  }

  function lockPiece(isDemo: boolean) {
    const g = gsRef.current!;
    if (!g.active) return;
    g.board = place(g.board, g.active);
    g.active = null;
    const fullRows: number[] = [];
    for (let y = 0; y < BOARD_H; y++) {
      if (g.board[y].every((c) => c !== null)) fullRows.push(y);
    }
    if (fullRows.length > 0) {
      const cleared = fullRows.length;
      if (!isDemo) {
        g.score += LINE_SCORE[cleared] * g.level;
        g.lines += cleared;
        const newLevel = Math.floor(g.lines / 10) + 1;
        if (newLevel !== g.level) g.level = newLevel;
      }
      if (!isDemo) {
        playExplosion(cleared >= 4 ? 'large' : cleared >= 2 ? 'medium' : 'small');
      }
      // Hold the cleared rows visible (flashing) for FLASH_FRAMES ticks.
      // The game loop will collapse and spawn the next piece when the
      // timer reaches zero.
      g.flashRows = fullRows;
      g.flashTimer = FLASH_FRAMES;
      return;
    }
    if (!isDemo) playShoot();
    spawnNext(isDemo);
  }

  function tryMove(dx: number, dy: number) {
    const g = gsRef.current; if (!g || !g.active) return false;
    const moved = { ...g.active, x: g.active.x + dx, y: g.active.y + dy };
    if (!collides(g.board, moved)) {
      g.active = moved;
      if (dy === 0) g.lockTimer = 0; // sliding cancels lock delay
      setTick((t) => t + 1);
      return true;
    }
    return false;
  }

  function tryRotate(dir: 1 | -1) {
    const g = gsRef.current; if (!g || !g.active) return;
    const type = g.active.type;
    const rots = TETROMINOS[type].length;
    const nextRot = (g.active.rot + dir + rots) % rots;
    // Shift x so the new bounding box stays visually centered over the old
    // one. Without this, e.g. an L-piece "snaps" to one side on every
    // rotation because the shape width changes.
    const oldW = TETROMINOS[type][g.active.rot][0].length;
    const newW = TETROMINOS[type][nextRot][0].length;
    const centerShift = Math.floor((oldW - newW) / 2);
    for (const kick of [0, -1, 1, -2, 2]) {
      const candidate = {
        ...g.active,
        rot: nextRot,
        x: g.active.x + centerShift + kick,
      };
      if (!collides(g.board, candidate)) {
        g.active = candidate;
        g.lockTimer = 0;
        setTick((t) => t + 1);
        return;
      }
    }
  }

  function hardDrop() {
    const g = gsRef.current; if (!g || !g.active) return;
    const startY = g.active.y;
    const dropY = ghostY(g.board, g.active);
    g.score += (dropY - startY) * 2;
    g.active = { ...g.active, y: dropY };
    lockPiece(false);
    setTick((t) => t + 1);
  }

  function gameOver() {
    const g = gsRef.current; if (!g) return;
    g.topOut = true;
    const isNewHS = g.score > useTetrisStore.getState().highScore;
    setNewHS(isNewHS);
    updateHighScore(g.score);
    addRun({
      id: String(Date.now()),
      score: g.score,
      lines: g.lines,
      level: g.level,
      durationMs: Date.now() - g.startTime,
      date: Date.now(),
    });
    playShipDestroyed();
    setPhase('gameover');
    // Keep isGamePlaying TRUE through the game-over screen so the GameShell
    // chrome stays hidden — only handleBackToMenu (MENU button) flips it back.
  }

  function startFreshGame() {
    const firstType = refillBag([]).shift()!;
    let queue: TetrominoType[] = [];
    let bag: TetrominoType[] = refillBag([]);
    // First piece already pulled — fill the visible NEXT queue
    const f = fillQueueFromBag(queue, bag);
    queue = f.queue; bag = f.bag;
    gsRef.current = {
      board: emptyBoard(),
      active: spawnActive(firstType),
      nextQueue: queue,
      bag,
      score: 0, lines: 0, level: 1,
      dropAccum: 0, lockTimer: 0,
      startTime: Date.now(),
      topOut: false,
      flashRows: [],
      flashTimer: 0,
      demoTarget: null,
      demoStepCD: 0,
    };
    // Reset input state so any keys still held don't leak in
    heldRef.current = { down: false };
    setIsGamePlaying(true);
    setPhase('playing');
  }

  function startDemo() {
    const firstType = refillBag([]).shift()!;
    let queue: TetrominoType[] = [];
    let bag: TetrominoType[] = refillBag([]);
    const f = fillQueueFromBag(queue, bag);
    queue = f.queue; bag = f.bag;
    gsRef.current = {
      board: emptyBoard(),
      active: spawnActive(firstType),
      nextQueue: queue,
      bag,
      score: 0, lines: 0, level: 1,
      dropAccum: 0, lockTimer: 0,
      startTime: Date.now(),
      topOut: false,
      flashRows: [],
      flashTimer: 0,
      demoTarget: null,
      demoStepCD: 0,
    };
    setPhase('demo');
  }

  /* ── Coin → countdown → start flow (mirrors Asteroids) ── */
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
    // Stop the demo so it doesn't keep churning behind the coin/countdown UI.
    gsRef.current = null;
    heldRef.current = { down: false };
    runCoinAnimation();
  }, [isSubscribed, coins, spendCoin, runCoinAnimation]);

  const handleBackToMenu = useCallback(() => {
    gsRef.current = null;
    setIsGamePlaying(false);
    setNewHS(false);
    setPhase('idle'); // boot-effect will restart the demo
  }, []);

  /* ── Layout ── */
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  };

  // Board dimensions — fit inside available area, leaving room for HUD + controls
  const playableH = area.h - CTRL_H;
  // On the title/demo screen we hide the side panel and reserve vertical
  // space for the TETRIS title + INSERT COIN row so the falling pieces
  // sit cleanly between them instead of being covered by the overlay.
  const isDemoLayout = phase === 'idle' || phase === 'demo';
  const demoReserveTop = 160;
  const demoReserveBottom = 150;
  const reservedH = isDemoLayout ? demoReserveTop + demoReserveBottom : HUD_H;
  // During demo / idle the outer frame is the shared preview box (same exact
  // size as every other arcade title); during gameplay we let the board fill
  // the available area normally.
  // Use full area.h for the demo preview (controls aren't shown then) so the
  // preview matches Asteroids which measures its gameArea without CTRL_H.
  const preview = fitPreview(area.w, isDemoLayout ? area.h : playableH);
  const maxByW = (isDemoLayout ? preview.w : area.w) / BOARD_W;
  const maxByH = (isDemoLayout ? preview.h : playableH - reservedH) / BOARD_H;
  const CELL = Math.max(8, Math.floor(Math.min(maxByW, maxByH)));
  const cellsW = CELL * BOARD_W;
  const cellsH = CELL * BOARD_H;
  // Outer frame dims: shared preview size on idle, exact cell grid on play.
  const boardPxW = isDemoLayout ? preview.w : cellsW;
  const boardPxH = isDemoLayout ? preview.h : cellsH;
  // Offset so the cell grid is centred inside the preview frame.
  const cellsOffsetX = Math.floor((boardPxW - cellsW) / 2);
  const cellsOffsetY = Math.floor((boardPxH - cellsH) / 2);

  const g = gsRef.current;
  const showBoard = g && (phase === 'playing' || phase === 'gameover' || phase === 'demo');

  // Compute the active piece's cells + ghost cells WITHOUT rebuilding the
  // whole board. The locked layer is rendered via a separate memoised
  // component keyed on g.board, so it skips reconcile on every gravity tick.
  type ActiveCell = { y: number; x: number; type: TetrominoType };
  let activeCells: ActiveCell[] | null = null;
  let ghostList: { y: number; x: number }[] | null = null;
  if (showBoard && g!.active) {
    const a = g!.active;
    const gy = ghostY(g!.board, a);
    const m = shape(a);
    activeCells = [];
    ghostList = [];
    for (let dy = 0; dy < m.length; dy++) {
      for (let dx = 0; dx < m[dy].length; dx++) {
        if (!m[dy][dx]) continue;
        const ay = a.y + dy;
        const gyRow = gy + dy;
        const cx = a.x + dx;
        if (ay >= 0 && ay < BOARD_H) activeCells.push({ y: ay, x: cx, type: a.type });
        if (gyRow >= 0 && gyRow < BOARD_H) ghostList.push({ y: gyRow, x: cx });
      }
    }
  }

  return (
    <View style={s.root} onLayout={onLayout}>
      {/* Game area */}
      <View style={[
        s.gameArea,
        {
          paddingTop: isDemoLayout ? demoReserveTop : 0,
          paddingBottom: isDemoLayout ? demoReserveBottom : 0,
          justifyContent: isDemoLayout ? 'center' : 'flex-start',
        },
      ]}>
        {/* Board is hidden during gameover so the overlay is
            the only thing on screen, matching the web layout. */}
        {phase !== 'gameover' && (<>
        {/* HUD — score / level / lines / next. Hidden on title/demo screen. */}
        {!isDemoLayout && (
        <View style={s.hud}>
          <View style={s.hudStat}>
            <Text style={[s.sideLabel, { fontFamily: MONO }]}>SCORE</Text>
            <Text style={[s.hudValue, { fontFamily: MONO }]}>
              {g ? String(g.score).padStart(5, '0') : '00000'}
            </Text>
          </View>
          <View style={s.hudStat}>
            <Text style={[s.sideLabel, { fontFamily: MONO }]}>LEVEL</Text>
            <Text style={[s.hudValue, { fontFamily: MONO }]}>{g ? g.level : 1}</Text>
          </View>
          <View style={s.hudStat}>
            <Text style={[s.sideLabel, { fontFamily: MONO }]}>LINES</Text>
            <Text style={[s.hudValue, { fontFamily: MONO }]}>{g ? g.lines : 0}</Text>
          </View>
          <View style={s.hudNext}>
            <Text style={[s.sideLabel, { fontFamily: MONO }]}>NEXT</Text>
            <View style={s.hudNextRow}>
              {g && phase === 'playing' && g.nextQueue.slice(0, NEXT_QUEUE_LEN).map((type, idx) => {
                const m = TETROMINOS[type][0];
                const cs = 9;
                const color = TETROMINO_COLORS[type];
                return (
                  <View
                    key={idx}
                    style={[s.hudNextBox, { width: m[0].length * cs + 4, height: m.length * cs + 4 }]}
                  >
                    {m.map((row, ry) =>
                      row.map((v, rx) => v ? (
                        <View key={`${ry}-${rx}`} style={{
                          position: 'absolute',
                          left: 2 + rx * cs,
                          top: 2 + ry * cs,
                        }}>
                          <PixelBlock size={cs} color={color} />
                        </View>
                      ) : null)
                    )}
                  </View>
                );
              })}
            </View>
          </View>
          {Platform.OS !== 'web' && phase === 'playing' && (
            <Pressable onPress={gameOver} style={s.giveUpBtn}>
              <Text style={[s.giveUpTxt, { fontFamily: MONO }]}>GIVE UP</Text>
            </Pressable>
          )}
        </View>
        )}
        {/* Board — Pressable so a left click rotates CW */}
        <Pressable
          ref={boardRef as any}
          onPress={() => { if (phase === 'playing') tryRotate(1); }}
          onLayout={() => {
            cellRef.current = CELL;
            boardSizeRef.current = { w: boardPxW, h: boardPxH };
            if (Platform.OS === 'web' && boardRef.current) {
              (boardRef.current as any).measureInWindow?.((x: number, y: number) => {
                boardOrigin.current = { x, y };
              });
            }
          }}
          style={[s.board, { width: boardPxW, height: boardPxH }]}
        >
          {/* Inner cell-grid wrapper — centred inside the outer preview
              frame on idle (zero-offset during play). All cell-relative
              positions are computed against THIS wrapper, not the board. */}
          <View style={{
            position: 'absolute',
            left: cellsOffsetX, top: cellsOffsetY,
            width: cellsW, height: cellsH,
          }}>
          {/* Grid lines — 10 verticals + 20 horizontals beats 200 cells */}
          <BoardGrid cell={CELL} />
          {/* Locked cells — memoised; only reconciles on lock / line-clear */}
          {showBoard && <LockedBoard board={g!.board} cell={CELL} />}
          {/* Ghost piece outline */}
          {ghostList && ghostList.map((c) => (
            <View key={`gh-${c.y}-${c.x}`} style={{
              position: 'absolute',
              left: c.x * CELL, top: c.y * CELL,
              width: CELL, height: CELL,
              borderWidth: 1, borderColor: '#3A3A3A',
            }} />
          ))}
          {/* Active piece (4 cells, drawn on top of the locked layer) */}
          {activeCells && activeCells.map((c) => (
            <View key={`a-${c.y}-${c.x}`} style={{
              position: 'absolute',
              left: c.x * CELL, top: c.y * CELL,
            }}>
              <PixelBlock size={CELL} color={TETROMINO_COLORS[c.type]} />
            </View>
          ))}

          {/* Line-clear flash — pulses cleared rows white before collapse */}
          {showBoard && g!.flashTimer > 0 && (() => {
            // 3-phase pulse over FLASH_FRAMES: bright → dim → bright fade.
            // Computed ONCE per render (was per-row inside .map).
            const t = g!.flashTimer / FLASH_FRAMES;
            const opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 2));
            return g!.flashRows.map((y) => (
              <View
                key={`flash-${y}`}
                style={{
                  position: 'absolute',
                  left: 0, top: y * CELL,
                  width: cellsW, height: CELL,
                  backgroundColor: '#FFFFFF',
                  opacity,
                }}
              />
            ));
          })()}
          </View>
        </Pressable>

        </>)}
      </View>

      {/* ── Title / idle overlay (sits over the autoplay demo) ── */}
      {(phase === 'idle' || phase === 'demo') && (
        <>
          <View style={[s.overlayTop, { pointerEvents: 'box-none' }]}>
            <Text style={[s.titleText, { fontFamily: MONO }]}>TETRIS</Text>
            <Text style={[s.hiLabel, { fontFamily: MONO }]}>
              HIGH SCORE   {highScore}
            </Text>
          </View>
          <View style={[s.overlayBottom, { pointerEvents: 'box-none' }]}>
            <Pressable onPress={handleInsertCoin} style={[s.menuBtn, coins === 0 && s.menuBtnNoCoins]}>
              <Text style={[s.menuBtnTxt, { fontFamily: MONO }]}>
                {coins > 0 ? 'INSERT COIN' : 'GET COINS'}
              </Text>
            </Pressable>
            <View style={s.controlsInline}>
              <GameControlsInfo
                gameTitle="TETRIS"
                mobileControls={[
                  { keyText: 'LEFT / RIGHT', actionText: 'Move piece horizontally.' },
                  { keyText: 'ROTATE', actionText: 'Rotate the active piece.' },
                  { keyText: 'SOFT DROP', actionText: 'Drop faster while held.' },
                  { keyText: 'DOWN', actionText: 'Hard drop instantly.' },
                ]}
                webControls={[
                  { keyText: 'MOUSE MOVE', actionText: 'Guide piece horizontally.' },
                  { keyText: 'CLICK', actionText: 'Rotate the active piece.' },
                  { keyText: 'ARROWS / WASD', actionText: 'Move and soft drop.' },
                  { keyText: 'SPACE', actionText: 'Hard drop instantly.' },
                ]}
              />
            </View>
          </View>
        </>
      )}

      {/* Coin insert animation */}
      {phase === 'coinanim' && (
        <View style={[s.insertOverlay, { width: area.w, height: area.h }, { pointerEvents: 'none' }]}>
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

      {/* Countdown */}
      {phase === 'countdown' && (
        <View style={[s.countdownOverlay, { width: area.w, height: area.h }, { pointerEvents: 'none' }]}>
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

      {/* Game over */}
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

      {/* Touch controls (mobile) */}
      {Platform.OS !== 'web' && phase === 'playing' && (
        <View style={s.ctrlOverlay}>
          {/* Top row: move left/right, rotate CCW/CW, soft drop */}
          <View style={s.ctrlRow}>
            <Pressable style={s.ctrlBtn} onPressIn={() => startHold(() => tryMove(-1, 0))} onPressOut={stopHold}>
              <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>◀</Text>
            </Pressable>
            <Pressable
              style={s.ctrlBtn}
              onPressIn={() => { heldRef.current.down = true; }}
              onPressOut={() => { heldRef.current.down = false; }}
            >
              <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>▼</Text>
            </Pressable>
            <Pressable style={s.ctrlBtn} onPressIn={() => startHold(() => tryMove(1, 0))} onPressOut={stopHold}>
              <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>▶</Text>
            </Pressable>
          </View>
          {/* Bottom row: rotate + wide instant-drop */}
          <View style={s.ctrlRow}>
            <Pressable style={s.ctrlBtn} onPressIn={() => tryRotate(1)}>
              <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>⟳</Text>
            </Pressable>
            <Pressable style={[s.dropWideBtn, { flex: 1 }]} onPressIn={hardDrop}>
              <Text style={[s.dropWideTxt, { fontFamily: MONO }]}>▼ DOWN</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  gameArea: {
    flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  board: {
    backgroundColor: '#050505',
    borderWidth: 2, borderColor: '#222',
    position: 'relative',
  },
  side: { gap: 4, paddingHorizontal: 4 },
  sideLabel: { color: '#666', fontSize: 10, letterSpacing: 2 },
  sideValue: { color: '#FFF', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  nextStack: { gap: 4, marginTop: 2 },
  nextBox: {
    backgroundColor: '#070707',
    borderWidth: 1, borderColor: '#1A1A1A',
    position: 'relative',
  },

  overlayTop: {
    position: 'absolute', top: 40, left: 0, right: 0,
    alignItems: 'center', gap: 10,
  },
  overlayBottom: {
    position: 'absolute', bottom: 50, left: 0, right: 0,
    alignItems: 'center', gap: 10,
  },
  titleText: {
    color: '#FFF', fontSize: 34, fontWeight: '800', letterSpacing: 8,
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
    backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center', gap: 18,
    zIndex: 50,
  },
  finalScore: { color: '#FFF', fontSize: 52, fontWeight: '700', letterSpacing: 6 },
  newHsText: { color: '#FFD700', fontSize: 15, fontWeight: '700', letterSpacing: 3 },
  btnRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  goBtn: {
    borderWidth: 2, borderColor: '#FFF',
    paddingHorizontal: 28, paddingVertical: 14,
    minWidth: 130, alignItems: 'center',
  },
  goBtnTxt: { color: '#FFF', fontSize: 14, letterSpacing: 4 },
  goBtnSecondary: { borderColor: '#666' },
  goBtnSecondaryTxt: { color: '#999' },

  ctrlOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: CTRL_H,
    flexDirection: 'column',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 6,
    gap: 6,
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
  dropBtn: { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.08)' },
  dropWideBtn: {
    borderWidth: 2, borderColor: '#B8860B',
    backgroundColor: '#FFD700',
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 4,
  },
  dropWideTxt: { color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 3 },
  hud: {
    width: '100%' as any,
    height: HUD_H,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-around' as const,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  hudStat: {
    alignItems: 'center' as const,
    gap: 2,
  },
  hudValue: { color: '#FFF', fontSize: 20, fontWeight: '700' as const, letterSpacing: 1 },
  hudNext: {
    alignItems: 'center' as const,
    gap: 2,
  },
  giveUpBtn: {
    backgroundColor: '#CC0000',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'center' as const,
  },
  giveUpTxt: { color: '#fff', fontSize: 11, fontWeight: '700' as const, letterSpacing: 1 },
  hudNextRow: {
    flexDirection: 'row' as const,
    gap: 4,
    alignItems: 'center' as const,
  },
  hudNextBox: {
    backgroundColor: '#070707',
    borderWidth: 1, borderColor: '#1A1A1A',
    position: 'relative' as const,
  },
});
