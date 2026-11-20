// QuickCoti OS — la app se arma según el perfil del negocio que generan Hermes + Configurador.
// Diseño: tema "PyME NVIDIA" (paneles blancos, títulos azul marino, acento índigo) con ajustes de accesibilidad.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useStore } from './src/store';
import { applyTheme, Btn, C, fs, T, Vidrio } from './src/ui';
import { Atrapa } from './src/screens/Atrapa';
import { Icon, type IconName } from './src/icons';
import { detectSystemA11y, setA11yRuntime, vigilarTransparencia } from './src/a11y';
import InterviewScreen from './src/screens/InterviewScreen';
import ReceiptFlowScreen from './src/screens/ReceiptFlowScreen';
import SaleScreen from './src/screens/SaleScreen';
import { HomeScreen, InventoryScreen, PurchasesScreen, QuotesScreen, SalesScreen } from './src/screens/Lists';
import { AssistantScreen, AuditScreen, SettingsScreen } from './src/screens/More';
import { DeliveriesScreen, RentalsScreen } from './src/screens/Extras';
import A11yScreen from './src/screens/A11yScreen';
import { RegistroTitularScreen, TitularScreen } from './src/screens/TitularScreen';
import EstadisticasScreen from './src/screens/EstadisticasScreen';
import { CotizacionScreen, PorCobrarScreen } from './src/screens/Cotizaciones';

const Stack = createNativeStackNavigator();

/** Compras con foto dentro de una red de seguridad: si algo truena al leer el ticket, mensaje y opciones (no se cierra la app). */
function ReceiptSeguro(props: any) {
  const [vez, setVez] = useState(0);
  const [manual, setManual] = useState(false);
  return (
    <Atrapa key={vez} titulo="No pude leer este ticket" mensaje="Algo falló al leer la foto y no se guardó nada. Intenta con otra foto o captúralo a mano."
      textoReintentar="Intentar con otra foto" onReintentar={() => { setManual(false); setVez((v) => v + 1); }}
      extra={<Btn title="Capturar a mano" kind="sec" icon="pen" onPress={() => { setManual(true); setVez((v) => v + 1); }} />}
      onSalir={() => props.navigation.goBack()}>
      <ReceiptFlowScreen {...props} manual={manual} />
    </Atrapa>
  );
}
const Tab = createBottomTabNavigator();
const icon = (name: IconName) => ({ color }: { color: string }) => <Icon name={name} size={T.simple ? 28 : 24} color={color} />;

function Tabs() {
  const p = useStore((s) => s.profile)!;
  const t = p.terminology;
  const ins = useSafeAreaInsets();
  const alto = T.simple ? 72 : 64;
  // Máximo 5 pestañas (más se vuelve difícil de tocar y de leer): Cotizar, Rentas y Entregas viven en Inicio.
  return (
    <Tab.Navigator id="tabs" safeAreaInsets={{ bottom: 0 }} screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: C.pri, tabBarInactiveTintColor: C.sub,
      // Barra flotante de vidrio: Liquid Glass en iOS 26+, translúcida o sólida (alto contraste) si no.
      tabBarStyle: { position: 'absolute', left: 16, right: 16, bottom: Math.max(ins.bottom - 6, 10), height: alto, borderRadius: alto / 2,
        borderTopWidth: 0, backgroundColor: 'transparent', elevation: 0, paddingTop: 6, paddingBottom: 8,
        shadowColor: '#000', shadowOpacity: T.glass ? (T.dark ? 0.35 : 0.1) : 0, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      tabBarBackground: () => <Vidrio radius={alto / 2} style={StyleSheet.absoluteFill} />,
      tabBarLabelStyle: { fontSize: fs(T.simple ? 12 : 11), fontWeight: '700' },
      tabBarAllowFontScaling: false,
    }}>
      <Tab.Screen name="Inicio" component={HomeScreen} options={{ tabBarIcon: icon('home'), title: 'Inicio' }} />
      <Tab.Screen name="Ventas" component={SalesScreen} options={{ tabBarIcon: icon('cash'), title: t.sale + 's' }} />
      <Tab.Screen name="Compras" component={PurchasesScreen} options={{ tabBarIcon: icon('cart'), title: t.purchase }} />
      {p.modules.inventory && <Tab.Screen name="Inventario" component={InventoryScreen} options={{ tabBarIcon: icon('box'), title: t.stock }} />}
      <Tab.Screen name="Asistente" component={AssistantScreen} options={{ tabBarIcon: icon('sparkles'), title: 'Hermes', tabBarAccessibilityLabel: 'Hermes, asistente por voz' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const profile = useStore((s) => s.profile);
  const a11y = useStore((s) => s.a11y);
  const detected = useStore((s) => s.a11yDetected);
  const titular = useStore((s) => s.titular);
  const titularCargado = useStore((s) => s.titularCargado);
  const [reducirT, setReducirT] = useState(false); // "Reducir transparencia" del iPhone
  const [vezApp, setVezApp] = useState(0); // red de seguridad general: al reintentar se vuelve a armar la navegación
  applyTheme(a11y, reducirT); setA11yRuntime(a11y);
  const nav = useRef<any>(undefined);
  useEffect(() => vigilarTransparencia(setReducirT), []);
  useEffect(() => { useStore.getState().iniciarTitular(); }, []); // datos del titular: llavero (Keychain)
  useEffect(() => { if (!detected) detectSystemA11y().then((d) => useStore.getState().setA11y(d, true)).catch(() => {}); }, [detected]);
  // Al cambiar letra/contraste se redibuja todo sin perder la pantalla en la que estás.
  const themeKey = `${a11y.textScale}-${a11y.highContrast}-${a11y.simple}-${a11y.theme ?? 'claro'}-${reducirT}`;
  const base = T.dark ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: C.bg, card: C.bg, primary: C.pri, text: C.navy, border: C.line } };
  if (!titularCargado) return (
    <SafeAreaProvider><View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={C.pri} accessibilityLabel="Cargando QuickCoti" />
    </View></SafeAreaProvider>
  );
  return (
    <SafeAreaProvider>
      <StatusBar style={T.dark ? 'light' : 'dark'} />
      <Atrapa key={vezApp} onReintentar={() => { nav.current = undefined; setVezApp((v) => v + 1); }}>
      <NavigationContainer key={themeKey} theme={navTheme} initialState={profile ? nav.current : undefined} onStateChange={(s) => { nav.current = s; }}>
        <Stack.Navigator id="root" screenOptions={{
          headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false, headerTintColor: C.pri, headerBackTitle: 'Atrás',
          headerTitleStyle: { color: C.navy, fontWeight: '700', fontSize: fs(17) }, contentStyle: { backgroundColor: C.bg },
        }}>
          {!profile ? (
            <Stack.Screen name="Onboarding" component={InterviewScreen} options={{ headerShown: false }} />
          ) : !titular ? (
            // Hay negocio pero faltan los datos del titular (instalación previa o datos borrados): registro obligatorio.
            <Stack.Screen name="RegistroTitular" component={RegistroTitularScreen} options={{ headerShown: false }} />
          ) : (
            <>
              <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }}
                key={`${profile.modules.inventory}-${profile.modules.quotes}-${profile.modules.rentals}-${profile.modules.delivery}-${profile.terminology.sale}`} />
              <Stack.Screen name="Receipt" component={ReceiptSeguro} options={{ presentation: 'modal', title: profile.terminology.purchase + ' con foto' }} />
              <Stack.Screen name="Sale" component={SaleScreen} options={{ title: 'Cobrar' }} />
              <Stack.Screen name="Cotizar" component={QuotesScreen} options={{ title: 'Cotizar' }} />
              <Stack.Screen name="Rentas" component={RentalsScreen} options={{ title: 'Rentas' }} />
              <Stack.Screen name="Entregas" component={DeliveriesScreen} options={{ title: 'Entregas a domicilio' }} />
              <Stack.Screen name="Audit" component={AuditScreen} options={{ title: 'Cumplimiento' }} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes y modelos de IA' }} />
              <Stack.Screen name="A11y" component={A11yScreen} options={{ title: 'Accesibilidad' }} />
              <Stack.Screen name="Titular" component={TitularScreen} options={{ title: 'Mis datos' }} />
              <Stack.Screen name="Estadisticas" component={EstadisticasScreen} options={{ title: 'Estadísticas' }} />
              <Stack.Screen name="PorCobrar" component={PorCobrarScreen} options={{ title: 'Por cobrar' }} />
              <Stack.Screen name="Cotizacion" component={CotizacionScreen} options={{ title: 'Cotización' }} />
              <Stack.Screen name="Interview" options={{ presentation: 'modal', headerShown: false }}>
                {({ navigation }) => <InterviewScreen onDone={() => navigation.goBack()} />}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      </Atrapa>
    </SafeAreaProvider>
  );
}
