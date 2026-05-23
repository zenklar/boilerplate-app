import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { SHIPS } from '../constants/ships';
import ShipPreview from './ShipPreview';
import { useShipStore } from '../store/shipStore';
import { useGameUIStore } from '../store/gameStore';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const CARD_SIZE = 76;
const GAP = 8;

type Props = {
  onClose?: () => void;
};

export default function ShipSelectScreen({ onClose }: Props) {
  const selectedShipId = useShipStore((s) => s.selectedShipId);
  const setSelectedShipId = useShipStore((s) => s.setSelectedShipId);
  const loadSelectedShip = useShipStore((s) => s.loadSelectedShip);
  const highScore = useGameUIStore((s) => s.highScore);

  useEffect(() => { loadSelectedShip(); }, []);

  const selectedShip = SHIPS.find((s) => s.id === selectedShipId) ?? SHIPS[0];
  const locked = highScore < selectedShip.scoreRequired;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: MONO }]}>SELECT SHIP</Text>
        <Text style={[styles.hiScore, { fontFamily: MONO }]}>
          HI  {String(highScore).padStart(6, '0')}
        </Text>
      </View>

      {/* ── Detail panel ── */}
      <View style={styles.detailPanel}>
        <ShipPreview ship={selectedShip} size={110} opacity={locked ? 0.3 : 1} />
        <View style={styles.detailText}>
          <Text style={[styles.detailName, { fontFamily: MONO }]}>
            {selectedShip.name}
          </Text>
          {selectedShip.scoreRequired === 0 ? (
            <Text style={[styles.detailUnlock, { fontFamily: MONO, color: '#4FC3F7' }]}>
              UNLOCKED
            </Text>
          ) : locked ? (
            <Text style={[styles.detailUnlock, { fontFamily: MONO, color: '#FF6D00' }]}>
              LOCKED — {selectedShip.scoreRequired.toLocaleString()} PTS
            </Text>
          ) : (
            <Text style={[styles.detailUnlock, { fontFamily: MONO, color: '#69F0AE' }]}>
              UNLOCKED
            </Text>
          )}
          <Text style={[styles.detailCount, { fontFamily: MONO }]}>
            {SHIPS.filter((s) => highScore >= s.scoreRequired).length} / {SHIPS.length} UNLOCKED
          </Text>
        </View>
      </View>

      {/* ── Ship grid ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {SHIPS.map((ship) => {
          const isLocked = highScore < ship.scoreRequired;
          const isSelected = ship.id === selectedShipId;

          return (
            <Pressable
              key={ship.id}
              style={({ pressed }: { pressed: boolean }) => [
                styles.card,
                isSelected && styles.cardSelected,
                isLocked && styles.cardLocked,
                pressed && !isLocked && styles.cardPressed,
              ]}
              onPress={() => { if (!isLocked) setSelectedShipId(ship.id); }}
              accessibilityLabel={`${ship.name}${isLocked ? ' locked' : ''}`}
            >
              <ShipPreview ship={ship} size={CARD_SIZE} opacity={isLocked ? 0.2 : 1} />

              <Text
                style={[
                  styles.cardName,
                  { fontFamily: MONO },
                  isLocked && styles.cardNameLocked,
                ]}
                numberOfLines={1}
              >
                {ship.name}
              </Text>

              {isLocked && (
                <View style={styles.lockOverlay}>
                  <Text style={styles.lockIcon}>🔒</Text>
                  <Text style={[styles.lockScore, { fontFamily: MONO }]}>
                    {ship.scoreRequired >= 1000
                      ? `${(ship.scoreRequired / 1000).toFixed(ship.scoreRequired % 1000 === 0 ? 0 : 1)}K`
                      : String(ship.scoreRequired)}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {onClose && (
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={[styles.closeBtnTxt, { fontFamily: MONO }]}>← BACK</Text>
        </Pressable>
      )}
    </View>
  );
}

const CARD_OUTER = CARD_SIZE + GAP * 2 + 2;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingTop: 8 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700', letterSpacing: 6 },
  hiScore: { color: '#555', fontSize: 12, letterSpacing: 2 },

  detailPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    minHeight: 130,
  },
  detailText: { flex: 1, gap: 6 },
  detailName: {
    color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 2,
  },
  detailUnlock: { fontSize: 10, letterSpacing: 1 },
  detailCount: { color: '#444', fontSize: 9, letterSpacing: 1 },

  scroll: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: GAP,
    gap: GAP,
  },

  card: {
    width: CARD_OUTER,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: GAP,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 6,
    backgroundColor: '#080808',
    gap: 4,
    position: 'relative',
  },
  cardSelected: { borderColor: '#4FC3F7', borderWidth: 2, backgroundColor: '#0A1520' },
  cardLocked: { borderColor: '#141414' },
  cardPressed: { backgroundColor: '#111' },

  cardName: { color: '#AAA', fontSize: 7, letterSpacing: 1, textAlign: 'center' },
  cardNameLocked: { color: '#2A2A2A' },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  lockIcon: { fontSize: 16, opacity: 0.6 },
  lockScore: { color: '#444', fontSize: 8, letterSpacing: 1 },

  closeBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  closeBtnTxt: { color: '#555', fontSize: 12, letterSpacing: 3 },
});
