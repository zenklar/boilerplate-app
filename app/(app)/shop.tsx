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
  'Early access to new games',
  'VIP badge in leaderboards',
  'Exclusive seasonal events',
];

/* Floating sparkle particle */
function Sparkle({ delay, left, top, size, color = '#FFE066', icon = 'sparkles' }: {
  delay: number; left: number; top: number; size: number;
  color?: string; icon?: 'sparkles' | 'star';
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);
  const opacity = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] });
  const scale = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] });
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left, top,
        opacity,
        transform: [{ scale }, { translateY }],
      }}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Animated.View>
  );
}

function SubscriptionTile() {
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const subscribe = useSubscriptionStore((s) => s.subscribe);
  const unsubscribe = useSubscriptionStore((s) => s.unsubscribe);

  const shimmer = useRef(new Animated.Value(0)).current;
  const shimmer2 = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const hue = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isSubscribed) {
      shimmer.setValue(0); shimmer2.setValue(0); glow.setValue(0);
      pulse.setValue(0); hue.setValue(0); dotPulse.setValue(0);
      return;
    }
    const shimAnim = Animated.loop(Animated.timing(shimmer, { toValue: 1, duration: 2600, useNativeDriver: true }));
    const shim2Anim = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(shimmer2, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(shimmer2, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const glowAnim = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1400, useNativeDriver: true }),
    ]));
    const pulseAnim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ]));
    const hueAnim = Animated.loop(Animated.timing(hue, { toValue: 1, duration: 4200, useNativeDriver: false }));
    const dotAnim = Animated.loop(Animated.sequence([
      Animated.timing(dotPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(dotPulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    shimAnim.start(); shim2Anim.start(); glowAnim.start();
    pulseAnim.start(); hueAnim.start(); dotAnim.start();
    return () => {
      shimAnim.stop(); shim2Anim.stop(); glowAnim.stop();
      pulseAnim.stop(); hueAnim.stop(); dotAnim.stop();
    };
  }, [isSubscribed]);

  const shimTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-320, 420] });
  const shim2Translate = shimmer2.interpolate({ inputRange: [0, 1], outputRange: [-200, 420] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const badgeScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const dotScale = dotPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const dotOpacity = dotPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.2] });
  const borderColor = hue.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: ['#FFD700', '#FFC107', '#FFEA70', '#FFD700'],
  });

  return (
    <View style={st.subCardOuter}>
      {/* Outer animated glow halo */}
      {isSubscribed && (
        <Animated.View pointerEvents="none" style={[st.haloWrap, { opacity: glowOpacity }]}>
          <LinearGradient
            colors={['rgba(255,215,0,0.0)', 'rgba(255,215,0,0.65)', 'rgba(255,170,40,0.6)', 'rgba(255,215,0,0.0)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      <View style={[st.subCard, isSubscribed && st.subCardActive]}>
        <LinearGradient
          colors={isSubscribed
            ? ['#3A2200', '#7A4A00', '#A8730B', '#7A4A00', '#3A2200']
            : ['#1B0846', '#3A0F8A', '#5B189F', '#7A1FBF', '#2A0B68']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Sharp angular accents — both states */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[st.angleShape, st.angleA]}>
            <LinearGradient
              colors={isSubscribed
                ? ['rgba(255,215,0,0.55)', 'rgba(255,170,40,0.0)']
                : ['rgba(217,70,239,0.45)', 'rgba(168,85,247,0.0)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={[st.angleShape, st.angleB]}>
            <LinearGradient
              colors={isSubscribed
                ? ['rgba(255,140,0,0.0)', 'rgba(255,200,60,0.55)']
                : ['rgba(124,58,237,0.0)', 'rgba(236,72,153,0.4)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={[st.angleShape, st.angleC]}>
            <LinearGradient
              colors={isSubscribed
                ? ['rgba(255,240,160,0.45)', 'rgba(255,240,160,0.0)']
                : ['rgba(192,132,252,0.35)', 'rgba(192,132,252,0.0)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </View>

        {/* Diagonal grid scanlines for arcade feel */}
        {isSubscribed && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <View key={i} style={[st.scanLine, { top: i * 22 }]} />
            ))}
          </View>
        )}

        {/* Radial-ish purple highlight via stacked gradients */}
        <LinearGradient
          colors={isSubscribed
            ? ['rgba(255,215,0,0.22)', 'transparent', 'rgba(255,170,40,0.22)']
            : ['transparent', 'rgba(192,80,255,0.10)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Primary shimmer beam */}
        {isSubscribed && (
          <Animated.View style={[st.shimmer, { transform: [{ translateX: shimTranslate }, { skewX: '-20deg' }] }]} pointerEvents="none">
            <LinearGradient
              colors={['transparent', 'rgba(255,225,120,0.45)', 'rgba(255,255,235,0.7)', 'rgba(255,225,120,0.45)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        {/* Secondary thinner shimmer beam */}
        {isSubscribed && (
          <Animated.View style={[st.shimmer2, { transform: [{ translateX: shim2Translate }, { skewX: '-20deg' }] }]} pointerEvents="none">
            <LinearGradient
              colors={['transparent', 'rgba(255,180,40,0.55)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        {/* Floating sparkles */}
        {isSubscribed ? (
          <>
            <Sparkle delay={0}    left={28}  top={18}  size={12} color="#FFE066" />
            <Sparkle delay={600}  left={210} top={30}  size={10} color="#FFFFFF" icon="star" />
            <Sparkle delay={1200} left={150} top={84}  size={14} color="#FFD700" />
            <Sparkle delay={400}  left={300} top={110} size={11} color="#FFE066" icon="star" />
            <Sparkle delay={1500} left={60}  top={150} size={9}  color="#FFFFFF" icon="star" />
            <Sparkle delay={900}  left={260} top={170} size={12} color="#FFD700" />
            <Sparkle delay={200}  left={120} top={40}  size={8}  color="#FFF4D1" icon="star" />
            <Sparkle delay={1700} left={330} top={50}  size={9}  color="#FFE066" />
            <Sparkle delay={800}  left={190} top={195} size={10} color="#FFD700" icon="star" />
            <Sparkle delay={1100} left={90}  top={100} size={7}  color="#FFFFFF" icon="star" />
            <Sparkle delay={2000} left={280} top={150} size={8}  color="#FFE066" icon="star" />
          </>
        ) : (
          <>
            <Sparkle delay={0}    left={200} top={20}  size={10} color="#F0A8FF" />
            <Sparkle delay={700}  left={280} top={60}  size={8}  color="#E9D5FF" icon="star" />
            <Sparkle delay={1300} left={170} top={92}  size={12} color="#F0A8FF" />
            <Sparkle delay={500}  left={310} top={130} size={9}  color="#FBCFE8" icon="star" />
            <Sparkle delay={1700} left={240} top={170} size={10} color="#F0A8FF" />
            <Sparkle delay={1000} left={130} top={150} size={7}  color="#FBCFE8" icon="star" />
            <Sparkle delay={300}  left={260} top={100} size={6}  color="#FFFFFF" icon="star" />
          </>
        )}

        {/* Animated color-shifting border */}
        {isSubscribed && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]}>
            <Animated.View style={[StyleSheet.absoluteFill, st.glowBorder, { borderColor }]} />
          </Animated.View>
        )}

        <View style={st.subTopRow}>
          <Animated.View style={[st.vipBadge, isSubscribed && { transform: [{ scale: badgeScale }] }]}>
            <Ionicons name="star" size={11} color="#FFD700" />
            <Text style={st.vipBadgeTxt}>VIP</Text>
          </Animated.View>
          {isSubscribed && (
            <View style={st.activePill}>
              <View style={st.activeDotWrap}>
                <Animated.View
                  style={[st.activeDotRing, { transform: [{ scale: dotScale }], opacity: dotOpacity }]}
                />
                <View style={st.activeDot} />
              </View>
              <Text style={st.activeLabel}>ACTIVE</Text>
            </View>
          )}
        </View>

        <View style={st.titleRow}>
          <Text style={[st.subTitle, isSubscribed && st.subTitleActive]}>Arcade Pass</Text>
          {isSubscribed && (
            <Ionicons name="flash" size={20} color="#FFD700" style={{ marginLeft: 6 }} />
          )}
        </View>
        <Text style={[st.subSubtitle, isSubscribed && { color: '#FFE9A8' }]}>
          {isSubscribed ? 'All games. Always unlocked.' : 'Play unlimited. Never pay per game.'}
        </Text>

        {/* Hero: Unlimited Coins — the big selling point */}
        <View style={[st.heroBanner, isSubscribed ? st.heroBannerActive : st.heroBannerInactive]}>
          <LinearGradient
            colors={isSubscribed
              ? ['rgba(255,215,0,0.28)', 'rgba(255,170,40,0.18)', 'rgba(255,215,0,0.28)']
              : ['rgba(217,70,239,0.25)', 'rgba(168,85,247,0.18)', 'rgba(236,72,153,0.25)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={st.heroCoinWrap}>
            <ArcadeCoin size={36} />
            <Animated.View
              style={[
                st.heroInfinityBubble,
                isSubscribed && { transform: [{ scale: badgeScale }] },
              ]}
            >
              <Text style={[st.heroInfinity, isSubscribed && st.heroInfinityActive]}>∞</Text>
            </Animated.View>
          </View>
          <View style={st.heroTextWrap}>
            <Text style={[st.heroTitle, isSubscribed && st.heroTitleActive]}>Unlimited Coins</Text>
            <Text style={[st.heroSubtitle, isSubscribed && { color: '#FFF4D1' }]}>
              Never pay per play — every game, free forever
            </Text>
          </View>
        </View>

        <View style={st.perksWrap}>
          {PERKS.map((p) => (
            <View key={p} style={st.perkRow}>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={isSubscribed ? '#FFD700' : '#E040FB'}
              />
              <Text style={[st.perkText, isSubscribed && { color: '#FFF4D1' }]}>{p}</Text>
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
            activeOpacity={0.85}
            style={st.subBtnWrap}
          >
            {isSubscribed ? (
              <View style={[st.subBtn, st.subBtnCancel]}>
                <Text style={st.subBtnTxt}>Cancel Subscription</Text>
              </View>
            ) : (
              <LinearGradient
                colors={['#C026D3', '#8B21E8', '#6D28D9']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={st.subBtn}
              >
                <Ionicons name="flash" size={15} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={st.subBtnTxt}>Activate</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
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
  subCardOuter: {
    marginHorizontal: 16, marginBottom: 6,
    position: 'relative',
  },
  haloWrap: {
    position: 'absolute',
    top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 24,
    overflow: 'hidden',
  },
  subCard: {
    borderRadius: 18, overflow: 'hidden',
    padding: 18,
    borderWidth: 1, borderColor: 'rgba(192, 132, 252, 0.55)',
  },
  subCardActive: {
    borderColor: 'rgba(255, 215, 0, 0.8)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 16,
    elevation: 12,
  },
  scanLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 230, 130, 0.07)',
  },
  angleShape: {
    position: 'absolute',
    overflow: 'hidden',
  },
  angleA: {
    top: -40, left: -50,
    width: 220, height: 220,
    transform: [{ rotate: '25deg' }],
    borderRadius: 8,
  },
  angleB: {
    bottom: -60, right: -70,
    width: 260, height: 180,
    transform: [{ rotate: '-18deg' }],
    borderRadius: 8,
  },
  angleC: {
    top: 60, right: -40,
    width: 180, height: 80,
    transform: [{ rotate: '12deg' }],
    borderRadius: 6,
  },
  shimmer: {
    position: 'absolute', top: 0, bottom: 0, width: 120,
  },
  shimmer2: {
    position: 'absolute', top: 0, bottom: 0, width: 60,
  },
  glowBorder: { borderRadius: 18, borderWidth: 2 },
  subTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  vipBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,215,0,0.18)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.45)',
  },
  vipBadgeTxt: { color: '#FFD700', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0E0A02',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 11,
    borderWidth: 1, borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
  },
  activeDotWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFD700' },
  activeDotRing: {
    position: 'absolute',
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#FFE066',
  },
  activeLabel: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  subTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  subTitleActive: {
    color: '#FFF6D1',
    textShadowColor: 'rgba(255, 215, 0, 0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subSubtitle: { color: '#B89DD4', fontSize: 13, marginBottom: 14 },

  heroBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, padding: 12, marginBottom: 14,
    borderWidth: 1, overflow: 'hidden',
  },
  heroBannerInactive: {
    borderColor: 'rgba(217,70,239,0.55)',
  },
  heroBannerActive: {
    borderColor: 'rgba(255,215,0,0.85)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  heroCoinWrap: { position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  heroInfinityBubble: {
    position: 'absolute',
    right: -8, bottom: -8,
    backgroundColor: '#0E0A02',
    borderRadius: 10,
    paddingHorizontal: 5,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  heroInfinity: {
    color: '#FFF', fontSize: 14, fontWeight: '900', lineHeight: 16, textAlign: 'center',
  },
  heroInfinityActive: {
    color: '#FFD700',
    textShadowColor: 'rgba(255,215,0,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  heroTextWrap: { flex: 1 },
  heroTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  heroTitleActive: {
    color: '#FFF6D1',
    textShadowColor: 'rgba(255,215,0,0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  heroSubtitle: { color: '#E9D5FF', fontSize: 11, marginTop: 2 },
  perksWrap: { gap: 8, marginBottom: 20 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { color: '#CDB8E8', fontSize: 13 },
  subFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  subPrice: {},
  subPriceAmt: { color: '#EEE', fontSize: 18, fontWeight: '700' },
  subBtnWrap: { borderRadius: 24, overflow: 'hidden' },
  subBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 22, paddingVertical: 11, borderRadius: 24,
  },
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
