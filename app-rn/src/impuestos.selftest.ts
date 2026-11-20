// Pruebas de impuestos estimados (IVA incluido e ISR del RESICO). Ejecuta: npm run test:impuestos
import { desglosarIVA, estimarImpuestos, IMPUESTOS_DEFAULT, tasaISRResico } from './impuestos';
import type { CompraLite, Rango, VentaLite } from './estadisticas';

const casos: { name: string; pass: boolean }[] = [];
function caso(name: string, fn: () => boolean) { let pass = false; try { pass = fn(); } catch { pass = false; } casos.push({ name, pass }); }
const cerca = (a: number, b: number) => Math.abs(a - b) < 0.005;
const fecha = (m: number, d: number, h = 12) => new Date(2026, m, d, h).toISOString(); // m: 0 = enero
const venta = (m: number, d: number, amount: number, status: 'pagada' | 'fallida' = 'pagada'): VentaLite => ({ date: fecha(m, d), amount, status, concept: 'Venta' });
const compra = (m: number, d: number, total: number): CompraLite => ({ date: fecha(m, d), total, supplier: 'Bimbo' });
const NOV: Rango = { desde: new Date(2026, 10, 1), hasta: new Date(2026, 10, 30, 23, 59) };
const RESICO16 = { regimen: 'resico' as const, tasaIVA: 0.16 as const };

caso('Tabla RESICO 2026: hasta 25,000 paga 1 %', () => tasaISRResico(0) === 0.01 && tasaISRResico(25000) === 0.01);
caso('Tabla RESICO 2026: de 25,000.01 a 50,000 paga 1.1 %', () => tasaISRResico(25000.01) === 0.011 && tasaISRResico(50000) === 0.011);
caso('Tabla RESICO 2026: hasta 83,333.33 paga 1.5 % y luego 2 %', () => tasaISRResico(83333.33) === 0.015 && tasaISRResico(83333.34) === 0.02);
caso('Tabla RESICO 2026: más de 208,333.33 paga 2.5 %', () => tasaISRResico(208333.33) === 0.02 && tasaISRResico(208333.34) === 0.025 && tasaISRResico(1e7) === 0.025);
caso('Desglose con IVA incluido: 116 → 100 + 16; 108 al 8 % → 100 + 8', () => { const a = desglosarIVA(116, 0.16), b = desglosarIVA(108, 0.08); return a.base === 100 && a.iva === 16 && b.base === 100 && b.iva === 8; });
caso('Desglose al 0 %: todo es base', () => { const a = desglosarIVA(50, 0); return a.base === 50 && a.iva === 0; });
caso('Predeterminado: RESICO con IVA 16 %', () => IMPUESTOS_DEFAULT.regimen === 'resico' && IMPUESTOS_DEFAULT.tasaIVA === 0.16);
caso('Mes con 34,800 cobrados (30,000 sin IVA) → IVA 4,800 e ISR 1.1 % = 330', () => {
  const e = estimarImpuestos([venta(10, 5, 20000), venta(10, 12, 14800)], [], NOV, RESICO16);
  return e.calcula && cerca(e.ingresosSinIVA, 30000) && cerca(e.ivaVentas, 4800) && cerca(e.isr, 330) && cerca(e.tasaISR, 0.011) && cerca(e.total, 5130);
});
caso('IVA a pagar = IVA de ventas − IVA de compras', () => {
  const e = estimarImpuestos([venta(10, 5, 1160)], [compra(10, 6, 580)], NOV, RESICO16);
  return cerca(e.ivaVentas, 160) && cerca(e.ivaCompras, 80) && cerca(e.ivaPorPagar, 80) && e.ivaAFavor === 0 && cerca(e.isr, 10) && cerca(e.total, 90);
});
caso('Si compras más de lo que vendes, el IVA queda a favor y no se paga', () => {
  const e = estimarImpuestos([venta(10, 5, 580)], [compra(10, 6, 1160)], NOV, RESICO16);
  return e.ivaPorPagar === 0 && cerca(e.ivaAFavor, 80) && cerca(e.total, e.isr) && cerca(e.isr, 5);
});
caso('Ventas fallidas y de otro mes no cuentan', () => {
  const e = estimarImpuestos([venta(10, 5, 1160, 'fallida'), venta(9, 30, 1160), venta(10, 7, 116)], [], NOV, RESICO16);
  return cerca(e.ivaVentas, 16) && cerca(e.ingresosSinIVA, 100) && cerca(e.isr, 1);
});
caso('Semana que cruza meses: cada mes con su propio tramo', () => {
  // Noviembre ya lleva 61,000 sin IVA (tramo 1.5 %); diciembre empieza en el tramo de 1 %.
  const v = [venta(10, 10, 69600), venta(10, 30, 1160), venta(11, 1, 1160)];
  const semana: Rango = { desde: new Date(2026, 10, 30), hasta: new Date(2026, 11, 4, 18) };
  const e = estimarImpuestos(v, [], semana, RESICO16);
  return cerca(e.ingresosSinIVA, 2000) && cerca(e.isr, 1000 * 0.015 + 1000 * 0.01);
});
caso('IVA 0 %: sin IVA y el ISR va sobre todo lo cobrado', () => {
  const e = estimarImpuestos([venta(10, 5, 1000)], [compra(10, 6, 500)], NOV, { regimen: 'resico', tasaIVA: 0 });
  return e.ivaVentas === 0 && e.ivaCompras === 0 && cerca(e.isr, 10) && cerca(e.ingresosSinIVA, 1000);
});
caso('"No calcular": todo en cero y calcula = false', () => {
  const e = estimarImpuestos([venta(10, 5, 1160)], [compra(10, 6, 580)], NOV, { regimen: 'ninguno', tasaIVA: 0.16 });
  return !e.calcula && e.ivaVentas === 0 && e.isr === 0 && e.total === 0;
});
caso('Sin ventas: ISR 0 y tasa 0', () => { const e = estimarImpuestos([], [], NOV, RESICO16); return e.calcula && e.isr === 0 && e.tasaISR === 0 && e.total === 0; });

const malos = casos.filter((t) => !t.pass);
for (const t of malos) console.log(`✘ ${t.name}`);
console.log(`${casos.length - malos.length}/${casos.length} casos pasan`);
if (!malos.length) console.log('OK impuestos');
process.exit(malos.length ? 1 : 0);
