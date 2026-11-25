// SignUp.js: registro de usuarios. Valida el formulario, crea la cuenta
// en Firebase y envía el correo de verificación.

// useState: datos que cambian | useRef: animaciones | useEffect: efectos al cargar
import React, { useState, useRef, useEffect } from 'react';

// Componentes de React Native
import {
  View, // Contenedor genérico (como un <div>)
  Text, // Texto
  TextInput, // Campo de texto editable
  TouchableOpacity, // Botón que se vuelve transparente al tocarlo
  StyleSheet, // Para crear los estilos
  Image, // Imágenes (el logo)
  Modal, // Ventanas emergentes (éxito y error)
  ScrollView, // Contenedor con desplazamiento
  KeyboardAvoidingView, // Evita que el teclado tape los campos (iOS)
  Platform, // Permite saber si estamos en web, iOS o Android
  Animated, // Sistema de animaciones
  Easing, // Curvas de aceleración para las animaciones
  Pressable, // Botón con eventos de presionar/soltar
  ActivityIndicator, // Ruedita de carga
  StatusBar, // Barra de estado del teléfono
  useWindowDimensions, // Ancho y alto de la pantalla (se actualiza solo)
} from 'react-native';

// Íconos
import { FontAwesome } from '@expo/vector-icons';

// Firebase Authentication
import {
  createUserWithEmailAndPassword, // Crea el usuario con correo y contraseña
  updateProfile, // Guarda el nombre visible del usuario
  sendEmailVerification, // Envía el correo con el link de verificación
  signOut, // Cierra la sesión
} from 'firebase/auth';

import { auth } from '../src/config/firebaseConfig';

// SVG para olas, hojas y degradados
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

// ============================================================
// CONSTANTES
// ============================================================

// Colores de la marca
const GREEN_DARK = '#0d3827'; // Verde oscuro
const GREEN_MAIN = '#008A3B'; // Verde principal
const SUN_YELLOW = '#F5C518'; // Amarillo sol
const LIME = '#B8DD6B'; // Verde lima

// Ancho máximo de la columna (igual que Login)
const COLUMN_MAX = 480;

// Curva de animación suave
const SMOOTH = Easing.bezier(0.22, 1, 0.36, 1);

// Alto de las olas de arriba y de abajo
const TOP_H = 190;
const FOOT_H = 150;

// Largo mínimo y máximo de la contraseña
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 64;

// Nombre y apellido: solo letras y espacios
const NAME_REGEX =
  /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:\s[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/;

// Correo permitido: solo @gmail.com o @hotmail.com
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com)$/i;

// Formato general de correo (algo@algo.algo)
const GENERIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Contraseña válida: mayúscula, minúscula, número, símbolo y sin espacios
const PASSWORD_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s])\\S{${MIN_PASSWORD},${MAX_PASSWORD}}$`
);

// [S4-18] Medidor (1): reglas de la contraseña, cada una con su prueba
const PASSWORD_RULES = [
  {
    key: 'len',
    label: `${MIN_PASSWORD}+ caracteres`,
    test: (p) => p.length >= MIN_PASSWORD,
  },
  { key: 'upper', label: 'Mayúscula', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Minúscula', test: (p) => /[a-z]/.test(p) },
  { key: 'num', label: 'Número', test: (p) => /\d/.test(p) },
  {
    key: 'sym',
    label: 'Carácter especial',
    test: (p) => /[^A-Za-z0-9\s]/.test(p),
  },
];

// Campos que se validan al registrarse
const FIELDS = [
  'firstName',
  'lastName',
  'email',
  'password',
  'confirmPassword',
];

// ============================================================
// [S2-04] VALIDACIONES
// ============================================================

// Deja solo letras y espacios
const onlyLetters = (text) => text.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '');

// Error del nombre o apellido ('' si está bien)
const getNameError = (value, campo) => {
  const v = value.trim();

  if (!v) return `El ${campo} es obligatorio.`;
  if (v.length < 2) return `El ${campo} debe tener al menos 2 letras.`;
  if (!NAME_REGEX.test(v)) {
    return `El ${campo} solo puede contener letras y espacios.`;
  }

  return '';
};

// Error del correo ('' si está bien)
const getEmailError = (value) => {
  const email = value.trim();

  if (!email) return 'El correo es obligatorio.';

  // Primero el formato general
  if (!GENERIC_EMAIL_REGEX.test(email)) {
    return 'El formato del correo no es válido. Ejemplo: nombre@gmail.com o nombre@hotmail.com';
  }

  // Después, que sea Gmail o Hotmail
  if (!EMAIL_REGEX.test(email)) {
    return 'Use un correo @gmail.com o @hotmail.com.';
  }

  return '';
};

// Error de un campo ('' si está bien)
const getFieldError = (field, values) => {
  switch (field) {
    case 'firstName':
      return getNameError(values.firstName, 'nombre');

    case 'lastName':
      return getNameError(values.lastName, 'apellido');

    case 'email':
      return getEmailError(values.email);

    case 'password':
      if (!values.password) return 'La contraseña es obligatoria.';
      // Lo que falta lo muestran las pastillas
      if (!PASSWORD_REGEX.test(values.password)) {
        return 'La contraseña no cumple todos los requisitos.';
      }
      return '';

    case 'confirmPassword':
      if (!values.confirmPassword) return 'Confirme su contraseña.';
      // Sin contraseña no hay con qué comparar
      if (!values.password) return 'Primero ingrese la contraseña.';
      if (values.password !== values.confirmPassword) {
        return 'Las contraseñas no coinciden.';
      }
      return '';

    default:
      return '';
  }
};

// [S4-18] Medidor (2): cuenta las reglas cumplidas y devuelve nivel y color
const getPasswordStrength = (password) => {
  // Reglas cumplidas (0 a 5)
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;

  // Ninguna regla cumplida
  let label = 'Muy débil';
  let color = '#DC2626'; // rojo

  if (passed === 5) {
    label = 'Fuerte';
    color = '#16A34A'; // verde
  } else if (passed === 4) {
    label = 'Buena';
    color = '#65A30D'; // verde lima
  } else if (passed === 3) {
    label = 'Media';
    color = '#D97706'; // naranja
  } else if (passed > 0) {
    label = 'Débil'; // sigue en rojo
  }

  return { passed, label, color };
};

// Ola de arriba (sw = ancho total)
const topBand = (start, end, sw) =>
  `M0,${80 + start}
   C${sw * 0.25},${15 + start}
   ${sw * 0.7},${95 + end}
   ${sw},${120 + end}
   L${sw},${148 + end}
   C${sw * 0.68},${123 + end}
   ${sw * 0.28},${73 + start}
   0,${136 + start} Z`;

// Ola de abajo
const footBand = (start, end, sw) =>
  `M0,${55 + start}
   C${sw * 0.3},${105 + start}
   ${sw * 0.68},${25 + end}
   ${sw},${70 + end}
   L${sw},${90 + end}
   C${sw * 0.68},${65 + end}
   ${sw * 0.3},${145 + start}
   0,${95 + start} Z`;

// ============================================================
// COMPONENTE DE FONDO
// ============================================================

// Fondo verde claro degradado
function Background() {
  return (
    // No bloquea los toques
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none" // se estira para cubrir toda la pantalla
      >
        <Defs>
          {/* Degradado de arriba hacia abajo */}
          <LinearGradient id="backgroundGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#EAF4E7" />
            <Stop offset="1" stopColor="#F8FAF7" />
          </LinearGradient>
        </Defs>

        <Path d="M0,0 H100 V100 H0 Z" fill="url(#backgroundGradient)" />
      </Svg>
    </View>
  );
}

// ============================================================
// COMPONENTE DE HOJAS DECORATIVAS
// ============================================================

// Hoja decorativa que flota
function Leaf({ size = 60, color = GREEN_MAIN, rotate = 0, style, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Espera inicial y luego sube y baja sin parar
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.sequence([
          // Sube
          Animated.timing(anim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          // Baja
          Animated.timing(anim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
    ]);

    animation.start();

    // Se detiene al salir
    return () => animation.stop();
  }, [anim, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size },
        style, // posición
        {
          transform: [
            { rotate: `${rotate}deg` },
            // Sube 5px
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -5],
              }),
            },
          ],
        },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Forma de la hoja */}
        <Path
          d="M50 92 C10 68 2 35 18 12 C46 12 77 27 82 53 C86 72 69 88 50 92 Z"
          fill={color}
          opacity={0.82}
        />

        {/* Nervadura central (línea blanca) */}
        <Path
          d="M18 15 C38 42 48 62 50 91"
          stroke="#FFFFFF"
          strokeWidth="3"
          fill="none"
          opacity={0.45}
        />
      </Svg>
    </Animated.View>
  );
}

// ============================================================
// COMPONENTE DE CAMPOS
// ============================================================

// [S2-02] Campo reutilizable: etiqueta, ícono, texto, ojito y error
function Field({
  label,
  icon,
  value,
  onChangeText,
  error,
  right,
  onBlur,
  onFocus,
  inputRef, // para pasar al campo siguiente
  ...inputProps
}) {
  // Borde verde mientras se escribe
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>

      {/* Borde: rojo con error, verde al escribir, gris normal */}
      <View
        style={[
          styles.inputBox,
          {
            borderColor: error ? '#DC2626' : focused ? GREEN_MAIN : '#D1D5DB',
          },
        ]}
      >
        <FontAwesome
          name={icon}
          size={17}
          color={error ? '#DC2626' : GREEN_MAIN}
          style={styles.inputIcon}
        />

        <TextInput
          ref={inputRef}
          // Sin marco negro en web
          style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={(e) => {
            setFocused(true);
            onFocus && onFocus(e);
          }}
          // Al salir del campo se valida
          onBlur={(e) => {
            setFocused(false);
            onBlur && onBlur(e);
          }}
          placeholderTextColor="#9CA3AF"
          {...inputProps}
        />

        {/* Ojito (opcional) */}
        {right ? <View style={styles.rightControl}>{right}</View> : null}
      </View>

      {/* Mensaje de error */}
      {error ? (
        <View style={styles.errorRow}>
          <FontAwesome name="exclamation-circle" size={12} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ============================================================
// DEGRADADO DEL BOTÓN
// ============================================================

// Degradado del botón
function Gradient({ id, from, to }) {
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>

      <Path d="M0,0 H100 V100 H0 Z" fill={`url(#${id})`} />
    </Svg>
  );
}

// ============================================================
// PANTALLA DE REGISTRO
// ============================================================

// [S2-01] Pantalla de registro
export default function SignUp({ navigation }) {
  const { width, height } = useWindowDimensions();

  // Pantallas bajas: logo y título más chicos
  const compact = height < 700;

  // Ancho de la columna y de las olas
  const W = Math.min(width || 400, COLUMN_MAX);
  const PAD = 24;
  const sw = W + PAD * 2; // ancho de los SVG de olas
  const logoH = compact ? 80 : 100; // alto del logo

  // [S2-03] Datos que escribe el usuario
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  // Medidor (3): al cambiar, el medidor se recalcula
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Tecla "Siguiente": pasa al campo de abajo sin tocar la pantalla
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const values = { firstName, lastName, email, password, confirmPassword };

  // Ojitos de las contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Cargando mientras se crea la cuenta
  const [loading, setLoading] = useState(false);

  // Errores por campo
  const [errors, setErrors] = useState({});

  // Ancho del botón (para el brillo)
  const [btnW, setBtnW] = useState(360);

  // Ventana de error
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: '',
    message: '',
  });

  const showMessage = (title, message) => {
    setErrorModal({ visible: true, title, message });
  };

  const closeMessage = () => {
    setErrorModal((prev) => ({ ...prev, visible: false }));
  };

  // Ventana de registro exitoso
  const [successVisible, setSuccessVisible] = useState(false);
  const [sentTo, setSentTo] = useState(''); // correo de destino

  // Animaciones de entrada
  const headerAnim = useRef(new Animated.Value(0)).current; // olas de arriba
  const footerAnim = useRef(new Animated.Value(0)).current; // olas de abajo
  const logoAnim = useRef(new Animated.Value(0)).current; // logo
  const titleAnim = useRef(new Animated.Value(0)).current; // título
  const formAnim = useRef(new Animated.Value(0)).current; // formulario
  const linkAnim = useRef(new Animated.Value(0)).current; // link a Login
  const dividerAnim = useRef(new Animated.Value(0)).current; // línea verde/amarilla

  // Animaciones continuas
  const floatAnim = useRef(new Animated.Value(0)).current; // logo flotando
  const waveDrift = useRef(new Animated.Value(0)).current; // olas moviéndose
  const shimmer = useRef(new Animated.Value(0)).current; // brillo del botón
  const buttonScale = useRef(new Animated.Value(1)).current; // botón al presionar
  const shakeAnim = useRef(new Animated.Value(0)).current; // temblor por error
  const strengthAnim = useRef(new Animated.Value(0)).current; // Medidor (4): % de la barra

  // Medidor (3): nivel de la contraseña actual
  const passwordStrength = getPasswordStrength(password);

  // Web: alto completo para que funcione el scroll
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined;
    }

    const style = document.createElement('style');
    style.setAttribute('data-signup-scroll', 'true');
    style.textContent = 'html, body, #root { height: 100%; margin: 0; }';

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Animaciones de entrada y movimiento
  useEffect(() => {
    const animateIn = (value, delay = 0, duration = 750) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        delay,
        easing: SMOOTH,
        useNativeDriver: true,
      });

    // Entrada escalonada
    Animated.parallel([
      animateIn(headerAnim, 0, 1000),
      animateIn(footerAnim, 100, 1000),
      animateIn(logoAnim, 200, 900),
      animateIn(titleAnim, 350),
      animateIn(formAnim, 450, 850),
      animateIn(linkAnim, 700),
      animateIn(dividerAnim, 550, 800),
    ]).start();

    // Logo flotando
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

    // Olas de lado a lado
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

    // Brillo del botón
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

    float.start();
    drift.start();
    shine.start();

    // Se detienen al salir
    return () => {
      float.stop();
      drift.stop();
      shine.stop();
    };
  }, [
    dividerAnim,
    floatAnim,
    footerAnim,
    formAnim,
    headerAnim,
    linkAnim,
    logoAnim,
    shimmer,
    titleAnim,
    waveDrift,
  ]);

  // [S4-18] Medidor (4): la barra se llena hasta el nuevo porcentaje
  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: (passwordStrength.passed / PASSWORD_RULES.length) * 100,
      duration: 420,
      easing: SMOOTH,
      useNativeDriver: false, // el ancho no admite driver nativo
    }).start();
  }, [passwordStrength.passed, strengthAnim]);

  // Aparece subiendo
  const fadeUp = (value, distance = 24) => ({
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  });

  // Temblor si hay errores
  const runShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 9, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Botón se achica al presionar
  const pressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const pressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  // [S2-04] Al escribir se borra el error, al salir se valida
  // y al tocar "Registrarse" se validan todos

  // Valida todos (true si no hay errores)
  const validate = () => {
    const validationErrors = {};

    FIELDS.forEach((field) => {
      const message = getFieldError(field, values);
      if (message) validationErrors[field] = message;
    });

    setErrors(validationErrors);

    return Object.keys(validationErrors).length === 0;
  };

  // Valida un campo al salir
  const validateOnBlur = (field) => {
    // Vacío: se avisa al registrarse
    if (!values[field].trim()) return;

    const message = getFieldError(field, values);

    setErrors((prev) => ({ ...prev, [field]: message || undefined }));
  };

  // Borra el error al escribir
  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;

      return { ...prev, [field]: undefined };
    });
  };

  // Registro con Firebase

  // [S2-05] Lo que pasa al tocar "Registrarse": valida todo y crea la cuenta.
  const handleSignUp = async () => {
    // Evita doble envío
    if (loading) return;

    // Si hay errores, tiembla el formulario
    if (!validate()) {
      runShake();
      return;
    }

    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1) Crear el usuario
      // [S2-06] Firebase crea la cuenta con el correo y la contraseña.
      const credential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      // 2) Guardar nombre y apellido
      try {
        await updateProfile(credential.user, {
          displayName: `${firstName.trim()} ${lastName.trim()}`,
        });
      } catch (profileError) {
        console.error('No se pudo guardar el nombre visible:', profileError);
      }

      // [S4-14] 3) Enviar el enlace de verificación
      try {
        await sendEmailVerification(credential.user);
      } catch (verifyError) {
        console.error('No se pudo enviar la verificación:', verifyError);
      }

      // 4) Mostrar la ventana de éxito
      setSentTo(cleanEmail);
      setErrors({});
      setSuccessVisible(true);
    } catch (error) {
      console.error('Error de registro:', error.code, error.message);

      let errorMessage = 'No pudimos crear su cuenta. Inténtelo nuevamente.';

      // true: el error va debajo del campo
      let inlineOnly = false;

      // [S2-06] Errores de Firebase en mensajes claros
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage =
            'Este correo ya está registrado. Inicie sesión o use otro correo.';
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
          errorMessage = 'No pudimos conectarnos. Verifique su conexión a internet e inténtelo nuevamente.';
          break;

        case 'auth/too-many-requests':
          errorMessage =
            'Demasiados intentos. Espere unos minutos e inténtelo de nuevo.';
          break;

        case 'auth/operation-not-allowed':
          errorMessage = 'No pudimos crear su cuenta en este momento. Inténtelo más tarde.';
          break;

        case 'auth/invalid-api-key':
          errorMessage =
            'No pudimos crear su cuenta en este momento. Inténtelo más tarde.';
          break;

        default:
          // Error desconocido: se deja el mensaje general (el código queda en la consola)
          break;
      }

      if (!inlineOnly) {
        showMessage('No se pudo registrar', errorMessage);
      } else {
        runShake();
      }
    } finally {
      setLoading(false);
    }
  };

  // Al cerrar: cerrar sesión e ir a Login
  const closeSuccess = async () => {
    setSuccessVisible(false);
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    }
    navigation.navigate('Login');
  };

  // Movimiento de las olas
  const driftX = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-PAD * 0.7, PAD * 0.7],
  });

  const driftXInv = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD * 0.7, -PAD * 0.7],
  });

  // Interfaz

  return (
    // El teclado no tapa los campos (iOS)
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Background />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.column}>
          {/* Decoración superior */}
          <View style={styles.topArea}>
            <Leaf size={96} color={GREEN_DARK} rotate={-35} style={{ left: -14, top: -18 }} />
            <Leaf size={64} color="#168A48" rotate={-70} style={{ left: 38, top: -22 }} delay={400} />
            <Leaf size={84} color="#0f6b34" rotate={50} style={{ right: -8, top: 6 }} delay={700} />
            <Leaf size={52} color="#2E9E4F" rotate={80} style={{ right: 62, top: -14 }} delay={200} />

            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: headerAnim,
                  transform: [{ translateX: driftX }],
                  left: -PAD,
                  width: sw,
                },
              ]}
            >
              <Svg width={sw} height={TOP_H} viewBox={`0 0 ${sw} ${TOP_H}`}>
                <Path d={topBand(-62, -40, sw)} fill={GREEN_DARK} opacity={0.92} />
                <Path d={topBand(-40, -7, sw)} fill={GREEN_MAIN} />
                <Path d={topBand(-7, 0, sw)} fill={LIME} />
                <Path
                  d={`M0,${TOP_H} L0,70 C${sw * 0.35},25 ${sw * 0.65},85 ${sw},135 L${sw},${TOP_H} Z`}
                  fill="#FFFFFF"
                />
                <Path
                  d={`M0,100 C${sw * 0.1},78 ${sw * 0.22},62 ${sw * 0.36},56 C${sw * 0.2},84 ${sw * 0.08},124 0,178 Z`}
                  fill={SUN_YELLOW}
                />
              </Svg>
            </Animated.View>
          </View>

          {/* Formulario */}
          <View style={styles.body}>
            <View style={styles.content}>
              {/* Logo */}
              <Animated.View
                style={{
                  alignItems: 'center',
                  opacity: logoAnim,
                  transform: [
                    {
                      scale: logoAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.85, 1],
                      }),
                    },
                  ],
                }}
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        translateY: floatAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -6],
                        }),
                      },
                    ],
                  }}
                >
                  <Image
                    source={require('../assets/logo.png')}
                    style={{ width: logoH * 1.1, height: logoH }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </Animated.View>

              {/* Título */}
              <Animated.View
                style={[
                  {
                    alignItems: 'center',
                    width: '100%',
                  },
                  fadeUp(titleAnim),
                ]}
              >
                <Text style={[styles.mainTitle, compact && { fontSize: 26 }]}>
                  Crear cuenta
                </Text>

                <Text style={styles.subtitle}>Regístrese en Agroquímica Del Valle</Text>

                <Animated.View
                  style={[
                    styles.dividerContainer,
                    { width: 80, transform: [{ scaleX: dividerAnim }] },
                  ]}
                >
                  <View style={styles.dividerGreen} />
                  <View style={styles.dividerYellow} />
                </Animated.View>
              </Animated.View>

              {/* [S2-02] Formulario de registro */}
              <Animated.View
                style={[
                  { width: '100%' },
                  {
                    opacity: formAnim,
                    transform: [
                      {
                        translateY: formAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [24, 0],
                        }),
                      },
                      { translateX: shakeAnim },
                    ],
                  },
                ]}
              >
                <Field
                  label="Nombre"
                  icon="user-o"
                  placeholder="Ingrese su nombre"
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(onlyLetters(text));
                    clearError('firstName');
                  }}
                  onBlur={() => validateOnBlur('firstName')}
                  error={errors.firstName}
                  maxLength={50}
                  autoCapitalize="words"
                  autoComplete="given-name"
                  textContentType="givenName"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />

                <Field
                  label="Apellido"
                  icon="user-o"
                  placeholder="Ingrese su apellido"
                  value={lastName}
                  onChangeText={(text) => {
                    setLastName(onlyLetters(text));
                    clearError('lastName');
                  }}
                  onBlur={() => validateOnBlur('lastName')}
                  error={errors.lastName}
                  maxLength={50}
                  autoCapitalize="words"
                  autoComplete="family-name"
                  textContentType="familyName"
                  inputRef={lastNameRef}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />

                <Field
                  label="Correo electrónico"
                  icon="envelope-o"
                  placeholder="ejemplo@gmail.com o ejemplo@hotmail.com"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text.replace(/\s/g, ''));
                    clearError('email');
                  }}
                  onBlur={() => validateOnBlur('email')}
                  error={errors.email}
                  maxLength={100}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  inputRef={emailRef}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />

                <Field
                  label="Contraseña"
                  icon="lock"
                  placeholder="Cree una contraseña segura"
                  value={password}
                  onChangeText={(text) => {
                    const cleanPassword = text.replace(/\s/g, '');

                    setPassword(cleanPassword);
                    clearError('password');

                    // Se vuelve a comparar al salir
                    clearError('confirmPassword');
                  }}
                  onBlur={() => {
                    validateOnBlur('password');
                    validateOnBlur('confirmPassword');
                  }}
                  error={errors.password}
                  maxLength={MAX_PASSWORD}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  inputRef={passwordRef}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  right={
                    <TouchableOpacity
                      onPress={() => setShowPassword((prev) => !prev)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <FontAwesome
                        name={showPassword ? 'eye-slash' : 'eye'}
                        size={18}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  }
                />

                {/* [S4-18] Requisitos (solo con el campo vacío) */}
                {!password && !errors.password && (
                  <Text style={styles.hintText}>
                    Mínimo {MIN_PASSWORD} caracteres, una mayúscula, una minúscula,
                    un número y un carácter especial. Sin espacios.
                  </Text>
                )}

                {/* Medidor de seguridad */}
                {password.length > 0 && (
                  <View style={styles.strengthBox}>
                    {/* Medidor (2): nivel y color */}
                    <View style={styles.strengthHeader}>
                      <Text style={styles.strengthText}>Seguridad de la contraseña:</Text>
                      <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                        {passwordStrength.label}
                      </Text>
                    </View>

                    {/* Medidor (4): la barra pasa de 0% a 100% de ancho */}
                    <View style={styles.strengthBarBackground}>
                      <Animated.View
                        style={[
                          styles.strengthBarFill,
                          {
                            width: strengthAnim.interpolate({
                              inputRange: [0, 100],
                              outputRange: ['0%', '100%'],
                            }),
                            backgroundColor: passwordStrength.color,
                          },
                        ]}
                      />
                    </View>

                    {/* Medidor (5): una pastilla por regla, verde si se cumple */}
                    <View style={styles.rulesWrap}>
                      {PASSWORD_RULES.map((rule) => {
                        const passed = rule.test(password);

                        return (
                          <View
                            key={rule.key}
                            style={[styles.rulePill, passed && styles.rulePillOk]}
                          >
                            <FontAwesome
                              name={passed ? 'check-circle' : 'circle-o'}
                              size={11}
                              color={passed ? GREEN_MAIN : '#9CA3AF'}
                            />
                            <Text style={[styles.ruleText, passed && { color: GREEN_DARK }]}>
                              {rule.label}
                            </Text>
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
                  onChangeText={(text) => {
                    setConfirmPassword(text.replace(/\s/g, ''));
                    clearError('confirmPassword');
                  }}
                  onBlur={() => validateOnBlur('confirmPassword')}
                  error={errors.confirmPassword}
                  maxLength={MAX_PASSWORD}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  inputRef={confirmRef}
                  returnKeyType="done" // tecla "Listo": registra
                  onSubmitEditing={handleSignUp} // Enter registra
                  right={
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword((prev) => !prev)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <FontAwesome
                        name={showConfirmPassword ? 'eye-slash' : 'eye'}
                        size={18}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  }
                />

                {/* Botón Registrarse */}
                <Animated.View
                  style={{
                    width: '90%',
                    alignSelf: 'center',
                    marginTop: 16,
                    transform: [{ scale: buttonScale }],
                  }}
                >
                  <Pressable
                    style={[styles.primaryButton, loading && { opacity: 0.85 }]}
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                    onPress={handleSignUp}
                    onLayout={(event) => setBtnW(event.nativeEvent.layout.width)}
                    disabled={loading}
                    android_ripple={{ color: 'rgba(255,255,255,0.25)', foreground: true }} // onda al tocar (Android)
                  >
                    <Gradient id="btnGrad" from="#0B8A3E" to="#00B04F" />

                    {/* Brillo (oculto al cargar) */}
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
                        <FontAwesome name="arrow-right" size={13} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              </Animated.View>

              {/* Enlace a Login */}
              <Animated.View style={fadeUp(linkAnim, 14)}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  style={styles.loginRow}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loginTextPlain}>¿Ya tiene una cuenta?</Text>
                  <Text style={styles.loginLinkBold}>Inicie sesión.</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {/* Decoración inferior */}
          <View style={styles.footArea}>
            <Leaf size={90} color={GREEN_DARK} rotate={25} style={{ left: -10, bottom: -22 }} delay={300} />
            <Leaf size={58} color="#168A48" rotate={55} style={{ left: 56, bottom: -16 }} delay={900} />
            <Leaf size={70} color="#2E9E4F" rotate={-40} style={{ right: -6, bottom: -18 }} delay={600} />

            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: footerAnim,
                  transform: [{ translateX: driftXInv }],
                  left: -PAD,
                  width: sw,
                },
              ]}
            >
              <Svg width={sw} height={FOOT_H} viewBox={`0 0 ${sw} ${FOOT_H}`}>
                <Path
                  d={`M0,0 L${sw},0 L${sw},70 C${sw * 0.7},25 ${sw * 0.35},105 0,55 Z`}
                  fill="#FFFFFF"
                />
                <Path d={footBand(0, 9, sw)} fill={LIME} />
                <Path d={footBand(9, 34, sw)} fill={SUN_YELLOW} />
                <Path d={footBand(34, 52, sw)} fill={GREEN_MAIN} />
                <Path d={footBand(52, 70, sw)} fill={GREEN_DARK} opacity={0.85} />
              </Svg>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      {/* [S4-14] Aviso de correo de verificación enviado */}
      <Modal
        animationType="fade"
        transparent
        visible={successVisible}
        onRequestClose={closeSuccess}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.errorCircle, { backgroundColor: GREEN_MAIN }]}>
              <FontAwesome name="envelope" size={30} color="#FFFFFF" />
            </View>

            <Text style={styles.modalTitle}>¡Revise su correo!</Text>

            <Text style={styles.modalSubtitle}>
              Le enviamos un enlace de verificación a{'\n'}
              <Text style={{ fontWeight: 'bold' }}>{sentTo}</Text>
              {'\n\n'}Ábralo para activar su cuenta y luego inicie sesión.
              Si no lo encuentra, revise la carpeta de spam.
            </Text>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: GREEN_MAIN }]}
              onPress={closeSuccess}
              activeOpacity={0.85}
            >
              <Text style={styles.modalButtonText}>Ir a iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* [S2-06] Ventana de error */}
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

            <TouchableOpacity
              style={styles.modalButton}
              onPress={closeMessage}
              activeOpacity={0.85}
            >
              <Text style={styles.modalButtonText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  // Estructura
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
    paddingVertical: 18,
    // -1 tapa la línea entre olas y formulario
    marginTop: -1,
    marginBottom: -1,
  },

  content: {
    width: '100%',
    alignItems: 'center',
  },

  // Encabezado
  mainTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginTop: 4,
  },

  subtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    width: '100%',
    maxWidth: '100%',
    flexShrink: 1,
    alignSelf: 'center',
    paddingHorizontal: 4,
  },

  dividerContainer: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 12,
  },

  dividerGreen: {
    flex: 1,
    backgroundColor: GREEN_MAIN,
  },

  dividerYellow: {
    flex: 1,
    backgroundColor: SUN_YELLOW,
  },

  // Campos
  fieldWrap: {
    width: '100%',
    marginBottom: 4,
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
    minHeight: 50,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },

  inputIcon: {
    width: 26,
    marginRight: 6,
  },

  input: {
    flex: 1,
    color: '#1F2937',
    fontSize: 14,
    minHeight: 50,
    paddingVertical: 8,
  },

  rightControl: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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

  hintText: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 5,
  },

  // Medidor de seguridad
  strengthBox: {
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
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

  strengthText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
    flexShrink: 1,
  },

  strengthLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
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

  rulePillOk: {
    backgroundColor: '#DCFCE7',
  },

  ruleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Botón Registrarse
  primaryButton: {
    height: 46,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: GREEN_MAIN,
    shadowColor: GREEN_MAIN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },

  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 40,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },

  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },

  // Enlace a Login
  loginRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    marginBottom: 4,
    justifyContent: 'center',
  },

  loginTextPlain: {
    color: '#6B7280',
    fontSize: 14,
  },

  loginLinkBold: {
    color: GREEN_MAIN,
    fontWeight: 'bold',
    fontSize: 14,
    textDecorationLine: 'underline',
  },

  // Ventanas
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

  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
