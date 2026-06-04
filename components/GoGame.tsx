import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated,
  Platform, LayoutChangeEvent, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useCoinStore } from '../store/coinStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useGoGameStore } from '../store/goGameStore';
import { useGameUIStore } from '../store/gameStore';
import ArcadeCoin from './ArcadeCoin';
import { fitPreview } from './game/previewFrame';
import {
  playCoinInsert, playCountdownBeep, playCountdownGo, warmUpSounds,
  playStonePlace, playStoneCapture, playIllegalMove, playPassMove,
  playGoWin, playGoLose,
} from '../utils/sounds';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const ACCENT = '#FFD700';
const BOARD_N = 9;

// ── Types ─────────────────────────────────────────────────────────────────────

type Stone = 'black' | 'white' | null;
type Board = Stone[][];
type Phase = 'idle' | 'draw' | 'playing' | 'gameover';
type InsertPhase = 'coinanim' | 'countdown' | null;

type GameState = {
  board: Board;
  history: string[];
  currentTurn: 'black' | 'white';
  playerColor: 'black' | 'white';
  capturedByBlack: number;
  capturedByWhite: number;
  consecutivePasses: number;
  startTime: number;
  lastMove: [number, number] | null;
};

// ── Go logic ──────────────────────────────────────────────────────────────────

function emptyBoard(): Board {
  return Array.from({ length: BOARD_N }, () => Array(BOARD_N).fill(null));
}

function copyBoard(b: Board): Board {
  return b.map((row) => [...row]);
}

function boardKey(b: Board): string {
  return b.map((r) => r.map((c) => c?.[0] ?? '.').join('')).join('|');
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_N && c >= 0 && c < BOARD_N;
}

const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function getGroup(board: Board, row: number, col: number) {
  const color = board[row][col];
  if (!color) return { stones: [] as [number, number][], liberties: [] as [number, number][] };
  const visited = new Set<string>();
  const stones: [number, number][] = [];
  const libertySet = new Set<string>();
  const queue: [number, number][] = [[row, col]];
  visited.add(`${row},${col}`);
  while (queue.length) {
    const [r, c] = queue.shift()!;
    stones.push([r, c]);
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const key = `${nr},${nc}`;
      if (board[nr][nc] === null) {
        libertySet.add(key);
      } else if (board[nr][nc] === color && !visited.has(key)) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }
  return {
    stones,
    liberties: [...libertySet].map((k) => k.split(',').map(Number) as [number, number]),
  };
}

function placeStone(
  board: Board,
  row: number,
  col: number,
  color: 'black' | 'white',
  history: string[],
): { next: Board; captured: number } | null {
  if (board[row][col] !== null) return null;
  const next = copyBoard(board);
  next[row][col] = color;
  const opponent = color === 'black' ? 'white' : 'black';
  let captured = 0;
  for (const [dr, dc] of DIRS) {
    const nr = row + dr, nc = col + dc;
    if (!inBounds(nr, nc) || next[nr][nc] !== opponent) continue;
    const group = getGroup(next, nr, nc);
    if (group.liberties.length === 0) {
      captured += group.stones.length;
      for (const [sr, sc] of group.stones) next[sr][sc] = null;
    }
  }
  const placed = getGroup(next, row, col);
  if (placed.liberties.length === 0) return null; // suicide
  const key = boardKey(next);
  if (history.includes(key)) return null; // ko
  return { next, captured };
}

function scoreBoard(board: Board, capturedBlack: number, capturedWhite: number) {
  const counted = Array.from({ length: BOARD_N }, () => Array(BOARD_N).fill(false));
  let blackTerritory = 0, whiteTerritory = 0;
  for (let r = 0; r < BOARD_N; r++) {
    for (let c = 0; c < BOARD_N; c++) {
      if (board[r][c] !== null || counted[r][c]) continue;
      const region: [number, number][] = [];
      const borders = new Set<Stone>();
      const visited = new Set<string>();
      const queue: [number, number][] = [[r, c]];
      visited.add(`${r},${c}`);
      while (queue.length) {
        const [qr, qc] = queue.shift()!;
        region.push([qr, qc]);
        (counted[qr] as boolean[])[qc] = true;
        for (const [dr, dc] of DIRS) {
          const nr = qr + dr, nc = qc + dc;
          if (!inBounds(nr, nc)) continue;
          if (board[nr][nc] !== null) {
            borders.add(board[nr][nc]);
          } else if (!visited.has(`${nr},${nc}`)) {
            visited.add(`${nr},${nc}`);
            queue.push([nr, nc]);
          }
        }
      }
      if (borders.size === 1) {
        const owner = [...borders][0];
        if (owner === 'black') blackTerritory += region.length;
        else whiteTerritory += region.length;
      }
    }
  }
  let blackStones = 0, whiteStones = 0;
  for (let r = 0; r < BOARD_N; r++)
    for (let c = 0; c < BOARD_N; c++) {
      if (board[r][c] === 'black') blackStones++;
      else if (board[r][c] === 'white') whiteStones++;
    }
  return {
    blackScore: blackTerritory + blackStones + capturedWhite,
    whiteScore: whiteTerritory + whiteStones + capturedBlack + 6.5,
  };
}

// ── Bot AI ────────────────────────────────────────────────────────────────────

function botMove(board: Board, botColor: 'black' | 'white', history: string[]): [number, number] | null {
  const opponent = botColor === 'black' ? 'white' : 'black';
  const candidates: { r: number; c: number; score: number }[] = [];
  for (let r = 0; r < BOARD_N; r++) {
    for (let c = 0; c < BOARD_N; c++) {
      const result = placeStone(board, r, c, botColor, history);
      if (!result) continue;
      let score = result.captured * 30;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        if (board[nr][nc] === botColor) {
          const g = getGroup(board, nr, nc);
          if (g.liberties.length <= 2) score += 20;
        } else if (board[nr][nc] === opponent) {
          const g = getGroup(board, nr, nc);
          if (g.liberties.length <= 2) score += 15;
        }
      }
      score += Math.max(0, 8 - (Math.abs(r - 4) + Math.abs(c - 4)));
      score += Math.random() * 8;
      candidates.push({ r, c, score });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return [candidates[0].r, candidates[0].c];
}

// ── Demo board ────────────────────────────────────────────────────────────────

const DEMO_MOVES: [number, number, 'black' | 'white'][] = [
  [4,4,'black'],[3,3,'white'],[5,3,'black'],[3,5,'white'],
  [2,4,'black'],[5,5,'white'],[4,2,'black'],[4,6,'white'],
  [6,4,'black'],[2,2,'white'],[2,6,'black'],[6,2,'white'],
  [3,4,'black'],[5,4,'white'],[4,3,'black'],[4,5,'white'],
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function GoGame() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [insertPhase, setInsertPhase] = useState<InsertPhase>(null);
  const [area, setArea] = useState({ w: 320, h: 500 });
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [finalScores, setFinalScores] = useState<{ black: number; white: number } | null>(null);
  const [demoBoard, setDemoBoard] = useState<Board>(emptyBoard());
  const [demoTick, setDemoTick] = useState(0);
  const [pendingColor, setPendingColor] = useState<'black' | 'white'>('black');
  const [drawAnim, setDrawAnim] = useState<'spinning' | 'reveal' | null>(null);
  const [illegalFlash, setIllegalFlash] = useState<[number, number] | null>(null);
  const [gameEnded, setGameEnded] = useState(false);

  const botThinkingRef  = useRef(false);
  const gameStateRef    = useRef<GameState | null>(null);
  gameStateRef.current  = gameState;

  const coins       = useCoinStore((s) => s.coins);
  const spendCoin   = useCoinStore((s) => s.spendCoin);
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const setIsGamePlaying = useGameUIStore((s) => s.setIsGamePlaying);
  const addRun      = useGoGameStore((s) => s.addRun);
  const updateHighScore = useGoGameStore((s) => s.updateHighScore);

  // Animation values
  const coinY       = useRef(new Animated.Value(-60)).current;
  const coinScale   = useRef(new Animated.Value(0.5)).current;
  const coinOpacity = useRef(new Animated.Value(0)).current;
  const cdScale     = useRef(new Animated.Value(1)).current;
  const cdOpacity   = useRef(new Animated.Value(1)).current;
  const [countNum, setCountNum] = useState(3);
  const spinValue   = useRef(new Animated.Value(0)).current;
  const revealOpa   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    useCoinStore.getState().loadCoins();
    useSubscriptionStore.getState().loadSubscription();
    warmUpSounds();
  }, []);

  // Demo board animation
  useEffect(() => {
    if (phase !== 'idle') return;
    const idx = demoTick % DEMO_MOVES.length;
    const [r, c, color] = DEMO_MOVES[idx];
    setDemoBoard((prev) => {
      const next = copyBoard(prev);
      next[r][c] = color;
      return next;
    });
    const t = setTimeout(() => setDemoTick((n) => n + 1), 900);
    return () => clearTimeout(t);
  }, [phase, demoTick]);

  useEffect(() => {
    if (phase === 'idle') { setDemoBoard(emptyBoard()); setDemoTick(0); }
  }, [phase]);

  // Watch for game-ending consecutive passes
  useEffect(() => {
    if (phase !== 'playing' || !gameState || gameEnded) return;
    if (gameState.consecutivePasses < 2) return;
    setGameEnded(true);
    const scores = scoreBoard(gameState.board, gameState.capturedByBlack, gameState.capturedByWhite);
    setFinalScores({ black: scores.blackScore, white: scores.whiteScore });
    setPhase('gameover');
    setIsGamePlaying(false);
    const playerWon = gameState.playerColor === 'black'
      ? scores.blackScore > scores.whiteScore
      : scores.whiteScore > scores.blackScore;
    if (playerWon) playGoWin(); else playGoLose();
    const playerScore = Math.round(
      gameState.playerColor === 'black' ? scores.blackScore : scores.whiteScore
    );
    updateHighScore(playerScore);
    addRun({
      id: Date.now().toString(),
      score: playerScore,
      captures: gameState.playerColor === 'black' ? gameState.capturedByBlack : gameState.capturedByWhite,
      durationMs: Date.now() - gameState.startTime,
      playerColor: gameState.playerColor,
      won: playerWon,
      date: Date.now(),
    });
  }, [phase, gameState?.consecutivePasses, gameEnded]);

  // Bot AI turn
  useEffect(() => {
    if (phase !== 'playing' || !gameState || gameEnded) return;
    const botColor = gameState.playerColor === 'black' ? 'white' : 'black';
    if (gameState.currentTurn !== botColor) return;
    if (botThinkingRef.current) return;
    botThinkingRef.current = true;

    const delay = 600 + Math.random() * 400;
    const timer = setTimeout(() => {
      const gs = gameStateRef.current;
      if (!gs || gs.currentTurn !== botColor) { botThinkingRef.current = false; return; }

      const move = botMove(gs.board, botColor, gs.history);
      if (!move) {
        // Bot passes
        playPassMove();
        setGameState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            consecutivePasses: prev.consecutivePasses + 1,
            currentTurn: prev.playerColor,
            lastMove: null,
          };
        });
      } else {
        const [r, c] = move;
        const result = placeStone(gs.board, r, c, botColor, gs.history);
        if (!result) { botThinkingRef.current = false; return; }
        playStonePlace();
        if (result.captured > 0) setTimeout(() => playStoneCapture(result.captured), 80);
        setGameState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            board: result.next,
            history: [...prev.history, boardKey(result.next)],
            currentTurn: prev.playerColor,
            capturedByBlack: botColor === 'black' ? prev.capturedByBlack + result.captured : prev.capturedByBlack,
            capturedByWhite: botColor === 'white' ? prev.capturedByWhite + result.captured : prev.capturedByWhite,
            consecutivePasses: 0,
            lastMove: [r, c],
          };
        });
      }
      botThinkingRef.current = false;
    }, delay);

    return () => { clearTimeout(timer); botThinkingRef.current = false; };
  }, [phase, gameState?.currentTurn, gameEnded]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handlePlayerMove = useCallback((row: number, col: number) => {
    const gs = gameStateRef.current;
    if (!gs || phase !== 'playing' || gameEnded) return;
    if (gs.currentTurn !== gs.playerColor) return;

    const result = placeStone(gs.board, row, col, gs.playerColor, gs.history);
    if (!result) {
      playIllegalMove();
      setIllegalFlash([row, col]);
      setTimeout(() => setIllegalFlash(null), 300);
      return;
    }

    playStonePlace();
    if (result.captured > 0) setTimeout(() => playStoneCapture(result.captured), 80);

    const botColor = gs.playerColor === 'black' ? 'white' : 'black';
    setGameState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        board: result.next,
        history: [...prev.history, boardKey(result.next)],
        currentTurn: botColor,
        capturedByBlack: gs.playerColor === 'black' ? prev.capturedByBlack + result.captured : prev.capturedByBlack,
        capturedByWhite: gs.playerColor === 'white' ? prev.capturedByWhite + result.captured : prev.capturedByWhite,
        consecutivePasses: 0,
        lastMove: [row, col],
      };
    });
  }, [phase, gameEnded]);

  const handlePass = useCallback(() => {
    const gs = gameStateRef.current;
    if (!gs || phase !== 'playing' || gameEnded) return;
    if (gs.currentTurn !== gs.playerColor) return;
    playPassMove();
    const botColor = gs.playerColor === 'black' ? 'white' : 'black';
    setGameState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        consecutivePasses: prev.consecutivePasses + 1,
        currentTurn: botColor,
        lastMove: null,
      };
    });
  }, [phase, gameEnded]);

  // ── Countdown ─────────────────────────────────────────────────────────────

  const runCountdown = useCallback((color: 'black' | 'white') => {
    let n = 3;
    setCountNum(n);
    const tick = () => {
      cdScale.setValue(1.5); cdOpacity.setValue(1);
      playCountdownBeep(n as 3 | 2 | 1);
      Animated.parallel([
        Animated.timing(cdScale,   { toValue: 1,   duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(cdOpacity, { toValue: 0.3, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]).start(() => {
        n--;
        if (n > 0) { setCountNum(n); tick(); }
        else {
          setCountNum(0);
          cdScale.setValue(1.8); cdOpacity.setValue(1);
          playCountdownGo();
          Animated.parallel([
            Animated.timing(cdScale,   { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(cdOpacity, { toValue: 0, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
          ]).start(() => {
            setInsertPhase(null);
            // start game with the color passed in, not state (avoids stale closure)
            const board = emptyBoard();
            const gs: GameState = {
              board,
              history: [boardKey(board)],
              currentTurn: 'black',
              playerColor: color,
              capturedByBlack: 0,
              capturedByWhite: 0,
              consecutivePasses: 0,
              startTime: Date.now(),
              lastMove: null,
            };
            setGameEnded(false);
            botThinkingRef.current = false;
            setGameState(gs);
            setFinalScores(null);
            setPhase('playing');
            setIsGamePlaying(true);
          });
        }
      });
    };
    tick();
  }, []);

  const runCoinAnimation = useCallback((color: 'black' | 'white') => {
    const targetY = area.h / 2 - 60;
    coinY.setValue(-60); coinScale.setValue(0.5); coinOpacity.setValue(1);
    setInsertPhase('coinanim');
    playCoinInsert();
    Animated.parallel([
      Animated.timing(coinY,     { toValue: targetY, duration: 520, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(coinScale, { toValue: 1.3,     duration: 520, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(coinScale,   { toValue: 0.2, duration: 180, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(coinOpacity, { toValue: 0,   duration: 80,  useNativeDriver: Platform.OS !== 'web' }),
      ]).start(() => {
        setInsertPhase('countdown');
        runCountdown(color);
      });
    });
  }, [area.h, runCountdown]);

  // ── Color draw ────────────────────────────────────────────────────────────

  const runColorDraw = useCallback((color: 'black' | 'white') => {
    setPhase('draw');
    setDrawAnim('spinning');
    spinValue.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spinValue, { toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    setTimeout(() => {
      loop.stop();
      setDrawAnim('reveal');
      revealOpa.setValue(0);
      Animated.timing(revealOpa, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }).start();
      setTimeout(() => {
        setDrawAnim(null);
        runCoinAnimation(color);
      }, 2200);
    }, 2000);
  }, [spinValue, revealOpa, runCoinAnimation]);

  const handleInsertCoin = useCallback(() => {
    if (!isSubscribed && coins <= 0) { router.push('/(app)/shop' as any); return; }
    if (!isSubscribed) spendCoin();
    const chosen: 'black' | 'white' = Math.random() < 0.5 ? 'black' : 'white';
    setPendingColor(chosen);
    runColorDraw(chosen);
  }, [isSubscribed, coins, spendCoin, runColorDraw]);

  const handleBackToMenu = useCallback(() => {
    setPhase('idle');
    setGameState(null);
    setInsertPhase(null);
    setFinalScores(null);
    setGameEnded(false);
    setIsGamePlaying(false);
    botThinkingRef.current = false;
  }, [setIsGamePlaying]);

  // ── Layout ────────────────────────────────────────────────────────────────

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 2) setArea({ w: width, h: height });
  };

  const preview = fitPreview(area.w, area.h);
  const isDemoLayout = phase === 'idle' || phase === 'draw';
  const boardSz = isDemoLayout
    ? Math.min(preview.w, preview.h) - 8
    : Math.min(area.w - 24, area.h - 180);
  const cellSize = (boardSz - 32) / (BOARD_N - 1);
  const sR = Math.max(7, cellSize * 0.44);

  // ── Board renderer ────────────────────────────────────────────────────────

  const renderBoard = useCallback((board: Board, interactive: boolean, sz: number) => {
    const pad = 16;
    const cell = (sz - pad * 2) / (BOARD_N - 1);
    const sr = Math.max(7, cell * 0.44);
    const gs = gameStateRef.current;
    return (
      <View style={[styles.boardContainer, { width: sz, height: sz }]}>
        {Array.from({ length: BOARD_N }, (_, i) => {
          const x = pad + i * cell, y = pad + i * cell;
          return (
            <React.Fragment key={i}>
              <View style={[styles.gridLine, { top: y, left: pad, width: sz - pad * 2, height: 1 }]} />
              <View style={[styles.gridLine, { left: x, top: pad, height: sz - pad * 2, width: 1 }]} />
            </React.Fragment>
          );
        })}
        {([2, 4, 6] as const).map((r) =>
          ([2, 4, 6] as const).map((c) => (
            <View key={`h${r}${c}`} style={[styles.hoshi, { top: pad + r * cell - 3, left: pad + c * cell - 3 }]} />
          ))
        )}
        {Array.from({ length: BOARD_N }, (_, r) =>
          Array.from({ length: BOARD_N }, (_, c) => {
            const stone = board[r][c];
            const isLast = gs?.lastMove?.[0] === r && gs?.lastMove?.[1] === c;
            const isIll  = illegalFlash?.[0] === r && illegalFlash?.[1] === c;
            const cx = pad + c * cell, cy = pad + r * cell;
            return (
              <Pressable
                key={`s${r}${c}`}
                onPress={interactive ? () => handlePlayerMove(r, c) : undefined}
                style={[styles.stoneTap, { left: cx - cell / 2, top: cy - cell / 2, width: cell, height: cell }]}
              >
                {stone && (
                  <View style={[
                    styles.stone,
                    stone === 'black' ? styles.stoneBlack : styles.stoneWhite,
                    { width: sr * 2, height: sr * 2, borderRadius: sr },
                    isLast ? styles.stoneLastMark : null,
                  ]}>
                    <View style={[
                      styles.stoneHighlight,
                      stone === 'black' ? styles.hlBlack : styles.hlWhite,
                      { width: sr * 0.48, height: sr * 0.48, borderRadius: sr * 0.24, top: sr * 0.15, left: sr * 0.2 },
                    ]} />
                    {isLast && (
                      <View style={[styles.lastDot, {
                        width: sr * 0.36, height: sr * 0.36, borderRadius: sr * 0.18,
                        backgroundColor: stone === 'black' ? '#FFF' : '#000',
                      }]} />
                    )}
                  </View>
                )}
                {isIll && (
                  <View style={[styles.illegalFlash, { width: sr * 1.8, height: sr * 1.8, borderRadius: sr * 0.9 }]} />
                )}
              </Pressable>
            );
          })
        )}
      </View>
    );
  }, [handlePlayerMove, illegalFlash]);

  // ── Render ────────────────────────────────────────────────────────────────

  const gs = gameState;
  const botColor = gs ? (gs.playerColor === 'black' ? 'white' : 'black') : 'white';
  const isBotTurn = gs ? gs.currentTurn === botColor : false;

  const spinRot = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.root} onLayout={onLayout}>

      {/* ── IDLE ── */}
      {phase === 'idle' && insertPhase === null && (
        <View style={styles.menuContainer}>
          <Text style={[styles.gameTitle, { fontFamily: MONO }]}>GO</Text>
          <Text style={[styles.gameSub,   { fontFamily: MONO }]}>ANCIENT STRATEGY</Text>

          <View style={styles.previewBox}>
            {renderBoard(demoBoard, false, Math.min(preview.w, preview.h))}
          </View>

          <Pressable
            onPress={handleInsertCoin}
            style={[styles.insertCoinBtn, !isSubscribed && coins === 0 && styles.insertCoinBtnDim]}
          >
            <ArcadeCoin size={20} />
            <Text style={[styles.insertCoinText, { fontFamily: MONO }]}>
              {isSubscribed ? 'PLAY' : coins > 0 ? 'INSERT COIN' : 'GET COINS'}
            </Text>
          </Pressable>

          {!isSubscribed && coins === 0 && (
            <Text style={[styles.noCoinsHint, { fontFamily: MONO }]}>NO COINS — VISIT SHOP</Text>
          )}
          <Text style={[styles.hint, { fontFamily: MONO }]}>TAP INTERSECTIONS TO PLACE STONES</Text>
          <Text style={[styles.hint, { fontFamily: MONO }]}>9×9 BOARD  •  CHINESE RULES  •  KOMI 6.5</Text>
        </View>
      )}

      {/* ── DRAW ── */}
      {phase === 'draw' && (
        <View style={styles.drawContainer}>
          <Text style={[styles.drawTitle, { fontFamily: MONO }]}>DRAWING COLORS</Text>
          <Text style={[styles.drawSub,   { fontFamily: MONO }]}>WHO PLAYS BLACK?</Text>

          {drawAnim === 'spinning' && (
            <View style={styles.drawStoneRow}>
              <Animated.View style={{ transform: [{ rotate: spinRot }] }}>
                <View style={[styles.stone, styles.stoneBlack, styles.bigStone]} />
              </Animated.View>
              <Animated.View style={{ transform: [{ rotate: spinRot }] }}>
                <View style={[styles.stone, styles.stoneWhite, styles.bigStone]} />
              </Animated.View>
            </View>
          )}

          {drawAnim === 'reveal' && (
            <Animated.View style={[styles.revealBox, { opacity: revealOpa }]}>
              <View style={[styles.stone, pendingColor === 'black' ? styles.stoneBlack : styles.stoneWhite, styles.bigStone]} />
              <Text style={[styles.revealText, { fontFamily: MONO }]}>
                YOU ARE {pendingColor.toUpperCase()}
              </Text>
              <Text style={[styles.revealSub, { fontFamily: MONO }]}>
                {pendingColor === 'black' ? 'YOU GO FIRST' : 'BOT GOES FIRST'}
              </Text>
            </Animated.View>
          )}
        </View>
      )}

      {/* ── PLAYING ── */}
      {phase === 'playing' && gs && (
        <View style={styles.playContainer}>
          <View style={styles.scoreBar}>
            <View style={styles.scoreItem}>
              <View style={[styles.stone, styles.stoneBlack, { width: 14, height: 14, borderRadius: 7 }]} />
              <Text style={[styles.scoreText, { fontFamily: MONO }]}>{gs.capturedByBlack} cap</Text>
            </View>
            <View style={styles.turnRow}>
              <Text style={[styles.turnText, { fontFamily: MONO }]}>
                {isBotTurn ? 'BOT...' : 'YOUR TURN'}
              </Text>
              <View style={[styles.turnDot, {
                backgroundColor: gs.currentTurn === 'black' ? '#000' : '#EEE',
                borderColor: '#666',
              }]} />
            </View>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreText, { fontFamily: MONO }]}>{gs.capturedByWhite} cap</Text>
              <View style={[styles.stone, styles.stoneWhite, { width: 14, height: 14, borderRadius: 7 }]} />
            </View>
          </View>

          <View style={styles.boardWrapper}>
            {renderBoard(gs.board, !isBotTurn, boardSz)}
          </View>

          <View style={styles.controlBar}>
            <Pressable
              onPress={handlePass}
              disabled={isBotTurn}
              style={[styles.passBtn, isBotTurn && styles.passBtnOff]}
            >
              <Text style={[styles.passBtnTxt, { fontFamily: MONO }]}>PASS</Text>
            </Pressable>
            <Pressable onPress={handleBackToMenu} style={styles.resignBtn}>
              <Text style={[styles.resignTxt, { fontFamily: MONO }]}>RESIGN</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── GAME OVER ── */}
      {phase === 'gameover' && gs && finalScores && insertPhase === null && (
        <View style={styles.goContainer}>
          <ScrollView contentContainerStyle={styles.goScroll} showsVerticalScrollIndicator={false}>
            <Text style={[styles.goTitle, { fontFamily: MONO }]}>GAME OVER</Text>
            {(() => {
              const won = gs.playerColor === 'black'
                ? finalScores.black > finalScores.white
                : finalScores.white > finalScores.black;
              return (
                <Text style={[styles.resultText, { fontFamily: MONO, color: won ? ACCENT : '#888' }]}>
                  {won ? 'YOU WIN!' : 'YOU LOSE'}
                </Text>
              );
            })()}
            <View style={styles.scoresRow}>
              <View style={styles.scoreCol}>
                <View style={[styles.stone, styles.stoneBlack, { width: 32, height: 32, borderRadius: 16 }]} />
                <Text style={[styles.bigScore, { fontFamily: MONO, color: gs.playerColor === 'black' ? ACCENT : '#CCC' }]}>
                  {finalScores.black.toFixed(1)}
                </Text>
                <Text style={[styles.scoreColLabel, { fontFamily: MONO }]}>
                  {gs.playerColor === 'black' ? 'YOU' : 'BOT'}
                </Text>
              </View>
              <Text style={[styles.vsText, { fontFamily: MONO }]}>VS</Text>
              <View style={styles.scoreCol}>
                <View style={[styles.stone, styles.stoneWhite, { width: 32, height: 32, borderRadius: 16 }]} />
                <Text style={[styles.bigScore, { fontFamily: MONO, color: gs.playerColor === 'white' ? ACCENT : '#CCC' }]}>
                  {finalScores.white.toFixed(1)}
                </Text>
                <Text style={[styles.scoreColLabel, { fontFamily: MONO }]}>
                  {gs.playerColor === 'white' ? 'YOU' : 'BOT'}
                </Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { fontFamily: MONO }]}>YOUR CAPTURES</Text>
              <Text style={[styles.statVal,   { fontFamily: MONO }]}>
                {gs.playerColor === 'black' ? gs.capturedByBlack : gs.capturedByWhite}
              </Text>
            </View>
            <View style={styles.btnRow}>
              <Pressable onPress={handleInsertCoin} style={styles.btn}>
                <Text style={[styles.btnTxt, { fontFamily: MONO }]}>
                  {isSubscribed || coins > 0 ? 'PLAY AGAIN' : 'GET COINS'}
                </Text>
              </Pressable>
              <Pressable onPress={handleBackToMenu} style={[styles.btn, styles.btnSecondary]}>
                <Text style={[styles.btnTxt, styles.btnSecondaryTxt, { fontFamily: MONO }]}>MENU</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      )}

      {/* ── Coin animation overlay ── */}
      {insertPhase === 'coinanim' && (
        <View
          style={[styles.insertOverlay, { width: area.w, height: area.h }]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.fallingCoin, {
            left: area.w / 2 - 28,
            transform: [{ translateY: coinY }, { scale: coinScale }],
            opacity: coinOpacity,
          }]}>
            <ArcadeCoin size={56} />
          </Animated.View>
        </View>
      )}

      {/* ── Countdown overlay ── */}
      {insertPhase === 'countdown' && (
        <View style={[styles.countdownOverlay, { width: area.w, height: area.h }]}>
          <Animated.Text style={[
            styles.countdownTxt, { fontFamily: MONO },
            { transform: [{ scale: cdScale }], opacity: cdOpacity },
          ]}>
            {countNum === 0 ? 'START' : String(countNum)}
          </Animated.Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const WOOD = '#C08840';
const WOOD_LINE = '#7A4F1A';
const WOOD_DARK = '#5A3510';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Menu
  menuContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 20 },
  gameTitle:  { color: '#FFF', fontSize: 44, fontWeight: '900', letterSpacing: 10 },
  gameSub:    { color: '#555', fontSize: 10, letterSpacing: 4, marginTop: -6 },
  previewBox: { marginVertical: 10 },
  insertCoinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: ACCENT,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 4, marginTop: 8,
  },
  insertCoinBtnDim: { borderColor: '#444' },
  insertCoinText: { color: ACCENT, fontSize: 14, fontWeight: '700', letterSpacing: 3 },
  noCoinsHint: { color: '#555', fontSize: 10, letterSpacing: 2 },
  hint: { color: '#333', fontSize: 9, letterSpacing: 2, marginTop: 2 },

  // Draw
  drawContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  drawTitle:   { color: ACCENT, fontSize: 20, fontWeight: '700', letterSpacing: 4 },
  drawSub:     { color: '#888', fontSize: 11, letterSpacing: 3 },
  drawStoneRow:{ flexDirection: 'row', gap: 32, marginTop: 20 },
  bigStone:    { width: 56, height: 56, borderRadius: 28 },
  revealBox:   { alignItems: 'center', gap: 14, marginTop: 16 },
  revealText:  { color: ACCENT, fontSize: 22, fontWeight: '800', letterSpacing: 4 },
  revealSub:   { color: '#888', fontSize: 12, letterSpacing: 3 },

  // Board
  boardContainer: {
    backgroundColor: WOOD, position: 'relative',
    borderWidth: 3, borderColor: WOOD_DARK, borderRadius: 4,
  },
  gridLine:    { position: 'absolute', backgroundColor: WOOD_LINE },
  hoshi:       { position: 'absolute', width: 7, height: 7, borderRadius: 3.5, backgroundColor: WOOD_DARK },
  stoneTap:    { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  stone:       { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  stoneBlack:  {
    backgroundColor: '#080808',
    shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 3, shadowOffset: { width: 1, height: 2 },
    elevation: 4,
  },
  stoneWhite:  {
    backgroundColor: '#EEEAE0',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 1, height: 1 },
    elevation: 2,
  },
  stoneHighlight: { position: 'absolute' },
  hlBlack: { backgroundColor: 'rgba(255,255,255,0.22)' },
  hlWhite: { backgroundColor: 'rgba(255,255,255,0.6)' },
  stoneLastMark: { borderWidth: 2, borderColor: 'rgba(255,200,0,0.85)' },
  lastDot:     { position: 'absolute' },
  illegalFlash:{ position: 'absolute', backgroundColor: 'rgba(255,50,50,0.55)' },

  // Playing
  playContainer: { flex: 1, alignItems: 'center' },
  scoreBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1A1A1A',
  },
  scoreItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreText:  { color: '#AAA', fontSize: 11, letterSpacing: 1 },
  turnRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  turnText:   { color: ACCENT, fontSize: 10, letterSpacing: 2 },
  turnDot:    { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  boardWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  controlBar: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1A1A1A',
    width: '100%',
  },
  passBtn:    {
    flex: 1, backgroundColor: '#0D0D0D', borderWidth: 1, borderColor: '#555',
    paddingVertical: 12, borderRadius: 4, alignItems: 'center',
  },
  passBtnOff: { borderColor: '#222', opacity: 0.4 },
  passBtnTxt: { color: '#CCC', fontSize: 12, letterSpacing: 3 },
  resignBtn:  {
    backgroundColor: '#160000', borderWidth: 1, borderColor: '#440000',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 4, alignItems: 'center',
  },
  resignTxt:  { color: '#CC4444', fontSize: 12, letterSpacing: 2 },

  // Game over
  goContainer: { flex: 1 },
  goScroll:    { alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 24, gap: 16 },
  goTitle:     { color: '#FFF', fontSize: 28, fontWeight: '800', letterSpacing: 6 },
  resultText:  { fontSize: 22, fontWeight: '700', letterSpacing: 4 },
  scoresRow:   { flexDirection: 'row', alignItems: 'center', gap: 24, marginVertical: 8 },
  scoreCol:    { alignItems: 'center', gap: 6 },
  bigScore:    { fontSize: 32, fontWeight: '800', letterSpacing: 2 },
  scoreColLabel: { color: '#666', fontSize: 10, letterSpacing: 2 },
  vsText:      { color: '#444', fontSize: 16, letterSpacing: 3 },
  statRow:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1A1A1A',
  },
  statLabel: { color: '#666', fontSize: 10, letterSpacing: 2 },
  statVal:   { color: '#CCC', fontSize: 16, letterSpacing: 1 },
  btnRow:    { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn:       {
    backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: ACCENT,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 4,
  },
  btnTxt:    { color: ACCENT, fontSize: 12, letterSpacing: 3 },
  btnSecondary: { borderColor: '#333' },
  btnSecondaryTxt: { color: '#888' },

  // Overlays
  insertOverlay:   { position: 'absolute', top: 0, left: 0, zIndex: 99 },
  fallingCoin:     { position: 'absolute', top: 0 },
  countdownOverlay:{
    position: 'absolute', top: 0, left: 0, zIndex: 100,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  countdownTxt: { color: ACCENT, fontSize: 88, fontWeight: '900', letterSpacing: 4 },
});
