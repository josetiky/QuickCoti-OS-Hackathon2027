// Lógica pura del almacén del titular. secure.ts la conecta con el llavero (Keychain) y AsyncStorage.
import { esTitular, soloDigitos, type Titular } from './valida';

export type KV = { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void>; del(k: string): Promise<void> };
export const CLAVE_TITULAR = 'quickcoti.titular';
export const MARCA_INSTALACION = 'quickcoti.instalado'; // vive en AsyncStorage: iOS la borra al desinstalar la app

export function crearAlmacen(seguro: KV, marca: KV) {
  return {
    async cargar(): Promise<Titular | null> {
      // iOS conserva el llavero aunque se borre la app: en una instalación nueva no deben quedar datos de antes.
      if (!(await marca.get(MARCA_INSTALACION))) {
        await seguro.del(CLAVE_TITULAR);
        await marca.set(MARCA_INSTALACION, '1');
        return null;
      }
      const raw = await seguro.get(CLAVE_TITULAR);
      if (!raw) return null;
      try { const t: unknown = JSON.parse(raw); return esTitular(t) ? t : null; } catch { return null; }
    },
    async guardar(t: Titular): Promise<void> {
      await seguro.set(CLAVE_TITULAR, JSON.stringify(t));
      await marca.set(MARCA_INSTALACION, '1');
    },
    borrar: (): Promise<void> => seguro.del(CLAVE_TITULAR),
  };
}

// Instalaciones anteriores guardaban la CLABE en AsyncStorage: se saca del estado y solo se usa para prellenar el formulario.
export function separarClabeLegada(persistido: unknown): { estado: Record<string, unknown>; clabeLegada: string } {
  const { clabe, ...estado } = (persistido && typeof persistido === 'object' ? persistido : {}) as Record<string, unknown>;
  return { estado, clabeLegada: typeof clabe === 'string' ? soloDigitos(clabe) : '' };
}

// Carga el módulo nativo del llavero hasta que se usa: si faltó instalarlo (pod install), la app abre igual
// y el formulario explica el problema en lugar de cerrarse al arrancar.
export const FALTA_MODULO_SEGURO = 'FALTA_MODULO_SEGURO';
export function llaveroPerezoso(cargar: () => KV): KV {
  let kv: KV | null = null;
  const usar = (): KV => {
    if (!kv) { try { kv = cargar(); } catch { throw new Error(FALTA_MODULO_SEGURO); } }
    return kv;
  };
  return {
    get: async (k) => usar().get(k),
    set: async (k, v) => usar().set(k, v),
    del: async (k) => usar().del(k),
  };
}
