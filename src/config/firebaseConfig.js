import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth, 
  getReactNativePersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ========== 1. CONFIGURACIÓN DE CREDENCIALES (Variables de Entorno) ==========
// Cargamos las llaves secretas de Firebase desde el archivo .env de forma segura
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// ========== 2. INICIALIZACIÓN DE LA APLICACIÓN FIREBASE ==========
// getApps() evita crear la app dos veces con el recargado en caliente (Fast Refresh)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;
try {
  // ========== 3. GESTIÓN DE PERSISTENCIA MULTIPLATAFORMA ==========
  // Detecta automáticamente si corre en la Web o en Dispositivos Móviles (Android/iOS)
  const persistence = Platform.OS === 'web' 
    ? browserLocalPersistence 
    : getReactNativePersistence(AsyncStorage);
    
  auth = initializeAuth(app, { persistence });
} catch (error) {
  // ========== 4. PROTECCIÓN CONTRA REINICIALIZACIÓN ==========
  // Evita que la app falle si el sistema intenta inicializar la autenticación dos veces
  if (error.code !== 'auth/already-initialized') throw error;
  auth = getAuth(app);
}

// ========== 5. BASE DE DATOS FIRESTORE (usada por Proveedores) ==========
const db = getFirestore(app);

// ========== 6. VALIDACIÓN Y EXPORTACIÓN DE MÓDULOS ==========
const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

export { auth, db, isFirebaseConfigured };