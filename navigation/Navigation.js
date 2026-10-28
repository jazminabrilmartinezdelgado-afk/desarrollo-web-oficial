import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth'; //escuchador 
import { auth, isFirebaseConfigured } from '../src/config/firebaseConfig';
// Importación de pantallas del sistema
import Login from '../screens/Login';
import SignUp from '../screens/SignUp';
import Home from '../screens/Home';
import Proveedores from '../screens/Proveedores';

const Stack = createStackNavigator();

export default function Navigation() {
  // Estados para controlar el usuario actual y la carga inicial
  const [user, setUser] = useState(null); // Cambiamos a null por defecto para evitar bucles de carga infinita en web
  const [loading, setLoading] = useState(true);

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

  // ---------- NAVEGACIÓN PRINCIPAL CONDICIONAL ----------
  return (
    <View style={styles.container}>
      <NavigationContainer>
        <Stack.Navigator //ruteo de la pantalla 
          screenOptions={{
            headerStyle: { backgroundColor: '#1b4d3e' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: 'bold' },
            // CORREGIDO: el card del stack necesita altura explícita en web para que el scroll interno funcione
            cardStyle: {
              flex: 1,
              ...(Platform.OS === 'web' ? { height: '100%', overflow: 'visible' } : {}),
            },
          }}
        >
          {user ? (
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
  );
}

// ---------- ESTILOS Y ADAPTABILIDAD WEB/MÓVIL ----------
const styles = StyleSheet.create({
  // CORREGIDO: se quitó width '100vw' (generaba barra horizontal) y se agregó overflow hidden
  container: {
    flex: 1,
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