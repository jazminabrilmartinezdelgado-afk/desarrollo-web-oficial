import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { signOut } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';

// =========================================================================
// CONSTANTES Y PALETA CORPORATIVA
// =========================================================================
const GREEN_DARK = '#0d3827';
const GREEN_MID = '#168A48';
const GREEN_MAIN = '#008A3B';
const GOLD_YELLOW = '#CAB118';
const GOLD_PILL = '#FACC15';
const DARK = '#111827';
const PAGE_BG = '#F3F7F4';

// Foto del banner (campo / cultivo). Cuando tengas la imagen, guárdala en assets
// y reemplaza null por: require('../assets/campo.jpg')
const BANNER_IMAGE = null;

const MODULES = [
  {
    key: 'stock',
    route: 'Stock',
    title: 'Gestionar Stock',
    desc: 'Control de inventario, productos y entradas/salidas.',
    icon: 'cubes',
    bg: '#E6F4EA',
    fg: GREEN_MAIN,
  },
  {
    key: 'proveedores',
    route: 'Proveedores',
    title: 'Gestionar Proveedores',
    desc: 'Directorio comercial, pedidos de insumos y contactos.',
    icon: 'truck',
    bg: '#FEF3C7',
    fg: '#D97706',
  },
  {
    key: 'empleados',
    route: 'Empleados',
    title: 'Gestionar Empleados',
    desc: 'Registro de personal, roles asignados y accesos.',
    icon: 'users',
    bg: '#E0F2FE',
    fg: '#0284C7',
  },
];

const COMPROMISOS = [
  {
    icon: 'leaf',
    title: 'Sustentabilidad',
    text: 'Promovemos el uso responsable de agroquímicos para proteger el ecosistema y asegurar el futuro de nuestras tierras.',
  },
  {
    icon: 'shield',
    title: 'Calidad Garantizada',
    text: 'Cada producto cumple con los más altos estándares internacionales de seguridad y eficacia.',
  },
  {
    icon: 'bar-chart',
    title: 'Trazabilidad Total',
    text: 'Control absoluto de la cadena de suministro, desde el ingreso al almacén hasta la aplicación en el campo.',
  },
];

// =========================================================================
// DEGRADADO CON SVG (no requiere instalar librerías extra)
// =========================================================================
function Gradient({ id, from, to, x2 = '0', y2 = '1', fromOpacity = 1, toOpacity = 1 }) {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
          <Stop offset="0" stopColor={from} stopOpacity={fromOpacity} />
          <Stop offset="1" stopColor={to} stopOpacity={toOpacity} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

// =========================================================================
// APARICIÓN AL HACER SCROLL (fade + slide)
// =========================================================================
function Reveal({ children, delay = 0, limit, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [top, setTop] = useState(null);
  const played = useRef(false);

  useEffect(() => {
    if (!played.current && top !== null && top < limit - 40) {
      played.current = true;
      Animated.timing(anim, {
        toValue: 1,
        duration: 560,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [top, limit]);

  return (
    <Animated.View
      onLayout={(e) => setTop(e.nativeEvent.layout.y)}
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// =========================================================================
// TARJETA DE MÓDULO (press + hover)
// =========================================================================
function ModuleCard({ item, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);

  const pressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        {...(Platform.OS === 'web'
          ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
          : {})}
        style={[styles.moduleCard, hovered && styles.moduleCardHover]}
      >
        <View style={[styles.moduleIcon, { backgroundColor: item.bg }]}>
          <FontAwesome name={item.icon} size={20} color={item.fg} />
        </View>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.moduleTitle}>{item.title}</Text>
          <Text style={styles.moduleDesc}>{item.desc}</Text>
        </View>
        <View style={[styles.moduleArrow, hovered && { backgroundColor: GREEN_MAIN }]}>
          <FontAwesome name="chevron-right" size={11} color={hovered ? '#FFFFFF' : '#9CA3AF'} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// =========================================================================
// PANTALLA HOME
// =========================================================================
export default function Home({ navigation }) {
  const { height: viewH } = useWindowDimensions();
  const [userName, setUserName] = useState('');

  // Control de aparición por scroll
  const [scrollBottom, setScrollBottom] = useState(viewH);
  const [contentY, setContentY] = useState(0);
  const maxBottom = useRef(viewH);

  // Animaciones
  const heroAnim = useRef(new Animated.Value(0)).current;
  const waveHand = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const logoutScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const raw = user.displayName || (user.email ? user.email.split('@')[0] : '');
      setUserName(raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '');
    }

    // Entrada del encabezado
    Animated.timing(heroAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Saludo de la mano
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveHand, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(waveHand, { toValue: -1, duration: 350, useNativeDriver: true }),
        Animated.timing(waveHand, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(waveHand, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.delay(1800),
      ])
    ).start();

    // Punto de la etiqueta que "respira"
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    // Círculos decorativos flotando
    const floatLoop = (val, dur) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: 1,
            duration: dur,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: dur,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    floatLoop(float1, 3800);
    floatLoop(float2, 5200);

    // Zoom lento del banner
    Animated.loop(
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
    ).start();
  }, []);

  const handleScroll = (e) => {
    const bottom = e.nativeEvent.contentOffset.y + viewH;
    if (bottom > maxBottom.current + 20) {
      maxBottom.current = bottom;
      setScrollBottom(bottom);
    }
  };

  // Cierre de sesión seguro
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.replace('Login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const limit = scrollBottom - contentY;

  const handRotation = waveHand.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '25deg'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={GREEN_DARK} barStyle="light-content" translucent />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        {/* ================= HERO ================= */}
        <Animated.View
          style={[
            styles.hero,
            {
              opacity: heroAnim,
              transform: [
                { translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
              ],
            },
          ]}
        >
          <Gradient id="heroGrad" from="#0a2e20" to="#0f6b34" x2="1" y2="1" />

          {/* Círculos decorativos */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.circle,
              {
                width: 190,
                height: 190,
                top: -60,
                right: -50,
                transform: [
                  { translateY: float1.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.circle,
              {
                width: 110,
                height: 110,
                bottom: -30,
                left: -30,
                transform: [
                  { translateY: float2.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
                ],
              },
            ]}
          />

          <View style={styles.heroInner}>
            <View style={styles.heroTop}>
              <View style={styles.logoBox}>
                <Image
                  source={require('../assets/logo.png')}
                  style={styles.logoImg}
                  resizeMode="contain"
                />
              </View>

              <Animated.View style={{ transform: [{ scale: logoutScale }] }}>
                <Pressable
                  style={styles.logoutBtn}
                  onPress={handleLogout}
                  onPressIn={() =>
                    Animated.spring(logoutScale, { toValue: 0.9, useNativeDriver: true }).start()
                  }
                  onPressOut={() =>
                    Animated.spring(logoutScale, {
                      toValue: 1,
                      friction: 4,
                      useNativeDriver: true,
                    }).start()
                  }
                >
                  <FontAwesome name="sign-out" size={16} color="#FFFFFF" />
                  <Text style={styles.logoutText}>Salir</Text>
                </Pressable>
              </Animated.View>
            </View>

            <View style={styles.pill}>
              <Animated.View
                style={[
                  styles.pillDot,
                  {
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
                    transform: [
                      { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) },
                    ],
                  },
                ]}
              />
              <Text style={styles.pillText}>EXCELENCIA AGRÍCOLA</Text>
            </View>

            <View style={styles.helloRow}>
              <Text style={styles.helloText}>Hola, {userName || 'Usuario'}</Text>
              <Animated.Text style={[styles.hand, { transform: [{ rotate: handRotation }] }]}>
                👋
              </Animated.Text>
            </View>

            <Text style={styles.heroText}>
              Bienvenido a Agroquímica Del Valle.{'\n'}
              Potenciamos la productividad agrícola mediante la gestión eficiente de insumos de
              vanguardia.
            </Text>
          </View>
        </Animated.View>

        {/* ================= CONTENIDO ================= */}
        <View style={styles.content} onLayout={(e) => setContentY(e.nativeEvent.layout.y)}>
          {/* Banner con imagen */}
          <Reveal limit={limit} delay={100} style={styles.bannerWrap}>
            <View style={styles.banner}>
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
                  <Gradient id="bannerBg" from="#168A48" to="#0d3827" x2="1" y2="1" />
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      right: 18,
                      top: 10,
                      opacity: 0.12,
                      transform: [
                        { scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) },
                      ],
                    }}
                  >
                    <FontAwesome name="leaf" size={150} color="#FFFFFF" />
                  </Animated.View>
                </>
              )}

              <Gradient id="bannerShade" from="#000000" to="#000000" fromOpacity={0} toOpacity={0.7} />

              <View style={styles.bannerContent}>
                <View style={styles.bannerPill}>
                  <FontAwesome name="leaf" size={10} color="#86EFAC" />
                  <Text style={styles.bannerPillText}>CERCA DE QUIENES PRODUCEN</Text>
                </View>
                <Text style={styles.bannerTitle}>Soluciones que acompañan cada etapa del cultivo</Text>
                <Text style={styles.bannerSub}>Innovación, experiencia y compromiso en el campo.</Text>
              </View>
            </View>
          </Reveal>

          {/* Módulos */}
          <Reveal limit={limit} style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Módulos del sistema</Text>
          </Reveal>

          {MODULES.map((m, i) => (
            <Reveal key={m.key} limit={limit} delay={i * 90} style={{ marginBottom: 12 }}>
              <ModuleCard item={m} onPress={() => navigation.navigate(m.route)} />
            </Reveal>
          ))}

          {/* Misión */}
          <Reveal limit={limit} style={[styles.sectionHead, { marginTop: 14 }]}>
            <Text style={styles.sectionTitle}>Nuestra Misión</Text>
          </Reveal>

          <Reveal limit={limit}>
            <View style={styles.card}>
              <Text style={styles.missionText}>
                La empresa Agroquímica del Valle tiene como objetivo principal comercializar insumos
                agrícolas de alta calidad, brindando a sus clientes productos confiables para el
                desarrollo de sus actividades agropecuarias. La organización busca contribuir a la
                productividad agrícola mediante la venta de productos destinados a la protección de
                los cultivos y al mejoramiento de su rendimiento. Asimismo, asume el compromiso de
                operar en cumplimiento de las normativas ambientales vigentes, garantizando la
                seguridad en el uso de sus productos y promoviendo prácticas agrícolas responsables
                que preserven el equilibrio del ecosistema.
              </Text>
            </View>
          </Reveal>

          {/* Compromiso */}
          <Reveal limit={limit} style={[styles.sectionHead, { marginTop: 22 }]}>
            <Text style={styles.sectionTitle}>Nuestro Compromiso</Text>
          </Reveal>

          {COMPROMISOS.map((c, i) => (
            <Reveal key={c.title} limit={limit} delay={i * 80} style={{ marginBottom: 12 }}>
              <View style={[styles.card, styles.commitCard]}>
                <View style={styles.commitIcon}>
                  <FontAwesome name={c.icon} size={18} color={GREEN_MAIN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.commitTitle}>{c.title}</Text>
                  <Text style={styles.commitText}>{c.text}</Text>
                </View>
              </View>
            </Reveal>
          ))}

          {/* Cita final */}
          <Reveal limit={limit} style={{ marginTop: 10 }}>
            <View style={styles.quoteCard}>
              <FontAwesome name="pagelines" size={26} color={GREEN_MAIN} />
              <Text style={styles.quoteText}>
                "Transformando la gestión agrícola con tecnología y conocimiento especializado para
                alimentar al mundo de forma segura."
              </Text>
              <View style={styles.quoteBrand}>
                <Image
                  source={require('../assets/logo.png')}
                  style={styles.quoteLogo}
                  resizeMode="contain"
                />
                <Text style={styles.quoteBrandText}>AGROQUÍMICA DEL VALLE</Text>
              </View>
            </View>
          </Reveal>
        </View>

        {/* Barra inferior institucional */}
        <View style={styles.bottomBar}>
          <View style={{ flex: 1, backgroundColor: GOLD_YELLOW }} />
          <View style={{ flex: 4, backgroundColor: GREEN_DARK }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// =========================================================================
// ESTILOS
// =========================================================================
const styles = StyleSheet.create({
  // Altura fija en web para que el ScrollView interno sea el que scrollea
  safeArea: {
    flex: 1,
    backgroundColor: PAGE_BG,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}),
  },
  scroll: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100%', minHeight: 0 } : {}),
  },
  scrollContent: { flexGrow: 1 },

  // ---------- Hero ----------
  hero: {
    backgroundColor: GREEN_DARK,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    paddingTop: 20,
    paddingBottom: 30,
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  logoBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImg: { width: 32, height: 32 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  logoutText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: GOLD_PILL,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 14,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN_DARK },
  pillText: { color: GREEN_DARK, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  helloRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  helloText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  hand: { fontSize: 26 },
  heroText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 21 },

  // ---------- Contenido ----------
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 12,
  },
  bannerWrap: { marginBottom: 24 },
  banner: {
    height: 190,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: GREEN_DARK,
    justifyContent: 'flex-end',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  bannerContent: { padding: 18 },
  bannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(13,56,39,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 8,
  },
  bannerPillText: { color: '#BBF7D0', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  bannerTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', lineHeight: 24 },
  bannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },

  sectionHead: { marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: DARK },

  // ---------- Módulos ----------
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    ...(Platform.OS === 'web'
      ? { cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }
      : {}),
  },
  moduleCardHover: {
    borderColor: GREEN_MAIN,
    backgroundColor: '#F9FEFB',
    ...(Platform.OS === 'web'
      ? { transform: 'translateY(-3px)', boxShadow: '0 0 20px rgba(0, 138, 59, 0.40)' }
      : {}),
  },
  moduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  moduleTitle: { fontSize: 15, fontWeight: 'bold', color: DARK, marginBottom: 2 },
  moduleDesc: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  moduleArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { transition: 'all 0.3s ease' } : {}),
  },

  // ---------- Misión y compromiso ----------
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  missionText: { fontSize: 14, color: '#4B5563', lineHeight: 24, textAlign: 'justify' },
  commitCard: { flexDirection: 'row', gap: 14, padding: 16 },
  commitIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E6F4D7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commitTitle: { fontSize: 15, fontWeight: '800', color: DARK, marginBottom: 4 },
  commitText: { fontSize: 12.5, color: '#6B7280', lineHeight: 19 },

  // ---------- Cita ----------
  quoteCard: {
    backgroundColor: '#EAF3EC',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#D5E6D9',
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 14,
  },
  quoteText: {
    fontSize: 13.5,
    fontStyle: 'italic',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
  },
  quoteBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quoteLogo: { width: 20, height: 20 },
  quoteBrandText: { fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 1 },

  bottomBar: { height: 10, width: '100%', flexDirection: 'row', marginTop: 20 },
});