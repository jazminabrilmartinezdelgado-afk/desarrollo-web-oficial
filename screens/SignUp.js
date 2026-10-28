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
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

// ============================================================
// CONSTANTES
// ============================================================

const GREEN_DARK = '#0d3827';
const GREEN_MAIN = '#008A3B';
const SUN_YELLOW = '#F5C518';
const LIME = '#B8DD6B';

const COLUMN_MAX = 460;
const TOP_H = 190;
const FOOT_H = 150;

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 64;

const NAME_REGEX =
  /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:\s[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/;

const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com)$/i;

const GENERIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s])\\S{${MIN_PASSWORD},${MAX_PASSWORD}}$`
);

const PASSWORD_RULES = [
  {
    key: 'len',
    label: `${MIN_PASSWORD}+ caracteres`,
    test: (p) => p.length >= MIN_PASSWORD,
  },
  {
    key: 'upper',
    label: 'Mayúscula',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    key: 'lower',
    label: 'Minúscula',
    test: (p) => /[a-z]/.test(p),
  },
  {
    key: 'num',
    label: 'Número',
    test: (p) => /\d/.test(p),
  },
  {
    key: 'sym',
    label: 'Carácter especial',
    test: (p) => /[^A-Za-z0-9\s]/.test(p),
  },
];

// ============================================================
// VALIDACIONES Y FUNCIONES AUXILIARES
// ============================================================

const onlyLetters = (text) =>
  text.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '');

const getEmailError = (value) => {
  const email = value.trim();

  if (!email) {
    return 'El correo es obligatorio.';
  }

  if (!GENERIC_EMAIL_REGEX.test(email)) {
    return 'El formato del correo no es válido. Ejemplo: nombre@gmail.com';
  }

  if (!EMAIL_REGEX.test(email)) {
    return 'Use un correo @gmail.com o @hotmail.com.';
  }

  return '';
};

const getPasswordStrength = (password) => {
  const passed = PASSWORD_RULES.filter((rule) =>
    rule.test(password)
  ).length;

  let label = 'Muy débil';
  let color = '#DC2626';

  if (passed === 5) {
    label = 'Fuerte';
    color = '#16A34A';
  } else if (passed === 4) {
    label = 'Buena';
    color = '#65A30D';
  } else if (passed === 3) {
    label = 'Media';
    color = '#D97706';
  } else if (passed > 0) {
    label = 'Débil';
  }

  return {
    passed,
    label,
    color,
    width: `${(passed / PASSWORD_RULES.length) * 100}%`,
  };
};

const topBand = (start, end, sw) =>
  `M0,${80 + start}
   C${sw * 0.25},${15 + start}
   ${sw * 0.7},${95 + end}
   ${sw},${120 + end}
   L${sw},${148 + end}
   C${sw * 0.68},${123 + end}
   ${sw * 0.28},${73 + start}
   0,${136 + start} Z`;

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

function Background() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient
            id="backgroundGradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <Stop offset="0" stopColor="#EAF4E7" />
            <Stop offset="1" stopColor="#F8FAF7" />
          </LinearGradient>
        </Defs>

        <Path
          d="M0,0 H100 V100 H0 Z"
          fill="url(#backgroundGradient)"
        />
      </Svg>
    </View>
  );
}

// ============================================================
// COMPONENTE DE HOJAS DECORATIVAS
// ============================================================

function Leaf({
  size = 60,
  color = GREEN_MAIN,
  rotate = 0,
  style,
  delay = 0,
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [anim, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
        },
        style,
        {
          transform: [
            { rotate: `${rotate}deg` },
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
        <Path
          d="M50 92 C10 68 2 35 18 12 C46 12 77 27 82 53 C86 72 69 88 50 92 Z"
          fill={color}
          opacity={0.82}
        />

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

function Field({
  label,
  icon,
  value,
  onChangeText,
  error,
  right,
  onBlur,
  ...inputProps
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.inputBox,
          {
            borderColor: error ? '#DC2626' : '#D1D5DB',
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
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholderTextColor="#9CA3AF"
          {...inputProps}
        />

        {right ? (
          <View style={styles.rightControl}>{right}</View>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <FontAwesome
            name="exclamation-circle"
            size={12}
            color="#DC2626"
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ============================================================
// DEGRADADO DEL BOTÓN
// ============================================================

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
        <LinearGradient
          id={id}
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>

      <Path
        d="M0,0 H100 V100 H0 Z"
        fill={`url(#${id})`}
      />
    </Svg>
  );
}

// ============================================================
// PANTALLA DE REGISTRO
// ============================================================

export default function SignUp({ navigation }) {
  const { width, height } = useWindowDimensions();

  const compact = height < 700;

  // Ancho real de la columna (igual que en Login) + margen para que
  // las olas se muevan sin mostrar bordes
  const W = Math.min(width || 400, COLUMN_MAX);
  const PAD = 24;
  const sw = W + PAD * 2;
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

  // Modal únicamente para errores
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: '',
    message: '',
  });

  const showMessage = (title, message) => {
    setErrorModal({
      visible: true,
      title,
      message,
    });
  };

  // Modal de éxito: aviso de verificación enviada
  const [successVisible, setSuccessVisible] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const closeMessage = () => {
    setErrorModal((prev) => ({
      ...prev,
      visible: false,
    }));
  };

  // Animaciones
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

  const passwordStrength = getPasswordStrength(password);

  // Ajuste de altura para navegador web
  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      typeof document === 'undefined'
    ) {
      return undefined;
    }

    const style = document.createElement('style');
    style.setAttribute('data-signup-scroll', 'true');
    style.textContent =
      'html, body, #root { height: 100%; margin: 0; }';

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Animaciones de entrada y movimiento
  useEffect(() => {
    const animateIn = (value, delay = 0, duration = 520) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    Animated.parallel([
      animateIn(headerAnim, 0, 800),
      animateIn(footerAnim, 150, 800),

      Animated.spring(logoAnim, {
        toValue: 1,
        friction: 5,
        tension: 70,
        delay: 250,
        useNativeDriver: true,
      }),

      animateIn(titleAnim, 380),
      animateIn(formAnim, 480),
      animateIn(linkAnim, 800),

      Animated.timing(dividerAnim, {
        toValue: 1,
        duration: 600,
        delay: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

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

  // Medidor de seguridad de contraseña
  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue:
        (passwordStrength.passed / PASSWORD_RULES.length) * 100,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [passwordStrength.passed, strengthAnim]);

  // Animación de entrada del formulario
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

  // Temblor cuando hay errores de validación
  const runShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 9,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -9,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 5,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  // ==========================================================
  // VALIDACIÓN DE LOS CAMPOS
  // ==========================================================

  const validate = () => {
    const validationErrors = {};

    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();

    if (!fn) {
      validationErrors.firstName = 'El nombre es obligatorio.';
    } else if (fn.length < 2) {
      validationErrors.firstName =
        'El nombre debe tener al menos 2 letras.';
    } else if (!NAME_REGEX.test(fn)) {
      validationErrors.firstName =
        'El nombre solo puede contener letras y espacios.';
    }

    if (!ln) {
      validationErrors.lastName = 'El apellido es obligatorio.';
    } else if (ln.length < 2) {
      validationErrors.lastName =
        'El apellido debe tener al menos 2 letras.';
    } else if (!NAME_REGEX.test(ln)) {
      validationErrors.lastName =
        'El apellido solo puede contener letras y espacios.';
    }

    const emailError = getEmailError(em);

    if (emailError) {
      validationErrors.email = emailError;
    }

    if (!password) {
      validationErrors.password =
        'La contraseña es obligatoria.';
    } else if (!PASSWORD_REGEX.test(password)) {
      validationErrors.password =
        `Mínimo ${MIN_PASSWORD} caracteres, una mayúscula, una minúscula, un número y un carácter especial. Sin espacios.`;
    }

    if (!confirmPassword) {
      validationErrors.confirmPassword =
        'Confirme su contraseña.';
    } else if (password !== confirmPassword) {
      validationErrors.confirmPassword =
        'Las contraseñas no coinciden.';
    }

    setErrors(validationErrors);

    return Object.keys(validationErrors).length === 0;
  };

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }

      return {
        ...prev,
        [field]: undefined,
      };
    });
  };

  // ==========================================================
  // REGISTRO CON FIREBASE
  // ==========================================================

  const handleSignUp = async () => {
    if (loading) return;

    if (!validate()) {
      runShake();
      return;
    }

    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      // Guardar nombre y apellido en el perfil de Firebase
      try {
        await updateProfile(credential.user, {
          displayName: `${firstName.trim()} ${lastName.trim()}`,
        });
      } catch (profileError) {
        console.error(
          'No se pudo guardar el nombre visible:',
          profileError
        );
      }

      // ENLACE DE VERIFICACIÓN: Firebase envía un correo con un link.
      // Mientras no lo abra, Navigation no deja entrar a Home.
      try {
        await sendEmailVerification(credential.user);
      } catch (verifyError) {
        console.error('No se pudo enviar la verificación:', verifyError);
      }

      setSentTo(cleanEmail);
      setErrors({});
      setSuccessVisible(true);
    } catch (error) {
      console.error(
        'Error de registro:',
        error.code,
        error.message
      );

      let errorMessage =
        'Hubo un problema al registrar el usuario.';

      let inlineOnly = false;

      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage =
            'Este correo ya está registrado. Inicie sesión o use otro correo.';

          setErrors((prev) => ({
            ...prev,
            email: errorMessage,
          }));

          inlineOnly = true;
          break;

        case 'auth/invalid-email':
          errorMessage =
            'El formato del correo electrónico no es válido.';
          break;

        case 'auth/weak-password':
          errorMessage =
            'La contraseña es demasiado débil.';
          break;

        case 'auth/network-request-failed':
          errorMessage =
            'Error de conexión. Por favor, intenta más tarde.';
          break;

        case 'auth/too-many-requests':
          errorMessage =
            'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
          break;

        case 'auth/operation-not-allowed':
          errorMessage =
            'El registro con correo no está habilitado en Firebase.';
          break;

        case 'auth/invalid-api-key':
          errorMessage =
            'La clave API de Firebase no es válida. Revisa su configuración.';
          break;

        default:
          errorMessage +=
            `\n\nCódigo: ${error.code || 'desconocido'}`;
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

  // Al cerrar el modal de éxito: cerrar sesión (aún sin verificar) e ir a Login
  const closeSuccess = async () => {
    setSuccessVisible(false);
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    }
    navigation.navigate('Login');
  };

  const driftX = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-PAD * 0.7, PAD * 0.7],
  });

  const driftXInv = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD * 0.7, -PAD * 0.7],
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <Background />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.column}>
          {/* PARTE SUPERIOR DECORATIVA */}
          <View style={styles.topArea}>
            <Leaf
              size={96}
              color={GREEN_DARK}
              rotate={-35}
              style={{ left: -14, top: -18 }}
            />

            <Leaf
              size={64}
              color="#168A48"
              rotate={-70}
              style={{ left: 38, top: -22 }}
              delay={400}
            />

            <Leaf
              size={84}
              color="#0f6b34"
              rotate={50}
              style={{ right: -8, top: 6 }}
              delay={700}
            />

            <Leaf
              size={52}
              color="#2E9E4F"
              rotate={80}
              style={{ right: 62, top: -14 }}
              delay={200}
            />

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
              <Svg
                width={sw}
                height={TOP_H}
                viewBox={`0 0 ${sw} ${TOP_H}`}
              >
                <Path
                  d={topBand(-62, -40, sw)}
                  fill={GREEN_DARK}
                  opacity={0.92}
                />

                <Path
                  d={topBand(-40, -7, sw)}
                  fill={GREEN_MAIN}
                />

                <Path
                  d={topBand(-7, 0, sw)}
                  fill={LIME}
                />

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

          {/* FORMULARIO */}
          <View style={styles.body}>
            <View style={styles.content}>
              {/* LOGO */}
              <Animated.View
                style={{
                  alignItems: 'center',
                  opacity: logoAnim,
                  transform: [
                    {
                      scale: logoAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1],
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
                    style={{
                      width: logoH * 1.1,
                      height: logoH,
                    }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </Animated.View>

              {/* TÍTULO */}
              <Animated.View
                style={[
                  { alignItems: 'center' },
                  fadeUp(titleAnim),
                ]}
              >
                <Text
                  style={[
                    styles.mainTitle,
                    compact && { fontSize: 26 },
                  ]}
                >
                  Crear cuenta
                </Text>

                <Text style={styles.subtitle}>
                  Registrate en Agroquímica del Valle
                </Text>

                <Animated.View
                  style={[
                    styles.dividerContainer,
                    {
                      width: dividerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 80],
                      }),
                    },
                  ]}
                >
                  <View style={styles.dividerGreen} />
                  <View style={styles.dividerYellow} />
                </Animated.View>
              </Animated.View>

              {/* CAMPOS DEL FORMULARIO */}
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
                {/* NOMBRE */}
                <Field
                  label="Nombre"
                  icon="user-o"
                  placeholder="Ingrese su nombre"
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(onlyLetters(text));
                    clearError('firstName');
                  }}
                  error={errors.firstName}
                  maxLength={50}
                  autoCapitalize="words"
                  autoComplete="given-name"
                  textContentType="givenName"
                />

                {/* APELLIDO */}
                <Field
                  label="Apellido"
                  icon="user-o"
                  placeholder="Ingrese su apellido"
                  value={lastName}
                  onChangeText={(text) => {
                    setLastName(onlyLetters(text));
                    clearError('lastName');
                  }}
                  error={errors.lastName}
                  maxLength={50}
                  autoCapitalize="words"
                  autoComplete="family-name"
                  textContentType="familyName"
                />

                {/* CORREO */}
                <Field
                  label="Correo electrónico"
                  icon="envelope-o"
                  placeholder="ejemplo@gmail.com o @hotmail.com"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text.replace(/\s/g, ''));
                    clearError('email');
                  }}
                  onBlur={() => {
                    if (email.trim()) {
                      const message = getEmailError(email);

                      setErrors((prev) => ({
                        ...prev,
                        email: message || undefined,
                      }));
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

                {/* CONTRASEÑA */}
                <Field
                  label="Contraseña"
                  icon="lock"
                  placeholder="Cree una contraseña segura"
                  value={password}
                  onChangeText={(text) => {
                    const cleanPassword = text.replace(/\s/g, '');

                    setPassword(cleanPassword);
                    clearError('password');

                    if (
                      confirmPassword &&
                      cleanPassword === confirmPassword
                    ) {
                      clearError('confirmPassword');
                    }
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
                      onPress={() =>
                        setShowPassword((prev) => !prev)
                      }
                      hitSlop={{
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10,
                      }}
                    >
                      <FontAwesome
                        name={
                          showPassword ? 'eye-slash' : 'eye'
                        }
                        size={18}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  }
                />

                {!errors.password && (
                  <Text style={styles.hintText}>
                    Mínimo {MIN_PASSWORD} caracteres, una mayúscula,
                    una minúscula, un número y un carácter especial. Sin
                    espacios.
                  </Text>
                )}

                {/* MEDIDOR DE SEGURIDAD */}
                {password.length > 0 && (
                  <View style={styles.strengthBox}>
                    <View style={styles.strengthHeader}>
                      <Text style={styles.strengthText}>
                        Seguridad de la contraseña:
                      </Text>

                      <Text
                        style={[
                          styles.strengthLabel,
                          { color: passwordStrength.color },
                        ]}
                      >
                        {passwordStrength.label}
                      </Text>
                    </View>

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

                    <View style={styles.rulesWrap}>
                      {PASSWORD_RULES.map((rule) => {
                        const passed = rule.test(password);

                        return (
                          <View
                            key={rule.key}
                            style={[
                              styles.rulePill,
                              passed && styles.rulePillOk,
                            ]}
                          >
                            <FontAwesome
                              name={
                                passed
                                  ? 'check-circle'
                                  : 'circle-o'
                              }
                              size={11}
                              color={
                                passed ? GREEN_MAIN : '#9CA3AF'
                              }
                            />

                            <Text
                              style={[
                                styles.ruleText,
                                passed && {
                                  color: GREEN_DARK,
                                },
                              ]}
                            >
                              {rule.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* CONFIRMAR CONTRASEÑA */}
                <Field
                  label="Confirmar contraseña"
                  icon="lock"
                  placeholder="Repita su contraseña"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    const cleanConfirmation = text.replace(/\s/g, '');

                    setConfirmPassword(cleanConfirmation);

                    if (!cleanConfirmation) {
                      clearError('confirmPassword');
                    } else if (cleanConfirmation === password) {
                      clearError('confirmPassword');
                    } else {
                      setErrors((prev) => ({
                        ...prev,
                        confirmPassword:
                          'Las contraseñas no coinciden.',
                      }));
                    }
                  }}
                  error={
                    errors.confirmPassword ||
                    (confirmPassword.length > 0 &&
                    password !== confirmPassword
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
                      onPress={() =>
                        setShowConfirmPassword((prev) => !prev)
                      }
                      hitSlop={{
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10,
                      }}
                    >
                      <FontAwesome
                        name={
                          showConfirmPassword
                            ? 'eye-slash'
                            : 'eye'
                        }
                        size={18}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  }
                />

                {/* BOTÓN DE REGISTRO */}
                <Animated.View
                  style={{
                    width: '100%',
                    marginTop: 20,
                    transform: [{ scale: buttonScale }],
                  }}
                >
                  <Pressable
                    style={[
                      styles.primaryButton,
                      loading && { opacity: 0.85 },
                    ]}
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                    onPress={handleSignUp}
                    onLayout={(event) =>
                      setBtnW(event.nativeEvent.layout.width)
                    }
                    disabled={loading}
                  >
                    <Gradient
                      id="btnGrad"
                      from="#0B8A3E"
                      to="#00B04F"
                    />

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
                        <Text style={styles.primaryButtonText}>
                          Registrarse
                        </Text>

                        <FontAwesome
                          name="arrow-right"
                          size={15}
                          color="#FFFFFF"
                        />
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              </Animated.View>

              {/* ACCESO A LOGIN */}
              <Animated.View style={fadeUp(linkAnim, 14)}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  style={styles.loginRow}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loginTextPlain}>
                    ¿Ya tenés cuenta?{' '}
                  </Text>

                  <Text style={styles.loginLinkBold}>
                    Iniciá sesión.
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {/* PARTE INFERIOR DECORATIVA */}
          <View style={styles.footArea}>
            <Leaf
              size={90}
              color={GREEN_DARK}
              rotate={25}
              style={{ left: -10, bottom: -22 }}
              delay={300}
            />

            <Leaf
              size={58}
              color="#168A48"
              rotate={55}
              style={{ left: 56, bottom: -16 }}
              delay={900}
            />

            <Leaf
              size={70}
              color="#2E9E4F"
              rotate={-40}
              style={{ right: -6, bottom: -18 }}
              delay={600}
            />

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
              <Svg
                width={sw}
                height={FOOT_H}
                viewBox={`0 0 ${sw} ${FOOT_H}`}
              >
                <Path
                  d={`M0,0 L${sw},0 L${sw},70 C${sw * 0.7},25 ${sw * 0.35},105 0,55 Z`}
                  fill="#FFFFFF"
                />

                <Path
                  d={footBand(0, 9, sw)}
                  fill={LIME}
                />

                <Path
                  d={footBand(9, 34, sw)}
                  fill={SUN_YELLOW}
                />

                <Path
                  d={footBand(34, 52, sw)}
                  fill={GREEN_MAIN}
                />

                <Path
                  d={footBand(52, 70, sw)}
                  fill={GREEN_DARK}
                  opacity={0.85}
                />
              </Svg>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      {/* MODAL DE ÉXITO: verificación enviada */}
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

            <Text style={styles.modalTitle}>¡Revisá tu correo!</Text>

            <Text style={styles.modalSubtitle}>
              Te enviamos un enlace de verificación a{'\n'}
              <Text style={{ fontWeight: 'bold' }}>{sentTo}</Text>
              {'\n\n'}Abrilo para activar tu cuenta y después iniciá sesión.
              Si no lo ves, revisá la carpeta de spam.
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

      {/* MODAL ÚNICAMENTE PARA ERRORES */}
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
              <FontAwesome
                name="exclamation"
                size={34}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.modalTitle}>
              {errorModal.title}
            </Text>

            <Text style={styles.modalSubtitle}>
              {errorModal.message}
            </Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={closeMessage}
              activeOpacity={0.85}
            >
              <Text style={styles.modalButtonText}>
                Entendido
              </Text>
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
  container: {
    flex: 1,
    backgroundColor: GREEN_DARK,
    ...(Platform.OS === 'web'
      ? { height: '100vh', overflow: 'hidden' }
      : {}),
  },

  scroll: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? { height: '100%', minHeight: 0 }
      : {}),
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
    // -1 para tapar la línea fina que se veía en la unión con las olas
    marginTop: -1,
    marginBottom: -1,
  },

  content: {
    width: '100%',
    alignItems: 'center',
  },

  fieldWrap: {
    width: '100%',
    marginBottom: 4,
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

  dividerGreen: {
    flex: 1,
    backgroundColor: GREEN_MAIN,
  },

  dividerYellow: {
    flex: 1,
    backgroundColor: SUN_YELLOW,
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

  // Fortaleza de contraseña
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

  // Botón
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
    ...(Platform.OS === 'web'
      ? { cursor: 'pointer' }
      : {}),
  },

  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 46,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },

  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },

  // Acceso a Login
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

  // Modal de error
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