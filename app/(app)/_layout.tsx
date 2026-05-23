import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../theme';
import AppHeader from '../../components/AppHeader';
import BottomNav from '../../components/BottomNav';

export default function AppLayout() {
  const { session, loading } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/(auth)/login');
    }
  }, [session, loading]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AppHeader />
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
