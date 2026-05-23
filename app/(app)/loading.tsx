import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../theme';
import { APP_NAME, APP_SLOGAN, APP_ICON } from '../../constants/social';

const DURATION = 2200;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_WIDTH = SCREEN_WIDTH * 0.6;

export default function LoadingScreen() {
  const { theme } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      useNativeDriver: false,
    }).start(() => {
      router.replace('/(app)/home');
    });
  }, []);

  const barFill = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BAR_WIDTH],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Logo + branding */}
      <View style={styles.brand}>
        <Image
          source={APP_ICON}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.appName, { color: theme.colors.text, fontSize: theme.fontSize.xxxl }]}>
          {APP_NAME}
        </Text>
        <Text style={[styles.slogan, { color: theme.colors.textMuted, fontSize: theme.fontSize.md }]}>
          {APP_SLOGAN}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barArea}>
        <View
          style={[
            styles.barTrack,
            { width: BAR_WIDTH, backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.radius.full },
          ]}
        >
          <Animated.View
            style={[
              styles.barFill,
              { width: barFill, backgroundColor: theme.colors.primary, borderRadius: theme.radius.full },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 8,
  },
  appName: {
    fontWeight: '700',
    letterSpacing: -1,
  },
  slogan: {
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  barArea: {
    paddingBottom: 60,
    alignItems: 'center',
  },
  barTrack: {
    height: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
});
