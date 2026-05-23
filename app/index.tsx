import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../theme';
import { APP_NAME } from '../constants/social';

export default function Index() {
  const { session, loading } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (!loading) {
      if (session) {
        router.replace('/(app)/home');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [loading, session]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.appName, { color: theme.colors.text, fontSize: theme.fontSize.xxl }]}>
        {APP_NAME}
      </Text>
      <ActivityIndicator
        size="large"
        color={theme.colors.primary}
        style={{ marginTop: theme.spacing.lg }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appName: { fontWeight: '700', letterSpacing: -0.5 },
});
