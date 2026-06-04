import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onGasStart: () => void;
  onGasEnd: () => void;
  onBrakeStart: () => void;
  onBrakeEnd: () => void;
}

function Pedal({ icon, label, color, onStart, onEnd }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onStart: () => void;
  onEnd: () => void;
}) {
  return (
    <TouchableOpacity
      onPressIn={onStart}
      onPressOut={onEnd}
      activeOpacity={0.7}
      style={[styles.pedal, { borderColor: color }]}
    >
      <View style={[styles.inner, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={42} color={color} />
        <Text style={[styles.label, { color }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function GameControls({ onGasStart, onGasEnd, onBrakeStart, onBrakeEnd }: Props) {
  return (
    <View style={styles.row}>
      <Pedal icon="arrow-back-circle" label="BRAKE" color="#FF6B6B" onStart={onBrakeStart} onEnd={onBrakeEnd} />
      <View style={styles.gap} />
      <Pedal icon="arrow-forward-circle" label="GAS" color="#51CF66" onStart={onGasStart} onEnd={onGasEnd} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  gap: { flex: 1 },
  pedal: {
    width: 114,
    height: 114,
    borderRadius: 57,
    borderWidth: 3,
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
