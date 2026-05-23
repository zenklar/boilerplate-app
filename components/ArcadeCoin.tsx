import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ArcadeCoin({ size = 48 }: { size?: number }) {
  const r = size / 2;
  const innerR = r * 0.78;
  const lineW = Math.max(1, size * 0.045);

  return (
    <View style={{ width: size, height: size }}>
      {/* Rim shadow */}
      <View style={{
        position: 'absolute', top: size * 0.06, left: size * 0.06,
        width: size * 0.88, height: size * 0.88, borderRadius: size * 0.44,
        backgroundColor: '#7A4800',
      }} />
      {/* Gold base */}
      <LinearGradient
        colors={['#FFF176', '#FFD700', '#E65100']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, borderRadius: r }}
      />
      {/* Inner face */}
      <LinearGradient
        colors={['#FFE57F', '#FFC107', '#FF8F00']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{
          position: 'absolute',
          top: r - innerR, left: r - innerR,
          width: innerR * 2, height: innerR * 2, borderRadius: innerR,
        }}
      />
      {/* Cross — horizontal */}
      <View style={{
        position: 'absolute',
        top: r - lineW / 2, left: r - innerR * 0.72,
        width: innerR * 1.44, height: lineW,
        backgroundColor: '#B8600040', borderRadius: lineW,
      }} />
      {/* Cross — vertical */}
      <View style={{
        position: 'absolute',
        top: r - innerR * 0.72, left: r - lineW / 2,
        width: lineW, height: innerR * 1.44,
        backgroundColor: '#B8600040', borderRadius: lineW,
      }} />
      {/* Shine */}
      <View style={{
        position: 'absolute',
        top: size * 0.1, left: size * 0.2,
        width: size * 0.28, height: size * 0.14,
        backgroundColor: 'rgba(255,255,255,0.55)',
        borderRadius: size * 0.07,
        transform: [{ rotate: '-35deg' }],
      }} />
    </View>
  );
}
