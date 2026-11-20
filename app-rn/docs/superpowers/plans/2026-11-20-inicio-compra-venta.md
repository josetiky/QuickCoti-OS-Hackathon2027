# Inicio compra/venta + Estadísticas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inicio con dos botones grandes (Compras → cámara, Ventas → Cobrar), tarjeta del periodo con meta y saldo, historial y accesos chicos; pantalla Estadísticas adaptada de "Ganancias & Gastos".

**Architecture:** Cálculos por periodo en un módulo puro `src/estadisticas.ts` (probado con tsx). HomeScreen se rehace sobre los componentes existentes. Pantalla nueva `EstadisticasScreen` con gráficas SVG en `src/graficas.tsx`.

**Tech Stack:** Expo SDK 58, React Native, React Navigation 7, react-native-svg (ya instalado), tsx.

**Spec:** `docs/superpowers/specs/2026-11-20-inicio-compra-venta-design.md`

## Global Constraints
- Mismas funciones; no cambian reglas (R4), bitácora, cobro ni visión.
- Una compra leída por IA nunca se guarda sin confirmar ("Guardar compra").
- Saldo = ventas pagadas − compras del periodo; ≥ 0 → "a favor" (verde, flecha arriba), < 0 → "en contra" (rojo, flecha abajo). Nunca solo color.
- Periodo de Inicio = el de la meta: 'semanal' → semana desde el lunes 00:00; 'mensual' → mes desde el día 1 (igual que hoy).
- Cada gráfica tiene lista/tabla con los mismos datos y etiqueta para VoiceOver.
- Colores desde la paleta `C` (tema claro/oscuro); sin colores fijos salvo la paleta categórica de la dona.
- Sin commits (evento/ sin rastrear en esta carpeta).

## Review Focus
- Periodo sin movimientos → mensajes vacíos amables, sin NaN ni divisiones entre cero (meta 0, total 0). Prueba: Task 1 `resumen` y `topConceptos` con listas vacías.
- Fechas en el borde (domingo noche, lunes 00:00, 1 de mes) → caen en el periodo correcto. Prueba: Task 1 `rangoPeriodo` con domingo y lunes.
- Cobros fallidos no cuentan como ingreso ni en tendencia. Prueba: Task 1.
- Permiso de cámara negado → ofrecer galería, no pantalla muerta. Prueba: Task 2 revisión del estado de error.
- Modo sencillo / letra muy grande → botones apilados y textos sin cortarse. Prueba: Task 2 revisión manual en el iPhone (listado en el mensaje final).

---

### Task 1: Cálculos de estadísticas (puro)

**Files:** Create `src/estadisticas.ts`, `src/estadisticas.selftest.ts`; Modify `package.json` (`"test:estadisticas": "npx tsx src/estadisticas.selftest.ts"`).

**Produces:**
- `type Periodo = 'semana' | 'mes' | 'trimestre' | 'anio'`
- `type VentaLite = { date: string; amount: number; status: 'pagada' | 'fallida'; concept: string }`; `type CompraLite = { date: string; total: number; supplier: string }`
- `rangoPeriodo(p: Periodo, ahora: Date): { desde: Date; hasta: Date }` (desde a las 00:00 local; hasta = ahora)
- `periodoDeMeta(per?: 'semanal' | 'mensual'): Periodo`
- `resumen(v: VentaLite[], c: CompraLite[], r): { ingresos; gastos; saldo; ventas; fallidos; compras: number }`
- `topConceptos(v: VentaLite[], r, n = 6): { concepto: string; veces: number; monto: number }[]` (solo pagadas; agrupa sin distinguir mayúsculas/espacios; desc por monto; si hay más de n, n + "Otros")
- `porProveedor(c: CompraLite[], r): { proveedor: string; compras: number; monto: number }[]` ('' → "Sin proveedor"; desc)
- `tendencia(v, c, p: Periodo, ahora: Date): { etiqueta: string; ventas: number; compras: number }[]` — semana: Lun…Dom; mes: "Sem 1"… (bloques de 7 días desde el 1); trimestre: 3 meses; año: Ene…Dic.

- [ ] Step 1: pruebas con `ahora = new Date(2026,10,20,12)` (viernes): semana desde lun 16-nov 00:00 (también con domingo 22 y lunes 16 09:00); mes 1-nov; trimestre 1-oct; año 1-ene; `periodoDeMeta('mensual')==='mes'`, otro → 'semana'; resumen con venta pagada 100 (17-nov), fallida 50 (18-nov), pagada 999 (10-nov, fuera) y compra 30 (19-nov) → 100/30/70/1/1/1; saldo negativo; listas vacías → ceros; topConceptos agrupa "Pizza" y " pizza ", 8 conceptos → 7 filas con "Otros" al final; porProveedor agrupa y nombra "Sin proveedor"; tendencia semana: 7 etiquetas, venta del martes en índice 1, compra del jueves en índice 3; mes: 5 bloques y 17-nov en "Sem 3"; trimestre: Oct/Nov/Dic; año: 12 y noviembre en índice 10; fallidas fuera de la tendencia.
- [ ] Step 2: `tsx src/estadisticas.selftest.ts` → FAIL (módulo no existe)
- [ ] Step 3: implementar `src/estadisticas.ts` sin imports de React Native
- [ ] Step 4: `tsx src/estadisticas.selftest.ts` → `OK estadisticas`

### Task 2: Inicio compra/venta

**Files:** Modify `src/screens/Lists.tsx` (HomeScreen), `src/icons.tsx` (ícono `ticket`), `src/screens/ReceiptFlowScreen.tsx` (abrir cámara al entrar con `route.params.camara`; permiso negado → botón de galería).

**Consumes:** Task 1 `rangoPeriodo`, `periodoDeMeta`, `resumen`.

- [ ] Step 1: ícono `ticket` (comprobante con borde inferior en zigzag) en `IconName` y en el mapa.
- [ ] Step 2: HomeScreen: quitar micrófono grande, "¿Qué vamos a hacer hoy?" y la cuadrícula de accesos; agregar dos `BotonGrande` (Compras: cámara → `navigate('Receipt', { camara: Date.now() })`; Ventas: ticket → `navigate('Sale')`), apilados en modo sencillo; tarjeta del periodo (meta si `ordenTarjetasHome` incluye 'meta_ingresos' y meta > 0, ventas, compras, saldo con flecha + palabra, botón "Ver estadísticas" → `navigate('Estadisticas')`); historial "Movimientos"; fila de accesos chicos (TILES sin 'escaner_recibos' ni 'cobro', en el orden del Configurador, con sus alertas). Menú ☰ suma "Estadísticas" y los módulos activos.
- [ ] Step 3: ReceiptFlowScreen: `useEffect` que llama `pick(true)` cuando cambia `route.params.camara`; sin permiso de cámara → mensaje + botón "Elegir de la galería".
- [ ] Step 4: `tsc --noEmit` solo 2 preexistentes; suites OK.

### Task 3: Pantalla Estadísticas

**Files:** Create `src/graficas.tsx` (`Dona`, `Barras`), `src/screens/EstadisticasScreen.tsx`; Modify `App.tsx` (ruta `Estadisticas`, título "Estadísticas").

**Consumes:** Task 1 completo.

- [ ] Step 1: `Dona({ datos: { etiqueta: string; valor: number; color: string }[]; tamano?: number; a11y: string })` con arcos por `strokeDasharray`; `Barras({ datos: { etiqueta: string; ventas: number; compras: number }[]; a11y: string })` con barras agrupadas (ventas `C.pri`, compras `C.warn`) y leyenda en texto.
- [ ] Step 2: EstadisticasScreen: `Segmented` Semana/Mes/Trimestre/Año (inicia en el periodo de la meta); balance (ingresos, gastos, saldo a favor/en contra); 4 tarjetas (Ingresos cobrados, Ventas realizadas, Cobros fallidos, Compras registradas); "¿Qué vendes más?" (dona + tabla con punto de color, veces y monto); "Compras por proveedor"; "Tendencia" (barras + leyenda). Vacíos con mensaje.
- [ ] Step 3: `tsc --noEmit` solo 2 preexistentes; suites OK; grep sin hex fijos en EstadisticasScreen.
