import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../theme';
import AppHeader from '../../components/AppHeader';
import BottomNav from '../../components/BottomNav';
import { useGameUIStore } from '../../store/gameStore';

export default function AppLayout() {
  const { session, loading } = useAuth();
  const { theme } = useTheme();
  const isGamePlaying = useGameUIStore((s) => s.isGamePlaying);

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/(auth)/login');
    }
  }, [session, loading]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {!isGamePlaying && <AppHeader />}
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      {!isGamePlaying && <BottomNav />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
