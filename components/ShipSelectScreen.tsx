import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SHIPS } from '../constants/ships';
import ShipPreview from './ShipPreview';
import { useShipStore } from '../store/shipStore';
import { useGameUIStore } from '../store/gameStore';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const COLS = 3;
const GAP = 10;
const H_PAD = 12;

type Props = {
  onClose?: () => void;
};

export default function ShipSelectScreen({ onClose }: Props) {
  const selectedShipId = useShipStore((s) => s.selectedShipId);
  const setSelectedShipId = useShipStore((s) => s.setSelectedShipId);
  const loadSelectedShip = useShipStore((s) => s.loadSelectedShip);
  const highScore = useGameUIStore((s) => s.highScore);
  const { width: screenW } = useWindowDimensions();

  // Separate preview state from selected state — locked ships can be previewed
  const [previewId, setPreviewId] = useState<number>(selectedShipId);

  useEffect(() => { loadSelectedShip(); }, []);
  // Keep preview in sync when selection changes (e.g. after load)
  useEffect(() => { setPreviewId(selectedShipId); }, [selectedShipId]);

  const cardW = Math.floor((screenW - H_PAD * 2 - GAP * (COLS - 1)) / COLS);
  const cardH = Math.round(cardW * 1.35); // taller than wide — ships are portrait

  const previewShip = SHIPS.find((s) => s.id === previewId) ?? SHIPS[0];
  const previewLocked = highScore < previewShip.scoreRequired;
  const isActiveSelection = previewId === selectedShipId;

  const handleCardPress = (shipId: number, isLocked: boolean) => {
    if (isLocked) {
      // Locked: show preview info only, don't change selection
      setPreviewId(shipId);
    } else {
      // Unlocked: select AND preview
      setSelectedShipId(shipId);
      setPreviewId(shipId);
    }
  };

  return (
    <View style={styles.root}>
      {/* ── Detail panel ── */}
      <View style={styles.detailPanel}>
        <ShipPreview ship={previewShip} size={130} opacity={previewLocked ? 0.35 : 1} />
        <View style={styles.detailText}>
          <Text style={[styles.detailName, { fontFamily: MONO }]}>
            {previewShip.name}
          </Text>

          {previewLocked ? (
            <>
              <Text style={[styles.detailUnlock, { fontFamily: MONO, color: '#FF6D00' }]}>
                LOCKED
              </Text>
              <Text style={[styles.detailRequire, { fontFamily: MONO }]}>
                REACH {previewShip.scoreRequired.toLocaleString()} PTS
              </Text>
              <Text style={[styles.detailNeed, { fontFamily: MONO }]}>
                {(previewShip.scoreRequired - highScore).toLocaleString()} MORE NEEDED
              </Text>
            </>
          ) : previewShip.scoreRequired === 0 ? (
            <Text style={[styles.detailUnlock, { fontFamily: MONO, color: '#4FC3F7' }]}>
              DEFAULT SHIP
            </Text>
          ) : (
            <>
              <Text style={[styles.detailUnlock, { fontFamily: MONO, color: '#69F0AE' }]}>
                UNLOCKED
              </Text>
              {!isActiveSelection && (
                <Text style={[styles.detailRequire, { fontFamily: MONO, color: '#555' }]}>
                  TAP TO SELECT
                </Text>
              )}
            </>
          )}

          <Text style={[styles.detailCount, { fontFamily: MONO }]}>
            {SHIPS.filter((s) => highScore >= s.scoreRequired).length} / {SHIPS.length} UNLOCKED
          </Text>
        </View>
      </View>

      {/* ── Ship grid ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.grid, { padding: H_PAD, gap: GAP }]}
        showsVerticalScrollIndicator={false}
      >
        {SHIPS.map((ship) => {
          const isLocked = highScore < ship.scoreRequired;
          const isSelected = ship.id === selectedShipId;
          const isPreviewed = ship.id === previewId;

          return (
            <Pressable
              key={ship.id}
              style={({ pressed }: { pressed: boolean }) => [
                styles.card,
                { width: cardW, height: cardH },
                isSelected && styles.cardSelected,
                isPreviewed && !isSelected && styles.cardPreviewed,
                isLocked && !isPreviewed && styles.cardLocked,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleCardPress(ship.id, isLocked)}
              accessibilityLabel={`${ship.name}${isLocked ? ' locked' : ''}`}
            >
              <ShipPreview ship={ship} size={cardW * 0.72} opacity={isLocked ? 0.25 : 1} />

              <Text
                style={[
                  styles.cardName,
                  { fontFamily: MONO },
                  isLocked && !isPreviewed && styles.cardNameLocked,
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  detailPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    minHeight: 160,
  },
  detailText: { flex: 1, gap: 5 },
  detailName: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  detailUnlock: { fontSize: 10, letterSpacing: 1 },
  detailRequire: { color: '#FF6D00', fontSize: 9, letterSpacing: 1 },
  detailNeed: { color: '#555', fontSize: 9, letterSpacing: 1 },
  detailCount: { color: '#333', fontSize: 9, letterSpacing: 1, marginTop: 4 },

  scroll: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    borderRadius: 6,
    backgroundColor: '#080808',
    gap: 6,
    position: 'relative',
  },
  cardSelected: { borderColor: '#4FC3F7', borderWidth: 2, backgroundColor: '#0A1520' },
  cardPreviewed: { borderColor: '#FF6D00', borderWidth: 1.5, backgroundColor: '#120A00' },
  cardLocked: { borderColor: '#111' },
  cardPressed: { opacity: 0.75 },

  cardName: { color: '#888', fontSize: 6, letterSpacing: 1, textAlign: 'center' },
  cardNameLocked: { color: '#2A2A2A' },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  lockIcon: { fontSize: 14, opacity: 0.5 },
  lockScore: { color: '#444', fontSize: 8, letterSpacing: 1 },

  closeBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  closeBtnTxt: { color: '#555', fontSize: 12, letterSpacing: 3 },
});
