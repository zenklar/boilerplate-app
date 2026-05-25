import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ToastAndroid, Platform, Alert,
} from 'react-native';
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

export default function Settings() {
  const router = useRouter();
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
                    style={[styles.appearanceOption, { borderRadius: theme.radius.sm, marginLeft: i > 0 ? 8 : 0, backgroundColor: theme.colors.text }]}
                    onPress={() => setThemeMode(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.appearanceLabel, { color: theme.colors.background, fontSize: theme.fontSize.sm }]}>
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

        {/* ACCOUNT SECTION */}
        <SettingsSection title="Account">
          <View style={[styles.accountHeader, { borderBottomColor: theme.colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <View
              style={[styles.avatar, { backgroundColor: theme.colors.text }]}
            >
              <Text style={[styles.avatarText, { color: theme.colors.background }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.accountName, { color: theme.colors.text, fontSize: theme.fontSize.lg }]}>{fullName}</Text>
              <Text style={[styles.accountEmail, { color: theme.colors.textMuted, fontSize: theme.fontSize.sm }]} numberOfLines={1}>
                {profile?.email ?? ''}
              </Text>
            </View>
          </View>
          <View style={[styles.uuidRowWrap, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.separator }]}>
            <View style={styles.iconWrap}>
              <Ionicons name="finger-print-outline" size={18} color={theme.colors.text} />
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
            onGoToShop={() => router.push('/(app)/shop')}
          />
        </SettingsSection>

        {/* GAME GUIDES SECTION */}
        <SettingsSection title="Game Guides">
          <FaqAccordion variant="games" />
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
