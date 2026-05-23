import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGameUIStore } from '../../store/gameStore';
import AsteroidsGame from '../../components/AsteroidsGame';
import ShipSelectScreen from '../../components/ShipSelectScreen';
import LeaderboardScreen from '../../components/LeaderboardScreen';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

type Tab = 'play' | 'ships' | 'leaderboard';

const HEADER_H = 52;

const TAB_TITLES: Record<Tab, string> = {
  play: 'ASTEROIDS',
  ships: 'SELECT SHIP',
  leaderboard: 'LEADERBOARD',
};

export default function AsteroidsPage() {
  const [tab, setTab] = useState<Tab>('play');
  const isGamePlaying = useGameUIStore((s) => s.isGamePlaying);
  const insets = useSafeAreaInsets();

  const chrome = !isGamePlaying;

  return (
    <View style={s.root}>
      {/* ── Fixed header — always the same height, hidden during play ── */}
      {chrome && (
        <View style={[s.header, { paddingTop: insets.top }]}>
          <Text style={[s.headerTitle, { fontFamily: MONO }]}>{TAB_TITLES[tab]}</Text>
        </View>
      )}

      {/* ── Tab content ── */}
      <View style={s.content}>
        {tab === 'play'        && <AsteroidsGame />}
        {tab === 'ships'       && <ShipSelectScreen />}
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
                color={tab === 'play' ? '#4FC3F7' : '#777'}
              />
              <Text style={[s.tabLabel, { fontFamily: MONO }, tab === 'play' && s.tabActive]}>
                PLAY
              </Text>
            </Pressable>

            <Pressable style={s.tab} onPress={() => setTab('ships')}>
              <Ionicons
                name={tab === 'ships' ? 'rocket' : 'rocket-outline'}
                size={22}
                color={tab === 'ships' ? '#4FC3F7' : '#777'}
              />
              <Text style={[s.tabLabel, { fontFamily: MONO }, tab === 'ships' && s.tabActive]}>
                SHIPS
              </Text>
            </Pressable>

            <Pressable style={s.tab} onPress={() => setTab('leaderboard')}>
              <Ionicons
                name={tab === 'leaderboard' ? 'trophy' : 'trophy-outline'}
                size={22}
                color={tab === 'leaderboard' ? '#4FC3F7' : '#777'}
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
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#000',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A1A1A',
  },
  headerTitle: {
    color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 5,
  },

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
  tabActive: { color: '#4FC3F7' },

  exitBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5, paddingHorizontal: 14, paddingVertical: 8,
  },
  exitLabel: { color: '#777', fontSize: 10, letterSpacing: 2 },
});
