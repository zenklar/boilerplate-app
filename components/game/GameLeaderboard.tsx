import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

export type GameRun = {
  id: string;
  score: number;
  durationMs: number;
  date: number;
};

/** Per-game stat shown in each run row (e.g. LINES, FOOD, SHOTS). */
export type StatColumn<R extends GameRun> = {
  label: string;
  /** Return the cell value (already formatted) for this run. */
  value: (run: R) => string | number;
};

export type GameLeaderboardProps<R extends GameRun> = {
  highScore: number;
  runs: R[];
  /** Up to 3 stat columns shown on the right side of each row. */
  stats: StatColumn<R>[];
  /** Persistence loaders — called once on mount. */
  loadHighScore: () => Promise<void> | void;
  loadRuns: () => Promise<void> | void;
};

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Built-in TIME column — every game's leaderboard wants this. */
export function timeColumn<R extends GameRun>(): StatColumn<R> {
  return { label: 'TIME', value: (r) => formatTime(r.durationMs) };
}

export default function GameLeaderboard<R extends GameRun>({
  highScore, runs, stats, loadHighScore, loadRuns,
}: GameLeaderboardProps<R>) {
  useEffect(() => { loadHighScore(); loadRuns(); }, []);

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
          runs.map((run, i) => (
            <View key={run.id} style={styles.row}>
              <Text style={[styles.rowRank, { fontFamily: MONO }]}>#{i + 1}</Text>
              <Text style={[styles.rowScore, { fontFamily: MONO }]}>
                {run.score.toLocaleString()}
              </Text>
              <View style={styles.rowStats}>
                {stats.map((col) => (
                  <Text key={col.label} style={[styles.rowStat, { fontFamily: MONO }]}>
                    {col.value(run)}{' '}
                    <Text style={styles.rowStatLabel}>{col.label}</Text>
                  </Text>
                ))}
              </View>
            </View>
          ))
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
  bestLeft: { gap: 4 },
  bestLabel: { color: '#777', fontSize: 11, letterSpacing: 3 },
  bestScore: { color: '#FFD700', fontSize: 32, fontWeight: '800', letterSpacing: 2 },
  bestStar: { color: '#FFD700', fontSize: 40 },

  scroll: { flex: 1 },
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
  rowRank: { color: '#555', fontSize: 11, width: 30, letterSpacing: 1 },
  rowScore: { color: '#EEE', fontSize: 18, fontWeight: '700', minWidth: 90, letterSpacing: 1 },
  rowStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12 },
  rowStat: { color: '#CCC', fontSize: 11, letterSpacing: 1 },
  rowStatLabel: { color: '#FFD700', fontSize: 8, letterSpacing: 1 },
});
