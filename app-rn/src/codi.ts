// CoDi SIMULADO 100% en el iPhone (no necesita la Mac ni internet), como el flujo del repo mipyme-multiagente:
// crear cobro → QR → (simular) el cliente paga → LIQUIDADO con clave de rastreo → ticket PDF.
// No es un QR CoDi válido ni mueve dinero: así se declara en la app, en el QR y en el ticket.
export type CobroCodi = {
  referencia: string; negocio: string; concepto: string; monto: number; clabe: string; comprador: string;
  estatus: 'PENDIENTE' | 'LIQUIDADO' | 'FALLIDO'; qrPayload: string; claveRastreo: string | null;
  fechaCreacion: string; fechaLiquidacion: string | null; metodo: string; simulado: boolean;
};

export function crearCobroCodi(monto: number, concepto: string, negocio: string, clabe: string, comprador = ''): CobroCodi {
  const referencia = `VTA-${Date.now().toString().slice(-6)}`;
  const qrPayload = JSON.stringify({ tipo: 'CODI_QR_SIMULADO', aviso: 'NO VALIDO PARA PAGOS REALES', referencia, monto: monto.toFixed(2), beneficiario: negocio, clabeDestino: clabe ? '****' + clabe.slice(-4) : null, concepto });
  return { referencia, negocio, concepto, monto, clabe, comprador: comprador || 'Público en general', estatus: 'PENDIENTE', qrPayload, claveRastreo: null,
    fechaCreacion: new Date().toISOString(), fechaLiquidacion: null, metodo: 'CoDi / SPEI (SIMULADO)', simulado: true };
}

/** Simula el aviso del banco (webhook) de que el pago se liquidó. */
export const liquidarCodi = (c: CobroCodi): CobroCodi => ({ ...c, estatus: 'LIQUIDADO', claveRastreo: `CODI${Date.now()}MXN`, fechaLiquidacion: new Date().toISOString() });
export const fallarCodi = (c: CobroCodi): CobroCodi => ({ ...c, estatus: 'FALLIDO' });
