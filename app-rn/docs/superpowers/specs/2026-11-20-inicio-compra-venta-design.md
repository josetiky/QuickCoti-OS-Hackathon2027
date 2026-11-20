# Inicio centrado en compra/venta + Estadísticas — diseño corto

## Por qué
QuickCoti es para negocios pequeños: lo que más hacen es comprar y vender. Inicio debe llevar a esas dos acciones en un toque y mostrar cómo va el negocio, lo más fácil de usar posible. Mismas funciones, nuevo diseño; no se rehace la app.

## Metas
- Inicio, de arriba a abajo:
  1. Encabezado actual (menú ☰ + tarjeta de vidrio "Ventas de hoy") y saludo con el nombre del negocio.
  2. Dos botones grandes lado a lado: **Compras** (ícono cámara) y **Ventas** (ícono ticket). Modo sencillo: uno debajo del otro, a todo lo ancho.
  3. Tarjeta del periodo de la meta ("Esta semana" o "Este mes"): avance de la meta + **saldo** = ventas pagadas − compras del periodo, con flecha y palabra "a favor"/"en contra" (no solo color). Enlace "Ver estadísticas".
  4. Historial de movimientos (ventas, compras, rentas, entregas), como el "Reciente" actual.
  5. Fila de botones chicos con los módulos activos: Cotizar, Rentas, Entregas.
- **Compras** abre la cámara de inmediato → visión lee el ticket → revisión de un toque "Guardar compra" (se respeta R4). Si no hay permiso de cámara, ofrece la galería.
- **Ventas** abre Cobrar (igual que hoy: QR CoDi simulado, ticket PDF).
- Cotizar, Rentas y Entregas también en el menú ☰. Hermes sigue en su pestaña; se quita el micrófono grande de Inicio.
- Pantalla **Estadísticas** (adaptada de "Ganancias & Gastos" de la app SwiftUI anterior):
  - Periodo: Semana / Mes / Trimestre / Año.
  - Balance: ingresos (ventas pagadas) − gastos (compras) = saldo a favor/en contra.
  - 4 tarjetas: Ingresos cobrados, Ventas realizadas, Cobros fallidos, Compras registradas.
  - "¿Qué vendes más?": dona por concepto (6 principales + Otros) y su tabla (concepto, veces, monto).
  - "Compras por proveedor": lista con total por proveedor.
  - Tendencia: barras ventas vs compras (por día en Semana, por semana en Mes, por mes en Trimestre/Año).

## No-metas
- No cambian reglas de cumplimiento, bitácora, cobro ni visión.
- Las cotizaciones no se guardan hoy → no hay "cotizaciones pendientes" (se usa "Cobros fallidos").

## Anti-metas
- Que una compra leída por IA se guarde sin confirmar.
- Gráficas que solo se entiendan por color o sin texto equivalente para VoiceOver (cada gráfica tiene tabla o lista con los mismos datos).
- Saturar Inicio: las gráficas viven en Estadísticas, no en Inicio.

## Enfoque
Una sola forma sensata: rehacer HomeScreen sobre los componentes existentes (Vidrio, Card, Tile, ListRow) + una pantalla nueva Estadisticas. Cálculos por periodo en un módulo puro probado con tsx (`src/estadisticas.ts`). Gráficas con react-native-svg (ya instalado), con los colores del tema.

## Lo que decide quien lo construye
Medidas, tamaños de letra e íconos (Icon existente: camera, doc/ticket), textos de botones cortos.
