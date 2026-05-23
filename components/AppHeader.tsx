import { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

        {/* Coin balance pill — app-style, theme-aware */}
        <View style={[styles.coinPill, {
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: theme.colors.border,
        }]}>
          <Ionicons name="logo-usd" size={13} color="#FFD700" />
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
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  coinCount: { fontSize: 13, fontWeight: '600' },
});
