import { View, StyleSheet } from 'react-native';
import ShipSelectScreen from '../../components/ShipSelectScreen';

export default function ShipsPage() {
  return (
    <View style={styles.root}>
      <ShipSelectScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
