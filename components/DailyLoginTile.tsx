import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Modal, Platform, useWindowDimensions, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useDailyLoginStore } from '../store/dailyLoginStore';
import { useCoinStore } from '../store/coinStore';
import { playCoinCollect, playCoinInsert } from '../utils/sounds';
import ArcadeCoin from './ArcadeCoin';

const NUM_FLYING_COINS = 8;
const COIN_SIZE = 22;

// ── Small coin pack sprite ──────────────────────────────────────────────────
const PACK_SPRITE = require('../assets/coin packs/coin packs.png');
const SPRITE_H = 393;
const SPRITE_FULL_W = 1338;

function SmallCoinPack({ height = 44 }: { height?: number }) {
  const scale = height / SPRITE_H;
  const imgW = SPRITE_FULL_W * scale;
  const cropW = 337 * scale;
  return (
    <View style={{ width: cropW, height, overflow: 'hidden' }}>
      <Image
        source={PACK_SPRITE}
        style={{ width: imgW, height, position: 'absolute', left: 0 }}
        resizeMode="stretch"
      />
    </View>
  );
}

// ── Sparkle particle ────────────────────────────────────────────────────────
type SparkleProps = { top?: number; bottom?: number; left?: number; right?: number; delay: number; size?: number };

function Sparkle({ top, bottom, left, right, delay, size = 9 }: SparkleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(scale, { toValue: 1.15, duration: 350, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.delay(250),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(scale, { toValue: 0.4, duration: 350, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        top, bottom, left, right,
        fontSize: size,
        color: '#FFD700',
        opacity,
        transform: [{ scale }],
      }}
    >
      ✦
    </Animated.Text>
  );
}

function TileSparkles() {
  return (
    <>
      <Sparkle top={3}    left={4}  delay={0}   size={8} />
      <Sparkle top={3}    right={4} delay={420}  size={7} />
      <Sparkle bottom={3} left={6}  delay={210}  size={6} />
      <Sparkle bottom={3} right={6} delay={630}  size={8} />
    </>
  );
}

export default function DailyLoginTile() {
  const { theme } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { claimedDays, getCurrentDay, claimDay, load, isLoaded, coinsPerDay } =
    useDailyLoginStore();
  const addCoins = useCoinStore((s) => s.addCoins);

  useEffect(() => { load(); }, []);

  const currentDay = isLoaded ? getCurrentDay() : 0;

  // Phase windows: 7 tiles each — phase 0 = days 1–7, phase 1 = 8–14, etc.
  const currentPhase = Math.min(Math.floor((currentDay - 1) / 7), 3);

  const phaseTiles: number[] = Array.from({ length: 7 }, (_, i) => currentPhase * 7 + i + 1);

  const claimableDays = isLoaded
    ? phaseTiles.filter((d) => d <= currentDay && !claimedDays.includes(d))
    : [];

  const phaseClaimed = phaseTiles.filter((d) => claimedDays.includes(d)).length;
  const allPhaseClaimed = phaseClaimed === phaseTiles.length;
  const allRewardsDone = currentDay >= 28 && allPhaseClaimed;

  const totalClaimableCoins = claimableDays.length * coinsPerDay;

  // Ref on claim button for animation origin
  const claimBtnRef = useRef<View>(null);

  // Flying-coin animation state
  const [showFlying, setShowFlying] = useState(false);
  const coinAnims = useRef(
    Array.from({ length: NUM_FLYING_COINS }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1),
    }))
  ).current;

  const handleClaimAll = useCallback(() => {
    if (claimableDays.length === 0) return;

    const toX = screenW - 58;
    const toY = insets.top + 18;

    const doAnimate = (fromX: number, fromY: number) => {
      const offsets = [-28, -14, 0, 14, 28, -20, 20, 0];
      coinAnims.forEach((anim, i) => {
        anim.x.setValue(fromX + offsets[i]);
        anim.y.setValue(fromY + (i % 2 === 0 ? -10 : 10));
        anim.opacity.setValue(1);
        anim.scale.setValue(1);
      });

      setShowFlying(true);
      playCoinCollect();

      const animations = coinAnims.map((anim, i) =>
        Animated.sequence([
          Animated.delay(i * 55),
          Animated.parallel([
            Animated.timing(anim.x, { toValue: toX, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(anim.y, { toValue: toY, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(anim.scale, { toValue: 0.35, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
            Animated.sequence([
              Animated.delay(280),
              Animated.timing(anim.opacity, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
            ]),
          ]),
        ])
      );

      Animated.parallel(animations).start(() => {
        setShowFlying(false);
        claimableDays.forEach((d) => claimDay(d));
        addCoins(totalClaimableCoins);
        playCoinInsert();
        setTimeout(() => playCoinInsert(), 90);
        setTimeout(() => playCoinInsert(), 180);
      });
    };

    if (claimBtnRef.current) {
      claimBtnRef.current.measure((_x, _y, w, h, pageX, pageY) => {
        doAnimate(pageX + w / 2 - COIN_SIZE / 2, pageY + h / 2 - COIN_SIZE / 2);
      });
    } else {
      doAnimate(screenW / 2, insets.top + 200);
    }
  }, [claimableDays, totalClaimableCoins, screenW, insets.top, coinAnims, claimDay, addCoins]);

  if (!isLoaded) return null;

  return (
    <View style={[st.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
      {/* Header */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <ArcadeCoin size={20} />
          <Text style={[st.title, { color: theme.colors.text }]}>7 DAY LOGIN REWARDS:</Text>
        </View>
        <View style={[st.streakBadge, { backgroundColor: theme.colors.backgroundSecondary }]}>
          <Text style={[st.streakTxt, { color: theme.colors.textMuted }]}>
              {phaseClaimed}/{phaseTiles.length} CLAIMED
            </Text>
        </View>
      </View>

      {/* Day tiles */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.daysRow}
      >
        {phaseTiles.map((day) => {
          const claimed = claimedDays.includes(day);
          const available = day <= currentDay && !claimed;
          const future = day > currentDay;
          const isWelcome = day === 1 && currentPhase === 0;

          return (
            <View
              key={day}
              style={[
                st.dayTile,
                {
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderColor: available
                    ? '#FFD700'
                    : claimed
                    ? theme.colors.success + '55'
                    : theme.colors.border,
                },
                available && st.dayTileActive,
              ]}
            >
              {available && <TileSparkles />}

              <Text
                style={[
                  st.dayLabel,
                  {
                    color: available
                      ? '#FFD700'
                      : claimed
                      ? theme.colors.success
                      : theme.colors.textSecondary,
                  },
                ]}
              >
                {isWelcome ? 'WELCOME' : `DAY ${day}`}
              </Text>

              {claimed ? (
                <Text style={[st.checkmark, { color: theme.colors.success }]}>✓</Text>
              ) : (
                <SmallCoinPack height={44} />
              )}

              <Text
                style={[
                  st.coinAmt,
                  {
                    color: available
                      ? '#FFD700'
                      : claimed
                      ? theme.colors.success
                      : theme.colors.textSecondary,
                    fontWeight: available ? '700' : '500',
                    opacity: future ? 0.75 : 1,
                  },
                ]}
              >
                {claimed ? 'DONE' : `+${coinsPerDay}`}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {allRewardsDone && (
        <Text style={[st.allDoneTxt, { color: theme.colors.textMuted }]}>
          🎉 All login rewards complete — thanks for playing!
        </Text>
      )}

      {allPhaseClaimed && !allRewardsDone && (
        <Text style={[st.allDoneTxt, { color: theme.colors.textMuted }]}>
          Come back tomorrow for Day {phaseTiles[phaseTiles.length - 1] + 1}!
        </Text>
      )}

      {/* Wide claim-all button */}
      {!allPhaseClaimed && (
        <View style={st.claimBtnWrap}>
          <TouchableOpacity
            ref={claimBtnRef as any}
            activeOpacity={claimableDays.length > 0 ? 0.75 : 1}
            onPress={handleClaimAll}
            style={[
              st.claimBtn,
              claimableDays.length === 0 && st.claimBtnDisabled,
            ]}
          >
            <Text style={[st.claimBtnTxt, claimableDays.length === 0 && st.claimBtnTxtDisabled]}>
              {claimableDays.length > 0
                ? `CLAIM ${claimableDays.length} REWARD${claimableDays.length > 1 ? 'S' : ''}  ·  +${totalClaimableCoins} COINS`
                : 'COME BACK TOMORROW'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Flying coins overlay */}
      <Modal visible={showFlying} transparent animationType="none" statusBarTranslucent>
        {coinAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              st.flyingCoin,
              { pointerEvents: 'none' },
              {
                opacity: anim.opacity,
                transform: [
                  { translateX: anim.x },
                  { translateY: anim.y },
                  { scale: anim.scale },
                ],
              },
            ]}
          >
            <ArcadeCoin size={COIN_SIZE} />
          </Animated.View>
        ))}
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  streakBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  streakTxt: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  daysRow: {
    flexDirection: 'row',
    paddingLeft: 12,
    paddingRight: 20,
  },

  dayTile: {
    width: 66,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 4,
    marginRight: 8,
    position: 'relative',
  },
  dayTileActive: {
    boxShadow: '0px 0px 10px rgba(255, 215, 0, 0.6)',
    elevation: 5,
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  checkmark: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  coinAmt: {
    fontSize: 11,
    letterSpacing: 0.3,
  },

  claimBtnWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  claimBtn: {
    backgroundColor: '#FFD700',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimBtnDisabled: {
    backgroundColor: '#2C2C2E',
  },
  claimBtnTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A1200',
    letterSpacing: 0.6,
  },
  claimBtnTxtDisabled: {
    color: '#636366',
  },

  allDoneTxt: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 12,
    paddingHorizontal: 14,
  },

  flyingCoin: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
