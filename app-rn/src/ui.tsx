// Sistema visual de QuickCoti (basado en el diseño SwiftUI "PyME NVIDIA": fondo claro, paneles blancos, títulos azul marino,
// acento índigo) + accesibilidad: tamaño de letra ajustable, alto contraste, botones grandes (modo sencillo),
// nombres y roles para VoiceOver, avisos que no dependen solo del color.
import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Icon, setIconColor, type IconName } from './icons';
import { PALETAS, elegirPaleta, modoVidrio, type Paleta } from './tema';
import { buzz, moneyA11y, stripEmoji, type A11y } from './a11y';

/** Paleta activa (cambia con el tema claro/oscuro y con "Alto contraste"). Paletas en tema.ts. */
export const C: Paleta = { ...PALETAS.claro };
/** Escala de letra, contraste y modo sencillo activos. */
export const T = { scale: 1, hc: false, simple: false, border: 1, dark: false, glass: true };
export function applyTheme(a: A11y, reducirTransparencia = false) {
  const r = elegirPaleta(a, reducirTransparencia);
  Object.assign(C, r.colores);
  T.scale = a.textScale || 1; T.hc = !!a.highContrast; T.simple = !!a.simple; T.border = a.highContrast ? 2 : 1;
  T.dark = r.oscuro; T.glass = r.vidrio;
  setIconColor(C.navy);
}
/** Tamaño de letra según el ajuste de la app (además, iOS aplica el tamaño de texto del sistema). */
export const fs = (n: number) => Math.round(n * T.scale);
const MAXF = 1.7; // tope del tamaño del sistema para que nada se desborde

// ─── Texto ───
export const H = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) =>
  <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={[{ fontSize: fs(21), fontWeight: '700', color: C.navy, marginBottom: 8 }, style]}>{children}</Text>;
export const P = ({ children, color, size, bold, style }: { children: React.ReactNode; color?: string; size?: number; bold?: boolean; style?: TextStyle }) =>
  <Text maxFontSizeMultiplier={MAXF} style={[{ color: color ?? C.text, fontSize: fs(size ?? 16), lineHeight: fs(size ?? 16) * 1.38, fontWeight: bold ? '700' : '400' }, style]}>{children}</Text>;
export const Small = ({ children, color, style }: { children: React.ReactNode; color?: string; style?: TextStyle }) =>
  <Text maxFontSizeMultiplier={MAXF} style={[{ color: color ?? C.sub, fontSize: fs(13), lineHeight: fs(13) * 1.35 }, style]}>{children}</Text>;

/** Encabezado grande de página (como PageHeader del diseño SwiftUI). */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={{ fontSize: fs(31), fontWeight: '800', color: C.navy, letterSpacing: -0.5 }}>{title}</Text>
        {subtitle ? <Text maxFontSizeMultiplier={MAXF} style={{ fontSize: fs(15), color: C.sub, marginTop: 4 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ─── Vidrio (Liquid Glass) ───
// expo-glass-effect se carga hasta que se usa: si faltó `pod install` o el iPhone tiene iOS < 26, no truena: usa un panel translúcido.
let Glass: { GlassView: any } | null | undefined;
function cargarGlass() {
  if (Glass === undefined) {
    try { const m = require('expo-glass-effect'); Glass = m?.isLiquidGlassAvailable?.() ? m : null; } catch { Glass = null; }
  }
  return Glass;
}
/** Superficie de vidrio: Liquid Glass real (iOS 26+), translúcida si no hay, y sólida con alto contraste o "Reducir transparencia". */
export function Vidrio({ children, style, radius = 22 }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; radius?: number }) {
  const g = T.glass ? cargarGlass() : null;
  const modo = modoVidrio(T.glass, !!g);
  const base: ViewStyle = { borderRadius: radius, overflow: 'hidden' };
  if (modo === 'liquid' && g) {
    const GV = g.GlassView;
    return <GV glassEffectStyle="regular" colorScheme={T.dark ? 'dark' : 'light'} style={[base, style]}>{children}</GV>;
  }
  if (modo === 'translucido') return <View style={[base, { backgroundColor: C.glassBg, borderWidth: 0.5, borderColor: C.glassLine }, style]}>{children}</View>;
  return <View style={[base, { backgroundColor: C.card, borderWidth: T.border, borderColor: T.hc ? C.line : C.hair }, style]}>{children}</View>;
}

/** Brillo suave de color arriba de la pantalla (para que el vidrio se note). No aparece con alto contraste. */
export function Fondo() {
  if (!T.glass) return null;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 440 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="qcGlow1" cx="12%" cy="0%" r="70%"><Stop offset="0" stopColor={C.glow1} stopOpacity={T.dark ? 0.42 : 0.3} /><Stop offset="1" stopColor={C.glow1} stopOpacity={0} /></RadialGradient>
          <RadialGradient id="qcGlow2" cx="100%" cy="38%" r="55%"><Stop offset="0" stopColor={C.glow2} stopOpacity={T.dark ? 0.16 : 0.28} /><Stop offset="1" stopColor={C.glow2} stopOpacity={0} /></RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#qcGlow1)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#qcGlow2)" />
      </Svg>
    </View>
  );
}

/** Contenedor de pantalla: respeta la muesca/Isla dinámica, pinta el brillo y deja espacio a la barra de pestañas flotante. */
export function Screen({ children, scroll = true, padTop = true, teclado = false }: { children: React.ReactNode; scroll?: boolean; padTop?: boolean; teclado?: boolean }) {
  const ins = useSafeAreaInsets();
  const tabH = React.useContext(BottomTabBarHeightContext) ?? 0;
  const pad = { padding: 20, paddingTop: padTop ? ins.top + 10 : 16, paddingBottom: tabH ? tabH + Math.max(ins.bottom - 6, 10) + 24 : 40 };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: C.bg }, pad]}><Fondo />{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Fondo />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={pad} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={teclado}>{children}</ScrollView>
    </View>
  );
}

// ─── Contenedores ───
export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: T.border, borderColor: T.hc ? C.line : C.hair }, style]}>{children}</View>
);
export const Row = ({ children, style, ...rest }: ViewProps & { children: React.ReactNode; style?: ViewStyle }) => <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;

export function IconChip({ name, color, bg, size = 42 }: { name: IconName; color?: string; bg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 13, backgroundColor: bg ?? C.soft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.5} color={color ?? C.pri} />
    </View>
  );
}

// ─── Botones ───
type Kind = 'pri' | 'sec' | 'bad' | 'ghost';
export function Btn({ title, onPress, kind = 'pri', disabled, loading, icon, hint, a11yLabel, style }:
  { title: string; onPress: () => void; kind?: Kind; disabled?: boolean; loading?: boolean; icon?: IconName; hint?: string; a11yLabel?: string; style?: ViewStyle }) {
  const bg = kind === 'pri' ? C.pri : kind === 'bad' ? C.badFill : kind === 'sec' ? C.soft : 'transparent';
  const fg = kind === 'pri' ? C.onPri : kind === 'bad' ? '#FFFFFF' : T.hc ? C.priDark : C.pri;
  const label = stripEmoji(a11yLabel ?? title);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={() => { buzz('tap'); onPress(); }} disabled={disabled || loading}
      style={({ pressed }) => [{
        minHeight: T.simple ? 64 : 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginVertical: 5,
        backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.82 : 1, flexDirection: 'row', gap: 8,
        borderWidth: T.hc && (kind === 'sec' || kind === 'ghost') ? 2 : 0, borderColor: C.navy,
      }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <>
        {icon ? <Icon name={icon} size={fs(20)} color={fg} /> : null}
        <Text maxFontSizeMultiplier={1.5} style={{ fontSize: fs(T.simple ? 18 : 16), fontWeight: '700', color: fg, textAlign: 'center', flexShrink: 1 }}>{title}</Text>
      </>}
    </Pressable>
  );
}

/** Botón redondo solo con ícono (siempre con nombre para VoiceOver). */
export function IconButton({ icon, label, onPress, size = 46, filled, disabled, color }:
  { icon: IconName; label: string; onPress: () => void; size?: number; filled?: boolean; disabled?: boolean; color?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled}
      hitSlop={8} onPress={() => { buzz('tap'); onPress(); }}
      style={({ pressed }) => ({ width: Math.max(44, size), height: Math.max(44, size), borderRadius: 14, alignItems: 'center', justifyContent: 'center',
        backgroundColor: filled ? C.pri : C.card, borderWidth: T.border, borderColor: T.hc ? C.line : C.hair, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 })}>
      <Icon name={icon} size={size * 0.48} color={filled ? C.onPri : color ?? C.navy} />
    </Pressable>
  );
}

/** Botón de micrófono grande (centro de Inicio y de Hermes). */
export function MicButton({ size = 124, listening, onPress, label, hint }: { size?: number; listening?: boolean; onPress: () => void; label: string; hint?: string }) {
  const boton = (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ busy: !!listening }}
      onPress={() => { buzz('tap'); onPress(); }}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: listening ? C.badFill : C.pri, opacity: pressed ? 0.85 : 1,
        shadowColor: listening ? C.bad : C.pri, shadowOpacity: T.glass ? 0 : 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
        borderWidth: T.hc ? 3 : 0, borderColor: C.navy })}>
      <Icon name={listening ? 'stop' : 'mic'} size={size * 0.42} color={listening ? '#FFFFFF' : C.onPri} strokeWidth={2.2} />
    </Pressable>
  );
  if (!T.glass) return boton; // alto contraste / reducir transparencia: botón sólido como siempre
  const aro = Math.max(5, Math.round(size * 0.09));
  return <Vidrio radius={size / 2 + aro} style={{ padding: aro }}>{boton}</Vidrio>;
}

// ─── Formularios ───
export const Field = (p: TextInputProps & { label?: string; warn?: boolean; hint?: string; containerStyle?: ViewStyle }) => (
  <View style={[{ marginBottom: 10 }, p.containerStyle]}>
    {p.label ? <Text maxFontSizeMultiplier={MAXF} style={{ fontSize: fs(13), fontWeight: '600', color: C.sub, marginBottom: 5 }}>{p.label}</Text> : null}
    <TextInput placeholderTextColor={C.placeholder} keyboardAppearance={T.dark ? 'dark' : 'light'} maxFontSizeMultiplier={1.6}
      accessibilityLabel={p.accessibilityLabel ?? p.label ?? p.placeholder}
      accessibilityHint={p.warn ? 'Revisa este dato: la IA no lo leyó con seguridad.' : p.hint}
      {...p}
      style={[{ borderWidth: p.warn ? 2 : T.border, borderColor: p.warn ? C.warn : T.hc ? C.line : C.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12,
        fontSize: fs(16), backgroundColor: p.warn ? C.warnBg : C.field, color: C.text, minHeight: 48 }, p.style]} />
    {p.warn ? <Text maxFontSizeMultiplier={MAXF} style={{ fontSize: fs(12), color: C.warn, fontWeight: '700', marginTop: 3 }} importantForAccessibility="no">⚠︎ Revisa este dato</Text> : null}
  </View>
);

/** Interruptor accesible: toda la fila se toca y VoiceOver la anuncia como "interruptor, activado". */
export function ToggleRow({ label, value, onChange, hint, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={stripEmoji(label)} accessibilityHint={hint} accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled} onPress={() => { buzz('tap'); onChange(!value); }}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, minHeight: 52, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <P>{label}</P>
        {hint ? <Small>{hint}</Small> : null}
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch value={value} onValueChange={(v) => { buzz('tap'); onChange(v); }} disabled={disabled} trackColor={{ true: C.pri, false: T.hc ? '#6B7280' : T.dark ? '#4A5572' : '#D1D5DB' }} />
      </View>
    </Pressable>
  );
}

/** Selector de una opción (tamaño de letra, periodicidad…), con semántica de radio para VoiceOver. */
export function Segmented<V extends string | number>({ options, value, onChange, label }: { options: { v: V; label: string }[]; value: V; onChange: (v: V) => void; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <Pressable key={String(o.v)} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ checked: on }}
            onPress={() => { buzz('tap'); onChange(o.v); }}
            style={{ flexGrow: 1, minHeight: 48, paddingHorizontal: 12, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? C.pri : C.card, borderWidth: on ? 0 : T.hc ? 2 : 1, borderColor: T.hc ? C.navy : C.line }}>
            <Text maxFontSizeMultiplier={1.5} style={{ fontSize: fs(15), fontWeight: '700', color: on ? C.onPri : C.navy }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Opción A/B/C como en el onboarding del diseño de referencia. */
export function OptionButton({ letter, label, selected, onPress, multi, hint }: { letter: string; label: string; selected: boolean; onPress: () => void; multi?: boolean; hint?: string }) {
  return (
    <Pressable accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityLabel={`Opción ${letter}: ${stripEmoji(label)}`} accessibilityHint={hint}
      accessibilityState={{ checked: selected }} onPress={() => { buzz('tap'); onPress(); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, minHeight: T.simple ? 64 : 56, borderRadius: 16, marginBottom: 10,
        backgroundColor: C.card, borderWidth: selected ? 2 : T.border, borderColor: selected ? C.pri : T.hc ? C.line : C.hair, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: selected ? C.pri : C.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontWeight: '800', fontSize: fs(16), color: selected ? C.onPri : C.pri }}>{letter}</Text>
      </View>
      <Text maxFontSizeMultiplier={1.6} style={{ flex: 1, fontSize: fs(16), fontWeight: '600', color: selected ? C.pri : C.navy }}>{label}</Text>
      {selected ? <Icon name="check" size={22} color={C.pri} /> : null}
    </Pressable>
  );
}

/** Fila de lista (movimientos, productos): un solo elemento para VoiceOver con todo su contenido. */
export function ListRow({ icon, iconColor, iconBg, title, subtitle, value, valueA11y, valueColor, onPress }:
  { icon: IconName; iconColor?: string; iconBg?: string; title: string; subtitle?: string; value?: string; valueA11y?: string; valueColor?: string; onPress?: () => void }) {
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
      <IconChip name={icon} color={iconColor} bg={iconBg} />
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={MAXF} numberOfLines={2} style={{ fontSize: fs(15), fontWeight: '700', color: C.navy }}>{title}</Text>
        {subtitle ? <Small>{subtitle}</Small> : null}
      </View>
      {value ? <Text maxFontSizeMultiplier={1.5} style={{ fontSize: fs(15), fontWeight: '800', color: valueColor ?? C.navy }}>{value}</Text> : null}
      {onPress ? <Icon name="chevron" size={18} color={C.sub} /> : null}
    </View>
  );
  const a11y = [stripEmoji(title), subtitle ? stripEmoji(subtitle) : '', valueA11y ?? value ?? ''].filter(Boolean).join('. ');
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={() => { buzz('tap'); onPress(); }} style={({ pressed }) => [cardStyle(), { opacity: pressed ? 0.85 : 1 }]}>{body}</Pressable>
    : <View accessible accessibilityLabel={a11y} style={cardStyle()}>{body}</View>;
}
const cardStyle = (): ViewStyle => ({ backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: T.border, borderColor: T.hc ? C.line : C.hair });

/** Acceso rápido del Inicio. */
export function Tile({ icon, title, subtitle, onPress, alert, full }: { icon: IconName; title: string; subtitle?: string; onPress: () => void; alert?: boolean; full?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[stripEmoji(title), subtitle ? stripEmoji(subtitle) : ''].filter(Boolean).join('. ')}
      onPress={() => { buzz('tap'); onPress(); }}
      style={({ pressed }) => ({ width: full ? '100%' : '48.5%', minHeight: T.simple ? 120 : 108, backgroundColor: C.card, borderRadius: 20, padding: 14, marginBottom: 10,
        borderWidth: alert ? 2 : T.border, borderColor: alert ? C.bad : T.hc ? C.line : C.hair, opacity: pressed ? 0.85 : 1, justifyContent: 'space-between' })}>
      <IconChip name={icon} color={alert ? C.bad : C.pri} bg={alert ? C.badBg : C.soft} />
      <View style={{ marginTop: 10 }}>
        <Text maxFontSizeMultiplier={1.5} style={{ fontSize: fs(16), fontWeight: '800', color: C.navy }}>{title}</Text>
        {subtitle ? <Text maxFontSizeMultiplier={1.5} numberOfLines={2} style={{ fontSize: fs(12.5), color: alert ? C.bad : C.sub, marginTop: 2, fontWeight: alert ? '700' : '400' }}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Barra de progreso con valor para VoiceOver. */
export function ProgressBar({ value, label, color }: { value: number; label: string; color?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: pct, text: `${pct} por ciento` }}
      style={{ height: 10, backgroundColor: C.track, borderRadius: 99, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(3, pct)}%`, height: 10, backgroundColor: color ?? C.pri, borderRadius: 99 }} />
    </View>
  );
}

// ─── Avisos (ícono + texto: nunca solo color) ───
/** Pregunta antes de algo que no se deshace (una venta o compra registrada ya no se modifica). true si la persona confirma. */
export function confirmar(titulo: string, mensaje: string, si: string, no = 'Revisar'): Promise<boolean> {
  return new Promise((resolve) => Alert.alert(titulo, mensaje, [
    { text: no, style: 'cancel', onPress: () => resolve(false) },
    { text: si, onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}

export const Banner = ({ text, color, kind }: { text: string; color?: string; kind?: 'warn' | 'bad' | 'ok' | 'info' }) => {
  const k = kind ?? (color === C.bad ? 'bad' : color === C.ok ? 'ok' : 'warn');
  const fg = color ?? (k === 'bad' ? C.bad : k === 'ok' ? C.ok : k === 'info' ? C.pri : C.warn);
  const bg = k === 'bad' ? C.badBg : k === 'ok' ? C.okBg : k === 'info' ? C.soft : C.warnBg;
  return (
    <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={stripEmoji(text)}
      style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: T.hc ? 2 : 1, borderColor: fg, backgroundColor: bg, borderRadius: 14, padding: 12, marginBottom: 12 }}>
      <Icon name={k === 'ok' ? 'check' : k === 'info' ? 'sparkles' : 'alert'} size={20} color={fg} />
      <Text maxFontSizeMultiplier={MAXF} style={{ flex: 1, color: fg, fontWeight: '600', fontSize: fs(14.5), lineHeight: fs(14.5) * 1.35 }}>{text}</Text>
    </View>
  );
};

/** Monto grande con lectura correcta en pesos. */
export const Amount = ({ n, size = 24, color }: { n: number; size?: number; color?: string }) => (
  <Text accessibilityLabel={moneyA11y(n)} maxFontSizeMultiplier={1.4} style={{ fontSize: fs(size), fontWeight: '800', color: color ?? C.navy }}>
    {'$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  </Text>
);

// ─── Varios conceptos en una sola cotización / renta (ej. 50 sillas + 5 mesas + 1 inflable) ───
export type Linea = { id: string; desc: string; qty: string; price: string; productId?: string };
export const nuevaLinea = (): Linea => ({ id: Math.random().toString(36).slice(2), desc: '', qty: '1', price: '' });
export const lineaImporte = (l: Linea) => (parseFloat(l.qty.replace(',', '.')) || 0) * (parseFloat(l.price.replace(',', '.')) || 0);
export const totalLineas = (ls: Linea[]) => Math.round(ls.reduce((a, l) => a + lineaImporte(l), 0) * 100) / 100;
export const lineasValidas = (ls: Linea[]) => ls.filter((l) => l.desc.trim() && lineaImporte(l) > 0);
export const resumenLineas = (ls: Linea[]) => lineasValidas(ls).map((l) => `${l.qty} ${l.desc.trim()}`).join(', ');
const fmt = (n: number) => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LineasEditor({ lineas, onChange, placeholder = 'Ej. Sillas', pasos = false, textoAgregar = 'Agregar otro concepto' }:
  { lineas: Linea[]; onChange: (l: Linea[]) => void; placeholder?: string; pasos?: boolean; textoAgregar?: string }) {
  const upd = (id: string, k: keyof Linea, v: string) => onChange(lineas.map((l) => (l.id === id ? { ...l, [k]: v } : l)));
  const quitar = (id: string) => onChange(lineas.length > 1 ? lineas.filter((x) => x.id !== id) : [nuevaLinea()]);
  const cant = (l: Linea) => parseFloat(l.qty.replace(',', '.')) || 0;
  const inp: TextStyle = { borderWidth: T.border, borderColor: C.line, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 10, fontSize: fs(16), backgroundColor: C.field, color: C.text, minHeight: 46 };
  const teclado = T.dark ? 'dark' as const : 'light' as const;
  return (
    <View>
      {!pasos && (
        <Row style={{ marginBottom: 4 }}>
          <View style={{ width: 58 }}><Small>Cant.</Small></View><View style={{ flex: 1 }}><Small>Concepto</Small></View><View style={{ width: 88 }}><Small>Precio c/u</Small></View><View style={{ width: 44 }} />
        </Row>
      )}
      {lineas.map((l, i) => pasos ? (
        // Modo venta: artículo arriba; abajo − cantidad + · precio c/u · importe (cabe en un iPhone).
        <View key={l.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: T.border, borderColor: C.line }}>
          <Row>
            <TextInput accessibilityLabel={`Artículo, renglón ${i + 1}`} placeholder={placeholder} placeholderTextColor={C.placeholder} keyboardAppearance={teclado} value={l.desc} onChangeText={(v) => upd(l.id, 'desc', v)} style={[inp, { flex: 1 }]} maxFontSizeMultiplier={1.5} />
            <IconButton icon="close" label={`Quitar ${l.desc || `renglón ${i + 1}`}`} size={44} color={C.bad} onPress={() => quitar(l.id)} />
          </Row>
          <Row style={{ marginTop: 8 }}>
            <IconButton icon="minus" label={`Uno menos de ${l.desc || `renglón ${i + 1}`}`} size={40} onPress={() => upd(l.id, 'qty', String(Math.max(1, cant(l) - 1)))} />
            <TextInput accessibilityLabel={`Cantidad de ${l.desc || `renglón ${i + 1}`}`} keyboardType="decimal-pad" keyboardAppearance={teclado} value={l.qty} onChangeText={(v) => upd(l.id, 'qty', v)} style={[inp, { width: 52, textAlign: 'center', paddingHorizontal: 4 }]} maxFontSizeMultiplier={1.4} />
            <IconButton icon="plus" label={`Uno más de ${l.desc || `renglón ${i + 1}`}`} size={40} onPress={() => upd(l.id, 'qty', String(cant(l) + 1))} />
            <TextInput accessibilityLabel={`Precio por pieza de ${l.desc || `renglón ${i + 1}`}`} keyboardType="decimal-pad" placeholder="$ c/u" placeholderTextColor={C.placeholder} keyboardAppearance={teclado} value={l.price} onChangeText={(v) => upd(l.id, 'price', v)} style={[inp, { width: 84 }]} maxFontSizeMultiplier={1.4} />
            <Text accessibilityLabel={`Importe ${moneyA11y(lineaImporte(l))}`} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.4} style={{ flex: 1, textAlign: 'right', fontSize: fs(15), fontWeight: '800', color: C.navy }}>{fmt(lineaImporte(l))}</Text>
          </Row>
        </View>
      ) : (
        <View key={l.id} style={{ marginBottom: 8 }}>
          <Row>
            <TextInput accessibilityLabel={`Cantidad, renglón ${i + 1}`} keyboardType="decimal-pad" value={l.qty} onChangeText={(v) => upd(l.id, 'qty', v)} style={[inp, { width: 58 }]} maxFontSizeMultiplier={1.5} />
            <TextInput accessibilityLabel={`Concepto, renglón ${i + 1}`} placeholder={placeholder} placeholderTextColor={C.placeholder} keyboardAppearance={teclado} value={l.desc} onChangeText={(v) => upd(l.id, 'desc', v)} style={[inp, { flex: 1 }]} maxFontSizeMultiplier={1.5} />
            <TextInput accessibilityLabel={`Precio por pieza, renglón ${i + 1}`} keyboardType="decimal-pad" placeholder="$" placeholderTextColor={C.placeholder} keyboardAppearance={teclado} value={l.price} onChangeText={(v) => upd(l.id, 'price', v)} style={[inp, { width: 88 }]} maxFontSizeMultiplier={1.5} />
            <IconButton icon="close" label={`Quitar renglón ${i + 1}`} size={44} color={C.bad} onPress={() => quitar(l.id)} />
          </Row>
          {lineaImporte(l) > 0 && <Small style={{ marginTop: 3 }}>= {fmt(lineaImporte(l))}</Small>}
        </View>
      ))}
      <Btn title={textoAgregar} icon="plus" kind="ghost" onPress={() => onChange([...lineas, nuevaLinea()])} />
      <Row style={{ justifyContent: 'space-between', borderTopWidth: T.border, borderColor: C.line, paddingTop: 10 }}>
        <P bold>{pasos ? 'Total' : 'Subtotal'}</P><Amount n={totalLineas(lineas)} size={19} />
      </Row>
    </View>
  );
}
