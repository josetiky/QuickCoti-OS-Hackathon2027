// Mandar por WhatsApp: abre el chat con el texto ya escrito (wa.me). Solo texto: un enlace no puede adjuntar el PDF,
// que sigue en "Compartir". El número no se guarda. Puro (tsx).

/** Celular de México → "52" + 10 dígitos. Acepta espacios, guiones, paréntesis y +52 o 521 delante. */
export function normalizarCelularMX(s: string): string | null {
  const d = String(s ?? '').replace(/\D/g, '');
  const diez = d.length === 10 ? d : d.length === 12 && d.startsWith('52') ? d.slice(2) : d.length === 13 && d.startsWith('521') ? d.slice(3) : '';
  return /^[2-9]\d{9}$/.test(diez) ? '52' + diez : null;
}

export function enlaceWhatsApp(celular: string, texto: string): string | null {
  const n = normalizarCelularMX(celular);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
}
