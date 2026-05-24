import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGameUIStore } from '../../store/gameStore';
import { useCoinStore } from '../../store/coinStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import ArcadeCoin from '../../components/ArcadeCoin';
import AsteroidsGame from '../../components/AsteroidsGame';
import ShipSelectScreen from '../../components/ShipSelectScreen';
import LeaderboardScreen from '../../components/LeaderboardScreen';
import EnemyCodexScreen from '../../components/EnemyCodexScreen';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

type Tab = 'play' | 'ships' | 'enemies' | 'leaderboard';

const HEADER_H = 52;

const TAB_TITLES: Record<Tab, string> = {
  play: 'ASTEROIDS',
  ships: 'SELECT SHIP',
  enemies: 'ENEMY CODEX',
  leaderboard: 'LEADERBOARD',
};

export default function AsteroidsPage() {
  const [tab, setTab] = useState<Tab>('play');
  const isGamePlaying = useGameUIStore((s) => s.isGamePlaying);
  const coins = useCoinStore((s) => s.coins);
  const loadCoins = useCoinStore((s) => s.loadCoins);
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const loadSubscription = useSubscriptionStore((s) => s.loadSubscription);
  const insets = useSafeAreaInsets();

  useEffect(() => { loadCoins(); loadSubscription(); }, []);

  const chrome = !isGamePlaying;

  return (
    <View style={s.root}>
      {/* ── Fixed header — always the same height, hidden during play ── */}
      {chrome && (
        <View style={[s.header, { paddingTop: insets.top }]}>
          <Text style={[s.headerTitle, { fontFamily: MONO }]}>{TAB_TITLES[tab]}</Text>
          <View style={s.coinCounter}>
            <ArcadeCoin size={22} />
            <Text style={[s.coinCount, { fontFamily: MONO }, isSubscribed && { fontSize: 18, lineHeight: 20 }]}>
              {isSubscribed ? '∞' : coins}
            </Text>
          </View>
        </View>
      )}

      {/* ── Tab content ── */}
      <View style={s.content}>
        {tab === 'play'        && <AsteroidsGame />}
        {tab === 'ships'       && <ShipSelectScreen />}
        {tab === 'enemies'     && <EnemyCodexScreen />}
        {tab === 'leaderboard' && <LeaderboardScreen />}
      </View>

      {/* ── Game bottom bar — hidden during active play ── */}
      {chrome && (
        <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={s.tabs}>
            <Pressable style={s.tab} onPress={() => setTab('play')}>
              <Ionicons
                name={tab === 'play' ? 'game-controller' : 'game-controller-outline'}
                size={22}
                color={tab === 'play' ? '#FFD700' : '#777'}
              />
              <Text style={[s.tabLabel, { fontFamily: MONO }, tab === 'play' && s.tabActive]}>
                PLAY
              </Text>
            </Pressable>

            <Pressable style={s.tab} onPress={() => setTab('ships')}>
              <Ionicons
                name={tab === 'ships' ? 'rocket' : 'rocket-outline'}
                size={22}
                color={tab === 'ships' ? '#FFD700' : '#777'}
              />
              <Text style={[s.tabLabel, { fontFamily: MONO }, tab === 'ships' && s.tabActive]}>
                SHIPS
              </Text>
            </Pressable>

            <Pressable style={s.tab} onPress={() => setTab('enemies')}>
              <Ionicons
                name={tab === 'enemies' ? 'skull' : 'skull-outline'}
                size={22}
                color={tab === 'enemies' ? '#FFD700' : '#777'}
              />
              <Text style={[s.tabLabel, { fontFamily: MONO }, tab === 'enemies' && s.tabActive]}>
                ENEMIES
              </Text>
            </Pressable>

            <Pressable style={s.tab} onPress={() => setTab('leaderboard')}>
              <Ionicons
                name={tab === 'leaderboard' ? 'trophy' : 'trophy-outline'}
                size={22}
                color={tab === 'leaderboard' ? '#FFD700' : '#777'}
              />
              <Text style={[s.tabLabel, { fontFamily: MONO }, tab === 'leaderboard' && s.tabActive]}>
                SCORES
              </Text>
            </Pressable>
          </View>

          <Pressable style={s.exitBtn} onPress={() => router.replace('/(app)/home')}>
            <Ionicons name="close-circle-outline" size={20} color="#777" />
            <Text style={[s.exitLabel, { fontFamily: MONO }]}>EXIT</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  header: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#000',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A1A1A',
  },
  headerTitle: {
    color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 5,
  },
  coinCounter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  coinCount: { color: '#FFD700', fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  content: { flex: 1 },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#080808',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1A1A',
    paddingTop: 6,
    paddingHorizontal: 8,
  },
  tabs: { flex: 1, flexDirection: 'row' },
  tab: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, gap: 2 },
  tabLabel: { color: '#777', fontSize: 9, letterSpacing: 2 },
  tabActive: { color: '#FFD700' },

  exitBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5, paddingHorizontal: 14, paddingVertical: 8,
  },
  exitLabel: { color: '#777', fontSize: 10, letterSpacing: 2 },
});
