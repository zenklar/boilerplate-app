import { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { APP_NAME, APP_ICON } from '../constants/social';
import { useCoinStore } from '../store/coinStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import ArcadeCoin from './ArcadeCoin';

export default function AppHeader() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const coins = useCoinStore((s) => s.coins);
  const loadCoins = useCoinStore((s) => s.loadCoins);
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const loadSubscription = useSubscriptionStore((s) => s.loadSubscription);

  useEffect(() => { loadCoins(); loadSubscription(); }, []);

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

        <View style={[styles.coinPill, isSubscribed ? {
          backgroundColor: 'rgba(255,215,0,0.12)',
          borderColor: '#FFD700',
        } : {
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: theme.colors.border,
        }]}>
          <ArcadeCoin size={20} />
          <Text style={[
            styles.coinCount,
            isSubscribed
              ? { color: '#FFD700', fontSize: 18, fontWeight: '800', lineHeight: 20 }
              : { color: theme.colors.text },
          ]}>
            {isSubscribed ? '∞' : coins.toLocaleString()}
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
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  coinCount: { fontSize: 13, fontWeight: '600' },
});
