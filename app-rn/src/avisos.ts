// Avisos antes de acciones que no se deshacen (una venta o una compra registrada ya no se modifica) y qué hacer con los
// permisos de cámara y fotos. Puro (tsx).
import { money } from './types';

const recorta = (s: string, n = 120) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export function confirmacionCobro(a: { monto: number; metodo: string; resumen: string }): { titulo: string; mensaje: string } {
  const que = a.resumen.trim() ? `${a.metodo} · ${recorta(a.resumen.trim())}` : a.metodo;
  return { titulo: `¿Cobrar ${money(a.monto)}?`, mensaje: `${que}\n\nUna vez registrada, la venta ya no se puede modificar. Revisa artículos, cantidades y precios.` };
}

export function confirmacionCompra(a: { total: number; proveedor: string; renglones: number }): { titulo: string; mensaje: string } {
  const quien = a.proveedor.trim() || 'Sin proveedor';
  return { titulo: `¿Guardar la compra de ${money(a.total)}?`,
    mensaje: `${quien} · ${a.renglones} ${a.renglones === 1 ? 'renglón' : 'renglones'}\n\nUna vez guardada, la compra ya no se puede modificar. Revisa proveedor, cantidades y precios.` };
}

export type PermisoLite = { granted: boolean; canAskAgain: boolean };
/** 'usar': ya hay permiso (también acceso limitado a fotos); 'pedir': iOS aún puede preguntar; 'ajustes': hay que darlo en Ajustes. */
export const pasoPermiso = (p: PermisoLite): 'usar' | 'pedir' | 'ajustes' => (p.granted ? 'usar' : p.canAskAgain ? 'pedir' : 'ajustes');
