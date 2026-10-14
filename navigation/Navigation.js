import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../src/config/firebaseConfig';
import Login from '../screens/Login';
import SignUp from '../screens/SignUp';
import Home from '../screens/Home';

const Stack = createStackNavigator();

export default function Navigation() {
  const [user, setUser] = useState(null); // Cambiamos a null por defecto para evitar bucles de carga infinita en web
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (!isFirebaseConfigured) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Falta configurar Firebase. Copia .env.example como .env y completa los datos de tu proyecto.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1b4d3e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#1b4d3e' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          {user ? (
            <Stack.Screen name="Home" component={Home} options={{ title: 'Inicio' }} />
          ) : (
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100vh', width: '100vw' } : {}),
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