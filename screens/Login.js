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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
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
// CONSTANTES Y PALETA DE COLORES
// =========================================================================
const GREEN_DARK = '#0d3827';
const GREEN_MID = '#168A48';
const GREEN_MAIN = '#008A3B';
const GOLD_YELLOW = '#CAB118';
const SUN_YELLOW = '#F5C518';
const LIME = '#B8DD6B';
const REMEMBER_KEY = '@av_remember_email';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Foto de fondo (campo al atardecer). Cuando la tengas, guárdala en assets y usa:
// const BG_IMAGE = require('../assets/campo-fondo.jpg');
const BG_IMAGE = null;

const COLUMN_MAX = 460;
const TOP_H = 190;
const FOOT_H = 150;

const mapAuthError = (code) => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Inténtelo más tarde.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Revise su internet.';
    case 'auth/user-disabled':
      return 'Esta cuenta fue deshabilitada.';
    default:
      return 'Acceso inválido. Por favor, inténtelo otra vez.';
  }
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
// CAMPO DE TEXTO INTERACTIVO
// =========================================================================
function Input({ icon, right, ...props }) {
  const focus = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);

  const animate = (to) => {
    Animated.timing(focus, { toValue: to, duration: 200, useNativeDriver: false }).start();
    Animated.spring(lift, { toValue: to, friction: 7, tension: 120, useNativeDriver: true }).start();
  };

  return (
    <Animated.View
      style={{
        width: '100%',
        transform: [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) }],
      }}
    >
      <Animated.View
        style={[
          styles.inputBox,
          {
            borderColor: focus.interpolate({
              inputRange: [0, 1],
              outputRange: ['#E5E7EB', GREEN_MAIN],
            }),
            backgroundColor: focus.interpolate({
              inputRange: [0, 1],
              outputRange: ['#FFFFFF', '#F9FEFB'],
            }),
          },
        ]}
      >
        <FontAwesome
          name={icon}
          size={18}
          color={focused ? GREEN_MAIN : '#6B7280'}
          style={styles.inputIcon}
        />
        <TextInput
          style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' }]}
          placeholderTextColor="#9CA3AF"
          onFocus={() => {
            setFocused(true);
            animate(1);
          }}
          onBlur={() => {
            setFocused(false);
            animate(0);
          }}
          {...props}
        />
        {right}
      </Animated.View>
    </Animated.View>
  );
}

// =========================================================================
// CASILLA "RECORDAR"
// =========================================================================
function CheckBox({ checked }) {
  const s = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(s, {
      toValue: checked ? 1 : 0,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }, [checked]);

  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      <Animated.View style={{ opacity: s, transform: [{ scale: s }] }}>
        <FontAwesome name="check" size={12} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

// =========================================================================
// MODAL: RECUPERAR CONTRASEÑA
// =========================================================================
function ForgotModal({ initialEmail, onClose }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [forgotEmail, setForgotEmail] = useState(initialEmail);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }).start();
  }, []);

  const close = () =>
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      onClose()
    );

  const send = async () => {
    if (!forgotEmail.trim()) {
      setMsg({ type: 'error', text: 'Ingrese su correo electrónico.' });
      return;
    }
    if (!EMAIL_REGEX.test(forgotEmail.trim())) {
      setMsg({ type: 'error', text: 'Ingrese un correo electrónico válido.' });
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail.trim());
      setMsg({ type: 'ok', text: 'Listo. Te enviamos un correo para restablecer la contraseña.' });
    } catch (error) {
      setMsg({
        type: 'error',
        text:
          error.code === 'auth/user-not-found'
            ? 'No hay ningún usuario registrado con este correo.'
            : 'No se pudo enviar el correo de recuperación.',
      });
    } finally {
      setLoading(false);
    }
  };

  const ok = msg?.type === 'ok';

  return (
    <Modal transparent animationType="none" visible onRequestClose={close} statusBarTranslucent>
      <Animated.View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContent,
            {
              opacity: anim,
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            },
          ]}
        >
          <View style={styles.keyCircle}>
            <FontAwesome name="key" size={30} color="#FFFFFF" />
          </View>
          <Text style={styles.modalTitle}>Recuperar contraseña</Text>
          <Text style={styles.modalSubtitle}>
            Ingresá tu correo registrado y te enviaremos las instrucciones.
          </Text>

          {msg && (
            <View style={[styles.modalMsg, { backgroundColor: ok ? '#DCFCE7' : '#FEE2E2' }]}>
              <FontAwesome
                name={ok ? 'check-circle' : 'exclamation-circle'}
                size={16}
                color={ok ? '#166534' : '#B91C1C'}
                style={{ marginRight: 8 }}
              />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: ok ? '#166534' : '#991B1B' }}>
                {msg.text}
              </Text>
            </View>
          )}

          <View style={{ width: '100%', marginBottom: 18 }}>
            <Input
              icon="envelope-o"
              placeholder="Ingrese su correo"
              value={forgotEmail}
              onChangeText={(t) => {
                setForgotEmail(t);
                if (msg) setMsg(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={send}
            />
          </View>

          <TouchableOpacity
            style={[styles.modalButton, loading && { opacity: 0.8 }]}
            onPress={send}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalButtonText}>Enviar correo</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={close} style={{ padding: 12 }}>
            <Text style={{ color: '#6B7280', fontWeight: '600' }}>{ok ? 'Cerrar' : 'Cancelar'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// =========================================================================
// PANTALLA PRINCIPAL DE LOGIN
// =========================================================================
export default function Login({ navigation }) {
  const { width, height } = useWindowDimensions();
  const compact = height < 700;
  const logoH = compact ? 92 : 124;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [forgotVisible, setForgotVisible] = useState(false);
  const [btnW, setBtnW] = useState(360);

  // Animaciones
  const headerAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const emailAnim = useRef(new Animated.Value(0)).current;
  const passAnim = useRef(new Animated.Value(0)).current;
  const optAnim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;
  const linkAnim = useRef(new Animated.Value(0)).current;
  const dividerAnim = useRef(new Animated.Value(0)).current;

  const floatAnim = useRef(new Animated.Value(0)).current;
  const waveDrift = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Habilita el scroll en web: html, body y root necesitan altura completa
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.setAttribute('data-login-scroll', 'true');
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
      t(emailAnim, 480),
      t(passAnim, 560),
      t(optAnim, 640),
      t(btnAnim, 720),
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

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(REMEMBER_KEY);
        if (saved) {
          setEmail(saved);
          setRememberMe(true);
        }
      } catch (e) {}
    })();
  }, []);

  const fadeUp = (v, distance = 24) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  });

  const showError = (msg) => {
    setErrorMessage(msg);
    errorAnim.setValue(0);
    Animated.timing(errorAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 9, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const pressIn = () =>
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(buttonScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  const handleLogin = async () => {
    if (loading) return;
    setErrorMessage('');

    if (!email.trim() || !password) {
      showError('Por favor ingrese tanto el correo como la contraseña.');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      showError('Por favor ingrese un correo electrónico válido.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      if (rememberMe) await AsyncStorage.setItem(REMEMBER_KEY, email.trim());
      else await AsyncStorage.removeItem(REMEMBER_KEY);
    } catch (error) {
      showError(mapAuthError(error.code));
      setLoading(false);
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
            {/* Hojas decorativas */}
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
                <Text style={[styles.mainTitle, compact && { fontSize: 26 }]}>Iniciar sesión</Text>
                <Text style={styles.subtitle}>Accedé a tu cuenta para continuar</Text>
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

              <View style={{ width: '100%' }}>
                {errorMessage !== '' && (
                  <Animated.View
                    style={[styles.errorBanner, { opacity: errorAnim, transform: [{ translateX: shakeAnim }] }]}
                  >
                    <FontAwesome name="exclamation-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                    <Text style={styles.errorBannerText}>{errorMessage}</Text>
                  </Animated.View>
                )}

                <Animated.View style={fadeUp(emailAnim)}>
                  <Text style={styles.label}>Correo electrónico</Text>
                  <Input
                    icon="envelope-o"
                    placeholder="ejemplo@correo.com"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (errorMessage) setErrorMessage('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Animated.View>

                <Animated.View style={fadeUp(passAnim)}>
                  <Text style={styles.label}>Contraseña</Text>
                  <Input
                    icon="lock"
                    placeholder="••••••••"
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (errorMessage) setErrorMessage('');
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    onSubmitEditing={handleLogin}
                    right={
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <FontAwesome name={showPassword ? 'eye' : 'eye-slash'} size={18} color="#6B7280" />
                      </TouchableOpacity>
                    }
                  />
                </Animated.View>

                <Animated.View style={[styles.optionsRow, fadeUp(optAnim, 16)]}>
                  <TouchableOpacity
                    style={styles.rememberRow}
                    onPress={() => setRememberMe(!rememberMe)}
                    activeOpacity={0.8}
                  >
                    <CheckBox checked={rememberMe} />
                    <Text style={styles.rememberText}>Recordar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setForgotVisible(true)}>
                    <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                  </TouchableOpacity>
                </Animated.View>

                {/* BOTÓN CON DEGRADADO, BRILLO Y ANIMACIÓN */}
                <Animated.View style={[fadeUp(btnAnim, 20), { transform: [{ scale: buttonScale }] }]}>
                  <Pressable
                    style={[styles.primaryButton, loading && { opacity: 0.85 }]}
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                    onPress={handleLogin}
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
                        <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
                        <FontAwesome name="arrow-right" size={15} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              </View>

              <Animated.View style={fadeUp(linkAnim, 14)}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('SignUp')}
                  style={styles.signUpRow}
                  activeOpacity={0.7}
                >
                  <Text style={styles.signUpTextPlain}>¿No tenés cuenta? </Text>
                  <Text style={styles.signUpLinkBold}>Registrate.</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {/* ================= PARTE INFERIOR: OLAS Y CAMPO ================= */}
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

      {forgotVisible && <ForgotModal initialEmail={email.trim()} onClose={() => setForgotVisible(false)} />}
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    marginBottom: 10,
  },
  errorBannerText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
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
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginVertical: 14,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: GREEN_MAIN,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: { backgroundColor: GREEN_MAIN },
  rememberText: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  forgotText: { fontSize: 13, fontWeight: '700', color: GREEN_MAIN },
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
  signUpRow: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 4,
    justifyContent: 'center',
  },
  signUpTextPlain: { color: '#6B7280', fontSize: 14 },
  signUpLinkBold: {
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
  keyCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: GREEN_DARK,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
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