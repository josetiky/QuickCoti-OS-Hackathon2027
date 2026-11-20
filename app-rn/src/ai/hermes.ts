// Hermes: entrevista, estructura de notas y asistente. Corre con QVAC en el iPhone; si QVAC no está, usa reglas (MOCK) y lo dice.
import { chat, loadLLM, qvacState } from './qvac';
import { INTERVIEW_SYSTEM, INTERVIEW_SYSTEM_V2, STRUCTURE_SYSTEM, ASSISTANT_SYSTEM } from './prompts';
import KB from './knowledge_base_ley.json';
import { limpiarSalidaIA } from './limpiar';
import { defaultProfile, uid, type BusinessProfile, type ChatTurn, type ReceiptItem, type Structured } from '../types';

export let forceMock = false;
export const setForceMock = (v: boolean) => { forceMock = v; };
const label = () => (forceMock || qvacState.error ? 'MOCK (reglas, sin IA)' : qvacState.llmLabel);

export function extractJSON(t: string): any {
  t = t.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(json)?/g, '');
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('El modelo no devolvió JSON.');
  return JSON.parse(t.slice(s, e + 1));
}

async function chatJSON(system: string, history: { role: string; content: string }[]) {
  const out = await chat(system, history);
  try { return extractJSON(out); } catch {
    return extractJSON(await chat(system, [...history, { role: 'assistant', content: out }, { role: 'user', content: 'Responde SOLO el JSON válido.' }]));
  }
}

async function withFallback<T>(real: () => Promise<T>, mock: () => T): Promise<{ v: T; model: string; usedMock: boolean }> {
  if (forceMock) return { v: mock(), model: label(), usedMock: true };
  try { const v = await real(); return { v, model: label(), usedMock: false }; }
  catch (e) { console.warn('QVAC falló, usando respaldo', e); return { v: mock(), model: 'MOCK (respaldo por error de IA)', usedMock: true }; }
}

// ─────────── Entrevista ───────────
const MOCK_Q = ['¡Hola! Soy Hermes. ¿Cómo se llama tu negocio y a qué se dedica?',
  '¿Compras mercancía a proveedores para revenderla? (por ejemplo Bimbo, Coca-Cola)',
  '¿Haces trabajos a la medida o das cotizaciones antes de cobrar?',
  '¿Cómo te pagan tus clientes? (efectivo, tarjeta, transferencia, CoDi)'];

function mockProfile(h: ChatTurn[]): BusinessProfile {
  const t = h.filter((x) => x.role === 'user').map((x) => x.content.toLowerCase()).join(' ');
  const has = (ws: string[]) => ws.some((w) => t.includes(w));
  const medida = has(['herrer', 'soldad', 'taller', 'carpinter', 'medida', 'costur']);
  const revende = has(['tienda', 'abarrote', 'bimbo', 'coca', 'sabritas', 'revend', 'miscel', 'surte']);
  const pays = Object.entries({ efectivo: ['efectivo'], tarjeta: ['tarjeta'], codi: ['codi'], transferencia: ['transfer', 'spei'] })
    .filter(([, ks]) => has(ks)).map(([k]) => k);
  const first = h.find((x) => x.role === 'user')?.content ?? 'Mi negocio';
  const p = defaultProfile();
  p.business_name = first.split(',')[0].slice(0, 40);
  p.payment_methods = pays.length ? pays : ['efectivo'];
  if (medida && !revende) {
    p.giro = 'herreria'; p.modules = { sales: true, purchases: true, inventory: false, quotes: true, deposits: true };
    p.terminology = { item: 'Material', items: 'Materiales', stock: 'Material en taller', purchase: 'Compra de material', sale: 'Trabajo' };
    p.intake_modes = ['voice', 'handwritten_note_photo', 'manual'];
  } else {
    p.giro = revende ? 'tienda_abarrotes' : 'otro'; p.modules.inventory = revende;
    p.terminology = { item: 'Producto', items: 'Productos', stock: 'Existencias', purchase: 'Surtido', sale: 'Venta' };
    p.intake_modes = ['supplier_ticket_photo', 'handwritten_note_photo', 'manual'];
    p.suppliers = ['Bimbo', 'Coca-Cola', 'Sabritas', 'Lala'].filter((s) => t.includes(s.toLowerCase()));
  }
  return p;
}

export async function interview(history: ChatTurn[]) {
  const userTurns = history.filter((h) => h.role === 'user').length;
  const r = await withFallback<any>(async () => {
    const msgs = history.length ? [...history] : [{ role: 'user' as const, content: 'Hola, quiero configurar mi negocio.' }];
    await loadLLM(); // primero cargar: así sabemos si está el LoRA v1 o v2 antes de elegir prompt
    const v2 = qvacState.loraVersion === 2; // cada LoRA con el prompt exacto con el que se entrenó
    if (userTurns >= (v2 ? 7 : 6)) msgs.push({ role: 'user', content: 'Ya no hay más preguntas. Genera el perfil final ahora (done=true).' });
    return chatJSON(v2 ? INTERVIEW_SYSTEM_V2 : INTERVIEW_SYSTEM, msgs);
  }, () => (userTurns < MOCK_Q.length ? { done: false, next_question: MOCK_Q[userTurns] } : { done: true, profile: mockProfile(history) }));
  const v = r.v || {};
  if (v.done && v.profile) {
    const p: BusinessProfile = { ...defaultProfile(), ...v.profile, modules: { ...defaultProfile().modules, ...(v.profile.modules || {}), sales: true, purchases: true },
      terminology: { ...defaultProfile().terminology, ...(v.profile.terminology || {}) } };
    return { done: true, profile: p, model: r.model };
  }
  return { done: false, next_question: v.next_question || '¿Me cuentas un poco más de tu negocio?', model: r.model };
}

// ─────────── Estructurar texto OCR ───────────
const LINE = /^\s*(\d+(?:[.,]\d+)?)\s*(?:x|pz|pzs|pza|cj|caja|cajas|paq)?\.?\s+(.+?)\s+\$?\s*(\d+(?:[.,]\d{1,2})?)\s*$/i;
const num = (s: string) => parseFloat(s.replace(',', '.').replace(/[oO]/g, '0'));

function mockStructure(z: Record<string, string[]>) {
  const items: any[] = [], missing: string[] = [];
  for (const line of z.renglon ?? []) {
    const m = line.replace('$', ' $').trim().match(LINE);
    if (m) { const q = num(m[1]), a = num(m[3]); items.push({ name: m[2], qty: q, unit_cost: q ? Math.round((a / q) * 100) / 100 : a, confidence: 0.55 }); }
    else missing.push(`renglón ilegible: «${line}»`);
  }
  let total: number | null = null;
  for (const t of z.total ?? []) { const ns = t.match(/\d+(?:[.,]\d{1,2})?/g); if (ns) total = num(ns[ns.length - 1]); }
  if (total == null) missing.push('total');
  const sup = z.proveedor?.[0] ?? null;
  if (!sup) missing.push('proveedor');
  return { supplier: { value: sup, confidence: sup ? 0.6 : 0 }, date: { value: z.fecha?.[0] ?? null, confidence: z.fecha?.[0] ? 0.5 : 0 }, items, total, missing };
}

export async function structure(zones: Record<string, string[]>, docType: string, known: string[]): Promise<Structured> {
  const r = await withFallback<any>(
    () => chatJSON(STRUCTURE_SYSTEM, [{ role: 'user', content: JSON.stringify({ tipo_documento: docType, zonas_ocr: zones, productos_conocidos: known.slice(0, 60) }) }]),
    () => mockStructure(zones));
  const o = r.v && typeof r.v === 'object' ? r.v : {};
  const limpio = limpiarSalidaIA(o); // proveedor, fecha y faltantes siempre como textos (si no, la pantalla de revisión truena)
  let items: ReceiptItem[] = (Array.isArray(o.items) ? o.items : []).filter((i: any) => i && i.name).map((i: any) => ({
    id: uid(), name: String(i.name).trim(), qty: Number(i.qty) || 0, unit_cost: Number(i.unit_cost) || 0, confidence: Number(i.confidence ?? 0.5) }));
  let total: number | null = typeof o.total === 'number' ? o.total : null;
  let model = r.model;
  // ── Validación cruzada IA ⇄ reglas (la IA no puede inventar números que no están en la foto) ──
  const rx = mockStructure(zones);
  const texto = Object.values(zones).flat().join(' ').replace(/,(?=\d{3})/g, '');
  const aparece = (n: number) => [n.toFixed(2), n.toFixed(0), n.toFixed(1)].some((x) => texto.includes(x));
  if (total != null && !aparece(total) && rx.total != null) total = rx.total;        // total inventado → el que sí se leyó
  if (total == null && rx.total != null) total = rx.total;
  // quitar duplicados y prefijos basura que el modelo pega a todos los renglones
  const vistos = new Set<string>();
  items = items.filter((i) => { const k = `${i.name.toLowerCase()}|${i.qty}|${i.unit_cost}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
  if (items.length > 1) {
    let pre = items[0].name; for (const i of items) while (pre && !i.name.startsWith(pre)) pre = pre.slice(0, -1);
    if (pre.trim().length >= 5) items = items.map((i) => ({ ...i, name: i.name.slice(pre.length).trim() || i.name }));
    items = items.filter((i, k) => !items.some((j, m) => m !== k && j.name.length > i.name.length + 3 && j.name.startsWith(i.name) && Math.abs(j.qty * j.unit_cost - i.qty * i.unit_cost) < 0.01));
  }
  const suma = (xs: { qty: number; unit_cost: number }[]) => Math.round(xs.reduce((a, i) => a + i.qty * i.unit_cost, 0) * 100) / 100;
  const cuadra = (xs: { qty: number; unit_cost: number }[]) => total != null && xs.length > 0 && Math.abs(suma(xs) - total) <= Math.max(1, 0.02 * total);
  if (!cuadra(items) && cuadra(rx.items)) { // las reglas sí cuadran con el total de la foto → se usan (y se dice)
    items = rx.items.map((i: any) => ({ id: uid(), ...i, confidence: 0.7 }));
    model += ' + validación por reglas (la suma de la IA no cuadraba)';
  }
  const sum = Math.round(items.reduce((a, i) => a + i.qty * i.unit_cost, 0) * 100) / 100;
  const matches = total != null && Math.abs(sum - total) <= Math.max(1, 0.02 * total);
  const missing: string[] = limpio.missing;
  const low = items.some((i) => i.confidence < 0.6);
  const status = !items.length && total == null ? 'unreadable' : matches && !missing.length && !low ? 'ok' : 'needs_review';
  return { status, supplier: limpio.supplier, date: limpio.date, items, total,
    sum_items_matches_total: matches, missing, model };
}

// ─────────── Asistente + RAG ───────────
const STOP = new Set('de la el en y a que los las un una por para con del se es mi me lo al si no como'.split(' '));
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)) ?? [];
export function retrieve(q: string, k = 2) {
  const qs = norm(q);
  return (KB as any[]).map((d) => {
    const ws = norm(d.topic + ' ' + d.content);
    return { d, s: qs.filter((w) => ws.some((x) => x.startsWith(w.slice(0, 5)))).length };
  }).sort((a, b) => b.s - a.s).filter((x) => x.s > 0).slice(0, k).map((x) => x.d as { source: string; content: string; topic: string });
}

export async function assistant(query: string, profile: BusinessProfile | null, snapshot: Record<string, number>) {
  const ctx = retrieve(query);
  const r = await withFallback<string>(async () => {
    const c = ctx.map((d) => `- [${d.source}] ${d.content}`).join('\n') || '(sin contexto legal relevante)';
    const user = `CONTEXTO LEGAL:\n${c}\n\nPERFIL DEL NEGOCIO: ${JSON.stringify(profile ?? {})}\nDATOS DEL NEGOCIO: ${JSON.stringify(snapshot)}\n\nPREGUNTA: ${query}`;
    return chat(ASSISTANT_SYSTEM, [{ role: 'user', content: user }], 400);
  }, () => {
    const q = query.toLowerCase();
    if (/registra|borra|agrega|mete|cambia/.test(q)) return 'CONFIRMAR: Voy a hacer ese cambio en tus registros. ¿Lo confirmas?';
    if (/gan|vend|saqu/.test(q)) return `Hoy vendiste $${snapshot.ventas_hoy ?? 0} y compraste $${snapshot.compras_hoy ?? 0}.`;
    if (ctx.length) return `${ctx[0].content} (Fuente: ${ctx[0].source})`;
    return 'FUERA_DE_ALCANCE: Solo puedo ayudarte con tu negocio y con la app.';
  });
  // Limpieza de salida: etiquetas de razonamiento sueltas y prefijos de control
  const t = (r.v || '').replace(/<\/?think>/g, '').trim();
  const confirm = t.startsWith('CONFIRMAR:');
  let oos = t.startsWith('FUERA_DE_ALCANCE:');
  let answer = confirm || oos ? t.split(':').slice(1).join(':').trim() : t;
  // Guardarraíl: si sí hubo contexto legal y la respuesta lo usa, no es "fuera de alcance" (el modelo a veces mezcla ambos)
  if (oos && ctx.length && answer.length > 120) {
    oos = false;
    answer = answer.replace(/^Eso no lo puedo resolver\.?\s*(Te ayudo con[^:]*:\s*)?/i, '').trim();
    answer = answer.charAt(0).toUpperCase() + answer.slice(1);
  }
  return { answer, needs_confirmation: confirm, out_of_scope: oos,
    sources: Array.from(new Set(ctx.map((d) => d.source))), model: r.model };
}
