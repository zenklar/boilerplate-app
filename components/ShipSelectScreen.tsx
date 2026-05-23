/**
 * ShipSelectScreen
 * Full-screen ship selection UI for the Asteroids game.
 *
 * - Shows all 9 ships in a scrollable grid.
 * - Locked ships (scoreRequired > highScore) appear dimmed with a padlock.
 * - Tapping an unlocked ship selects it (persisted via shipStore).
 * - The currently-selected ship is highlighted with an accent border.
 */
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
const CARD_SIZE = 80;   // px — preview square
const GRID_COLS = 3;

type Props = {
  onClose?: () => void;
};

export default function ShipSelectScreen({ onClose }: Props) {
  const selectedShipId = useShipStore((s) => s.selectedShipId);
  const setSelectedShipId = useShipStore((s) => s.setSelectedShipId);
  const loadSelectedShip = useShipStore((s) => s.loadSelectedShip);
  const highScore = useGameUIStore((s) => s.highScore);

  useEffect(() => {
    loadSelectedShip();
  }, []);

  const selectedShip = SHIPS.find((s) => s.id === selectedShipId) ?? SHIPS[0];

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: MONO }]}>SELECT SHIP</Text>
        <Text style={[styles.hiScore, { fontFamily: MONO }]}>
          HI  {String(highScore).padStart(6, '0')}
        </Text>
      </View>

      {/* ── Selected ship detail panel ── */}
      <View style={styles.detailPanel}>
        <ShipPreview ship={selectedShip} size={120} />
        <View style={styles.detailText}>
          <Text style={[styles.detailName, { fontFamily: MONO }]}>{selectedShip.name}</Text>
          <Text style={[styles.detailFrom, { fontFamily: MONO }]}>{selectedShip.from}</Text>
          <Text style={[styles.detailQuote, { fontFamily: MONO }]}>"{selectedShip.quote}"</Text>
          {selectedShip.scoreRequired > 0 && (
            <Text style={[styles.detailReq, { fontFamily: MONO }]}>
              Unlocks at {selectedShip.scoreRequired.toLocaleString()} pts
            </Text>
          )}
        </View>
      </View>

      {/* ── Ship grid ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {SHIPS.map((ship) => {
          const locked = highScore < ship.scoreRequired;
          const isSelected = ship.id === selectedShipId;

          return (
            <Pressable
              key={ship.id}
              style={({ pressed }) => [
                styles.card,
                isSelected && { borderColor: ship.accent, borderWidth: 2 },
                locked && styles.cardLocked,
                pressed && !locked && styles.cardPressed,
              ]}
              onPress={() => {
                if (!locked) setSelectedShipId(ship.id);
              }}
              accessibilityLabel={`${ship.name}${locked ? ' (locked)' : ''}`}
            >
              {/* Preview */}
              <View style={[styles.previewWrap, locked && styles.previewDim]}>
                <ShipPreview ship={ship} size={CARD_SIZE} />
              </View>

              {/* Ship name */}
              <Text
                style={[
                  styles.cardName,
                  { fontFamily: MONO },
                  locked && styles.cardNameLocked,
                ]}
                numberOfLines={1}
              >
                {ship.name}
              </Text>

              {/* Lock overlay */}
              {locked && (
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

      {/* ── Close / back button ── */}
      {onClose && (
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={[styles.closeBtnTxt, { fontFamily: MONO }]}>← BACK</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const GAP = 10;
const CARD_TOTAL = (CARD_SIZE + GAP * 2 + 2 /* border */ );

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 6,
  },
  hiScore: {
    color: '#555',
    fontSize: 12,
    letterSpacing: 2,
  },

  // Detail panel
  detailPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    minHeight: 140,
  },
  detailText: {
    flex: 1,
    gap: 4,
  },
  detailName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
  },
  detailFrom: {
    color: '#888',
    fontSize: 11,
    letterSpacing: 1,
  },
  detailQuote: {
    color: '#555',
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  detailReq: {
    color: '#FF6D00',
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 1,
  },

  // Grid
  scroll: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: GAP,
    gap: GAP,
  },

  // Card
  card: {
    width: CARD_SIZE + GAP * 2,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: GAP,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 6,
    backgroundColor: '#0A0A0A',
    gap: 6,
    position: 'relative',
  },
  cardLocked: {
    borderColor: '#1A1A1A',
  },
  cardPressed: {
    backgroundColor: '#111',
  },

  previewWrap: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewDim: {
    opacity: 0.25,
  },

  cardName: {
    color: '#CCC',
    fontSize: 8,
    letterSpacing: 1,
    textAlign: 'center',
  },
  cardNameLocked: {
    color: '#333',
  },

  // Lock overlay
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  lockIcon: {
    fontSize: 18,
    opacity: 0.7,
  },
  lockScore: {
    color: '#555',
    fontSize: 9,
    letterSpacing: 1,
  },

  // Close button
  closeBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    alignItems: 'flex-start',
  },
  closeBtnTxt: {
    color: '#666',
    fontSize: 12,
    letterSpacing: 3,
  },
});
