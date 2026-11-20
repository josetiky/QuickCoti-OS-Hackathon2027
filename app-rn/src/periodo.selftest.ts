// Pruebas del resumen del periodo (meta y saldo de Inicio). Ejecuta: npm run test:periodo
import { resumenPeriodo } from './periodo';

const casos: { name: string; pass: boolean }[] = [];
function caso(name: string, fn: () => boolean) { let p = false; try { p = fn(); } catch { p = false; } casos.push({ name, pass: p }); }
const d = (y: number, m: number, dia: number, h = 12) => new Date(y, m - 1, dia, h).toISOString();
const venta = (fecha: string, amount: number, status = 'pagada') => ({ date: fecha, amount, status });
const compra = (fecha: string, total: number) => ({ date: fecha, total });
const VIERNES = new Date(2026, 10, 20, 10);

caso('Semana empieza el lunes 16 a las 00:00', () => {
  const r = resumenPeriodo([], [], 'semanal', VIERNES);
  return r.desde.getTime() === new Date(2026, 10, 16, 0, 0, 0).getTime() && r.etiqueta === 'Esta semana';
});
caso('Venta del domingo anterior (15) no cuenta', () => resumenPeriodo([venta(d(2026, 11, 15), 100), venta(d(2026, 11, 16), 50)], [], 'semanal', VIERNES).ventas === 50);
caso('El domingo 22 sigue en la semana del lunes 16', () =>
  resumenPeriodo([], [], 'semanal', new Date(2026, 10, 22, 20)).desde.getTime() === new Date(2026, 10, 16).getTime());
caso('Ventas fallidas no cuentan', () => resumenPeriodo([venta(d(2026, 11, 18), 300, 'fallida'), venta(d(2026, 11, 18), 200)], [], 'semanal', VIERNES).ventas === 200);
caso('Saldo = ventas − compras (en contra si es negativo)', () => {
  const r = resumenPeriodo([venta(d(2026, 11, 17), 500)], [compra(d(2026, 11, 18), 800)], 'semanal', VIERNES);
  return r.compras === 800 && r.saldo === -300;
});
caso('Mensual empieza el día 1 y se llama "Este mes"', () => {
  const r = resumenPeriodo([venta(d(2026, 10, 31), 70), venta(d(2026, 11, 2), 30)], [], 'mensual', VIERNES);
  return r.desde.getTime() === new Date(2026, 10, 1).getTime() && r.etiqueta === 'Este mes' && r.ventas === 30;
});

const malos = casos.filter((t) => !t.pass);
for (const t of malos) console.log(`✘ ${t.name}`);
console.log(`${casos.length - malos.length}/${casos.length} casos pasan`);
process.exit(malos.length ? 1 : 0);
