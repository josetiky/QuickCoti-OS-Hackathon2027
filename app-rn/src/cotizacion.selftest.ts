// Pruebas de cotizaciones por cobrar (anticipo y liquidación). Ejecuta: npm run test:cotizacion
import {
  abierta, anticipoSugerido, aplicarPago, cancelarCotizacion, conceptoPago, etiquetaEstado, folioCotizacion, nuevaCotizacion, pagado, porCobrar,
  saldo, tipoDePago, totalPorCobrar, type Cotizacion,
} from './cotizacion';

const casos: { name: string; pass: boolean }[] = [];
function caso(name: string, fn: () => boolean) { let pass = false; try { pass = fn(); } catch { pass = false; } casos.push({ name, pass }); }
const AHORA = '2026-11-20T18:00:00.000Z';
const PORTON = [{ name: 'Portón 3×2 m', qty: 1, price: 8000 }, { name: 'Cargos (flete y extras)', qty: 1, price: 500 }];
const base = (pct = 50) => nuevaCotizacion({ cliente: '  Juan Pérez ', renglones: PORTON, anticipoPct: pct }, 'c1', folioCotizacion(3), AHORA);
let n = 0;
const pago = (c: Cotizacion, monto: number) => aplicarPago(c, { saleId: `s${++n}`, fecha: AHORA, monto });

caso('Folio con 4 dígitos', () => folioCotizacion(1) === 'COT-0001' && folioCotizacion(123) === 'COT-0123');
caso('Nueva: total = suma, pendiente, sin pagos, sin factura y cliente limpio', () => {
  const c = base();
  return c.total === 8500 && c.estado === 'pendiente' && c.pagos.length === 0 && !c.facturar && c.cliente === 'Juan Pérez' && c.folio === 'COT-0003'
    && c.id === 'c1' && c.fecha === AHORA && c.actualizada === AHORA && abierta(c) && c.renglones.length === 2;
});
caso('Anticipo % se acota entre 0 y 100', () => base(150).anticipoPct === 100 && base(-5).anticipoPct === 0);
caso('Anticipo sugerido: 50 % de 8,500 = 4,250', () => anticipoSugerido(base()) === 4250);
caso('Sin anticipo pedido (0 %) sugiere cobrar todo', () => anticipoSugerido(base(0)) === 8500);
caso('Recibir anticipo: queda «anticipo» con su saldo', () => {
  const c = pago(base(), 4250)!;
  return c.estado === 'anticipo' && pagado(c) === 4250 && saldo(c) === 4250 && c.pagos[0].tipo === 'anticipo' && c.pagos[0].monto === 4250 && abierta(c);
});
caso('Con un pago ya hecho sugiere cobrar lo que resta', () => anticipoSugerido(pago(base(), 1000)!) === 7500);
caso('Pagar lo que resta la liquida', () => {
  const c = pago(pago(base(), 4250)!, 4250)!;
  return c.estado === 'pagada' && saldo(c) === 0 && c.pagos.length === 2 && c.pagos[1].tipo === 'liquidacion' && !abierta(c);
});
caso('Un solo pago por el total es liquidación', () => { const c = pago(base(), 8500)!; return c.estado === 'pagada' && c.pagos.length === 1 && c.pagos[0].tipo === 'liquidacion'; });
caso('No acepta pago mayor al saldo, en cero o negativo', () => pago(base(), 8500.01) === null && pago(base(), 0) === null && pago(base(), -10) === null && pago(base(), NaN) === null);
caso('No acepta pagos en cotización pagada o cancelada', () => pago(pago(base(), 8500)!, 1) === null && pago(cancelarCotizacion(base(), AHORA)!, 1) === null);
caso('Centavos: 0.1 + 0.2 liquidan una cotización de 0.3', () => {
  const c = nuevaCotizacion({ cliente: 'Ana', renglones: [{ name: 'Tornillo', qty: 3, price: 0.1 }], anticipoPct: 0 }, 'c2', 'COT-0009', AHORA);
  const d = pago(pago(c, 0.1)!, 0.2)!;
  return c.total === 0.3 && d.estado === 'pagada' && saldo(d) === 0;
});
caso('tipoDePago: menos que el saldo es anticipo; el saldo exacto es liquidación', () => tipoDePago(base(), 100) === 'anticipo' && tipoDePago(base(), 8500) === 'liquidacion');
caso('Aplicar un pago no cambia la cotización original', () => { const c = base(); pago(c, 100); return c.pagos.length === 0 && c.estado === 'pendiente'; });
caso('Cancelar: abierta → cancelada y conserva lo pagado; cerrada → null', () => {
  const x = cancelarCotizacion(pago(base(), 1000)!, AHORA)!;
  return x.estado === 'cancelada' && pagado(x) === 1000 && cancelarCotizacion(x, AHORA) === null && cancelarCotizacion(pago(base(), 8500)!, AHORA) === null;
});
caso('Por cobrar: solo abiertas, la más nueva primero, y suma de saldos', () => {
  const a = { ...base(), id: 'a', fecha: '2026-11-18T10:00:00.000Z' };
  const b = { ...pago(base(), 4250)!, id: 'b', fecha: '2026-11-19T10:00:00.000Z' };
  const p = { ...pago(base(), 8500)!, id: 'p' };
  const x = { ...cancelarCotizacion(base(), AHORA)!, id: 'x' };
  const l = porCobrar([a, p, b, x]);
  return l.length === 2 && l[0].id === 'b' && l[1].id === 'a' && totalPorCobrar([a, p, b, x]) === 12750;
});
caso('Concepto del pago (Movimientos y bitácora)', () => conceptoPago(base(), 'anticipo') === 'Anticipo COT-0003 · Juan Pérez' && conceptoPago(base(), 'liquidacion') === 'Liquidación COT-0003 · Juan Pérez');
caso('Etiqueta del estado', () => etiquetaEstado(base()) === 'Pendiente' && etiquetaEstado(pago(base(), 1000)!) === 'Anticipo $1,000.00 · resta $7,500.00'
  && etiquetaEstado(pago(base(), 8500)!) === 'Pagada' && etiquetaEstado(cancelarCotizacion(base(), AHORA)!) === 'Cancelada');

const malos = casos.filter((t) => !t.pass);
for (const t of malos) console.log(`✘ ${t.name}`);
console.log(`${casos.length - malos.length}/${casos.length} casos pasan`);
if (!malos.length) console.log('OK cotizacion');
process.exit(malos.length ? 1 : 0);
