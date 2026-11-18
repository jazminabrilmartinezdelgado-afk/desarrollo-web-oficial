// ============================================================
// SignUp.js — Pantalla de registro de Agroquímica del Valle
// ------------------------------------------------------------
// Muestra un formulario (nombre, apellido, correo, contraseña y
// confirmación), lo valida y crea la cuenta en Firebase Auth.
// Después del registro se envía un correo de verificación y se
// lleva al usuario a la pantalla de Login.
// ============================================================

// React y sus hooks:
// - useState: guarda valores que cambian (lo que escribe el usuario, errores, etc.)
// - useRef: guarda valores que NO deben reiniciarse en cada render (animaciones)
// - useEffect: ejecuta código al montar la pantalla o cuando cambia algo
import React, { useState, useRef, useEffect } from 'react';

// Componentes y utilidades de React Native
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

// Íconos de FontAwesome (sobre, candado, ojo, etc.)
import { FontAwesome } from '@expo/vector-icons';

// Funciones de Firebase Authentication
import {
  createUserWithEmailAndPassword, // Crea el usuario con correo y contraseña
  updateProfile, // Guarda el nombre visible del usuario
  sendEmailVerification, // Envía el correo con el link de verificación
  signOut, // Cierra la sesión
} from 'firebase/auth';

// Instancia de autenticación configurada en el proyecto
import { auth } from '../src/config/firebaseConfig';

// Componentes SVG para dibujar las olas, hojas y degradados
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

// ============================================================
// CONSTANTES
// ============================================================

// Paleta de colores de la marca
const GREEN_DARK = '#0d3827'; // Verde oscuro
const GREEN_MAIN = '#008A3B'; // Verde principal
const SUN_YELLOW = '#F5C518'; // Amarillo sol
const LIME = '#B8DD6B'; // Verde lima

// Ancho máximo de la columna central (igual que en Login)
const COLUMN_MAX = 480;

// Curva de animación suave (sale rápido y frena despacio, sin rebotes)
const SMOOTH = Easing.bezier(0.22, 1, 0.36, 1);

// Alto de la zona decorativa superior e inferior (olas)
const TOP_H = 190;
const FOOT_H = 150;

// Largo mínimo y máximo permitido para la contraseña
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 64;

// Nombre/apellido: solo letras (con tildes, ñ y ü) separadas por un espacio
const NAME_REGEX =
  /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:\s[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/;

// Correo permitido: solo @gmail.com o @hotmail.com
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com)$/i;

// Formato general de correo (algo@algo.algo), para dar un mensaje más claro
const GENERIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Contraseña válida: minúscula, mayúscula, número, símbolo, sin espacios
// y entre MIN_PASSWORD y MAX_PASSWORD caracteres
const PASSWORD_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s])\\S{${MIN_PASSWORD},${MAX_PASSWORD}}$`
);

// Reglas de la contraseña. Se usan para:
// 1) calcular la seguridad (barra de colores)
// 2) mostrar las "pastillas" con ✓ debajo de la barra
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

// Lista de todos los campos del formulario (se recorre al validar todo)
const FIELDS = [
  'firstName',
  'lastName',
  'email',
  'password',
  'confirmPassword',
];

// ============================================================
// VALIDACIONES Y FUNCIONES AUXILIARES
// ============================================================

// Quita todo lo que no sea letra o espacio (se usa en nombre y apellido)
const onlyLetters = (text) => text.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '');

// Devuelve el error del nombre o apellido ('' si está bien).
// "campo" es la palabra que aparece en el mensaje ("nombre" / "apellido")
const getNameError = (value, campo) => {
  const v = value.trim();

  if (!v) return `El ${campo} es obligatorio.`;
  if (v.length < 2) return `El ${campo} debe tener al menos 2 letras.`;
  if (!NAME_REGEX.test(v)) {
    return `El ${campo} solo puede contener letras y espacios.`;
  }

  return '';
};

// Devuelve el error del correo ('' si está bien)
const getEmailError = (value) => {
  const email = value.trim();

  if (!email) return 'El correo es obligatorio.';

  // Primero revisamos el formato general...
  if (!GENERIC_EMAIL_REGEX.test(email)) {
    return 'El formato del correo no es válido. Ejemplo: nombre@gmail.com o nombre@hotmail.com';
  }

  // ...y después que sea de Gmail o Hotmail
  if (!EMAIL_REGEX.test(email)) {
    return 'Use un correo @gmail.com o @hotmail.com.';
  }

  return '';
};

// Devuelve el error de UN campo según su nombre.
// "values" trae todos los valores del formulario porque la
// confirmación necesita comparar con la contraseña.
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
      // Mensaje corto: el detalle de qué falta ya lo muestran las pastillas
      if (!PASSWORD_REGEX.test(values.password)) {
        return 'La contraseña no cumple todos los requisitos.';
      }
      return '';

    case 'confirmPassword':
      if (!values.confirmPassword) return 'Confirme su contraseña.';
      if (values.password !== values.confirmPassword) {
        return 'Las contraseñas no coinciden.';
      }
      return '';

    default:
      return '';
  }
};

// Calcula qué tan segura es la contraseña según cuántas reglas cumple
const getPasswordStrength = (password) => {
  // Cantidad de reglas cumplidas (0 a 5)
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;

  // Valores por defecto (ninguna regla cumplida)
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

// Dibuja una "banda" ondulada de la parte superior.
// start/end desplazan la onda a la izquierda/derecha; sw es el ancho total.
const topBand = (start, end, sw) =>
  `M0,${80 + start}
   C${sw * 0.25},${15 + start}
   ${sw * 0.7},${95 + end}
   ${sw},${120 + end}
   L${sw},${148 + end}
   C${sw * 0.68},${123 + end}
   ${sw * 0.28},${73 + start}
   0,${136 + start} Z`;

// Igual que topBand, pero para las olas de la parte inferior
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

// Fondo con degradado vertical verde muy claro, ocupa toda la pantalla
function Background() {
  return (
    // pointerEvents="none": el fondo no bloquea los toques
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none" // se estira para cubrir toda la pantalla
      >
        <Defs>
          {/* Degradado de arriba (y1=0) hacia abajo (y2=1) */}
          <LinearGradient id="backgroundGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#EAF4E7" />
            <Stop offset="1" stopColor="#F8FAF7" />
          </LinearGradient>
        </Defs>

        {/* Rectángulo que pinta todo con el degradado */}
        <Path d="M0,0 H100 V100 H0 Z" fill="url(#backgroundGradient)" />
      </Svg>
    </View>
  );
}

// ============================================================
// COMPONENTE DE HOJAS DECORATIVAS
// ============================================================

// Hoja que flota suavemente hacia arriba y abajo.
// Props: tamaño, color, rotación, posición (style) y retraso de la animación
function Leaf({ size = 60, color = GREEN_MAIN, rotate = 0, style, delay = 0 }) {
  // Valor animado que va de 0 a 1 y vuelve
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // La espera inicial va fuera del bucle (así no pausa en cada vuelta)
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

    // Al salir de la pantalla se detiene la animación
    return () => animation.stop();
  }, [anim, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size },
        style, // posición que llega por props (left, top, etc.)
        {
          transform: [
            { rotate: `${rotate}deg` },
            // Se mueve 5px hacia arriba cuando anim = 1
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

// Campo de formulario reutilizable: etiqueta + caja con ícono + input
// + control opcional a la derecha (ej. ojito) + mensaje de error.
// ...inputProps pasa el resto de props directo al TextInput.
function Field({
  label,
  icon,
  value,
  onChangeText,
  error,
  right,
  onBlur,
  onFocus,
  ...inputProps
}) {
  // Saber si el campo está enfocado para pintar el borde verde
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      {/* Etiqueta del campo */}
      <Text style={styles.label}>{label}</Text>

      {/* Caja del input. Color del borde: rojo si hay error,
          verde si está enfocado, gris en cualquier otro caso */}
      <View
        style={[
          styles.inputBox,
          {
            borderColor: error ? '#DC2626' : focused ? GREEN_MAIN : '#D1D5DB',
          },
        ]}
      >
        {/* Ícono de la izquierda (rojo si hay error) */}
        <FontAwesome
          name={icon}
          size={17}
          color={error ? '#DC2626' : GREEN_MAIN}
          style={styles.inputIcon}
        />

        <TextInput
          // outlineStyle 'none' quita el marco negro que pone el navegador en web
          style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' }]}
          value={value}
          onChangeText={onChangeText}
          // Al enfocar: marcamos foco y avisamos al padre si lo pidió
          onFocus={(e) => {
            setFocused(true);
            onFocus && onFocus(e);
          }}
          // Al salir del campo: quitamos foco y avisamos al padre
          // (el padre usa esto para validar recién cuando termina de escribir)
          onBlur={(e) => {
            setFocused(false);
            onBlur && onBlur(e);
          }}
          placeholderTextColor="#9CA3AF"
          {...inputProps}
        />

        {/* Control de la derecha (solo si se pasó) */}
        {right ? <View style={styles.rightControl}>{right}</View> : null}
      </View>

      {/* Mensaje de error debajo del campo (solo si existe) */}
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

// Degradado horizontal (de izquierda a derecha) que cubre todo el botón
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

export default function SignUp({ navigation }) {
  // Tamaño actual de la ventana
  const { width, height } = useWindowDimensions();

  // Modo compacto para pantallas bajas (achica logo y título)
  const compact = height < 700;

  // Ancho real de la columna (igual que en Login) + margen extra
  // para que las olas se muevan sin mostrar los bordes
  const W = Math.min(width || 400, COLUMN_MAX);
  const PAD = 24;
  const sw = W + PAD * 2; // ancho de los SVG de olas
  const logoH = compact ? 80 : 100; // alto del logo

  // ---------- Valores del formulario ----------
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Todos los valores juntos (se pasan a getFieldError)
  const values = { firstName, lastName, email, password, confirmPassword };

  // Mostrar u ocultar las contraseñas (ojito)
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // true mientras se está creando la cuenta en Firebase
  const [loading, setLoading] = useState(false);

  // Errores por campo, ej: { email: 'El correo es obligatorio.' }
  const [errors, setErrors] = useState({});

  // Ancho del botón (para saber hasta dónde recorre el brillo)
  const [btnW, setBtnW] = useState(360);

  // ---------- Modal de errores ----------
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: '',
    message: '',
  });

  // Abre el modal de error con un título y un mensaje
  const showMessage = (title, message) => {
    setErrorModal({ visible: true, title, message });
  };

  // Cierra el modal de error (conserva el texto para que no parpadee)
  const closeMessage = () => {
    setErrorModal((prev) => ({ ...prev, visible: false }));
  };

  // ---------- Modal de éxito ----------
  const [successVisible, setSuccessVisible] = useState(false);
  const [sentTo, setSentTo] = useState(''); // correo al que se envió el link

  // ---------- Valores animados ----------
  // Animaciones de entrada (van de 0 a 1 una sola vez)
  const headerAnim = useRef(new Animated.Value(0)).current; // olas de arriba
  const footerAnim = useRef(new Animated.Value(0)).current; // olas de abajo
  const logoAnim = useRef(new Animated.Value(0)).current; // logo
  const titleAnim = useRef(new Animated.Value(0)).current; // título
  const formAnim = useRef(new Animated.Value(0)).current; // formulario
  const linkAnim = useRef(new Animated.Value(0)).current; // link a Login
  const dividerAnim = useRef(new Animated.Value(0)).current; // línea verde/amarilla

  // Animaciones continuas o de interacción
  const floatAnim = useRef(new Animated.Value(0)).current; // logo flotando
  const waveDrift = useRef(new Animated.Value(0)).current; // olas moviéndose
  const shimmer = useRef(new Animated.Value(0)).current; // brillo del botón
  const buttonScale = useRef(new Animated.Value(1)).current; // botón al presionar
  const shakeAnim = useRef(new Animated.Value(0)).current; // temblor por error
  const strengthAnim = useRef(new Animated.Value(0)).current; // barra de seguridad

  // Seguridad calculada de la contraseña actual
  const passwordStrength = getPasswordStrength(password);

  // ---------- Ajuste de altura en web ----------
  // En navegador, html/body/#root necesitan 100% de alto para que
  // el ScrollView funcione bien. Se agrega un <style> y se quita al salir.
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

  // ---------- Animaciones de entrada y movimiento ----------
  useEffect(() => {
    // Atajo: anima un valor de 0 a 1 con retraso y duración
    const animateIn = (value, delay = 0, duration = 750) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        delay,
        easing: SMOOTH,
        useNativeDriver: true,
      });

    // Entrada escalonada de todos los elementos
    Animated.parallel([
      animateIn(headerAnim, 0, 1000),
      animateIn(footerAnim, 100, 1000),
      animateIn(logoAnim, 200, 900),
      animateIn(titleAnim, 350),
      animateIn(formAnim, 450, 850),
      animateIn(linkAnim, 700),
      animateIn(dividerAnim, 550, 800),
    ]).start();

    // Logo flotando (sube y baja sin parar)
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

    // Olas que se desplazan de lado a lado
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

    // Brillo que cruza el botón cada tanto
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

    // Al salir de la pantalla se frenan los bucles
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

  // ---------- Barra de seguridad ----------
  // Cada vez que cambia la cantidad de reglas cumplidas,
  // la barra se llena suavemente hasta el nuevo porcentaje
  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: (passwordStrength.passed / PASSWORD_RULES.length) * 100,
      duration: 420,
      easing: SMOOTH,
      useNativeDriver: false, // el ancho no se puede animar con el driver nativo
    }).start();
  }, [passwordStrength.passed, strengthAnim]);

  // Estilo reutilizable: aparece desvaneciéndose y subiendo "distance" px
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

  // Temblor horizontal del formulario cuando hay errores
  const runShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 9, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Botón se achica un poco al presionarlo...
  const pressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  };

  // ...y vuelve a su tamaño al soltarlo
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
  // Cómo funciona:
  // - Mientras escribe (onChangeText): solo se BORRA el error de ese campo.
  // - Cuando sale del campo (onBlur): recién ahí se valida y aparece el error.
  // - Al tocar "Registrarse": se validan todos los campos juntos.

  // Valida TODOS los campos. Devuelve true si no hay errores.
  const validate = () => {
    const validationErrors = {};

    FIELDS.forEach((field) => {
      const message = getFieldError(field, values);
      if (message) validationErrors[field] = message;
    });

    setErrors(validationErrors);

    return Object.keys(validationErrors).length === 0;
  };

  // Valida UN campo cuando el usuario sale de él (terminó de escribir)
  const validateOnBlur = (field) => {
    // Si el campo quedó vacío no mostramos "obligatorio" todavía;
    // eso se avisa recién al tocar "Registrarse"
    if (!values[field].trim()) return;

    const message = getFieldError(field, values);

    setErrors((prev) => ({ ...prev, [field]: message || undefined }));
  };

  // Borra el error de un campo (se usa mientras escribe)
  const clearError = (field) => {
    setErrors((prev) => {
      // Si no había error, devolvemos el mismo objeto (evita un render extra)
      if (!prev[field]) return prev;

      return { ...prev, [field]: undefined };
    });
  };

  // ==========================================================
  // REGISTRO CON FIREBASE
  // ==========================================================

  const handleSignUp = async () => {
    // Evita doble envío si ya se está procesando
    if (loading) return;

    // Si algún campo es inválido, mostramos errores y sacudimos el formulario
    if (!validate()) {
      runShake();
      return;
    }

    setLoading(true);

    // Correo sin espacios y en minúsculas
    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1) Crear el usuario en Firebase
      const credential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      // 2) Guardar nombre y apellido en el perfil de Firebase.
      //    Si falla no cortamos el registro, solo lo registramos en consola.
      try {
        await updateProfile(credential.user, {
          displayName: `${firstName.trim()} ${lastName.trim()}`,
        });
      } catch (profileError) {
        console.error('No se pudo guardar el nombre visible:', profileError);
      }

      // 3) ENLACE DE VERIFICACIÓN: Firebase envía un correo con un link.
      //    Mientras no lo abra, Navigation no deja entrar a Home.
      try {
        await sendEmailVerification(credential.user);
      } catch (verifyError) {
        console.error('No se pudo enviar la verificación:', verifyError);
      }

      // 4) Mostrar el modal de éxito
      setSentTo(cleanEmail);
      setErrors({});
      setSuccessVisible(true);
    } catch (error) {
      console.error('Error de registro:', error.code, error.message);

      // Mensaje por defecto si el error no es conocido
      let errorMessage = 'Hubo un problema al registrar el usuario.';

      // Si es true, el error se muestra debajo del campo y no en el modal
      let inlineOnly = false;

      // Traducimos los códigos de Firebase a mensajes claros
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage =
            'Este correo ya está registrado. Inicie sesión o use otro correo.';
          // Este se muestra debajo del campo de correo
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
          errorMessage = 'Error de conexión. Por favor, intenta más tarde.';
          break;

        case 'auth/too-many-requests':
          errorMessage =
            'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
          break;

        case 'auth/operation-not-allowed':
          errorMessage = 'El registro con correo no está habilitado en Firebase.';
          break;

        case 'auth/invalid-api-key':
          errorMessage =
            'La clave API de Firebase no es válida. Revisa su configuración.';
          break;

        default:
          // Error desconocido: agregamos el código para poder depurarlo
          errorMessage += `\n\nCódigo: ${error.code || 'desconocido'}`;
      }

      if (!inlineOnly) {
        showMessage('No se pudo registrar', errorMessage);
      } else {
        runShake();
      }
    } finally {
      // Pase lo que pase, se quita la ruedita de carga
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

  // Desplazamiento horizontal de las olas de arriba (izquierda ↔ derecha)
  const driftX = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-PAD * 0.7, PAD * 0.7],
  });

  // Olas de abajo: mismo movimiento pero en sentido contrario
  const driftXInv = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD * 0.7, -PAD * 0.7],
  });

  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    // En iOS empuja el contenido hacia arriba cuando aparece el teclado
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Barra de estado transparente con íconos claros */}
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Fondo degradado */}
      <Background />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" // permite tocar botones con el teclado abierto
        bounces={false} // sin rebote en iOS
      >
        {/* Columna central con ancho máximo */}
        <View style={styles.column}>
          {/* ================= PARTE SUPERIOR DECORATIVA ================= */}
          <View style={styles.topArea}>
            {/* Hojas de la esquina superior */}
            <Leaf size={96} color={GREEN_DARK} rotate={-35} style={{ left: -14, top: -18 }} />
            <Leaf size={64} color="#168A48" rotate={-70} style={{ left: 38, top: -22 }} delay={400} />
            <Leaf size={84} color="#0f6b34" rotate={50} style={{ right: -8, top: 6 }} delay={700} />
            <Leaf size={52} color="#2E9E4F" rotate={80} style={{ right: 62, top: -14 }} delay={200} />

            {/* Olas superiores (aparecen y se mueven de lado a lado) */}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: headerAnim,
                  transform: [{ translateX: driftX }],
                  left: -PAD, // arranca un poco antes para no mostrar el borde
                  width: sw,
                },
              ]}
            >
              <Svg width={sw} height={TOP_H} viewBox={`0 0 ${sw} ${TOP_H}`}>
                {/* Banda verde oscura */}
                <Path d={topBand(-62, -40, sw)} fill={GREEN_DARK} opacity={0.92} />
                {/* Banda verde principal */}
                <Path d={topBand(-40, -7, sw)} fill={GREEN_MAIN} />
                {/* Banda lima */}
                <Path d={topBand(-7, 0, sw)} fill={LIME} />
                {/* Zona blanca que se une con el formulario */}
                <Path
                  d={`M0,${TOP_H} L0,70 C${sw * 0.35},25 ${sw * 0.65},85 ${sw},135 L${sw},${TOP_H} Z`}
                  fill="#FFFFFF"
                />
                {/* Detalle amarillo a la izquierda */}
                <Path
                  d={`M0,100 C${sw * 0.1},78 ${sw * 0.22},62 ${sw * 0.36},56 C${sw * 0.2},84 ${sw * 0.08},124 0,178 Z`}
                  fill={SUN_YELLOW}
                />
              </Svg>
            </Animated.View>
          </View>

          {/* ======================== FORMULARIO ======================== */}
          <View style={styles.body}>
            <View style={styles.content}>
              {/* ---------- LOGO (aparece agrandándose y flota) ---------- */}
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

              {/* ---------- TÍTULO, SUBTÍTULO Y LÍNEA ---------- */}
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

                <Text style={styles.subtitle}>Registrate en Agroquímica del Valle</Text>

                {/* Línea verde/amarilla que se "abre" desde el centro */}
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

              {/* ---------- CAMPOS (aparecen subiendo y tiemblan si hay error) ---------- */}
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
                    setFirstName(onlyLetters(text)); // solo letras
                    clearError('firstName'); // mientras escribe, sin error
                  }}
                  onBlur={() => validateOnBlur('firstName')} // valida al salir
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
                  onBlur={() => validateOnBlur('lastName')}
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
                  placeholder="ejemplo@gmail.com o ejemplo@hotmail.com"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text.replace(/\s/g, '')); // sin espacios
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
                />

                {/* CONTRASEÑA */}
                <Field
                  label="Contraseña"
                  icon="lock"
                  placeholder="Cree una contraseña segura"
                  value={password}
                  onChangeText={(text) => {
                    const cleanPassword = text.replace(/\s/g, ''); // sin espacios

                    setPassword(cleanPassword);
                    clearError('password');

                    // Si ahora coincide con la confirmación, quitamos ese error
                    if (confirmPassword && cleanPassword === confirmPassword) {
                      clearError('confirmPassword');
                    }
                  }}
                  onBlur={() => {
                    validateOnBlur('password');
                    // Si ya había escrito la confirmación, la revisamos de nuevo
                    validateOnBlur('confirmPassword');
                  }}
                  error={errors.password}
                  maxLength={MAX_PASSWORD}
                  secureTextEntry={!showPassword} // oculta el texto
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  right={
                    // Ojito para mostrar/ocultar la contraseña
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

                {/* Pista de requisitos: solo cuando el campo está vacío.
                    Al empezar a escribir la reemplazan las pastillas de abajo,
                    así no se repite la misma información dos veces. */}
                {!password && !errors.password && (
                  <Text style={styles.hintText}>
                    Mínimo {MIN_PASSWORD} caracteres, una mayúscula, una minúscula,
                    un número y un carácter especial. Sin espacios.
                  </Text>
                )}

                {/* ---------- MEDIDOR DE SEGURIDAD ---------- */}
                {password.length > 0 && (
                  <View style={styles.strengthBox}>
                    {/* Texto + nivel (Débil, Media, Fuerte...) */}
                    <View style={styles.strengthHeader}>
                      <Text style={styles.strengthText}>Seguridad de la contraseña:</Text>
                      <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                        {passwordStrength.label}
                      </Text>
                    </View>

                    {/* Barra que se llena según las reglas cumplidas */}
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

                    {/* Pastillas: una por regla, con ✓ verde si se cumple */}
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

                {/* CONFIRMAR CONTRASEÑA */}
                <Field
                  label="Confirmar contraseña"
                  icon="lock"
                  placeholder="Repita su contraseña"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text.replace(/\s/g, ''));
                    clearError('confirmPassword'); // sin error mientras escribe
                  }}
                  onBlur={() => validateOnBlur('confirmPassword')} // compara al salir
                  error={errors.confirmPassword}
                  maxLength={MAX_PASSWORD}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  onSubmitEditing={handleSignUp} // Enter = registrarse
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

                {/* ---------- BOTÓN DE REGISTRO ---------- */}
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
                    // Guardamos el ancho real para el recorrido del brillo
                    onLayout={(event) => setBtnW(event.nativeEvent.layout.width)}
                    disabled={loading}
                  >
                    {/* Fondo degradado del botón */}
                    <Gradient id="btnGrad" from="#0B8A3E" to="#00B04F" />

                    {/* Brillo diagonal que cruza el botón (oculto mientras carga) */}
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

                    {/* Ruedita mientras carga, si no texto + flecha */}
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

              {/* ---------- LINK A LOGIN ---------- */}
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

          {/* ================= PARTE INFERIOR DECORATIVA ================= */}
          <View style={styles.footArea}>
            {/* Hojas de la parte de abajo */}
            <Leaf size={90} color={GREEN_DARK} rotate={25} style={{ left: -10, bottom: -22 }} delay={300} />
            <Leaf size={58} color="#168A48" rotate={55} style={{ left: 56, bottom: -16 }} delay={900} />
            <Leaf size={70} color="#2E9E4F" rotate={-40} style={{ right: -6, bottom: -18 }} delay={600} />

            {/* Olas inferiores (se mueven al revés que las de arriba) */}
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
                {/* Zona blanca que continúa el formulario */}
                <Path
                  d={`M0,0 L${sw},0 L${sw},70 C${sw * 0.7},25 ${sw * 0.35},105 0,55 Z`}
                  fill="#FFFFFF"
                />
                {/* Bandas de colores, de arriba hacia abajo */}
                <Path d={footBand(0, 9, sw)} fill={LIME} />
                <Path d={footBand(9, 34, sw)} fill={SUN_YELLOW} />
                <Path d={footBand(34, 52, sw)} fill={GREEN_MAIN} />
                <Path d={footBand(52, 70, sw)} fill={GREEN_DARK} opacity={0.85} />
              </Svg>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      {/* ================= MODAL DE ÉXITO ================= */}
      {/* Avisa que se envió el correo de verificación */}
      <Modal
        animationType="fade"
        transparent
        visible={successVisible}
        onRequestClose={closeSuccess} // botón "atrás" de Android
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Círculo verde con sobre */}
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

      {/* ================= MODAL DE ERROR ================= */}
      {/* Errores de Firebase que no van debajo de un campo */}
      <Modal
        animationType="fade"
        transparent
        visible={errorModal.visible}
        onRequestClose={closeMessage}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Círculo rojo con signo de exclamación */}
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
  // ---------- Estructura general ----------

  // Contenedor de toda la pantalla
  container: {
    flex: 1,
    backgroundColor: GREEN_DARK,
    // En web ocupa exactamente el alto de la ventana
    ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}),
  },

  // ScrollView
  scroll: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100%', minHeight: 0 } : {}),
  },

  // Contenido del ScrollView: crece para llenar la pantalla
  scrollContainer: {
    flexGrow: 1,
  },

  // Columna central con ancho máximo
  column: {
    flexGrow: 1,
    width: '100%',
    maxWidth: COLUMN_MAX,
    alignSelf: 'center',
  },

  // Zona de olas de arriba
  topArea: {
    height: TOP_H,
    width: '100%',
    overflow: 'hidden', // recorta las hojas/olas que se salen
  },

  // Zona de olas de abajo
  footArea: {
    height: FOOT_H,
    width: '100%',
    overflow: 'hidden',
  },

  // Fondo blanco del formulario
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

  // Contenido centrado dentro del body
  content: {
    width: '100%',
    alignItems: 'center',
  },

  // ---------- Encabezado ----------

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

  // Línea decorativa verde/amarilla
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

  // ---------- Campos ----------

  // Contenedor de cada campo
  fieldWrap: {
    width: '100%',
    marginBottom: 4,
  },

  // Etiqueta sobre el campo
  label: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    marginTop: 8,
  },

  // Caja con borde que contiene ícono + input
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

  // Ícono a la izquierda del input
  inputIcon: {
    width: 26,
    marginRight: 6,
  },

  // Texto que escribe el usuario
  input: {
    flex: 1,
    color: '#1F2937',
    fontSize: 14,
    minHeight: 50,
    paddingVertical: 8,
  },

  // Control a la derecha (ojito)
  rightControl: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Fila del mensaje de error (ícono + texto)
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

  // Pista gris de requisitos de la contraseña
  hintText: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 5,
  },

  // ---------- Seguridad de la contraseña ----------

  // Caja gris que contiene barra + pastillas
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

  // Fila con "Seguridad de la contraseña:" y el nivel
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

  // Fondo gris de la barra
  strengthBarBackground: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },

  // Parte coloreada de la barra
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Contenedor de las pastillas (pasan a otra línea si no entran)
  rulesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },

  // Pastilla de regla no cumplida
  rulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },

  // Pastilla de regla cumplida (fondo verde claro)
  rulePillOk: {
    backgroundColor: '#DCFCE7',
  },

  ruleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },

  // ---------- Botón "Registrarse" (más compacto) ----------

  primaryButton: {
    height: 46, // antes 52
    borderRadius: 14, // antes 16
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // recorta el degradado y el brillo
    backgroundColor: GREEN_MAIN,
    // Sombra (iOS) más suave para el tamaño nuevo
    shadowColor: GREEN_MAIN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5, // sombra en Android
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },

  // Franja blanca semitransparente del brillo
  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 40,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },

  // Texto + flecha en fila
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15, // antes 17
    fontWeight: 'bold',
  },

  // ---------- Link a Login ----------

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

  // ---------- Modales ----------

  // Fondo oscuro semitransparente detrás del modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Tarjeta blanca del modal
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    elevation: 10,
  },

  // Círculo del ícono (rojo por defecto; verde en el de éxito)
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

  // Botón del modal
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