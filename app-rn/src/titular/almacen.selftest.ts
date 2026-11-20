// Pruebas del almacén del titular (lógica pura, con almacenes en memoria). Ejecuta: npm run test:titular
import { CLAVE_TITULAR, FALTA_MODULO_SEGURO, MARCA_INSTALACION, crearAlmacen, llaveroPerezoso, separarClabeLegada, type KV } from './almacen';
import { DEMO_TITULAR, type Titular } from './valida';

function memoria(inicial: Record<string, string> = {}): KV & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return {
    datos,
    get: async (k) => (k in datos ? datos[k] : null),
    set: async (k, v) => { datos[k] = v; },
    del: async (k) => { delete datos[k]; },
  };
}
const T: Titular = { ...DEMO_TITULAR, aceptoAviso: '2026-11-20T00:00:00.000Z', avisoVersion: '2026-11-20' };
const casos: { name: string; pass: boolean }[] = [];
async function caso(name: string, fn: () => Promise<boolean> | boolean) {
  let pass = false;
  try { pass = await fn(); } catch { pass = false; }
  casos.push({ name, pass });
}

(async () => {
  await caso('Instalación nueva: borra un titular viejo del llavero y devuelve null', async () => {
    const seguro = memoria({ [CLAVE_TITULAR]: JSON.stringify(T) }); const marca = memoria();
    const r = await crearAlmacen(seguro, marca).cargar();
    return r === null && !(CLAVE_TITULAR in seguro.datos) && marca.datos[MARCA_INSTALACION] === '1';
  });
  await caso('Con marca de instalación: guardar y cargar devuelve los mismos datos', async () => {
    const a = crearAlmacen(memoria(), memoria({ [MARCA_INSTALACION]: '1' }));
    await a.guardar(T); const r = await a.cargar();
    return !!r && r.curp === T.curp && r.clabe === T.clabe && r.nombre === T.nombre && r.aceptoAviso === T.aceptoAviso;
  });
  await caso('Guardar en instalación sin marca la deja marcada (no se borra al reabrir)', async () => {
    const marca = memoria(); const a = crearAlmacen(memoria(), marca);
    await a.guardar(T); const r = await a.cargar();
    return !!r && r.curp === T.curp && marca.datos[MARCA_INSTALACION] === '1';
  });
  await caso('JSON corrupto en el llavero → null sin lanzar error', async () =>
    (await crearAlmacen(memoria({ [CLAVE_TITULAR]: '{no es json' }), memoria({ [MARCA_INSTALACION]: '1' })).cargar()) === null);
  await caso('JSON con forma inválida → null', async () =>
    (await crearAlmacen(memoria({ [CLAVE_TITULAR]: JSON.stringify({ nombre: 'x' }) }), memoria({ [MARCA_INSTALACION]: '1' })).cargar()) === null);
  await caso('Borrar elimina el titular', async () => {
    const seguro = memoria(); const a = crearAlmacen(seguro, memoria({ [MARCA_INSTALACION]: '1' }));
    await a.guardar(T); await a.borrar();
    return (await a.cargar()) === null && !(CLAVE_TITULAR in seguro.datos);
  });
  await caso('Un error del llavero al guardar se propaga (no se traga)', async () => {
    const roto: KV = { get: async () => null, set: async () => { throw new Error('keychain'); }, del: async () => {} };
    try { await crearAlmacen(roto, memoria({ [MARCA_INSTALACION]: '1' })).guardar(T); return false; } catch { return true; }
  });
  await caso('separarClabeLegada quita la CLABE del estado y la limpia', () => {
    const { estado, clabeLegada } = separarClabeLegada({ clabe: '0021 8000 0000 0000 09', profile: { n: 1 }, a11yDetected: true });
    return !('clabe' in estado) && (estado as any).profile.n === 1 && (estado as any).a11yDetected === true && clabeLegada === '002180000000000009';
  });
  await caso('separarClabeLegada sin CLABE o sin estado → cadena vacía', () => {
    const a = separarClabeLegada({ profile: null }); const b = separarClabeLegada(undefined);
    return a.clabeLegada === '' && b.clabeLegada === '' && Object.keys(b.estado).length === 0;
  });

  await caso('Si falta el módulo nativo, crear el llavero no truena y cada operación falla con FALTA_MODULO_SEGURO', async () => {
    const kv = llaveroPerezoso(() => { throw new Error("Cannot find native module 'ExpoSecureStore'"); });
    const motivo = async (f: () => Promise<unknown>) => { try { await f(); return 'sin error'; } catch (e: any) { return e?.message; } };
    return (await motivo(() => kv.get('x'))) === FALTA_MODULO_SEGURO && (await motivo(() => kv.set('x', '1'))) === FALTA_MODULO_SEGURO
      && (await motivo(() => kv.del('x'))) === FALTA_MODULO_SEGURO;
  });
  await caso('Sin módulo nativo, guardar el titular falla con FALTA_MODULO_SEGURO', async () => {
    const a = crearAlmacen(llaveroPerezoso(() => { throw new Error('x'); }), memoria({ [MARCA_INSTALACION]: '1' }));
    try { await a.guardar(T); return false; } catch (e: any) { return e?.message === FALTA_MODULO_SEGURO; }
  });
  await caso('llaveroPerezoso carga el módulo una sola vez y delega', async () => {
    let cargas = 0; const mem = memoria();
    const kv = llaveroPerezoso(() => { cargas++; return mem; });
    await kv.set('k', 'v'); const v = await kv.get('k'); await kv.del('k');
    return cargas === 1 && v === 'v' && !('k' in mem.datos);
  });

  for (const t of casos) console.log(`${t.pass ? '✔' : '✘'} ${t.name}`);
  const ok = casos.every((t) => t.pass);
  console.log(`${casos.filter((t) => t.pass).length}/${casos.length} casos pasan`);
  if (ok) console.log('OK almacén');
  process.exit(ok ? 0 : 1);
})();
