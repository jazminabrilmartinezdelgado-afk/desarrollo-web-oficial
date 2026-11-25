import React from 'react';
import 'react-native-gesture-handler';
import Navigation from './navigation/Navigation';
import { ThemeProvider } from './src/theme/ThemeContext';

// [S1-10] Punto de inicio de la app: carga el modo claro/oscuro y la navegación.
export default function App() {
  // ThemeProvider: modo claro / oscuro disponible en todas las pantallas
  return (
    <ThemeProvider>
      <Navigation />
    </ThemeProvider>
  );
}
