# Tema claro/oscuro + Liquid Glass mínimo — diseño corto

## Por qué
Que QuickCoti se vea elegante y premium ("VIP") para el Hackathon Oaxaca 2027, sin cambiar funciones y sin perder lo que ya presentamos de accesibilidad.

## Metas
- **Tema Claro (predeterminado)** = dirección A "claro cristal": fondo claro con un brillo índigo suave arriba, vidrio blanco.
- **Tema Oscuro** = dirección B "oscuro premium": azul marino casi negro, texto marfil, acentos champaña, vidrio ahumado.
- **Selector "Tema: Claro / Oscuro"** en Accesibilidad; se guarda; no sigue el modo oscuro del iPhone (decisión de Tiki: claro por defecto).
- **Liquid Glass solo en lo flotante:** barra de pestañas (píldora flotante), botón de micrófono y tarjeta "Ventas de hoy". El resto hereda colores, con menos bordes.
- **Alto contraste en ambos temas:** claro = paleta de alto contraste actual; oscuro = negro puro, texto blanco, bordes gruesos. Con alto contraste no hay vidrio ni brillo.
- **"Reducir transparencia" del iPhone** → vidrio sólido.
- Barra de estado (hora, batería) blanca en oscuro.

## No-metas
- No cambian funciones, flujos ni textos.
- No hay modo automático según el iPhone.
- No se rediseña pantalla por pantalla: heredan la paleta.

## Anti-metas (fracaso aunque funcione)
- Texto que no cumpla contraste AA (4.5:1) en cualquiera de las 4 combinaciones de tema y contraste.
- Que la app no abra si falta `pod install` (el vidrio se carga hasta que se usa; sin módulo → panel translúcido).
- Efectos recargados: degradados fuertes, neón, animaciones decorativas (guía apple-ui-designer).

## Enfoques
1. **Liquid Glass real** (`expo-glass-effect` ~58.0.5, `GlassView`) en lo flotante; en iOS < 26 o sin módulo, panel translúcido. **Elegido** (Tiki delegó el cómo).
2. Desenfoque clásico (`expo-blur`): cualquier iOS, pero se ve esmerilado, no "líquido". Descartado.
3. Solo transparencias sin librería: queda plano. Descartado como enfoque; se usa como respaldo de 1.

## Diseño
- `a11y.ts`: `A11y.theme: 'claro' | 'oscuro'` (predeterminado `'claro'`).
- `ui.tsx`: 4 paletas (claro, oscuro, contraste claro, contraste oscuro) elegidas por una función pura con prueba de contraste; tokens nuevos `onPri` (texto sobre botón principal) y de vidrio; `T.dark` y `T.glass`.
- Componente `Vidrio`: carga perezosa de `expo-glass-effect`; si hay Liquid Glass y `T.glass` → `GlassView`; si no → `View` translúcido con borde fino.
- Brillo de fondo con `react-native-svg` (ya instalado), sin librería nueva; se oculta con alto contraste.
- Barra de pestañas flotante con `tabBarBackground` = `Vidrio`; las pantallas dejan espacio abajo para que nada quede tapado.
- `StatusBar` y tema de navegación según el tema; color por defecto de íconos y los ~10 colores fijos pasan a la paleta.
- "Reducir transparencia": `AccessibilityInfo` + escucha de cambios.

## Lo que decide quien lo construye
Valores exactos de color (punto de partida: dibujo B — fondo #0E1424, texto #F5F3EE, acento #D8BE8A), siempre que pasen la prueba de contraste.
