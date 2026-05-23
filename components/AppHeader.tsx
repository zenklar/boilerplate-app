import { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { APP_NAME, APP_ICON } from '../constants/social';
import { useCoinStore } from '../store/coinStore';

export default function AppHeader() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const coins = useCoinStore((s) => s.coins);
  const loadCoins = useCoinStore((s) => s.loadCoins);

  useEffect(() => { loadCoins(); }, []);

  return (
    <LinearGradient
      colors={theme.gradients.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        styles.header,
        {
          borderBottomColor: theme.colors.headerBorder,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Image source={APP_ICON} style={styles.headerIcon} resizeMode="contain" />
        <Text style={[styles.title, { color: theme.colors.text, fontSize: theme.fontSize.lg }]}>
          {APP_NAME}
        </Text>

        <View style={styles.coinPill}>
          <View style={[styles.coinBadge, { borderColor: '#B8860B' }]}>
            <Text style={styles.coinBadgeLetter}>C</Text>
          </View>
          <Text style={[styles.coinCount, { color: theme.colors.text }]}>
            {coins.toLocaleString()}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.5,
    flex: 1,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  coinBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FFD700',
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  coinBadgeLetter: { color: '#6B4500', fontSize: 9, fontWeight: '900' },
  coinCount: { fontSize: 14, fontWeight: '700' },
});
