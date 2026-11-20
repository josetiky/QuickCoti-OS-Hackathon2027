// Conecta el almacén del titular con el llavero del iPhone (Keychain): cifrado y solo en este dispositivo
// (no va a respaldos de iCloud ni pasa a otro teléfono). La marca de instalación vive en AsyncStorage.
import type * as SecureStoreT from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { crearAlmacen, llaveroPerezoso, type KV } from './almacen';
import type { Titular } from './valida';

// require perezoso: expo-secure-store busca su módulo nativo al importarse; si faltó `pod install`, la app no abriría.
const llavero: KV = llaveroPerezoso(() => {
  const SS: typeof SecureStoreT = require('expo-secure-store');
  const OPC: SecureStoreT.SecureStoreOptions = { keychainAccessible: SS.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  return {
    get: (k) => SS.getItemAsync(k, OPC),
    set: (k, v) => SS.setItemAsync(k, v, OPC),
    del: (k) => SS.deleteItemAsync(k, OPC),
  };
});
const marca: KV = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  del: (k) => AsyncStorage.removeItem(k),
};
const almacen = crearAlmacen(llavero, marca);

export const cargarTitular = (): Promise<Titular | null> => almacen.cargar();
export const guardarTitular = (t: Titular): Promise<void> => almacen.guardar(t);
export const borrarTitular = (): Promise<void> => almacen.borrar();
