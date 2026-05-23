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

export default function Signup() {
  const { theme } = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  async function signUpWithEmail() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoadingEmail(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
        },
      },
    });
    setLoadingEmail(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    // Supabase sends a confirmation email by default.
    // If email confirmation is disabled in your project, the user is logged in immediately.
    if (data.session) {
      // Logged in immediately — profile trigger handles row creation
      router.replace('/(app)/home');
    } else {
      setSuccess(true);
    }
  }

  async function signUpWithProvider(provider: 'google' | 'facebook' | 'apple') {
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
            if (firstName || lastName) {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from('profiles').upsert({
                  id: user.id,
                  first_name: firstName.trim() || null,
                  last_name: lastName.trim() || null,
                });
              }
            }
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign up failed. Please try again.');
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

  if (success) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <View style={styles.successContainer}>
          <Text style={[styles.successIcon, { color: theme.colors.success }]}>✓</Text>
          <Text style={[styles.successTitle, { color: theme.colors.text, fontSize: theme.fontSize.xl }]}>
            Check your email
          </Text>
          <Text style={[styles.successBody, { color: theme.colors.textMuted, fontSize: theme.fontSize.md }]}>
            We sent a confirmation link to{'\n'}
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{email}</Text>
          </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.footerLink}>
            <Text style={[{ color: theme.colors.primary, fontWeight: '600', fontSize: theme.fontSize.md }]}>
              Back to Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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

        <Text style={[styles.heading, { color: theme.colors.text }]}>Create your account</Text>

        {/* Name row */}
        <View style={styles.nameRow}>
          <TextInput
            style={[...inputStyle('firstName'), styles.nameInput]}
            placeholder="First name"
            placeholderTextColor={theme.colors.inputPlaceholder}
            value={firstName}
            onChangeText={setFirstName}
            onFocus={() => setFocusedField('firstName')}
            onBlur={() => setFocusedField(null)}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!anyLoading}
          />
          <TextInput
            style={[...inputStyle('lastName'), styles.nameInput]}
            placeholder="Last name"
            placeholderTextColor={theme.colors.inputPlaceholder}
            value={lastName}
            onChangeText={setLastName}
            onFocus={() => setFocusedField('lastName')}
            onBlur={() => setFocusedField(null)}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!anyLoading}
          />
        </View>

        {/* Email / Password */}
        <TextInput
          style={[...inputStyle('email'), { marginBottom: 12 }]}
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
          style={inputStyle('password')}
          placeholder="Password (min 8 characters)"
          placeholderTextColor={theme.colors.inputPlaceholder}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setFocusedField('password')}
          onBlur={() => setFocusedField(null)}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={signUpWithEmail}
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
          onPress={signUpWithEmail}
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
                Create Account
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
          onPress={() => signUpWithProvider('google')}
          loading={loadingProvider === 'google'}
        />
        <SocialButton
          provider="facebook"
          onPress={() => signUpWithProvider('facebook')}
          loading={loadingProvider === 'facebook'}
        />
        <SocialButton
          provider="apple"
          onPress={() => signUpWithProvider('apple')}
          loading={loadingProvider === 'apple'}
        />

        {/* Footer */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          style={styles.footerLink}
        >
          <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
            Already have an account?{' '}
            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Log in</Text>
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
  nameRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  nameInput: { flex: 1 },
  input: { paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1 },
  error: { fontSize: 13, marginTop: 10 },
  primaryBtn: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', height: 50 },
  primaryBtnWrap: { overflow: 'hidden' },
  primaryBtnText: { fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 10 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12 },
  footerLink: { alignItems: 'center', marginTop: 24 },
  footerText: { fontSize: 14 },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  successIcon: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  successBody: { textAlign: 'center', lineHeight: 24, marginBottom: 32 },
});
