import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useCoinStore } from '../../store/coinStore';
import HillClimbGame, { RaceResult } from '../../components/games/hillclimb/HillClimbGame';
import { CARS } from '../../components/games/hillclimb/cars';

export default function Home() {
  const { theme } = useTheme();
  const { balance, load, spendCoins, addCoins } = useCoinStore();
  const [gameVisible, setGameVisible] = useState(false);
  const [lastScore, setLastScore] = useState<{ distance: number; coins: number } | null>(null);

  useEffect(() => { load(); }, [load]);

  const handleCoinSpend = () => spendCoins(1);

  const handleRaceEnd = (result: RaceResult) => {
    if (result.coinsCollected > 0) addCoins(result.coinsCollected);
    setLastScore({ distance: result.distance, coins: result.coinsCollected });
  };

  const handlePlay = () => {
    if (balance < 1) return;
    setGameVisible(true);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero card ──────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#0d1b2a', '#1b2838', '#162032']}
        style={styles.heroCard}
      >
        {/* Background stars effect */}
        <View style={styles.starsLayer} pointerEvents="none">
          {STARS.map((s, i) => (
            <View key={i} style={[styles.star, { top: s.top, left: s.left, width: s.size, height: s.size, opacity: s.op }]} />
          ))}
        </View>

        <Text style={styles.gameTitle}>Hill Climb Racing</Text>
        <Text style={styles.gameTagline}>Drive. Conquer. Survive.</Text>

        {/* Car preview row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carPreviewRow}
          style={styles.carPreviewScroll}
        >
          {CARS.map((car) => (
            <View key={car.id} style={styles.carThumb}>
              <Image source={car.image} style={styles.carThumbImg} resizeMode="contain" />
              <Text style={[styles.carThumbName, { color: car.color }]}>{car.name}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Cost + balance info */}
        <View style={styles.costRow}>
          <View style={styles.costBadge}>
            <Ionicons name="cash-outline" size={16} color="#FFD700" />
            <Text style={styles.costText}>1 coin per race</Text>
          </View>
          <View style={styles.balanceBadge}>
            <Text style={styles.balanceText}>Balance: {balance} 🪙</Text>
          </View>
        </View>

        {/* Play button */}
        <TouchableOpacity
          onPress={handlePlay}
          disabled={balance < 1}
          activeOpacity={0.85}
          style={[styles.playBtn, balance < 1 && styles.playBtnDisabled]}
        >
          <LinearGradient
            colors={balance >= 1 ? ['#2ecc71', '#27ae60'] : ['#555', '#444']}
            style={styles.playBtnGrad}
          >
            <Ionicons name="play-circle" size={26} color="#fff" />
            <Text style={styles.playBtnText}>
              {balance >= 1 ? 'Play Now' : 'Not enough coins'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Last run result ────────────────────────────────────────────── */}
      {lastScore && (
        <View style={[styles.lastRunCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <Text style={[styles.lastRunTitle, { color: theme.colors.text }]}>Last Run</Text>
          <View style={styles.lastRunRow}>
            <Stat icon="map-outline" label="Distance" value={`${lastScore.distance} m`} color={theme.colors.primary} />
            <Stat icon="cash-outline" label="Coins Earned" value={`+${lastScore.coins} 🪙`} color="#FFD700" />
          </View>
        </View>
      )}

      {/* ── Tips ──────────────────────────────────────────────────────── */}
      <View style={[styles.tipsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
        <Text style={[styles.tipsTitle, { color: theme.colors.textMuted }]}>HOW TO PLAY</Text>
        <Tip icon="arrow-forward-circle-outline" color="#51CF66" text="Hold GAS to accelerate and climb hills" />
        <Tip icon="arrow-back-circle-outline" color="#FF6B6B" text="Hold BRAKE to slow down or reverse" />
        <Tip icon="cash-outline" color="#FFD700" text="Collect gold coins for bonus rewards" />
        <Tip icon="flash-outline" color="#74C0FC" text="Watch your fuel — run out and it's over!" />
        <Tip icon="warning-outline" color="#FF922B" text="Tip your car and the race ends" />
      </View>

      {/* Full-screen game modal */}
      <HillClimbGame
        visible={gameVisible}
        coinBalance={balance}
        onClose={() => setGameVisible(false)}
        onCoinSpend={handleCoinSpend}
        onRaceEnd={handleRaceEnd}
      />
    </ScrollView>
  );
}

function Stat({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tip({ icon, color, text }: { icon: string; color: string; text: string }) {
  return (
    <View style={styles.tipRow}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

// Decorative star positions (static, avoids random on re-render)
const STARS = [
  { top: '8%', left: '12%', size: 2, op: 0.6 },
  { top: '15%', left: '75%', size: 3, op: 0.8 },
  { top: '22%', left: '45%', size: 2, op: 0.5 },
  { top: '5%', left: '60%', size: 2, op: 0.7 },
  { top: '30%', left: '88%', size: 2, op: 0.4 },
  { top: '12%', left: '30%', size: 3, op: 0.6 },
  { top: '18%', left: '90%', size: 2, op: 0.5 },
  { top: '35%', left: '20%', size: 2, op: 0.3 },
  { top: '6%', left: '50%', size: 2, op: 0.7 },
  { top: '25%', left: '8%', size: 3, op: 0.5 },
] as const;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    gap: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  starsLayer: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 99,
  },
  gameTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  gameTagline: {
    color: '#8899bb',
    fontSize: 14,
    fontWeight: '500',
    marginTop: -8,
  },
  carPreviewScroll: {
    marginHorizontal: -4,
  },
  carPreviewRow: {
    gap: 8,
    paddingHorizontal: 4,
  },
  carThumb: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 8,
    gap: 4,
  },
  carThumbImg: {
    width: 80,
    height: 45,
  },
  carThumbName: {
    fontSize: 11,
    fontWeight: '700',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  costText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  balanceText: {
    color: '#aab',
    fontSize: 13,
    fontWeight: '600',
  },
  playBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  playBtnDisabled: {
    opacity: 0.5,
  },
  playBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  playBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  lastRunCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  lastRunTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  lastRunRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  tipsCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  tipsTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 2,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipText: {
    flex: 1,
    color: '#777',
    fontSize: 13,
    lineHeight: 18,
  },
});
