import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =========================================================================
// PALETAS: modo claro y modo oscuro (mismos nombres, distintos valores)
// =========================================================================
const BRAND = {
  greenDark: '#0d3827',
  greenMain: '#008A3B',
  greenMid: '#168A48',
  gold: '#CAB118',
  goldPill: '#FACC15',
};

export const LIGHT = {
  ...BRAND,
  mode: 'light',
  bg: '#F3F7F4', // fondo de página
  surface: '#FFFFFF', // tarjetas
  surfaceAlt: '#F9FAFB', // campos, filas
  border: '#E5E7EB',
  text: '#111827',
  textSoft: '#4B5563',
  textMuted: '#6B7280',
  accentSoft: '#E6F4EA', // fondo de íconos verdes
  sidebar: '#FFFFFF',
  sidebarActive: '#E6F4EA',
  overlay: 'rgba(0,0,0,0.45)',
  shadow: '#000000',
  statusBar: 'dark-content',
};

export const DARK = {
  ...BRAND,
  greenMain: '#22C55E', // verde más brillante para que contraste en oscuro
  mode: 'dark',
  bg: '#0B1410',
  surface: '#132019',
  surfaceAlt: '#1A2A21',
  border: '#24372C',
  text: '#F1F5F2',
  textSoft: '#C7D2CB',
  textMuted: '#8FA197',
  accentSoft: 'rgba(34,197,94,0.14)',
  sidebar: '#0F1A14',
  sidebarActive: 'rgba(34,197,94,0.16)',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
  statusBar: 'light-content',
};

const STORAGE_KEY = 'theme_mode';

const ThemeContext = createContext({
  colors: LIGHT,
  isDark: false,
  toggleTheme: () => {},
});

// Envuelve la app y recuerda la elección del usuario (AsyncStorage)
export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'dark') setIsDark(true);
      })
      .catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      colors: isDark ? DARK : LIGHT,
      isDark,
      toggleTheme: () => {
        setIsDark((d) => {
          const next = !d;
          AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
          return next;
        });
      },
    }),
    [isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
