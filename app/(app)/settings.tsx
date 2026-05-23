import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ToastAndroid, Platform, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useTheme } from '../../theme';
import { useProfileStore } from '../../store/profileStore';
import { SOCIAL_URLS, PRIVACY_POLICY_URL } from '../../constants/social';
import SettingsSection from '../../components/settings/SettingsSection';
import SettingsRow from '../../components/settings/SettingsRow';
import FaqAccordion from '../../components/settings/FaqAccordion';
import ChangePasswordModal from '../../components/modals/ChangePasswordModal';
import LogoutModal from '../../components/modals/LogoutModal';
import DeleteAccountModal from '../../components/modals/DeleteAccountModal';
import PrivacyPolicyModal from '../../components/modals/PrivacyPolicyModal';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';
import type { ThemeMode } from '../../theme';
import { useSubscriptionStore } from '../../store/subscriptionStore';

type SocialIcon =
  | { lib: 'ionicons'; icon: keyof typeof Ionicons.glyphMap }
  | { lib: 'fa6'; icon: string };

const SOCIAL_ICONS: ({ key: keyof typeof SOCIAL_URLS; label: string } & SocialIcon)[] = [
  { key: 'facebook', label: 'Facebook', lib: 'ionicons', icon: 'logo-facebook' },
  { key: 'instagram', label: 'Instagram', lib: 'ionicons', icon: 'logo-instagram' },
  { key: 'youtube', label: 'YouTube', lib: 'ionicons', icon: 'logo-youtube' },
  { key: 'x', label: 'X', lib: 'fa6', icon: 'x-twitter' },
  { key: 'tiktok', label: 'TikTok', lib: 'fa6', icon: 'tiktok' },
];

function SubscriptionCard() {
  const { theme } = useTheme();
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const subscribe = useSubscriptionStore((s) => s.subscribe);
  const unsubscribe = useSubscriptionStore((s) => s.unsubscribe);
  const loadSubscription = useSubscriptionStore((s) => s.loadSubscription);

  const shimmer = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadSubscription(); }, []);

  useEffect(() => {
    if (!isSubscribed) { shimmer.setValue(0); glow.setValue(0); return; }
    const shimAnim = Animated.loop(Animated.timing(shimmer, { toValue: 1, duration: 2600, useNativeDriver: true }));
    const glowAnim = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1400, useNativeDriver: true }),
    ]));
    shimAnim.start(); glowAnim.start();
    return () => { shimAnim.stop(); glowAnim.stop(); };
  }, [isSubscribed]);

  const shimTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-320, 420] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });

  return (
    <View style={subStyles.wrapper}>
      <LinearGradient
        colors={isSubscribed ? ['#0A1A4A', '#0D3080', '#0A1A4A'] : ['#0A0F20', '#0D1535', '#0A0F20']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={subStyles.card}
      >
        {isSubscribed && (
          <Animated.View
            pointerEvents="none"
            style={[subStyles.shimmer, { transform: [{ translateX: shimTranslate }] }]}
          />
        )}
        {isSubscribed && (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { borderRadius: 16, borderWidth: 1.5, borderColor: '#4FC3F7', opacity: glowOpacity }]}
          />
        )}

        <View style={subStyles.topRow}>
          <View style={subStyles.vipBadge}>
            <Ionicons name="star" size={11} color="#FFD700" />
            <Text style={subStyles.vipText}>VIP</Text>
          </View>
          {isSubscribed && (
            <View style={subStyles.activeDot}>
              <View style={subStyles.activeDotInner} />
              <Text style={subStyles.activeLabel}>ACTIVE</Text>
            </View>
          )}
        </View>

        <Text style={subStyles.title}>Arcade Pass</Text>
        <Text style={subStyles.subtitle}>Unlimited plays across all games</Text>

        <View style={subStyles.perks}>
          {['Unlimited coins — never pay per play', 'Early access to new games', 'VIP badge in leaderboards'].map((p) => (
            <View key={p} style={subStyles.perkRow}>
              <Ionicons name="checkmark-circle" size={14} color="#4FC3F7" />
              <Text style={subStyles.perkText}>{p}</Text>
            </View>
          ))}
        </View>

        <View style={subStyles.footer}>
          {!isSubscribed && (
            <Text style={subStyles.price}>
              <Text style={subStyles.priceStrike}>$14.99/mo  </Text>
              <Text style={subStyles.priceFree}>FREE</Text>
            </Text>
          )}
          <TouchableOpacity
            onPress={isSubscribed ? unsubscribe : subscribe}
            style={[subStyles.btn, isSubscribed ? subStyles.btnCancel : subStyles.btnSubscribe]}
            activeOpacity={0.8}
          >
            <Text style={subStyles.btnText}>{isSubscribed ? 'Cancel Subscription' : 'Activate Free'}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

export default function Settings() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const profile = useProfileStore((s) => s.profile);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'User';
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'U';

  async function copyUserId() {
    if (!profile?.id) return;
    await Clipboard.setStringAsync(profile.id);
    if (Platform.OS === 'android') {
      ToastAndroid.show('User ID copied', ToastAndroid.SHORT);
    } else if (Platform.OS === 'ios') {
      Alert.alert('Copied', 'User ID copied to clipboard.');
    }
  }

  const APPEARANCE_OPTIONS: { label: string; value: ThemeMode }[] = [
    { label: 'Light', value: 'light' },
    { label: 'System', value: 'system' },
    { label: 'Dark', value: 'dark' },
  ];

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: theme.spacing.xxl }]}>

        {/* APPEARANCE SECTION */}
        <SettingsSection title="Appearance">
          <View style={[styles.appearanceRow, { padding: 16 }]}>
            {APPEARANCE_OPTIONS.map((opt, i) => {
              const isActive = themeMode === opt.value;
              if (isActive) {
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.appearanceOption, { borderRadius: theme.radius.sm, marginLeft: i > 0 ? 8 : 0, overflow: 'hidden' }]}
                    onPress={() => setThemeMode(opt.value)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={theme.gradients.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill]}
                    />
                    <Text style={[styles.appearanceLabel, { color: theme.colors.primaryText, fontSize: theme.fontSize.sm }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.appearanceOption,
                    {
                      backgroundColor: theme.colors.backgroundSecondary,
                      borderRadius: theme.radius.sm,
                      marginLeft: i > 0 ? 8 : 0,
                    },
                  ]}
                  onPress={() => setThemeMode(opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.appearanceLabel, { color: theme.colors.textSecondary, fontSize: theme.fontSize.sm }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingsSection>

        {/* SUBSCRIPTION SECTION */}
        <SettingsSection title="Arcade Pass">
          <SubscriptionCard />
        </SettingsSection>

        {/* ACCOUNT SECTION */}
        <SettingsSection title="Account">
          <View style={[styles.accountHeader, { borderBottomColor: theme.colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <LinearGradient
              colors={theme.gradients.avatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={[styles.avatarText, { color: theme.colors.primaryText }]}>{initials}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.accountName, { color: theme.colors.text, fontSize: theme.fontSize.lg }]}>{fullName}</Text>
              <Text style={[styles.accountEmail, { color: theme.colors.textMuted, fontSize: theme.fontSize.sm }]} numberOfLines={1}>
                {profile?.email ?? ''}
              </Text>
            </View>
          </View>
          <View style={[styles.uuidRowWrap, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.separator }]}>
            <View style={styles.iconWrap}>
              <Ionicons name="finger-print-outline" size={18} color={theme.colors.primary} />
            </View>
            <Text selectable style={[styles.uuidText, { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, fontFamily: 'monospace' }]}>
              {profile?.id ?? 'N/A'}
            </Text>
            <TouchableOpacity onPress={copyUserId} style={styles.copyBtn} hitSlop={8}>
              <Ionicons name="copy-outline" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <SettingsRow
            icon="lock-closed-outline"
            label="Change Password"
            onPress={() => setShowChangePassword(true)}
          />
          <SettingsRow
            icon="log-out-outline"
            label="Log Out"
            onPress={() => setShowLogout(true)}
            isLast
          />
        </SettingsSection>

        {/* FAQ SECTION */}
        <SettingsSection title="FAQ">
          <FaqAccordion
            onDeleteAccount={() => setShowDeleteAccount(true)}
            onPrivacyPolicy={() => setShowPrivacyPolicy(true)}
          />
        </SettingsSection>

        {/* FOLLOW US SECTION */}
        <SettingsSection title="Follow Us">
          <View style={[styles.socialRow, { padding: 16 }]}>
            {SOCIAL_ICONS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.socialBtn, { backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.radius.md }]}
                onPress={() => Linking.openURL(SOCIAL_URLS[s.key])}
                activeOpacity={0.7}
              >
                {s.lib === 'fa6'
                  ? <FontAwesome6 name={s.icon} size={20} color={theme.colors.text} />
                  : <Ionicons name={s.icon} size={22} color={theme.colors.text} />}
              </TouchableOpacity>
            ))}
          </View>
        </SettingsSection>

        {/* APP VERSION */}
        <Text style={[styles.version, { color: theme.colors.textMuted, fontSize: theme.fontSize.xs }]}>
          Version {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>

      <ChangePasswordModal visible={showChangePassword} onClose={() => setShowChangePassword(false)} />
      <LogoutModal visible={showLogout} onClose={() => setShowLogout(false)} />
      <DeleteAccountModal visible={showDeleteAccount} onClose={() => setShowDeleteAccount(false)} />
      <PrivacyPolicyModal visible={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} />
    </SafeAreaView>
  );
}

const subStyles = StyleSheet.create({
  wrapper: { padding: 16, paddingTop: 8 },
  card: { borderRadius: 16, padding: 18, overflow: 'hidden' },
  shimmer: {
    position: 'absolute', top: 0, bottom: 0, width: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
    transform: [{ skewX: '-20deg' }],
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  vipBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)',
  },
  vipText: { color: '#FFD700', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  activeDot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF50' },
  activeLabel: { color: '#4CAF50', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
  subtitle: { color: '#7EB8D4', fontSize: 12, marginBottom: 14 },
  perks: { gap: 7, marginBottom: 18 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  perkText: { color: '#B0D8EC', fontSize: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  price: {},
  priceStrike: { color: '#5A7A8A', fontSize: 13, textDecorationLine: 'line-through' },
  priceFree: { color: '#4FC3F7', fontSize: 18, fontWeight: '800' },
  btn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22 },
  btnSubscribe: { backgroundColor: '#4FC3F7' },
  btnCancel: { backgroundColor: 'rgba(255,80,80,0.25)', borderWidth: 1, borderColor: 'rgba(255,80,80,0.5)' },
  btnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 16 },
  accountHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  accountName: { fontWeight: '600' },
  accountEmail: {},
  uuidRowWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  iconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  uuidText: { flex: 1 },
  copyBtn: { padding: 2 },
  appearanceRow: { flexDirection: 'row' },
  appearanceOption: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  appearanceLabel: { fontWeight: '600' },
  socialRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  socialBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  tiktokText: { fontSize: 14, fontWeight: '700' },
  version: { textAlign: 'center', paddingVertical: 16 },
});
