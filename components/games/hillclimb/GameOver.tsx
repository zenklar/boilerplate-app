import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  distance: number;
  coinsCollected: number;
  deathReason: string;
  coinBalance: number;
  onRetry: () => void;
  onQuit: () => void;
}

const DEATH_MESSAGES: Record<string, string> = {
  fuel: '⛽ Out of fuel!',
  flipped: '💥 Car flipped!',
  backwards: '↩️ Rolled back!',
};

export default function GameOver({ distance, coinsCollected, deathReason, coinBalance, onRetry, onQuit }: Props) {
  const canRetry = coinBalance >= 1;
  const message = DEATH_MESSAGES[deathReason] ?? '🏁 Game Over!';

  return (
    <View style={styles.overlay}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.card}>
        <Text style={styles.deathMsg}>{message}</Text>

        <View style={styles.statsRow}>
          <Stat icon="map" label="Distance" value={`${distance} m`} />
          <View style={styles.divider} />
          <Stat icon="cash" label="Coins" value={String(coinsCollected)} accent="#FFD700" />
        </View>

        <Text style={styles.coinNote}>
          Next race costs <Text style={styles.coinBold}>1 🪙</Text>
          {'  '}Balance: <Text style={styles.coinBold}>{coinBalance} 🪙</Text>
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            onPress={onRetry}
            disabled={!canRetry}
            style={[styles.btn, styles.btnRetry, !canRetry && styles.btnDisabled]}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color={canRetry ? '#fff' : '#888'} />
            <Text style={[styles.btnText, !canRetry && styles.btnTextDisabled]}>
              {canRetry ? 'Play Again (1 🪙)' : 'Not enough coins'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onQuit} style={[styles.btn, styles.btnQuit]} activeOpacity={0.8}>
            <Ionicons name="exit-outline" size={20} color="#bbb" />
            <Text style={[styles.btnText, styles.btnTextQuit]}>Quit</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

function Stat({ icon, label, value, accent }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={22} color={accent ?? '#7EB8F7'} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16 },
      android: { elevation: 12 },
    }),
  },
  deathMsg: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stat: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  coinNote: {
    color: '#aaa',
    fontSize: 14,
  },
  coinBold: {
    color: '#FFD700',
    fontWeight: '700',
  },
  buttons: {
    width: '100%',
    gap: 10,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnRetry: {
    backgroundColor: '#2563EB',
  },
  btnQuit: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  btnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnTextQuit: {
    color: '#bbb',
  },
  btnTextDisabled: {
    color: '#666',
  },
});
