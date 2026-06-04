import React, { useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCoinStore } from '../../../store/coinStore';
import { useSubscriptionStore } from '../../../store/subscriptionStore';
import ArcadeCoin from '../../ArcadeCoin';
import { CARS } from './cars';
import { CarId } from './types';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW * 0.76;
const CARD_GAP = 14;

interface Props {
  onPlay: (carId: CarId) => void;
}

function Stars({ filled }: { filled: number }) {
  return (
    <View style={s.stars}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i} name={i <= filled ? 'star' : 'star-outline'} size={13} color="#FFD700" />
      ))}
    </View>
  );
}

export default function CarSelect({ onPlay }: Props) {
  const coins = useCoinStore(st => st.coins);
  const isSubscribed = useSubscriptionStore(st => st.isSubscribed);
  const [selected, setSelected] = useState<CarId>('jeep');
  const scrollRef = useRef<ScrollView>(null);

  const canPlay = isSubscribed || coins >= 1;
  const car = CARS.find(c => c.id === selected) ?? CARS[0];

  const snapTo = (idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * (CARD_W + CARD_GAP), animated: true });
    setSelected(CARS[idx].id);
  };

  const handleScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_GAP));
    if (CARS[idx]) setSelected(CARS[idx].id);
  };

  const handlePlay = () => {
    if (!canPlay) { router.push('/(app)/shop' as any); return; }
    onPlay(car.id);
  };

  return (
    <View style={s.root}>
      {/* Coin / subscribe row */}
      <View style={s.coinRow}>
        <ArcadeCoin size={20} />
        <Text style={s.coinTxt}>{isSubscribed ? '∞' : coins}</Text>
        {!isSubscribed && (
          <Text style={s.costHint}>  ·  1 coin per race</Text>
        )}
      </View>

      <Text style={s.subtitle}>SELECT YOUR VEHICLE</Text>

      <ScrollView
        ref={scrollRef}
        horizontal
        snapToInterval={CARD_W + CARD_GAP}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.carousel}
        onMomentumScrollEnd={handleScroll}
      >
        {CARS.map((c, idx) => {
          const active = c.id === selected;
          return (
            <TouchableOpacity key={c.id} onPress={() => snapTo(idx)} activeOpacity={0.9}
              style={[s.card, active && { borderColor: c.color, borderWidth: 2.5 }]}>
              <LinearGradient colors={[c.color + '22', '#1b2838']} style={s.cardGrad}>
                <Image source={c.image} style={s.carImg} resizeMode="contain" />
                <Text style={[s.carName, { color: c.color }]}>{c.name}</Text>
                <Text style={s.carDesc}>{c.description}</Text>
                <View style={s.statsBox}>
                  {([['Speed', c.speed], ['Power', c.power], ['Fuel Eff.', c.fuel]] as const).map(([lbl, val]) => (
                    <View key={lbl} style={s.statRow}>
                      <Text style={s.statLbl}>{lbl}</Text>
                      <Stars filled={val} />
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Dots */}
      <View style={s.dots}>
        {CARS.map(c => (
          <View key={c.id} style={[s.dot, selected === c.id && { backgroundColor: car.color, width: 18 }]} />
        ))}
      </View>

      {/* Play */}
      <TouchableOpacity onPress={handlePlay} activeOpacity={0.85}
        style={[s.playBtn, { backgroundColor: canPlay ? car.color : '#555' }]}>
        <Ionicons name="play" size={22} color="#fff" />
        <Text style={s.playTxt}>
          {canPlay
            ? (isSubscribed ? 'Race!' : 'Race!  (1 🪙)')
            : 'Get Coins'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1b2a', gap: 10, paddingTop: 10 },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  coinTxt: { color: '#FFD700', fontSize: 16, fontWeight: '700' },
  costHint: { color: '#667', fontSize: 12 },
  subtitle: { color: '#445', fontSize: 11, fontWeight: '700', letterSpacing: 2.5, textAlign: 'center' },
  carousel: { paddingHorizontal: (SW - CARD_W) / 2, gap: CARD_GAP, alignItems: 'center' },
  card: {
    width: CARD_W, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width:0,height:4 }, shadowOpacity:0.4, shadowRadius:10 },
      android: { elevation: 8 },
    }),
  },
  cardGrad: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 8 },
  carImg: { width: CARD_W * 0.72, height: 65, marginVertical: 4 },
  carName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  carDesc: { color: '#8899aa', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  statsBox: { width: '100%', gap: 5, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 10 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLbl: { color: '#aab', fontSize: 12, fontWeight: '500', width: 70 },
  stars: { flexDirection: 'row', gap: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginHorizontal: 20, marginBottom: 14, paddingVertical: 15, borderRadius: 15,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width:0,height:4 }, shadowOpacity:0.35, shadowRadius:8 },
      android: { elevation: 6 },
    }),
  },
  playTxt: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
});
