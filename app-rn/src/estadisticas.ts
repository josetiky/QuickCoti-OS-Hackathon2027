// Estadísticas por periodo (Inicio y pantalla Estadísticas). Puro: sin React Native, probado con tsx.
// Adaptado de "Ganancias & Gastos" de la app SwiftUI anterior. Ingresos = ventas pagadas; gastos = compras.
export type Periodo = 'semana' | 'mes' | 'trimestre' | 'anio';
export type VentaLite = { date: string; amount: number; status: 'pagada' | 'fallida'; concept: string; items?: { name: string; qty: number; price: number }[]; cotizacionId?: string };
/** Lo que topConceptos necesita de una cotización para repartir sus pagos entre los renglones. */
export type CotizacionLite = { id: string; total: number; renglones: { name: string; qty: number; price: number }[] };
export type CompraLite = { date: string; total: number; supplier: string };
export type Rango = { desde: Date; hasta: Date };

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Desde las 00:00 del inicio del periodo hasta ahora. La semana empieza el lunes (igual que la meta). */
export function rangoPeriodo(p: Periodo, ahora: Date): Rango {
  const y = ahora.getFullYear(); const m = ahora.getMonth();
  let desde: Date;
  if (p === 'semana') desde = new Date(y, m, ahora.getDate() - ((ahora.getDay() + 6) % 7));
  else if (p === 'mes') desde = new Date(y, m, 1);
  else if (p === 'trimestre') desde = new Date(y, m - (m % 3), 1);
  else desde = new Date(y, 0, 1);
  return { desde, hasta: ahora };
}

export const periodoDeMeta = (per?: 'semanal' | 'mensual'): Periodo => (per === 'mensual' ? 'mes' : 'semana');

const dentro = (iso: string, r: Rango) => { const d = new Date(iso); return d >= r.desde && d <= r.hasta; };

export function resumen(v: VentaLite[], c: CompraLite[], r: Rango) {
  const vs = v.filter((x) => dentro(x.date, r));
  const pagadas = vs.filter((x) => x.status === 'pagada');
  const cs = c.filter((x) => dentro(x.date, r));
  const ingresos = pagadas.reduce((a, x) => a + x.amount, 0);
  const gastos = cs.reduce((a, x) => a + x.total, 0);
  return { ingresos, gastos, saldo: ingresos - gastos, ventas: pagadas.length, fallidos: vs.length - pagadas.length, compras: cs.length };
}

function agrupar<T>(xs: T[], nombre: (x: T) => string, monto: (x: T) => number, vacio: string, cuenta: (x: T) => number = () => 1) {
  const g = new Map<string, { nombre: string; veces: number; monto: number }>();
  for (const x of xs) {
    const n = nombre(x).trim().replace(/\s+/g, ' ') || vacio;
    const k = n.toLowerCase();
    const e = g.get(k) ?? { nombre: n, veces: 0, monto: 0 };
    e.veces += cuenta(x); e.monto += monto(x); g.set(k, e);
  }
  return [...g.values()].sort((a, b) => b.monto - a.monto);
}

export function topConceptos(v: VentaLite[], r: Rango, n = 6, cotizaciones: CotizacionLite[] = []): { concepto: string; veces: number; monto: number }[] {
  // Ventas con renglones cuentan por artículo (unidades e importe); ventas viejas, por concepto.
  // Un pago de cotización (anticipo o liquidación) se reparte entre los renglones de la cotización según lo pagado.
  const cots = new Map(cotizaciones.map((c) => [c.id, c]));
  const filas = v.filter((x) => x.status === 'pagada' && dentro(x.date, r)).flatMap((x) => {
    const cot = x.cotizacionId ? cots.get(x.cotizacionId) : undefined;
    if (cot && cot.total > 0 && cot.renglones.length) {
      const f = x.amount / cot.total;
      return cot.renglones.map((i) => ({ nombre: i.name, veces: i.qty * f, monto: i.qty * i.price * f }));
    }
    return x.items?.length ? x.items.map((i) => ({ nombre: i.name, veces: i.qty, monto: i.qty * i.price })) : [{ nombre: x.concept, veces: 1, monto: x.amount }];
  });
  const g = agrupar(filas, (x) => x.nombre, (x) => x.monto, 'Venta', (x) => x.veces);
  const top = g.slice(0, n).map((e) => ({ concepto: e.nombre, veces: e.veces, monto: e.monto }));
  const resto = g.slice(n);
  if (resto.length) top.push({ concepto: 'Otros', veces: resto.reduce((a, e) => a + e.veces, 0), monto: resto.reduce((a, e) => a + e.monto, 0) });
  return top;
}

export function porProveedor(c: CompraLite[], r: Rango): { proveedor: string; compras: number; monto: number }[] {
  return agrupar(c.filter((x) => dentro(x.date, r)), (x) => x.supplier, (x) => x.total, 'Sin proveedor')
    .map((e) => ({ proveedor: e.nombre, compras: e.veces, monto: e.monto }));
}

export function tendencia(v: VentaLite[], c: CompraLite[], p: Periodo, ahora: Date): { etiqueta: string; ventas: number; compras: number }[] {
  const r = rangoPeriodo(p, ahora);
  let etiquetas: string[]; let indice: (d: Date) => number;
  if (p === 'semana') { etiquetas = DIAS; indice = (d) => (d.getDay() + 6) % 7; }
  else if (p === 'mes') {
    const dias = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
    etiquetas = Array.from({ length: Math.ceil(dias / 7) }, (_, i) => `Sem ${i + 1}`);
    indice = (d) => Math.floor((d.getDate() - 1) / 7);
  } else if (p === 'trimestre') {
    const m0 = r.desde.getMonth();
    etiquetas = [0, 1, 2].map((i) => MESES[m0 + i]);
    indice = (d) => d.getMonth() - m0;
  } else { etiquetas = MESES; indice = (d) => d.getMonth(); }
  const out = etiquetas.map((etiqueta) => ({ etiqueta, ventas: 0, compras: 0 }));
  for (const x of v) if (x.status === 'pagada' && dentro(x.date, r)) { const i = indice(new Date(x.date)); if (out[i]) out[i].ventas += x.amount; }
  for (const x of c) if (dentro(x.date, r)) { const i = indice(new Date(x.date)); if (out[i]) out[i].compras += x.total; }
  return out;
}
