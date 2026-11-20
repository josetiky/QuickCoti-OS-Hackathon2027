# Venta con varios artículos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrar con varios renglones, inventario por renglón, ticket con renglones y estadísticas por artículo.
**Architecture:** Lógica de la venta en `src/venta.ts` (pura, tsx). `Sale.items` opcional; `registerSale` recibe `items`. LineasEditor gana modo `pasos`.
**Tech Stack:** Expo SDK 58, React Native, zustand, tsx.
**Spec:** `docs/superpowers/specs/2026-11-20-venta-varios-articulos-design.md`

## Global Constraints
- `SaleItem = { name: string; qty: number; price: number; productId?: string }` (types.ts).
- Total = Σ qty × price redondeado a centavos. Concepto guardado = "2 × Pizza, 1 × Refresco".
- Inventario solo baja con venta pagada; nunca negativo.
- Ventas sin `items` siguen funcionando igual (estadísticas, historial, ticket).
- Sin commits.

## Review Focus
- Cantidad con coma o decimal ("1,5 kg") → se acepta. Prueba: Task 1 `aRenglones`.
- Mismo producto en dos renglones → se descuenta la suma. Prueba: Task 1 `descontarInventario`.
- Renglón vacío o en cero → no entra a la venta ni al total. Prueba: Task 1 `aRenglones`.
- Cobro fallido → no descuenta inventario. Prueba: Task 2 revisión de `registerSale`.
- Venta vieja sin renglones en estadísticas → cuenta como antes. Prueba: Task 1 prueba existente de topConceptos.

---
### Task 1: Lógica pura (venta.ts + estadísticas por artículo)
**Files:** Create `src/venta.ts`, `src/venta.selftest.ts`; Modify `src/estadisticas.ts` (VentaLite.items?), `src/estadisticas.selftest.ts`, `package.json` (`test:venta`).
**Produces:** `type LineaVenta = { id; desc; qty; price: string; productId?: string }`; `precioSugerido(p: { price: number | null; unitCost: number }): number`; `agregarProducto(lineas, p: { id; name; price; unitCost }, nuevoId: () => string): LineaVenta[]`; `aRenglones(lineas): SaleItem[]`; `totalRenglones(items): number`; `resumenRenglones(items): string`; `descontarInventario<P extends { id: string; stock: number }>(products: P[], items: SaleItem[]): P[]`; `lineasDesdePreset(preset: { concept?; amount?; lineas?: { desc; qty; price: string }[] }, nuevoId): LineaVenta[]`.
- [ ] RED: pruebas de venta.selftest (13 casos) y topConceptos por artículo → FAIL.
- [ ] GREEN: implementar → `OK venta`, `OK estadisticas`.

### Task 2: Conexión en la app
**Files:** Modify `src/types.ts` (SaleItem, Sale.items?), `src/store.ts` (registerSale items + descontarInventario), `src/icons.tsx` (`minus`), `src/ui.tsx` (Linea.productId?, LineasEditor `pasos` y `textoAgregar`), `src/screens/SaleScreen.tsx`, `src/ticket.ts` (renglones), `src/screens/Lists.tsx` (Cotizar → lineas + cliente), `src/screens/EstadisticasScreen.tsx` ("vendidos").
- [ ] Implementar; `tsc --noEmit` solo 2 preexistentes; todas las suites OK; grep sin `productId, qty` en registerSale.
