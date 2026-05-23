/**
 * ShipPreview
 * Renders a ShipDef as a 100×100 design-space drawing scaled to `size` px.
 * Uses only View primitives (absolute positioning, borderRadius, transform).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { ShipDef, RectPrim, CirclePrim } from '../constants/ships';

type Props = {
  ship: ShipDef;
  /** Rendered size in pixels (square). Default 80. */
  size?: number;
};

export default function ShipPreview({ ship, size = 80 }: Props) {
  const scale = size / 100;
  const { color, accent, rects, circles } = ship;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {rects.map((rect: RectPrim, i: number) => {
        const col = rect.col === 'a' ? accent : color;
        return (
          <View
            key={`r${i}`}
            style={{
              position: 'absolute',
              left: rect.x * scale,
              top: rect.y * scale,
              width: rect.w * scale,
              height: rect.h * scale,
              borderRadius: (rect.r ?? 0) * scale,
              backgroundColor: col,
              transform: rect.angle != null
                ? [{ rotate: `${rect.angle}deg` }]
                : undefined,
            }}
          />
        );
      })}
      {circles.map((circle: CirclePrim, i: number) => {
        const col = circle.col === 'a' ? accent : color;
        const d = circle.d * scale;
        return (
          <View
            key={`c${i}`}
            style={{
              position: 'absolute',
              left: circle.cx * scale - d / 2,
              top: circle.cy * scale - d / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: col,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
});
