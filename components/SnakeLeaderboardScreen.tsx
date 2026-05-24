import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { useSnakeStore, SnakeRun } from '../store/snakeStore';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function RunRow({ run, index }: { run: SnakeRun; index: number }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowRank, { fontFamily: MONO }]}>
        #{index + 1}
      </Text>
      <Text style={[styles.rowScore, { fontFamily: MONO }]}>
        {run.score.toLocaleString()}
      </Text>
      <View style={styles.rowStats}>
        <Text style={[styles.rowStat, { fontFamily: MONO }]}>
          {run.foodEaten} <Text style={styles.rowStatLabel}>FOOD</Text>
        </Text>
        <Text style={[styles.rowStat, { fontFamily: MONO }]}>
          LV {run.level} <Text style={styles.rowStatLabel}>LEVEL</Text>
        </Text>
        <Text style={[styles.rowStat, { fontFamily: MONO }]}>
          {formatTime(run.durationMs)} <Text style={styles.rowStatLabel}>TIME</Text>
        </Text>
      </View>
    </View>
  );
}

export default function SnakeLeaderboardScreen() {
  const highScore    = useSnakeStore((s) => s.highScore);
  const runs         = useSnakeStore((s) => s.runs);
  const loadRuns     = useSnakeStore((s) => s.loadRuns);
  const loadHighScore = useSnakeStore((s) => s.loadHighScore);

  useEffect(() => { loadRuns(); loadHighScore(); }, []);

  return (
    <View style={styles.root}>
      <View style={styles.bestCard}>
        <View style={styles.bestLeft}>
          <Text style={[styles.bestLabel, { fontFamily: MONO }]}>BEST SCORE</Text>
          <Text style={[styles.bestScore, { fontFamily: MONO }]}>
            {highScore > 0 ? highScore.toLocaleString() : '—'}
          </Text>
        </View>
        <Text style={styles.bestStar}>★</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
        <Text style={[styles.sectionTitle, { fontFamily: MONO }]}>RECENT RUNS</Text>
        {runs.length === 0 ? (
          <Text style={[styles.empty, { fontFamily: MONO }]}>
            NO RUNS YET — INSERT COIN TO PLAY
          </Text>
        ) : (
          runs.map((run, i) => <RunRow key={run.id} run={run} index={i} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  bestCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  bestLeft:  { gap: 4 },
  bestLabel: { color: '#777', fontSize: 11, letterSpacing: 3 },
  bestScore: { color: '#FFD700', fontSize: 32, fontWeight: '800', letterSpacing: 2 },
  bestStar:  { color: '#FFD700', fontSize: 40 },

  scroll:      { flex: 1 },
  scrollInner: { padding: 16, gap: 8 },
  sectionTitle: { color: '#555', fontSize: 10, letterSpacing: 3, marginBottom: 4 },
  empty: {
    color: '#444', fontSize: 11, letterSpacing: 2,
    paddingVertical: 24, textAlign: 'center',
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#080808', borderRadius: 4,
    borderLeftWidth: 3, borderLeftColor: '#1A1A1A',
  },
  rowTop:      { borderLeftColor: '#FFD700', backgroundColor: '#0F0A00' },
  rowRank:     { color: '#555', fontSize: 11, width: 30, letterSpacing: 1 },
  rowTopText:  { color: '#999' },
  rowScore:    { color: '#EEE', fontSize: 18, fontWeight: '700', minWidth: 90, letterSpacing: 1 },
  rowTopScore: { color: '#FFF' },

  rowStats:    { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowStat:     { color: '#CCC', fontSize: 11, letterSpacing: 1 },
  rowStatLabel: { color: '#FFD700', fontSize: 9, letterSpacing: 1 },
});
