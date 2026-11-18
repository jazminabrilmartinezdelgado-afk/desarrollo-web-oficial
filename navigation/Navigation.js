import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Platform, Easing } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth'; //escuchador 
import { auth, isFirebaseConfigured } from '../src/config/firebaseConfig';
import { useTheme } from '../src/theme/ThemeContext';

// Ancho máximo de la app: en la compu se ve como un celular centrado
export const APP_MAX_WIDTH = 480;
// Importación de pantallas del sistema
import Login from '../screens/Login';
import SignUp from '../screens/SignUp';
import Home from '../screens/Home';
import Proveedores from '../screens/Proveedores';
import Perfil from '../screens/Perfil';

const Stack = createStackNavigator();

// ---------- TRANSICIÓN ENTRE PANTALLAS: fundido + leve deslizamiento ----------
const SMOOTH = Easing.bezier(0.22, 1, 0.36, 1);
const fadeSlide = ({ current }) => ({
  cardStyle: {
    opacity: current.progress,
    transform: [
      { translateY: current.progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
    ],
  },
});
const TRANSITION = {
  open: { animation: 'timing', config: { duration: 450, easing: SMOOTH } },
  close: { animation: 'timing', config: { duration: 300, easing: SMOOTH } },
};

export default function Navigation() {
  const { colors, isDark } = useTheme();
  // Estados para controlar el usuario actual y la carga inicial
  const [user, setUser] = useState(null); // Cambiamos a null por defecto para evitar bucles de carga infinita en web
  const [loading, setLoading] = useState(true);

  // ---------- OCULTAR BARRAS DE SCROLL EN WEB (el scroll sigue funcionando) ----------
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.setAttribute('data-hide-scrollbars', 'true');
    style.textContent =
      '* { scrollbar-width: none; -ms-overflow-style: none; } *::-webkit-scrollbar { display: none; }';
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ---------- VIGILANTE DE SESIÓN EN TIEMPO REAL (Firebase Auth) ----------
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // onAuthStateChanged detecta si el usuario está logueado o no
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ---------- VALIDACIÓN DE CONFIGURACIÓN DE FIREBASE ----------
  if (!isFirebaseConfigured) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Falta configurar Firebase. Copia .env.example como .env y completa los datos de tu proyecto.
        </Text>
      </View>
    );
  }

  // ---------- PANTALLA DE CARGA INICIAL (Spinner) ----------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1b4d3e" />
      </View>
    );
  }

  // Solo entra a Home quien tiene sesión Y verificó su correo con el enlace
  const isVerified = Boolean(user && user.emailVerified);

  // ---------- NAVEGACIÓN PRINCIPAL CONDICIONAL ----------
  return (
    <View style={[styles.outer, { backgroundColor: isDark ? '#050a07' : '#dfe8e2' }]}>
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <NavigationContainer>
        <Stack.Navigator //ruteo de la pantalla 
          screenOptions={{
            headerStyle: { backgroundColor: '#1b4d3e' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: 'bold' },
            cardStyleInterpolator: fadeSlide,
            transitionSpec: TRANSITION,
            // CORREGIDO: el card del stack necesita altura explícita en web para que el scroll interno funcione
            cardStyle: {
              flex: 1,
              ...(Platform.OS === 'web' ? { height: '100%', overflow: 'visible' } : {}),
            },
          }}
        >
          {isVerified ? (
            // Pantallas disponibles solo con sesión iniciada
            <>
              <Stack.Screen
                name="Home"
                component={Home}
                options={{ title: 'Inicio', headerShown: false }}
              />
              <Stack.Screen
                name="Proveedores"
                component={Proveedores}
                options={{ title: 'Proveedores', headerShown: false }}
              />
              <Stack.Screen
                name="Perfil"
                component={Perfil}
                options={{ title: 'Mi Perfil', headerShown: false }}
              />
            </>
          ) : (
            // Pantallas de acceso (sin sesión)
            <>
              <Stack.Screen name="Login" component={Login} options={{ title: 'Iniciar sesión', headerShown: false }} />
              <Stack.Screen name="SignUp" component={SignUp} options={{ title: 'Registro', headerShown: false }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
    </View>
  );
}

// ---------- ESTILOS Y ADAPTABILIDAD WEB/MÓVIL ----------
const styles = StyleSheet.create({
  // CORREGIDO: se quitó width '100vw' (generaba barra horizontal) y se agregó overflow hidden
  // Fondo que se ve a los costados en pantallas grandes
  outer: {
    flex: 1,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { height: '100vh', width: '100%', overflow: 'hidden' } : {}),
  },
  // Columna con el ancho de un celular
  container: {
    flex: 1,
    width: '100%',
    maxWidth: APP_MAX_WIDTH,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { height: '100vh', width: '100%', overflow: 'hidden' } : {}),
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24, 
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? { height: '100vh' } : {}),
  },
  message: { textAlign: 'center', fontSize: 16, color: '#1b4d3e' },
});