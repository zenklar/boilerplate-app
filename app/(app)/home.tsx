import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

export default function Home() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
