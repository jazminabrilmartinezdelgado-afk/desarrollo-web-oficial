import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { auth } from '../src/config/firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';

// ---------- Constantes de validación (cámbialas aquí y se aplican en todo el archivo) ----------
const MIN_PASSWORD = 8;   // puedes poner 6 si lo prefieres
const MAX_PASSWORD = 64;
const NAME_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:\s[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/; // solo letras, espacios simples entre palabras
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com)$/i;
const GENERIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // formato general de correo

// Devuelve el mensaje de error del correo, o '' si es válido
const getEmailError = (value) => {
  const em = value.trim();
  if (!em) return 'El correo es obligatorio.';
  if (!GENERIC_EMAIL_REGEX.test(em)) {
    return 'El formato del correo no es válido. Ejemplo: nombre@gmail.com';
  }
  if (!EMAIL_REGEX.test(em)) return 'Use un correo @gmail.com o @hotmail.com.';
  return '';
};

// Regex de la contraseña. Cada (?=...) es una condición que debe cumplirse:
//   ^                    -> inicio del texto
//   (?=.*[a-z])          -> al menos una letra minúscula
//   (?=.*[A-Z])          -> al menos una letra mayúscula
//   (?=.*\d)             -> al menos un número
//   (?=.*[^A-Za-z0-9\s]) -> al menos un carácter especial (@, #, $, !, _, etc.)
//   \S{MIN,MAX}          -> entre MIN y MAX caracteres, sin espacios
//   $                    -> fin del texto
const PASSWORD_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s])\\S{${MIN_PASSWORD},${MAX_PASSWORD}}$`
);

// Quita todo lo que no sea letra o espacio mientras el usuario escribe
const onlyLetters = (text) => text.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '');

export default function SignUp({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Cartel de error personalizado (reemplaza al alert del navegador, funciona igual en web y móvil)
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });
  const showMessage = (title, message) => setErrorModal({ visible: true, title, message });
  const closeMessage = () => setErrorModal((prev) => ({ ...prev, visible: false }));

  // Evalúa la fortaleza de la contraseña
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '#E5E7EB', width: '0%' };

    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= MIN_PASSWORD) score += 1;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    // Si no cumple los requisitos mínimos, nunca pasa de "Débil"
    if (!PASSWORD_REGEX.test(pass) && score > 2) score = 2;

    if (score <= 2) {
      return { score, label: 'Débil', color: '#EF4444', width: '33%' };
    } else if (score <= 4) {
      return { score, label: 'Media', color: '#F59E0B', width: '66%' };
    }
    return { score, label: 'Fuerte', color: '#10B981', width: '100%' };
  };

  const passwordStrength = getPasswordStrength(password);

  // Valida todos los campos y guarda los mensajes de error por campo
  const validate = () => {
    const e = {};
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();

    if (!fn) e.firstName = 'El nombre es obligatorio.';
    else if (fn.length < 2) e.firstName = 'El nombre debe tener al menos 2 letras.';
    else if (!NAME_REGEX.test(fn)) e.firstName = 'El nombre solo puede contener letras y espacios.';

    if (!ln) e.lastName = 'El apellido es obligatorio.';
    else if (ln.length < 2) e.lastName = 'El apellido debe tener al menos 2 letras.';
    else if (!NAME_REGEX.test(ln)) e.lastName = 'El apellido solo puede contener letras y espacios.';

    const emailError = getEmailError(em);
    if (emailError) e.email = emailError;

    if (!password) e.password = 'La contraseña es obligatoria.';
    else if (!PASSWORD_REGEX.test(password)) {
      e.password = `Mínimo ${MIN_PASSWORD} caracteres, con mayúscula, minúscula, número y un carácter especial (@, #, $, !...). Sin espacios.`;
    }

    if (!confirmPassword) e.confirmPassword = 'Confirme su contraseña.';
    else if (password !== confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden.';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Borra el error de un campo cuando el usuario vuelve a escribir en él
  const clearError = (field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSignUp = async () => {
    if (loading) return; // evita doble envío
    if (!validate()) return;

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    } catch (error) {
      console.error('Error de registro:', error.code, error.message);
      const defaultMessage = 'Hubo un problema al registrar el usuario.';
      let errorMessage = defaultMessage;
      let inlineOnly = false; // true = el error se muestra bajo el campo, sin cartel
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Este correo ya está registrado. Inicie sesión o use otro correo.';
          setErrors((prev) => ({ ...prev, email: errorMessage }));
          inlineOnly = true;
          break;
        case 'auth/invalid-email':
          errorMessage = 'El formato del correo electrónico no es válido.';
          break;
        case 'auth/weak-password':
          errorMessage = 'La contraseña es demasiado débil.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Error de conexión, por favor intenta más tarde.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'El registro con correo no está habilitado en Firebase.';
          break;
        case 'auth/invalid-api-key':
          errorMessage = 'La clave API de Firebase no es válida. Revisa el archivo .env.';
          break;
      }
      if (!inlineOnly) {
        const detail = errorMessage === defaultMessage ? `\n\nCódigo: ${error.code ?? 'desconocido'}` : '';
        showMessage('No se pudo registrar', `${errorMessage}${detail}`);
      }
      setLoading(false);
      return;
    }

    try {
      await updateProfile(credential.user, {
        displayName: `${firstName.trim()} ${lastName.trim()}`,
      });
    } catch (error) {
      // La cuenta ya existe; solo registramos el fallo para no mostrar dos carteles a la vez
      console.error('No se pudo guardar el nombre:', error);
    }

    // Firebase inicia sesión solo al registrar; cerramos sesión para que el usuario entre desde Login.
    // Si tu app usa onAuthStateChanged para navegar, quita esta línea.
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }

    setLoading(false);
    setSuccessModalVisible(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.safeContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title1}>Agroquímica del Valle</Text>
          <Text style={styles.title}>Regístrate</Text>

          {/* NOMBRE */}
          <Text style={styles.label}>Nombre</Text>
          <View style={[styles.inputContainer, errors.firstName && styles.inputError]}>
            <FontAwesome name="user" size={20} color="#1b4d3e" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Ingrese su nombre (solo letras)"
              placeholderTextColor="#9CA3AF"
              value={firstName}
              onChangeText={(t) => {
                setFirstName(onlyLetters(t));
                clearError('firstName');
              }}
              maxLength={50}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
            />
          </View>
          {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}

          {/* APELLIDO */}
          <Text style={styles.label}>Apellido</Text>
          <View style={[styles.inputContainer, errors.lastName && styles.inputError]}>
            <FontAwesome name="user" size={20} color="#1b4d3e" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Ingrese su apellido (solo letras)"
              placeholderTextColor="#9CA3AF"
              value={lastName}
              onChangeText={(t) => {
                setLastName(onlyLetters(t));
                clearError('lastName');
              }}
              maxLength={50}
              autoCapitalize="words"
              autoComplete="family-name"
              textContentType="familyName"
            />
          </View>
          {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}

          {/* CORREO */}
          <Text style={styles.label}>Correo (@gmail.com / @hotmail.com)</Text>
          <View style={[styles.inputContainer, errors.email && styles.inputError]}>
            <FontAwesome name="envelope" size={20} color="#1b4d3e" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="ejemplo@gmail.com o @hotmail.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={(t) => {
                setEmail(t.replace(/\s/g, ''));
                clearError('email');
              }}
              onBlur={() => {
                // Solo valida si el usuario escribió algo; el "obligatorio" se avisa al enviar
                if (email.trim()) {
                  const msg = getEmailError(email);
                  setErrors((prev) => ({ ...prev, email: msg || undefined }));
                }
              }}
              maxLength={100}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          {/* CONTRASEÑA */}
          <Text style={styles.label}>Contraseña</Text>
          <View style={[styles.inputContainer, errors.password && styles.inputError]}>
            <FontAwesome name="lock" size={20} color="#1b4d3e" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Ingrese su contraseña"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={(t) => {
                setPassword(t.replace(/\s/g, ''));
                clearError('password');
              }}
              maxLength={MAX_PASSWORD}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <FontAwesome name={showPassword ? 'eye-slash' : 'eye'} size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          {/* Texto de ayuda: se oculta cuando hay un error (el error ya explica los requisitos) */}
          {!errors.password && (
            <Text style={styles.hintText}>
              Mínimo {MIN_PASSWORD} caracteres, con mayúscula, minúscula, número y un carácter especial (@, #, $, !...).
            </Text>
          )}

          {/* MEDIDOR DE FORTALEZA */}
          {password.length > 0 && (
            <View style={styles.strengthMeterContainer}>
              <View style={styles.strengthHeader}>
                <Text style={styles.strengthText}>Fortaleza de la contraseña:</Text>
                <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                  {passwordStrength.label}
                </Text>
              </View>
              <View style={styles.strengthBarBackground}>
                <View
                  style={[
                    styles.strengthBarFill,
                    { width: passwordStrength.width, backgroundColor: passwordStrength.color },
                  ]}
                />
              </View>
            </View>
          )}

          {/* CONFIRMAR CONTRASEÑA */}
          <Text style={styles.label}>Confirmar Contraseña</Text>
          <View style={[styles.inputContainer, errors.confirmPassword && styles.inputError]}>
            <FontAwesome name="lock" size={20} color="#1b4d3e" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Confirme su contraseña"
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t.replace(/\s/g, ''));
                clearError('confirmPassword');
              }}
              maxLength={MAX_PASSWORD}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <FontAwesome name={showConfirmPassword ? 'eye-slash' : 'eye'} size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          {/* Aviso en tiempo real si no coinciden (y aún no hay otro error mostrado) */}
          {!errors.confirmPassword && confirmPassword.length > 0 && password !== confirmPassword && (
            <Text style={styles.errorText}>Las contraseñas no coinciden.</Text>
          )}

          {/* BOTÓN */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Registrando...' : 'Registrarse'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLinkContainer}>
            <Text style={styles.signUpText}>¿Ya tienes cuenta? Inicia sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CARTEL DE ERROR */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={errorModal.visible}
        onRequestClose={closeMessage}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.errorCircle}>
              <FontAwesome name="exclamation" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.modalTitle}>{errorModal.title}</Text>
            <Text style={styles.modalSubtitle}>{errorModal.message}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={closeMessage}>
              <Text style={styles.modalButtonText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE REGISTRO EXITOSO */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={successModalVisible}
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.checkCircle}>
              <FontAwesome name="check" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.modalTitle}>Registro exitoso</Text>
            <Text style={styles.modalSubtitle}>
              Tu cuenta se ha creado correctamente.{'\n'}Puedes iniciar sesión ahora.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setSuccessModalVisible(false);
                navigation.navigate('Login');
              }}
            >
              <Text style={styles.modalButtonText}>Ir a Iniciar sesión →</Text>
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
  inputError: {
    borderColor: '#EF4444',
    marginBottom: 4,
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
  errorText: {
    alignSelf: 'flex-start',
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 10,
  },
  hintText: {
    alignSelf: 'flex-start',
    color: '#6B7280',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 10,
  },
  // Medidor de seguridad
  strengthMeterContainer: {
    width: '100%',
    marginBottom: 12,
    marginTop: -4,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  strengthText: {
    fontSize: 12,
    color: '#6B7280',
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  strengthBarBackground: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  button: {
    backgroundColor: '#1b4d3e',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 18,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#1b4d3e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginLinkContainer: {
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
    marginBottom: 20,
  },
  errorCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 25,
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