import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useCoinStore } from '../../store/coinStore';

/* ── Coin SVG-style component ───────────────────────────────────────── */
function ArcadeCoin({ size = 48 }: { size?: number }) {
  const r = size / 2;
  const innerR = r * 0.78;
  const lineW = size * 0.045;

  return (
    <View style={{ width: size, height: size }}>
      {/* Outer rim shadow */}
      <View style={[{
        position: 'absolute', top: size * 0.06, left: size * 0.06,
        width: size * 0.88, height: size * 0.88, borderRadius: size * 0.44,
        backgroundColor: '#7A4800',
      }]} />
      {/* Gold base circle */}
      <LinearGradient
        colors={['#FFF176', '#FFD700', '#E65100']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: size, height: size, borderRadius: r,
        }}
      />
      {/* Inner face */}
      <LinearGradient
        colors={['#FFE57F', '#FFC107', '#FF8F00']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{
          position: 'absolute',
          top: r - innerR, left: r - innerR,
          width: innerR * 2, height: innerR * 2, borderRadius: innerR,
        }}
      />
      {/* Cross lines — horizontal */}
      <View style={{
        position: 'absolute',
        top: r - lineW / 2, left: r - innerR * 0.72,
        width: innerR * 1.44, height: lineW,
        backgroundColor: '#B8600040', borderRadius: lineW,
      }} />
      {/* Cross lines — vertical */}
      <View style={{
        position: 'absolute',
        top: r - innerR * 0.72, left: r - lineW / 2,
        width: lineW, height: innerR * 1.44,
        backgroundColor: '#B8600040', borderRadius: lineW,
      }} />
      {/* Shine highlight */}
      <View style={{
        position: 'absolute',
        top: size * 0.1, left: size * 0.2,
        width: size * 0.28, height: size * 0.14,
        backgroundColor: 'rgba(255,255,255,0.55)',
        borderRadius: size * 0.07,
        transform: [{ rotate: '-35deg' }],
      }} />
    </View>
  );
}

/* ── Pack data ──────────────────────────────────────────────────────── */
type Pack = {
  id: string;
  label: string;
  subtitle: string;
  coins: number;
  tag?: string;
  tagColor?: string;
};

const PACKS: Pack[] = [
  {
    id: 'starter',
    label: 'Starter',
    subtitle: '10 plays',
    coins: 10,
  },
  {
    id: 'popular',
    label: 'Popular',
    subtitle: '100 plays',
    coins: 100,
    tag: 'MOST POPULAR',
    tagColor: '#0A84FF',
  },
  {
    id: 'mega',
    label: 'Mega Pack',
    subtitle: '1000 plays',
    coins: 1000,
    tag: 'BEST VALUE',
    tagColor: '#32D74B',
  },
];

/* ── Main screen ────────────────────────────────────────────────────── */
export default function ShopScreen() {
  const { theme } = useTheme();
  const coins = useCoinStore((s) => s.coins);
  const addCoins = useCoinStore((s) => s.addCoins);
  const loadCoins = useCoinStore((s) => s.loadCoins);
  const [claimed, setClaimed] = useState<string | null>(null);

  useEffect(() => { loadCoins(); }, []);

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
        {/* ── Balance card ── */}
        <View style={st.balanceSection}>
          <View style={[st.balanceCard, {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.cardBorder,
            shadowColor: '#FFD700',
            ...(theme.mode === 'light' ? { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 } : {}),
          }]}>
            <LinearGradient
              colors={theme.mode === 'dark' ? ['#1A1400', '#0D0D0D'] : ['#FFFDE7', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ArcadeCoin size={52} />
            <View style={st.balanceText}>
              <Text style={[st.balanceLabel, { color: theme.colors.textMuted }]}>
                Your Coins
              </Text>
              <Text style={[st.balanceValue, { color: '#FFD700' }]}>
                {coins.toLocaleString()}
              </Text>
            </View>
            <View style={[st.balanceInfo, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}>
              <Ionicons name="information-circle-outline" size={14} color={theme.colors.textMuted} />
              <Text style={[st.balanceInfoTxt, { color: theme.colors.textMuted }]}>
                1 coin = 1 play
              </Text>
            </View>
          </View>
        </View>

        {/* ── Section header ── */}
        <Text style={[st.sectionTitle, { color: theme.colors.textMuted }]}>
          COIN PACKS
        </Text>

        {/* ── Pack cards ── */}
        {PACKS.map((pack, idx) => {
          const isClaimed = claimed === pack.id;
          const isPopular = !!pack.tag;

          return (
            <View
              key={pack.id}
              style={[st.packCard, {
                backgroundColor: theme.colors.card,
                borderColor: isPopular ? (pack.tagColor + '40') : theme.colors.cardBorder,
                borderWidth: isPopular ? 1.5 : StyleSheet.hairlineWidth,
                ...(theme.mode === 'light' ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.07,
                  shadowRadius: 4,
                  elevation: 2,
                } : {}),
              }]}
            >
              {/* Tag badge */}
              {pack.tag && (
                <View style={[st.tagBadge, { backgroundColor: pack.tagColor }]}>
                  <Text style={st.tagBadgeTxt}>{pack.tag}</Text>
                </View>
              )}

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
                  <Text style={[st.packSubtitle, { color: theme.colors.textMuted }]}>
                    {pack.subtitle}
                  </Text>
                </View>

                {/* Claim button */}
                <TouchableOpacity
                  onPress={() => handleClaim(pack)}
                  activeOpacity={0.8}
                  style={st.claimBtnWrap}
                >
                  <LinearGradient
                    colors={isClaimed ? ['#2E7D32', '#1B5E20'] : ['#43A047', '#2E7D32']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={st.claimBtn}
                  >
                    {isClaimed ? (
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                    ) : (
                      <Text style={st.claimBtnTxt}>Free</Text>
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
            In-app purchases coming soon
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 16 },

  balanceSection: { paddingHorizontal: 16, marginBottom: 24 },
  balanceCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  balanceText: { flex: 1 },
  balanceLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  balanceValue: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  balanceInfoTxt: { fontSize: 11, fontWeight: '500' },

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
  tagBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    marginLeft: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  tagBadgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

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
  packSubtitle: { fontSize: 12, fontWeight: '400' },

  claimBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  claimBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
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
