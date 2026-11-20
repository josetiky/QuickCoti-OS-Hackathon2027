// Lectura HÍBRIDA del ticket: OCR QVAC sobre la foto COMPLETA (no se pierde ningún renglón) + nuestro detector YOLO para
// decir qué es cada renglón (proveedor, fecha, renglón, total). Si el detector no cubre un renglón, reglas simples lo clasifican.
// Antes: OCR solo dentro de las cajas del detector → si el detector fallaba (tickets mexicanos ≠ CORD), se perdían datos.
import type { Box } from '../types';

export type OcrLine = { text: string; cx: number; cy: number; x0: number; x1: number; y0: number; y1: number };

function rect(bb: any, W: number, H: number) {
  let xs: number[] = [], ys: number[] = [];
  if (Array.isArray(bb) && Array.isArray(bb[0])) { xs = bb.map((p: any) => +p[0]); ys = bb.map((p: any) => +p[1]); }
  else if (Array.isArray(bb) && bb.length >= 4) { const [a, b, c, d] = bb.map(Number); xs = [a, c > a ? c : a + c]; ys = [b, d > b ? d : b + d]; }
  else if (bb && typeof bb === 'object') { const x = +(bb.x ?? bb.left ?? 0), y = +(bb.y ?? bb.top ?? 0); xs = [x, x + +(bb.width ?? bb.w ?? 0)]; ys = [y, y + +(bb.height ?? bb.h ?? 0)]; }
  else return null;
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (x1 > 1.5 || y1 > 1.5) { x0 /= W; x1 /= W; y0 /= H; y1 /= H; } // píxeles → 0..1
  return { x0, x1, y0, y1 };
}

/** Junta los bloques del OCR en renglones (misma altura) y los ordena de arriba a abajo, izquierda a derecha. */
export function toLines(blocks: any[], W: number, H: number): OcrLine[] {
  // Enderezado: los tickets se fotografían chuecos. Con la inclinación mediana de los bloques (EasyOCR da 4 esquinas)
  // giramos los centros antes de agrupar por altura; si no, renglones distintos se mezclan.
  const angs: number[] = [];
  for (const b of blocks) { const q = b?.bbox ?? b?.box; if (Array.isArray(q) && Array.isArray(q[0]) && q.length >= 2) {
    const dx = +q[1][0] - +q[0][0], dy = +q[1][1] - +q[0][1]; if (Math.abs(dx) > 5) angs.push(Math.atan2(dy, dx)); } }
  angs.sort((a, b) => a - b);
  const ang = angs.length ? angs[Math.floor(angs.length / 2)] : 0;
  const cos = Math.cos(-ang), sin = Math.sin(-ang);
  const bs = blocks.map((b) => ({ t: String(b?.text ?? '').trim(), r: rect(b?.bbox ?? b?.box ?? b?.boundingBox, W, H) }))
    .filter((b) => b.t && b.r).map((b) => {
      const cx = (b.r!.x0 + b.r!.x1) / 2 * W, cy = (b.r!.y0 + b.r!.y1) / 2 * H;
      const ry = (cx * sin + cy * cos) / H; // centro enderezado
      return { t: b.t, ...b.r!, cy: ry, h: b.r!.y1 - b.r!.y0, rx: (cx * cos - cy * sin) / W };
    })
    .sort((a, b) => a.cy - b.cy);
  if (!bs.length) return [];
  const hs = bs.map((b) => b.h).sort((a, b) => a - b); const hMed = hs[Math.floor(hs.length / 2)] || 0.01;
  const lines: (typeof bs)[] = [];
  for (const b of bs) {
    const L = lines[lines.length - 1];
    const cyL = L ? L.reduce((a, x) => a + x.cy, 0) / L.length : -1;
    if (L && Math.abs(b.cy - cyL) < hMed * 0.5) L.push(b); else lines.push([b]);
  }
  return lines.map((L) => {
    L.sort((a, b) => a.rx - b.rx);
    const x0 = Math.min(...L.map((b) => b.x0)), x1 = Math.max(...L.map((b) => b.x1)), y0 = Math.min(...L.map((b) => b.y0)), y1 = Math.max(...L.map((b) => b.y1));
    return { text: L.map((b) => b.t).join(' '), x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  });
}

const RUIDO = /\b(rfc|r\.f\.c|regimen|r[ée]gimen|c\.?\s?p\.?\s?\d|folio|ticket|www|http|gracias|tel[ée]?f?|cambio|change|pago|efectivo|tarjeta|iva|i\.v\.a|cajer|mesero|atendi|check|factur|privacidad|aviso|eval[uú]a|consulta|sucursal|domicilio fiscal|no\.? de|pedido|orden)\b/i;
const MONTO = /\$?\s?\d{1,3}(?:[,.]\d{3})*[.,]\d{2}\b|\$\s?\d+/;
const FECHA = /\b\d{1,2}[\/\-. ](\d{1,2}|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*[\/\-.' ]\s?\d{2,4}\b/i;

/** Asigna cada renglón a una zona: primero por la caja del detector que lo contiene; si ninguna, por reglas. */
export function zonificar(lines: OcrLine[], boxes: Box[]): Record<string, string[]> {
  const z: Record<string, string[]> = { proveedor: [], fecha: [], renglon: [], total: [] };
  const campos = boxes.filter((b) => !b.label.startsWith('nota_'));
  const dentro = (l: OcrLine, b: Box) => { const [x, y, w, h] = b.bbox; return l.cx >= x - 0.02 && l.cx <= x + w + 0.02 && l.cy >= y - 0.01 && l.cy <= y + h + 0.01; };
  let subtotal: string | null = null;
  lines.forEach((l, i) => {
    const t = l.text;
    const caja = campos.filter((b) => dentro(l, b)).sort((a, b) => b.confidence - a.confidence)[0];
    let zona: string | null = null;
    if (/\bsub\s*-?\s*total\b/i.test(t)) { subtotal = t; return; }
    if (/\btotal\b/i.test(t) && MONTO.test(t)) zona = 'total';
    else if (FECHA.test(t) && !z.fecha.length) zona = 'fecha';
    else if (caja && caja.label !== 'renglon' && caja.confidence >= 0.35) zona = caja.label === 'folio' ? null : caja.label;
    else if (MONTO.test(t) && /[a-záéíóúñ]{3,}/i.test(t) && !RUIDO.test(t)) zona = 'renglon';
    else if (i < 3 && !MONTO.test(t) && !RUIDO.test(t) && /[a-z]{3,}/i.test(t) && !z.proveedor.length) zona = 'proveedor';
    if (zona === 'renglon' && RUIDO.test(t)) zona = null;
    if (zona) (z[zona] ??= []).push(t);
  });
  if (!z.total.length && subtotal) z.total.push(String(subtotal).replace(/sub\s*-?\s*/i, ''));
  for (const k of Object.keys(z)) if (!z[k].length) delete z[k];
  return z;
}
