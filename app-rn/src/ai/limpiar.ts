// Limpia lo que devuelve Hermes (LLM) al estructurar un ticket. Cuando la foto se lee mal, la respuesta puede venir con
// otra forma («missing» como texto, proveedor como número u objeto…) y la pantalla de revisión tronaba: en la compilación
// Release eso cierra la app. Aquí todo sale como textos y listas de textos. Puro (tsx).
export type CampoIA = { value: string | null; confidence: number };

const texto = (v: any): string | null => (typeof v === 'string' ? v.trim() || null : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);
const confianza = (v: any) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; };

function campo(v: any): CampoIA {
  if (v && typeof v === 'object' && !Array.isArray(v)) { const t = texto(v.value); return { value: t, confidence: t ? confianza(v.confidence) : 0 }; }
  const t = texto(v);
  return { value: t, confidence: t ? 0.5 : 0 };
}

const aTexto = (m: any): string =>
  typeof m === 'string' ? m.trim() : typeof m === 'number' && Number.isFinite(m) ? String(m)
    : m && typeof m === 'object' ? Object.values(m).filter((x) => typeof x === 'string').join(' ').trim() : '';

export function limpiarSalidaIA(o: any): { supplier: CampoIA; date: CampoIA; missing: string[] } {
  const x = o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  const crudo: any[] = Array.isArray(x.missing) ? x.missing : x.missing != null ? [x.missing] : [];
  const missing = [...new Set(crudo.map(aTexto).filter(Boolean))];
  return { supplier: campo(x.supplier), date: campo(x.date), missing };
}
