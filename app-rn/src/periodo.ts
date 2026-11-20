// Resumen del periodo de la meta (semana desde el lunes o mes calendario, hora local): ventas pagadas, compras y saldo.
export type Periodicidad = 'semanal' | 'mensual';

export function resumenPeriodo(
  ventas: { date: string; amount: number; status: string }[],
  compras: { date: string; total: number }[],
  periodicidad: Periodicidad,
  ahora: Date,
): { desde: Date; etiqueta: 'Esta semana' | 'Este mes'; ventas: number; compras: number; saldo: number } {
  const mensual = periodicidad === 'mensual';
  const desde = mensual
    ? new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    : new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - ((ahora.getDay() + 6) % 7));
  const enPeriodo = (iso: string) => new Date(iso) >= desde;
  const v = ventas.filter((x) => x.status === 'pagada' && enPeriodo(x.date)).reduce((a, x) => a + x.amount, 0);
  const c = compras.filter((x) => enPeriodo(x.date)).reduce((a, x) => a + x.total, 0);
  return { desde, etiqueta: mensual ? 'Este mes' : 'Esta semana', ventas: v, compras: c, saldo: v - c };
}
