import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCoinStore } from '../../store/coinStore';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

type Pack = {
  id: string;
  label: string;
  coins: number;
  bonus: string;
  color: string;
  symbol: string;
  tag?: string;
};

const PACKS: Pack[] = [
  {
    id: 'starter',
    label: 'STARTER',
    coins: 10,
    bonus: '10 PLAYS',
    color: '#4FC3F7',
    symbol: '⊙',
  },
  {
    id: 'regular',
    label: 'REGULAR',
    coins: 100,
    bonus: '100 PLAYS',
    color: '#FFD700',
    symbol: '⊛',
    tag: 'POPULAR',
  },
  {
    id: 'mega',
    label: 'MEGA PACK',
    coins: 1000,
    bonus: '1000 PLAYS',
    color: '#FF6D00',
    symbol: '✦',
    tag: 'BEST VALUE',
  },
];

function CoinStack({ color, count }: { color: string; count: number }) {
  const layers = Math.min(count <= 10 ? 2 : count <= 100 ? 4 : 6, 6);
  return (
    <View style={cs.stack}>
      {Array.from({ length: layers }).map((_, i) => (
        <View
          key={i}
          style={[
            cs.stackCoin,
            {
              backgroundColor: color,
              borderColor: shadeColor(color, -30),
              bottom: i * 5,
              zIndex: i,
              opacity: 0.7 + (i / layers) * 0.3,
            },
          ]}
        >
          {i === layers - 1 && (
            <Text style={[cs.stackCoinText, { color: shadeColor(color, -50) }]}>C</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function shadeColor(hex: string, pct: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + pct));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + pct));
  const b = Math.min(255, Math.max(0, (n & 0xff) + pct));
  return `rgb(${r},${g},${b})`;
}

export default function ShopScreen() {
  const coins = useCoinStore((s) => s.coins);
  const addCoins = useCoinStore((s) => s.addCoins);
  const loadCoins = useCoinStore((s) => s.loadCoins);
  const insets = useSafeAreaInsets();
  const [claimed, setClaimed] = useState<string | null>(null);

  useEffect(() => { loadCoins(); }, []);

  const handleClaim = (pack: Pack) => {
    addCoins(pack.coins);
    setClaimed(pack.id);
    setTimeout(() => setClaimed(null), 1800);
  };

  return (
    <View style={[cs.root, { paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={cs.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Coin balance */}
        <View style={cs.balanceCard}>
          <View style={cs.coinBadgeLg}>
            <Text style={cs.coinBadgeLetter}>C</Text>
          </View>
          <View style={cs.balanceRight}>
            <Text style={[cs.balanceLabel, { fontFamily: MONO }]}>YOUR COINS</Text>
            <Text style={[cs.balanceValue, { fontFamily: MONO }]}>
              {coins.toLocaleString()}
            </Text>
          </View>
        </View>

        <Text style={[cs.sectionLabel, { fontFamily: MONO }]}>COIN PACKS</Text>
        <Text style={[cs.sectionHint, { fontFamily: MONO }]}>
          1 COIN = 1 PLAY SESSION · FREE TO CLAIM NOW
        </Text>

        {PACKS.map((pack) => {
          const isClaimed = claimed === pack.id;
          return (
            <View key={pack.id} style={[cs.packCard, { borderColor: pack.color + '55' }]}>
              {/* Top accent */}
              <View style={[cs.packAccent, { backgroundColor: pack.color }]} />

              {pack.tag && (
                <View style={[cs.packTag, { backgroundColor: pack.color + '22', borderColor: pack.color + '66' }]}>
                  <Text style={[cs.packTagTxt, { fontFamily: MONO, color: pack.color }]}>
                    {pack.tag}
                  </Text>
                </View>
              )}

              <View style={cs.packBody}>
                <CoinStack color={pack.color} count={pack.coins} />

                <View style={cs.packInfo}>
                  <Text style={[cs.packLabel, { fontFamily: MONO }]}>{pack.label}</Text>
                  <View style={cs.packCoinsRow}>
                    <View style={[cs.coinBadgeSm, { backgroundColor: pack.color, borderColor: shadeColor(pack.color, -30) }]}>
                      <Text style={[cs.coinBadgeSmTxt, { color: shadeColor(pack.color, -60) }]}>C</Text>
                    </View>
                    <Text style={[cs.packCoinCount, { fontFamily: MONO, color: pack.color }]}>
                      {pack.coins.toLocaleString()}
                    </Text>
                    <Text style={[cs.packCoinUnit, { fontFamily: MONO }]}>COINS</Text>
                  </View>
                  <Text style={[cs.packBonus, { fontFamily: MONO }]}>{pack.bonus}</Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  cs.claimBtn,
                  { borderColor: pack.color },
                  isClaimed && { backgroundColor: pack.color + '22' },
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => handleClaim(pack)}
              >
                <Text style={[cs.claimBtnTxt, { fontFamily: MONO, color: isClaimed ? pack.color : '#FFF' }]}>
                  {isClaimed ? `✓  +${pack.coins} ADDED` : 'CLAIM FREE'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        <Text style={[cs.footerNote, { fontFamily: MONO }]}>
          IN-APP PURCHASES COMING SOON
        </Text>
      </ScrollView>
    </View>
  );
}

const cs = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 16, gap: 14 },

  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#0A0E14',
    borderWidth: 1.5,
    borderColor: '#FFD70055',
    borderRadius: 6,
    padding: 18,
    marginBottom: 6,
  },
  coinBadgeLg: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFD700',
    borderWidth: 2, borderColor: '#B8860B',
    alignItems: 'center', justifyContent: 'center',
  },
  coinBadgeLetter: { color: '#6B4500', fontSize: 20, fontWeight: '900' },
  balanceRight: { gap: 4 },
  balanceLabel: { color: '#888', fontSize: 9, letterSpacing: 3 },
  balanceValue: { color: '#FFD700', fontSize: 32, fontWeight: '700', letterSpacing: 2 },

  sectionLabel: { color: '#666', fontSize: 9, letterSpacing: 4, marginTop: 4 },
  sectionHint: { color: '#444', fontSize: 8, letterSpacing: 1, marginTop: 2, marginBottom: 4 },

  packCard: {
    backgroundColor: '#080808',
    borderWidth: 1.5,
    borderRadius: 6,
    overflow: 'hidden',
  },
  packAccent: { height: 3 },
  packTag: {
    alignSelf: 'flex-start',
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 2,
  },
  packTagTxt: { fontSize: 7, letterSpacing: 2, fontWeight: '700' },

  packBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    padding: 16,
    paddingTop: 12,
  },

  // Coin stack illustration
  stack: { width: 52, height: 58, position: 'relative' },
  stackCoin: {
    position: 'absolute',
    width: 46, height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    left: 3,
  },
  stackCoinText: { fontSize: 16, fontWeight: '900' },

  packInfo: { flex: 1, gap: 6 },
  packLabel: { color: '#FFF', fontSize: 13, fontWeight: '700', letterSpacing: 3 },
  packCoinsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coinBadgeSm: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  coinBadgeSmTxt: { fontSize: 8, fontWeight: '900' },
  packCoinCount: { fontSize: 22, fontWeight: '700', letterSpacing: 1 },
  packCoinUnit: { color: '#666', fontSize: 9, letterSpacing: 2, alignSelf: 'flex-end', marginBottom: 3 },
  packBonus: { color: '#555', fontSize: 8, letterSpacing: 1 },

  claimBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: 'center',
  },
  claimBtnTxt: { fontSize: 12, letterSpacing: 4, fontWeight: '700' },

  footerNote: {
    color: '#2A2A2A', fontSize: 8, letterSpacing: 2,
    textAlign: 'center', marginTop: 8, marginBottom: 4,
  },
});
