# Impuestos, cotizaciones por cobrar, factura simulada y WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ventas pregunta venta/cotización; cotizaciones en Por cobrar con anticipo y liquidación; IVA e ISR estimados en el balance; factura simulada después del pago; WhatsApp al final del ticket; confirmación antes de registrar ventas y compras.
**Architecture:** Lógica pura en `impuestos.ts`, `cotizacion.ts`, `factura.ts`, `whatsapp.ts`, `confirmar.ts` y `documentos.ts` (probadas con tsx). `store.ts` guarda `cotizaciones` e `impuestos`; `registerSale` aplica el pago a la cotización en el mismo `set`. Pantallas nuevas en `screens/Cotizaciones.tsx`; componentes de factura y WhatsApp en `screens/Compartir.tsx`.
**Tech Stack:** Expo SDK 58, React Native, zustand persist, expo-print/expo-sharing (opcionales), Linking, tsx.
**Spec:** `docs/superpowers/specs/2026-11-20-impuestos-cotizaciones-factura-design.md`

## Global Constraints
- Dinero redondeado a centavos: `Math.round(x * 100) / 100`. Tolerancia de saldo: 0.005.
- RESICO 2026 mensual (ingresos pagados del mes sin IVA): ≤ 25,000 → 0.01; ≤ 50,000 → 0.011; ≤ 83,333.33 → 0.015; ≤ 208,333.33 → 0.02; más → 0.025.
- IVA incluido: `iva = monto × t / (1 + t)`, `t ∈ {0.16, 0.08, 0}`. Predeterminado `{ regimen: 'resico', tasaIVA: 0.16 }`.
- Textos fijos: «FACTURA SIMULADA», «NO ES UN CFDI VÁLIDO ANTE EL SAT», «Estimación, confírmala con tu contador», «ya no se puede modificar».
- RFC y WhatsApp del cliente: solo en estado local de la pantalla; nunca en AsyncStorage ni en la bitácora. La bitácora de cotizaciones no lleva el nombre del cliente.
- Sin commits; respaldo en `evento/respaldo_impuestos_pre/`.

## Review Focus
1. Pagos con decimales que suman exacto el total (0.1 + 0.2 sobre 0.3) → liquidada, sin centavo colgado. Prueba: Task 2.
2. Semana que cruza dos meses → ISR con el tramo de cada mes. Prueba: Task 1.
3. Cotización cancelada o pagada → ningún pago más (doble toque, pantalla vieja). Prueba: Task 2 + `registerSale` valida antes de registrar.
4. WhatsApp escrito con +52, 521, espacios o paréntesis → 52 + 10 dígitos; 9 u 11 dígitos → rechazo. Prueba: Task 3.
5. Cliente o concepto con `& < > "` → escapado en todos los PDF. Prueba: Task 4.

---
### Task 1: impuestos.ts
**Files:** Create `src/impuestos.ts`, `src/impuestos.selftest.ts`; Modify `package.json` (`test:impuestos`).
**Produces:** `type ConfigImpuestos = { regimen: 'resico' | 'ninguno'; tasaIVA: 0.16 | 0.08 | 0 }`; `IMPUESTOS_DEFAULT`; `TASAS_IVA`;
`tasaISRResico(ingresoMensualSinIVA: number): number`; `desglosarIVA(monto: number, tasa: number): { base: number; iva: number }`;
`estimarImpuestos(v: VentaLite[], c: CompraLite[], r: Rango, cfg: ConfigImpuestos): EstimacionImpuestos` con
`EstimacionImpuestos = { calcula: boolean; ingresosSinIVA; ivaVentas; ivaCompras; ivaPorPagar; ivaAFavor; isr; tasaISR; total: number }`.
ISR: por cada mes que toca el rango, tramo = ingresos sin IVA del mes hasta `r.hasta`; ISR = ingresos sin IVA del mes dentro del rango × tramo.
- [ ] RED: bordes de la tabla (25,000 / 25,000.01 / 83,333.33 / 83,333.34 / 208,333.34), desglose 116 → 100 + 16 y 0 %, mes de 34,800 con IVA → ISR 330, IVA a pagar y a favor, fallidas fuera, semana que cruza meses, `ninguno` → `calcula: false` y ceros.
- [ ] GREEN → `OK impuestos`.

### Task 2: cotizacion.ts + prorrateo en estadísticas
**Files:** Create `src/cotizacion.ts`, `src/cotizacion.selftest.ts`; Modify `src/estadisticas.ts`, `src/estadisticas.selftest.ts`, `package.json` (`test:cotizacion`).
**Produces:** `EstadoCotizacion = 'pendiente' | 'anticipo' | 'pagada' | 'cancelada'`; `TipoPago = 'anticipo' | 'liquidacion'`;
`PagoCotizacion = { saleId; fecha; monto; tipo }`; `Cotizacion = { id; folio; fecha; cliente; renglones: SaleItem[]; total; anticipoPct; facturar: boolean; estado; pagos: PagoCotizacion[]; actualizada }`;
`folioCotizacion(n)` → `COT-0001`; `nuevaCotizacion(a: { cliente; renglones; anticipoPct }, id, folio, ahoraISO)`; `pagado(c)`; `saldo(c)`; `abierta(c)`;
`anticipoSugerido(c)` (sin pagos y % > 0: total × % acotado al saldo; si no: saldo); `tipoDePago(c, monto): TipoPago`;
`aplicarPago(c, { saleId; fecha; monto }): Cotizacion | null` (null si cerrada, monto ≤ 0 o > saldo + 0.005);
`cancelarCotizacion(c, ahoraISO): Cotizacion | null`; `porCobrar(cs)` (abiertas, más nueva primero); `totalPorCobrar(cs)`;
`conceptoPago(c, tipo)` → `Anticipo COT-0003 · Juan`; `etiquetaEstado(c)`.
Estadísticas: `VentaLite.cotizacionId?`; `topConceptos(v, r, n = 6, cotizaciones: CotizacionLite[] = [])` reparte el pago entre los renglones de la cotización (monto/total); sin cotización → por concepto.
- [ ] RED → GREEN (`OK cotizacion`, `OK estadisticas`).

### Task 3: factura.ts + whatsapp.ts + confirmar.ts
**Files:** Create `src/factura.ts`, `src/whatsapp.ts`, `src/confirmar.ts`, `src/factura.selftest.ts` (cubre los tres); Modify `package.json` (`test:factura`).
**Produces:** `RegimenFiscal = '601' | '605' | '612' | '616' | '626'`; `UsoCFDI = 'G01' | 'G03' | 'S01'`; `REGIMENES`; `USOS`;
`Receptor = { rfc; nombre; cp; regimen; uso }`; `PUBLICO_GENERAL`; `normalizarRFC(s)`; `validarRFC(s): string | null`; `tipoPersona(rfc)`;
`validarReceptor(r): Partial<Record<keyof Receptor, string>>`; `avisoRetencion(rfc, regimenEmisor): string | null`; `formaPago(m: PaymentMethod)`;
`Factura`; `armarFactura(a: { negocio; folio; fecha; receptor; renglones; total; metodo; tasaIVA; regimenEmisor; nota? }): Factura`
(valor unitario = precio/(1+t) a 6 decimales, importe a centavos, IVA = total − subtotal, total = lo cobrado); `folioFactura(ahora)` → `SIM-123456`.
`normalizarCelularMX(s): string | null` (→ `52` + 10 dígitos que empiezan en 2-9); `enlaceWhatsApp(cel, texto): string | null` (`https://wa.me/…?text=`).
`confirmacionCobro({ monto; metodo; resumen }): { titulo; mensaje }`; `confirmacionCompra({ total; proveedor; renglones }): { titulo; mensaje }`.
- [ ] RED → GREEN (`OK factura`).

### Task 4: documentos.ts (ticket, cotización, factura)
**Files:** Create `src/documentos.ts`, `src/documentos.selftest.ts`; Modify `src/ticket.ts` (re-exporta, `compartirDocumento`), `package.json` (`test:documentos`).
**Produces:** `Ticket` (movido) + `cotizacion?: { folio; total; pagadoAntes; resta; tipo: TipoPago }`; `ticketHTML`, `ticketTexto` (movidos);
`cotizacionHTML(c, negocio, tasaIVA)`, `cotizacionTexto(c, negocio)`, `facturaHTML(f)`, `facturaTexto(f)`;
en ticket.ts: `compartirDocumento(html, texto, titulo, tam?: { width: number; height: number }): Promise<'pdf' | 'texto'>`; `compartirTicket(t)` igual que antes.
- [ ] RED → GREEN (`OK documentos`); los textos del ticket de venta normal no cambian.

### Task 5: conexión en la app
**Files:** Modify `src/types.ts` (`Sale.cotizacionId?`, `Sale.tipoPago?`), `src/store.ts`, `src/ui.tsx` (`confirmar(titulo, mensaje, si): Promise<boolean>`),
`src/screens/Lists.tsx` (pregunta Venta/Cotización, Por cobrar e impuestos en Inicio, Cotizar guarda), `src/screens/SaleScreen.tsx`
(modo cotización, confirmación, factura, WhatsApp), `src/screens/ReceiptFlowScreen.tsx` (confirmación), `src/screens/More.tsx` (Ajustes → Impuestos),
`src/screens/EstadisticasScreen.tsx` (impuestos + prorrateo), `App.tsx` (rutas `PorCobrar`, `Cotizacion`); Create `src/screens/Cotizaciones.tsx`, `src/screens/Compartir.tsx`.
Store: `cotizaciones`, `impuestos`, `setImpuestos`, `guardarCotizacion`, `setFacturarCotizacion`, `cancelarCotizacion`, `registrarFactura`;
`registerSale({ …, cotizacionId? })` → `{ …evaluate, saleId?, cotizacion? }`, valida saldo antes de registrar; `persist` y `resetAll` incluyen lo nuevo; `snapshot` agrega `por_cobrar`.
- [ ] `tsc --noEmit` solo con los 2 errores previos; todas las suites OK; grep: sin RFC/WhatsApp en `log(` ni en `partialize`.
