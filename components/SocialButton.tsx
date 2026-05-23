import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

type Provider = 'google' | 'facebook' | 'apple';

type Props = {
  provider: Provider;
  onPress: () => void;
  loading?: boolean;
};

const PROVIDER_CONFIG: Record<Provider, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColorLight: string;
  iconColorDark: string;
}> = {
  google: {
    label: 'Continue with Google',
    icon: 'logo-google',
    iconColorLight: '#4285F4',
    iconColorDark: '#4285F4',
  },
  facebook: {
    label: 'Continue with Facebook',
    icon: 'logo-facebook',
    iconColorLight: '#1877F2',
    iconColorDark: '#4C9FFF',
  },
  apple: {
    label: 'Continue with Apple',
    icon: 'logo-apple',
    iconColorLight: '#000000',
    iconColorDark: '#FFFFFF',
  },
};

export default function SocialButton({ provider, onPress, loading = false }: Props) {
  const { theme } = useTheme();
  const config = PROVIDER_CONFIG[provider];

  const isLight = theme.mode === 'light';
  const gradientColors: [string, string] = isLight
    ? ['#FFFFFF', '#EBEBF0']
    : ['#2C2C2E', '#1C1C1E'];
  const borderColor = isLight ? '#C8C8CE' : 'rgba(255,255,255,0.13)';
  const textColor = isLight ? '#111111' : '#FFFFFF';
  const iconColor = isLight ? config.iconColorLight : config.iconColorDark;

  return (
    <TouchableOpacity
      style={[styles.wrap, { borderRadius: theme.radius.md, marginBottom: 12 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.button,
          {
            borderColor,
            borderRadius: theme.radius.md,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <View style={styles.content}>
            <Ionicons name={config.icon} size={20} color={iconColor} style={styles.icon} />
            <Text style={[styles.label, { color: textColor, fontSize: theme.fontSize.md }]}>
              {config.label}
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
  },
  label: {
    fontWeight: '600',
  },
});
