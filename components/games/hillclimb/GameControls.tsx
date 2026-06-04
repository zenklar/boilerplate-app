import React, { useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onGasStart: () => void;
  onGasEnd: () => void;
  onBrakeStart: () => void;
  onBrakeEnd: () => void;
}

function PedalButton({
  icon,
  label,
  color,
  side,
  onStart,
  onEnd,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  side: 'left' | 'right';
  onStart: () => void;
  onEnd: () => void;
}) {
  const pressedRef = useRef(false);

  const handlePressIn = useCallback((_e: GestureResponderEvent) => {
    pressedRef.current = true;
    onStart();
  }, [onStart]);

  const handlePressOut = useCallback((_e: GestureResponderEvent) => {
    pressedRef.current = false;
    onEnd();
  }, [onEnd]);

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.75}
      style={[styles.pedal, { borderColor: color }, side === 'left' ? styles.pedalLeft : styles.pedalRight]}
    >
      <View style={[styles.pedalInner, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={40} color={color} />
        <Text style={[styles.pedalLabel, { color }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function GameControls({ onGasStart, onGasEnd, onBrakeStart, onBrakeEnd }: Props) {
  return (
    <View style={styles.container}>
      <PedalButton
        icon="arrow-back-circle"
        label="BRAKE"
        color="#FF6B6B"
        side="left"
        onStart={onBrakeStart}
        onEnd={onBrakeEnd}
      />
      <View style={styles.center} />
      <PedalButton
        icon="arrow-forward-circle"
        label="GAS"
        color="#51CF66"
        side="right"
        onStart={onGasStart}
        onEnd={onGasEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  center: {
    flex: 1,
  },
  pedal: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    overflow: 'hidden',
  },
  pedalLeft: {},
  pedalRight: {},
  pedalInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pedalLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
