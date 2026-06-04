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
  const { balance, load } = useCoinStore();

  useEffect(() => { load(); }, [load]);

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
        <View style={{ flex: 1 }} />
        <View style={[styles.coinChip, { backgroundColor: theme.colors.surfaceSecondary, borderColor: theme.colors.border }]}>
          <Ionicons name="cash-outline" size={14} color="#FFD700" />
          <Text style={[styles.coinText, { color: theme.colors.text }]}>{balance}</Text>
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
  },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  coinText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
