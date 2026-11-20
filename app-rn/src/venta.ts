// Venta con varios artículos: renglones del formulario → renglones de la venta, total, resumen e inventario.
// Puro (sin React Native) para probarlo con tsx.
import type { SaleItem } from './types';

export type LineaVenta = { id: string; desc: string; qty: string; price: string; productId?: string };
type ProductoLite = { id: string; name: string; price: number | null; unitCost: number };

const num = (s: string) => parseFloat(String(s ?? '').replace(',', '.')) || 0;
const centavos = (n: number) => Math.round(n * 100) / 100;

/** Precio de venta del producto, o su costo + 25 % si no tiene precio (igual que antes en Cobrar). */
export const precioSugerido = (p: { price: number | null; unitCost: number }) => centavos(p.price ?? p.unitCost * 1.25);

/** Ficha del inventario: si el producto ya está, suma 1; si no, ocupa el renglón vacío o agrega uno nuevo. */
export function agregarProducto(lineas: LineaVenta[], p: ProductoLite, nuevoId: () => string): LineaVenta[] {
  const i = lineas.findIndex((l) => l.productId === p.id);
  if (i >= 0) return lineas.map((l, k) => (k === i ? { ...l, qty: String(num(l.qty) + 1) } : l));
  const nueva: LineaVenta = { id: nuevoId(), desc: p.name, qty: '1', price: String(precioSugerido(p)), productId: p.id };
  const vacia = lineas.findIndex((l) => !l.desc.trim() && !l.price.trim() && !l.productId);
  if (vacia >= 0) return lineas.map((l, k) => (k === vacia ? nueva : l));
  return [...lineas, nueva];
}

/** Solo renglones completos (artículo, cantidad > 0 y precio > 0). Acepta coma decimal. */
export function aRenglones(lineas: LineaVenta[]): SaleItem[] {
  return lineas
    .map((l) => ({ name: l.desc.trim(), qty: num(l.qty), price: num(l.price), productId: l.productId }))
    .filter((x) => x.name && x.qty > 0 && x.price > 0)
    .map((x) => (x.productId ? x : { name: x.name, qty: x.qty, price: x.price }));
}

export const totalRenglones = (items: SaleItem[]) => centavos(items.reduce((a, i) => a + i.qty * i.price, 0));

export const resumenRenglones = (items: SaleItem[]) => items.map((i) => `${i.qty} × ${i.name}`).join(', ');

/** Descuenta del inventario la suma vendida de cada producto; nunca deja existencias negativas. */
export function descontarInventario<P extends { id: string; stock: number }>(products: P[], items: SaleItem[]): P[] {
  const vendido = new Map<string, number>();
  for (const i of items) if (i.productId) vendido.set(i.productId, (vendido.get(i.productId) ?? 0) + i.qty);
  return products.map((p) => (vendido.has(p.id) ? { ...p, stock: Math.max(0, p.stock - (vendido.get(p.id) ?? 0)) } : p));
}

/** Lo que llega a Cobrar desde otra pantalla: renglones de Cotizar, o un concepto con su monto (rentas, entregas, Hermes). */
export function lineasDesdePreset(preset: { concept?: string; amount?: number; lineas?: { desc: string; qty: string; price: string }[] }, nuevoId: () => string): LineaVenta[] {
  if (preset.lineas?.length) return preset.lineas.map((l) => ({ id: nuevoId(), desc: l.desc, qty: l.qty, price: l.price }));
  if (preset.concept || preset.amount) return [{ id: nuevoId(), desc: preset.concept ?? '', qty: '1', price: preset.amount ? String(preset.amount) : '' }];
  return [{ id: nuevoId(), desc: '', qty: '1', price: '' }];
}
