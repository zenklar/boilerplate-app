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
function SubscriptionTile() {
  const { theme } = useTheme();
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const subscribe = useSubscriptionStore((s) => s.subscribe);
  const unsubscribe = useSubscriptionStore((s) => s.unsubscribe);
  const [claimed, setClaimed] = useState(false);

  const shimmer = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSubscribed) {
      Animated.loop(
        Animated.timing(shimmer, { toValue: 1, duration: 2600, useNativeDriver: true })
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      shimmer.stopAnimation();
      glow.stopAnimation();
      shimmer.setValue(0);
      glow.setValue(0);
    }
  }, [isSubscribed]);

  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-320, 420] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  const handlePress = () => {
    if (isSubscribed) {
      unsubscribe();
    } else {
      subscribe();
      setClaimed(true);
      setTimeout(() => setClaimed(false), 2200);
    }
  };

  return (
    <View style={[
      st.subCard,
      { borderColor: isSubscribed ? '#4FC3F780' : theme.colors.cardBorder },
      isSubscribed && { borderWidth: 1.5 },
    ]}>
      <LinearGradient
        colors={isSubscribed
          ? ['#0A1A4A', '#0D3080', '#0A1A4A']
          : ['#0A0F20', '#0D1535', '#0A0F20']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated shimmer sweep (active only) */}
      {isSubscribed && (
        <Animated.View style={[st.shimmer, { transform: [{ translateX: shimmerX }] }]} />
      )}

      {/* Animated border glow (active only) */}
      {isSubscribed && (
        <Animated.View style={[StyleSheet.absoluteFill, st.glowBorder, { opacity: glowOpacity }]} />
      )}

      <View style={st.subInner}>
        {/* Icon + status */}
        <View style={st.subIconWrap}>
          <LinearGradient
            colors={isSubscribed ? ['#4FC3F7', '#1565C0'] : ['#1A2A5A', '#0D1B3A']}
            style={st.subIconCircle}
          >
            <Ionicons
              name={isSubscribed ? 'diamond' : 'diamond-outline'}
              size={26}
              color={isSubscribed ? '#FFF' : '#4FC3F7'}
            />
          </LinearGradient>
          {isSubscribed && (
            <View style={st.activeDot} />
          )}
        </View>

        {/* Text */}
        <View style={st.subInfo}>
          <View style={st.subTitleRow}>
            <Text style={st.subTitle}>Arcade+</Text>
            {isSubscribed && (
              <View style={st.vipBadge}>
                <Text style={st.vipBadgeTxt}>VIP</Text>
              </View>
            )}
          </View>
          <Text style={st.subDesc}>
            {isSubscribed ? 'Unlimited coins · All games' : 'Unlimited coins for all games'}
          </Text>
          <Text style={st.subPrice}>
            {isSubscribed ? 'Active subscription' : '$14.99 / month'}
          </Text>
        </View>

        {/* Button */}
        <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={st.subBtnWrap}>
          <LinearGradient
            colors={isSubscribed
              ? ['#B71C1C', '#7F0000']
              : claimed
              ? ['#2E7D32', '#1B5E20']
              : ['#1565C0', '#0D47A1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={st.subBtn}
          >
            {claimed ? (
              <Ionicons name="checkmark" size={18} color="#FFF" />
            ) : (
              <Text style={st.subBtnTxt}>{isSubscribed ? 'Cancel' : 'Free'}</Text>
            )}
          </LinearGradient>
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
  { id: 'large',  label: 'Large Coin Pack',  coins: 1000, price: '$9.99', perCoin: '$0.009 / coin  ·  10× better value' },
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
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    minHeight: 100,
  },
  shimmer: {
    position: 'absolute', top: 0, bottom: 0,
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.10)',
    transform: [{ skewX: '-20deg' }],
  },
  glowBorder: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#4FC3F7',
  },
  subInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  subIconWrap: { position: 'relative' },
  subIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2, borderColor: '#0A1A4A',
  },
  subInfo: { flex: 1, gap: 3 },
  subTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subTitle: { color: '#FFF', fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  vipBadge: {
    backgroundColor: '#4FC3F7',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 6,
  },
  vipBadgeTxt: { color: '#000', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  subDesc: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '400' },
  subPrice: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '400', marginTop: 2 },
  subBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  subBtn: {
    paddingHorizontal: 18, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    minWidth: 68, minHeight: 44,
  },
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
