// Estado de la app (persistido en el iPhone). Toda operación pasa por el motor de reglas y queda en la bitácora.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { evaluate } from './rules';
import { makeEntry } from './ledger';
import { A11Y_DEFAULT, type A11y } from './a11y';
import { cargarTitular } from './titular/secure';
import { separarClabeLegada } from './titular/almacen';
import { descontarInventario } from './venta';
import { abierta, aplicarPago, cancelarCotizacion as cancelarCot, folioCotizacion, nuevaCotizacion, pagado, saldo, totalPorCobrar, type Cotizacion } from './cotizacion';
import { IMPUESTOS_DEFAULT, type ConfigImpuestos } from './impuestos';
import type { Titular } from './titular/valida';
import { uid, isDigital, type BusinessProfile, type Product, type Purchase, type Sale, type Incident, type LedgerEntry, type ReceiptItem, type PaymentMethod, type SaleItem, type Rental, type Delivery, type DeliveryStatus } from './types';

type S = {
  profile: BusinessProfile | null; products: Product[]; purchases: Purchase[]; sales: Sale[]; incidents: Incident[]; ledger: LedgerEntry[];
  rentals: Rental[]; deliveries: Delivery[];
  // Cotizaciones que se cobran después (Por cobrar) y cómo estimar impuestos. Sin datos fiscales ni teléfono del cliente.
  cotizaciones: Cotizacion[]; impuestos: ConfigImpuestos;
  setImpuestos: (p: Partial<ConfigImpuestos>) => void;
  guardarCotizacion: (a: { cliente: string; renglones: SaleItem[]; anticipoPct: number }) => Promise<Cotizacion>;
  setFacturarCotizacion: (id: string, v: boolean) => void;
  cancelarCotizacion: (id: string) => Promise<boolean>;
  registrarFactura: (a: { folio: string; total: number; receptor: 'publico' | 'fisica' | 'moral'; saleId?: string; cotizacionId?: string }) => Promise<void>;
  addRental: (r: Omit<Rental, 'id' | 'date' | 'status' | 'depositReturned' | 'returnedAt'>) => Promise<Rental>;
  returnRental: (id: string, depositReturned: boolean) => Promise<void>;
  addDelivery: (d: Omit<Delivery, 'id' | 'date' | 'status' | 'updatedAt'>) => Promise<Delivery>;
  setDeliveryStatus: (id: string, status: DeliveryStatus) => Promise<void>;
  aiServerUrl: string; modelsUrl: string;
  a11y: A11y; a11yDetected: boolean;
  // Titular: vive cifrado en el llavero (Keychain). Aquí solo en memoria; NUNCA se persiste en AsyncStorage.
  titular: Titular | null; titularCargado: boolean; clabeLegada: string;
  setTitular: (t: Titular | null) => void;
  iniciarTitular: () => Promise<void>;
  setA11y: (p: Partial<A11y>, detected?: boolean) => void;
  set: (p: Partial<S>) => void;
  log: (type: string, payload: Record<string, string>) => Promise<void>;
  setProfile: (p: BusinessProfile, model: string) => Promise<void>;
  confirmPurchase: (a: { supplier: string; items: ReceiptItem[]; total: number; source: string; aiModel: string | null; userConfirmed: boolean }) => Promise<ReturnType<typeof evaluate>>;
  registerSale: (a: { concept: string; amount: number; method: PaymentMethod; status: 'pagada' | 'fallida'; isSimulated: boolean; reference: string | null; items?: SaleItem[];
    cotizacionId?: string }) => Promise<ReturnType<typeof evaluate> & { saleId?: string; cotizacion?: Cotizacion }>;
  openContingency: (reason: string) => Promise<void>;
  closeContingency: () => Promise<void>;
  tamperForDemo: () => void;
  resetAll: () => void;
};

export const useStore = create<S>()(persist((set, get) => ({
  profile: null, products: [], purchases: [], sales: [], incidents: [], ledger: [], rentals: [], deliveries: [],
  cotizaciones: [], impuestos: IMPUESTOS_DEFAULT,
  a11y: A11Y_DEFAULT, a11yDetected: false,
  titular: null, titularCargado: false, clabeLegada: '',
  setTitular: (t) => set({ titular: t, clabeLegada: '' }),
  iniciarTitular: async () => {
    try { set({ titular: await cargarTitular(), titularCargado: true }); } catch { set({ titular: null, titularCargado: true }); }
  },
  setA11y: (p, detected) => set({ a11y: { ...get().a11y, ...p }, ...(detected ? { a11yDetected: true } : {}) }),
  aiServerUrl: 'http://192.168.1.10:8000', modelsUrl: 'http://192.168.1.10:8080',
  set: (p) => set(p),
  log: async (type, payload) => { const e = await makeEntry(get().ledger.at(-1), type, payload); set({ ledger: [...get().ledger, e] }); },

  setProfile: async (p, model) => {
    set({ profile: p });
    await get().log('perfil_confirmado', { giro: p.giro, inventario: p.modules.inventory ? 'si' : 'no', cotizaciones: p.modules.quotes ? 'si' : 'no', prediseno: p.ui?.predisenoId ?? '-', meta: p.ui ? `${p.ui.ingresoMetaMXN} ${p.ui.periodicidadMeta}` : '-', modelo_ia: model });
  },

  confirmPurchase: async ({ supplier, items, total, source, aiModel, userConfirmed }) => {
    const st = get();
    const out = evaluate({ kind: 'compra', amount: total, concept: `${st.profile?.terminology.purchase ?? 'Compra'} ${supplier}`, method: null,
      aiExtracted: !!aiModel, userConfirmed }, ctx(st));
    if (!out.allowed) return out;
    const p: Purchase = { id: uid(), date: new Date().toISOString(), supplier: supplier || 'Sin proveedor', items, total, source, aiModel };
    let products = [...st.products];
    if (st.profile?.modules.inventory) for (const it of items) {
      if (!(it.qty > 0)) continue;
      const i = products.findIndex((x) => x.name.toLowerCase() === it.name.toLowerCase());
      if (i >= 0) products[i] = { ...products[i], stock: products[i].stock + it.qty, unitCost: it.unit_cost };
      else products.push({ id: uid(), name: it.name, unitCost: it.unit_cost, price: null, stock: it.qty });
    }
    set({ purchases: [...st.purchases, p], products });
    await get().log('compra', { id: p.id, proveedor: p.supplier, total: total.toFixed(2), renglones: String(items.length), fuente: source, modelo_ia: aiModel ?? 'ninguno' });
    return out;
  },

  registerSale: async ({ concept, amount, method, status, isSimulated, reference, items, cotizacionId }) => {
    const st = get();
    const previa = cotizacionId ? st.cotizaciones.find((c) => c.id === cotizacionId) : undefined;
    // En la bitácora (no se puede borrar) un pago de cotización va con su folio, sin el nombre del cliente.
    const conceptoLog = cotizacionId ? `Pago ${previa?.folio ?? 'de cotización'}` : concept;
    const out = evaluate({ kind: 'venta', amount, concept, method, aiExtracted: false, userConfirmed: true }, ctx(st));
    if (!out.allowed) {
      await get().log('venta_bloqueada', { concepto: conceptoLog, monto: amount.toFixed(2), metodo: method, regla: out.ruleIds.join(',') });
      return out;
    }
    const id = uid(), ahora = new Date().toISOString();
    // Pago de una cotización: se valida contra el saldo ACTUAL antes de registrar nada (doble toque o pantalla vieja).
    let cot: Cotizacion | null = null;
    if (cotizacionId && status === 'pagada') {
      cot = previa ? aplicarPago(previa, { saleId: id, fecha: ahora, monto: amount }) : null;
      if (!cot) {
        await get().log('venta_bloqueada', { concepto: conceptoLog, monto: amount.toFixed(2), metodo: method, regla: 'COT' });
        return { allowed: false, messages: ['COT · Esta cotización ya no tiene ese saldo por cobrar. Revisa Por cobrar.'], ruleIds: ['COT'] };
      }
    }
    const tipoPago = cot ? cot.pagos[cot.pagos.length - 1].tipo : undefined;
    const s: Sale = { id, date: ahora, concept, amount, method, status, isSimulated, reference, ...(items?.length ? { items } : {}), ...(cot ? { cotizacionId: cot.id, tipoPago } : {}) };
    // Solo una venta pagada descuenta inventario: cada renglón ligado a un producto, sin dejar existencias negativas.
    const products = status === 'pagada' && items?.length ? descontarInventario(st.products, items) : st.products;
    set({ sales: [...st.sales, s], products, ...(cot ? { cotizaciones: st.cotizaciones.map((c) => (c.id === cot!.id ? cot! : c)) } : {}) });
    const inc = st.incidents.find((i) => !i.end);
    await get().log('venta', { id: s.id, concepto: cot ? `${tipoPago === 'anticipo' ? 'Anticipo' : 'Liquidación'} ${cot.folio}` : conceptoLog, monto: amount.toFixed(2), metodo: method, estado: status, simulado: isSimulated ? 'si' : 'no',
      referencia: reference ?? '', renglones: String(items?.length || 1), contingencia: inc?.id ?? 'no', ...(cot ? { cotizacion: cot.folio, tipo_pago: tipoPago! } : {}) });
    if (cot) await get().log('cotizacion_pago', { id: cot.id, folio: cot.folio, venta: id, monto: amount.toFixed(2), tipo: tipoPago!, saldo: saldo(cot).toFixed(2) });
    return { ...out, saleId: id, ...(cot ? { cotizacion: cot } : {}) };
  },

  setImpuestos: (p) => set({ impuestos: { ...get().impuestos, ...p } }),
  guardarCotizacion: async ({ cliente, renglones, anticipoPct }) => {
    const st = get();
    const c = nuevaCotizacion({ cliente, renglones, anticipoPct }, uid(), folioCotizacion(st.cotizaciones.length + 1), new Date().toISOString());
    set({ cotizaciones: [...st.cotizaciones, c] });
    // La bitácora no lleva el nombre del cliente: el folio basta para rastrear.
    await get().log('cotizacion_alta', { id: c.id, folio: c.folio, total: c.total.toFixed(2), renglones: String(c.renglones.length), anticipo_pct: String(c.anticipoPct) });
    return c;
  },
  setFacturarCotizacion: (id, v) => set({ cotizaciones: get().cotizaciones.map((c) => (c.id === id && abierta(c) ? { ...c, facturar: v } : c)) }),
  cancelarCotizacion: async (id) => {
    const c = get().cotizaciones.find((x) => x.id === id);
    const x = c ? cancelarCot(c, new Date().toISOString()) : null;
    if (!x) return false;
    set({ cotizaciones: get().cotizaciones.map((y) => (y.id === id ? x : y)) });
    await get().log('cotizacion_cancelada', { id, folio: x.folio, pagado: pagado(x).toFixed(2) });
    return true;
  },
  // Factura SIMULADA: solo folio, total y tipo de receptor. El RFC y el nombre del cliente nunca llegan aquí.
  registrarFactura: async ({ folio, total, receptor, saleId, cotizacionId }) => {
    await get().log('factura_simulada', { folio, total: total.toFixed(2), receptor, venta: saleId ?? '', cotizacion: cotizacionId ?? '' });
  },

  addRental: async (r) => {
    const x: Rental = { ...r, id: uid(), date: new Date().toISOString(), status: 'activa', depositReturned: false, returnedAt: null };
    set({ rentals: [...get().rentals, x] });
    await get().log('renta_inicio', { id: x.id, cliente: x.client, articulos: x.items, monto: x.amount.toFixed(2), deposito: x.deposit.toFixed(2), devolucion: x.returnDate });
    return x;
  },
  returnRental: async (id, depositReturned) => {
    const now = new Date().toISOString();
    set({ rentals: get().rentals.map((r) => (r.id === id ? { ...r, status: 'devuelta', depositReturned, returnedAt: now } : r)) });
    const r = get().rentals.find((x) => x.id === id);
    await get().log('renta_devuelta', { id, deposito_devuelto: depositReturned ? 'si' : 'no', deposito: (r?.deposit ?? 0).toFixed(2) });
  },
  addDelivery: async (d) => {
    const now = new Date().toISOString();
    const x: Delivery = { ...d, id: uid(), date: now, status: 'pendiente', updatedAt: now };
    set({ deliveries: [...get().deliveries, x] });
    await get().log('entrega_alta', { id: x.id, cliente: x.client, concepto: x.concept, monto: x.amount.toFixed(2), envio: x.fee.toFixed(2) });
    return x;
  },
  setDeliveryStatus: async (id, status) => {
    set({ deliveries: get().deliveries.map((d) => (d.id === id ? { ...d, status, updatedAt: new Date().toISOString() } : d)) });
    await get().log('entrega_estado', { id, estado: status });
  },

  openContingency: async (reason) => {
    if (get().incidents.some((i) => !i.end)) return;
    const inc: Incident = { id: uid(), start: new Date().toISOString(), end: null, reason };
    set({ incidents: [...get().incidents, inc] });
    await get().log('contingencia_inicio', { id: inc.id, motivo: reason });
  },
  closeContingency: async () => {
    const inc = get().incidents.find((i) => !i.end);
    if (!inc) return;
    set({ incidents: get().incidents.map((i) => (i.id === inc.id ? { ...i, end: new Date().toISOString() } : i)) });
    await get().log('contingencia_fin', { id: inc.id });
  },

  tamperForDemo: () => {
    const l = [...get().ledger];
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i].payload;
      if (p.monto || p.total) { l[i] = { ...l[i], payload: { ...p, ...(p.monto ? { monto: '1.00' } : { total: '1.00' }) } }; break; }
    }
    set({ ledger: l });
  },
  resetAll: () => set({ profile: null, products: [], purchases: [], sales: [], incidents: [], ledger: [], rentals: [], deliveries: [], cotizaciones: [], impuestos: IMPUESTOS_DEFAULT }),
}), { name: 'quickcoti-os', storage: createJSONStorage(() => AsyncStorage),
  partialize: (s) => ({ profile: s.profile, products: s.products, purchases: s.purchases, sales: s.sales, incidents: s.incidents, ledger: s.ledger,
    rentals: s.rentals, deliveries: s.deliveries, cotizaciones: s.cotizaciones, impuestos: s.impuestos, a11y: s.a11y, a11yDetected: s.a11yDetected,
    aiServerUrl: s.aiServerUrl, modelsUrl: s.modelsUrl }) as any,
  // La CLABE que versiones anteriores guardaban aquí se saca del estado: solo prellena el formulario y no se vuelve a escribir.
  merge: (persistido, actual) => { const { estado, clabeLegada } = separarClabeLegada(persistido); return { ...actual, ...(estado as Partial<S>), clabeLegada }; },
}));

const ctx = (s: S) => ({ digitalOnlySector: !!s.profile?.digital_only_sector, contingencyActive: s.incidents.some((i) => !i.end) });

export const T = (key: keyof NonNullable<BusinessProfile['terminology']>) => useStore.getState().profile?.terminology[key] ?? key;

export function snapshot(s: Pick<S, 'sales' | 'purchases' | 'products'> & Partial<Pick<S, 'rentals' | 'deliveries' | 'cotizaciones'>>) {
  const today = new Date().toDateString();
  const v = s.sales.filter((x) => new Date(x.date).toDateString() === today && x.status === 'pagada');
  const c = s.purchases.filter((x) => new Date(x.date).toDateString() === today);
  const out: Record<string, number> = {
    ventas_hoy: v.reduce((a, x) => a + x.amount, 0), compras_hoy: c.reduce((a, x) => a + x.total, 0),
    ventas_efectivo: v.filter((x) => !isDigital(x.method)).reduce((a, x) => a + x.amount, 0),
    ventas_digitales: v.filter((x) => isDigital(x.method)).reduce((a, x) => a + x.amount, 0),
  };
  for (const p of s.products.slice(0, 30)) out[`existencia: ${p.name}`] = p.stock;
  const rAct = (s.rentals ?? []).filter((r) => r.status === 'activa');
  if (s.rentals?.length) { out.rentas_activas = rAct.length; out.rentas_vencidas = rAct.filter((r) => r.returnDate && new Date(r.returnDate) < new Date()).length;
    out.depositos_por_devolver = rAct.reduce((a, r) => a + r.deposit, 0); }
  if (s.deliveries?.length) { out.entregas_pendientes = s.deliveries.filter((d) => d.status === 'pendiente' || d.status === 'en_camino').length;
    out.entregas_hoy = s.deliveries.filter((d) => new Date(d.date).toDateString() === today && d.status === 'entregado').length; }
  const abiertas = (s.cotizaciones ?? []).filter(abierta);
  if (abiertas.length) { out.cotizaciones_por_cobrar = abiertas.length; out.por_cobrar = totalPorCobrar(abiertas); }
  return out;
}
