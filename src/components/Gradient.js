import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

// =========================================================================
// DEGRADADO CON SVG (sin librerías extra)
// stops: [{ offset: 0, color: '#000', opacity: 1 }, ...]
// x2 / y2 marcan la dirección: x2='1' y2='0' horizontal, x2='0' y2='1' vertical
// Se mide el tamaño real: en Android el "100%" dejaba una franja sin color
// =========================================================================
export default function Gradient({ id, stops, x2 = '0', y2 = '1', style }) {
  const [size, setSize] = useState(null);
  const w = size ? size.width : '100%';
  const h = size ? size.height : '100%';

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      <Svg width={w} height={h} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
            {stops.map((s, i) => (
              <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={w} height={h} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
