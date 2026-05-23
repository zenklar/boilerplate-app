import { View, StyleSheet } from 'react-native';
import AsteroidsGame from '../../components/AsteroidsGame';

export default function Home() {
  return (
    <View style={styles.container}>
      <AsteroidsGame />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
