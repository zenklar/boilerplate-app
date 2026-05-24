import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { ENEMIES } from '../constants/enemies';
import ENEMY_IMAGES from '../constants/enemyImages';
import { useEnemyCodexStore } from '../store/enemyCodexStore';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const COLS = 3;
const GAP = 10;
const H_PAD = 12;

type Status = 'unknown' | 'encountered' | 'killed';

function statusFor(id: number, enc: Record<number, true>, kil: Record<number, true>): Status {
  if (kil[id]) return 'killed';
  if (enc[id]) return 'encountered';
  return 'unknown';
}

export default function EnemyCodexScreen() {
  const encountered = useEnemyCodexStore((s) => s.encountered);
  const killed = useEnemyCodexStore((s) => s.killed);
  const load = useEnemyCodexStore((s) => s.load);
  const { width: screenW } = useWindowDimensions();

  const [previewId, setPreviewId] = useState<number>(ENEMIES[0].id);

  useEffect(() => { load(); }, []);

  const cardW = Math.floor((screenW - H_PAD * 2 - GAP * (COLS - 1)) / COLS);
  const cardH = Math.round(cardW * 1.35);

  const previewEnemy = ENEMIES.find((e) => e.id === previewId) ?? ENEMIES[0];
  const previewStatus = statusFor(previewEnemy.id, encountered, killed);
  const previewSrc = ENEMY_IMAGES[previewEnemy.id];

  const killedCount = ENEMIES.filter((e) => killed[e.id]).length;
  const encCount = ENEMIES.filter((e) => encountered[e.id]).length;

  // Tint for the preview image — silhouette when undiscovered
  const previewTint =
    previewStatus === 'unknown' ? { tintColor: '#222', opacity: 1 } : { opacity: 1 };

  return (
    <View style={styles.root}>
      {/* ── Detail panel ── */}
      <View style={styles.detailPanel}>
        <View style={styles.previewBox}>
          {previewSrc && (
            <Image
              source={previewSrc}
              style={[{ width: 110, height: 110 }, previewTint as any]}
              resizeMode="contain"
            />
          )}
          {previewStatus === 'unknown' && (
            <Text style={styles.previewQ}>?</Text>
          )}
        </View>
        <View style={styles.detailText}>
          <Text style={[styles.detailName, { fontFamily: MONO }]}>
            {previewStatus === 'unknown' ? '???' : previewEnemy.name}
          </Text>

          {previewStatus === 'killed' && (
            <Text style={[styles.detailUnlock, { fontFamily: MONO, color: '#69F0AE' }]}>
              DEFEATED
            </Text>
          )}
          {previewStatus === 'encountered' && (
            <Text style={[styles.detailUnlock, { fontFamily: MONO, color: '#FFD54F' }]}>
              ENCOUNTERED — NOT YET DESTROYED
            </Text>
          )}
          {previewStatus === 'unknown' && (
            <>
              <Text style={[styles.detailUnlock, { fontFamily: MONO, color: '#FF6D00' }]}>
                UNKNOWN
              </Text>
              <Text style={[styles.detailRequire, { fontFamily: MONO }]}>
                ENCOUNTER ONE IN BATTLE
              </Text>
            </>
          )}

          <Text style={[styles.detailCount, { fontFamily: MONO }]}>
            {killedCount} / {ENEMIES.length} DEFEATED · {encCount} ENCOUNTERED
          </Text>
        </View>
      </View>

      {/* ── Enemy grid ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.grid, { padding: H_PAD, gap: GAP }]}
        showsVerticalScrollIndicator={false}
      >
        {ENEMIES.map((enemy) => {
          const status = statusFor(enemy.id, encountered, killed);
          const isPreviewed = enemy.id === previewId;
          const src = ENEMY_IMAGES[enemy.id];

          return (
            <Pressable
              key={enemy.id}
              style={({ pressed }: { pressed: boolean }) => [
                styles.card,
                { width: cardW, height: cardH },
                status === 'killed' && styles.cardKilled,
                isPreviewed && styles.cardPreviewed,
                status === 'unknown' && !isPreviewed && styles.cardLocked,
                pressed && styles.cardPressed,
              ]}
              onPress={() => setPreviewId(enemy.id)}
              accessibilityLabel={`${enemy.name} ${status}`}
            >
              {src && (
                <Image
                  source={src}
                  style={[
                    { width: cardW * 0.72, height: cardW * 0.72 },
                    status === 'unknown' && { tintColor: '#222' },
                  ] as any}
                  resizeMode="contain"
                />
              )}

              <Text
                style={[
                  styles.cardName,
                  { fontFamily: MONO },
                  status === 'unknown' && styles.cardNameLocked,
                ]}
                numberOfLines={1}
              >
                {status === 'unknown' ? '???' : enemy.name}
              </Text>

              {status === 'killed' && (
                <View style={styles.killedBadge}>
                  <Text style={[styles.killedBadgeTxt, { fontFamily: MONO }]}>✓</Text>
                </View>
              )}
              {status === 'encountered' && (
                <View style={styles.seenBadge}>
                  <Text style={[styles.seenBadgeTxt, { fontFamily: MONO }]}>!</Text>
                </View>
              )}
              {status === 'unknown' && !isPreviewed && (
                <View style={styles.lockOverlay}>
                  <Text style={styles.lockIcon}>?</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
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
  previewBox: {
    width: 130, height: 130,
    alignItems: 'center', justifyContent: 'center',
  },
  previewQ: {
    position: 'absolute',
    color: '#FF6D00', fontSize: 56, fontWeight: '900',
  },
  detailText: { flex: 1, gap: 5 },
  detailName: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  detailUnlock: { fontSize: 10, letterSpacing: 1 },
  detailRequire: { color: '#FF6D00', fontSize: 9, letterSpacing: 1 },
  detailCount: { color: '#666', fontSize: 10, letterSpacing: 1, marginTop: 4 },

  scroll: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },

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
  cardKilled: { borderColor: '#2E7D32', backgroundColor: '#06140A' },
  cardPreviewed: { borderColor: '#FF6D00', borderWidth: 1.5, backgroundColor: '#120A00' },
  cardLocked: { borderColor: '#111' },
  cardPressed: { opacity: 0.75 },

  cardName: { color: '#EEE', fontSize: 9, letterSpacing: 1, textAlign: 'center' },
  cardNameLocked: { color: '#444' },

  killedBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#2E7D32',
    alignItems: 'center', justifyContent: 'center',
  },
  killedBadgeTxt: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  seenBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FFD54F',
    alignItems: 'center', justifyContent: 'center',
  },
  seenBadgeTxt: { color: '#000', fontSize: 12, fontWeight: '900' },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  lockIcon: { color: '#1F1F1F', fontSize: 48, fontWeight: '900' },
});
