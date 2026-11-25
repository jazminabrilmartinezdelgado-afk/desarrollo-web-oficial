import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StatusBar,
  Image,
  Platform,
  Animated,
  Easing,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
// SafeAreaView de react-native está en desuso: se usa el de react-native-safe-area-context
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { auth, db } from '../src/config/firebaseConfig';
import { useTheme } from '../src/theme/ThemeContext';

// =========================================================================
// CONSTANTES Y PALETA CORPORATIVA (misma que Home y Proveedores)
// =========================================================================
// Bordes seguros solo en iPhone (igual que el SafeAreaView anterior)
const SAFE_EDGES = Platform.OS === 'ios' ? ['top', 'right', 'bottom', 'left'] : [];

const GREEN_DARK = '#0d3827';
const GREEN_MAIN = '#008A3B';
const GOLD_YELLOW = '#CAB118';
const GOLD_PILL = '#FACC15';
const DARK = '#111827';
const PAGE_BG = '#F3F7F4';

// Colección de Firestore donde se guardan los datos extra del usuario
// [S5-01] Colección "usuarios": un documento por persona con los datos de su perfil.
const COLLECTION = 'usuarios';

// Firestore permite 1 MB por documento: limitamos la foto en base64
const MAX_IMAGE_BASE64 = 700000;

// Mismas reglas que en el registro (SignUp)
const NAME_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:\s[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/;
const SALTA_PHONE_PREFIX = '+54 9 387 ';
const SALTA_PHONE_REGEX = /^\+54\s9\s387\s\d{7}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,64}$/;

const MIN_PASSWORD = 8;

const PASSWORD_RULES = [
  { key: 'len', label: '8+ caracteres', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'Mayúscula', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Minúscula', test: (p) => /[a-z]/.test(p) },
  { key: 'num', label: 'Número', test: (p) => /\d/.test(p) },
  { key: 'sym', label: 'Carácter especial', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

// Calcula qué tan segura es la contraseña (igual que en el registro)
const getPasswordStrength = (password) => {
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
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
  return { passed, label, color };
};

// Devuelve el error de un campo de contraseña ('' si está bien).
// Mismos mensajes que en el registro, más los propios del cambio de contraseña.
const getPwdError = (key, pwd) => {
  switch (key) {
    case 'actual':
      if (!pwd.actual) return 'Ingrese su contraseña actual.';
      return '';
    case 'nueva':
      if (!pwd.nueva) return 'La contraseña es obligatoria.';
      if (!PASSWORD_REGEX.test(pwd.nueva)) return 'La contraseña no cumple todos los requisitos.';
      if (pwd.actual && pwd.nueva === pwd.actual) return 'Debe ser distinta a la actual.';
      return '';
    case 'confirmar':
      if (!pwd.confirmar) return 'Confirme su contraseña.';
      if (!pwd.nueva) return 'Primero ingrese la contraseña.';
      if (pwd.nueva !== pwd.confirmar) return 'Las contraseñas no coinciden.';
      return '';
    default:
      return '';
  }
};

// Devuelve los estilos del tema actual (se recalculan solo al cambiar de tema)
const useStyles = () => {
  const { colors } = useTheme();
  return React.useMemo(() => makeStyles(colors), [colors]);
};

const onlyLetters = (text) => text.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '');

// Separa "Nombre Apellido" guardado en displayName
const splitName = (full = '') => {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nombre: parts[0] || '', apellido: '' };
  return { nombre: parts.slice(0, -1).join(' '), apellido: parts[parts.length - 1] };
};

const getInitials = (nombre, apellido, email) => {
  const a = (nombre || '').trim().charAt(0);
  const b = (apellido || '').trim().charAt(0);
  const ini = `${a}${b}`.toUpperCase();
  return ini || (email ? email.charAt(0).toUpperCase() : '?');
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const mapPasswordError = (code) => {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'La contraseña actual es incorrecta.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espere unos minutos.';
    case 'auth/network-request-failed':
      return 'Error de conexión. Intente nuevamente.';
    case 'auth/weak-password':
      return 'La nueva contraseña es demasiado débil.';
    default:
      return 'No se pudo cambiar la contraseña.';
  }
};

// =========================================================================
// DEGRADADO CON SVG
// =========================================================================
// Se mide el tamaño real del contenedor: en Android el "100%" a veces
// no cubre todo el fondo (quedaba una franja sin color)
function Gradient({ id, from, to }) {
  const [size, setSize] = useState(null);
  const w = size ? size.width : '100%';
  const h = size ? size.height : '100%';
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      <Svg width={w} height={h} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={w} height={h} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

// =========================================================================
// CAMPO DE TEXTO (mismo estilo que el formulario de Proveedores)
// =========================================================================
function Field({ label, icon, error, editable = true, right, onBlur, inputRef, ...props }) {
  const styles = useStyles();
  const { colors: c, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? '#EF4444' : focused ? c.greenMain : c.border;
  const backgroundColor = !editable
    ? c.surfaceAlt
    : error
    ? (isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2')
    : focused
    ? c.surface
    : c.surfaceAlt;

  return (
    <View style={{ width: '100%', marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputBox, { borderColor, backgroundColor }]}>
        <FontAwesome
          name={icon}
          size={16}
          color={error ? '#EF4444' : focused ? c.greenMain : '#9CA3AF'}
          style={styles.inputIcon}
        />
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            !editable && { color: c.textMuted },
            Platform.OS === 'web' && { outlineStyle: 'none' },
          ]}
          placeholderTextColor="#9CA3AF"
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            onBlur && onBlur(e);
          }}
          {...props}
        />
        {right}
      </View>
      {!!error && (
        <View style={styles.errorRow}>
          <FontAwesome name="exclamation-circle" size={12} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

// Botón principal verde con efecto de presión
function PrimaryButton({ title, icon, onPress, loading, variant = 'primary' }) {
  const styles = useStyles();
  const { colors: c } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const danger = variant === 'danger';
  const outline = variant === 'outline';

  return (
    <Animated.View style={{ transform: [{ scale }], width: '100%' }}>
      <Pressable
        onPress={onPress}
        disabled={loading}
        android_ripple={{ color: danger ? 'rgba(220,38,38,0.15)' : outline ? 'rgba(0,138,59,0.12)' : 'rgba(255,255,255,0.25)', foreground: true }} // onda al tocar (Android)
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start()}
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start()
        }
        style={[
          styles.btn,
          danger && styles.btnDanger,
          outline && styles.btnOutline,
          loading && { opacity: 0.7 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={outline ? c.greenMain : '#FFFFFF'} />
        ) : (
          <>
            {!!icon && (
              <FontAwesome
                name={icon}
                size={15}
                color={danger ? '#DC2626' : outline ? c.greenMain : '#FFFFFF'}
              />
            )}
            <Text
              style={[
                styles.btnText,
                danger && { color: '#DC2626' },
                outline && { color: c.greenMain },
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

// =========================================================================
// PANTALLA MI PERFIL
// =========================================================================
// [S5-02] Pantalla Mi Perfil.
export default function Perfil({ navigation }) {
  const styles = useStyles();
  const { colors: c, isDark, toggleTheme } = useTheme();
  const user = auth.currentUser;

  // ---------- Estado de datos personales ----------
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ nombre: '', apellido: '', telefono: '', foto: '' });
  const [form, setForm] = useState(profile);
  const [errors, setErrors] = useState({});

  // ---------- Estado de cambio de contraseña ----------
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState({ actual: '', nueva: '', confirmar: '' });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdSaving, setPwdSaving] = useState(false);
  // Un ojito por campo, como en el registro
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [resetSending, setResetSending] = useState(false); // enviando correo de recuperación

  // Ventana para confirmar el cierre de sesión
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Tecla "Siguiente": pasa al campo de abajo sin tocar la pantalla
  const apellidoRef = useRef(null);
  const telefonoRef = useRef(null);
  const nuevaRef = useRef(null);
  const confirmarRef = useRef(null);

  // Barra de seguridad de la nueva contraseña
  const strength = getPasswordStrength(pwd.nueva);
  const strengthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: (strength.passed / PASSWORD_RULES.length) * 100,
      duration: 420,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [strength.passed]);

  // ---------- Toast ----------
  const [toast, setToast] = useState({ msg: '', type: 'ok' });
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  // ---------- Animación de entrada ----------
  const enter = useRef(new Animated.Value(0)).current;

  const showToast = (msg, type = 'ok') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    Animated.spring(toastAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }, 2600);
  };

  // ---------- LECTURA: datos de Auth + documento usuarios/{uid} ----------
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (!user) return;
    const base = splitName(user.displayName || '');

    (async () => {
      let data = {};
      try {
        const snap = await getDoc(doc(db, COLLECTION, user.uid));
        if (snap.exists()) data = snap.data();
      } catch (err) {
        console.error('Error al leer el perfil:', err);
        showToast('No se pudieron cargar algunos datos del perfil', 'error');
      }
      const loaded = {
        nombre: data.nombre || base.nombre,
        apellido: data.apellido || base.apellido,
        telefono: data.telefono || '',
        foto: data.foto || '',
      };
      setProfile(loaded);
      setForm(loaded);
      setLoading(false);
    })();

    return () => clearTimeout(toastTimer.current);
  }, []);

  // ---------- EDICIÓN DE CAMPOS ----------
  const setField = (key) => (value) => {
    let v = value;
    if (key === 'nombre' || key === 'apellido') v = onlyLetters(value);
    if (key === 'telefono') {
      // Mantiene el prefijo de Salta y acepta solo 7 dígitos
      if (!value) v = '';
      else {
        const digits = value.replace(SALTA_PHONE_PREFIX, '').replace(/\D/g, '').slice(0, 7);
        v = SALTA_PHONE_PREFIX + digits;
      }
    }
    setForm((f) => ({ ...f, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const startEdit = () => {
    setForm({ ...profile, telefono: profile.telefono || SALTA_PHONE_PREFIX });
    setErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    setForm(profile);
    setErrors({});
    setEditing(false);
  };

  const validate = () => {
    const e = {};
    const n = form.nombre.trim();
    const a = form.apellido.trim();
    const t = form.telefono.trim();

    if (!n) e.nombre = 'El nombre es obligatorio.';
    else if (n.length < 2) e.nombre = 'El nombre debe tener al menos 2 letras.';
    else if (!NAME_REGEX.test(n)) e.nombre = 'El nombre solo puede contener letras y espacios.';

    if (!a) e.apellido = 'El apellido es obligatorio.';
    else if (a.length < 2) e.apellido = 'El apellido debe tener al menos 2 letras.';
    else if (!NAME_REGEX.test(a)) e.apellido = 'El apellido solo puede contener letras y espacios.';

    // Teléfono opcional: si se completa, debe ser de Salta
    if (t && t !== SALTA_PHONE_PREFIX.trim() && !SALTA_PHONE_REGEX.test(t)) {
      e.telefono = 'Ingrese un número de Salta: +54 9 387 XXXXXXX.';
    }
    return e;
  };

  // ---------- ACTUALIZACIÓN: Auth (displayName) + Firestore ----------
  // [S5-03] Guarda el nombre, el apellido y el teléfono.
  const saveProfile = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const tel = SALTA_PHONE_REGEX.test(form.telefono.trim()) ? form.telefono.trim() : '';
    const data = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      telefono: tel,
      foto: form.foto,
    };

    try {
      await updateProfile(user, { displayName: `${data.nombre} ${data.apellido}` });
      await setDoc(
        doc(db, COLLECTION, user.uid),
        { ...data, email: user.email, fechaActualizacion: serverTimestamp() },
        { merge: true }
      );
      setProfile(data);
      setForm(data);
      setEditing(false);
      showToast('Perfil actualizado correctamente');
    } catch (err) {
      console.error('Error al guardar el perfil:', err);
      showToast('No se pudo guardar el perfil', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---------- FOTO DE PERFIL (expo-image-picker) ----------
  // [S5-04] Cambiar la foto de perfil desde la galería.
  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast('Necesitamos permiso para acceder a sus fotos', 'error');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
        base64: true,
      });
      if (res.canceled) return;

      const asset = res.assets[0];
      if (!asset.base64 || asset.base64.length > MAX_IMAGE_BASE64) {
        showToast('La imagen es muy pesada. Elija otra más liviana.', 'error');
        return;
      }
      const foto = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;

      // La foto se guarda al instante, sin necesidad de pulsar "Guardar"
      await setDoc(
        doc(db, COLLECTION, user.uid),
        { foto, email: user.email, fechaActualizacion: serverTimestamp() },
        { merge: true }
      );
      setProfile((p) => ({ ...p, foto }));
      setForm((f) => ({ ...f, foto }));
      showToast('Foto de perfil actualizada');
    } catch (err) {
      console.error('Error con la foto de perfil:', err);
      showToast('No se pudo actualizar la foto', 'error');
    }
  };

  // ---------- CAMBIO DE CONTRASEÑA ----------
  const setPwdField = (key) => (value) => {
    const clean = value.replace(/\s/g, ''); // sin espacios, como en el registro
    setPwd((p) => ({ ...p, [key]: clean }));
    setPwdErrors((e) => ({
      ...e,
      [key]: undefined,
      ...(key === 'nueva' ? { confirmar: undefined } : {}),
    }));
  };

  // Valida un campo al salir de él (si quedó vacío, se avisa recién al tocar "Actualizar")
  const validatePwdOnBlur = (key) => {
    if (!pwd[key]) return;
    const error = getPwdError(key, pwd);
    setPwdErrors((e) => ({ ...e, [key]: error || undefined }));
  };

  const closePwd = () => {
    setPwdOpen(false);
    setPwd({ actual: '', nueva: '', confirmar: '' });
    setPwdErrors({});
    setShowActual(false);
    setShowNueva(false);
    setShowConfirmar(false);
  };

  // [S5-05] Cambiar la contraseña: primero confirma la contraseña actual.
  const changePassword = async () => {
    const e = {};
    ['actual', 'nueva', 'confirmar'].forEach((key) => {
      const error = getPwdError(key, pwd);
      if (error) e[key] = error;
    });
    setPwdErrors(e);
    if (Object.keys(e).length) return;

    setPwdSaving(true);
    try {
      // Firebase exige volver a autenticarse antes de cambiar la contraseña
      const credential = EmailAuthProvider.credential(user.email, pwd.actual);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, pwd.nueva);
      closePwd();
      showToast('Contraseña actualizada correctamente');
    } catch (err) {
      console.error('Error al cambiar la contraseña:', err);
      const msg = mapPasswordError(err.code);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPwdErrors({ actual: msg });
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setPwdSaving(false);
    }
  };

  // ---------- OLVIDÉ MI CONTRASEÑA ----------
  // Envía el correo para restablecerla a la dirección de la cuenta
  const sendReset = async () => {
    if (resetSending) return;
    setResetSending(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      closePwd();
      showToast(`Le enviamos un correo a ${user.email} para restablecer su contraseña`);
    } catch (err) {
      console.error('Error al enviar la recuperación:', err);
      showToast(
        err.code === 'auth/too-many-requests'
          ? 'Demasiados intentos. Espere unos minutos.'
          : 'No se pudo enviar el correo de recuperación',
        'error'
      );
    } finally {
      setResetSending(false);
    }
  };

  // ---------- CERRAR SESIÓN ----------
  // Navigation.js detecta el cambio de sesión y vuelve solo al Login
  // [S5-06] Cerrar sesión desde Mi Perfil.
  const handleLogout = async () => {
    setLogoutOpen(false);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      showToast('No se pudo cerrar la sesión', 'error');
    }
  };

  const resendVerification = async () => {
    try {
      await sendEmailVerification(user);
      showToast('Le enviamos un nuevo enlace de verificación');
    } catch (err) {
      showToast('No se pudo enviar el enlace', 'error');
    }
  };

  const fullName = `${profile.nombre} ${profile.apellido}`.trim() || 'Usuario';
  const initials = getInitials(profile.nombre, profile.apellido, user?.email);

  const fadeUp = (from = 24) => ({
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
  });

  return (
    <SafeAreaView edges={SAFE_EDGES} style={styles.safeArea}>
      <StatusBar backgroundColor={c.bg} barStyle={c.statusBar} translucent />

      {/* ================= BARRA SUPERIOR ================= */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} activeOpacity={0.8}>
          <FontAwesome name="arrow-left" size={16} color={c.greenMain} />
        </TouchableOpacity>
        <Image source={require('../assets/logo.png')} style={styles.topLogo} resizeMode="contain" />
        <Text style={styles.topTitle} numberOfLines={1}>
          Mi Perfil
        </Text>
        <TouchableOpacity style={styles.menuBtn} onPress={toggleTheme} activeOpacity={0.8}>
          <FontAwesome name={isDark ? 'moon-o' : 'sun-o'} size={16} color={isDark ? '#FACC15' : c.gold} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* ================= TARJETA PRINCIPAL ================= */}
          <Animated.View style={[styles.hero, fadeUp(-20)]}>
            <Gradient id="perfilHero" from="#0a2e20" to="#0f6b34" />

            <Pressable onPress={pickImage} style={styles.avatarWrap}>
              {profile.foto ? (
                <Image source={{ uri: profile.foto }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <FontAwesome name="camera" size={12} color={GREEN_DARK} />
              </View>
            </Pressable>

            <Text style={styles.heroName}>{loading ? 'Cargando…' : fullName}</Text>
            <Text style={styles.heroEmail}>{user?.email}</Text>

            <View style={[styles.pill, !user?.emailVerified && { backgroundColor: '#FCA5A5' }]}>
              <FontAwesome
                name={user?.emailVerified ? 'check-circle' : 'exclamation-circle'}
                size={11}
                color={GREEN_DARK}
              />
              <Text style={styles.pillText}>
                {user?.emailVerified ? 'CORREO VERIFICADO' : 'CORREO SIN VERIFICAR'}
              </Text>
            </View>
          </Animated.View>

          {!user?.emailVerified && (
            <TouchableOpacity onPress={resendVerification} style={styles.warnBox}>
              <Text style={styles.warnText}>Reenviar enlace de verificación</Text>
            </TouchableOpacity>
          )}

          {/* ================= DATOS PERSONALES ================= */}
          <Animated.View style={[styles.card, fadeUp()]}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <FontAwesome name="user" size={16} color={c.greenMain} />
              </View>
              <Text style={styles.cardTitle}>Datos personales</Text>
              {!editing && !loading && (
                <TouchableOpacity onPress={startEdit} style={styles.editBtn}>
                  <FontAwesome name="pencil" size={12} color={c.greenMain} />
                  <Text style={styles.editText}>Editar</Text>
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <ActivityIndicator color={c.greenMain} style={{ marginVertical: 20 }} />
            ) : editing ? (
              <>
                <Field
                  label="Nombre"
                  icon="user"
                  value={form.nombre}
                  onChangeText={setField('nombre')}
                  error={errors.nombre}
                  maxLength={40}
                  autoCapitalize="words"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => apellidoRef.current?.focus()}
                />
                <Field
                  label="Apellido"
                  icon="user-o"
                  value={form.apellido}
                  onChangeText={setField('apellido')}
                  error={errors.apellido}
                  maxLength={40}
                  autoCapitalize="words"
                  inputRef={apellidoRef}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => telefonoRef.current?.focus()}
                />
                <Field
                  label="Teléfono (opcional)"
                  icon="phone"
                  value={form.telefono}
                  onChangeText={setField('telefono')}
                  error={errors.telefono}
                  keyboardType="phone-pad"
                  inputRef={telefonoRef}
                  returnKeyType="done" // tecla "Listo": guarda
                  onSubmitEditing={saveProfile}
                />
                <Field label="Correo electrónico" icon="envelope" value={user?.email || ''} editable={false} />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Cancelar" variant="outline" onPress={cancelEdit} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Guardar" icon="check" onPress={saveProfile} loading={saving} />
                  </View>
                </View>
              </>
            ) : (
              <>
                <InfoRow icon="user" label="Nombre" value={profile.nombre || '—'} />
                <InfoRow icon="user-o" label="Apellido" value={profile.apellido || '—'} />
                <InfoRow icon="phone" label="Teléfono" value={profile.telefono || 'Sin cargar'} />
                <InfoRow icon="envelope" label="Correo" value={user?.email || '—'} />
                <InfoRow
                  icon="calendar"
                  label="Miembro desde"
                  value={formatDate(user?.metadata?.creationTime)}
                />
                <InfoRow
                  icon="clock-o"
                  label="Último ingreso"
                  value={formatDate(user?.metadata?.lastSignInTime)}
                  last
                />
              </>
            )}
          </Animated.View>

          {/* ================= SEGURIDAD ================= */}
          <Animated.View style={[styles.card, fadeUp(32)]}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <FontAwesome name="lock" size={16} color={c.greenMain} />
              </View>
              <Text style={styles.cardTitle}>Seguridad</Text>
            </View>

            {!pwdOpen ? (
              <View style={styles.pwdBtnWrap}>
                <PrimaryButton
                  title="Cambiar contraseña"
                  icon="key"
                  variant="outline"
                  onPress={() => setPwdOpen(true)}
                />
              </View>
            ) : (
              <>
                <Field
                  label="Contraseña actual"
                  icon="lock"
                  value={pwd.actual}
                  onChangeText={setPwdField('actual')}
                  onBlur={() => validatePwdOnBlur('actual')}
                  error={pwdErrors.actual}
                  secureTextEntry={!showActual}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => nuevaRef.current?.focus()}
                  right={
                    <TouchableOpacity onPress={() => setShowActual((s) => !s)} hitSlop={10}>
                      <FontAwesome name={showActual ? 'eye-slash' : 'eye'} size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  }
                />
                <Field
                  label="Nueva contraseña"
                  icon="lock"
                  placeholder="Cree una contraseña segura"
                  value={pwd.nueva}
                  onChangeText={setPwdField('nueva')}
                  onBlur={() => {
                    validatePwdOnBlur('nueva');
                    validatePwdOnBlur('confirmar');
                  }}
                  error={pwdErrors.nueva}
                  inputRef={nuevaRef}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => confirmarRef.current?.focus()}
                  secureTextEntry={!showNueva}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  maxLength={64}
                  right={
                    <TouchableOpacity onPress={() => setShowNueva((s) => !s)} hitSlop={10}>
                      <FontAwesome name={showNueva ? 'eye-slash' : 'eye'} size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  }
                />

                {/* Requisitos: texto cuando está vacía; al escribir, barra y pastillas (igual que en el registro) */}
                {!pwd.nueva && !pwdErrors.nueva && (
                  <Text style={styles.hintText}>
                    Mínimo {MIN_PASSWORD} caracteres, una mayúscula, una minúscula, un número y un carácter
                    especial. Sin espacios.
                  </Text>
                )}

                {pwd.nueva.length > 0 && (
                  <View style={styles.strengthBox}>
                    <View style={styles.strengthHeader}>
                      <Text style={styles.strengthText}>Seguridad de la contraseña:</Text>
                      <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                    </View>
                    <View style={styles.strengthBarBackground}>
                      <Animated.View
                        style={[
                          styles.strengthBarFill,
                          {
                            width: strengthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                            backgroundColor: strength.color,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.rules}>
                      {PASSWORD_RULES.map((r) => {
                        const ok = r.test(pwd.nueva);
                        return (
                          <View key={r.key} style={[styles.rule, ok && styles.ruleOk]}>
                            <FontAwesome name={ok ? 'check-circle' : 'circle-o'} size={11} color={ok ? c.greenMain : '#9CA3AF'} />
                            <Text style={[styles.ruleText, ok && { color: c.greenMain }]}>{r.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                <Field
                  label="Confirmar nueva contraseña"
                  icon="lock"
                  placeholder="Repita su contraseña"
                  value={pwd.confirmar}
                  onChangeText={setPwdField('confirmar')}
                  onBlur={() => validatePwdOnBlur('confirmar')}
                  error={pwdErrors.confirmar}
                  secureTextEntry={!showConfirmar}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  maxLength={64}
                  inputRef={confirmarRef}
                  returnKeyType="done" // tecla "Listo": actualiza
                  onSubmitEditing={changePassword}
                  right={
                    <TouchableOpacity onPress={() => setShowConfirmar((s) => !s)} hitSlop={10}>
                      <FontAwesome name={showConfirmar ? 'eye-slash' : 'eye'} size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  }
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Cancelar"
                      variant="outline"
                      onPress={closePwd}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Actualizar" icon="check" onPress={changePassword} loading={pwdSaving} />
                  </View>
                </View>
              </>
            )}
          </Animated.View>

          {/* ================= CERRAR SESIÓN ================= */}
          {/* ¿Olvidó su contraseña? (siempre visible, arriba de Cerrar sesión) */}
          <Animated.View style={[styles.forgotWrap, fadeUp(36)]}>
            <TouchableOpacity onPress={sendReset} disabled={resetSending} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>
                {resetSending ? 'Enviando…' : '¿Olvidó su contraseña?'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Botón más angosto y centrado; abre la confirmación antes de salir */}
          <Animated.View style={[styles.logoutWrap, fadeUp(40)]}>
            <PrimaryButton title="Cerrar sesión" icon="sign-out" variant="danger" onPress={() => setLogoutOpen(true)} />
          </Animated.View>
        </View>

        {/* Barra inferior institucional */}
        <View style={styles.bottomBar}>
          <View style={{ flex: 1, backgroundColor: GOLD_YELLOW }} />
          <View style={{ flex: 4, backgroundColor: GREEN_DARK }} />
        </View>
      </ScrollView>

      {/* ================= CONFIRMAR CIERRE DE SESIÓN ================= */}
      <Modal transparent animationType="fade" visible={logoutOpen} onRequestClose={() => setLogoutOpen(false)} statusBarTranslucent>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIcon}>
              <FontAwesome name="sign-out" size={26} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>¿Está seguro de que desea cerrar sesión?</Text>
            <Text style={styles.confirmText}>Tendrá que volver a ingresar con su correo y contraseña.</Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: c.surfaceAlt }]}
                onPress={() => setLogoutOpen(false)}
              >
                <Text style={[styles.confirmBtnText, { color: c.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#DC2626' }]} onPress={handleLogout}>
                <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= TOAST ================= */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          toast.type === 'error' && { backgroundColor: '#B91C1C' },
          {
            opacity: toastAnim,
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          },
        ]}
      >
        <FontAwesome
          name={toast.type === 'error' ? 'exclamation-circle' : 'check-circle'}
          size={16}
          color="#FFFFFF"
        />
        <Text style={styles.toastText}>{toast.msg}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

// Fila de dato (modo lectura)
function InfoRow({ icon, label, value, last }) {
  const styles = useStyles();
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <FontAwesome name={icon} size={14} color="#9CA3AF" style={{ width: 22 }} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// =========================================================================
// ESTILOS
// =========================================================================
// Estilos que dependen del tema (claro / oscuro)
const makeStyles = (c) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: c.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}),
  },
  scroll: { flex: 1, ...(Platform.OS === 'web' ? { height: '100%', minHeight: 0 } : {}) },
  scrollContent: { flexGrow: 1 },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },

  // ---------- Barra superior ----------
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topLogo: { width: 32, height: 32 },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: c.text },

  // ---------- Tarjeta principal ----------
  hero: {
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
    backgroundColor: GREEN_DARK,
  },
  avatarWrap: {
    width: 104,
    height: 104,
    marginBottom: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  avatarImg: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 34, fontWeight: '800' },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GOLD_PILL,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroName: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  heroEmail: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2, marginBottom: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GOLD_PILL,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillText: { color: GREEN_DARK, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  warnBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  warnText: { color: '#B45309', fontWeight: '700', fontSize: 13 },

  // ---------- Tarjetas ----------
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: c.text },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  editText: { color: c.greenMain, fontWeight: '700', fontSize: 12 },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceAlt,
  },
  infoLabel: { fontSize: 13, color: c.textMuted, width: 120 },
  infoValue: { flex: 1, fontSize: 13, color: c.text, fontWeight: '600', textAlign: 'right' },

  // ---------- Campos ----------
  label: { fontSize: 12, fontWeight: '700', color: c.text, marginBottom: 4 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    width: '100%',
  },
  inputIcon: { width: 22, marginRight: 6 },
  input: { flex: 1, color: c.text, fontSize: 13, height: '100%' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { color: '#DC2626', fontSize: 11, flexShrink: 1 },

  hintText: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: -8, marginBottom: 14 },
  strengthBox: {
    width: '100%',
    marginTop: -6,
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  strengthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  strengthText: { fontSize: 12, color: c.textMuted, flex: 1 },
  strengthLabel: { fontSize: 12, fontWeight: 'bold', marginLeft: 8 },
  strengthBarBackground: { height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' },
  strengthBarFill: { height: '100%', borderRadius: 3 },
  rules: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  ruleOk: { backgroundColor: c.accentSoft },
  ruleText: { fontSize: 11, color: c.textMuted },

  // ---------- Botones ----------
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: c.greenMain,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  btnOutline: { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.greenMain },
  btnDanger: { backgroundColor: '#FEE2E2', borderWidth: 1.5, borderColor: '#FCA5A5' },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  // ---------- Toast ----------
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: GREEN_DARK,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
  },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 },

  bottomBar: { height: 10, width: '100%', flexDirection: 'row' },

  // Tamaño del botón Cerrar sesión: cambiar width (ancho) y minWidth (ancho mínimo)
  logoutWrap: { width: '80%', minWidth: 200, alignSelf: 'center' },

  // Tamaño del botón Cambiar contraseña: cambiar width (ancho) y minWidth (ancho mínimo)
  pwdBtnWrap: { width: '90%', minWidth: 200, alignSelf: 'center' },

  // ---------- ¿Olvidó su contraseña? ----------
  forgotWrap: { alignSelf: 'center', marginBottom: -6 },
  forgotBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  forgotText: { color: c.greenMain, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },

  // ---------- Confirmar cierre de sesión (igual que la baja de proveedor) ----------
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmBox: {
    backgroundColor: c.surface,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    elevation: 10,
  },
  confirmIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmTitle: { fontSize: 18, fontWeight: 'bold', color: c.text, marginBottom: 6, textAlign: 'center' },
  confirmText: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginBottom: 20 },
  confirmRow: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmBtn: { flex: 1, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { fontSize: 14, fontWeight: 'bold' },
});
