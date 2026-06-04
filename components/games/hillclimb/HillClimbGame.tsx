/**
 * HillClimbGame — full-screen portrait Hill Climb Racing clone.
 *
 * Rendered inside a React Native Modal so it covers the app header/nav.
 * Physics run at ~60 fps via requestAnimationFrame; Reanimated shared
 * values drive smooth car animation; terrain SVG and HUD update at ~30 fps.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Modal,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgGrad,
  Stop,
  Circle,
  G,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CARS } from './cars';
import { CarId, GameState, WorldCoin } from './types';
import { initialGameState, stepPhysics } from './physics';
import {
  terrainY,
  terrainAngle,
  buildTerrainPath,
  generateCoins,
  CAR_SCREEN_X_RATIO,
} from './terrain';
import GameControls from './GameControls';
import GameOver from './GameOver';
import CarSelect from './CarSelect';

// Animated Image (created once at module level)
const AnimatedImage = Animated.createAnimatedComponent(Image);

const { width: SW, height: SH } = Dimensions.get('window');

/** Fraction of screen height used for the scrolling game canvas. */
const GAME_HEIGHT = SH * 0.62;

/** PNG asset dimensions (matches the generated 160×90 car PNGs). */
const CAR_IMG_W = 160;
const CAR_IMG_H = 90;

/** Screen X coordinate at which the car is always drawn. */
const CAR_SCREEN_X = Math.round(SW * CAR_SCREEN_X_RATIO);

const COIN_RADIUS = 10;
const TOTAL_COINS = 120;

// ─────────────────────────────────────────────────────────────────────────────
// HUD (memoised, updated ~30 fps via React state)
// ─────────────────────────────────────────────────────────────────────────────

interface HudState {
  distanceM: number;
  fuelPct: number;
  coinsCollected: number;
}

const Hud = React.memo(function Hud({ distanceM, fuelPct, coinsCollected }: HudState) {
  const fuelColor = fuelPct > 40 ? '#51CF66' : fuelPct > 20 ? '#FFD43B' : '#FF6B6B';
  return (
    <View style={hud.container} pointerEvents="none">
      <View style={hud.item}>
        <Text style={hud.val}>{distanceM} m</Text>
        <Text style={hud.lbl}>DISTANCE</Text>
      </View>
      <View style={hud.sep} />
      <View style={hud.item}>
        <View style={hud.fuelBar}>
          <View style={[hud.fuelFill, { width: `${fuelPct}%` as any, backgroundColor: fuelColor }]} />
        </View>
        <Text style={hud.lbl}>FUEL</Text>
      </View>
      <View style={hud.sep} />
      <View style={hud.item}>
        <Text style={[hud.val, { color: '#FFD700' }]}>🪙 {coinsCollected}</Text>
        <Text style={hud.lbl}>COINS</Text>
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export interface RaceResult {
  distance: number;
  coinsCollected: number;
}

interface Props {
  visible: boolean;
  coinBalance: number;
  onClose: () => void;
  /** Called once per race start to deduct 1 coin. */
  onCoinSpend: () => void;
  /** Called at race end with results (coins may be 0). */
  onRaceEnd: (result: RaceResult) => void;
}

type Phase = 'selecting' | 'playing' | 'dead';
interface ScreenCoin { x: number; y: number; }

export default function HillClimbGame({
  visible,
  coinBalance,
  onClose,
  onCoinSpend,
  onRaceEnd,
}: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('selecting');
  const [selectedCarId, setSelectedCarId] = useState<CarId>('jeep');
  const [hudState, setHudState] = useState<HudState>({ distanceM: 0, fuelPct: 100, coinsCollected: 0 });
  const [terrainPath, setTerrainPath] = useState('');
  const [screenCoins, setScreenCoins] = useState<ScreenCoin[]>([]);
  const [deadState, setDeadState] = useState<GameState | null>(null);

  // Mutable game refs — mutated in RAF without triggering React re-renders
  const gameRef = useRef<GameState>(initialGameState());
  const coinsRef = useRef<WorldCoin[]>([]);
  const gasRef = useRef(false);
  const brakeRef = useRef(false);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const carIdRef = useRef<CarId>('jeep');

  // Keep prop callbacks in a ref so the RAF closure never goes stale
  const propsRef = useRef({ onCoinSpend, onRaceEnd, onClose });
  propsRef.current = { onCoinSpend, onRaceEnd, onClose };

  // Reanimated shared values for smooth 60-fps car animation
  const carTop = useSharedValue(300);
  const carRotDeg = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: carTop.value,
    left: CAR_SCREEN_X - CAR_IMG_W / 2,
    width: CAR_IMG_W,
    height: CAR_IMG_H,
    transform: [{ rotate: `${carRotDeg.value}deg` }],
  }));

  // ── Game loop ────────────────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    const car = CARS.find((c) => c.id === carIdRef.current) ?? CARS[0];
    gameRef.current = initialGameState();
    coinsRef.current = generateCoins(TOTAL_COINS, GAME_HEIGHT).map((c) => ({
      ...c,
      collected: false,
    }));
    frameRef.current = 0;
    lastTsRef.current = 0;
    gasRef.current = false;
    brakeRef.current = false;

    const loop = (ts: number) => {
      const dt = lastTsRef.current === 0
        ? 0.016
        : Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;
      frameRef.current++;

      const next = stepPhysics(
        gameRef.current,
        {
          gasPressed: gasRef.current,
          brakePressed: brakeRef.current,
          car,
          gameHeight: GAME_HEIGHT,
          coins: coinsRef.current,
        },
        dt,
      );
      gameRef.current = next;

      // Camera follows car horizontally
      const cameraX = next.carWorldX - CAR_SCREEN_X;
      const ty = terrainY(next.carWorldX, GAME_HEIGHT);
      const angle = terrainAngle(next.carWorldX, GAME_HEIGHT);

      // Update Reanimated shared values — driven on UI thread, no re-render needed
      carTop.value = ty - CAR_IMG_H + 10;
      carRotDeg.value = angle * (180 / Math.PI);

      // Update terrain + HUD every 2nd frame (~30 fps)
      if (frameRef.current % 2 === 0) {
        const path = buildTerrainPath(cameraX, SW, GAME_HEIGHT);
        const coins: ScreenCoin[] = coinsRef.current
          .filter(
            (c) =>
              !c.collected &&
              c.worldX >= cameraX - 60 &&
              c.worldX <= cameraX + SW + 60,
          )
          .map((c) => ({ x: c.worldX - cameraX, y: c.worldY }));

        setTerrainPath(path);
        setScreenCoins(coins);
        setHudState({
          distanceM: next.distance,
          fuelPct: Math.round(next.fuel),
          coinsCollected: next.coinsCollected,
        });
      }

      if (next.phase === 'dead') {
        setDeadState(next);
        setPhase('dead');
        propsRef.current.onRaceEnd({ distance: next.distance, coinsCollected: next.coinsCollected });
        return; // stop loop
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [carTop, carRotDeg]);

  // Stop loop when modal hides
  useEffect(() => {
    if (!visible) cancelAnimationFrame(rafRef.current);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePlay = useCallback(
    (carId: CarId) => {
      propsRef.current.onCoinSpend();
      carIdRef.current = carId;
      setSelectedCarId(carId);
      setPhase('playing');
      setTimeout(() => startLoop(), 50);
    },
    [startLoop],
  );

  const handleRetry = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    propsRef.current.onCoinSpend();
    setPhase('playing');
    setTimeout(() => startLoop(), 50);
  }, [startLoop]);

  const handleQuit = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setPhase('selecting');
  }, []);

  const handleClose = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setPhase('selecting');
    propsRef.current.onClose();
  }, []);

  const selectedCar = CARS.find((c) => c.id === selectedCarId) ?? CARS[0];
  const controlsHeight = 140 + Math.max(insets.bottom, 12);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {phase === 'selecting' && (
        <CarSelect
          coinBalance={coinBalance}
          onPlay={handlePlay}
          onClose={handleClose}
        />
      )}

      {(phase === 'playing' || phase === 'dead') && (
        <View style={styles.screen}>
          {/* ── Sky + scrolling terrain + car ─────────────────────────── */}
          <LinearGradient
            colors={['#87CEEB', '#B8E4F9', '#D5EEF9']}
            style={[styles.gameCanvas, { height: GAME_HEIGHT }]}
          >
            {/* Distant hills decorative layer */}
            <View style={styles.farHills} pointerEvents="none" />

            {/* Procedural terrain + coin SVG overlay */}
            <Svg width={SW} height={GAME_HEIGHT} style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgGrad
                  id="tg"
                  x1="0"
                  y1={GAME_HEIGHT * 0.3}
                  x2="0"
                  y2={GAME_HEIGHT}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor="#4a7c59" />
                  <Stop offset="0.35" stopColor="#5a8a4a" />
                  <Stop offset="1" stopColor="#3d2b1f" />
                </SvgGrad>
              </Defs>

              {terrainPath !== '' && (
                <>
                  <Path d={terrainPath} fill="url(#tg)" />
                  <Path
                    d={terrainPath}
                    fill="none"
                    stroke="#2d5a1b"
                    strokeWidth={2.5}
                  />
                </>
              )}

              {screenCoins.map((coin, i) => (
                <G key={i} transform={`translate(${coin.x}, ${coin.y})`}>
                  <Circle r={COIN_RADIUS} fill="#FFD700" />
                  <Circle r={COIN_RADIUS - 3} fill="#FFC107" />
                  <Circle r={4} fill="#FFE66D" />
                </G>
              ))}
            </Svg>

            {/* Car — animated via Reanimated shared values */}
            <AnimatedImage
              source={selectedCar.image}
              style={animStyle}
              resizeMode="contain"
            />

            {/* HUD overlay */}
            <Hud {...hudState} />
          </LinearGradient>

          {/* ── Controls ─────────────────────────────────────────────── */}
          <View
            style={[
              styles.controlsArea,
              {
                height: controlsHeight,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <GameControls
              onGasStart={() => {
                gasRef.current = true;
              }}
              onGasEnd={() => {
                gasRef.current = false;
              }}
              onBrakeStart={() => {
                brakeRef.current = true;
              }}
              onBrakeEnd={() => {
                brakeRef.current = false;
              }}
            />
          </View>

          {/* ── Game Over overlay ─────────────────────────────────────── */}
          {phase === 'dead' && deadState && (
            <GameOver
              distance={deadState.distance}
              coinsCollected={deadState.coinsCollected}
              deathReason={deadState.deathReason}
              coinBalance={coinBalance}
              onRetry={handleRetry}
              onQuit={handleQuit}
            />
          )}
        </View>
      )}
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  gameCanvas: {
    overflow: 'hidden',
  },
  farHills: {
    position: 'absolute',
    bottom: 0,
    left: -40,
    right: -40,
    height: '52%',
    backgroundColor: '#c8dea8',
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    opacity: 0.28,
  },
  controlsArea: {
    backgroundColor: '#0d1117',
    justifyContent: 'flex-start',
  },
});

const hud = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  val: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  lbl: {
    color: '#aaa',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  sep: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  fuelBar: {
    width: 80,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fuelFill: {
    height: '100%',
    borderRadius: 4,
  },
});
