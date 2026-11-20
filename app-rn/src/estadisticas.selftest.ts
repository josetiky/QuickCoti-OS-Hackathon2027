// Pruebas de estadísticas por periodo. Ejecuta: npm run test:estadisticas
import { periodoDeMeta, porProveedor, rangoPeriodo, resumen, tendencia, topConceptos, type CompraLite, type VentaLite } from './estadisticas';

const casos: { name: string; pass: boolean }[] = [];
function caso(name: string, fn: () => boolean) { let pass = false; try { pass = fn(); } catch { pass = false; } casos.push({ name, pass }); }

const AHORA = new Date(2026, 10, 20, 12); // viernes 20 de noviembre de 2026
const iso = (d: number, m = 10, h = 12) => new Date(2026, m, d, h).toISOString();
const v = (d: number, amount: number, status: 'pagada' | 'fallida' = 'pagada', concept = 'Venta', m = 10): VentaLite => ({ date: iso(d, m), amount, status, concept });
const c = (d: number, total: number, supplier = 'Bimbo', m = 10): CompraLite => ({ date: iso(d, m), total, supplier });
const es = (a: Date, y: number, mo: number, d: number) => a.getFullYear() === y && a.getMonth() === mo && a.getDate() === d && a.getHours() === 0 && a.getMinutes() === 0;
const r = rangoPeriodo('semana', AHORA);

caso('Semana empieza el lunes 00:00', () => es(rangoPeriodo('semana', AHORA).desde, 2026, 10, 16));
caso('Domingo en la noche pertenece a la semana del lunes anterior', () => es(rangoPeriodo('semana', new Date(2026, 10, 22, 23)).desde, 2026, 10, 16));
caso('Lunes en la mañana empieza su propia semana', () => es(rangoPeriodo('semana', new Date(2026, 10, 16, 9)).desde, 2026, 10, 16));
caso('Mes empieza el día 1', () => es(rangoPeriodo('mes', AHORA).desde, 2026, 10, 1));
caso('Trimestre empieza el 1 de octubre', () => es(rangoPeriodo('trimestre', AHORA).desde, 2026, 9, 1));
caso('Año empieza el 1 de enero', () => es(rangoPeriodo('anio', AHORA).desde, 2026, 0, 1));
caso('El periodo termina ahora', () => rangoPeriodo('mes', AHORA).hasta.getTime() === AHORA.getTime());
caso('periodoDeMeta: mensual → mes; semanal o sin meta → semana', () => periodoDeMeta('mensual') === 'mes' && periodoDeMeta('semanal') === 'semana' && periodoDeMeta(undefined) === 'semana');
caso('Resumen: solo pagadas como ingreso y solo dentro del periodo', () => {
  const x = resumen([v(17, 100, 'pagada', 'Pizza'), v(18, 50, 'fallida'), v(10, 999)], [c(19, 30)], r);
  return x.ingresos === 100 && x.gastos === 30 && x.saldo === 70 && x.ventas === 1 && x.fallidos === 1 && x.compras === 1;
});
caso('Saldo negativo cuando compras > ventas', () => resumen([], [c(19, 30)], r).saldo === -30);
caso('Periodo vacío → todo en cero', () => { const x = resumen([], [], r); return [x.ingresos, x.gastos, x.saldo, x.ventas, x.fallidos, x.compras].every((n) => n === 0); });
caso('topConceptos agrupa sin distinguir mayúsculas ni espacios y deja fuera fallidas', () => {
  const t = topConceptos([v(17, 100, 'pagada', 'Pizza'), v(18, 40, 'pagada', ' pizza '), v(18, 30, 'pagada', 'Refresco'), v(18, 500, 'fallida', 'Pizza')], r);
  return t.length === 2 && t[0].concepto === 'Pizza' && t[0].veces === 2 && t[0].monto === 140 && t[1].concepto === 'Refresco';
});
caso('topConceptos con más de 6 conceptos → 6 + "Otros"', () => {
  const t = topConceptos('ABCDEFGH'.split('').map((k, i) => v(17, 100 - i, 'pagada', k)), r, 6);
  return t.length === 7 && t[0].concepto === 'A' && t[6].concepto === 'Otros' && t[6].veces === 2 && t[6].monto === 94 + 93;
});
caso('topConceptos sin ventas → lista vacía', () => topConceptos([], r).length === 0);
caso('porProveedor agrupa, nombra "Sin proveedor" y ordena por monto', () => {
  const p = porProveedor([c(17, 30, 'Bimbo'), c(18, 20, 'bimbo'), c(18, 100, ''), c(10, 999, 'Lala')], r);
  return p.length === 2 && p[0].proveedor === 'Sin proveedor' && p[0].monto === 100 && p[1].proveedor === 'Bimbo' && p[1].compras === 2 && p[1].monto === 50;
});
caso('Tendencia semana: Lun…Dom, venta del martes y compra del jueves, sin fallidas', () => {
  const t = tendencia([v(17, 100), v(18, 50, 'fallida')], [c(19, 30)], 'semana', AHORA);
  return t.length === 7 && t.map((x) => x.etiqueta).join() === 'Lun,Mar,Mié,Jue,Vie,Sáb,Dom' && t[1].ventas === 100 && t[2].ventas === 0 && t[3].compras === 30;
});
caso('Tendencia mes: bloques de 7 días, el 17 cae en "Sem 3"', () => { const t = tendencia([v(17, 100)], [], 'mes', AHORA); return t.length === 5 && t[2].etiqueta === 'Sem 3' && t[2].ventas === 100; });
caso('Tendencia trimestre: Oct, Nov, Dic', () => { const t = tendencia([v(5, 10, 'pagada', 'x', 9)], [], 'trimestre', AHORA); return t.map((x) => x.etiqueta).join() === 'Oct,Nov,Dic' && t[0].ventas === 10; });
caso('Tendencia año: 12 meses, noviembre en el índice 10', () => { const t = tendencia([v(17, 100)], [c(3, 20, 'X', 0)], 'anio', AHORA); return t.length === 12 && t[10].ventas === 100 && t[0].compras === 20; });

caso('topConceptos cuenta por artículo cuando la venta trae renglones', () => {
  const venta = { ...v(17, 320, 'pagada', '2 × Pizza, 1 × Refresco'), items: [{ name: 'Pizza', qty: 2, price: 150 }, { name: 'Refresco', qty: 1, price: 20 }] };
  const t = topConceptos([venta, v(18, 150, 'pagada', 'Pizza')], r);
  return t.length === 2 && t[0].concepto === 'Pizza' && t[0].veces === 3 && t[0].monto === 450 && t[1].concepto === 'Refresco' && t[1].veces === 1 && t[1].monto === 20;
});

caso('Pago de cotización se reparte entre sus renglones', () => {
  const cot = { id: 'c1', total: 1000, renglones: [{ name: 'Portón', qty: 1, price: 800 }, { name: 'Flete', qty: 1, price: 200 }] };
  const t = topConceptos([{ ...v(17, 500, 'pagada', 'Anticipo COT-0001 · Juan'), cotizacionId: 'c1' }], r, 6, [cot]);
  const po = t.find((x) => x.concepto === 'Portón'), fl = t.find((x) => x.concepto === 'Flete');
  return t.length === 2 && !!po && Math.abs(po.monto - 400) < 0.001 && Math.abs(po.veces - 0.5) < 0.001 && !!fl && Math.abs(fl.monto - 100) < 0.001;
});
caso('Pago de una cotización que ya no está cuenta por su concepto', () => {
  const t = topConceptos([{ ...v(17, 500, 'pagada', 'Anticipo COT-0001 · Juan'), cotizacionId: 'zz' }], r, 6, []);
  return t.length === 1 && t[0].concepto === 'Anticipo COT-0001 · Juan' && t[0].monto === 500 && t[0].veces === 1;
});

const malos = casos.filter((t) => !t.pass);
for (const t of malos) console.log(`✘ ${t.name}`);
console.log(`${casos.length - malos.length}/${casos.length} casos pasan`);
if (!malos.length) console.log('OK estadisticas');
process.exit(malos.length ? 1 : 0);
