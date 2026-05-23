import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

type Tab = {
  label: string;
  route: '/(app)/home' | '/(app)/ships' | '/(app)/settings';
  segment: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
};

const TABS: Tab[] = [
  {
    label: 'Home',
    route: '/(app)/home',
    segment: '/home',
    icon: 'home-outline',
    iconFocused: 'home',
  },
  {
    label: 'Ships',
    route: '/(app)/ships',
    segment: '/ships',
    icon: 'rocket-outline',
    iconFocused: 'rocket',
  },
  {
    label: 'Settings',
    route: '/(app)/settings',
    segment: '/settings',
    icon: 'settings-outline',
    iconFocused: 'settings',
  },
];

export default function BottomNav() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  return (
    <LinearGradient
      colors={theme.gradients.tabBar}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        styles.container,
        {
          borderTopColor: theme.colors.tabBarBorder,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.segment || pathname.startsWith(tab.segment + '/');
        const color = isActive ? theme.colors.tabBarActive : theme.colors.tabBarInactive;

        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tab}
            onPress={() => router.replace(tab.route)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? tab.iconFocused : tab.icon}
              size={isActive ? 26 : 23}
              color={color}
            />
            <Text style={[
              styles.label,
              {
                color,
                fontSize: theme.fontSize.xs,
                fontWeight: isActive ? '700' : '500',
              },
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 3,
  },
  label: {},
});
