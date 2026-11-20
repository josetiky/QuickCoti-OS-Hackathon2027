// Agente 2 · Configurador (integrado del repo mipyme-multiagente).
// Hermes (Agente 1, LoRA entrenado en NVIDIA) entrevista y produce el PERFIL; este agente decide la PRESENTACIÓN:
// prediseño visual, meta de ingresos y orden de las tarjetas del Inicio. Es determinista (reglas auditables, sin IA),
// así nunca rompe el contrato del perfil y siempre funciona sin red. El usuario lo revisa y lo puede cambiar.
import type { BusinessProfile, ChatTurn, HomeCard, PredisenoId, UIConfig } from '../types';

const has = (t: string, ws: string[]) => ws.some((w) => t.includes(w));

/** Extrae un monto en pesos: "15 mil" → 15000, "$12,500" → 12500, "18k" → 18000. */
export function extraerMonto(texto: string): number | null {
  const t = texto.toLowerCase().replace(/\s+/g, ' ');
  const m = t.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(mil|k\b|mdp)?/g);
  if (!m) return null;
  let best: number | null = null;
  for (const raw of m) {
    const r = raw.match(/(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(mil|k\b)?/);
    if (!r) continue;
    let n = /\d[.,]\d{3}/.test(r[1]) ? Number(r[1].replace(/[.,]/g, '')) : Number(r[1].replace(',', '.'));
    if (r[2]) n *= 1000;
    if (n >= 500 && (best == null || n > best)) best = n; // ignora cantidades chicas (piezas, días)
  }
  return best;
}

export function periodicidad(texto: string): 'semanal' | 'mensual' {
  const t = texto.toLowerCase();
  return has(t, ['al mes', 'mensual', 'por mes', 'cada mes', 'mes']) && !has(t, ['semana']) ? 'mensual' : 'semanal';
}

// ─── Rentas y entregas a domicilio (el LoRA v1 no las pregunta: las detecta este agente y, si no salieron, pregunta) ───
const RENTA = ['rento', 'renta ', 'rentas', 'rentamos', 'rentar', 'alquil', 'inflable', 'brincolin', 'andamio', 'carpa', 'cuartos', 'departamentos'];
const ENTREGA = ['domicilio', 'entregas', 'entrego', 'entregamos', 'reparto', 'reparti', 'envios', 'envío', 'envio', 'a su casa', 'pedidos por whats', 'motito', 'delivery', 'didi', 'rappi', 'uber eats'];
const NEG = /\b(no|nada|ninguna?|tampoco|nel)\b/;

export type Extras = { rentals: boolean | null; delivery: boolean | null }; // null = no se mencionó
export function detectarExtras(texto: string): Extras {
  const t = ' ' + texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ';
  const sinAcento = (ws: string[]) => ws.map((w) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const r = has(t, sinAcento(RENTA)), d = has(t, sinAcento(ENTREGA));
  return { rentals: r ? true : null, delivery: d ? true : null };
}
/** Interpreta la respuesta a PREGUNTA_EXTRAS ("las dos", "solo entregas", "no"). */
export function leerRespuestaExtras(texto: string): { rentals: boolean; delivery: boolean } {
  const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (has(t, ['las dos', 'ambas', 'ambos', 'las 2', 'los dos', 'de todo'])) return { rentals: true, delivery: true };
  const e = detectarExtras(t);
  if (e.rentals || e.delivery) return { rentals: !!e.rentals, delivery: !!e.delivery };
  if (/^\s*(si|sip|claro|simon)\b/.test(t) && !NEG.test(t)) return { rentals: false, delivery: false }; // "sí" ambiguo: el usuario lo ajusta en la revisión
  return { rentals: false, delivery: false };
}
export const PREGUNTA_EXTRAS = '¿También rentas cosas (sillas, equipo, ropa, cuartos…) o haces entregas a domicilio? Puedes decirme "rentas", "entregas", "las dos" o "no".';

/** Aplica rentas/entregas detectadas al perfil (sin pisar lo que ya venga del LoRA o del usuario). */
export function conExtras(p: BusinessProfile, e: { rentals?: boolean | null; delivery?: boolean | null }): BusinessProfile {
  return { ...p, modules: { ...p.modules, rentals: e.rentals ?? p.modules.rentals ?? false, delivery: e.delivery ?? p.modules.delivery ?? false } };
}

export function configurar(p: BusinessProfile, hist: ChatTurn[] = []): UIConfig {
  const t = (hist.filter((h) => h.role === 'user').map((h) => h.content).join(' ') + ' ' + p.giro + ' ' + p.business_name).toLowerCase();
  const comida = has(t, ['comida', 'taco', 'café', 'cafe', 'fonda', 'restaurante', 'torta', 'antojito', 'cocina', 'panader', 'jugo', 'tamal']);
  const servicios = !p.modules.inventory && (p.modules.quotes || has(t, ['servicio', 'estética', 'estetica', 'taller', 'consultorio', 'herrer', 'reparac', 'carpinter']));
  const rentas = !!p.modules.rentals, entregas = !!p.modules.delivery;
  const predisenoId: PredisenoId = comida ? 'alimentos_mostrador' : rentas && !p.modules.inventory ? 'rentas_eventos'
    : servicios ? 'servicios_rapidos' : 'comercio_inventario';

  const monto = extraerMonto(t);
  const per = periodicidad(t);

  const orden: HomeCard[] = ['meta_ingresos'];
  if (predisenoId === 'alimentos_mostrador') orden.push('cobro', 'escaner_recibos');
  else if (p.modules.inventory) orden.push('escaner_recibos', 'inventario', 'cobro');
  else orden.push('cobro', 'escaner_recibos');
  if (p.modules.quotes || rentas) orden.splice(1, 0, 'cotizar');
  if (p.modules.inventory && !orden.includes('inventario')) orden.push('inventario');
  if (rentas) orden.splice(predisenoId === 'rentas_eventos' ? 1 : orden.length, 0, 'rentas');
  if (entregas) orden.splice(predisenoId === 'alimentos_mostrador' ? 2 : orden.length, 0, 'entregas');
  orden.push('asistente');

  const activos = [p.modules.inventory && 'inventario con foto de tickets', p.modules.quotes && 'cotizaciones', rentas && 'rentas con depósito y devolución',
    entregas && 'entregas a domicilio', 'cobros', 'meta de ingresos'].filter(Boolean);
  const ocultos = [!p.modules.inventory && 'inventario', !p.modules.quotes && 'cotizaciones', !rentas && 'rentas', !entregas && 'entregas'].filter(Boolean);
  const y = (xs: any[]) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1] : xs.join(''));
  const mensajeBienvenida = `Activé ${y(activos)}.` + (ocultos.length ? ` Oculté ${y(ocultos)} para que tu pantalla quede limpia (los puedes prender en Ajustes).` : '');

  return { predisenoId, ingresoMetaMXN: monto ?? 15000, periodicidadMeta: per, ordenTarjetasHome: orden, mensajeBienvenida, metaDeclarada: monto != null };
}

export const PREGUNTA_META = '¿Cuánto te gustaría vender a la semana o al mes? Con eso te pongo una meta en tu pantalla de inicio.';
