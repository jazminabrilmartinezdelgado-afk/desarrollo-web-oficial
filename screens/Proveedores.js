import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  StatusBar,
  Image,
  Animated,
  Easing,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
} from 'react-native';
// SafeAreaView de react-native está en desuso: se usa el de react-native-safe-area-context
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../src/config/firebaseConfig';
import { useTheme } from '../src/theme/ThemeContext';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

// =========================================================================
// CONSTANTES Y PALETA CORPORATIVA
// =========================================================================
// Bordes seguros solo en iPhone (igual que el SafeAreaView anterior)
const SAFE_EDGES = Platform.OS === 'ios' ? ['top', 'right', 'bottom', 'left'] : [];

const GREEN_DARK = '#0d3827';
const GREEN_MID = '#168A48';
const GREEN_MAIN = '#008A3B';
const GOLD_YELLOW = '#CAB118';
const DARK = '#111827';
const PAGE_BG = '#F3F7F4';
const COLLECTION = 'proveedores';

// Rol que se muestra en la barra superior
const ROL_USUARIO = 'ADMIN';

// Foto del banner (opcional). Ejemplo: require('../assets/campo.jpg')
const BANNER_IMAGE = null;

// Tamaño máximo del texto base64 de la imagen (Firestore permite 1 MB por documento)
const MAX_IMAGE_BASE64 = 700000;

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'activo', label: 'Activo' },
  { key: 'inactivo', label: 'Inactivo' },
];

const EMPTY_FORM = {
  nombre: '',
  apellido: '',
  telefono: '+54 9 387 ',
  email: '',
  direccion: '',
  imagen: '',
  estado: true,
};

// telefono de Salta
const SALTA_PHONE_REGEX = /^\+54\s9\s387\s\d{7}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com)$/i;
const ONLY_LETTERS_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;
// Dirección: letras, números, espacios y . , # ° º / -
const ADDRESS_BLOCKED = /[^A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s.,#°º\/-]/g;

// Mismas reglas que en el registro (SignUp)
const NAME_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:\s[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/;
const PHONE_PREFIX = '+54 9 387 ';

// Devuelve el error de UN campo del formulario ('' si está bien).
// Los mensajes son los mismos que en la pantalla de registro.
const getFieldError = (key, form) => {
  switch (key) {
    case 'nombre':
    case 'apellido': {
      const campo = key; // "nombre" o "apellido"
      const v = form[key].trim();
      if (!v) return `El ${campo} es obligatorio.`;
      if (v.length < 2) return `El ${campo} debe tener al menos 2 letras.`;
      if (!NAME_REGEX.test(v)) return `El ${campo} solo puede contener letras y espacios.`;
      return '';
    }
    case 'telefono':
      if (!form.telefono.replace(PHONE_PREFIX, '').trim()) return 'El teléfono es obligatorio.';
      if (!SALTA_PHONE_REGEX.test(form.telefono)) return 'Ingrese un número de Salta: +54 9 387 XXXXXXX.';
      return '';
    case 'email': {
      const email = form.email.trim();
      if (!email) return 'El correo es obligatorio.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return 'El formato del correo no es válido. Ejemplo: nombre@gmail.com o nombre@hotmail.com';
      }
      if (!EMAIL_REGEX.test(email)) return 'Use un correo @gmail.com o @hotmail.com.';
      return '';
    }
    case 'direccion': {
      const d = form.direccion.trim();
      if (!d) return 'La dirección es obligatoria.';
      if (d.length < 5) return 'La dirección debe tener al menos 5 caracteres.';
      if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(d)) return 'Incluya el nombre de la calle.';
      return '';
    }
    default:
      return '';
  }
};

const FORM_FIELDS = ['nombre', 'apellido', 'telefono', 'email', 'direccion'];

// Devuelve los estilos del tema actual (se recalculan solo al cambiar de tema)
const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
};

// Curva de animación suave (sin rebotes bruscos)
const SMOOTH = Easing.bezier(0.22, 1, 0.36, 1);

// Ancho máximo del formulario: mismo que el de la app (tamaño celular)
const SHEET_MAX = 480;

const isActivo = (p) => p.estado !== false && p.estado !== 'inactivo';

// =========================================================================
// DEGRADADO CON SVG (sin librerías extra)
// =========================================================================
// Se mide el tamaño real del contenedor: en Android el "100%" a veces
// no cubre todo el fondo (quedaba una franja sin color)
function Gradient({ id, from, to, x2 = '1', y2 = '1', fromOpacity = 1, toOpacity = 1 }) {
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
          <LinearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
            <Stop offset="0" stopColor={from} stopOpacity={fromOpacity} />
            <Stop offset="1" stopColor={to} stopOpacity={toOpacity} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={w} height={h} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

// =========================================================================
// NÚMERO QUE SUBE ANIMADO (contador del banner)
// =========================================================================
function CountUp({ value, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value]);

  return <Text style={style}>{String(shown).padStart(2, '0')}</Text>;
}

// =========================================================================
// CAMPO DE FORMULARIO
// Muestra el error cuando el usuario termina de escribir y sale del campo.
// =========================================================================
function Field({ label, icon, error, onBlur: onFieldBlur, inputRef, ...props }) {
  const styles = useStyles();
  const { colors: c } = useTheme();

  // Animación del borde y del fondo al enfocar el campo.
  const focus = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);

  // Anima el campo al entrar o salir de él.
  const animate = (to) => {
    Animated.timing(focus, {
      toValue: to,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // El borde se pone rojo cuando hay un error.
  // Si no hay error, utiliza el color del tema y cambia al enfocar.
  const borderColor = error
    ? '#EF4444'
    : focus.interpolate({
        inputRange: [0, 1],
        outputRange: [c.border, c.greenMain],
      });

  // El fondo también cambia cuando el campo tiene un error.
  const backgroundColor = error
    ? (c.mode === 'dark' ? 'rgba(239,68,68,0.12)' : '#FEF2F2')
    : focus.interpolate({
        inputRange: [0, 1],
        outputRange: [c.surfaceAlt, c.surface],
      });

  return (
    <View style={{ width: '100%', marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>

      <Animated.View
        style={[
          styles.inputBox,
          {
            borderColor,
            backgroundColor,
          },
        ]}
      >
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
            Platform.OS === 'web' && { outlineStyle: 'none' },
          ]}
          placeholderTextColor="#9CA3AF"

          // Cuando el usuario entra al campo, activa la animación.
          onFocus={() => {
            setFocused(true);
            animate(1);
          }}

          // Cuando sale del campo, termina la animación
          // y ejecuta la validación correspondiente.
          onBlur={(event) => {
            setFocused(false);
            animate(0);

            // Ejecuta la función de validación recibida desde FormModal.
            onFieldBlur?.(event);
          }}

          {...props}
        />
      </Animated.View>

      {/* El mensaje de error solo aparece cuando existe un error. */}
      {!!error && (
        <View style={styles.errorRow}>
          <FontAwesome
            name="exclamation-circle"
            size={12}
            color="#EF4444"
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

// =========================================================================
// TARJETA DE PROVEEDOR
// =========================================================================
function ProveedorCard({ item, index, onEdit, onToggle }) {
  const styles = useStyles();
  const { colors: c } = useTheme();
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const detail = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const activo = isActivo(item);
  const fullName = `${item.nombre || ''} ${item.apellido || ''}`.trim();

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const toggleDetails = () => {
    const next = !expanded;
    setExpanded(next);
    detail.setValue(0);
    if (next) {
      Animated.timing(detail, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  };

  const pressIn = () => Animated.spring(press, { toValue: 0.98, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(press, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          { scale: press },
        ],
      }}
    >
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onLongPress={toggleDetails} // mantener presionada la tarjeta muestra u oculta los detalles
        delayLongPress={450} // tiempo que hay que mantenerla (ms)
        android_ripple={{ color: 'rgba(0,138,59,0.12)' }} // onda al tocar (Android)
        {...(Platform.OS === 'web'
          ? {
              onMouseEnter: () => setHovered(true),
              onMouseLeave: () => setHovered(false),
            }
          : {})}
        style={[
          styles.card,
          { borderLeftColor: activo ? c.greenMain : '#9CA3AF' },
          hovered && styles.cardHover,
        ]}
      >
        <View style={styles.cardRow}>
          {/* Imagen del proveedor */}
          {item.imagen ? (
            <Image source={{ uri: item.imagen }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <FontAwesome name="truck" size={20} color={c.greenMain} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={[styles.tag, { backgroundColor: activo ? (c.mode === 'dark' ? 'rgba(34,197,94,0.18)' : '#DCFCE7') : c.border }]}>
              <Text style={[styles.tagText, { color: activo ? (c.mode === 'dark' ? '#86EFAC' : '#166534') : c.textMuted }]}>
                {activo ? 'Activo' : 'Inactivo'}
              </Text>
            </View>

            <Text style={styles.cardTitle} numberOfLines={1}>
              {fullName || 'Proveedor sin nombre'}
            </Text>

            <View style={styles.infoRow}>
              <FontAwesome name="phone" size={14} color={c.textMuted} style={styles.infoIcon} />
              <Text style={styles.infoText}>{item.telefono || 'Sin teléfono'}</Text>
            </View>
          </View>

          <View style={styles.iconActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: c.accentSoft }]}
              onPress={() => onEdit(item)}
              activeOpacity={0.8}
            >
              <FontAwesome name="pencil" size={14} color={c.greenMain} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: activo ? (c.mode === 'dark' ? 'rgba(239,68,68,0.15)' : '#FEE2E2') : c.accentSoft }]}
              onPress={() => onToggle(item)}
              activeOpacity={0.8}
            >
              <FontAwesome
                name={activo ? 'trash-o' : 'check'}
                size={14}
                color={activo ? '#DC2626' : c.greenMain}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.detailsBtn} onPress={toggleDetails} activeOpacity={0.7}>
          <FontAwesome name={expanded ? 'eye-slash' : 'eye'} size={13} color={c.greenMain} />
          <Text style={styles.detailsText}>{expanded ? 'Ocultar detalles' : 'Ver detalles'}</Text>
        </TouchableOpacity>

        {expanded && (
          <Animated.View
            style={[
              styles.detailsBox,
              {
                opacity: detail,
                transform: [
                  { translateY: detail.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                ],
              },
            ]}
          >
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Dirección</Text>
              <Text style={styles.detailValue}>{item.direccion || 'Sin dirección'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Correo electrónico</Text>
              <Text style={styles.detailValue}>{item.email || 'Sin correo'}</Text>
            </View>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// =========================================================================
// MODAL DE FORMULARIO (Bottom Sheet)
// =========================================================================
function FormModal({ proveedor, onClose, onSaved }) {
  const styles = useStyles();
  const { colors: c } = useTheme();
  const editing = !!proveedor;
  const anim = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const [btnW, setBtnW] = useState(360);

  const [form, setForm] = useState(
    editing
      ? {
          nombre: proveedor.nombre || '',
          apellido: proveedor.apellido || '',
          telefono: proveedor.telefono || '+54 9 387 ',
          email: proveedor.email || '',
          direccion: proveedor.direccion || '',
          imagen: proveedor.imagen || '',
          estado: isActivo(proveedor),
        }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const [segW, setSegW] = useState(300);

  // Tecla "Siguiente": pasa al campo de abajo sin tocar la pantalla
  const apellidoRef = useRef(null);
  const telefonoRef = useRef(null);
  const emailRef = useRef(null);
  const direccionRef = useRef(null);

  // Entrada escalonada de cada bloque del formulario
  const items = useRef([0, 1, 2, 3, 4, 5, 6].map(() => new Animated.Value(0))).current;
  // Posición de la píldora del selector Activo / Inactivo
  const estadoAnim = useRef(new Animated.Value(form.estado ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(estadoAnim, {
      toValue: form.estado ? 0 : 1,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [form.estado]);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 520,
      easing: SMOOTH,
      useNativeDriver: true,
    }).start();
    Animated.stagger(
      70,
      items.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 520, delay: 180, easing: SMOOTH, useNativeDriver: true })
      )
    ).start();

    const shine = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ])
    );
    shine.start();
    return () => shine.stop();
  }, []);

  const close = () =>
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onClose());

  const runShake = () =>
    Animated.sequence([
      Animated.timing(shake, { toValue: 9, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -9, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();

  // ---------- IMAGEN (expo-image-picker) ----------
  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setBanner('Necesitamos permiso para acceder a sus fotos.');
        runShake();
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
        setBanner('La imagen es muy pesada. Elija otra más liviana.');
        runShake();
        return;
      }

      setForm((f) => ({
        ...f,
        imagen: `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`,
      }));
      setBanner('');
    } catch (err) {
      console.error('Error al elegir imagen:', err);
      setBanner('No se pudo abrir la galería.');
    }
  };

  const removeImage = () => setForm((f) => ({ ...f, imagen: '' }));

  // Mantiene el prefijo
  const handlePhoneChange = (val) => {
    const prefix = '+54 9 387 ';
    if (!val.startsWith(prefix)) {
      setForm((f) => ({ ...f, telefono: prefix }));
      return;
    }
    const rawNumbers = val.replace(prefix, '').replace(/\D/g, '').slice(0, 7);
    setForm((f) => ({ ...f, telefono: prefix + rawNumbers }));
    if (errors.telefono) setErrors((e) => ({ ...e, telefono: undefined }));
  };

  const set = (key) => (value) => {

    // [S4-17] Bloquea números y símbolos
    if (key === 'nombre' || key === 'apellido') {
      if (value !== '' && !ONLY_LETTERS_REGEX.test(value)) return;
    }
    // La dirección no acepta símbolos raros: se borran al escribir
    if (key === 'direccion') value = value.replace(ADDRESS_BLOCKED, '');
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    if (banner) setBanner('');
  };

  // =========================================================================
  // VALIDACIÓN INDIVIDUAL DE CAMPOS
  // Se ejecuta cuando el usuario termina de escribir y sale del campo.
  // =========================================================================
  const validateField = (key) => {
    // Igual que en el registro: si el campo quedó vacío no se marca todavía;
    // el "obligatorio" aparece recién al tocar el botón de guardar
    const value = key === 'telefono' ? form.telefono.replace(PHONE_PREFIX, '') : form[key];
    if (!String(value).trim()) return;

    const error = getFieldError(key, form);
    setErrors((prev) => ({ ...prev, [key]: error || undefined }));
  };

  // Valida todos los campos juntos (al tocar el botón de guardar)
  const validate = () => {
    const e = {};
    FORM_FIELDS.forEach((key) => {
      const error = getFieldError(key, form);
      if (error) e[key] = error;
    });
    return e;
  };

  const save = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      runShake();
      return;
    }

    setSaving(true);
    try {
      const data = {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim().toLowerCase(),
        direccion: form.direccion.trim(),
        imagen: form.imagen,
        estado: form.estado,
      };

      if (editing) {
        await updateDoc(doc(db, COLLECTION, proveedor.id), {
          ...data,
          fechaActualizacion: serverTimestamp(),
        });
        onSaved('Proveedor actualizado correctamente');
      } else {
        await addDoc(collection(db, COLLECTION), {
          ...data,
          fechaAlta: serverTimestamp(),
        });
        onSaved('Proveedor registrado correctamente');
      }
      close();
    } catch (err) {
      console.error('Error al guardar proveedor:', err);
      setBanner('No se pudo guardar. Intente nuevamente.');
      runShake();
    } finally {
      setSaving(false);
    }
  };

  const pressIn = () => Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(buttonScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] });
  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Helpers de animación para cada bloque
  const fadeUpItem = (v) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });
  const fadeIn = (v, from = 1) => ({
    opacity: v,
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) }],
  });

  return (
    <Modal transparent animationType="none" visible onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
        >
          <Pressable style={{ flex: 1 }} onPress={close} />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }, { translateX: shake }] }]}
        >
          {/* ---------- ENCABEZADO VERDE ---------- */}
          <View style={styles.sheetTop}>
            <Gradient id="sheetTopGrad" from="#06231a" to="#13843f" x2="1" y2="1" />
            <View pointerEvents="none" style={styles.sheetTopLeaf}>
              <FontAwesome name="leaf" size={120} color="#FFFFFF" />
            </View>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetIcon}>
                <FontAwesome name={editing ? 'pencil' : 'truck'} size={15} color="#0d3827" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>
                  {editing ? 'Actualizar proveedor' : 'Nuevo proveedor'}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {editing ? 'Modifique los datos y guarde los cambios' : 'Complete los campos obligatorios'}
                </Text>
              </View>
              <TouchableOpacity onPress={close} style={styles.closeBtn}>
                <FontAwesome name="times" size={15} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ---------- FOTO (círculo que se superpone al encabezado) ---------- */}
          <Animated.View style={[styles.photoWrap, fadeIn(items[0], 0.8)]}>
            <TouchableOpacity style={styles.photoBox} onPress={pickImage} activeOpacity={0.85}>
              {form.imagen ? (
                <Image source={{ uri: form.imagen }} style={styles.photoImg} />
              ) : (
                <FontAwesome name="user" size={36} color={c.greenMain} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBadge} onPress={pickImage}>
              <FontAwesome name="camera" size={12} color="#0d3827" />
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[styles.photoActions, fadeIn(items[0])]}>
            <TouchableOpacity onPress={pickImage}>
              <Text style={styles.photoLink}>
                {form.imagen ? 'Cambiar foto' : 'Agregar foto (opcional)'}
              </Text>
            </TouchableOpacity>
            {!!form.imagen && (
              <TouchableOpacity onPress={removeImage}>
                <Text style={[styles.photoLink, { color: '#EF4444' }]}>Quitar</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {!!banner && (
            <View style={[styles.bannerMsg, { marginHorizontal: 20 }]}>
              <FontAwesome name="exclamation-circle" size={14} color="#B91C1C" />
              <Text style={styles.bannerText}>{banner}</Text>
            </View>
          )}

          <ScrollView
            style={styles.sheetBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Datos personales */}
            <Animated.View style={fadeUpItem(items[1])}>
              <Text style={styles.groupTitle}>DATOS PERSONALES</Text>
            </Animated.View>
            <Animated.View style={[styles.twoCols, fadeUpItem(items[2])]}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Nombre"
                  icon="user"
                  placeholder="Ingrese su nombre"
                  value={form.nombre}
                  onChangeText={set('nombre')}
                  onBlur={() => validateField('nombre')}
                  error={errors.nombre}
                  maxLength={50}
                  autoCapitalize="words"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => apellidoRef.current?.focus()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Apellido"
                  icon="user-o"
                  placeholder="Ingrese su apellido"
                  value={form.apellido}
                  onChangeText={set('apellido')}
                  onBlur={() => validateField('apellido')}
                  error={errors.apellido}
                  maxLength={50}
                  autoCapitalize="words"
                  inputRef={apellidoRef}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => telefonoRef.current?.focus()}
                />
              </View>
            </Animated.View>

            {/* Contacto */}
            <Animated.View style={fadeUpItem(items[3])}>
              <Text style={styles.groupTitle}>CONTACTO</Text>
              <Field
                label="Teléfono"
                icon="phone"
                placeholder="+54 9 387 XXXXXXX"
                keyboardType="phone-pad"
                value={form.telefono}
                onChangeText={handlePhoneChange}
                onBlur={() => validateField('telefono')}
                error={errors.telefono}
                inputRef={telefonoRef}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </Animated.View>
            <Animated.View style={fadeUpItem(items[4])}>
              <Field
                label="Correo electrónico"
                icon="envelope"
                placeholder="ejemplo@gmail.com o ejemplo@hotmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={100}
                value={form.email}
                onChangeText={set('email')}
                onBlur={() => validateField('email')}
                error={errors.email}
                inputRef={emailRef}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => direccionRef.current?.focus()}
              />
              <Field
                label="Dirección"
                icon="map-marker"
                placeholder="Ingrese su dirección"
                value={form.direccion}
                onChangeText={set('direccion')}
                maxLength={100}
                onBlur={() => validateField('direccion')}
                error={errors.direccion}
                inputRef={direccionRef}
                returnKeyType="done" // tecla "Listo": cierra el teclado
              />
            </Animated.View>

            {/* Estado: selector deslizante */}
            <Animated.View style={fadeUpItem(items[5])}>
              <Text style={styles.groupTitle}>ESTADO</Text>
              <View style={styles.segment} onLayout={(e) => setSegW(e.nativeEvent.layout.width)}>
                <Animated.View
                  style={[
                    styles.segmentPill,
                    {
                      width: (segW - 10) / 2,
                      backgroundColor: form.estado ? c.greenMain : '#DC2626',
                      transform: [
                        {
                          translateX: estadoAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, (segW - 10) / 2],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Pressable style={styles.segmentBtn} onPress={() => set('estado')(true)}>
                  <FontAwesome
                    name="check-circle"
                    size={14}
                    color={form.estado ? '#FFFFFF' : c.textMuted}
                  />
                  <Text style={[styles.segmentText, { color: form.estado ? '#FFFFFF' : c.textMuted }]}>
                    Activo
                  </Text>
                </Pressable>
                <Pressable style={styles.segmentBtn} onPress={() => set('estado')(false)}>
                  <FontAwesome name="ban" size={14} color={!form.estado ? '#FFFFFF' : c.textMuted} />
                  <Text style={[styles.segmentText, { color: !form.estado ? '#FFFFFF' : c.textMuted }]}>
                    Inactivo
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </ScrollView>

          {/* ---------- BOTÓN GUARDAR ---------- */}
          <Animated.View
            style={[
              styles.saveWrap,
              {
                opacity: items[6],
                transform: [
                  { translateY: items[6].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
                  { scale: buttonScale },
                ],
              },
            ]}
          >
            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.85 }]}
              onPressIn={pressIn}
              onPressOut={pressOut}
              onPress={save}
              onLayout={(e) => setBtnW(e.nativeEvent.layout.width)}
              disabled={saving}
              android_ripple={{ color: 'rgba(255,255,255,0.25)', foreground: true }} // onda al tocar (Android)
            >
              <Gradient id="saveGrad" from="#0B8A3E" to="#00B04F" x2="1" y2="0" />
              {!saving && (
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
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.saveBtnText}>
                    {editing ? 'Guardar cambios' : 'Registrar proveedor'}
                  </Text>
                  <FontAwesome name="check" size={15} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// =========================================================================
// MODAL DE CONFIRMACIÓN DE BAJA
// =========================================================================
function ConfirmModal({ proveedor, onCancel, onConfirm, loading }) {
  const styles = useStyles();
  const { colors: c } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
  }, []);

  const fullName = `${proveedor.nombre || ''} ${proveedor.apellido || ''}`.trim();

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.confirmBackdrop}>
        <Animated.View
          style={[
            styles.confirmBox,
            {
              opacity: anim,
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
            },
          ]}
        >
          <View style={styles.confirmIcon}>
            <FontAwesome name="exclamation-triangle" size={26} color="#DC2626" />
          </View>
          <Text style={styles.confirmTitle}>¿Dar de baja al proveedor?</Text>
          <Text style={styles.confirmText}>
            <Text style={{ fontWeight: 'bold', color: c.text }}>{fullName}</Text> quedará como inactivo. Podrá reactivarlo cuando lo desee.
          </Text>

          <View style={styles.confirmRow}>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: c.surfaceAlt }]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.confirmBtnText, { color: c.text }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: '#DC2626' }]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Dar de baja</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// =========================================================================
// PANTALLA PRINCIPAL
// =========================================================================
export default function Proveedores({ navigation }) {
  const styles = useStyles();
  const { colors: c } = useTheme();
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toConfirm, setToConfirm] = useState(null);
  const [bajaLoading, setBajaLoading] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'ok' });

  const topAnim = useRef(new Animated.Value(0)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  // Habilita el scroll en web: html, body y root necesitan altura completa
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.setAttribute('data-proveedores-scroll', 'true');
    style.textContent = 'html, body, #root { height: 100%; margin: 0; }';
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(topAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(bannerAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(searchAnim, {
          toValue: 1,
          duration: 600,
          delay: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(fabAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    // Movimiento sutil del banner
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const zoomLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(zoom, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(zoom, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    zoomLoop.start();
    return () => {
      floatLoop.stop();
      zoomLoop.stop();
    };
  }, []);

  const showToast = useCallback((msg, type = 'ok') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    Animated.spring(toastAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }, 2600);
  }, []);

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('nombre'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setProveedores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Error al leer proveedores:', err);
        setLoading(false);
        showToast('No se pudieron cargar los proveedores', 'error');
      }
    );
    return unsub;
  }, [showToast]);

  const lista = useMemo(() => {
    const term = search.trim().toLowerCase();
    return proveedores.filter((p) => {
      const estadoStr = isActivo(p) ? 'activo' : 'inactivo';
      if (filtro !== 'todos' && estadoStr !== filtro) return false;
      if (!term) return true;
      const fullName = `${p.nombre || ''} ${p.apellido || ''}`.toLowerCase();
      return (
        fullName.includes(term) ||
        (p.telefono || '').toLowerCase().includes(term) ||
        (p.email || '').toLowerCase().includes(term) ||
        (p.direccion || '').toLowerCase().includes(term)
      );
    });
  }, [proveedores, search, filtro]);

  // proveedores activos

  const activosCount = useMemo(() => proveedores.filter(isActivo).length, [proveedores]);

  const openNew = () => {
    setEditing(null);
    setFormVisible(true);
  };

  const openEdit = useCallback((p) => {
    setEditing(p);
    setFormVisible(true);
  }, []);

  const handleToggle = useCallback(
    async (p) => {
      if (isActivo(p)) {
        setToConfirm(p);
        return;
      }
      try {
        await updateDoc(doc(db, COLLECTION, p.id), {
          estado: true,
          fechaActivacion: serverTimestamp(),
        });
        showToast('Proveedor activado correctamente');
      } catch (err) {
        console.error('Error al activar:', err);
        showToast('No se pudo activar el proveedor', 'error');
      }
    },
    [showToast]
  );

  const confirmBaja = async () => {
    if (!toConfirm) return;
    setBajaLoading(true);
    try {
      await updateDoc(doc(db, COLLECTION, toConfirm.id), {
        estado: false,
        fechaBaja: serverTimestamp(),
      });
      showToast('Proveedor dado de baja');
    } catch (err) {
      console.error('Error al dar de baja:', err);
      showToast('No se pudo dar de baja', 'error');
    } finally {
      setBajaLoading(false);
      setToConfirm(null);
    }
  };

  const empty = (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <FontAwesome name={search ? 'search' : 'truck'} size={32} color={c.greenMain} />
      </View>
      <Text style={styles.emptyTitle}>
        {search || filtro !== 'todos' ? 'Sin resultados' : 'Aún no hay proveedores'}
      </Text>
      <Text style={styles.emptyText}>
        {search || filtro !== 'todos'
          ? 'Pruebe con otro término o cambie el filtro.'
          : 'Toque el botón + para registrar el primero.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView edges={SAFE_EDGES} style={styles.safeArea}>
      <StatusBar backgroundColor={c.bg} barStyle={c.statusBar} translucent />

      {/* ================= BARRA SUPERIOR ================= */}
      <Animated.View
        style={[
          styles.topBar,
          {
            opacity: topAnim,
            transform: [
              { translateY: topAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          activeOpacity={0.8}
        >
          <FontAwesome name="arrow-left" size={16} color={c.greenMain} />
        </TouchableOpacity>
        <Image source={require('../assets/logo.png')} style={styles.topLogo} resizeMode="contain" />
        <Text style={styles.topTitle} numberOfLines={1}>
          Gestión de Proveedores
        </Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{ROL_USUARIO}</Text>
        </View>
      </Animated.View>

      {/* ================= CONTENIDO CON SCROLL ================= */}
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.scrollMainContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Banner */}
          <Animated.View
            style={[
              styles.banner,
              {
                opacity: bannerAnim,
                transform: [
                  { translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
                ],
              },
            ]}
          >
            {BANNER_IMAGE ? (
              <Animated.Image
                source={BANNER_IMAGE}
                resizeMode="cover"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    width: '100%',
                    height: '100%',
                    transform: [
                      { scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
                    ],
                  },
                ]}
              />
            ) : (
              <>
                <Gradient id="provBannerBg" from="#0f6b34" to="#0a2e20" />
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    right: 24,
                    top: 14,
                    opacity: 0.12,
                    transform: [
                      { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                      { scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
                    ],
                  }}
                >
                  <FontAwesome name="truck" size={120} color="#FFFFFF" />
                </Animated.View>
              </>
            )}

            <Gradient id="provBannerShade" from="#000000" to="#000000" x2="1" y2="0" fromOpacity={0.45} toOpacity={0} />

            {/* Ola verde y amarilla */}
            <Svg
              width="100%"
              height={70}
              viewBox="0 0 400 70"
              preserveAspectRatio="none"
              style={styles.wave}
            >
              <Path d="M0,70 C170,72 280,60 400,8 L400,70 Z" fill={c.greenMain} />
              <Path
                d="M0,70 C170,72 280,60 400,8"
                fill="none"
                stroke={GOLD_YELLOW}
                strokeWidth={5}
              />
            </Svg>

            <View style={styles.bannerContent}>
              <View style={styles.bannerPill}>
                <FontAwesome name="truck" size={11} color="#86EFAC" />
                <Text style={styles.bannerPillText}>RED COMERCIAL</Text>
              </View>
              <Text style={styles.bannerTitle}>Proveedores</Text>
              <Text style={styles.bannerSub}>
                Mantenga actualizada la información de sus aliados estratégicos.
              </Text>
            </View>

            {/* Contador animado de proveedores activos */}

            <View style={styles.countWrap}>
              <CountUp value={activosCount} style={styles.countNumber} />
              <Text style={styles.countLabel}>ACTIVOS</Text>
            </View>
          </Animated.View>

          {/* Buscador y filtros */}
          <Animated.View
            style={{
              opacity: searchAnim,
              transform: [
                { translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              ],
            }}
          >
            <View style={styles.searchBox}>
              <FontAwesome name="search" size={14} color="#9CA3AF" />
              <TextInput
                style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]}
                placeholder="Buscar por nombre, correo o dirección..."
                placeholderTextColor="#9CA3AF"
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {!!search && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <FontAwesome name="times-circle" size={15} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.chipsRow}>
              {FILTROS.map((f) => {
                const active = filtro === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setFiltro(f.key)}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Lista */}
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={c.greenMain} />
            </View>
          ) : (
            <View style={{ paddingBottom: 120 }}>
              <Text style={styles.listLabel}>PROVEEDORES ({lista.length})</Text>
              {lista.length === 0 ? (
                empty
              ) : (
                lista.map((item, index) => (
                  <View key={item.id} style={{ marginBottom: 12 }}>
                    <ProveedorCard
                      item={item}
                      index={index}
                      onEdit={openEdit}
                      onToggle={handleToggle}
                    />
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <Animated.View
        style={[
          styles.fabWrap,
          {
            transform: [{ scale: fabAnim }],
            opacity: fabAnim,
          },
        ]}
      >
        <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.85}>
          <FontAwesome name="plus" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          { backgroundColor: toast.type === 'error' ? '#B91C1C' : GREEN_DARK },
          {
            opacity: toastAnim,
            transform: [
              { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) },
            ],
          },
        ]}
      >
        <FontAwesome
          name={toast.type === 'error' ? 'exclamation-circle' : 'check-circle'}
          size={16}
          color={toast.type === 'error' ? '#FECACA' : '#34D399'}
        />
        <Text style={styles.toastText}>{toast.msg}</Text>
      </Animated.View>

      {formVisible && (
        <FormModal
          proveedor={editing}
          onClose={() => setFormVisible(false)}
          onSaved={(msg) => showToast(msg)}
        />
      )}

      {!!toConfirm && (
        <ConfirmModal
          proveedor={toConfirm}
          loading={bajaLoading}
          onCancel={() => setToConfirm(null)}
          onConfirm={confirmBaja}
        />
      )}
    </SafeAreaView>
  );
}

// =========================================================================
// ESTILOS UNIFICADOS
// =========================================================================
// Estilos que dependen del tema (claro / oscuro)
const makeStyles = (c) => StyleSheet.create({
  // Altura fija en web: el ScrollView interno es el que scrollea
  safeArea: {
    flex: 1,
    backgroundColor: c.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}),
  },
  mainScrollView: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100%', minHeight: 0 } : {}),
  },
  scrollMainContainer: { flexGrow: 1, paddingBottom: 40 },
  container: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
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
    zIndex: 5,
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
  roleBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  roleText: { color: '#B45309', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  // ---------- Banner ----------
  banner: {
    height: 170,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: GREEN_DARK,
    marginBottom: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  wave: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bannerContent: { padding: 18 },
  bannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(13,56,39,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(134,239,172,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 10,
  },
  bannerPillText: { color: '#BBF7D0', fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  bannerTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17, marginTop: 4, maxWidth: '70%' },
  countWrap: {
    position: 'absolute',
    right: 18,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  countNumber: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  countLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 },

  // ---------- Buscador y chips ----------
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: c.text, paddingVertical: 0 },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 6 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: c.surfaceAlt,
  },
  chipActive: { backgroundColor: c.greenMain },
  chipText: { fontSize: 12, fontWeight: '700', color: c.textSoft },
  chipTextActive: { color: '#FFFFFF' },

  listLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 12,
  },
  loader: { paddingVertical: 60, justifyContent: 'center', alignItems: 'center' },

  // ---------- Tarjeta ----------
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    ...(Platform.OS === 'web'
      ? { cursor: 'default', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }
      : {}),
  },
  cardHover: {
    backgroundColor: c.surfaceAlt,
    ...(Platform.OS === 'web'
      ? { transform: 'translateY(-3px)', boxShadow: '0 0 20px rgba(0, 138, 59, 0.35)' }
      : {}),
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: { width: 54, height: 54, borderRadius: 14, backgroundColor: c.accentSoft },
  avatarEmpty: { justifyContent: 'center', alignItems: 'center' },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  tagText: { fontSize: 11, fontWeight: '700' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: c.text, marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  infoIcon: { width: 16, textAlign: 'center' },
  infoText: { fontSize: 13, color: c.textSoft, flexShrink: 1 },
  iconActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 2,
  },
  detailsText: { color: c.greenMain, fontSize: 13, fontWeight: '700' },
  detailsBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: c.border,
    gap: 8,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  detailValue: { fontSize: 13, color: c.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  // ---------- FAB ----------
  fabWrap: { position: 'absolute', bottom: 24, right: 22 },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: c.greenMain,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: c.greenMain,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },

  // ---------- Modales ----------
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    maxWidth: SHEET_MAX, // tamaño celular también en la compu
    maxHeight: '92%',
    overflow: 'hidden',
    paddingBottom: 18,
  },
  sheetTop: {
    height: 128,
    paddingHorizontal: 20,
    paddingTop: 10,
    overflow: 'hidden',
  },
  sheetTopLeaf: {
    position: 'absolute',
    right: -14,
    top: -18,
    opacity: 0.09,
    transform: [{ rotate: '-20deg' }],
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FACC15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: { fontSize: 19, fontWeight: '900', color: '#FFFFFF' },
  sheetSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetBody: { paddingHorizontal: 20 },
  groupTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: c.greenMain,
    marginBottom: 10,
    marginTop: 4,
  },
  twoCols: { flexDirection: 'row', gap: 10 },
  segment: {
    flexDirection: 'row',
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    padding: 4,
    marginBottom: 6,
  },
  segmentPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 10 },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  segmentText: { fontSize: 13, fontWeight: '800' },
  saveWrap: { paddingHorizontal: 20, marginTop: 10 },
  bannerMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  bannerText: { color: '#B91C1C', fontSize: 12, fontWeight: '600', flex: 1 },

  // Selector de imagen (círculo sobre el encabezado verde)
  photoWrap: { alignSelf: 'center', marginTop: -50 },
  photoBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: c.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: c.surface,
    elevation: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' } : {}),
  },
  photoImg: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute',
    right: 2,
    bottom: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FACC15',
    borderWidth: 2,
    borderColor: c.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 6,
    marginBottom: 12,
  },
  photoLink: { color: c.greenMain, fontWeight: '700', fontSize: 13 },

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

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  switchText: { fontSize: 13, fontWeight: '700' },

  saveBtn: {
    backgroundColor: c.greenMain,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 0,
    elevation: 6,
    shadowColor: c.greenMain,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 46,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  toast: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 10,
    elevation: 8,
  },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 },

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
  confirmTitle: { fontSize: 18, fontWeight: 'bold', color: c.text, marginBottom: 6 },
  confirmText: { fontSize: 13, color: c.textSoft, textAlign: 'center', marginBottom: 20 },
  confirmRow: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmBtn: { flex: 1, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { fontSize: 14, fontWeight: 'bold' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: c.text },
  emptyText: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginTop: 4 },
});

