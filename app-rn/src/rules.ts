// "Contrato inteligente" local — motor de reglas determinista. Puro TS (sin dependencias) para poder probarlo con `npm run test:rules`.
import type { PaymentMethod } from './types';

const LEY = 'Ley de Economía Digital para Pagos Digitales y Electrónicos (DOF 04/11/2026)';
export type Operation = { kind: 'venta' | 'compra'; amount: number; concept: string; method: PaymentMethod | null; aiExtracted: boolean; userConfirmed: boolean };
export type Context = { digitalOnlySector: boolean; contingencyActive: boolean };
export type RuleResult = { kind: 'allow' } | { kind: 'warn'; msg: string } | { kind: 'block'; msg: string };
export type Rule = { id: string; title: string; source: string; evaluate: (op: Operation, ctx: Context) => RuleResult };

const allow: RuleResult = { kind: 'allow' };
export const RULES: Rule[] = [
  { id: 'R1', title: 'Efectivo por contingencia',
    source: `${LEY}: si una contingencia impide recibir pagos digitales se permite efectivo o cheque. Artículo: VERIFICAR`,
    evaluate: (op, ctx) => {
      if (op.kind !== 'venta' || op.method !== 'efectivo_contingencia') return allow;
      return ctx.contingencyActive ? { kind: 'warn', msg: 'Cobro en efectivo registrado como contingencia (para conciliar después).' }
        : { kind: 'block', msg: 'No hay una contingencia abierta. Registra primero la falla del pago digital.' };
    } },
  { id: 'R2', title: 'Sector solo digital',
    source: `${LEY}: la SHCP determina sectores donde el pago digital puede ser la única forma de pago. Ajuste configurable. Artículo: VERIFICAR`,
    evaluate: (op, ctx) => (op.kind === 'venta' && ctx.digitalOnlySector && op.method === 'efectivo')
      ? { kind: 'block', msg: "Tu giro está marcado como 'solo pagos digitales'. Usa tarjeta, transferencia o CoDi (o abre una contingencia si fallan)." } : allow },
  { id: 'R3', title: 'Trazabilidad mínima',
    source: 'Bases del hackathon §11 (reglas verificables): monto, concepto, fecha y medio de pago.',
    evaluate: (op) => {
      const f: string[] = [];
      if (!(op.amount > 0)) f.push('monto mayor a 0');
      if (!op.concept?.trim()) f.push('concepto');
      if (op.kind === 'venta' && !op.method) f.push('medio de pago');
      return f.length ? { kind: 'block', msg: 'Falta: ' + f.join(', ') + '.' } : allow;
    } },
  { id: 'R4', title: 'Revisión humana de datos leídos por IA',
    source: 'Bases del hackathon §6-d: el usuario revisa y corrige lo que la IA interpreta antes de confirmar.',
    evaluate: (op) => (op.aiExtracted && !op.userConfirmed) ? { kind: 'block', msg: 'Revisa y confirma los datos leídos de la foto.' } : allow },
];

export function evaluate(op: Operation, ctx: Context) {
  const results = RULES.map((r) => ({ rule: r, result: r.evaluate(op, ctx) }));
  const allowed = !results.some((x) => x.result.kind === 'block');
  const messages = results.filter((x) => x.result.kind !== 'allow').map((x) => `${x.rule.id} · ${(x.result as any).msg}`);
  return { allowed, messages, ruleIds: results.filter((x) => x.result.kind !== 'allow').map((x) => x.rule.id) };
}

export function selfTest() {
  const no: Context = { digitalOnlySector: false, contingencyActive: false };
  const si: Context = { digitalOnlySector: false, contingencyActive: true };
  const dig: Context = { digitalOnlySector: true, contingencyActive: false };
  const ok = (kind: 'venta' | 'compra', amount: number, method: PaymentMethod | null, ctx: Context, ai = false, conf = true) =>
    evaluate({ kind, amount, concept: 'Pan', method, aiExtracted: ai, userConfirmed: conf }, ctx).allowed;
  return [
    ['Venta en efectivo normal → permitida', true, ok('venta', 50, 'efectivo', no)],
    ['Efectivo por contingencia SIN contingencia → bloqueada (R1)', false, ok('venta', 50, 'efectivo_contingencia', no)],
    ['Efectivo por contingencia CON contingencia → permitida (R1)', true, ok('venta', 50, 'efectivo_contingencia', si)],
    ['Sector solo digital + efectivo → bloqueada (R2)', false, ok('venta', 50, 'efectivo', dig)],
    ['Sector solo digital + tarjeta → permitida (R2)', true, ok('venta', 50, 'tarjeta', dig)],
    ['Venta con monto 0 → bloqueada (R3)', false, ok('venta', 0, 'efectivo', no)],
    ['Venta sin medio de pago → bloqueada (R3)', false, ok('venta', 10, null, no)],
    ['Compra leída por IA sin confirmar → bloqueada (R4)', false, ok('compra', 252, null, no, true, false)],
    ['Compra leída por IA confirmada → permitida (R4)', true, ok('compra', 252, null, no, true, true)],
  ].map(([name, expected, got]) => ({ name: name as string, expected: expected as boolean, got: got as boolean, pass: expected === got }));
}
