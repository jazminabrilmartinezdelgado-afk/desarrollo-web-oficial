import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Pressable,
  ActivityIndicator,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Ellipse,
} from 'react-native-svg';

// =========================================================================
// CONSTANTES Y PALETA DE COLORES (idénticas al Login)
// =========================================================================
const GREEN_DARK = '#0d3827';
const GREEN_MAIN = '#008A3B';
const SUN_YELLOW = '#F5C518';
const LIME = '#B8DD6B';
const YELLOW = '#F59E0B';

// Foto de fondo (campo al atardecer). Cuando la tengas, guárdala en assets y usa:
// const BG_IMAGE = require('../assets/campo-fondo.jpg');
const BG_IMAGE = null;

const COLUMN_MAX = 460;
const TOP_H = 190;
const FOOT_H = 150;

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 64;
const NAME_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:\s[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com)$/i;
const GENERIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s])\\S{${MIN_PASSWORD},${MAX_PASSWORD}}$`
);

const PASSWORD_RULES = [
  { key: 'len', label: `${MIN_PASSWORD}+ caracteres`, test: (p) => p.length >= MIN_PASSWORD },
  { key: 'upper', label: 'Mayúscula', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Minúscula', test: (p) => /[a-z]/.test(p) },
  { key: 'num', label: 'Número', test: (p) => /\d/.test(p) },
  { key: 'sym', label: 'Carácter especial', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

const getEmailError = (value) => {
  const em = value.trim();
  if (!em) return 'El correo es obligatorio.';
  if (!GENERIC_EMAIL_REGEX.test(em)) {
    return 'El formato del correo no es válido. Ejemplo: nombre@gmail.com';
  }
  if (!EMAIL_REGEX.test(em)) return 'Use un correo @gmail.com o @hotmail.com.';
  return '';
};

const onlyLetters = (text) => text.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '');

const getPasswordStrength = (pass) => {
  const passed = PASSWORD_RULES.filter((r) => r.test(pass)).length;
  if (!pass) return { passed: 0, label: '', color: '#E5E7EB' };
  if (passed === PASSWORD_RULES.length) return { passed, label: 'Fuerte', color: '#10B981' };
  if (passed >= 3) return { passed, label: 'Media', color: YELLOW };
  return { passed, label: 'Débil', color: '#EF4444' };
};

// =========================================================================
// DEGRADADO CON SVG
// =========================================================================
function Gradient({ id, from, to, x2 = '1', y2 = '0' }) {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

// =========================================================================
// FONDO: FOTO O ATARDECER EN EL CAMPO (dibujado con SVG)
// =========================================================================
function Background() {
  if (BG_IMAGE) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={BG_IMAGE} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>
    );
  }

  const rows = [];
  for (let x = -20; x <= 120; x += 10) {
    rows.push(
      <Path key={x} d={`M50,70 L${x},100`} stroke="rgba(255,255,255,0.12)" strokeWidth={0.35} fill="none" />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F8DE8A" />
            <Stop offset="0.25" stopColor="#D2BC4C" />
            <Stop offset="0.55" stopColor="#5C9B3A" />
            <Stop offset="1" stopColor="#14532D" />
          </LinearGradient>
          <RadialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FFF8CC" stopOpacity="1" />
            <Stop offset="1" stopColor="#FFF8CC" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#sky)" />
        <Ellipse cx="64" cy="10" rx="30" ry="9" fill="url(#sun)" />
        <Path d="M0,66 C25,60 55,70 100,62 L100,100 L0,100 Z" fill="#2E7D32" opacity={0.65} />
        <Path d="M0,76 C30,70 60,80 100,72 L100,100 L0,100 Z" fill="#1B5E20" opacity={0.8} />
        {rows}
      </Svg>
    </View>
  );
}

// =========================================================================
// HOJA DECORATIVA CON BALANCEO
// =========================================================================
function Leaf({ size, color, rotate, style, delay = 0 }) {
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 2800,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute' },
        style,
        {
          transform: [
            { rotate: `${rotate}deg` },
            { rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '5deg'] }) },
          ],
        },
      ]}
    >
      <FontAwesome name="leaf" size={size} color={color} />
    </Animated.View>
  );
}

// =========================================================================
// CAMPO CON ETIQUETA, BORDE ANIMADO Y MENSAJE DE ERROR
// =========================================================================
function Field({ label, icon, error, right, onFocus, onBlur, ...rest }) {
  const focus = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);

  const animate = (to) => {
    Animated.timing(focus, { toValue: to, duration: 200, useNativeDriver: false }).start();
    Animated.spring(lift, { toValue: to, friction: 7, tension: 120, useNativeDriver: true }).start();
  };

  const borderColor = error
    ? '#EF4444'
    : focus.interpolate({ inputRange: [0, 1], outputRange: ['#E5E7EB', GREEN_MAIN] });
  const backgroundColor = error
    ? '#FEF2F2'
    : focus.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', '#F9FEFB'] });

  return (
    <Animated.View
      style={{
        width: '100%',
        transform: [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) }],
      }}
    >
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.inputBox, { borderColor, backgroundColor }]}>
        <FontAwesome
          name={icon}
          size={18}
          color={error ? '#EF4444' : focused ? GREEN_MAIN : '#6B7280'}
          style={styles.inputIcon}
        />
        <TextInput
          style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' }]}
          placeholderTextColor="#9CA3AF"
          onFocus={(e) => {
            setFocused(true);
            animate(1);
            onFocus && onFocus(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            animate(0);
            onBlur && onBlur(e);
          }}
          {...rest}
        />
        {right}
      </Animated.View>
      {!!error && (
        <View style={styles.errorRow}>
          <FontAwesome name="exclamation-circle" size={12} color="#EF4444" style={{ marginTop: 2 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </Animated.View>
  );
}

// =========================================================================
// PANTALLA DE REGISTRO
// =========================================================================
export default function SignUp({ navigation }) {
  const { width, height } = useWindowDimensions();
  const compact = height < 700;
  const logoH = compact ? 80 : 100;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [btnW, setBtnW] = useState(360);

  // Cartel de error general
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });
  const showMessage = (title, message) => setErrorModal({ visible: true, title, message });
  const closeMessage = () => setErrorModal((prev) => ({ ...prev, visible: false }));

  // ---------- ANIMACIONES (mismas que el Login) ----------
  const headerAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const linkAnim = useRef(new Animated.Value(0)).current;
  const dividerAnim = useRef(new Animated.Value(0)).current;

  const floatAnim = useRef(new Animated.Value(0)).current;
  const waveDrift = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const strengthAnim = useRef(new Animated.Value(0)).current;

  // Habilita el scroll en web: html, body y root necesitan altura completa
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.setAttribute('data-signup-scroll', 'true');
    style.textContent = 'html, body, #root { height: 100%; margin: 0; }';
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const t = (v, delay = 0, duration = 520) =>
      Animated.timing(v, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    Animated.parallel([
      t(headerAnim, 0, 800),
      t(footerAnim, 150, 800),
      Animated.spring(logoAnim, {
        toValue: 1,
        friction: 5,
        tension: 70,
        delay: 250,
        useNativeDriver: true,
      }),
      t(titleAnim, 380),
      t(formAnim, 480),
      t(linkAnim, 800),
      Animated.timing(dividerAnim, {
        toValue: 1,
        duration: 600,
        delay: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    // Flotación del logo
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    float.start();

    // Las olas se mecen suavemente
    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(waveDrift, {
          toValue: 1,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveDrift, {
          toValue: 0,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    drift.start();

    // Brillo en el botón principal
    const shine = Animated.loop(
      Animated.sequence([
        Animated.delay(2000),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2500),
      ])
    );
    shine.start();

    return () => {
      float.stop();
      drift.stop();
      shine.stop();
    };
  }, []);

  const strength = getPasswordStrength(password);

  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: (strength.passed / PASSWORD_RULES.length) * 100,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [strength.passed]);

  const fadeUp = (v, distance = 24) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  });

  const runShake = () =>
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 9, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();

  const pressIn = () =>
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(buttonScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  // ---------- VALIDACIÓN ----------
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
      e.password = 'La contraseña no cumple con todos los requisitos.';
    }

    if (!confirmPassword) e.confirmPassword = 'Confirme su contraseña.';
    else if (password !== confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden.';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const clearError = (field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // ---------- REGISTRO ----------
  const handleSignUp = async () => {
    if (loading) return;
    if (!validate()) {
      runShake();
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    } catch (error) {
      console.error('Error de registro:', error.code, error.message);
      const defaultMessage = 'Hubo un problema al registrar el usuario.';
      let errorMessage = defaultMessage;
      let inlineOnly = false;
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
        const detail =
          errorMessage === defaultMessage ? `\n\nCódigo: ${error.code ?? 'desconocido'}` : '';
        showMessage('No se pudo registrar', `${errorMessage}${detail}`);
      } else {
        runShake();
      }
      setLoading(false);
      return;
    }

    try {
      await updateProfile(credential.user, {
        displayName: `${firstName.trim()} ${lastName.trim()}`,
      });
    } catch (error) {
      console.error('No se pudo guardar el nombre:', error);
    }
  };

  // Ancho de la columna (en pantallas grandes se centra como un teléfono)
  const W = Math.min(width || 400, COLUMN_MAX);
  const PAD = 24; // margen extra para que las olas se muevan sin mostrar bordes
  const sw = W + PAD * 2;

  // Banda entre dos desplazamientos de la curva superior
  const topBand = (a, b) =>
    `M0,${70 + a} C${sw * 0.35},${25 + a} ${sw * 0.65},${85 + a} ${sw},${135 + a} ` +
    `L${sw},${135 + b} C${sw * 0.65},${85 + b} ${sw * 0.35},${25 + b} 0,${70 + b} Z`;

  // Banda entre dos desplazamientos de la curva inferior
  const footBand = (a, b) =>
    `M0,${55 + a} C${sw * 0.35},${105 + a} ${sw * 0.7},${25 + a} ${sw},${70 + a} ` +
    `L${sw},${70 + b} C${sw * 0.7},${25 + b} ${sw * 0.35},${105 + b} 0,${55 + b} Z`;

  const driftX = waveDrift.interpolate({ inputRange: [0, 1], outputRange: [-PAD * 0.7, PAD * 0.7] });
  const driftXInv = waveDrift.interpolate({ inputRange: [0, 1], outputRange: [PAD * 0.7, -PAD * 0.7] });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* FONDO: foto o atardecer en el campo */}
      <Background />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.column}>
          {/* ================= PARTE SUPERIOR: HOJAS Y OLAS ================= */}
          <View style={styles.topArea}>
            <Leaf size={96} color="#0d3827" rotate={-35} style={{ left: -14, top: -18 }} />
            <Leaf size={64} color="#168A48" rotate={-70} style={{ left: 38, top: -22 }} delay={400} />
            <Leaf size={84} color="#0f6b34" rotate={50} style={{ right: -8, top: 6 }} delay={700} />
            <Leaf size={52} color="#2E9E4F" rotate={80} style={{ right: 62, top: -14 }} delay={200} />

            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: headerAnim,
                  transform: [{ translateX: driftX }],
                  left: -PAD,
                  width: sw,
                },
              ]}
              pointerEvents="none"
            >
              <Svg width={sw} height={TOP_H} viewBox={`0 0 ${sw} ${TOP_H}`}>
                {/* Franja verde oscura */}
                <Path d={topBand(-62, -40)} fill={GREEN_DARK} opacity={0.92} />
                {/* Franja verde principal */}
                <Path d={topBand(-40, -7)} fill={GREEN_MAIN} />
                {/* Filo verde lima */}
                <Path d={topBand(-7, 0)} fill={LIME} />
                {/* Zona blanca */}
                <Path
                  d={`M0,${TOP_H} L0,70 C${sw * 0.35},25 ${sw * 0.65},85 ${sw},135 L${sw},${TOP_H} Z`}
                  fill="#FFFFFF"
                />
                {/* Media luna amarilla */}
                <Path
                  d={`M0,100 C${sw * 0.1},78 ${sw * 0.22},62 ${sw * 0.36},56 C${sw * 0.2},84 ${sw * 0.08},124 0,178 Z`}
                  fill={SUN_YELLOW}
                />
              </Svg>
            </Animated.View>
          </View>

          {/* ================= CUERPO BLANCO ================= */}
          <View style={styles.body}>
            <View style={styles.content}>
              {/* LOGO */}
              <Animated.View
                style={{
                  alignItems: 'center',
                  opacity: logoAnim,
                  transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
                }}
              >
                <Animated.View
                  style={{
                    transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
                  }}
                >
                  <Image
                    source={require('../assets/logo.png')}
                    style={{ width: logoH * 1.1, height: logoH }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </Animated.View>

              <Animated.View style={[{ alignItems: 'center' }, fadeUp(titleAnim)]}>
                <Text style={[styles.mainTitle, compact && { fontSize: 26 }]}>Crear cuenta</Text>
                <Text style={styles.subtitle}>Registrate en Agroquímica del Valle</Text>
                <Animated.View
                  style={[
                    styles.dividerContainer,
                    { width: dividerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }) },
                  ]}
                >
                  <View style={styles.dividerGreen} />
                  <View style={styles.dividerYellow} />
                </Animated.View>
              </Animated.View>

              <Animated.View
                style={[{ width: '100%' }, fadeUp(formAnim), { transform: [{ translateX: shakeAnim }] }]}
              >
                <Field
                  label="Nombre"
                  icon="user-o"
                  placeholder="Ingrese su nombre"
                  value={firstName}
                  onChangeText={(t) => {
                    setFirstName(onlyLetters(t));
                    clearError('firstName');
                  }}
                  error={errors.firstName}
                  maxLength={50}
                  autoCapitalize="words"
                  autoComplete="given-name"
                  textContentType="givenName"
                />

                <Field
                  label="Apellido"
                  icon="user-o"
                  placeholder="Ingrese su apellido"
                  value={lastName}
                  onChangeText={(t) => {
                    setLastName(onlyLetters(t));
                    clearError('lastName');
                  }}
                  error={errors.lastName}
                  maxLength={50}
                  autoCapitalize="words"
                  autoComplete="family-name"
                  textContentType="familyName"
                />

                <Field
                  label="Correo electrónico"
                  icon="envelope-o"
                  placeholder="ejemplo@gmail.com o @hotmail.com"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t.replace(/\s/g, ''));
                    clearError('email');
                  }}
                  onBlur={() => {
                    if (email.trim()) {
                      const msg = getEmailError(email);
                      setErrors((prev) => ({ ...prev, email: msg || undefined }));
                    }
                  }}
                  error={errors.email}
                  maxLength={100}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                />

                <Field
                  label="Contraseña"
                  icon="lock"
                  placeholder="Cree una contraseña segura"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t.replace(/\s/g, ''));
                    clearError('password');
                  }}
                  error={errors.password}
                  maxLength={MAX_PASSWORD}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  right={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <FontAwesome name={showPassword ? 'eye' : 'eye-slash'} size={18} color="#6B7280" />
                    </TouchableOpacity>
                  }
                />

                {/* MEDIDOR Y REQUISITOS DE CONTRASEÑA */}
                {password.length > 0 && (
                  <View style={styles.strengthBox}>
                    <View style={styles.strengthHeader}>
                      <Text style={styles.strengthText}>Seguridad de la contraseña</Text>
                      <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                    </View>
                    <View style={styles.strengthBarBg}>
                      <Animated.View
                        style={[
                          styles.strengthBarFill,
                          {
                            backgroundColor: strength.color,
                            width: strengthAnim.interpolate({
                              inputRange: [0, 100],
                              outputRange: ['0%', '100%'],
                            }),
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.rulesWrap}>
                      {PASSWORD_RULES.map((r) => {
                        const ok = r.test(password);
                        return (
                          <View key={r.key} style={[styles.rulePill, ok && styles.rulePillOk]}>
                            <FontAwesome
                              name={ok ? 'check-circle' : 'circle-o'}
                              size={12}
                              color={ok ? GREEN_MAIN : '#9CA3AF'}
                            />
                            <Text style={[styles.ruleText, ok && { color: '#166534' }]}>{r.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                <Field
                  label="Confirmar contraseña"
                  icon="lock"
                  placeholder="Repita su contraseña"
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t.replace(/\s/g, ''));
                    clearError('confirmPassword');
                  }}
                  error={
                    errors.confirmPassword ||
                    (confirmPassword.length > 0 && password !== confirmPassword
                      ? 'Las contraseñas no coinciden.'
                      : undefined)
                  }
                  maxLength={MAX_PASSWORD}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  onSubmitEditing={handleSignUp}
                  right={
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <FontAwesome name={showConfirmPassword ? 'eye' : 'eye-slash'} size={18} color="#6B7280" />
                    </TouchableOpacity>
                  }
                />

                {/* BOTÓN CON DEGRADADO, BRILLO Y ANIMACIÓN */}
                <Animated.View style={{ width: '100%', marginTop: 20, transform: [{ scale: buttonScale }] }}>
                  <Pressable
                    style={[styles.primaryButton, loading && { opacity: 0.85 }]}
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                    onPress={handleSignUp}
                    onLayout={(e) => setBtnW(e.nativeEvent.layout.width)}
                    disabled={loading}
                  >
                    <Gradient id="btnGrad" from="#0B8A3E" to="#00B04F" />
                    {!loading && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.shine,
                          {
                            transform: [
                              {
                                translateX: shimmer.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-90, btnW + 90],
                                }),
                              },
                              { rotate: '20deg' },
                            ],
                          },
                        ]}
                      />
                    )}
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={styles.buttonRow}>
                        <Text style={styles.primaryButtonText}>Registrarse</Text>
                        <FontAwesome name="arrow-right" size={15} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              </Animated.View>

              <Animated.View style={fadeUp(linkAnim, 14)}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  style={styles.loginRow}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loginTextPlain}>¿Ya tenés cuenta? </Text>
                  <Text style={styles.loginLinkBold}>Iniciá sesión.</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {/* ================= PARTE INFERIOR: OLAS Y HOJAS ================= */}
          <View style={styles.footArea}>
            <Leaf size={90} color="#0d3827" rotate={25} style={{ left: -10, bottom: -22 }} delay={300} />
            <Leaf size={58} color="#168A48" rotate={55} style={{ left: 56, bottom: -16 }} delay={900} />
            <Leaf size={70} color="#2E9E4F" rotate={-40} style={{ right: -6, bottom: -18 }} delay={600} />

            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: footerAnim,
                  transform: [{ translateX: driftXInv }],
                  left: -PAD,
                  width: sw,
                },
              ]}
              pointerEvents="none"
            >
              <Svg width={sw} height={FOOT_H} viewBox={`0 0 ${sw} ${FOOT_H}`}>
                {/* Zona blanca superior */}
                <Path
                  d={`M0,0 L${sw},0 L${sw},70 C${sw * 0.7},25 ${sw * 0.35},105 0,55 Z`}
                  fill="#FFFFFF"
                />
                {/* Filo lima */}
                <Path d={footBand(0, 9)} fill={LIME} />
                {/* Franja amarilla */}
                <Path d={footBand(9, 34)} fill={SUN_YELLOW} />
                {/* Franja verde */}
                <Path d={footBand(34, 52)} fill={GREEN_MAIN} />
                {/* Verde oscuro más profundo */}
                <Path d={footBand(52, 70)} fill={GREEN_DARK} opacity={0.85} />
              </Svg>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      {/* CARTEL DE ERROR */}
      <Modal
        animationType="fade"
        transparent
        visible={errorModal.visible}
        onRequestClose={closeMessage}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.errorCircle}>
              <FontAwesome name="exclamation" size={34} color="#FFFFFF" />
            </View>
            <Text style={styles.modalTitle}>{errorModal.title}</Text>
            <Text style={styles.modalSubtitle}>{errorModal.message}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={closeMessage} activeOpacity={0.85}>
              <Text style={styles.modalButtonText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// =========================================================================
// ESTILOS
// =========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GREEN_DARK,
    ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}),
  },
  scroll: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100%', minHeight: 0 } : {}),
  },
  scrollContainer: {
    flexGrow: 1,
  },
  column: {
    flexGrow: 1,
    width: '100%',
    maxWidth: COLUMN_MAX,
    alignSelf: 'center',
  },
  topArea: {
    height: TOP_H,
    width: '100%',
    overflow: 'hidden',
  },
  footArea: {
    height: FOOT_H,
    width: '100%',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 8,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 12,
  },
  dividerGreen: { flex: 1, backgroundColor: GREEN_MAIN },
  dividerYellow: { flex: 1, backgroundColor: SUN_YELLOW },
  label: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    marginTop: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    width: '100%',
  },
  inputIcon: {
    width: 26,
    marginRight: 6,
  },
  input: {
    flex: 1,
    color: '#1F2937',
    fontSize: 14,
    height: '100%',
  },
  errorRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 5,
    paddingHorizontal: 2,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 12,
    lineHeight: 16,
  },

  // Fortaleza de contraseña
  strengthBox: {
    width: '100%',
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  strengthText: { fontSize: 12, color: '#6B7280', flex: 1 },
  strengthLabel: { fontSize: 12, fontWeight: 'bold', marginLeft: 8 },
  strengthBarBg: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthBarFill: { height: '100%', borderRadius: 3 },
  rulesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  rulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  rulePillOk: { backgroundColor: '#DCFCE7' },
  ruleText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },

  primaryButton: {
    height: 52,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: GREEN_MAIN,
    shadowColor: GREEN_MAIN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 46,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  loginRow: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 4,
    justifyContent: 'center',
  },
  loginTextPlain: { color: '#6B7280', fontSize: 14 },
  loginLinkBold: {
    color: GREEN_MAIN,
    fontWeight: 'bold',
    fontSize: 14,
    textDecorationLine: 'underline',
  },

  // Modal
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
    padding: 26,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    elevation: 10,
  },
  errorCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: GREEN_DARK,
    height: 50,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});