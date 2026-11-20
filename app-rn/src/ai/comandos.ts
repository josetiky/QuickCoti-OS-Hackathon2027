// Órdenes por voz o texto para Hermes: SOLO navegan y preparan borradores (nunca cobran ni guardan solas).
// Lo que no es una orden se lo pregunta a Hermes (LoRA). Igual que el intérprete del diseño SwiftUI de referencia.
import type { BusinessProfile, Product } from '../types';

export type Cmd = { reply: string; go: (nav: any) => void };
const N = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim();
const NUM: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cien: 100 };
const fmt = (n: number) => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function cantidad(antes: string): number {
  const w = antes.trim().split(' ').pop() ?? '';
  if (/^\d+$/.test(w)) return parseInt(w, 10);
  return NUM[w] ?? 1;
}

export function comando(texto: string, ctx: { profile: BusinessProfile | null; products: Product[] }): Cmd | null {
  const t = N(texto);
  if (!t) return null;
  const m = ctx.profile?.modules;

  // 1) Cobrar / vender → abre Cobrar con borrador (el usuario elige cómo le pagan y confirma)
  if (/^(cobra|cobrar|cobrale|cobrame|vende|vender|nueva venta|registra (una )?venta|haz (un|el) cobro|quiero cobrar)\b/.test(t)) {
    let amount: number | undefined, concept = '';
    const mm = t.match(/(\d+(?:[.,]\d{1,2})?)\s*(pesos|peso|varos|mxn)\b/) || t.match(/\$\s*(\d+(?:[.,]\d{1,2})?)/);
    if (mm) amount = parseFloat(mm[1].replace(',', '.'));
    const de = t.match(/\bde (.+)$/);
    for (const p of ctx.products) {
      const n = N(p.name).split(' ')[0];
      if (n.length >= 3) { const i = t.indexOf(n); if (i > 0) { const q = cantidad(t.slice(0, i)); concept = `${q} × ${p.name}`; if (amount == null && p.price) amount = Math.round(q * p.price * 100) / 100; break; } }
    }
    if (!concept && de) concept = de[1].replace(/\d+(?:[.,]\d+)?\s*(pesos|peso|varos|mxn)\b/, '').trim();
    const reply = `Preparé el cobro${concept ? ` de ${concept}` : ''}${amount ? ` por ${fmt(amount)}` : ''}. Revisa y elige cómo te pagan; no se cobra nada hasta que confirmes.`;
    return { reply, go: (nav) => nav.navigate('Sale', { concept: concept || undefined, amount }) };
  }

  // 2) Foto a nota / registrar compra
  if (/\b(foto|escanea|escanear|ticket|nota (del|de) proveedor|surtido|registra (una )?compra|tomar foto)\b/.test(t))
    return { reply: 'Abrí la cámara para leer la nota de tu proveedor. Después revisas los datos antes de guardar.', go: (nav) => nav.navigate('Receipt') };

  // 3) Cotizar (si trae números, es una cuenta: la hace Hermes)
  if (/^(cotiza|cotizar|nueva cotizacion|hacer (una )?cotizacion)\b/.test(t) && !/\d/.test(t) && (m?.quotes || m?.rentals))
    return { reply: 'Abrí Cotizar. Agrega un renglón por cada cosa.', go: (nav) => nav.navigate('Cotizar') };

  // 4) Navegación: "abre / ver / muestra / ir a …"
  if (/^(abre|abrir|ver|muestra|muestrame|ir a|ve a|vamos a|llevame a|quiero ver)\b/.test(t)) {
    const dest: [RegExp, string, string, boolean?][] = [
      [/inventario|existencia|mercancia/, 'Inventario', 'Abrí tu inventario.', !!m?.inventory],
      [/renta/, 'Rentas', 'Abrí tus rentas.', !!m?.rentals],
      [/entrega|domicilio|pedido/, 'Entregas', 'Abrí tus entregas a domicilio.', !!m?.delivery],
      [/venta|cobro/, 'Ventas', 'Abrí tus ventas de hoy.', true],
      [/compra|proveedor/, 'Compras', 'Abrí tus compras.', true],
      [/accesib|letra|contraste/, 'A11y', 'Abrí los ajustes de accesibilidad.', true],
      [/ajuste|modelo|configura/, 'Settings', 'Abrí los ajustes.', true],
      [/bitacora|cumplimiento|auditor/, 'Audit', 'Abrí cumplimiento y bitácora.', true],
      [/inicio|principal/, 'Inicio', 'Volví al inicio.', true],
    ];
    for (const [re, screen, reply, on] of dest) if (re.test(t)) {
      if (!on) return { reply: 'Tu app no tiene ese módulo activado. Puedes activarlo volviendo a la entrevista con Hermes.', go: () => {} };
      return { reply, go: (nav) => nav.navigate(screen) };
    }
  }
  return null;
}
