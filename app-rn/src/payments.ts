// Cliente de pagos: Mercado Pago real (vía la Mac, que guarda el token) + CoDi SIMULADO de respaldo.
import { useStore } from './store';

async function call(path: string, init?: RequestInit) {
  const base = useStore.getState().aiServerUrl.replace(/\/$/, '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(base + path, { ...init, signal: ctrl.signal, headers: { 'Content-Type': 'application/json' } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || `Error ${r.status} del servidor de pagos.`);
    return d;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('El servidor de pagos tardó demasiado.');
    if (String(e?.message).includes('Network request failed')) throw new Error('Sin conexión con el servidor de pagos (Mac). Revisa el Wi-Fi.');
    throw e;
  } finally { clearTimeout(t); }
}

export const mpCreate = (concept: string, amount: number, business_name: string) =>
  call('/api/v1/payments/mp/create', { method: 'POST', body: JSON.stringify({ concept, amount, business_name }) });
export const mpStatus = (ref: string) => call(`/api/v1/payments/mp/status/${encodeURIComponent(ref)}`);
export const codiSimulated = (amount: number, description: string) =>
  call('/api/v1/payments/codi-qr', { method: 'POST', body: JSON.stringify({ sale_id: String(Date.now()), amount, description }) });
export const health = () => call('/api/v1/health');
