import React from 'react';
import 'react-native-gesture-handler';
import Navigation from './navigation/Navigation';
import { ThemeProvider } from './src/theme/ThemeContext';

export default function App() {
  // ThemeProvider: modo claro / oscuro disponible en todas las pantallas
  return (
    <ThemeProvider>
      <Navigation />
    </ThemeProvider>
  );
}
