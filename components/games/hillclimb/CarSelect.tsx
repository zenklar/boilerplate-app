import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARS } from './cars';
import { CarId } from './types';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW * 0.78;
const CARD_GAP = 16;

interface Props {
  coinBalance: number;
  onPlay: (carId: CarId) => void;
  onClose: () => void;
}

function StarRow({ filled }: { filled: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= filled ? 'star' : 'star-outline'} size={13} color="#FFD700" />
      ))}
    </View>
  );
}

export default function CarSelect({ coinBalance, onPlay, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<CarId>('jeep');
  const scrollRef = useRef<ScrollView>(null);

  const selectedCar = CARS.find((c) => c.id === selected) ?? CARS[0];
  const canPlay = coinBalance >= 1;

  const snapToIndex = (idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * (CARD_W + CARD_GAP), animated: true });
    setSelected(CARS[idx].id);
  };

  const handleScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_GAP));
    if (CARS[idx]) setSelected(CARS[idx].id);
  };

  return (
    <LinearGradient colors={['#0d1b2a', '#1b2838', '#0d1b2a']} style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Hill Climb Racing</Text>
        <View style={styles.coinBadge}>
          <Text style={styles.coinText}>🪙 {coinBalance}</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>SELECT YOUR VEHICLE</Text>

      {/* Car carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={CARD_W + CARD_GAP}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        onMomentumScrollEnd={handleScroll}
      >
        {CARS.map((car, idx) => {
          const isSelected = car.id === selected;
          return (
            <TouchableOpacity
              key={car.id}
              onPress={() => snapToIndex(idx)}
              activeOpacity={0.9}
              style={[styles.card, isSelected && { borderColor: car.color, borderWidth: 2.5 }]}
            >
              <LinearGradient
                colors={[car.color + '22', '#1b2838']}
                style={styles.cardGrad}
              >
                <Image source={car.image} style={styles.carImage} resizeMode="contain" />
                <Text style={[styles.carName, { color: car.color }]}>{car.name}</Text>
                <Text style={styles.carDesc}>{car.description}</Text>

                <View style={styles.statsBlock}>
                  <StatRow label="Speed" filled={car.speed} />
                  <StatRow label="Power" filled={car.power} />
                  <StatRow label="Fuel Eff." filled={car.fuel} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {CARS.map((car) => (
          <View
            key={car.id}
            style={[styles.dot, selected === car.id && { backgroundColor: selectedCar.color, width: 18 }]}
          />
        ))}
      </View>

      {/* Play button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {!canPlay && (
          <Text style={styles.noCoinsWarning}>You need at least 1 🪙 to race</Text>
        )}
        <TouchableOpacity
          onPress={() => canPlay && onPlay(selectedCar.id)}
          disabled={!canPlay}
          activeOpacity={0.85}
          style={[styles.playBtn, { backgroundColor: canPlay ? selectedCar.color : '#444' }]}
        >
          <Ionicons name="play" size={22} color="#fff" />
          <Text style={styles.playBtnText}>
            {canPlay ? 'Race!  (1 🪙)' : 'Not enough coins'}
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

function StatRow({ label, filled }: { label: string; filled: number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <StarRow filled={filled} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  coinBadge: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  coinText: {
    color: '#FFD700',
    fontWeight: '700',
    fontSize: 14,
  },
  subtitle: {
    color: '#667',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  carousel: {
    paddingHorizontal: (SW - CARD_W) / 2,
    gap: CARD_GAP,
    alignItems: 'center',
  },
  card: {
    width: CARD_W,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
      android: { elevation: 8 },
    }),
  },
  cardGrad: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
  },
  carImage: {
    width: CARD_W * 0.72,
    height: 70,
    marginVertical: 4,
  },
  carName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  carDesc: {
    color: '#8899aa',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  statsBlock: {
    width: '100%',
    gap: 6,
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: '#aab',
    fontSize: 13,
    fontWeight: '500',
    width: 70,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  footer: {
    paddingHorizontal: 24,
    gap: 8,
    paddingTop: 4,
  },
  noCoinsWarning: {
    color: '#FF6B6B',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  playBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
