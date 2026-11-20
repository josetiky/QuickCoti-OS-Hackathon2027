// Pruebas de documentos (ticket, pago de cotización, cotización y factura simulada) en HTML y texto. Ejecuta: npm run test:documentos
import { cotizacionHTML, cotizacionTexto, facturaHTML, facturaTexto, ticketHTML, ticketTexto, type Ticket } from './documentos';
import { armarFactura } from './factura';
import { aplicarPago, nuevaCotizacion } from './cotizacion';

const casos: { name: string; pass: boolean }[] = [];
function caso(name: string, fn: () => boolean) { let pass = false; try { pass = fn(); } catch { pass = false; } casos.push({ name, pass }); }
const FECHA = '2026-11-20T18:00:00.000Z';
const T0: Ticket = { folio: 'VTA-123456', negocio: 'Pizzería Demo', concepto: '2 × Pizza, 1 × Refresco', monto: 232, metodo: 'Efectivo', estatus: 'PAGADO', fecha: FECHA, simulado: false,
  renglones: [{ name: 'Pizza', qty: 2, price: 58 }, { name: 'Refresco', qty: 1, price: 116 }] };

caso('Ticket de venta: renglones y TOTAL como antes', () => { const x = ticketTexto(T0); return x.includes('2 × Pizza  $116.00') && x.includes('TOTAL: $232.00 MXN') && x.includes('Folio: VTA-123456') && x.includes('Método: Efectivo') && x.startsWith('Pizzería Demo\nComprobante de venta'); });
caso('Ticket simulado lo dice en HTML y en texto', () => { const t = { ...T0, simulado: true }; return ticketHTML(t).includes('SIMULACIÓN') && ticketTexto(t).includes('SIMULADO'); });
caso('Pago de cotización: total, pagado antes, este pago y resta (sin TOTAL engañoso)', () => {
  const t: Ticket = { ...T0, concepto: 'Anticipo COT-0003 · Juan', monto: 4250, cotizacion: { folio: 'COT-0003', total: 8500, pagadoAntes: 0, resta: 4250, tipo: 'anticipo' } };
  const x = ticketTexto(t), h = ticketHTML(t);
  return x.includes('COT-0003') && x.includes('Total de la cotización: $8,500.00') && x.includes('Este pago (anticipo): $4,250.00') && x.includes('Resta: $4,250.00')
    && !x.includes('TOTAL: $4,250.00') && h.includes('ESTE PAGO (ANTICIPO)') && h.includes('$8,500.00') && h.includes('COMPROBANTE DE PAGO');
});
caso('Liquidación: pagado antes y «Cotización liquidada»', () => {
  const x = ticketTexto({ ...T0, monto: 4250, cotizacion: { folio: 'COT-0003', total: 8500, pagadoAntes: 4250, resta: 0, tipo: 'liquidacion' } });
  return x.includes('Este pago (liquidación): $4,250.00') && x.includes('Pagado antes: $4,250.00') && x.includes('Cotización liquidada') && !x.includes('Resta:');
});
caso('Ticket HTML escapa lo que escribe el usuario', () => {
  const h = ticketHTML({ ...T0, cliente: '<b>Ana & "Leo"</b>', renglones: [{ name: '<img src=x>', qty: 1, price: 1 }] });
  return h.includes('&lt;b&gt;Ana &amp; &quot;Leo&quot;&lt;/b&gt;') && !h.includes('<img src=x>') && !h.includes('<b>Ana');
});

const COT = nuevaCotizacion({ cliente: 'Juan & Hijos', renglones: [{ name: 'Portón 3×2 m', qty: 1, price: 8000 }, { name: 'Cargos (flete y extras)', qty: 1, price: 500 }], anticipoPct: 50 }, 'c1', 'COT-0003', FECHA);
caso('Cotización en texto: folio, cliente, renglones, total, anticipo e IVA', () => {
  const x = cotizacionTexto(COT, 'Herrería Demo', 0.16);
  return x.includes('Cotización COT-0003') && x.startsWith('Herrería Demo') && x.includes('Cliente: Juan & Hijos') && x.includes('1 × Portón 3×2 m  $8,000.00')
    && x.includes('Total: $8,500.00 MXN') && x.includes('Anticipo: 50 % ($4,250.00)') && x.includes('IVA incluido');
});
caso('Cotización sin anticipo no lo menciona; con pagos muestra pagado y resta', () => {
  const sin = cotizacionTexto({ ...COT, anticipoPct: 0 }, 'X', 0.16), con = cotizacionTexto(aplicarPago(COT, { saleId: 's', fecha: FECHA, monto: 1000 })!, 'X', 0.16);
  return !sin.includes('Anticipo:') && con.includes('Pagado: $1,000.00') && con.includes('Resta: $7,500.00') && !con.includes('Anticipo: 50');
});
caso('Cotización en HTML: escapa y aclara IVA incluido', () => { const h = cotizacionHTML(COT, 'Herrería <Demo>', 0.16); return h.includes('Juan &amp; Hijos') && h.includes('Herrería &lt;Demo&gt;') && h.includes('IVA incluido') && h.includes('COT-0003') && h.includes('$8,500.00'); });
caso('Cotización al 0 % dice IVA 0 %', () => cotizacionHTML(COT, 'X', 0).includes('IVA 0 %') && cotizacionTexto(COT, 'X', 0).includes('IVA 0 %'));

const FAC = armarFactura({ negocio: 'Pizzería & Co', folio: 'SIM-000001', fecha: FECHA, receptor: { rfc: 'GODE561231GR8', nombre: 'Eduardo <Gómez>', cp: '68000', regimen: '612', uso: 'G03' },
  renglones: [{ name: 'Pizza', qty: 2, price: 58 }, { name: 'Refresco', qty: 1, price: 116 }], total: 232, metodo: 'efectivo', tasaIVA: 0.16, regimenEmisor: '626', nota: 'Incluye anticipo de $100.00' });
caso('Factura HTML: SIMULADA, sin validez, receptor, totales, forma y método de pago, nota', () => {
  const h = facturaHTML(FAC);
  return h.includes('FACTURA SIMULADA') && h.includes('NO ES UN CFDI VÁLIDO ANTE EL SAT') && h.includes('GODE561231GR8') && h.includes('$200.00') && h.includes('$32.00')
    && h.includes('$232.00') && h.includes('PUE') && h.includes('01 Efectivo') && h.includes('Incluye anticipo') && h.includes('no incluido');
});
caso('Factura HTML escapa nombres', () => { const h = facturaHTML(FAC); return h.includes('EDUARDO &lt;GÓMEZ&gt;') && h.includes('Pizzería &amp; Co') && !h.includes('<GÓMEZ>'); });
caso('Factura en texto: SIMULADA, folio, receptor, subtotal, IVA y total', () => {
  const x = facturaTexto(FAC);
  return x.includes('FACTURA SIMULADA') && x.includes('no es un CFDI válido') && x.includes('SIM-000001') && x.includes('GODE561231GR8') && x.includes('Subtotal: $200.00')
    && x.includes('IVA 16 %: $32.00') && x.includes('Total: $232.00 MXN');
});

const malos = casos.filter((t) => !t.pass);
for (const t of malos) console.log(`✘ ${t.name}`);
console.log(`${casos.length - malos.length}/${casos.length} casos pasan`);
if (!malos.length) console.log('OK documentos');
process.exit(malos.length ? 1 : 0);
