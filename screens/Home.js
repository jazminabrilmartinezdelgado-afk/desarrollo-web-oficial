import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../src/config/firebaseConfig';
import { useTheme } from '../src/theme/ThemeContext';
import Gradient from '../src/components/Gradient';
import Sidebar from '../src/components/Sidebar';

// =========================================================================
// CONSTANTES
// =========================================================================

const IMG_PRODUCTOS = require('../assets/productos.jpg');
const IMG_LOCAL = require('../assets/local.jpg');

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

// Marcas que se ven en el cartel del local
const MARCAS = ['YARA', 'NOVA', 'Timac Agro', 'Bayer', 'Agroquímicos', 'Fertilizantes', 'Semillas'];

const isActivo = (p) => p.estado !== false && p.estado !== 'inactivo';

// =========================================================================
// APARICIÓN AL HACER SCROLL (fade + slide)
// =========================================================================
function Reveal({ children, delay = 0, limit, style, from = 28, base = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [y, setY] = useState(null);
  const played = useRef(false);

  useEffect(() => {
    // base = posición de la fila que lo contiene (para tarjetas dentro de filas)
    if (!played.current && y !== null && base !== null && base + y < limit - 40) {
      played.current = true;
      Animated.timing(anim, {
        toValue: 1,
        duration: 620,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [y, limit, base]);

  return (
    <Animated.View
      onLayout={(e) => setY(e.nativeEvent.layout.y)}
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// =========================================================================
// NÚMERO QUE CUENTA HACIA ARRIBA
// =========================================================================
function CountUp({ value, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (value == null) return;
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value]);

  return <Text style={style}>{value == null ? '—' : shown}</Text>;
}

// =========================================================================
// TARJETA CON HOVER (se eleva y brilla en web)
// =========================================================================
function HoverCard({ style, hoverStyle, children, onPress, grow }) {
  const [hovered, setHovered] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], flex: grow ? 1 : undefined }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => onPress && Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start()}
        {...(Platform.OS === 'web'
          ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
          : {})}
        style={[style, hovered && hoverStyle]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// =========================================================================
// CINTA DE MARCAS EN MOVIMIENTO (marquee)
// =========================================================================
function Marquee({ c }) {
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!w) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: -w, duration: w * 28, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [w]);

  const row = (key, measure) => (
    <View
      key={key}
      style={styles.marqueeRow}
      onLayout={measure ? (e) => setW(e.nativeEvent.layout.width) : undefined}
    >
      {MARCAS.map((m) => (
        <View key={m} style={[styles.brandChip, { backgroundColor: c.surface, borderColor: c.border }]}>
          <FontAwesome name="leaf" size={11} color={c.greenMain} />
          <Text style={[styles.brandChipText, { color: c.text }]}>{m}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.marquee}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: x }] }}>
        {row('a', true)}
        {row('b', false)}
      </Animated.View>
    </View>
  );
}

// =========================================================================
// PANTALLA HOME
// =========================================================================
export default function Home({ navigation }) {
  const { colors: c, isDark, toggleTheme } = useTheme();
  const { height: viewH } = useWindowDimensions();
  // Diseño de celular: una sola columna y sidebar que se abre/cierra con el botón ☰
  const wide = false;
  const twoCols = false;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profile, setProfile] = useState({ name: '', email: '', foto: '' });
  // El saludo se muestra recién cuando ya se sabe el nombre (así no aparece "Usuario" un instante)
  const helloAnim = useRef(new Animated.Value(0)).current;
  const [stats, setStats] = useState({ activos: null, total: null });

  // Control de aparición por scroll
  const [scrollBottom, setScrollBottom] = useState(viewH);
  const [duoY, setDuoY] = useState(null);
  const [commitY, setCommitY] = useState(null);
  const maxBottom = useRef(viewH);

  // Animaciones
  const heroAnim = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const waveHand = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const arrow = useRef(new Animated.Value(0)).current;
  const themeSpin = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  // ---------- PERFIL (nombre + foto) al entrar y al volver a esta pantalla ----------
  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      let foto = '';
      let fullName = '';
      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          foto = data.foto || '';
          // Nombre y apellido guardados desde "Mi perfil"
          fullName = `${data.nombre || ''} ${data.apellido || ''}`.trim();
        }
      } catch (e) {
        // Sin permiso o sin conexión: se usa el nombre de la cuenta
      }
      // Si no hay datos en Firestore, se usa el nombre de la cuenta (registro)
      if (!fullName) fullName = (user.displayName || '').trim();
      const name = fullName ? fullName.charAt(0).toUpperCase() + fullName.slice(1) : '';
      setProfile({ name, email: user.email || '', foto });
      Animated.timing(helloAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };
    load();
    return navigation.addListener('focus', load);
  }, [navigation]);

  // ---------- ESTADÍSTICAS EN VIVO (colección proveedores) ----------
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'proveedores'),
      (snap) => {
        const list = snap.docs.map((d) => d.data());
        setStats({ activos: list.filter(isActivo).length, total: list.length });
      },
      () => setStats({ activos: null, total: null })
    );
    return unsub;
  }, []);

  // ---------- ANIMACIONES CONTINUAS ----------
  useEffect(() => {
    Animated.timing(heroAnim, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loops = [
      // Zoom lento de la foto (efecto Ken Burns)
      Animated.loop(
        Animated.sequence([
          Animated.timing(zoom, { toValue: 1, duration: 14000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(zoom, { toValue: 0, duration: 14000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ),
      // Saludo de la mano
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveHand, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(waveHand, { toValue: -1, duration: 300, useNativeDriver: true }),
          Animated.timing(waveHand, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(waveHand, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(2200),
        ])
      ),
      // Punto que "respira"
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
        ])
      ),
      // Elementos flotantes
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      // Flecha del botón principal
      Animated.loop(
        Animated.sequence([
          Animated.timing(arrow, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(arrow, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  // Giro del ícono sol/luna al cambiar de tema
  useEffect(() => {
    Animated.spring(themeSpin, { toValue: isDark ? 1 : 0, friction: 6, useNativeDriver: true }).start();
  }, [isDark]);

  const handleScroll = (e) => {
    const bottom = e.nativeEvent.contentOffset.y + viewH;
    if (bottom > maxBottom.current + 20) {
      maxBottom.current = bottom;
      setScrollBottom(bottom);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth); // Navigation.js vuelve solo al Login
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const goTo = (route) => {
    if (route !== 'Home') navigation.navigate(route);
  };

  const heroH = 460;
  // El contenido empieza debajo del hero: se descuenta su altura
  const limit = scrollBottom - heroH;
  const s = useMemo(() => themed(c), [c]);

  const initials = (profile.name || profile.email || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase();

  const sidebarProps = {
    active: 'Home',
    profile,
    onNavigate: goTo,
    onLogout: handleLogout,
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.bg }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.layout}>
        {wide && <Sidebar permanent {...sidebarProps} />}

        <View style={styles.main}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={handleScroll}
          >
            {/* ================= HERO CON FOTO DE PRODUCTOS ================= */}
            <View style={[styles.hero, { height: heroH }]}>
              <Animated.Image
                source={IMG_PRODUCTOS}
                resizeMode="cover"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    width: '100%',
                    height: '100%',
                    transform: [
                      { scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.18] }) },
                      { translateX: zoom.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
                    ],
                  },
                ]}
              />
              {/* Velo verde de izquierda a derecha para que se lea el texto */}
              <Gradient
                id="heroSide"
                x2="1"
                y2="0"
                stops={[
                  { offset: 0, color: '#06231a', opacity: 0.95 },
                  { offset: 0.55, color: '#0d3827', opacity: 0.7 },
                  { offset: 1, color: '#0d3827', opacity: 0.25 },
                ]}
              />
              {/* Difuminado inferior: la foto se funde con el fondo de la página */}
              <View pointerEvents="none" style={styles.heroFade}>
                <Gradient
                  id={`heroFade-${c.mode}`}
                  stops={[
                    { offset: 0, color: c.bg, opacity: 0 },
                    { offset: 0.6, color: c.bg, opacity: 0.75 },
                    { offset: 0.85, color: c.bg, opacity: 1 },
                    { offset: 1, color: c.bg, opacity: 1 },
                  ]}
                />
              </View>

              {/* Círculos de luz flotando */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.glow,
                  {
                    top: -80,
                    right: -60,
                    transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
                  },
                ]}
              />

              {/* Barra superior dentro del hero */}
              <Animated.View style={[styles.heroTop, { opacity: heroAnim }]}>
                {!wide && (
                  <Pressable style={styles.glassBtn} onPress={() => setDrawerOpen(true)}>
                    <FontAwesome name="bars" size={17} color="#FFFFFF" />
                  </Pressable>
                )}
                {!wide && (
                  <View style={styles.logoBox}>
                    <Image source={require('../assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <Pressable style={styles.glassBtn} onPress={toggleTheme}>
                  <Animated.View
                    style={{
                      transform: [
                        { rotate: themeSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
                      ],
                    }}
                  >
                    <FontAwesome name={isDark ? 'moon-o' : 'sun-o'} size={17} color="#FACC15" />
                  </Animated.View>
                </Pressable>
                <Pressable onPress={() => goTo('Perfil')} style={styles.heroAvatarWrap}>
                  {profile.foto ? (
                    <Image source={{ uri: profile.foto }} style={styles.heroAvatar} />
                  ) : (
                    <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
                      <Text style={styles.heroAvatarText}>{initials}</Text>
                    </View>
                  )}
                </Pressable>
              </Animated.View>

              {/* Texto principal */}
              <Animated.View
                style={[
                  styles.heroContent,
                  {
                    opacity: heroAnim,
                    transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
                  },
                ]}
              >
                <View style={styles.pill}>
                  <Animated.View
                    style={[
                      styles.pillDot,
                      {
                        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
                        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                      },
                    ]}
                  />
                  <Text style={styles.pillText}>EXCELENCIA AGRÍCOLA</Text>
                </View>

                <Animated.View style={[styles.helloRow, { opacity: helloAnim }]}>
                  <Text style={[styles.helloText, wide && { fontSize: 42 }]}>
                    {`Hola, ${profile.name ? profile.name.split(' ')[0] : 'Usuario'}`}
                  </Text>
                  <Animated.Text
                    style={[
                      styles.hand,
                      {
                        transform: [
                          { rotate: waveHand.interpolate({ inputRange: [-1, 1], outputRange: ['-15deg', '25deg'] }) },
                        ],
                      },
                    ]}
                  >
                    👋
                  </Animated.Text>
                </Animated.View>

                <Text style={[styles.heroTitle, wide && { fontSize: 22 }]}>
                  Insumos de vanguardia para{'\n'}cada etapa del cultivo
                </Text>
                <Text style={styles.heroText}>
                  Bienvenido a Agroquímica Del Valle. Gestione proveedores e insumos desde un solo lugar.
                </Text>

                <View style={styles.ctaRow}>
                  <Pressable
                    style={({ pressed }) => [styles.ctaMain, pressed && { opacity: 0.7 }]}
                    onPress={() => goTo('Proveedores')}
                  >
                    <Text style={styles.ctaMainText}>Ver proveedores</Text>
                    <Animated.View
                      style={{
                        transform: [{ translateX: arrow.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }],
                      }}
                    >
                      <FontAwesome name="arrow-right" size={13} color="#0d3827" />
                    </Animated.View>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.ctaGhost, pressed && { opacity: 0.6 }]}
                    onPress={() => goTo('Perfil')}
                  >
                    <FontAwesome name="user-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.ctaGhostText}>Mi perfil</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>

            {/* ================= CONTENIDO ================= */}
            <View style={styles.content}>
              {/* Estadísticas en vivo (se superponen al hero) */}
              <View style={styles.statsRow}>
                {[
                  { icon: 'truck', label: 'Activos', value: stats.activos, color: '#22C55E' },
                  { icon: 'list-alt', label: 'Registrados', value: stats.total, color: '#F59E0B' },
                  { icon: 'check-circle', label: 'Cuenta', text: 'Verificada', color: '#0EA5E9' },
                ].map((st, i) => (
                  <Reveal key={st.label} limit={limit + 400} delay={250 + i * 120} style={styles.flex1}>
                    <HoverCard style={[s.statCard, { flex: 1 }]} hoverStyle={s.cardHover} grow>
                      <View style={[styles.statIcon, { backgroundColor: st.color + '22' }]}>
                        <FontAwesome name={st.icon} size={16} color={st.color} />
                      </View>
                      <View>
                        {st.text ? (
                          <Text style={[styles.statValue, { color: c.text, fontSize: 15, marginTop: 6 }]}>{st.text}</Text>
                        ) : (
                          <CountUp value={st.value} style={[styles.statValue, { color: c.text }]} />
                        )}
                        <Text style={[styles.statLabel, { color: c.textMuted }]}>{st.label}</Text>
                      </View>
                    </HoverCard>
                  </Reveal>
                ))}
              </View>

              {/* Nuestro local + misión */}
              <Reveal limit={limit} style={styles.sectionHead}>
                <Text style={[styles.kicker, { color: c.greenMain }]}>CONÓZCANOS</Text>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Cerca de quienes producen</Text>
              </Reveal>

              <View
                style={[styles.duo, !twoCols && { flexDirection: 'column' }]}
                onLayout={(e) => setDuoY(e.nativeEvent.layout.y)}
              >
                <Reveal limit={limit} base={duoY} style={twoCols ? styles.flex1 : null}>
                  <View style={[styles.localCard, { height: twoCols ? 380 : 300 }]}>
                    <Animated.Image
                      source={IMG_LOCAL}
                      resizeMode="cover"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          width: '100%',
                          height: '100%',
                          transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1.02] }) }],
                        },
                      ]}
                    />
                    <Gradient
                      id="localFade"
                      stops={[
                        { offset: 0, color: '#000000', opacity: 0 },
                        { offset: 0.45, color: '#000000', opacity: 0.05 },
                        { offset: 1, color: '#06231a', opacity: 0.95 },
                      ]}
                    />
                    <View style={styles.localInfo}>
                      <View style={styles.localTag}>
                        <FontAwesome name="map-marker" size={11} color="#0d3827" />
                        <Text style={styles.localTagText}>NUESTRO LOCAL</Text>
                      </View>
                      <Text style={styles.localTitle}>Agroquímica Del Valle</Text>
                      <Text style={styles.localSub}>San Millán 60 · Cerrillos, Salta</Text>
                      <Text style={styles.localSub2}>Agroquímicos · Fertilizantes · Semillas</Text>
                    </View>
                  </View>
                </Reveal>

                <Reveal limit={limit} base={duoY} delay={150} style={twoCols ? styles.flex1 : null}>
                  <View style={[s.card, twoCols && { flex: 1, justifyContent: 'center' }]}>
                    <View style={[styles.cardIcon, { backgroundColor: c.accentSoft }]}>
                      <FontAwesome name="bullseye" size={18} color={c.greenMain} />
                    </View>
                    <Text style={[styles.cardTitle, { color: c.text }]}>Nuestra Misión</Text>
                    <Text style={[styles.missionText, { color: c.textSoft }]}>
                      Comercializar insumos agrícolas de alta calidad, brindando a nuestros clientes productos
                      confiables para el desarrollo de sus actividades agropecuarias. Contribuimos a la
                      productividad mediante productos para la protección de los cultivos y el mejoramiento de su
                      rendimiento, cumpliendo las normativas ambientales y promoviendo prácticas agrícolas
                      responsables que preserven el equilibrio del ecosistema.
                    </Text>
                  </View>
                </Reveal>
              </View>

              {/* Marcas */}
              <Reveal limit={limit} style={[styles.sectionHead, { marginTop: 34 }]}>
                <Text style={[styles.kicker, { color: c.greenMain }]}>LO QUE OFRECEMOS</Text>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Marcas y rubros</Text>
              </Reveal>
              <Reveal limit={limit}>
                <Marquee c={c} />
              </Reveal>

              {/* Compromisos */}
              <Reveal limit={limit} style={[styles.sectionHead, { marginTop: 34 }]}>
                <Text style={[styles.kicker, { color: c.greenMain }]}>NUESTROS VALORES</Text>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Nuestro Compromiso</Text>
              </Reveal>
              <View
                style={[styles.commitRow, !twoCols && { flexDirection: 'column' }]}
                onLayout={(e) => setCommitY(e.nativeEvent.layout.y)}
              >
                {COMPROMISOS.map((item, i) => (
                  <Reveal key={item.title} limit={limit} base={commitY} delay={i * 120} style={twoCols ? styles.flex1 : null}>
                    <HoverCard style={[s.card, twoCols && { flex: 1 }]} hoverStyle={s.cardHover} grow={twoCols}>
                      <View style={[styles.cardIcon, { backgroundColor: c.accentSoft }]}>
                        <FontAwesome name={item.icon} size={18} color={c.greenMain} />
                      </View>
                      <Text style={[styles.cardTitle, { color: c.text }]}>{item.title}</Text>
                      <Text style={[styles.commitText, { color: c.textMuted }]}>{item.text}</Text>
                    </HoverCard>
                  </Reveal>
                ))}
              </View>

              {/* Cita final */}
              <Reveal limit={limit} style={{ marginTop: 30 }}>
                <View style={styles.quoteCard}>
                  <Gradient
                    id="quoteGrad"
                    x2="1"
                    y2="1"
                    stops={[
                      { offset: 0, color: '#0a2e20' },
                      { offset: 1, color: '#168A48' },
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      right: 20,
                      top: -10,
                      opacity: 0.12,
                      transform: [
                        { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] }) },
                      ],
                    }}
                  >
                    <FontAwesome name="leaf" size={140} color="#FFFFFF" />
                  </Animated.View>
                  <FontAwesome name="quote-left" size={22} color="#FACC15" />
                  <Text style={styles.quoteText}>
                    Transformando la gestión agrícola con tecnología y conocimiento especializado para alimentar al
                    mundo de forma segura.
                  </Text>
                  <View style={styles.quoteBrand}>
                    <View style={styles.quoteLogoBox}>
                      <Image source={require('../assets/logo.png')} style={styles.quoteLogo} resizeMode="contain" />
                    </View>
                    <Text style={styles.quoteBrandText}>AGROQUÍMICA DEL VALLE</Text>
                  </View>
                </View>
              </Reveal>
            </View>

            {/* Barra inferior institucional */}
            <View style={styles.bottomBar}>
              <View style={{ flex: 1, backgroundColor: c.gold }} />
              <View style={{ flex: 4, backgroundColor: c.greenDark }} />
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Sidebar deslizable en celulares */}
      {!wide && (
        <Sidebar visible={drawerOpen} onClose={() => setDrawerOpen(false)} {...sidebarProps} />
      )}
    </SafeAreaView>
  );
}

// =========================================================================
// ESTILOS QUE CAMBIAN CON EL TEMA
// =========================================================================
const themed = (c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      padding: 22,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: c.mode === 'dark' ? 0.3 : 0.06,
      shadowRadius: 16,
      elevation: 3,
      ...(Platform.OS === 'web' ? { transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' } : {}),
    },
    statCard: {
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: c.mode === 'dark' ? 0.35 : 0.08,
      shadowRadius: 20,
      elevation: 5,
      ...(Platform.OS === 'web' ? { transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' } : {}),
    },
    cardHover: {
      borderColor: c.greenMain,
      ...(Platform.OS === 'web'
        ? { transform: 'translateY(-4px)', boxShadow: `0 12px 30px ${c.mode === 'dark' ? 'rgba(34,197,94,0.25)' : 'rgba(0,138,59,0.22)'}` }
        : {}),
    },
  });

// =========================================================================
// ESTILOS FIJOS
// =========================================================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}),
  },
  layout: { flex: 1, flexDirection: 'row' },
  flex1: { flex: 1 },
  main: { flex: 1 },
  scroll: { flex: 1, ...(Platform.OS === 'web' ? { height: '100%', minHeight: 0 } : {}) },

  // ---------- Hero ----------
  hero: { width: '100%', overflow: 'hidden', backgroundColor: '#0d3827' },
  // Capa que funde la foto con el fondo; baja 4px de más para tapar cualquier borde
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: -4, height: '50%' },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(250,204,21,0.10)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 14 : 20,
  },
  glassBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', backdropFilter: 'blur(8px)' } : {}),
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImg: { width: 30, height: 30 },
  heroAvatarWrap: {
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#FACC15',
    padding: 2,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  heroAvatar: { width: 38, height: 38, borderRadius: 19 },
  heroAvatarFallback: { backgroundColor: '#008A3B', justifyContent: 'center', alignItems: 'center' },
  heroAvatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  heroContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingBottom: 90,
    maxWidth: 680,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: '#FACC15',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 16,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#0d3827' },
  pillText: { color: '#0d3827', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  helloRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  helloText: { color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  hand: { fontSize: 30 },
  heroTitle: { color: '#BBF7D0', fontSize: 18, fontWeight: '800', lineHeight: 28, marginBottom: 8 },
  heroText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 21, maxWidth: 460 },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  ctaMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FACC15',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', boxShadow: '0 8px 24px rgba(250,204,21,0.35)' } : {}),
  },
  ctaMainText: { color: '#0d3827', fontWeight: '900', fontSize: 14 },
  ctaGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  ctaGhostText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // ---------- Contenido ----------
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: -60, marginBottom: 30 },
  statIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11.5, fontWeight: '600', marginTop: 1 },

  sectionHead: { marginBottom: 16 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '900' },

  duo: { flexDirection: 'row', gap: 16 },
  localCard: { borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#0d3827' },
  localInfo: { padding: 22 },
  localTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FACC15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 10,
  },
  localTagText: { color: '#0d3827', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  localTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  localSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4, fontWeight: '600' },
  localSub2: { color: '#BBF7D0', fontSize: 12, marginTop: 2 },

  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 8 },
  missionText: { fontSize: 14, lineHeight: 24 },
  commitRow: { flexDirection: 'row', gap: 14 },
  commitText: { fontSize: 13, lineHeight: 20 },

  marquee: { overflow: 'hidden', width: '100%', paddingVertical: 4 },
  marqueeRow: { flexDirection: 'row' },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    marginRight: 12,
  },
  brandChipText: { fontSize: 14, fontWeight: '800' },

  quoteCard: {
    borderRadius: 26,
    overflow: 'hidden',
    paddingVertical: 32,
    paddingHorizontal: 26,
    alignItems: 'center',
    gap: 16,
  },
  quoteText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 27,
    maxWidth: 620,
    fontWeight: '600',
  },
  quoteBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quoteLogoBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quoteLogo: { width: 22, height: 22 },
  quoteBrandText: { color: '#FACC15', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },

  bottomBar: { height: 10, width: '100%', flexDirection: 'row' },
});
