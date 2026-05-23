import React from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView,
  TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { GAME_LIST, GameEntry } from '../../constants/gameList';

const COLS = 3;
const TILE_GAP = 10;
const H_PAD = 14;

function GameTile({ game, tileW }: { game: GameEntry; tileW: number }) {
  const { theme } = useTheme();
  const tileH = Math.round(tileW * 1.38);

  const handlePress = () => {
    if (game.available && game.route) router.push(game.route as any);
  };

  return (
    <TouchableOpacity
      activeOpacity={game.available ? 0.75 : 1}
      onPress={handlePress}
      style={[
        st.tile,
        { width: tileW, borderRadius: theme.radius.md, borderColor: theme.colors.cardBorder },
        theme.mode === 'light' && {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 3,
        },
      ]}
    >
      {/* Cover image */}
      <Image
        source={game.image}
        style={[st.tileImage, { height: tileH, borderRadius: theme.radius.md }]}
        resizeMode="cover"
      />

      {/* Accent colour strip along bottom of image */}
      <View style={[st.accentStrip, { backgroundColor: game.accentColor, borderRadius: theme.radius.md }]} />

      {/* SOON badge */}
      {!game.available && (
        <View style={[st.soonBadge, { backgroundColor: theme.colors.backgroundSecondary + 'EE' }]}>
          <Text style={[st.soonTxt, { color: theme.colors.textMuted }]}>SOON</Text>
        </View>
      )}

      {/* Play button overlay for available games */}
      {game.available && (
        <View style={[st.playOverlay, { borderColor: game.accentColor + '99' }]}>
          <Ionicons name="play-circle" size={28} color={game.accentColor} />
        </View>
      )}

      {/* Title below image */}
      <View style={[st.tileLabel, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
        <Text
          style={[st.tileTitle, { color: game.available ? theme.colors.text : theme.colors.textMuted }]}
          numberOfLines={2}
        >
          {game.title}
        </Text>
        <Text style={[st.tileMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
          {game.year !== '—' ? game.year : game.genre}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { width: screenW } = useWindowDimensions();

  const tileW = Math.floor((screenW - H_PAD * 2 - TILE_GAP * (COLS - 1)) / COLS);

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[st.scroll, { paddingBottom: theme.spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header section */}
        <LinearGradient
          colors={theme.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={st.heroBanner}
        >
          <View style={st.heroContent}>
            <Text style={st.heroLabel}>ARCADE</Text>
            <Text style={st.heroTitle}>Game Library</Text>
            <Text style={st.heroSub}>Classic games reimagined for mobile</Text>
          </View>
          <View style={st.heroIcon}>
            <Ionicons name="game-controller" size={52} color="rgba(255,255,255,0.25)" />
          </View>
        </LinearGradient>

        {/* Section header */}
        <View style={st.sectionHeader}>
          <Text style={[st.sectionTitle, { color: theme.colors.textMuted }]}>ALL GAMES</Text>
          <View style={[st.sectionBadge, { backgroundColor: theme.colors.backgroundSecondary }]}>
            <Text style={[st.sectionBadgeTxt, { color: theme.colors.textMuted }]}>
              {GAME_LIST.filter(g => g.available).length} available
            </Text>
          </View>
        </View>

        {/* Grid */}
        <View style={[st.grid, { paddingHorizontal: H_PAD, gap: TILE_GAP }]}>
          {GAME_LIST.map((game) => (
            <GameTile key={game.id} game={game} tileW={tileW} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 0 },

  heroBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroContent: { flex: 1 },
  heroLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 4,
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12, fontWeight: '400',
  },
  heroIcon: { marginLeft: 12 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
  },
  sectionBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20,
  },
  sectionBadgeTxt: { fontSize: 11, fontWeight: '500' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  tile: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  tileImage: {
    width: '100%',
  },
  accentStrip: {
    position: 'absolute',
    bottom: 58,   // above the label area
    left: 0, right: 0, height: 3,
  },
  soonBadge: {
    position: 'absolute',
    top: 8, right: 8,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6,
  },
  soonTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  playOverlay: {
    position: 'absolute',
    top: 8, right: 8,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  tileLabel: {
    paddingHorizontal: 8, paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 1,
  },
  tileTitle: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
  tileMeta: { fontSize: 9, fontWeight: '400' },
});
