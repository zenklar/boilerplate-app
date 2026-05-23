import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { useGameUIStore, RunRecord } from '../store/gameStore';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function RunRow({ run, index }: { run: RunRecord; index: number }) {
  const isTop = index === 0;
  return (
    <View style={[styles.row, isTop && styles.rowTop]}>
      <Text style={[styles.rowRank, { fontFamily: MONO }, isTop && styles.rowTopText]}>
        #{index + 1}
      </Text>
      <Text style={[styles.rowScore, { fontFamily: MONO }, isTop && styles.rowTopScore]}>
        {run.score.toLocaleString()}
      </Text>
      <View style={styles.rowStats}>
        <Text style={[styles.rowStat, { fontFamily: MONO }]}>
          {run.bulletsShot} <Text style={styles.rowStatLabel}>SHOTS</Text>
        </Text>
        <Text style={[styles.rowStat, { fontFamily: MONO }]}>
          {run.asteroidsDestroyed} <Text style={styles.rowStatLabel}>ASTEROIDS</Text>
        </Text>
        <Text style={[styles.rowStat, { fontFamily: MONO }]}>
          {formatTime(run.durationMs)} <Text style={styles.rowStatLabel}>TIME</Text>
        </Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const highScore = useGameUIStore((s) => s.highScore);
  const runs = useGameUIStore((s) => s.runs);
  const loadRuns = useGameUIStore((s) => s.loadRuns);

  useEffect(() => { loadRuns(); }, []);

  return (
    <View style={styles.root}>
      {/* Best score card */}
      <View style={styles.bestCard}>
        <View style={styles.bestLeft}>
          <Text style={[styles.bestLabel, { fontFamily: MONO }]}>BEST SCORE</Text>
          <Text style={[styles.bestScore, { fontFamily: MONO }]}>
            {highScore > 0 ? highScore.toLocaleString() : '—'}
          </Text>
        </View>
        <Text style={styles.bestStar}>★</Text>
      </View>

      {/* Run history */}
      {runs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { fontFamily: MONO }]}>NO RUNS YET</Text>
          <Text style={[styles.emptyHint, { fontFamily: MONO }]}>
            PLAY A GAME TO SEE YOUR STATS
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={[styles.sectionLabel, { fontFamily: MONO }]}>
            LAST {runs.length} RUN{runs.length !== 1 ? 'S' : ''}
          </Text>
          {runs.map((run, i) => (
            <RunRow key={run.id} run={run} index={i} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  bestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#0A1520',
    borderWidth: 1.5,
    borderColor: '#4FC3F7',
    borderRadius: 4,
  },
  bestLeft: { gap: 4 },
  bestLabel: { color: '#4FC3F7', fontSize: 9, letterSpacing: 3 },
  bestScore: { color: '#FFF', fontSize: 36, fontWeight: '700', letterSpacing: 2 },
  bestStar: { color: '#4FC3F7', fontSize: 32, opacity: 0.6 },

  sectionLabel: {
    color: '#666', fontSize: 10, letterSpacing: 3,
    marginBottom: 8, marginHorizontal: 2,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingTop: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 4,
    gap: 10,
  },
  rowTop: {
    backgroundColor: '#0D0D0D',
    borderColor: '#2A2A2A',
  },
  rowRank: {
    color: '#666', fontSize: 10, letterSpacing: 1,
    width: 28,
  },
  rowTopText: { color: '#999' },
  rowScore: {
    color: '#AAA', fontSize: 16, fontWeight: '700', letterSpacing: 1,
    width: 72,
  },
  rowTopScore: { color: '#FFF' },
  rowStats: {
    flex: 1, flexDirection: 'row', justifyContent: 'space-between',
  },
  rowStat: { color: '#DDD', fontSize: 10, letterSpacing: 0.5 },
  rowStatLabel: { color: '#4FC3F7', fontSize: 8 },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  emptyText: { color: '#555', fontSize: 13, letterSpacing: 4 },
  emptyHint: { color: '#444', fontSize: 9, letterSpacing: 2 },
});
