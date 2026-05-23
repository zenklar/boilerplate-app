import { useState } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme';
import SocialButton from '../../components/SocialButton';
import { APP_NAME, APP_SLOGAN, APP_ICON } from '../../constants/social';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  async function signInWithEmail() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoadingEmail(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoadingEmail(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/(app)/loading');
  }

  async function signInWithProvider(provider: 'google' | 'facebook' | 'apple') {
    setLoadingProvider(provider);
    setError(null);
    try {
      const redirectTo = makeRedirectUri({ scheme: 'boilerplate-app' });
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oauthError) throw oauthError;
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success' && result.url) {
          const hash = result.url.split('#')[1] ?? '';
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed. Please try again.');
    } finally {
      setLoadingProvider(null);
    }
  }

  const inputStyle = (field: string) => [
    styles.input,
    {
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.inputText,
      borderColor: focusedField === field ? theme.colors.borderFocused : theme.colors.border,
      borderRadius: theme.radius.md,
      fontSize: theme.fontSize.md,
      outlineWidth: 0,
    } as any,
  ];

  const anyLoading = loadingEmail || loadingProvider !== null;

  return (
    <LinearGradient
      colors={theme.gradients.screen}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.safe}
    >
      <SafeAreaView style={styles.fill}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <Image source={APP_ICON} style={styles.logoImage} resizeMode="contain" />
          <Text style={[styles.appName, { color: theme.colors.text }]}>{APP_NAME}</Text>
          <Text style={[styles.slogan, { color: theme.colors.textSecondary }]}>{APP_SLOGAN}</Text>
        </View>

        <Text style={[styles.heading, { color: theme.colors.text }]}>Welcome back</Text>

        {/* Email / Password */}
        <TextInput
          style={inputStyle('email')}
          placeholder="Email"
          placeholderTextColor={theme.colors.inputPlaceholder}
          value={email}
          onChangeText={setEmail}
          onFocus={() => setFocusedField('email')}
          onBlur={() => setFocusedField(null)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="next"
          editable={!anyLoading}
        />
        <TextInput
          style={[...inputStyle('password'), { marginTop: 12 }]}
          placeholder="Password"
          placeholderTextColor={theme.colors.inputPlaceholder}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setFocusedField('password')}
          onBlur={() => setFocusedField(null)}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={signInWithEmail}
          editable={!anyLoading}
        />

        {error && (
          <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
        )}

        <TouchableOpacity
          style={[
            styles.primaryBtnWrap,
            { borderRadius: theme.radius.md, opacity: anyLoading ? 0.7 : 1, marginTop: 20 },
          ]}
          onPress={signInWithEmail}
          disabled={anyLoading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={theme.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.primaryBtn, { borderRadius: theme.radius.md }]}
          >
            {loadingEmail ? (
              <ActivityIndicator color={theme.colors.primaryText} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: theme.colors.primaryText, fontSize: theme.fontSize.md }]}>
                Sign In
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          <Text style={[styles.dividerText, { color: theme.colors.textMuted }]}>or continue with</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
        </View>

        {/* Social */}
        <SocialButton
          provider="google"
          onPress={() => signInWithProvider('google')}
          loading={loadingProvider === 'google'}
        />
        <SocialButton
          provider="facebook"
          onPress={() => signInWithProvider('facebook')}
          loading={loadingProvider === 'facebook'}
        />
        <SocialButton
          provider="apple"
          onPress={() => signInWithProvider('apple')}
          loading={loadingProvider === 'apple'}
        />

        {/* Footer */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/signup')}
          style={styles.footerLink}
        >
          <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
            Don't have an account?{' '}
            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40 },
  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoImage: {
    width: 80, height: 80, borderRadius: 18, marginBottom: 16,
  },
  appName: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 8 },
  slogan: { fontSize: 15, textAlign: 'center' },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  input: { paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1 },
  error: { fontSize: 13, marginTop: 10 },
  primaryBtnWrap: { overflow: 'hidden' },
  primaryBtn: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', height: 50 },
  primaryBtnText: { fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 10 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12 },
  footerLink: { alignItems: 'center', marginTop: 24 },
  footerText: { fontSize: 14 },
});
