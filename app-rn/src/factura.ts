// Factura SIMULADA (como un CFDI 4.0, pero sin timbrar): sirve para mostrar el flujo. NO es válida ante el SAT.
// Los datos fiscales del cliente solo viven en la pantalla mientras se arma; no se guardan ni van a la bitácora. Puro (tsx).
import type { PaymentMethod, SaleItem } from './types';

export type RegimenFiscal = '601' | '605' | '612' | '616' | '626';
export type UsoCFDI = 'G01' | 'G03' | 'S01';
type Persona = 'fisica' | 'moral';
export const REGIMENES: { v: RegimenFiscal; label: string; nombre: string; persona: Persona | 'ambas' }[] = [
  { v: '626', label: '626 RESICO', nombre: 'Régimen Simplificado de Confianza', persona: 'ambas' },
  { v: '612', label: '612 Actividad empresarial', nombre: 'Personas Físicas con Actividades Empresariales y Profesionales', persona: 'fisica' },
  { v: '605', label: '605 Sueldos', nombre: 'Sueldos y Salarios e Ingresos Asimilados a Salarios', persona: 'fisica' },
  { v: '601', label: '601 Empresa', nombre: 'General de Ley Personas Morales', persona: 'moral' },
  { v: '616', label: '616 Sin obligaciones', nombre: 'Sin obligaciones fiscales', persona: 'fisica' },
];
export const USOS: { v: UsoCFDI; label: string; nombre: string }[] = [
  { v: 'G03', label: 'G03 Gastos en general', nombre: 'Gastos en general' },
  { v: 'G01', label: 'G01 Mercancías', nombre: 'Adquisición de mercancías' },
  { v: 'S01', label: 'S01 Sin efectos fiscales', nombre: 'Sin efectos fiscales' },
];
export type Receptor = { rfc: string; nombre: string; cp: string; regimen: RegimenFiscal; uso: UsoCFDI };
export const RFC_PUBLICO = 'XAXX010101000';
export const PUBLICO_GENERAL: Omit<Receptor, 'cp'> = { rfc: RFC_PUBLICO, nombre: 'PÚBLICO EN GENERAL', regimen: '616', uso: 'S01' };

const centavos = (n: number) => Math.round(n * 100) / 100;
export const normalizarRFC = (s: string) => String(s ?? '').toUpperCase().replace(/[\s.-]/g, '');
// 3 letras (empresa) o 4 (persona) · fecha AAMMDD · homoclave de 2 · dígito verificador (número o A).
const RFC_RE = /^([A-ZÑ&]{3,4})(\d{2})(\d{2})(\d{2})[A-Z\d]{2}[A\d]$/;
const diasDelMes = (anio: number, mes: number) => new Date(anio, mes, 0).getDate();

/** null si el RFC tiene forma válida; si no, el mensaje para el dueño. */
export function validarRFC(s: string): string | null {
  const r = normalizarRFC(s);
  if (!r) return 'Escribe el RFC de tu cliente.';
  if (r.length !== 12 && r.length !== 13) return 'El RFC tiene 12 caracteres (empresa) o 13 (persona).';
  const m = RFC_RE.exec(r);
  if (!m) return 'Revisa el RFC: letras, fecha (AAMMDD) y homoclave.';
  const aa = +m[2], mm = +m[3], dd = +m[4];
  if (mm < 1 || mm > 12 || dd < 1 || dd > Math.max(diasDelMes(1900 + aa, mm), diasDelMes(2000 + aa, mm))) return 'La fecha dentro del RFC (AAMMDD) no existe.';
  return null;
}
export const tipoPersona = (rfc: string): Persona => (normalizarRFC(rfc).length === 12 ? 'moral' : 'fisica');

export function validarReceptor(r: Receptor): Partial<Record<keyof Receptor, string>> {
  const e: Partial<Record<keyof Receptor, string>> = {};
  const errRFC = validarRFC(r.rfc);
  if (errRFC) e.rfc = errRFC;
  if (String(r.nombre ?? '').trim().length < 3) e.nombre = 'Escribe el nombre o razón social como aparece en su constancia fiscal.';
  const cp = String(r.cp ?? '').trim();
  if (!/^\d{5}$/.test(cp) || cp === '00000') e.cp = 'El código postal tiene 5 dígitos.';
  const reg = REGIMENES.find((x) => x.v === r.regimen);
  if (!reg) e.regimen = 'Elige el régimen fiscal de tu cliente.';
  else if (!errRFC) {
    const p = tipoPersona(r.rfc);
    if (normalizarRFC(r.rfc) === RFC_PUBLICO && r.regimen !== '616') e.regimen = 'Público en general va con régimen 616.';
    else if (reg.persona !== 'ambas' && reg.persona !== p) e.regimen = p === 'moral' ? 'Ese régimen es de persona física y el RFC es de empresa.' : 'Ese régimen es de empresa y el RFC es de persona física.';
  }
  if (!USOS.some((x) => x.v === r.uso)) e.uso = 'Elige el uso del CFDI.';
  else if (r.regimen === '616' && r.uso !== 'S01') e.uso = 'Con régimen 616 el uso es S01 (sin efectos fiscales).';
  return e;
}

/** Art. 113-J LISR: una empresa que le paga a una persona física del RESICO le retiene 1.25 % del pago sin IVA. */
export function avisoRetencion(rfc: string, regimenEmisor: string | null): string | null {
  if (regimenEmisor !== '626' || validarRFC(rfc) || tipoPersona(rfc) !== 'moral') return null;
  return 'Tu cliente es empresa (persona moral): en la vida real te retiene 1.25 % de ISR sobre el pago sin IVA (art. 113-J LISR). Esta simulación no lo descuenta.';
}

export function formaPago(m: PaymentMethod): string {
  if (m === 'efectivo' || m === 'efectivo_contingencia') return '01 Efectivo';
  if (m === 'tarjeta') return '04 Tarjeta de crédito';
  return '03 Transferencia electrónica de fondos'; // transferencia y CoDi (SPEI)
}

export type ConceptoFactura = { cantidad: number; descripcion: string; valorUnitario: number; importe: number };
export type Factura = {
  folio: string; fecha: string; emisor: { nombre: string; regimen: string | null };
  receptor: Receptor & { regimenNombre: string; usoNombre: string };
  conceptos: ConceptoFactura[]; subtotal: number; tasaIVA: number; iva: number; total: number; formaPago: string; metodoPago: 'PUE'; nota?: string;
};

/** Precios con IVA incluido: valor unitario sin IVA (6 decimales), importe a centavos, IVA = total − subtotal, total = lo cobrado. */
export function armarFactura(a: { negocio: string; folio: string; fecha: string; receptor: Receptor; renglones: SaleItem[]; total: number; metodo: PaymentMethod;
  tasaIVA: number; regimenEmisor: string | null; nota?: string }): Factura {
  const t = a.tasaIVA;
  const conceptos = a.renglones.map((r) => {
    const vu = Math.round((r.price / (1 + t)) * 1e6) / 1e6;
    return { cantidad: r.qty, descripcion: r.name, valorUnitario: vu, importe: centavos(r.qty * vu) };
  });
  const subtotal = centavos(conceptos.reduce((s, c) => s + c.importe, 0));
  const total = centavos(a.total);
  const reg = REGIMENES.find((x) => x.v === a.receptor.regimen), uso = USOS.find((x) => x.v === a.receptor.uso);
  return {
    folio: a.folio, fecha: a.fecha,
    emisor: { nombre: a.negocio, regimen: a.regimenEmisor === '626' ? '626 Régimen Simplificado de Confianza' : a.regimenEmisor },
    receptor: { rfc: normalizarRFC(a.receptor.rfc), nombre: a.receptor.nombre.trim().toUpperCase(), cp: a.receptor.cp.trim(), regimen: a.receptor.regimen, uso: a.receptor.uso,
      regimenNombre: reg ? `${reg.v} ${reg.nombre}` : a.receptor.regimen, usoNombre: uso ? `${uso.v} ${uso.nombre}` : a.receptor.uso },
    conceptos, subtotal, tasaIVA: t, iva: centavos(total - subtotal), total, formaPago: formaPago(a.metodo), metodoPago: 'PUE', ...(a.nota ? { nota: a.nota } : {}),
  };
}

export const folioFactura = (ahora: Date) => `SIM-${String(ahora.getTime()).slice(-6)}`;
