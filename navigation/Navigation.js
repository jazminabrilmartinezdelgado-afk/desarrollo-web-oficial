import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Platform, Easing, Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth'; //escuchador 
import { auth, isFirebaseConfigured } from '../src/config/firebaseConfig';
import { useTheme } from '../src/theme/ThemeContext';

// Ancho máximo de la app: en la compu se ve como un celular centrado
// [S5-13] Ancho máximo de un celular: en la compu la app se ve como un teléfono.
export const APP_MAX_WIDTH = 480;
// ---------- ARREGLO DE TEXTOS CORTADOS EN ANDROID ----------
// En algunos celulares (Samsung, Xiaomi…) se cortaba la última palabra
// ("Confirme su", "¿No tiene una"). Con una fuente fija se mide bien.
// Solo en Android: en iPhone y en la compu no cambia nada.
if (Platform.OS === 'android' && !StyleSheet.__textFix) {
  try {
    const TEXT_KEYS = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'color'];
    const originalCreate = StyleSheet.create;
    StyleSheet.create = (styles) => {
      const fixed = {};
      Object.keys(styles || {}).forEach((key) => {
        const st = styles[key];
        const isText =
          st && typeof st === 'object' && !Array.isArray(st) && st.fontFamily == null &&
          TEXT_KEYS.some((k) => st[k] != null);
        fixed[key] = isText ? { fontFamily: 'Roboto', ...st } : st;
      });
      return originalCreate(fixed);
    };
    StyleSheet.__textFix = true;
  } catch (e) {
    // Si no se puede aplicar, la app sigue igual que antes
  }
}

// Importación de pantallas del sistema
// (con require para que se carguen DESPUÉS del arreglo de arriba)
const Login = require('../screens/Login').default;
const SignUp = require('../screens/SignUp').default;
const Home = require('../screens/Home').default;
const Proveedores = require('../screens/Proveedores').default;
const Perfil = require('../screens/Perfil').default;

const Stack = createStackNavigator();

// Login y SignUp ya tienen su propia animación de entrada:
// se cambian sin transición para que no se superpongan las dos animaciones
const AUTH_OPTIONS = {
  headerShown: false,
  cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
};

// ---------- TRANSICIÓN ENTRE PANTALLAS: fundido + leve deslizamiento ----------
const SMOOTH = Easing.bezier(0.22, 1, 0.36, 1);
// [S5-12] Animación al cambiar de pantalla: la nueva aparece suave y sube un poco.
const fadeSlide = ({ current }) => ({
  cardStyle: {
    opacity: current.progress,
    transform: [
      { translateY: current.progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
    ],
  },
});
// ---------- PROVEEDORES: entra deslizándose desde la derecha ----------
// ---------- y al volver sale deslizándose hacia la izquierda ----------
const slideProveedores = ({ current, closing, layouts }) => {
  // Se desliza el ancho de la columna (480 px), no el de toda la ventana:
  // en la compu la ventana es muy ancha y el movimiento se veía brusco
  const w = Math.min(layouts.screen.width, APP_MAX_WIDTH);
  // Al entrar: de la derecha (w) a su lugar (0)
  const enter = current.progress.interpolate({ inputRange: [0, 1], outputRange: [w, 0] });
  // Al salir: de su lugar (0) hacia la izquierda (-w)
  const exit = current.progress.interpolate({ inputRange: [0, 1], outputRange: [-w, 0] });
  return {
    cardStyle: {
      // Un leve fundido acompaña el deslizamiento
      opacity: current.progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
      transform: [
        {
          // closing vale 0 al entrar y 1 al salir
          translateX: Animated.add(
            Animated.multiply(enter, Animated.subtract(1, closing)),
            Animated.multiply(exit, closing)
          ),
        },
      ],
    },
  };
};

// Tiempos del deslizamiento de Proveedores: un poco más largos y con curva suave
const SLIDE_TRANSITION = {
  open: { animation: 'timing', config: { duration: 550, easing: Easing.out(Easing.cubic) } },
  close: { animation: 'timing', config: { duration: 500, easing: Easing.inOut(Easing.cubic) } },
};

const TRANSITION = {
  open: { animation: 'timing', config: { duration: 450, easing: SMOOTH } },
  // Al volver: más largo y con curva pareja, para que no desaparezca de golpe
  close: { animation: 'timing', config: { duration: 450, easing: Easing.inOut(Easing.cubic) } },
};

export default function Navigation() {
  const { colors, isDark } = useTheme();
  // Estados para controlar el usuario actual y la carga inicial
  const [user, setUser] = useState(null); // Cambiamos a null por defecto para evitar bucles de carga infinita en web
  const [loading, setLoading] = useState(true);

  // ---------- EVITAR LA TRADUCCIÓN AUTOMÁTICA DEL NAVEGADOR (solo web) ----------
  // Chrome detectaba mal el idioma y traducía la app: cambiaba textos
  // ("Completa", "Proveedor de registro") y dejaba datos viejos en pantalla
  // ("Hola, Usuario" en lugar del nombre). Se indica que la página está en
  // español y que no debe traducirse.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = 'es';
    document.documentElement.setAttribute('translate', 'no');
    if (!document.querySelector('meta[name="google"]')) {
      const meta = document.createElement('meta');
      meta.name = 'google';
      meta.content = 'notranslate';
      document.head.appendChild(meta);
    }
  }, []);

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
    // [S1-11] Escucha si hay alguien con sesión iniciada para saber qué pantallas mostrar.
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
        <ActivityIndicator size="large" color="#0d3827" />
      </View>
    );
  }

  // Solo entra a Home quien tiene sesión Y verificó su correo con el enlace
  // [S4-15] Solo pasa a Inicio quien verificó su correo con el enlace.
  const isVerified = Boolean(user && user.emailVerified);

  // ---------- NAVEGACIÓN PRINCIPAL CONDICIONAL ----------
  return (
    <View style={[styles.outer, { backgroundColor: isDark ? '#050a07' : '#dfe8e2' }]}>
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <NavigationContainer>
        <Stack.Navigator //ruteo de la pantalla 
          screenOptions={{
            headerStyle: { backgroundColor: '#0d3827' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: 'bold' },
            // En la web, React Navigation 7 trae las animaciones apagadas por defecto:
            // se activan a mano para que también se animen al volver
            animation: 'default',
            // Mantiene visible la pantalla de atrás mientras la de adelante se desvanece
            detachPreviousScreen: false,
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
            // [S1-11] [S4-12] Inicio, Proveedores y Mi Perfil: solo con sesión iniciada.
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
                options={{ title: 'Proveedores', headerShown: false, cardStyleInterpolator: slideProveedores, transitionSpec: SLIDE_TRANSITION }}
              />
              <Stack.Screen
                name="Perfil"
                component={Perfil}
                options={{ title: 'Mi Perfil', headerShown: false }}
              />
            </>
          ) : (
            // [S2-07] [S3-06] Registro e inicio de sesión: las pantallas para entrar.
            // Pantallas de acceso (sin sesión)
            <>
              <Stack.Screen name="Login" component={Login} options={{ title: 'Iniciar sesión', ...AUTH_OPTIONS }} />
              <Stack.Screen name="SignUp" component={SignUp} options={{ title: 'Registro', ...AUTH_OPTIONS }} />
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
  message: { textAlign: 'center', fontSize: 16, color: '#0d3827' },
});
