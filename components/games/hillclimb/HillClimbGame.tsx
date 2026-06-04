/**
 * HillClimbGame
 *
 * Rendered inside GameShell (no Modal wrapper). Phases:
 *   selecting  → CarSelect screen
 *   playing    → live game (hides GameShell chrome via isGamePlaying=true)
 *   dead       → result overlay on top of frozen game view
 *
 * Coin deduction uses the shared useCoinStore; infinite coins for subscribers.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, StyleSheet, Dimensions, Platform, TouchableOpacity,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useCoinStore } from '../../../store/coinStore';
import { useSubscriptionStore } from '../../../store/subscriptionStore';
import { useHillClimbStore } from '../../../store/hillClimbStore';
import { CARS } from './cars';
import { CarId, GameState, WorldCoin } from './types';
import { initialGameState, stepPhysics } from './physics';
import { terrainY, terrainAngle, buildTerrainPath, generateCoins, CAR_SCREEN_X_RATIO } from './terrain';
import GameControls from './GameControls';
import CarSelect from './CarSelect';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const { width: SW, height: SH } = Dimensions.get('window');
const GAME_HEIGHT = SH * 0.63;
const CAR_IMG_W = 160, CAR_IMG_H = 90;
const CAR_SCREEN_X = Math.round(SW * CAR_SCREEN_X_RATIO);
const COIN_R = 10;
const TOTAL_COINS = 120;

// ── HUD ────────────────────────────────────────────────────────────────────
interface HudProps { distanceM: number; fuelPct: number; coinsCollected: number; }
const Hud = React.memo(({ distanceM, fuelPct, coinsCollected }: HudProps) => {
  const fuelColor = fuelPct > 40 ? '#51CF66' : fuelPct > 20 ? '#FFD43B' : '#FF6B6B';
  return (
    <View style={hud.wrap} pointerEvents="none">
      <HudItem val={`${distanceM} m`} lbl="DISTANCE" />
      <View style={hud.sep} />
      <View style={hud.item}>
        <View style={hud.fuelBar}>
          <View style={[hud.fuelFill, { width: `${fuelPct}%` as any, backgroundColor: fuelColor }]} />
        </View>
        <Text style={hud.lbl}>FUEL</Text>
      </View>
      <View style={hud.sep} />
      <HudItem val={`🪙 ${coinsCollected}`} lbl="COINS" accent="#FFD700" />
    </View>
  );
});

function HudItem({ val, lbl, accent }: { val: string; lbl: string; accent?: string }) {
  return (
    <View style={hud.item}>
      <Text style={[hud.val, accent ? { color: accent } : {}]}>{val}</Text>
      <Text style={hud.lbl}>{lbl}</Text>
    </View>
  );
}

// ── Dead overlay ────────────────────────────────────────────────────────────
const DEATH_MSG: Record<string, string> = {
  fuel: '⛽ Out of Fuel!', flipped: '💥 Car Flipped!', backwards: '↩️ Rolled Back!',
};

function DeadOverlay({ gs, onRetry, onQuit }: { gs: GameState; onRetry: () => void; onQuit: () => void }) {
  const coins = useCoinStore(s => s.coins);
  const isSubscribed = useSubscriptionStore(s => s.isSubscribed);
  const canRetry = isSubscribed || coins >= 1;
  return (
    <View style={dead.overlay}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={dead.card}>
        <Text style={dead.msg}>{DEATH_MSG[gs.deathReason] ?? '🏁 Game Over!'}</Text>
        <View style={dead.stats}>
          <View style={dead.stat}>
            <Ionicons name="map" size={20} color="#7EB8F7" />
            <Text style={dead.statVal}>{gs.distance} m</Text>
            <Text style={dead.statLbl}>DISTANCE</Text>
          </View>
          <View style={dead.divider} />
          <View style={dead.stat}>
            <Ionicons name="cash" size={20} color="#FFD700" />
            <Text style={[dead.statVal, { color: '#FFD700' }]}>{gs.coinsCollected}</Text>
            <Text style={dead.statLbl}>COINS</Text>
          </View>
        </View>
        {!isSubscribed && (
          <Text style={dead.note}>
            Balance: <Text style={{ color: '#FFD700', fontWeight: '700' }}>{coins} 🪙</Text>
            {'  ·  '}1 coin per race
          </Text>
        )}
        <TouchableOpacity onPress={canRetry ? onRetry : () => router.push('/(app)/shop' as any)}
          style={[dead.btn, { backgroundColor: canRetry ? '#2563EB' : '#444' }]} activeOpacity={0.85}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={dead.btnTxt}>{canRetry ? (isSubscribed ? 'Play Again' : 'Play Again (1 🪙)') : 'Get Coins'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onQuit} style={dead.quitBtn} activeOpacity={0.8}>
          <Ionicons name="exit-outline" size={18} color="#999" />
          <Text style={dead.quitTxt}>Quit</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

// ── Main game component ─────────────────────────────────────────────────────
type Phase = 'selecting' | 'playing' | 'dead';
interface ScreenCoin { x: number; y: number; }

export default function HillClimbGame() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('selecting');
  const [selectedCarId, setSelectedCarId] = useState<CarId>('jeep');
  const [terrainPath, setTerrainPath] = useState('');
  const [screenCoins, setScreenCoins] = useState<ScreenCoin[]>([]);
  const [hudState, setHudState] = useState<HudProps>({ distanceM: 0, fuelPct: 100, coinsCollected: 0 });
  const [deadState, setDeadState] = useState<GameState | null>(null);

  const spendCoin = useCoinStore(s => s.spendCoin);
  const addCoins = useCoinStore(s => s.addCoins);
  const isSubscribed = useSubscriptionStore(s => s.isSubscribed);
  const setIsGamePlaying = useHillClimbStore(s => s.setIsGamePlaying);
  const addRun = useHillClimbStore(s => s.addRun);

  const gameRef = useRef<GameState>(initialGameState());
  const coinsRef = useRef<WorldCoin[]>([]);
  const gasRef = useRef(false);
  const brakeRef = useRef(false);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const carIdRef = useRef<CarId>('jeep');

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

  const startLoop = useCallback(() => {
    const car = CARS.find(c => c.id === carIdRef.current) ?? CARS[0];
    gameRef.current = initialGameState();
    coinsRef.current = generateCoins(TOTAL_COINS, GAME_HEIGHT).map(c => ({ ...c, collected: false }));
    frameRef.current = 0; lastTsRef.current = 0;
    gasRef.current = false; brakeRef.current = false;

    const loop = (ts: number) => {
      const dt = lastTsRef.current === 0 ? 0.016 : Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;
      frameRef.current++;

      const next = stepPhysics(gameRef.current, {
        gasPressed: gasRef.current, brakePressed: brakeRef.current,
        car, gameHeight: GAME_HEIGHT, coins: coinsRef.current,
      }, dt);
      gameRef.current = next;

      const cameraX = next.carWorldX - CAR_SCREEN_X;
      carTop.value = terrainY(next.carWorldX, GAME_HEIGHT) - CAR_IMG_H + 10;
      carRotDeg.value = terrainAngle(next.carWorldX, GAME_HEIGHT) * (180 / Math.PI);

      if (frameRef.current % 2 === 0) {
        setTerrainPath(buildTerrainPath(cameraX, SW, GAME_HEIGHT));
        setScreenCoins(
          coinsRef.current
            .filter(c => !c.collected && c.worldX >= cameraX - 60 && c.worldX <= cameraX + SW + 60)
            .map(c => ({ x: c.worldX - cameraX, y: c.worldY })),
        );
        setHudState({ distanceM: next.distance, fuelPct: Math.round(next.fuel), coinsCollected: next.coinsCollected });
      }

      if (next.phase === 'dead') {
        setIsGamePlaying(false);
        setDeadState(next);
        setPhase('dead');
        if (next.coinsCollected > 0) addCoins(next.coinsCollected);
        addRun({
          id: Date.now().toString(),
          distance: next.distance,
          coinsCollected: next.coinsCollected,
          carId: carIdRef.current,
          date: Date.now(),
        });
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [carTop, carRotDeg, setIsGamePlaying, addCoins, addRun]);

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); setIsGamePlaying(false); }, [setIsGamePlaying]);

  const handlePlay = useCallback((carId: CarId) => {
    if (!isSubscribed) {
      const ok = spendCoin();
      if (!ok) { router.push('/(app)/shop' as any); return; }
    }
    carIdRef.current = carId;
    setSelectedCarId(carId);
    setIsGamePlaying(true);
    setPhase('playing');
    setTimeout(() => startLoop(), 50);
  }, [isSubscribed, spendCoin, setIsGamePlaying, startLoop]);

  const handleRetry = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (!isSubscribed) {
      const ok = spendCoin();
      if (!ok) { router.push('/(app)/shop' as any); return; }
    }
    setIsGamePlaying(true);
    setPhase('playing');
    setTimeout(() => startLoop(), 50);
  }, [isSubscribed, spendCoin, setIsGamePlaying, startLoop]);

  const handleQuit = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setIsGamePlaying(false);
    setPhase('selecting');
  }, [setIsGamePlaying]);

  const selectedCar = CARS.find(c => c.id === selectedCarId) ?? CARS[0];
  const ctrlH = 140 + Math.max(insets.bottom, 12);

  if (phase === 'selecting') return <CarSelect onPlay={handlePlay} />;

  return (
    <View style={st.screen}>
      {/* Sky + terrain + car */}
      <LinearGradient colors={['#87CEEB', '#B8E4F9', '#D5EEF9']} style={[st.canvas, { height: GAME_HEIGHT }]}>
        <View style={st.farHills} pointerEvents="none" />

        <Svg width={SW} height={GAME_HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGrad id="tg" x1="0" y1={GAME_HEIGHT * 0.3} x2="0" y2={GAME_HEIGHT} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#4a7c59" />
              <Stop offset="0.35" stopColor="#5a8a4a" />
              <Stop offset="1" stopColor="#3d2b1f" />
            </SvgGrad>
          </Defs>
          {terrainPath !== '' && (
            <>
              <Path d={terrainPath} fill="url(#tg)" />
              <Path d={terrainPath} fill="none" stroke="#2d5a1b" strokeWidth={2.5} />
            </>
          )}
          {screenCoins.map((c, i) => (
            <G key={i} transform={`translate(${c.x},${c.y})`}>
              <Circle r={COIN_R} fill="#FFD700" />
              <Circle r={COIN_R - 3} fill="#FFC107" />
              <Circle r={4} fill="#FFE66D" />
            </G>
          ))}
        </Svg>

        <AnimatedImage source={selectedCar.image} style={animStyle} resizeMode="contain" />
        <Hud {...hudState} />
      </LinearGradient>

      {/* Controls */}
      <View style={[st.controls, { height: ctrlH, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <GameControls
          onGasStart={() => { gasRef.current = true; }}
          onGasEnd={() => { gasRef.current = false; }}
          onBrakeStart={() => { brakeRef.current = true; }}
          onBrakeEnd={() => { brakeRef.current = false; }}
        />
      </View>

      {phase === 'dead' && deadState && (
        <DeadOverlay gs={deadState} onRetry={handleRetry} onQuit={handleQuit} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0d1117' },
  canvas: { overflow: 'hidden' },
  farHills: {
    position: 'absolute', bottom: 0, left: -40, right: -40,
    height: '52%', backgroundColor: '#c8dea8',
    borderTopLeftRadius: 9999, borderTopRightRadius: 9999, opacity: 0.28,
  },
  controls: { backgroundColor: '#0d1117', justifyContent: 'flex-start' },
});
const hud = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)', paddingHorizontal: 16, paddingVertical: 10, gap: 12,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  val: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  lbl: { color: '#aaa', fontSize: 9, fontWeight: '600', letterSpacing: 1.5 },
  sep: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  fuelBar: { width: 80, height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' },
  fuelFill: { height: '100%', borderRadius: 4 },
});
const dead = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  card: {
    width: '100%', borderRadius: 20, padding: 28, alignItems: 'center', gap: 18,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16 },
      android: { elevation: 12 },
    }),
  },
  msg: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center' },
  stats: {
    flexDirection: 'row', alignItems: 'center', gap: 24,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24, width: '100%', justifyContent: 'center',
  },
  divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.15)' },
  stat: { alignItems: 'center', gap: 4, flex: 1 },
  statVal: { color: '#fff', fontSize: 22, fontWeight: '800' },
  statLbl: { color: '#999', fontSize: 12, fontWeight: '500' },
  note: { color: '#aaa', fontSize: 13 },
  btn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 14,
  },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  quitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 24,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  quitTxt: { color: '#bbb', fontSize: 15, fontWeight: '600' },
});
