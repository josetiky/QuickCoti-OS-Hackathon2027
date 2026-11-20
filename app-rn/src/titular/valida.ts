// Datos del titular (dueño del negocio): validación y máscaras, 100% local y sin dependencias.
// Estos datos NUNCA pasan por Hermes/LLM, el registro SHA-256, AsyncStorage ni logs.

export type Titular = {
  nombre: string;
  curp: string;
  clabe: string;
  telefono?: string;
  demo?: boolean; // datos ficticios de demostración
  aceptoAviso: string; // fecha ISO en que aceptó el aviso de privacidad
  avisoVersion?: string; // versión del aviso aceptado
};
export type DatosTitular = Omit<Titular, 'aceptoAviso' | 'avisoVersion'>;
export type ErroresTitular = { nombre?: string; curp?: string; clabe?: string; telefono?: string };

export const soloDigitos = (s: string) => (s ?? '').replace(/\D/g, '');
export const normCURP = (s: string) => (s ?? '').replace(/\s+/g, '').toUpperCase();
export const limpiarNombre = (s: string) => (s ?? '').trim().replace(/\s+/g, ' ');

const CURP_RE = /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
const DICC = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

function digitoCURP(c17: string): number {
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += DICC.indexOf(c17[i]) * (18 - i);
  return (10 - (suma % 10)) % 10;
}

export function validarCURP(s: string): string | null {
  const c = normCURP(s);
  if (!c) return 'Escribe tu CURP.';
  if (c.length !== 18) return `La CURP tiene 18 caracteres (llevas ${c.length}).`;
  if (!CURP_RE.test(c)) return 'Esto no parece una CURP. Revisa letras, fecha de nacimiento y estado.';
  if (digitoCURP(c.slice(0, 17)) !== Number(c[17])) return 'El último dígito (verificador) no coincide. Revisa que esté bien escrita.';
  return null;
}

const PESOS_CLABE = [3, 7, 1];
export function validarCLABE(s: string): string | null {
  const d = soloDigitos(s);
  if (!d) return 'Escribe tu CLABE.';
  if (d.length !== 18) return `La CLABE tiene 18 dígitos (llevas ${d.length}).`;
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += (Number(d[i]) * PESOS_CLABE[i % 3]) % 10;
  if ((10 - (suma % 10)) % 10 !== Number(d[17])) return 'El dígito de control no coincide. Revisa la CLABE.';
  return null;
}

export function validarTel(s: string): string | null {
  const d = soloDigitos(s);
  if (!d) return null; // opcional
  return d.length === 10 ? null : 'El teléfono lleva 10 dígitos.';
}

const SIMBOLOS = /[0-9_@#$%&*+=<>?\/\\|{}[\]~"`;:!¡¿,()]/;
export function validarNombre(s: string): string | null {
  const n = limpiarNombre(s);
  if (!n) return 'Escribe tu nombre completo.';
  if (n.length > 100) return 'El nombre es demasiado largo.';
  if (SIMBOLOS.test(n)) return 'Usa solo letras en tu nombre.';
  if (n.split(' ').length < 2) return 'Escribe tu nombre y al menos un apellido.';
  return null;
}

export function validarTitular(t: DatosTitular): ErroresTitular {
  const e: ErroresTitular = {};
  const n = validarNombre(t.nombre); if (n) e.nombre = n;
  const c = validarCURP(t.curp); if (c) e.curp = c;
  const b = validarCLABE(t.clabe); if (b) e.clabe = b;
  const f = validarTel(t.telefono ?? ''); if (f) e.telefono = f;
  return e;
}

export function esTitular(x: unknown): x is Titular {
  if (!x || typeof x !== 'object') return false;
  const t = x as Record<string, unknown>;
  return ['nombre', 'curp', 'clabe', 'aceptoAviso'].every((k) => typeof t[k] === 'string')
    && (t.telefono === undefined || typeof t.telefono === 'string')
    && (t.demo === undefined || typeof t.demo === 'boolean');
}

export function mascaraCLABE(s: string): string {
  const d = soloDigitos(s);
  return d.length < 4 ? '••••' : `•••• ${d.slice(-4)}`;
}
export function mascaraCURP(s: string): string {
  const c = normCURP(s);
  return c.length < 6 ? '••••' : `${c.slice(0, 4)}••••••••••${c.slice(-2)}`;
}
export function mascaraTel(s: string): string {
  const d = soloDigitos(s);
  return d ? `•••••• ${d.slice(-4)}` : '';
}

// Datos 100% ficticios para demostraciones (pasan la validación; no pertenecen a nadie).
export const DEMO_TITULAR: DatosTitular = {
  nombre: 'Usuario Demo QuickCoti',
  curp: 'XEXX010101HOCXXX02',
  clabe: '002180000000000009',
  demo: true,
};

// Arma el titular a partir de lo tecleado en el formulario. Al editar conserva la fecha y versión del aviso aceptado.
export type EntradaTitular = { nombre: string; curp: string; clabe: string; telefono: string };
export function armarTitular(e: EntradaTitular, previo: Titular | null, ahoraISO: string, avisoVersion: string): Titular {
  const curp = normCURP(e.curp);
  const clabe = soloDigitos(e.clabe);
  const t: Titular = {
    nombre: limpiarNombre(e.nombre), curp, clabe,
    aceptoAviso: previo?.aceptoAviso ?? ahoraISO,
    avisoVersion: previo ? previo.avisoVersion : avisoVersion,
  };
  const tel = soloDigitos(e.telefono);
  if (tel) t.telefono = tel;
  if (curp === DEMO_TITULAR.curp && clabe === DEMO_TITULAR.clabe) t.demo = true;
  return t;
}
