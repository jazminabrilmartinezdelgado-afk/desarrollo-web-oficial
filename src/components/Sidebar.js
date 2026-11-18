import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  ScrollView,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import Gradient from './Gradient';

export const SIDEBAR_WIDTH = 270;

// Módulos del sistema (antes estaban como tarjetas en Home)
const MODULES = [
  { key: 'inicio', route: 'Home', label: 'Inicio', icon: 'home' },
  { key: 'proveedores', route: 'Proveedores', label: 'Gestionar Proveedores', icon: 'truck' },
  { key: 'stock', route: 'Stock', label: 'Gestionar Stock', icon: 'cubes', soon: true },
  { key: 'empleados', route: 'Empleados', label: 'Gestionar Empleados', icon: 'users', soon: true },
];

const initialsOf = (name = '', email = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = parts.slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase();
  return ini || (email ? email.charAt(0).toUpperCase() : '?');
};

// =========================================================================
// ÍTEM DEL MENÚ (hover en web + entrada escalonada)
// =========================================================================
function NavItem({ item, active, index, appear, onPress, c }) {
  const [hovered, setHovered] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const translateX = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [-30 - index * 12, 0],
  });

  const highlighted = active || hovered;

  return (
    <Animated.View style={{ opacity: appear, transform: [{ translateX }, { scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start()}
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start()
        }
        {...(Platform.OS === 'web'
          ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
          : {})}
        style={[
          styles.item,
          highlighted && { backgroundColor: c.sidebarActive },
          Platform.OS === 'web' && { cursor: item.soon ? 'default' : 'pointer' },
        ]}
      >
        {active && <View style={[styles.activeBar, { backgroundColor: c.greenMain }]} />}
        <View
          style={[
            styles.itemIcon,
            { backgroundColor: active ? c.greenMain : c.accentSoft },
          ]}
        >
          <FontAwesome name={item.icon} size={14} color={active ? '#FFFFFF' : c.greenMain} />
        </View>
        <Text
          style={[
            styles.itemText,
            { color: item.soon ? c.textMuted : c.text },
            active && { fontWeight: '800' },
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
        {item.soon && (
          <View style={styles.soon}>
            <Text style={styles.soonText}>PRONTO</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// =========================================================================
// INTERRUPTOR DE MODO OSCURO (animado)
// =========================================================================
function ThemeSwitch() {
  const { colors: c, isDark, toggleTheme } = useTheme();
  const knob = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(knob, { toValue: isDark ? 1 : 0, friction: 6, useNativeDriver: true }).start();
  }, [isDark]);

  return (
    <Pressable
      onPress={toggleTheme}
      style={[styles.themeRow, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
    >
      <FontAwesome name={isDark ? 'moon-o' : 'sun-o'} size={16} color={isDark ? '#FACC15' : c.gold} />
      <Text style={[styles.themeText, { color: c.text }]}>
        {isDark ? 'Modo oscuro' : 'Modo claro'}
      </Text>
      <View style={[styles.track, { backgroundColor: isDark ? c.greenMain : '#D1D5DB' }]}>
        <Animated.View
          style={[
            styles.knob,
            { transform: [{ translateX: knob.interpolate({ inputRange: [0, 1], outputRange: [2, 20] }) }] },
          ]}
        />
      </View>
    </Pressable>
  );
}

// =========================================================================
// CONTENIDO DEL SIDEBAR
// =========================================================================
function SidebarContent({ active, profile, onNavigate, onLogout, open, onClose }) {
  const { colors: c } = useTheme();
  const appear = useRef(new Animated.Value(0)).current;
  const [profileHover, setProfileHover] = useState(false);

  // Animación de entrada cada vez que se abre
  useEffect(() => {
    if (!open) {
      appear.setValue(0);
      return;
    }
    Animated.timing(appear, {
      toValue: 1,
      duration: 520,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open]);

  return (
    <View style={[styles.panel, { backgroundColor: c.sidebar, borderRightColor: c.border }]}>
      {/* Marca: logo horizontal sobre franja verde (el texto del logo es blanco) */}
      <View style={styles.brand}>
        <Gradient
          id="sideBrand"
          x2="1"
          y2="1"
          stops={[
            { offset: 0, color: '#06231a' },
            { offset: 1, color: '#0f6b34' },
          ]}
        />
        <Image
          source={require('../../assets/logo-horizontal.png')}
          style={styles.brandLogo}
          resizeMode="contain"
        />
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <FontAwesome name="times" size={16} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.menu} showsVerticalScrollIndicator={false}>
        <Text style={[styles.section, { color: c.textMuted }]}>MÓDULOS DEL SISTEMA</Text>
        {MODULES.map((m, i) => (
          <NavItem
            key={m.key}
            item={m}
            index={i}
            appear={appear}
            c={c}
            active={active === m.route}
            onPress={() => !m.soon && onNavigate(m.route)}
          />
        ))}

        <Text style={[styles.section, { color: c.textMuted, marginTop: 22 }]}>APARIENCIA</Text>
        <ThemeSwitch />
      </ScrollView>

      {/* Perfil en la parte inferior: lleva a Mi Perfil */}
      <View style={[styles.footer, { borderTopColor: c.border }]}>
        <Pressable
          onPress={() => onNavigate('Perfil')}
          {...(Platform.OS === 'web'
            ? { onMouseEnter: () => setProfileHover(true), onMouseLeave: () => setProfileHover(false) }
            : {})}
          style={[
            styles.profile,
            { backgroundColor: profileHover || active === 'Perfil' ? c.sidebarActive : c.surfaceAlt },
            Platform.OS === 'web' && { cursor: 'pointer' },
          ]}
        >
          {profile.foto ? (
            <Image source={{ uri: profile.foto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: c.greenMain }]}>
              <Text style={styles.avatarText}>{initialsOf(profile.name, profile.email)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: c.text }]} numberOfLines={1}>
              {profile.name || 'Usuario'}
            </Text>
            <Text style={[styles.profileLink, { color: c.greenMain }]}>Ver mi perfil</Text>
          </View>
          <FontAwesome name="chevron-right" size={11} color={c.textMuted} />
        </Pressable>

        <Pressable onPress={onLogout} style={styles.logout}>
          <FontAwesome name="sign-out" size={15} color="#EF4444" />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}

// =========================================================================
// SIDEBAR: fijo en pantallas anchas, deslizable (drawer) en celulares
// =========================================================================
export default function Sidebar({ permanent, visible, onClose, ...props }) {
  const { colors: c } = useTheme();
  const slide = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (permanent) return;
    if (visible) setMounted(true);
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 320 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      if (!visible) setMounted(false);
    });
  }, [visible, permanent]);

  if (permanent) {
    return (
      <View style={{ width: SIDEBAR_WIDTH }}>
        <SidebarContent {...props} open />
      </View>
    );
  }

  if (!mounted) return null;

  const navigateAndClose = (route) => {
    onClose();
    props.onNavigate(route);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: slide }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [
              { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-SIDEBAR_WIDTH - 20, 0] }) },
            ],
          },
        ]}
      >
        <SidebarContent {...props} onNavigate={navigateAndClose} open={visible} onClose={onClose} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  panel: { flex: 1, borderRightWidth: 1 },
  menu: { flex: 1, paddingHorizontal: 14, paddingTop: 18 },

  brand: {
    height: 120,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? 20 : 8,
    overflow: 'hidden',
    borderBottomRightRadius: 28,
  },
  brandLogo: { width: '86%', height: 56 },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logo: { width: 34, height: 34 },
  brandSmall: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  brandBig: { fontSize: 19, fontWeight: '800' },

  section: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10, marginLeft: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 4,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { transition: 'background-color 0.2s ease' } : {}),
  },
  activeBar: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 4, borderRadius: 2 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  itemText: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  soon: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  soonText: { color: '#B45309', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  themeText: { flex: 1, fontSize: 13, fontWeight: '600' },
  track: { width: 42, height: 24, borderRadius: 12, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },

  footer: { borderTopWidth: 1, paddingTop: 12, paddingBottom: 16, paddingHorizontal: 14, gap: 6 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  profileName: { fontSize: 13.5, fontWeight: '800' },
  profileLink: { fontSize: 11.5, fontWeight: '700', marginTop: 1 },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
});
