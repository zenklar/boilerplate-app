import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGameUIStore } from '../../store/gameStore';
import AsteroidsGame from '../../components/AsteroidsGame';
import ShipSelectScreen from '../../components/ShipSelectScreen';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

type Tab = 'play' | 'ships';

export default function AsteroidsPage() {
  const [tab, setTab] = useState<Tab>('play');
  const isGamePlaying = useGameUIStore((s) => s.isGamePlaying);
  const insets = useSafeAreaInsets();

  return (
    <View style={s.root}>
      <View style={s.content}>
        {tab === 'play' ? <AsteroidsGame /> : <ShipSelectScreen />}
      </View>

      {!isGamePlaying && (
        <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {/* Tabs */}
          <View style={s.tabs}>
            <Pressable style={[s.tab, tab === 'play' && s.tabActive]} onPress={() => setTab('play')}>
              <Ionicons name={tab === 'play' ? 'game-controller' : 'game-controller-outline'} size={22} color={tab === 'play' ? '#4FC3F7' : '#444'} />
              <Text style={[s.tabLabel, { fontFamily: MONO }, tab === 'play' && s.tabLabelActive]}>PLAY</Text>
            </Pressable>
            <Pressable style={[s.tab, tab === 'ships' && s.tabActive]} onPress={() => setTab('ships')}>
              <Ionicons name={tab === 'ships' ? 'rocket' : 'rocket-outline'} size={22} color={tab === 'ships' ? '#4FC3F7' : '#444'} />
              <Text style={[s.tabLabel, { fontFamily: MONO }, tab === 'ships' && s.tabLabelActive]}>SHIPS</Text>
            </Pressable>
          </View>

          {/* Exit */}
          <Pressable style={s.exitBtn} onPress={() => router.replace('/(app)/home')}>
            <Ionicons name="close-circle-outline" size={20} color="#555" />
            <Text style={[s.exitLabel, { fontFamily: MONO }]}>EXIT</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
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
  tabs: { flex: 1, flexDirection: 'row', gap: 4 },
  tab: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 6, gap: 2 },
  tabActive: {},
  tabLabel: { color: '#444', fontSize: 9, letterSpacing: 2 },
  tabLabelActive: { color: '#4FC3F7' },
  exitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  exitLabel: { color: '#555', fontSize: 10, letterSpacing: 2 },
});
