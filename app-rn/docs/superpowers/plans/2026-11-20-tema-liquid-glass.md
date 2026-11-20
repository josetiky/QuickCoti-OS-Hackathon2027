# Tema claro/oscuro + Liquid Glass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tema claro (predeterminado) y oscuro premium seleccionable en Accesibilidad, con Liquid Glass mínimo en la barra de pestañas, el micrófono y la tarjeta "Ventas de hoy".

**Architecture:** Paletas y reglas en un módulo puro `src/tema.ts` (probado con tsx, incluida una prueba de contraste WCAG). `ui.tsx` aplica la paleta elegida al objeto mutable `C` como hoy. Un componente `Vidrio` carga `expo-glass-effect` de forma perezosa y cae a un panel translúcido o sólido.

**Tech Stack:** Expo SDK 58, React Native, React Navigation 7, expo-glass-effect ~58.0.5, react-native-svg (ya instalado), tsx.

**Spec:** `docs/superpowers/specs/2026-11-20-tema-liquid-glass-design.md`

## Global Constraints
- Tema predeterminado `'claro'`; el oscuro solo se activa en Accesibilidad; no sigue el modo oscuro del iPhone.
- Contraste AA ≥ 4.5:1 en texto para las 4 paletas (claro, oscuro, contraste claro, contraste oscuro).
- Vidrio solo en: barra de pestañas, botón de micrófono, tarjeta "Ventas de hoy". Sin vidrio ni brillo con alto contraste o con "Reducir transparencia".
- `expo-glass-effect` solo con `require` perezoso dentro de try/catch; ningún `import` de valor en el nivel superior.
- No cambian funciones, flujos ni textos (excepto el selector "Tema").
- El QR de CoDi siempre negro sobre blanco.
- Sin commits de git (evento/ no está rastreado; la carpeta conectada no permite borrar locks).

## Review Focus
- `<Text>` sin color explícito → negro sobre fondo oscuro (invisible). Prueba: Task 2, paso de grep de `<Text` sin `color`.
- La barra flotante tapa el último elemento de las pantallas o el campo de texto de Hermes. Prueba: Task 3, padding con `BottomTabBarHeightContext` y revisión de AssistantScreen.
- QR sobre fondo oscuro → no se puede escanear. Prueba: Task 2, contenedor del QR en blanco fijo.
- Cambiar de tema saca al usuario de la pantalla en la que estaba. Prueba: Task 2, `themeKey` incluye el tema y conserva `nav.current`.
- iOS < 26 o sin `pod install`: el vidrio no debe tumbar la app. Prueba: Task 1 `modoVidrio` + Task 3 require perezoso.

---

### Task 1: Paletas y reglas del tema (puro)

**Files:** Create `src/tema.ts`, `src/tema.selftest.ts`; Modify `package.json` (script `"test:tema": "npx tsx src/tema.selftest.ts"`).

**Interfaces — Produces:**
- `type Tema = 'claro' | 'oscuro'`; `const TEMA_PREDETERMINADO: Tema = 'claro'`
- `type Paleta = { bg, card, navy, text, sub, pri, priDark, onPri, soft, field, ok, okBg, warn, warnBg, bad, badBg, badFill, line, hair, track, placeholder, glassBg, glassLine, glow1, glow2: string }` (los de vidrio y `hair` pueden ser rgba; el resto #RRGGBB)
- `const PALETAS: { claro, oscuro, contrasteClaro, contrasteOscuro: Paleta }` — claro = valores actuales de `NORMAL`; contrasteClaro = `CONTRAST` actual; oscuro parte del dibujo B (bg #0E1424, navy/text marfil, pri #D8BE8A, onPri #13213F, badFill #B91C1C); contrasteOscuro = negro puro, texto blanco, line #FFFFFF.
- `contraste(a: string, b: string): number` (WCAG 2.x, #RRGGBB)
- `elegirPaleta(a: { theme?: Tema; highContrast: boolean }, reducirTransparencia: boolean): { colores: Paleta; oscuro: boolean; vidrio: boolean }` (theme ausente = claro)
- `modoVidrio(vidrio: boolean, liquidDisponible: boolean): 'liquid' | 'translucido' | 'solido'`

- [ ] Step 1: pruebas — `contraste('#000000','#FFFFFF')≈21`, `contraste('#777777','#FFFFFF')≈4.48` (±0.01) y simétrica; `TEMA_PREDETERMINADO==='claro'`; `elegirPaleta({highContrast:false},false)` → claro, oscuro=false, vidrio=true; oscuro → PALETAS.oscuro, vidrio=true; oscuro+HC → contrasteOscuro, vidrio=false; claro+HC → contrasteClaro, vidrio=false; reducirTransparencia → vidrio=false; las 4 paletas con las mismas llaves; en cada paleta ≥4.5: text/bg, text/card, navy/bg, navy/card, sub/bg, sub/card, onPri/pri, pri/bg, pri/soft, priDark/soft, ok/okBg, warn/warnBg, bad/badBg, #FFFFFF/badFill, warn/card, bad/card, text/field; `modoVidrio(true,true)==='liquid'`, `(true,false)==='translucido'`, `(false,true)==='solido'`.
- [ ] Step 2: `tsx src/tema.selftest.ts` → FAIL (módulo no existe)
- [ ] Step 3: implementar `src/tema.ts` sin imports de React Native
- [ ] Step 4: `tsx src/tema.selftest.ts` → `OK tema`, exit 0

### Task 2: Tema en toda la app (sin vidrio)

**Files:** Modify `src/a11y.ts`, `src/ui.tsx`, `src/icons.tsx`, `App.tsx`, `src/screens/A11yScreen.tsx`, `src/screens/InterviewScreen.tsx:185`, `src/screens/More.tsx:66`, `src/screens/SaleScreen.tsx:119,154`, `src/screens/Extras.tsx:59`, y `<Text>` sin color que salgan en el grep.

**Interfaces — Consumes:** Task 1. **Produces:** `A11y.theme: Tema`; `vigilarTransparencia(cb: (v: boolean) => void): () => void` en a11y.ts; `applyTheme(a: A11y, reducirTransparencia?: boolean)`; `T.dark: boolean`, `T.glass: boolean`; `setIconColor(c: string)` en icons.tsx.

- [ ] Step 1: `ui.tsx` toma `PALETAS`/`elegirPaleta`; `#FFFFFF` sobre `C.pri` → `C.onPri` (Btn pri, IconButton filled, MicButton, Segmented, OptionButton); Btn/MicButton peligro usan `C.badFill`; ProgressBar → `C.track`; placeholders → `C.placeholder`; Field y LineasEditor `keyboardAppearance` según `T.dark`; Switch apagado → `C.track`.
- [ ] Step 2: App: `StatusBar style={T.dark?'light':'dark'}`; tema de navegación desde `DarkTheme` si `T.dark`; `themeKey` incluye `theme` y reducir transparencia; estado de `vigilarTransparencia`.
- [ ] Step 3: A11yScreen: `Segmented label="Tema"` con `[{v:'claro',label:'Claro'},{v:'oscuro',label:'Oscuro'}]` arriba de "Alto contraste".
- [ ] Step 4: pantallas: textos sobre `C.pri` → `C.onPri`; QR con fondo `#FFFFFF` fijo; `<Text>` sin color → color de la paleta.
- [ ] Step 5: verificar — `tsc --noEmit` solo 2 preexistentes; `tsx src/tema.selftest.ts` OK; `grep -n "#FFFFFF\|'#fff'" src/screens` solo QR/OCR; grep de `<Text` sin `color` revisado a mano.

### Task 3: Vidrio, brillo y pestañas flotantes

**Files:** Modify `package.json` (+`"expo-glass-effect": "~58.0.5"`, paquete copiado a node_modules), `src/ui.tsx` (`Vidrio`, `Fondo`, Screen), `App.tsx` (Tabs), `src/screens/Lists.tsx` (tarjeta Ventas de hoy), `src/screens/More.tsx` (AssistantScreen padding).

**Interfaces — Consumes:** Task 1 `modoVidrio`; Task 2 `T.glass`, `T.dark`, `C.glassBg/glassLine/glow1/glow2`. **Produces:** `Vidrio({ children, style, radius }: { children?: React.ReactNode; style?: ViewStyle; radius?: number })`, `Fondo()`.

- [ ] Step 1: `Vidrio`: require perezoso de `expo-glass-effect` (try/catch, cache); `modoVidrio(T.glass, isLiquidGlassAvailable())`; liquid → `GlassView` (`glassEffectStyle="regular"`, `colorScheme` según tema); translúcido → `View` con `C.glassBg` y borde `C.glassLine`; sólido → `C.card` con borde de alto contraste.
- [ ] Step 2: `Fondo`: dos manchas `RadialGradient` (react-native-svg) arriba con `C.glow1/glow2`; nada si `!T.glass`. Screen lo pinta detrás del contenido y suma la altura de la barra (`BottomTabBarHeightContext`) al padding inferior.
- [ ] Step 3: Tabs: barra flotante (píldora, `position:'absolute'`, márgenes 16, radio 32, `tabBarBackground` = `Vidrio`, `safeAreaInsets={{bottom:0}}` y `bottom` según safe area); Home: "Ventas de hoy" en `Vidrio`; MicButton con anillo de `Vidrio`; AssistantScreen deja espacio a la barra.
- [ ] Step 4: verificar — `tsc` solo 2 preexistentes; suite completa (tema, titular, almacén, reglas) OK; `grep -rn "from 'expo-glass-effect'" src` solo `import type`.
