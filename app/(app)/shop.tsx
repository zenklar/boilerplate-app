import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useCoinStore } from '../../store/coinStore';
import ArcadeCoin from '../../components/ArcadeCoin';

/* ── Pack data ──────────────────────────────────────────────────────── */
type Pack = {
  id: string;
  label: string;
  coins: number;
  price: string;
  perCoin: string;
};

const PACKS: Pack[] = [
  {
    id: 'small',
    label: 'Small Coin Pack',
    coins: 10,
    price: '$0.99',
    perCoin: '$0.099 / coin',
  },
  {
    id: 'medium',
    label: 'Medium Coin Pack',
    coins: 100,
    price: '$4.99',
    perCoin: '$0.049 / coin  ·  2× better value',
  },
  {
    id: 'large',
    label: 'Large Coin Pack',
    coins: 1000,
    price: '$9.99',
    perCoin: '$0.009 / coin  ·  10× better value',
  },
];

/* ── Main screen ────────────────────────────────────────────────────── */
export default function ShopScreen() {
  const { theme } = useTheme();
  const addCoins = useCoinStore((s) => s.addCoins);
  const [claimed, setClaimed] = useState<string | null>(null);

  const handleClaim = (pack: Pack) => {
    addCoins(pack.coins);
    setClaimed(pack.id);
    setTimeout(() => setClaimed(null), 2000);
  };

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[st.scroll, { paddingBottom: theme.spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section header ── */}
        <Text style={[st.sectionTitle, { color: theme.colors.textMuted }]}>
          COIN PACKS
        </Text>

        {/* ── Pack cards ── */}
        {PACKS.map((pack) => {
          const isClaimed = claimed === pack.id;
          const isLarge = pack.id === 'large';

          return (
            <View
              key={pack.id}
              style={[st.packCard, {
                backgroundColor: theme.colors.card,
                borderColor: isLarge ? '#FFD70055' : theme.colors.cardBorder,
                borderWidth: isLarge ? 1.5 : StyleSheet.hairlineWidth,
                ...(theme.mode === 'light' ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.07,
                  shadowRadius: 4,
                  elevation: 2,
                } : {}),
              }]}
            >
              <View style={st.packInner}>
                {/* Info */}
                <View style={st.packInfo}>
                  <Text style={[st.packLabel, { color: theme.colors.text }]}>
                    {pack.label}
                  </Text>
                  <View style={st.packCoinRow}>
                    <ArcadeCoin size={20} />
                    <Text style={[st.packCoinCount, { color: '#FFD700' }]}>
                      {pack.coins.toLocaleString()}
                    </Text>
                    <Text style={[st.packCoinUnit, { color: theme.colors.textMuted }]}>
                      coins
                    </Text>
                  </View>
                  <Text style={[st.packPerCoin, { color: theme.colors.textMuted }]}>
                    {pack.perCoin}
                  </Text>
                </View>

                {/* Buy button */}
                <TouchableOpacity
                  onPress={() => handleClaim(pack)}
                  activeOpacity={0.8}
                  style={st.claimBtnWrap}
                >
                  <LinearGradient
                    colors={isClaimed ? ['#2E7D32', '#1B5E20'] : isLarge ? ['#FFB300', '#F57F17'] : ['#43A047', '#2E7D32']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={st.claimBtn}
                  >
                    {isClaimed ? (
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                    ) : (
                      <Text style={st.claimBtnTxt}>{pack.price}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* ── Footer note ── */}
        <View style={st.footer}>
          <Ionicons name="storefront-outline" size={14} color={theme.colors.textMuted} />
          <Text style={[st.footerTxt, { color: theme.colors.textMuted }]}>
            Prices are for demonstration only
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 16 },

  sectionTitle: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    marginBottom: 10, marginHorizontal: 20,
  },

  packCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  packInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  packInfo: { flex: 1, gap: 3 },
  packLabel: { fontSize: 17, fontWeight: '700' },
  packCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  packCoinCount: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  packCoinUnit: { fontSize: 12, fontWeight: '500', alignSelf: 'flex-end', marginBottom: 1 },
  packPerCoin: { fontSize: 11, fontWeight: '400' },

  claimBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  claimBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    minHeight: 44,
  },
  claimBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    paddingBottom: 4,
  },
  footerTxt: { fontSize: 12, fontWeight: '400' },
});
