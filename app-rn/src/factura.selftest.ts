// Pruebas de factura simulada, WhatsApp y avisos (confirmación y permisos). Ejecuta: npm run test:factura
import { armarFactura, avisoRetencion, folioFactura, formaPago, normalizarRFC, PUBLICO_GENERAL, tipoPersona, validarReceptor, validarRFC, type Receptor } from './factura';
import { enlaceWhatsApp, normalizarCelularMX } from './whatsapp';
import { confirmacionCobro, confirmacionCompra, pasoPermiso } from './avisos';

const casos: { name: string; pass: boolean }[] = [];
function caso(name: string, fn: () => boolean) { let pass = false; try { pass = fn(); } catch { pass = false; } casos.push({ name, pass }); }
const rec = (p: Partial<Receptor>): Receptor => ({ rfc: 'GODE561231GR8', nombre: 'Eduardo Gómez', cp: '68000', regimen: '612', uso: 'G03', ...p });
const sinError = (e: object) => Object.keys(e).length === 0;
const FECHA = '2026-11-20T18:00:00.000Z';

// RFC y receptor
caso('RFC de persona válido, aunque venga en minúsculas, con espacios o guiones', () => validarRFC('GODE561231GR8') === null && validarRFC(' gode 561231 gr8 ') === null && normalizarRFC(' gode-561231-gr8 ') === 'GODE561231GR8');
caso('RFC de empresa (12) y genérico de público en general', () => validarRFC('ABC680524P76') === null && validarRFC('XAXX010101000') === null);
caso('RFC vacío, de largo incorrecto o mal formado', () => !!validarRFC('') && !!validarRFC('GODE561231GR') && !!validarRFC('ABCD') && !!validarRFC('G0DE561231GR8'));
caso('Fecha del RFC imposible; el 29 de febrero de 2000 sí existe', () => !!validarRFC('GODE561331GR8') && !!validarRFC('GODE560230GR8') && validarRFC('GODE000229GR8') === null);
caso('Tipo de persona por el largo del RFC', () => tipoPersona('ABC680524P76') === 'moral' && tipoPersona('GODE561231GR8') === 'fisica');
caso('Receptor completo y público en general sin errores', () => sinError(validarReceptor(rec({}))) && sinError(validarReceptor({ ...PUBLICO_GENERAL, cp: '68000' })));
caso('Código postal de 5 dígitos', () => !!validarReceptor(rec({ cp: '6800' })).cp && !!validarReceptor(rec({ cp: '00000' })).cp && !validarReceptor(rec({ cp: '68000' })).cp);
caso('Régimen que no corresponde a la persona', () => !!validarReceptor(rec({ regimen: '601' })).regimen && !!validarReceptor(rec({ rfc: 'ABC680524P76', regimen: '612' })).regimen
  && !validarReceptor(rec({ rfc: 'ABC680524P76', regimen: '601' })).regimen && !validarReceptor(rec({ rfc: 'ABC680524P76', regimen: '626' })).regimen);
caso('Régimen 616 va con uso S01; público en general va con 616', () => !!validarReceptor(rec({ regimen: '616', uso: 'G03' })).uso && !!validarReceptor({ ...PUBLICO_GENERAL, cp: '68000', regimen: '612' }).regimen);
caso('Nombre o razón social obligatorio', () => !!validarReceptor(rec({ nombre: ' a ' })).nombre);
caso('Aviso de retención de 1.25 % solo si el cliente es empresa y tú RESICO', () => (avisoRetencion('ABC680524P76', '626') ?? '').includes('1.25') && avisoRetencion('GODE561231GR8', '626') === null && avisoRetencion('ABC680524P76', null) === null);
caso('Forma de pago del SAT según cómo te pagaron', () => formaPago('efectivo') === '01 Efectivo' && formaPago('efectivo_contingencia') === '01 Efectivo'
  && formaPago('transferencia').startsWith('03') && formaPago('codi').startsWith('03') && formaPago('tarjeta').startsWith('04'));

// Factura
const base = { negocio: 'Pizzería Demo', folio: 'SIM-000001', fecha: FECHA, receptor: rec({}), metodo: 'efectivo' as const, tasaIVA: 0.16, regimenEmisor: '626' as string | null };
caso('Factura: conceptos sin IVA, subtotal, IVA y total = lo cobrado', () => {
  const f = armarFactura({ ...base, renglones: [{ name: 'Pizza', qty: 2, price: 58 }, { name: 'Refresco', qty: 1, price: 116 }], total: 232 });
  return f.conceptos.length === 2 && f.conceptos[0].valorUnitario === 50 && f.conceptos[0].importe === 100 && f.conceptos[1].importe === 100 && f.subtotal === 200
    && f.iva === 32 && f.total === 232 && f.metodoPago === 'PUE' && f.formaPago === '01 Efectivo' && (f.emisor.regimen ?? '').startsWith('626') && f.emisor.nombre === 'Pizzería Demo';
});
caso('Factura con centavos: subtotal + IVA = total exacto', () => {
  const f = armarFactura({ ...base, regimenEmisor: null, metodo: 'tarjeta', renglones: [{ name: 'Tornillo', qty: 3, price: 33.33 }], total: 99.99 });
  return f.subtotal === 86.2 && f.iva === 13.79 && Math.round((f.subtotal + f.iva) * 100) === 9999 && f.emisor.regimen === null;
});
caso('Factura al 0 %: sin IVA', () => { const f = armarFactura({ ...base, tasaIVA: 0, renglones: [{ name: 'Tortilla (kg)', qty: 2, price: 25 }], total: 50 }); return f.iva === 0 && f.subtotal === 50 && f.tasaIVA === 0; });
caso('Factura: RFC normalizado, nombre en mayúsculas, nombres del catálogo y nota', () => {
  const f = armarFactura({ ...base, receptor: rec({ rfc: ' gode561231gr8', nombre: ' Eduardo Gómez ' }), renglones: [{ name: 'Pizza', qty: 1, price: 116 }], total: 116, nota: 'Incluye anticipo' });
  return f.receptor.rfc === 'GODE561231GR8' && f.receptor.nombre === 'EDUARDO GÓMEZ' && f.receptor.regimenNombre.startsWith('612') && f.receptor.usoNombre.startsWith('G03') && f.nota === 'Incluye anticipo';
});
caso('Folio simulado SIM-######', () => /^SIM-\d{6}$/.test(folioFactura(new Date(2026, 10, 20, 10))));

// WhatsApp
caso('WhatsApp: 10 dígitos con espacios, paréntesis o guiones', () => normalizarCelularMX('55 1234 5678') === '525512345678' && normalizarCelularMX('(55) 1234-5678') === '525512345678');
caso('WhatsApp: acepta +52 y 521 delante', () => normalizarCelularMX('+52 55 1234 5678') === '525512345678' && normalizarCelularMX('521 55 1234 5678') === '525512345678' && normalizarCelularMX('52 5512345678') === '525512345678');
caso('WhatsApp: rechaza 9 u 11 dígitos, vacío o que empiece en 0 o 1', () => normalizarCelularMX('551234567') === null && normalizarCelularMX('55123456789') === null
  && normalizarCelularMX('') === null && normalizarCelularMX('0512345678') === null && normalizarCelularMX('1512345678') === null);
caso('Enlace wa.me con el texto codificado (&, salto de línea, ñ)', () => {
  const u = enlaceWhatsApp('5512345678', 'Ticket & total\nñ');
  return u === 'https://wa.me/525512345678?text=' + encodeURIComponent('Ticket & total\nñ') && !!u && u.includes('%26') && u.includes('%0A') && u.includes('%C3%B1');
});
caso('Enlace con número inválido → null', () => enlaceWhatsApp('123', 'hola') === null);

// Avisos
caso('Confirmación de cobro: monto, método, resumen y que ya no se modifica', () => {
  const c = confirmacionCobro({ monto: 232, metodo: 'Efectivo', resumen: '2 × Pizza, 1 × Refresco' });
  return c.titulo === '¿Cobrar $232.00?' && c.mensaje.includes('Efectivo · 2 × Pizza, 1 × Refresco') && c.mensaje.includes('ya no se puede modificar');
});
caso('Confirmación de cobro recorta un resumen muy largo', () => { const c = confirmacionCobro({ monto: 1, metodo: 'Efectivo', resumen: 'x'.repeat(300) }); return c.mensaje.split('\n')[0].length <= 140 && c.mensaje.includes('…'); });
caso('Confirmación de compra: total, proveedor y renglones', () => {
  const c = confirmacionCompra({ total: 480, proveedor: 'Bimbo', renglones: 3 }), d = confirmacionCompra({ total: 10, proveedor: ' ', renglones: 1 });
  return c.titulo === '¿Guardar la compra de $480.00?' && c.mensaje.includes('Bimbo · 3 renglones') && c.mensaje.includes('ya no se puede modificar') && d.mensaje.includes('Sin proveedor · 1 renglón');
});
caso('Permiso: usar si ya hay (también limitado), pedir si iOS puede preguntar, ajustes si se negó', () =>
  pasoPermiso({ granted: true, canAskAgain: false }) === 'usar' && pasoPermiso({ granted: false, canAskAgain: true }) === 'pedir' && pasoPermiso({ granted: false, canAskAgain: false }) === 'ajustes');

const malos = casos.filter((t) => !t.pass);
for (const t of malos) console.log(`✘ ${t.name}`);
console.log(`${casos.length - malos.length}/${casos.length} casos pasan`);
if (!malos.length) console.log('OK factura');
process.exit(malos.length ? 1 : 0);
