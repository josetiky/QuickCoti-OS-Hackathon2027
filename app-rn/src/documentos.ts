// Documentos que se comparten (PDF o texto): ticket de venta, comprobante de pago de cotización, cotización y factura SIMULADA.
// Puro (sin React Native) para probarlo con tsx; ticket.ts los convierte en PDF y abre Compartir.
import { anticipoSugerido, pagado, saldo, type Cotizacion, type TipoPago } from './cotizacion';
import type { Factura } from './factura';

export type PagoTicket = { folio: string; total: number; pagadoAntes: number; resta: number; tipo: TipoPago };
export type Ticket = {
  folio: string; negocio: string; concepto: string; monto: number; metodo: string; estatus: string;
  fecha: string; cliente?: string; clabe?: string; rastreo?: string | null; simulado: boolean;
  renglones?: { name: string; qty: number; price: number }[]; // venta con varios artículos
  cotizacion?: PagoTicket; // pago de una cotización: monto = lo que se pagó ahora
};

export const mx = (n: number) => '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const fecha = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const tipoTxt = (t: TipoPago) => (t === 'anticipo' ? 'anticipo' : 'liquidación');
const pct = (t: number) => `${Math.round(t * 100)} %`;
const ivaTxt = (t: number) => (t > 0 ? `Precios con IVA incluido (${pct(t)}).` : 'IVA 0 % (tasa cero o exento).');

// ─── Ticket (~80 mm) ───
export function ticketHTML(t: Ticket) {
  const fila = (k: string, v: string) => `<div class="r"><b>${k}</b><span>${esc(v)}</span></div>`;
  const c = t.cotizacion;
  const totales = c
    ? `${fila('Total de la cotización', mx(c.total))}${fila('Pagado antes', mx(c.pagadoAntes))}
    <div class="tot"><span>ESTE PAGO (${tipoTxt(c.tipo).toUpperCase()})</span><span>${mx(t.monto)}</span></div>
    ${c.resta > 0 ? fila('Resta', mx(c.resta)) : '<div class="g">Cotización liquidada ✓</div>'}`
    : `<div class="tot"><span>TOTAL</span><span>${mx(t.monto)} MXN</span></div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: 80mm auto; margin: 5mm; }
    body { font-family: -apple-system, Helvetica, Arial; color:#0f172a; width: 70mm; margin: 0 auto; font-size: 11px; }
    h1 { font-size: 15px; text-align:center; margin: 4px 0 2px; } .c { text-align:center; color:#475569; font-size:9.5px; }
    .sim { text-align:center; font-weight:800; color:#b91c1c; border:1.5px solid #b91c1c; padding:3px; margin:6px 0; font-size:10px; }
    hr { border:0; border-top:1px dashed #94a3b8; margin:8px 0; } .r { display:flex; justify-content:space-between; gap:8px; margin:2px 0; }
    .r span { text-align:right; } .tot { font-size:15px; font-weight:800; display:flex; justify-content:space-between; margin-top:6px; }
    .g { text-align:center; font-weight:700; margin-top:10px; }
  </style></head><body>
    <h1>${esc(t.negocio)}</h1>
    <div class="c">${c ? `COMPROBANTE DE PAGO · ${esc(c.folio)}` : 'COMPROBANTE DE VENTA'}${t.metodo.includes('CoDi') ? ' DIGITAL (CoDi)' : ''}</div>
    ${t.simulado ? '<div class="sim">SIMULACIÓN · NO ES UN COMPROBANTE FISCAL NI UN PAGO REAL</div>' : ''}
    <hr/>
    ${fila('Folio', t.folio)}${fila('Estatus', t.estatus)}${fila('Fecha', fecha(t.fecha))}${fila('Cliente', t.cliente || 'Público en general')}
    ${t.clabe ? fila('Destino', 'CLABE •••• ' + t.clabe.slice(-4)) : ''}
    <hr/>
    ${t.renglones?.length
      ? t.renglones.map((r) => `<div class="r"><span style="text-align:left">${esc(String(r.qty))} × ${esc(r.name)}</span><span>${mx(r.qty * r.price)}</span></div>`).join('')
      : `<div>${esc(t.concepto)}</div>`}
    ${totales}
    <hr/>
    ${fila('Método', t.metodo)}${t.rastreo ? fila('Rastreo', t.rastreo) : ''}
    <div class="g">¡Gracias por su compra!</div>
    <div class="c">Generado con QuickCoti · IA local en el iPhone</div>
  </body></html>`;
}

export function ticketTexto(t: Ticket) {
  const c = t.cotizacion;
  const sim = t.simulado ? ' (SIMULADO, no es pago real)' : '';
  return [`${t.negocio}`, c ? `Comprobante de pago · ${c.folio}${sim}` : `Comprobante de venta${sim}`, `Folio: ${t.folio}`, `Fecha: ${fecha(t.fecha)}`,
    ...(t.renglones?.length ? t.renglones.map((r) => `${r.qty} × ${r.name}  ${mx(r.qty * r.price)}`) : [`Concepto: ${t.concepto}`]),
    ...(c ? [`Total de la cotización: ${mx(c.total)}`, `Pagado antes: ${mx(c.pagadoAntes)}`, `Este pago (${tipoTxt(c.tipo)}): ${mx(t.monto)}`,
      c.resta > 0 ? `Resta: ${mx(c.resta)}` : 'Cotización liquidada ✓'] : [`TOTAL: ${mx(t.monto)} MXN`]),
    `Método: ${t.metodo}`, t.rastreo ? `Rastreo: ${t.rastreo}` : '', '¡Gracias por su compra!'].filter(Boolean).join('\n');
}

// ─── Cotización (hoja carta) ───
function lineasPago(c: Cotizacion): string[] {
  if (c.pagos.length) return [`Pagado: ${mx(pagado(c))}`, `Resta: ${mx(saldo(c))}`];
  return c.anticipoPct > 0 ? [`Anticipo: ${c.anticipoPct} % (${mx(anticipoSugerido(c))})`] : [];
}

export function cotizacionTexto(c: Cotizacion, negocio: string, tasaIVA: number) {
  return [negocio, `Cotización ${c.folio}`, `Fecha: ${fecha(c.fecha)}`, c.cliente ? `Cliente: ${c.cliente}` : '',
    ...c.renglones.map((r) => `${r.qty} × ${r.name}  ${mx(r.qty * r.price)}`), `Total: ${mx(c.total)} MXN`, ...lineasPago(c), ivaTxt(tasaIVA),
    '¡Gracias por su preferencia!'].filter(Boolean).join('\n');
}

export function cotizacionHTML(c: Cotizacion, negocio: string, tasaIVA: number) {
  const filas = c.renglones.map((r) => `<tr><td>${esc(String(r.qty))}</td><td>${esc(r.name)}</td><td class="n">${mx(r.price)}</td><td class="n">${mx(r.qty * r.price)}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: letter; margin: 18mm; }
    body { font-family: -apple-system, Helvetica, Arial; color:#0f172a; font-size: 12px; }
    h1 { font-size: 22px; margin: 0; } .sub { color:#475569; margin-top: 4px; }
    table { width:100%; border-collapse: collapse; margin-top: 16px; } th, td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align:left; }
    th { color:#475569; font-size: 11px; } .n { text-align:right; } .tot td { font-weight: 800; font-size: 15px; border-bottom: 0; }
    .box { margin-top: 14px; padding: 10px 12px; background:#f1f5f9; border-radius: 8px; line-height: 1.6; }
  </style></head><body>
    <h1>${esc(negocio)}</h1>
    <div class="sub">COTIZACIÓN ${esc(c.folio)} · ${esc(fecha(c.fecha))}</div>
    <div class="box"><b>Cliente:</b> ${esc(c.cliente || 'Público en general')}</div>
    <table><thead><tr><th>Cant.</th><th>Concepto</th><th class="n">Precio c/u</th><th class="n">Importe</th></tr></thead>
    <tbody>${filas}<tr class="tot"><td></td><td>Total</td><td></td><td class="n">${mx(c.total)} MXN</td></tr></tbody></table>
    <div class="box">${[...lineasPago(c), ivaTxt(tasaIVA)].map(esc).join('<br/>')}</div>
    <div class="sub" style="margin-top:24px">Generado con QuickCoti</div>
  </body></html>`;
}

// ─── Factura SIMULADA (hoja carta) ───
export function facturaHTML(f: Factura) {
  const fila = (k: string, v: string) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`;
  const conceptos = f.conceptos.map((c) => `<tr><td>${esc(String(c.cantidad))}</td><td>${esc(c.descripcion)}</td><td class="n">${mx(c.valorUnitario)}</td><td class="n">${mx(c.importe)}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: letter; margin: 16mm; }
    body { font-family: -apple-system, Helvetica, Arial; color:#0f172a; font-size: 11.5px; }
    h1 { font-size: 22px; margin: 0; } .sim { font-weight:800; color:#b91c1c; border:2px solid #b91c1c; padding:8px; margin:10px 0; text-align:center; font-size: 12px; }
    .dos { display:flex; gap: 16px; } .dos > div { flex:1; } h2 { font-size: 12px; color:#475569; margin: 12px 0 4px; letter-spacing: .5px; }
    table { width:100%; border-collapse: collapse; } th, td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; text-align:left; vertical-align: top; }
    th { color:#475569; font-weight: 600; } .n { text-align:right; } .tot td { font-weight: 800; font-size: 14px; border-bottom: 0; }
  </style></head><body>
    <h1>FACTURA SIMULADA</h1>
    <div class="sim">SIMULACIÓN · NO ES UN CFDI VÁLIDO ANTE EL SAT · SIN TIMBRE FISCAL</div>
    <div class="dos">
      <div><h2>EMISOR</h2><table>${fila('Nombre', f.emisor.nombre)}${fila('RFC', 'no incluido (simulación)')}${fila('Régimen', f.emisor.regimen ?? 'no indicado')}</table></div>
      <div><h2>RECEPTOR</h2><table>${fila('RFC', f.receptor.rfc)}${fila('Nombre', f.receptor.nombre)}${fila('Código postal', f.receptor.cp)}${fila('Régimen', f.receptor.regimenNombre)}${fila('Uso del CFDI', f.receptor.usoNombre)}</table></div>
    </div>
    <h2>COMPROBANTE</h2>
    <table>${fila('Folio interno', f.folio)}${fila('Fecha', fecha(f.fecha))}${fila('Tipo', 'I · Ingreso')}${fila('Moneda', 'MXN')}${fila('Forma de pago', f.formaPago)}${fila('Método de pago', 'PUE · Pago en una sola exhibición')}${fila('Folio fiscal (UUID)', 'sin timbrar (simulación)')}</table>
    <h2>CONCEPTOS</h2>
    <table><thead><tr><th>Cant.</th><th>Descripción</th><th class="n">Valor unitario</th><th class="n">Importe</th></tr></thead><tbody>${conceptos}
      <tr><td></td><td></td><td class="n">Subtotal</td><td class="n">${mx(f.subtotal)}</td></tr>
      <tr><td></td><td></td><td class="n">IVA trasladado ${pct(f.tasaIVA)}</td><td class="n">${mx(f.iva)}</td></tr>
      <tr class="tot"><td></td><td></td><td class="n">Total</td><td class="n">${mx(f.total)} MXN</td></tr></tbody></table>
    ${f.nota ? `<p>${esc(f.nota)}</p>` : ''}
    <p style="color:#475569">Generado con QuickCoti para mostrar el flujo de facturación. Para una factura real, emítela con tu proveedor de facturación o en el portal del SAT.</p>
  </body></html>`;
}

export function facturaTexto(f: Factura) {
  return ['FACTURA SIMULADA (no es un CFDI válido ante el SAT)', f.emisor.nombre, `Folio: ${f.folio} · ${fecha(f.fecha)}`, `Receptor: ${f.receptor.rfc} · ${f.receptor.nombre}`,
    `Subtotal: ${mx(f.subtotal)}`, `IVA ${pct(f.tasaIVA)}: ${mx(f.iva)}`, `Total: ${mx(f.total)} MXN`, `Forma de pago: ${f.formaPago} · ${f.metodoPago}`, f.nota ?? '']
    .filter(Boolean).join('\n');
}
