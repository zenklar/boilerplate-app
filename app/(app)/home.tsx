import React from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

type Game = {
  id: string;
  title: string;
  symbol: string;
  color: string;
  year: string;
  genre: string;
  route?: string;
  available: boolean;
};

const GAMES: Game[] = [
  { id: 'asteroids', title: 'ASTEROIDS', symbol: '◈', color: '#4FC3F7', year: '1979', genre: 'ARCADE', route: '/game/asteroids', available: true },
  { id: 'invaders',  title: 'INVADERS',  symbol: '◉', color: '#69F0AE', year: '—',    genre: 'ARCADE', available: false },
  { id: 'snake',     title: 'SNAKE',     symbol: '⬡', color: '#FFD54F', year: '—',    genre: 'PUZZLE', available: false },
  { id: 'blocks',    title: 'BLOCKS',    symbol: '▦', color: '#FF8A65', year: '—',    genre: 'PUZZLE', available: false },
];

function GameCard({ game }: { game: Game }) {
  const handlePress = () => {
    if (game.available && game.route) router.push(game.route as any);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        s.card,
        game.available && { borderColor: game.color + '55', borderWidth: 1.5 },
        game.available && pressed && { opacity: 0.8 },
      ]}
      onPress={handlePress}
      disabled={!game.available}
    >
      {/* Top accent bar */}
      <View style={[s.cardAccent, { backgroundColor: game.available ? game.color : '#1A1A1A' }]} />

      <View style={s.cardBody}>
        {/* Icon */}
        <Text style={[s.cardSymbol, { color: game.available ? game.color : '#2A2A2A' }]}>
          {game.symbol}
        </Text>

        {/* Name */}
        <Text style={[s.cardTitle, { fontFamily: MONO, color: game.available ? '#FFF' : '#333' }]}>
          {game.title}
        </Text>

        {/* Meta */}
        <Text style={[s.cardMeta, { fontFamily: MONO }]}>
          {game.available ? `${game.year} · ${game.genre}` : game.genre}
        </Text>

        {/* Coming soon badge */}
        {!game.available && (
          <View style={s.badge}>
            <Text style={[s.badgeTxt, { fontFamily: MONO }]}>SOON</Text>
          </View>
        )}

        {/* Play prompt for available games */}
        {game.available && (
          <View style={s.playPill}>
            <Text style={[s.playPillTxt, { fontFamily: MONO, color: game.color }]}>▶ PLAY</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.heading, { fontFamily: MONO }]}>ARCADE</Text>
        <View style={s.grid}>
          {GAMES.map((g) => <GameCard key={g.id} game={g} />)}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 16, gap: 0 },
  heading: {
    color: '#222', fontSize: 11, letterSpacing: 6, fontWeight: '700',
    marginBottom: 16, marginLeft: 2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47.5%',
    backgroundColor: '#080808',
    borderWidth: 1, borderColor: '#1A1A1A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  cardAccent: { height: 3, width: '100%' },
  cardBody: { padding: 16, gap: 6 },
  cardSymbol: { fontSize: 36, lineHeight: 44 },
  cardTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 3, color: '#FFF' },
  cardMeta: { color: '#444', fontSize: 8, letterSpacing: 2 },
  badge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 2,
  },
  badgeTxt: { color: '#333', fontSize: 7, letterSpacing: 2 },
  playPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  playPillTxt: { fontSize: 9, letterSpacing: 2, fontWeight: '700' },
});
