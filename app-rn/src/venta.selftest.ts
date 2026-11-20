// Pruebas de la venta con varios artículos. Ejecuta: npm run test:venta
import { agregarProducto, aRenglones, descontarInventario, lineasDesdePreset, precioSugerido, resumenRenglones, totalRenglones, type LineaVenta } from './venta';

const casos: { name: string; pass: boolean }[] = [];
function caso(name: string, fn: () => boolean) { let pass = false; try { pass = fn(); } catch { pass = false; } casos.push({ name, pass }); }
let n = 0; const id = () => `id${++n}`;
const vacia = (): LineaVenta => ({ id: id(), desc: '', qty: '1', price: '' });
const pizza = { id: 'p1', name: 'Pizza', price: 150, unitCost: 90 };
const refresco = { id: 'p2', name: 'Refresco', price: null, unitCost: 16 };

caso('Precio sugerido: precio de venta o costo × 1.25', () => precioSugerido(pizza) === 150 && precioSugerido(refresco) === 20);
caso('Agregar producto ocupa el renglón vacío', () => { const l = agregarProducto([vacia()], pizza, id); return l.length === 1 && l[0].desc === 'Pizza' && l[0].qty === '1' && l[0].price === '150' && l[0].productId === 'p1'; });
caso('Agregar el mismo producto suma uno', () => { const l = agregarProducto(agregarProducto([vacia()], pizza, id), pizza, id); return l.length === 1 && l[0].qty === '2'; });
caso('Agregar otro producto agrega renglón', () => { const l = agregarProducto(agregarProducto([vacia()], pizza, id), refresco, id); return l.length === 2 && l[1].desc === 'Refresco' && l[1].price === '20'; });
caso('Agregar producto conserva renglones escritos a mano', () => { const l = agregarProducto([{ id: 'a', desc: 'Envío', qty: '1', price: '30' }], pizza, id); return l.length === 2 && l[0].desc === 'Envío' && l[1].desc === 'Pizza'; });
caso('aRenglones ignora incompletos/en cero y acepta coma decimal', () => {
  const r = aRenglones([{ id: 'a', desc: ' Pizza ', qty: '2', price: '150', productId: 'p1' }, { id: 'b', desc: 'Queso', qty: '1,5', price: '20,5' }, { id: 'c', desc: '', qty: '1', price: '10' }, { id: 'd', desc: 'Nada', qty: '0', price: '10' }]);
  return r.length === 2 && r[0].name === 'Pizza' && r[0].qty === 2 && r[0].productId === 'p1' && r[1].qty === 1.5 && r[1].price === 20.5 && r[1].productId === undefined;
});
caso('Total = Σ cantidad × precio, redondeado a centavos', () => totalRenglones([{ name: 'a', qty: 3, price: 0.1 }, { name: 'b', qty: 2, price: 150 }]) === 300.3);
caso('Resumen "2 × Pizza, 1 × Refresco"', () => resumenRenglones([{ name: 'Pizza', qty: 2, price: 150 }, { name: 'Refresco', qty: 1, price: 20 }]) === '2 × Pizza, 1 × Refresco');
caso('Resumen con cantidad decimal', () => resumenRenglones([{ name: 'Queso (kg)', qty: 1.5, price: 100 }]) === '1.5 × Queso (kg)');
caso('Inventario: descuenta la suma por producto y nunca baja de cero', () => {
  const p = descontarInventario([{ id: 'p1', stock: 5 }, { id: 'p2', stock: 1 }, { id: 'p3', stock: 4 }],
    [{ name: 'Pizza', qty: 2, price: 1, productId: 'p1' }, { name: 'Pizza', qty: 1, price: 1, productId: 'p1' }, { name: 'Refresco', qty: 3, price: 1, productId: 'p2' }, { name: 'Envío', qty: 1, price: 30 }]);
  return p[0].stock === 2 && p[1].stock === 0 && p[2].stock === 4;
});
caso('Preset con concepto y monto → un renglón', () => { const l = lineasDesdePreset({ concept: 'Renta: sillas', amount: 300 }, id); return l.length === 1 && l[0].desc === 'Renta: sillas' && l[0].qty === '1' && l[0].price === '300'; });
caso('Preset con renglones de Cotizar', () => { const l = lineasDesdePreset({ lineas: [{ desc: 'Sillas', qty: '80', price: '12' }, { desc: 'Mesas', qty: '10', price: '55' }] }, id); return l.length === 2 && l[1].desc === 'Mesas' && l[1].qty === '10' && l[1].price === '55'; });
caso('Preset vacío → un renglón vacío', () => { const l = lineasDesdePreset({}, id); return l.length === 1 && l[0].desc === '' && l[0].price === ''; });

const malos = casos.filter((t) => !t.pass);
for (const t of malos) console.log(`✘ ${t.name}`);
console.log(`${casos.length - malos.length}/${casos.length} casos pasan`);
if (!malos.length) console.log('OK venta');
process.exit(malos.length ? 1 : 0);
