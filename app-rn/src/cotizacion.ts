// Cotizaciones que se cobran después: quedan en "Por cobrar" hasta que el cliente paga (anticipo y liquidación).
// Cada pago es una venta normal ligada por cotizacionId: cuenta como ingreso el día que se cobra. Puro, probado con tsx.
import { money, type SaleItem } from './types';
import { totalRenglones } from './venta';

export type EstadoCotizacion = 'pendiente' | 'anticipo' | 'pagada' | 'cancelada';
export type TipoPago = 'anticipo' | 'liquidacion';
export type PagoCotizacion = { saleId: string; fecha: string; monto: number; tipo: TipoPago };
export type Cotizacion = {
  id: string; folio: string; fecha: string; cliente: string; renglones: SaleItem[]; total: number; anticipoPct: number;
  facturar: boolean; estado: EstadoCotizacion; pagos: PagoCotizacion[]; actualizada: string;
};

const centavos = (n: number) => Math.round(n * 100) / 100;
const TOLERANCIA = 0.005;

export const folioCotizacion = (n: number) => `COT-${String(Math.max(1, Math.floor(n))).padStart(4, '0')}`;

export function nuevaCotizacion(a: { cliente: string; renglones: SaleItem[]; anticipoPct: number }, id: string, folio: string, ahoraISO: string): Cotizacion {
  const pct = Number.isFinite(a.anticipoPct) ? Math.min(100, Math.max(0, a.anticipoPct)) : 0;
  return { id, folio, fecha: ahoraISO, cliente: a.cliente.trim(), renglones: a.renglones.map((r) => ({ ...r })), total: totalRenglones(a.renglones),
    anticipoPct: pct, facturar: false, estado: 'pendiente', pagos: [], actualizada: ahoraISO };
}

export const pagado = (c: Cotizacion) => centavos(c.pagos.reduce((a, p) => a + p.monto, 0));
export const saldo = (c: Cotizacion) => Math.max(0, centavos(c.total - pagado(c)));
export const abierta = (c: Cotizacion) => c.estado === 'pendiente' || c.estado === 'anticipo';

/** Sin pagos y con % pedido: ese % del total (sin pasar del saldo). Si no: lo que resta. */
export function anticipoSugerido(c: Cotizacion): number {
  const s = saldo(c);
  if (!c.pagos.length && c.anticipoPct > 0) return Math.min(s, centavos((c.total * c.anticipoPct) / 100));
  return s;
}

export const tipoDePago = (c: Cotizacion, monto: number): TipoPago => (centavos(monto) >= saldo(c) - TOLERANCIA ? 'liquidacion' : 'anticipo');

/** Registra un pago. null si la cotización ya está cerrada o el monto no es válido (≤ 0 o mayor al saldo). */
export function aplicarPago(c: Cotizacion, p: { saleId: string; fecha: string; monto: number }): Cotizacion | null {
  const m = centavos(p.monto);
  if (!abierta(c) || !(m > 0) || m > saldo(c) + TOLERANCIA) return null;
  const tipo = tipoDePago(c, m);
  return { ...c, pagos: [...c.pagos, { saleId: p.saleId, fecha: p.fecha, monto: m, tipo }], estado: tipo === 'liquidacion' ? 'pagada' : 'anticipo', actualizada: p.fecha };
}

/** Cancela una cotización abierta; lo que ya se cobró se queda en ventas. */
export function cancelarCotizacion(c: Cotizacion, ahoraISO: string): Cotizacion | null {
  return abierta(c) ? { ...c, estado: 'cancelada', actualizada: ahoraISO } : null;
}

export const porCobrar = (cs: Cotizacion[]) => cs.filter(abierta).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
export const totalPorCobrar = (cs: Cotizacion[]) => centavos(cs.filter(abierta).reduce((a, c) => a + saldo(c), 0));

export const conceptoPago = (c: Cotizacion, tipo: TipoPago) => `${tipo === 'anticipo' ? 'Anticipo' : 'Liquidación'} ${c.folio}${c.cliente ? ` · ${c.cliente}` : ''}`;

export function etiquetaEstado(c: Cotizacion): string {
  if (c.estado === 'pendiente') return 'Pendiente';
  if (c.estado === 'anticipo') return `Anticipo ${money(pagado(c))} · resta ${money(saldo(c))}`;
  return c.estado === 'pagada' ? 'Pagada' : 'Cancelada';
}
