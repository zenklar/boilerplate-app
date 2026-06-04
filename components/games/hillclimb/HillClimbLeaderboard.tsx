import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHillClimbStore } from '../../../store/hillClimbStore';
import { CARS } from './cars';

export default function HillClimbLeaderboard() {
  const { runs, bestDistance, load } = useHillClimbStore();
  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Personal best */}
      <View style={s.bestCard}>
        <Ionicons name="trophy" size={28} color="#FFD700" />
        <View>
          <Text style={s.bestLbl}>PERSONAL BEST</Text>
          <Text style={s.bestVal}>{bestDistance} m</Text>
        </View>
      </View>

      {/* Run history */}
      <Text style={s.sectionTitle}>RECENT RUNS</Text>
      {runs.length === 0 && (
        <Text style={s.empty}>No runs yet — get in the car!</Text>
      )}
      {runs.map((run, i) => {
        const car = CARS.find(c => c.id === run.carId);
        const date = new Date(run.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return (
          <View key={run.id} style={s.row}>
            <Text style={s.rank}>#{i + 1}</Text>
            <View style={s.rowInfo}>
              <Text style={s.rowDist}>{run.distance} m</Text>
              <Text style={s.rowMeta}>{car?.name ?? run.carId}  ·  {date}</Text>
            </View>
            <View style={s.rowCoins}>
              <Text style={s.rowCoinTxt}>🪙 {run.coinsCollected}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117' },
  content: { padding: 20, gap: 10, paddingBottom: 40 },
  bestCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
    padding: 20, marginBottom: 8,
  },
  bestLbl: { color: '#FFD700', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  bestVal: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  sectionTitle: { color: '#445', fontSize: 10, fontWeight: '700', letterSpacing: 2.5, marginTop: 4 },
  empty: { color: '#556', fontSize: 14, textAlign: 'center', marginTop: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  rank: { color: '#556', fontSize: 14, fontWeight: '700', width: 28 },
  rowInfo: { flex: 1 },
  rowDist: { color: '#fff', fontSize: 17, fontWeight: '800' },
  rowMeta: { color: '#667', fontSize: 12, marginTop: 1 },
  rowCoins: {
    backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  rowCoinTxt: { color: '#FFD700', fontSize: 13, fontWeight: '600' },
});
