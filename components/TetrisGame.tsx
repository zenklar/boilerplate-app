import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform, LayoutChangeEvent, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useTetrisStore } from '../store/tetrisStore';
import { useCoinStore } from '../store/coinStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import ArcadeCoin from './ArcadeCoin';
import {
  TETROMINOS, TETROMINO_COLORS, TETROMINO_TYPES,
  TetrominoType, BOARD_W, BOARD_H, LINE_SCORE, DROP_FRAMES_PER_LEVEL,
} from '../constants/tetris';
import { playShoot, playExplosion, playCoinInsert, playCountdownBeep, playCountdownGo, playShipDestroyed } from '../utils/sounds';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const TICK_MS = 16;
const SOFT_DROP_DIVISOR = 6; // soft drop falls this many cells per gravity tick
const MOVE_REPEAT_DELAY = 10;
const MOVE_REPEAT_INTERVAL = 3;
const LOCK_DELAY_FRAMES = 30;
const CTRL_H = Platform.OS === 'web' ? 0 : 150;

type Phase = 'idle' | 'coinanim' | 'countdown' | 'playing' | 'gameover';
type Cell = TetrominoType | null;
type Active = { type: TetrominoType; rot: number; x: number; y: number };

type GS = {
  board: Cell[][];
  active: Active | null;
  nextType: TetrominoType;
  bag: TetrominoType[];
  score: number;
  lines: number;
  level: number;
  dropAccum: number;
  lockTimer: number;
  startTime: number;
  topOut: boolean;
};

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
  // Input state
  const heldRef = useRef<{ left: number; right: number; down: boolean }>({ left: 0, right: 0, down: false });

  useEffect(() => {
    loadHighScore(); loadRuns();
    useCoinStore.getState().loadCoins();
    useSubscriptionStore.getState().loadSubscription();
  }, []);

  /* ── Keyboard controls (web) ── */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'playing') return;
      const g = gsRef.current; if (!g || !g.active) return;
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

  /* ── Game loop ── */
  useEffect(() => {
    const id = setInterval(() => {
      if (phase !== 'playing') return;
      const g = gsRef.current;
      if (!g || !g.active) return;

      const gravity = DROP_FRAMES_PER_LEVEL(g.level);
      const effective = heldRef.current.down ? Math.max(1, Math.floor(gravity / SOFT_DROP_DIVISOR)) : gravity;
      g.dropAccum++;
      if (g.dropAccum >= effective) {
        g.dropAccum = 0;
        const moved = { ...g.active, y: g.active.y + 1 };
        if (collides(g.board, moved)) {
          // Try lock after a short delay so player can still slide
          g.lockTimer++;
          if (g.lockTimer >= LOCK_DELAY_FRAMES) {
            lockPiece();
          }
        } else {
          g.active = moved;
          g.lockTimer = 0;
          if (heldRef.current.down) g.score += 1; // soft drop bonus
        }
      }
      setTick((t) => t + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  function pickNext(g: GS): TetrominoType {
    g.bag = refillBag(g.bag);
    return g.bag.shift()!;
  }

  function spawnNext() {
    const g = gsRef.current!;
    const t = g.nextType;
    g.active = spawnActive(t);
    g.nextType = pickNext(g);
    g.dropAccum = 0;
    g.lockTimer = 0;
    if (collides(g.board, g.active)) {
      // Top-out
      gameOver();
    }
  }

  function lockPiece() {
    const g = gsRef.current!;
    if (!g.active) return;
    let board = place(g.board, g.active);
    const { board: cleaned, cleared } = clearFull(board);
    g.board = cleaned;
    if (cleared > 0) {
      g.score += LINE_SCORE[cleared] * g.level;
      g.lines += cleared;
      const newLevel = Math.floor(g.lines / 10) + 1;
      if (newLevel !== g.level) g.level = newLevel;
      if (Platform.OS === 'web') playExplosion(cleared >= 4 ? 'large' : cleared >= 2 ? 'medium' : 'small');
    } else if (Platform.OS === 'web') {
      playShoot();
    }
    spawnNext();
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
    const rots = TETROMINOS[g.active.type].length;
    const nextRot = (g.active.rot + dir + rots) % rots;
    // Simple wall kicks: try original, then ±1, then ±2 columns
    for (const kick of [0, -1, 1, -2, 2]) {
      const candidate = { ...g.active, rot: nextRot, x: g.active.x + kick };
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
    lockPiece();
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
    if (Platform.OS === 'web') playShipDestroyed();
    setPhase('gameover');
    setIsGamePlaying(false);
  }

  function startFreshGame() {
    const initialBag = refillBag([]);
    const firstType = initialBag.shift()!;
    const secondType = initialBag.shift()!;
    gsRef.current = {
      board: emptyBoard(),
      active: spawnActive(firstType),
      nextType: secondType,
      bag: initialBag,
      score: 0, lines: 0, level: 1,
      dropAccum: 0, lockTimer: 0,
      startTime: Date.now(),
      topOut: false,
    };
    setIsGamePlaying(true);
    setPhase('playing');
  }

  /* ── Coin → countdown → start flow (mirrors Asteroids) ── */
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
    const targetY = area.h / 2 - 30;
    coinY.setValue(-60);
    coinScale.setValue(0.5);
    coinOpacity.setValue(1);
    setPhase('coinanim');
    if (Platform.OS === 'web') playCoinInsert();
    Animated.parallel([
      Animated.timing(coinY,     { toValue: targetY, duration: 520, useNativeDriver: true }),
      Animated.timing(coinScale, { toValue: 1.3,     duration: 520, useNativeDriver: true }),
    ]).start(() => {
      Animated.sequence([
        Animated.timing(coinScale,   { toValue: 0.2, duration: 180, useNativeDriver: true }),
        Animated.timing(coinOpacity, { toValue: 0,   duration: 80,  useNativeDriver: true }),
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
    runCoinAnimation();
  }, [isSubscribed, coins, spendCoin, runCoinAnimation]);

  const handleBackToMenu = useCallback(() => {
    gsRef.current = null;
    setIsGamePlaying(false);
    setNewHS(false);
    setPhase('idle');
  }, []);

  /* ── Layout ── */
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  };

  // Board dimensions — fit inside available area, leaving room for HUD + controls
  const playableH = area.h - CTRL_H;
  const sidePanelW = Math.min(120, area.w * 0.3);
  const maxByW = (area.w - sidePanelW - 40) / BOARD_W;
  const maxByH = (playableH - 40) / BOARD_H;
  const CELL = Math.max(8, Math.floor(Math.min(maxByW, maxByH)));
  const boardPxW = CELL * BOARD_W;
  const boardPxH = CELL * BOARD_H;

  const g = gsRef.current;

  // Compose display board: locked cells + active piece + ghost
  let displayCells: Cell[][] | null = null;
  let ghostCells: boolean[][] | null = null;
  if (g && (phase === 'playing' || phase === 'gameover')) {
    displayCells = g.board.map((r) => r.slice());
    if (g.active) {
      const a = g.active;
      const gy = ghostY(g.board, a);
      ghostCells = Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill(false));
      const m = shape(a);
      for (let dy = 0; dy < m.length; dy++) {
        for (let dx = 0; dx < m[dy].length; dx++) {
          if (!m[dy][dx]) continue;
          const gxCol = a.x + dx;
          const gyRow = gy + dy;
          if (gyRow >= 0 && gyRow < BOARD_H) ghostCells![gyRow][gxCol] = true;
          const ay = a.y + dy;
          if (ay >= 0 && ay < BOARD_H) displayCells[ay][a.x + dx] = a.type;
        }
      }
    }
  }

  return (
    <View style={s.root} onLayout={onLayout}>
      {/* Game area */}
      <View style={s.gameArea}>
        {/* Board */}
        <View style={[s.board, { width: boardPxW, height: boardPxH }]}>
          {/* Grid lines (pixel style) */}
          {Array.from({ length: BOARD_H * BOARD_W }).map((_, i) => {
            const y = Math.floor(i / BOARD_W);
            const x = i % BOARD_W;
            const cell = displayCells ? displayCells[y][x] : null;
            const isGhost = ghostCells ? ghostCells[y][x] && !cell : false;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: x * CELL,
                  top: y * CELL,
                  width: CELL,
                  height: CELL,
                  borderWidth: 1,
                  borderColor: '#0E0E0E',
                  backgroundColor: cell ? TETROMINO_COLORS[cell] : '#070707',
                }}
              >
                {cell && (
                  <View style={{
                    position: 'absolute', left: 2, top: 2, right: 2, bottom: 2,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
                  }} />
                )}
                {isGhost && (
                  <View style={{
                    position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
                    borderWidth: 1, borderColor: '#3A3A3A',
                  }} />
                )}
              </View>
            );
          })}
        </View>

        {/* Side panel — score / level / lines / next */}
        <View style={[s.side, { width: sidePanelW }]}>
          <Text style={[s.sideLabel, { fontFamily: MONO }]}>SCORE</Text>
          <Text style={[s.sideValue, { fontFamily: MONO }]}>
            {g ? String(g.score).padStart(5, '0') : '00000'}
          </Text>
          <Text style={[s.sideLabel, { fontFamily: MONO }]}>LEVEL</Text>
          <Text style={[s.sideValue, { fontFamily: MONO }]}>
            {g ? g.level : 1}
          </Text>
          <Text style={[s.sideLabel, { fontFamily: MONO }]}>LINES</Text>
          <Text style={[s.sideValue, { fontFamily: MONO }]}>
            {g ? g.lines : 0}
          </Text>
          <Text style={[s.sideLabel, { fontFamily: MONO, marginTop: 8 }]}>NEXT</Text>
          <View style={[s.nextBox, { width: CELL * 4 + 8, height: CELL * 3 + 8 }]}>
            {g && phase === 'playing' && (() => {
              const m = TETROMINOS[g.nextType][0];
              const color = TETROMINO_COLORS[g.nextType];
              return m.map((row, ry) =>
                row.map((v, rx) => v ? (
                  <View key={`${ry}-${rx}`} style={{
                    position: 'absolute',
                    left: 4 + rx * CELL * 0.75,
                    top: 4 + ry * CELL * 0.75,
                    width: CELL * 0.75,
                    height: CELL * 0.75,
                    backgroundColor: color,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
                  }} />
                ) : null)
              );
            })()}
          </View>
        </View>
      </View>

      {/* ── Title / idle overlay ── */}
      {phase === 'idle' && (
        <View style={s.overlay} pointerEvents="box-none">
          <View style={s.overlayTop} pointerEvents="box-none">
            <Text style={[s.titleText, { fontFamily: MONO }]}>TETRIS</Text>
            {highScore > 0 && (
              <Text style={[s.hiLabel, { fontFamily: MONO }]}>
                HIGH SCORE   {highScore}
              </Text>
            )}
          </View>
          <View style={s.overlayBottom} pointerEvents="box-none">
            <Pressable onPress={handleInsertCoin} style={[s.menuBtn, coins === 0 && s.menuBtnNoCoins]}>
              <Text style={[s.menuBtnTxt, { fontFamily: MONO }]}>
                {coins > 0 ? 'INSERT COIN' : 'GET COINS'}
              </Text>
            </Pressable>
            {Platform.OS === 'web' && (
              <Text style={[s.webIdleHint, { fontFamily: MONO }]}>
                ← →  move · ↑  rotate · ↓  soft drop · Space  hard drop
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Coin insert animation */}
      {phase === 'coinanim' && (
        <View style={s.insertOverlay} pointerEvents="none">
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
        <View style={s.countdownOverlay} pointerEvents="none">
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
        <View style={s.gameOverOverlay}>
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
          <Pressable style={s.ctrlBtn} onPressIn={() => tryMove(-1, 0)}>
            <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>◀</Text>
          </Pressable>
          <Pressable style={s.ctrlBtn} onPressIn={() => tryRotate(1)}>
            <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>⟳</Text>
          </Pressable>
          <Pressable
            style={s.ctrlBtn}
            onPressIn={() => { heldRef.current.down = true; }}
            onPressOut={() => { heldRef.current.down = false; }}
          >
            <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>▼</Text>
          </Pressable>
          <Pressable style={s.ctrlBtn} onPressIn={() => tryMove(1, 0)}>
            <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>▶</Text>
          </Pressable>
          <Pressable style={[s.ctrlBtn, s.dropBtn]} onPressIn={hardDrop}>
            <Text style={[s.ctrlBtnTxt, { fontFamily: MONO }]}>⤓</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  gameArea: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 14, padding: 8,
  },
  board: {
    backgroundColor: '#050505',
    borderWidth: 2, borderColor: '#222',
    position: 'relative',
  },
  side: { gap: 4, paddingHorizontal: 4 },
  sideLabel: { color: '#666', fontSize: 10, letterSpacing: 2 },
  sideValue: { color: '#FFF', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  nextBox: {
    marginTop: 2,
    backgroundColor: '#070707',
    borderWidth: 1, borderColor: '#1A1A1A',
    position: 'relative',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 40, paddingBottom: 50,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  overlayTop: { alignItems: 'center', gap: 10 },
  overlayBottom: { alignItems: 'center', gap: 10 },
  titleText: {
    color: '#FFF', fontSize: 34, fontWeight: '800', letterSpacing: 8,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  hiLabel: {
    color: '#FFD700', fontSize: 14, letterSpacing: 1,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6,
  },
  webIdleHint: {
    color: '#CCC', fontSize: 11, letterSpacing: 1,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6,
  },
  menuBtn: {
    borderWidth: 1.5, borderColor: '#B8860B',
    backgroundColor: '#FFD700',
    paddingHorizontal: 24, paddingVertical: 12,
  },
  menuBtnNoCoins: { backgroundColor: '#555', borderColor: '#333' },
  menuBtnTxt: { color: '#000', fontSize: 13, letterSpacing: 4, fontWeight: '800' },

  insertOverlay: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  fallingCoin: {
    position: 'absolute', top: 0,
    width: 56, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  countdownText: {
    color: '#FFF', fontSize: 96, fontWeight: '900', letterSpacing: 8,
    textShadowColor: '#FFD700', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24,
  },

  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center', gap: 18,
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
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center', justifyContent: 'space-between',
  },
  ctrlBtn: {
    flex: 1, height: CTRL_H - 20,
    borderWidth: 1.5, borderColor: '#333',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlBtnTxt: { color: '#EEE', fontSize: 30, fontWeight: '700' },
  dropBtn: { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.08)' },
});
