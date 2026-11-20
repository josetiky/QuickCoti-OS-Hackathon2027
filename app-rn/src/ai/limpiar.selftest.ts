// Pruebas: lo que devuelve Hermes al estructurar un ticket se limpia ANTES de llegar a la pantalla (si llega con otra
// forma, la pantalla de revisión tronaba y la app se cerraba). Ejecuta: npx tsx src/ai/limpiar.selftest.ts
import { limpiarSalidaIA } from './limpiar';

const casos: { name: string; pass: boolean }[] = [];
function caso(name: string, fn: () => boolean) { let pass = false; try { pass = fn(); } catch { pass = false; } casos.push({ name, pass }); }

caso('«missing» como texto → lista de textos', () => { const r = limpiarSalidaIA({ missing: 'total' }); return Array.isArray(r.missing) && r.missing.length === 1 && r.missing[0] === 'total'; });
caso('«missing» con objetos, vacíos o repetidos → textos únicos', () => {
  const r = limpiarSalidaIA({ missing: ['total', { campo: 'fecha' }, '', null, 'total', 7] });
  return r.missing.every((m) => typeof m === 'string' && m.length > 0) && new Set(r.missing).size === r.missing.length && r.missing.includes('total') && r.missing.includes('7');
});
caso('Sin «missing» o con algo raro → lista vacía', () => limpiarSalidaIA({}).missing.length === 0 && limpiarSalidaIA({ missing: { a: 1 } }).missing.length >= 0 && Array.isArray(limpiarSalidaIA({ missing: 42 }).missing));
caso('Proveedor como texto suelto → { value: texto }', () => { const r = limpiarSalidaIA({ supplier: 'Bimbo' }); return r.supplier.value === 'Bimbo' && typeof r.supplier.confidence === 'number'; });
caso('Proveedor o fecha con número → texto (el campo de la pantalla solo acepta texto)', () => {
  const r = limpiarSalidaIA({ supplier: { value: 123, confidence: '0.8' }, date: { value: 20261120 } });
  return r.supplier.value === '123' && r.supplier.confidence === 0.8 && r.date.value === '20261120' && r.date.confidence === 0;
});
caso('Proveedor u otros valores como objeto o null → null', () => {
  const r = limpiarSalidaIA({ supplier: { value: { nombre: 'X' } }, date: null });
  return r.supplier.value === null && r.date.value === null && r.date.confidence === 0;
});
caso('Salida vacía o no-objeto → todo en blanco sin tronar', () => { const a = limpiarSalidaIA(null), b = limpiarSalidaIA('hola'); return a.supplier.value === null && a.missing.length === 0 && b.date.value === null; });

const malos = casos.filter((t) => !t.pass);
for (const t of malos) console.log(`✘ ${t.name}`);
console.log(`${casos.length - malos.length}/${casos.length} casos pasan`);
if (!malos.length) console.log('OK limpiar');
process.exit(malos.length ? 1 : 0);
