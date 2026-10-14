import { initializeApp } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth, 
  getReactNativePersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

let auth;
try {
  const persistence = Platform.OS === 'web' 
    ? browserLocalPersistence 
    : getReactNativePersistence(AsyncStorage);
    
  auth = initializeAuth(app, { persistence });
} catch (error) {
  if (error.code !== 'auth/already-initialized') throw error;
  auth = getAuth(app);
}

const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

export { auth, isFirebaseConfigured };