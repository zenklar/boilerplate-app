import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCoinStore } from '../../store/coinStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import ArcadeCoin from '../ArcadeCoin';

/**
 * Per-game tab descriptor. Used by GameShell to render the bottom tab bar.
 * Every game gets PLAY and SCORES for free — provide extras (ships, enemies,
 * etc.) via the `extraTabs` prop.
 */
export type GameTab<TabId extends string> = {
  id: TabId;
  label: string;                                  // Bottom-bar label, e.g. "PLAY"
  title: string;                                  // Header title, e.g. "TETRIS"
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
};

export const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
export const GAME_ACCENT = '#FFD700';
const HEADER_H = 52;

export type GameShellProps<TabId extends string> = {
  /** Whether actual gameplay is in progress — hides chrome (header + bar). */
  isGamePlaying: boolean;
  /** Currently selected tab. */
  tab: TabId;
  setTab: (t: TabId) => void;
  /** Ordered tabs shown in the bottom bar. Always include 'play' and 'leaderboard'. */
  tabs: GameTab<TabId>[];
  /** Tab content; the caller renders the right component for the active tab. */
  children: React.ReactNode;
};

/**
 * Standard chrome for every game: header (title + coin counter) and bottom
 * tab bar (PLAY · …extras… · SCORES · EXIT). Hidden automatically during
 * active gameplay so the game itself owns the screen.
 */
export default function GameShell<TabId extends string>({
  isGamePlaying, tab, setTab, tabs, children,
}: GameShellProps<TabId>) {
  const insets = useSafeAreaInsets();
  const coins = useCoinStore((s) => s.coins);
  const loadCoins = useCoinStore((s) => s.loadCoins);
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const loadSubscription = useSubscriptionStore((s) => s.loadSubscription);

  useEffect(() => { loadCoins(); loadSubscription(); }, []);

  const chrome = !isGamePlaying;
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <View style={s.root}>
      {chrome && (
        <View style={[s.header, { paddingTop: insets.top }]}>
          <Text style={[s.headerTitle, { fontFamily: MONO }]}>{current.title}</Text>
          <View style={s.coinCounter}>
            <ArcadeCoin size={22} />
            <Text style={[
              s.coinCount,
              { fontFamily: MONO },
              isSubscribed && { fontSize: 18, lineHeight: 20 },
            ]}>
              {isSubscribed ? '∞' : coins}
            </Text>
          </View>
        </View>
      )}

      <View
        style={[
          s.content,
          // When chrome is hidden the canvas would otherwise extend under the
          // Android status bar and the iOS notch / Android gesture bar.
          // Specify both branches explicitly so Yoga clears the padding when
          // toggling — conditional spreads can leave stale values on Android.
          {
            paddingTop: !chrome ? insets.top : 0,
            paddingBottom: !chrome ? insets.bottom : 0,
          },
        ]}
      >
        {children}
      </View>

      {chrome && (
        <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={s.tabs}>
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <Pressable key={t.id} style={s.tab} onPress={() => setTab(t.id)}>
                  <Ionicons
                    name={active ? t.iconActive : t.iconInactive}
                    size={22}
                    color={active ? GAME_ACCENT : '#777'}
                  />
                  <Text style={[s.tabLabel, { fontFamily: MONO }, active && s.tabActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
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
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 5 },
  coinCounter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coinCount: { color: GAME_ACCENT, fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  content: { flex: 1 },

  bar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#080808',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1A1A1A',
    paddingTop: 6, paddingHorizontal: 8,
  },
  tabs: { flex: 1, flexDirection: 'row' },
  tab: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, gap: 2 },
  tabLabel: { color: '#777', fontSize: 9, letterSpacing: 2 },
  tabActive: { color: GAME_ACCENT },

  exitBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5, paddingHorizontal: 14, paddingVertical: 8,
  },
  exitLabel: { color: '#777', fontSize: 10, letterSpacing: 2 },
});
