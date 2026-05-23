import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { ShipDef } from '../constants/ships';
import SHIP_IMAGES from '../constants/shipImages';

type Props = {
  ship: ShipDef;
  size?: number;
  /** Extra opacity for the image (default 1). Locked ships use 0.25. */
  opacity?: number;
};

export default function ShipPreview({ ship, size = 80, opacity = 1 }: Props) {
  const source = SHIP_IMAGES[ship.id];
  if (!source) return <View style={{ width: size, height: size }} />;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={source}
        style={{ width: size, height: size, opacity }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
