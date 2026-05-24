import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useCoinStore } from '../../store/coinStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import ArcadeCoin from '../../components/ArcadeCoin';

/* ── Subscription tile ──────────────────────────────────────────────── */
const PERKS = [
  'Unlimited coins — never pay per play',
  'Early access to new games',
  'VIP badge in leaderboards',
];

function SubscriptionTile() {
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const subscribe = useSubscriptionStore((s) => s.subscribe);
  const unsubscribe = useSubscriptionStore((s) => s.unsubscribe);

  const shimmer = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isSubscribed) { shimmer.setValue(0); glow.setValue(0); return; }
    const shimAnim = Animated.loop(Animated.timing(shimmer, { toValue: 1, duration: 2600, useNativeDriver: true }));
    const glowAnim = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1400, useNativeDriver: true }),
    ]));
    shimAnim.start(); glowAnim.start();
    return () => { shimAnim.stop(); glowAnim.stop(); };
  }, [isSubscribed]);

  const shimTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-320, 420] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });

  return (
    <View style={st.subCard}>
      <LinearGradient
        colors={isSubscribed ? ['#0E0530', '#2D0B6E', '#1A0850', '#3B1268', '#0A0828'] : ['#080420', '#160840', '#0C0635', '#1A0A48', '#080420']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {isSubscribed && (
        <Animated.View style={[st.shimmer, { transform: [{ translateX: shimTranslate }] }, { pointerEvents: 'none' }]} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(192,80,255,0.12)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {isSubscribed && (
        <Animated.View style={[StyleSheet.absoluteFill, st.glowBorder, { opacity: glowOpacity }, { pointerEvents: 'none' }]} />
      )}

      <View style={st.subTopRow}>
        <View style={st.vipBadge}>
          <Ionicons name="star" size={11} color="#FFD700" />
          <Text style={st.vipBadgeTxt}>VIP</Text>
        </View>
        {isSubscribed && (
          <View style={st.activePill}>
            <View style={st.activeDot} />
            <Text style={st.activeLabel}>ACTIVE</Text>
          </View>
        )}
      </View>

      <Text style={st.subTitle}>Arcade Pass</Text>
      <Text style={st.subSubtitle}>Unlimited plays across all games</Text>

      <View style={st.perksWrap}>
        {PERKS.map((p) => (
          <View key={p} style={st.perkRow}>
            <Ionicons name="checkmark-circle" size={14} color="#E040FB" />
            <Text style={st.perkText}>{p}</Text>
          </View>
        ))}
      </View>

      <View style={st.subFooter}>
        {!isSubscribed && (
          <Text style={st.subPrice}>
            <Text style={st.subPriceAmt}>$14.99/mo</Text>
          </Text>
        )}
        <TouchableOpacity
          onPress={isSubscribed ? unsubscribe : subscribe}
          style={[st.subBtn, isSubscribed ? st.subBtnCancel : st.subBtnActivate]}
          activeOpacity={0.8}
        >
          <Text style={st.subBtnTxt}>{isSubscribed ? 'Cancel Subscription' : 'Activate'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Pack data ──────────────────────────────────────────────────────── */
type Pack = { id: string; label: string; coins: number; price: string; perCoin: string };

const PACKS: Pack[] = [
  { id: 'small',  label: 'Small Coin Pack',  coins: 10,   price: '$0.99', perCoin: '$0.099 / coin' },
  { id: 'medium', label: 'Medium Coin Pack', coins: 100,  price: '$4.99', perCoin: '$0.049 / coin  ·  2× better value' },
  { id: 'large',  label: 'Large Coin Pack',  coins: 500, price: '$9.99', perCoin: '$0.019 / coin  ·  5× better value' },
];

/* ── Main screen ────────────────────────────────────────────────────── */
export default function ShopScreen() {
  const { theme } = useTheme();
  const addCoins = useCoinStore((s) => s.addCoins);
  const loadSubscription = useSubscriptionStore((s) => s.loadSubscription);
  const [claimed, setClaimed] = useState<string | null>(null);

  useEffect(() => { loadSubscription(); }, []);

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
        {/* ── Subscription ── */}
        <Text style={[st.sectionTitle, { color: theme.colors.textMuted }]}>SUBSCRIPTION</Text>
        <SubscriptionTile />

        {/* ── Coin packs ── */}
        <Text style={[st.sectionTitle, { color: theme.colors.textMuted, marginTop: 24 }]}>COIN PACKS</Text>

        {PACKS.map((pack) => {
          const isClaimed = claimed === pack.id;
          return (
            <View
              key={pack.id}
              style={[st.packCard, {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.cardBorder,
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
                <View style={st.packInfo}>
                  <Text style={[st.packLabel, { color: theme.colors.text }]}>{pack.label}</Text>
                  <View style={st.packCoinRow}>
                    <ArcadeCoin size={20} />
                    <Text style={[st.packCoinCount, { color: theme.colors.text }]}>
                      {pack.coins.toLocaleString()}
                    </Text>
                    <Text style={[st.packCoinUnit, { color: theme.colors.textMuted }]}>coins</Text>
                  </View>
                  <Text style={[st.packPerCoin, { color: theme.colors.textMuted }]}>{pack.perCoin}</Text>
                </View>

                <TouchableOpacity onPress={() => handleClaim(pack)} activeOpacity={0.8} style={st.claimBtnWrap}>
                  <LinearGradient
                    colors={isClaimed ? ['#2E7D32', '#1B5E20'] : ['#43A047', '#2E7D32']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={st.claimBtn}
                  >
                    {isClaimed
                      ? <Ionicons name="checkmark" size={18} color="#FFF" />
                      : <Text style={st.claimBtnTxt}>{pack.price}</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

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

  /* Subscription card */
  subCard: {
    marginHorizontal: 16, marginBottom: 6,
    borderRadius: 18, overflow: 'hidden',
    padding: 18,
    borderWidth: 1, borderColor: 'rgba(160, 80, 255, 0.4)',
  },
  shimmer: {
    position: 'absolute', top: 0, bottom: 0, width: 100,
    backgroundColor: 'rgba(220,120,255,0.10)',
    transform: [{ skewX: '-20deg' }],
  },
  glowBorder: { borderRadius: 18, borderWidth: 1.5, borderColor: '#D946EF' },
  subTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  vipBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)',
  },
  vipBadgeTxt: { color: '#FFD700', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF50' },
  activeLabel: { color: '#4CAF50', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  subTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3, marginBottom: 3 },
  subSubtitle: { color: '#B89DD4', fontSize: 13, marginBottom: 16 },
  perksWrap: { gap: 8, marginBottom: 20 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { color: '#CDB8E8', fontSize: 13 },
  subFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  subPrice: {},
  subPriceAmt: { color: '#EEE', fontSize: 18, fontWeight: '700' },
  subBtn: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 24 },
  subBtnActivate: { backgroundColor: '#8B21E8' },
  subBtnCancel: { backgroundColor: 'rgba(255,80,80,0.22)', borderWidth: 1, borderColor: 'rgba(255,80,80,0.45)' },
  subBtnTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  /* Coin pack cards */
  packCard: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  packInner: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  packInfo: { flex: 1, gap: 3 },
  packLabel: { fontSize: 17, fontWeight: '700' },
  packCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  packCoinCount: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  packCoinUnit: { fontSize: 12, fontWeight: '500', alignSelf: 'flex-end', marginBottom: 1 },
  packPerCoin: { fontSize: 11, fontWeight: '400' },
  claimBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  claimBtn: {
    paddingHorizontal: 20, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    minWidth: 72, minHeight: 44,
  },
  claimBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingTop: 12, paddingBottom: 4,
  },
  footerTxt: { fontSize: 12, fontWeight: '400' },
});
