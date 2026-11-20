// Pruebas de validadores del titular. Ejecuta: npm run test:titular
// Vectores calculados a mano (no con este código): XEXX010101HOCXXX02, XEXX010101HNEXXXA4 (CURP genérica del SAT), 002180000000000009.
import {
  DEMO_TITULAR, armarTitular, esTitular, mascaraCLABE, mascaraCURP, mascaraTel, normCURP, soloDigitos,
  validarCLABE, validarCURP, validarNombre, validarTel, validarTitular,
} from './valida';

const casos: { name: string; pass: boolean }[] = [];
function caso(name: string, fn: () => boolean) {
  let pass = false;
  try { pass = fn(); } catch { pass = false; }
  casos.push({ name, pass });
}
const tiene = (s: string | null, sub: string) => !!s && s.includes(sub);

caso('CURP demo es el literal calculado a mano', () => DEMO_TITULAR.curp === 'XEXX010101HOCXXX02');
caso('CURP demo es válida', () => validarCURP(DEMO_TITULAR.curp) === null);
caso('CURP genérica del SAT es válida', () => validarCURP('XEXX010101HNEXXXA4') === null);
caso('CURP en minúsculas y con espacios se normaliza', () => validarCURP(' xexx010101hocxxx02 ') === null);
caso('CURP con último dígito cambiado → menciona "dígito"', () => tiene(validarCURP('XEXX010101HOCXXX03'), 'dígito'));
caso('CURP corta → menciona "18"', () => tiene(validarCURP('ABC'), '18'));
caso('CURP vacía → pide la CURP', () => tiene(validarCURP(''), 'CURP'));
caso('CURP con mes 13 → inválida', () => validarCURP('XEXX011301HOCXXX02') !== null);
caso('CLABE demo es el literal calculado a mano', () => DEMO_TITULAR.clabe === '002180000000000009');
caso('CLABE demo es válida', () => validarCLABE(DEMO_TITULAR.clabe) === null);
caso('CLABE con espacios y guiones se limpia', () => validarCLABE('0021 8000 0000-0000 09') === null);
caso('CLABE con dígito de control cambiado → menciona "control"', () => tiene(validarCLABE('002180000000000008'), 'control'));
caso('CLABE de 17 dígitos → menciona "18"', () => tiene(validarCLABE('00218000000000000'), '18'));
caso('Teléfono vacío es válido (opcional)', () => validarTel('') === null);
caso('Teléfono de 10 dígitos con espacios es válido', () => validarTel('951 000 0000') === null);
caso('Teléfono de 5 dígitos → inválido', () => validarTel('12345') !== null);
caso('Nombre de una sola palabra → inválido', () => validarNombre('Ana') !== null);
caso('Nombre y apellido → válido', () => validarNombre('Ana López') === null);
caso('Nombre con espacios de más → válido', () => validarNombre('  Ana   López  ') === null);
caso('Nombre con números → inválido', () => validarNombre('Ana 123') !== null);
caso('validarTitular: CURP vacía solo marca curp', () => {
  const e = validarTitular({ ...DEMO_TITULAR, curp: '' });
  return !!e.curp && !e.clabe && !e.nombre && !e.telefono;
});
caso('validarTitular: datos demo sin errores', () => Object.keys(validarTitular(DEMO_TITULAR)).length === 0);
caso('Máscara CLABE muestra solo últimos 4', () => mascaraCLABE('002180000000000003') === '•••• 0003');
caso('Máscara CURP: 4 + 10 puntos + 2 (16)', () => mascaraCURP('XEXX010101HOCXXX02') === 'XEXX••••••••••02');
caso('Máscara teléfono muestra últimos 4', () => mascaraTel('9510000000') === '•••••• 0000');
caso('Máscara teléfono vacío es vacía', () => mascaraTel('') === '');
caso('normCURP y soloDigitos', () => normCURP(' xe xx ') === 'XEXX' && soloDigitos('a1-2 3') === '123');
caso('esTitular acepta un titular completo', () => esTitular({ ...DEMO_TITULAR, aceptoAviso: '2026-11-20T00:00:00.000Z' }));
caso('esTitular rechaza datos incompletos o nulos', () => !esTitular({ nombre: 'x' }) && !esTitular(null) && !esTitular('x'));

const AHORA = '2026-11-20T15:00:00.000Z';
caso('armarTitular normaliza lo tecleado y omite teléfono vacío', () => {
  const t = armarTitular({ nombre: '  ana   lópez ', curp: ' xexx010101hocxxx02', clabe: '0021 8000 0000 0000 09', telefono: '' }, null, AHORA, 'v1');
  return t.nombre === 'ana lópez' && t.curp === 'XEXX010101HOCXXX02' && t.clabe === '002180000000000009' && t.telefono === undefined;
});
caso('armarTitular limpia el teléfono', () =>
  armarTitular({ nombre: 'Ana López', curp: 'XEXX010101HNEXXXA4', clabe: '002180000000000009', telefono: '951 000 0000' }, null, AHORA, 'v1').telefono === '9510000000');
caso('armarTitular marca DEMO solo con CURP y CLABE de demostración', () => {
  const demo = armarTitular({ ...DEMO_TITULAR, telefono: '' }, null, AHORA, 'v1');
  const real = armarTitular({ nombre: 'Ana López', curp: 'XEXX010101HNEXXXA4', clabe: '002180000000000009', telefono: '' }, null, AHORA, 'v1');
  return demo.demo === true && real.demo === undefined;
});
caso('armarTitular registra fecha y versión del aviso en un registro nuevo', () => {
  const t = armarTitular({ ...DEMO_TITULAR, telefono: '' }, null, AHORA, 'v1');
  return t.aceptoAviso === AHORA && t.avisoVersion === 'v1';
});
caso('armarTitular conserva fecha y versión del aviso al editar', () => {
  const previo = { ...DEMO_TITULAR, aceptoAviso: '2026-01-01T00:00:00.000Z', avisoVersion: 'v0' };
  const t = armarTitular({ nombre: 'Ana López', curp: 'XEXX010101HNEXXXA4', clabe: '002180000000000009', telefono: '' }, previo, AHORA, 'v1');
  return t.aceptoAviso === '2026-01-01T00:00:00.000Z' && t.avisoVersion === 'v0' && t.demo === undefined;
});

for (const t of casos) console.log(`${t.pass ? '✔' : '✘'} ${t.name}`);
const ok = casos.every((t) => t.pass);
console.log(`${casos.filter((t) => t.pass).length}/${casos.length} casos pasan`);
if (ok) console.log('OK titular');
process.exit(ok ? 0 : 1);
