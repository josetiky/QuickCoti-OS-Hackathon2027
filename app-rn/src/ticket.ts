// Comparte documentos en PDF (ticket térmico ~80 mm; cotización y factura en hoja carta) para guardar en Archivos o
// mandar. Si el módulo de PDF no está instalado, los comparte como texto (WhatsApp, Mensajes…). El HTML y el texto se
// arman en documentos.ts (puro, probado con tsx).
import { Share } from 'react-native';
import { ticketHTML, ticketTexto, type Ticket } from './documentos';

export { ticketHTML, ticketTexto } from './documentos';
export type { Ticket } from './documentos';

let Print: any = null, Sharing: any = null;
// @ts-ignore — módulo opcional
try { Print = require('expo-print'); } catch { Print = null; }
// @ts-ignore — módulo opcional
try { Sharing = require('expo-sharing'); } catch { Sharing = null; }

export const pdfDisponible = () => !!(Print && Sharing);

/** Genera el PDF y abre "Compartir" (Guardar en Archivos, WhatsApp, AirDrop, Imprimir…). Sin tamaño: hoja carta. */
export async function compartirDocumento(html: string, texto: string, titulo: string, tam?: { width: number; height: number }): Promise<'pdf' | 'texto'> {
  if (Print && Sharing) {
    const { uri } = await Print.printToFileAsync({ html, ...(tam ?? {}) });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: titulo });
    return 'pdf';
  }
  await Share.share({ message: texto, title: titulo });
  return 'texto';
}

export function compartirTicket(t: Ticket): Promise<'pdf' | 'texto'> {
  const alto = 420 + 16 * Math.max(0, (t.renglones?.length ?? 1) - 1) + (t.cotizacion ? 64 : 0);
  return compartirDocumento(ticketHTML(t), ticketTexto(t), `Ticket ${t.folio}`, { width: 227, height: alto });
}
