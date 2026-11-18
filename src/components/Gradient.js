import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

// =========================================================================
// DEGRADADO CON SVG (sin librerías extra)
// stops: [{ offset: 0, color: '#000', opacity: 1 }, ...]
// x2 / y2 marcan la dirección: x2='1' y2='0' horizontal, x2='0' y2='1' vertical
// =========================================================================
export default function Gradient({ id, stops, x2 = '0', y2 = '1', style }) {
  return (
    <Svg
      width="100%"
      height="100%"
      style={[StyleSheet.absoluteFill, style]}
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
          {stops.map((s, i) => (
            <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
