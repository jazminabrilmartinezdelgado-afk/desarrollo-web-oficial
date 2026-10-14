import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';

export default function Login({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userName, setUserName] = useState('');
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);
  
  // Estado para el modal de recuperación de contraseña
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Campos incompletos", "Por favor ingrese tanto el correo como la contraseña.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert("Correo inválido", "Por favor ingrese un correo electrónico válido.");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      const displayName = user.displayName || user.email.split('@')[0];
      setUserName(displayName);
      setWelcomeModalVisible(true);
    } catch (error) {
      console.error('Error de inicio de sesión:', error.code, error.message);
      let errorMessage = "Hubo un problema al iniciar sesión.";
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = "El formato del correo electrónico no es válido.";
          break;
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          errorMessage = "Contraseña incorrecta. Verifique sus datos e intente nuevamente.";
          break;
        case 'auth/user-not-found':
          errorMessage = "No existe una cuenta registrada con este correo electrónico.";
          break;
        case 'auth/network-request-failed':
          errorMessage = "Error de conexión, por favor intente más tarde.";
          break;
        case 'auth/invalid-api-key':
          errorMessage = "La clave API de Firebase no es válida. Revisa el archivo .env.";
          break;
      }
      Alert.alert("Acceso denegado", `${errorMessage}\n\nCódigo: ${error.code ?? 'desconocido'}`);
    }
  };

  // Función para manejar el envío del correo de recuperación
  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert("Campo vacío", "Por favor ingrese su correo electrónico para recuperar la contraseña.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotEmail.trim())) {
      Alert.alert("Correo inválido", "Por favor ingrese un correo electrónico válido.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, forgotEmail.trim());
      setForgotModalVisible(false);
      setForgotEmail('');
      Alert.alert("Correo enviado", "Se envió un mensaje a su Gmail para restablecer la contraseña.");
    } catch (error) {
      console.error('Error al recuperar contraseña:', error.code, error.message);
      let errorMessage = "No se pudo enviar el correo de recuperación.";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "No hay ningún usuario registrado con este correo.";
      }
      Alert.alert("Error", errorMessage);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.safeContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title1}>Agroquímica del Valle</Text>
          <Text style={styles.title}>Iniciar sesión</Text>

          <Text style={styles.label}>Correo</Text>
          <View style={styles.inputContainer}>
            <FontAwesome name="envelope" size={20} color="#1b4d3e" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Ingrese su correo"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
          </View>

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.inputContainer}>
            <FontAwesome name="lock" size={20} color="#1b4d3e" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Ingrese su contraseña"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <FontAwesome name={showPassword ? "eye-slash" : "eye"} size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* ENLACE DE OLVIDÉ MI CONTRASEÑA */}
          <TouchableOpacity 
            style={styles.forgotContainer} 
            onPress={() => setForgotModalVisible(true)}
          >
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Ingresar</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={styles.signUpLinkContainer}>
            <Text style={styles.signUpText}>¿No tienes cuenta aún? Regístrate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL MODERNO DE BIENVENIDA */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={welcomeModalVisible}
        onRequestClose={() => setWelcomeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.checkCircle}>
              <FontAwesome name="user-check" size={38} color="#FFFFFF" />
            </View>
            <Text style={styles.modalTitle}>¡Bienvenido/a!</Text>
            <Text style={styles.modalUserText}>{userName}</Text>
            <Text style={styles.modalSubtitle}>
              Has ingresado correctamente al sistema de gestión de Agroquímica del Valle.
            </Text>
            <TouchableOpacity 
              style={styles.modalButton} 
              onPress={() => setWelcomeModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Continuar al Panel →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE RECUPERACIÓN DE CONTRASEÑA */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={forgotModalVisible}
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.checkCircle}>
              <FontAwesome name="key" size={34} color="#FFFFFF" />
            </View>
            <Text style={styles.modalTitle}>Recuperar Contraseña</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa tu correo electrónico registrado y te enviaremos las instrucciones a tu Gmail.
            </Text>

            <View style={[styles.inputContainer, { width: '100%', marginBottom: 20 }]}>
              <FontAwesome name="envelope" size={20} color="#1b4d3e" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Ingrese su correo"
                placeholderTextColor="#9CA3AF"
                value={forgotEmail}
                onChangeText={setForgotEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity 
              style={[styles.modalButton, { marginBottom: 10 }]} 
              onPress={handleForgotPassword}
            >
              <Text style={styles.modalButtonText}>Enviar correo</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setForgotModalVisible(false)}
              style={{ padding: 5 }}
            >
              <Text style={{ color: '#6B7280', fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    minHeight: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 500,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 75,
    height: 75,
    marginBottom: 8,
  },
  title1: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1b4d3e',
    marginBottom: 4,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b4d3e',
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderColor: '#1b4d3e',
    marginBottom: 14,
    width: '100%',
    paddingBottom: 4,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 42,
    color: '#1F2937',
    fontSize: 15,
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  forgotText: {
    color: '#1b4d3e',
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#1b4d3e',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#1b4d3e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signUpLinkContainer: {
    marginTop: 20,
    padding: 4,
  },
  signUpText: {
    color: '#1b4d3e',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1b4d3e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  modalUserText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1b4d3e',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: '#1b4d3e',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});