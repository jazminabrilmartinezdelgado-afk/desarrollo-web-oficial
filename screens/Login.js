import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Image, 
  ImageBackground,
  Modal, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Animated,
  Pressable
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';

export default function Login({ navigation }) {
  // =========================================================================
  // 1. ESTADOS PRINCIPALES DEL FORMULARIO
  // =========================================================================
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userName, setUserName] = useState('');
  
  // Estados para modales y alertas estéticas
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // =========================================================================
  // 2. CONFIGURACIÓN DE ANIMACIONES (React Native Animated)
  // =========================================================================
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const errorFadeAnim = useRef(new Animated.Value(0)).current;
  const modalScaleAnim = useRef(new Animated.Value(0.8)).current;
  const modalFadeAnim = useRef(new Animated.Value(0)).current;

  // Animación de entrada de la tarjeta al cargar la pantalla
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const onPressInButton = () => {
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const onPressOutButton = () => {
    Animated.spring(buttonScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  const triggerErrorAnimation = () => {
    errorFadeAnim.setValue(0);
    Animated.timing(errorFadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  };

  const triggerWelcomeModalAnimation = () => {
    modalScaleAnim.setValue(0.8);
    modalFadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(modalScaleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      Animated.timing(modalFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true })
    ]).start();
  };

  // =========================================================================
  // 3. LÓGICA DE AUTENTICACIÓN CON FIREBASE
  // =========================================================================
  const handleLogin = async () => {
    setErrorMessage('');

    // Validación de campos vacíos
    if (!email.trim() || !password) {
      setErrorMessage("Por favor ingrese tanto el correo como la contraseña.");
      triggerErrorAnimation();
      return;
    }

    // Validación de formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage("Por favor ingrese un correo electrónico válido.");
      triggerErrorAnimation();
      return;
    }

    try {
      // Conexión directa con Firebase Auth para iniciar sesión
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      const displayName = user.displayName || user.email.split('@')[0];
      setUserName(displayName);
      
      // Activación del modal de bienvenida animado
      setWelcomeModalVisible(true);
      triggerWelcomeModalAnimation();
    } catch (error) {
      console.error('Error de inicio de sesión:', error.code, error.message);
      setErrorMessage("Acceso inválido. Por favor, inténtelo otra vez.");
      triggerErrorAnimation();
    }
  };

  // Lógica de recuperación de contraseña
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
      let msg = "No se pudo enviar el correo de recuperación.";
      if (error.code === 'auth/user-not-found') {
        msg = "No hay ningún usuario registrado con este correo.";
      }
      Alert.alert("Error", msg);
    }
  };

  // =========================================================================
  // 4. RENDERIZADO DE LA INTERFAZ VISUAL
  // =========================================================================
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.safeContainer}
    >
      {/* Fondo institucional con filtro y opacidad verde corporativa */}
      <ImageBackground                          
        source={require('../assets/fondo.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            
            {/* Tarjeta flotante principal con animación */}
            <Animated.View 
              style={[
                styles.card, 
                { 
                  opacity: cardOpacity, 
                  transform: [{ scale: cardScale }] 
                }
              ]}
            >
              <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.title1}>Agroquímica del Valle</Text>
              <Text style={styles.title}>Iniciar sesión</Text>

              {/* Banner de error estético animado */}
              {errorMessage !== '' && (
                <Animated.View style={[styles.errorBanner, { opacity: errorFadeAnim }]}>
                  <FontAwesome name="exclamation-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </Animated.View>
              )}

              {/* Campo de Correo Electrónico */}
              <Text style={styles.label}>Correo</Text>
              <View style={styles.inputContainer}>
                <FontAwesome name="envelope" size={20} color="#1b4d3e" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ingrese su correo"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>

              {/* Campo de Contraseña con botón para mostrar/ocultar */}
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.inputContainer}>
                <FontAwesome name="lock" size={20} color="#1b4d3e" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ingrese su contraseña"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <FontAwesome name={showPassword ? "eye-slash" : "eye"} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              {/* Enlace de recuperación de contraseña */}
              <TouchableOpacity 
                style={styles.forgotContainer} 
                onPress={() => setForgotModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              {/* Botón principal de Acceso con animación táctil */}
              <Animated.View style={{ width: '100%', transform: [{ scale: buttonScale }] }}>
                <Pressable
                  style={({ hovered, pressed }) => [
                    styles.button,
                    hovered && styles.buttonHover,
                    pressed && styles.buttonPressed
                  ]}
                  onPressIn={onPressInButton}
                  onPressOut={onPressOutButton}
                  onPress={handleLogin}
                >
                  <Text style={styles.buttonText}>Ingresar</Text>
                </Pressable>
              </Animated.View>

              {/* Enlace de redirección a la pantalla de Registro */}
              <TouchableOpacity 
                onPress={() => navigation.navigate('SignUp')} 
                style={styles.signUpLinkContainer}
                activeOpacity={0.7}
              >
                <Text style={styles.signUpText}>¿No tienes cuenta aún? Regístrate</Text>
              </TouchableOpacity>
            </Animated.View>

          </ScrollView>
        </View>
      </ImageBackground>

      {/* Modal de Bienvenida Post-Autenticación */}
      <Modal
        animationType="none"
        transparent={true}
        visible={welcomeModalVisible}
        onRequestClose={() => setWelcomeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContent, 
              { 
                opacity: modalFadeAnim,
                transform: [{ scale: modalScaleAnim }] 
              }
            ]}
          >
            <View style={styles.checkCircle}>
              <FontAwesome name="user-check" size={38} color="#FFFFFF" />
            </View>
            <Text style={styles.modalTitle}>¡Bienvenido/a!</Text>
            <Text style={styles.modalUserText}>{userName}</Text>

            <View style={styles.divider} />

            <Text style={styles.modalSubtitle}>
              Has ingresado con éxito al sistema corporativo de Agroquímica del Valle.
            </Text>

            <Pressable 
              style={({ hovered }) => [
                styles.modalButton,
                hovered && styles.buttonHover
              ]} 
              onPress={() => {
                setWelcomeModalVisible(false);
                navigation.navigate('Home'); // Enlace final con Home.js
              }}
            >
              <Text style={styles.modalButtonText}>Continuar al Panel →</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal de Recuperación de Contraseña */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={forgotModalVisible}
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.keyCircle}>
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

// =========================================================================
// 5. ESTILOS CORPORATIVOS
// =========================================================================
const styles = StyleSheet.create({ 
  safeContainer: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 77, 62, 0.65)',
    justifyContent: 'center',
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
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    transitionProperty: 'transform, box-shadow',
    transitionDuration: '300ms',
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
    marginBottom: 16,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    width: '100%',
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
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
  buttonHover: {
    backgroundColor: '#143c30',
  },
  buttonPressed: {
    backgroundColor: '#0d2820',
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  checkCircle: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: '#1b4d3e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  keyCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
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
    textAlign: 'center',
    marginBottom: 12,
  },
  divider: {
    height: 2,
    backgroundColor: '#E5E7EB',
    width: '60%',
    marginVertical: 10,
    borderRadius: 1,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: '#1b4d3e',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#1b4d3e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});