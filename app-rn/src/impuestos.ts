// Impuestos ESTIMADOS para el balance: IVA (incluido en el precio) e ISR del RESICO de personas físicas.
// Puro (sin React Native) para probarlo con tsx. Orienta al dueño; no es una declaración ni sustituye al contador.
import type { CompraLite, Rango, VentaLite } from './estadisticas';

export type RegimenImpuestos = 'resico' | 'ninguno';
export type TasaIVA = 0.16 | 0.08 | 0;
export type ConfigImpuestos = { regimen: RegimenImpuestos; tasaIVA: TasaIVA };
export const IMPUESTOS_DEFAULT: ConfigImpuestos = { regimen: 'resico', tasaIVA: 0.16 };
export const TASAS_IVA: { v: TasaIVA; label: string }[] = [
  { v: 0.16, label: '16 % general' }, { v: 0.08, label: '8 % frontera' }, { v: 0, label: '0 % alimentos y medicinas' },
];

// Tabla mensual del RESICO de personas físicas 2026 (art. 113-E LISR): la tasa se aplica a TODO lo cobrado en el mes, sin IVA
// y sin deducciones. ACTUALIZAR en enero de 2027: la reforma publicada en el DOF el 13-nov-2026 cambia límites y tasas.
export const TABLA_RESICO_2026: { hasta: number; tasa: number }[] = [
  { hasta: 25000, tasa: 0.01 }, { hasta: 50000, tasa: 0.011 }, { hasta: 83333.33, tasa: 0.015 }, { hasta: 208333.33, tasa: 0.02 }, { hasta: Infinity, tasa: 0.025 },
];

const centavos = (n: number) => Math.round(n * 100) / 100;

export function tasaISRResico(ingresoMensualSinIVA: number): number {
  return (TABLA_RESICO_2026.find((t) => ingresoMensualSinIVA <= t.hasta) ?? TABLA_RESICO_2026[TABLA_RESICO_2026.length - 1]).tasa;
}

/** Precio con IVA incluido → base (sin IVA) e IVA, a centavos. */
export function desglosarIVA(monto: number, tasa: number): { base: number; iva: number } {
  const base = centavos(monto / (1 + tasa));
  return { base, iva: centavos(monto - base) };
}

export type EstimacionImpuestos = {
  calcula: boolean; ingresosSinIVA: number; ivaVentas: number; ivaCompras: number; ivaPorPagar: number; ivaAFavor: number;
  isr: number; tasaISR: number; total: number;
};
const CERO: EstimacionImpuestos = { calcula: false, ingresosSinIVA: 0, ivaVentas: 0, ivaCompras: 0, ivaPorPagar: 0, ivaAFavor: 0, isr: 0, tasaISR: 0, total: 0 };

const entre = (iso: string, desde: Date, hasta: Date) => { const d = new Date(iso); return d >= desde && d <= hasta; };

/**
 * IVA: lo que cobraste trae IVA dentro (t / (1 + t)); lo de tus compras se estima con la misma tasa y se resta.
 * ISR (RESICO): es mensual. Cada mes que toca el periodo usa el tramo de lo que lleva cobrado ese mes hasta el fin del periodo,
 * y se aplica a lo cobrado dentro del periodo. Solo cuentan ventas pagadas (base de efectivo).
 */
export function estimarImpuestos(v: VentaLite[], c: CompraLite[], r: Rango, cfg: ConfigImpuestos): EstimacionImpuestos {
  if (cfg.regimen === 'ninguno') return CERO;
  const t = cfg.tasaIVA;
  const pagadas = v.filter((x) => x.status === 'pagada');
  const ingresos = pagadas.filter((x) => entre(x.date, r.desde, r.hasta)).reduce((a, x) => a + x.amount, 0);
  const gastos = c.filter((x) => entre(x.date, r.desde, r.hasta)).reduce((a, x) => a + x.total, 0);
  const ivaVentas = (ingresos * t) / (1 + t);
  const ivaCompras = (gastos * t) / (1 + t);
  const sinIVA = (x: VentaLite) => x.amount / (1 + t);
  let isr = 0;
  for (let mes = new Date(r.desde.getFullYear(), r.desde.getMonth(), 1); mes <= r.hasta; mes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1)) {
    const finMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1, 0, 0, 0, -1);
    const hasta = finMes < r.hasta ? finMes : r.hasta;
    const delMes = pagadas.filter((x) => entre(x.date, mes, hasta)).reduce((a, x) => a + sinIVA(x), 0);
    const desde = mes > r.desde ? mes : r.desde;
    const enPeriodo = pagadas.filter((x) => entre(x.date, desde, hasta)).reduce((a, x) => a + sinIVA(x), 0);
    isr += enPeriodo * tasaISRResico(delMes);
  }
  const base = ingresos / (1 + t);
  const neto = ivaVentas - ivaCompras;
  const ivaPorPagar = centavos(Math.max(0, neto));
  const ivaAFavor = centavos(Math.max(0, -neto));
  const isrC = centavos(isr);
  return {
    calcula: true, ingresosSinIVA: centavos(base), ivaVentas: centavos(ivaVentas), ivaCompras: centavos(ivaCompras), ivaPorPagar, ivaAFavor,
    isr: isrC, tasaISR: base > 0 ? Math.round((isr / base) * 10000) / 10000 : 0, total: centavos(ivaPorPagar + isrC),
  };
}
