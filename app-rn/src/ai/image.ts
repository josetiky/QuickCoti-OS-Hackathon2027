// Utilidades de imagen: normalizar orientación/tamaño, recortar zonas, leer píxeles.
import * as IM from 'expo-image-manipulator';
import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';

export type Img = { uri: string; width: number; height: number };

async function run(uri: string, actions: IM.Action[], base64 = false) {
  return IM.manipulateAsync(uri, actions, { compress: 0.9, format: IM.SaveFormat.JPEG, base64 });
}

/** Aplica la orientación EXIF y limita el lado mayor (las cajas del modelo se calculan sobre ESTA imagen). */
export async function normalize(uri: string, maxSide = 1600): Promise<Img> {
  const probe = await run(uri, []);
  const s = Math.min(1, maxSide / Math.max(probe.width, probe.height));
  const r = s < 1 ? await run(uri, [{ resize: { width: Math.round(probe.width * s) } }]) : probe;
  return { uri: r.uri, width: r.width, height: r.height };
}

/** bbox normalizado [x,y,w,h] → archivo recortado (con margen). */
export async function crop(img: Img, b: [number, number, number, number], pad = 0.01): Promise<string> {
  const x = Math.max(0, (b[0] - pad) * img.width), y = Math.max(0, (b[1] - pad) * img.height);
  const w = Math.min(img.width - x, (b[2] + 2 * pad) * img.width), h = Math.min(img.height - y, (b[3] + 2 * pad) * img.height);
  const r = await run(img.uri, [{ crop: { originX: Math.round(x), originY: Math.round(y), width: Math.max(8, Math.round(w)), height: Math.max(8, Math.round(h)) } }]);
  return r.uri;
}

/** Píxeles RGBA de la imagen redimensionada para que su lado mayor = size (para letterbox). */
export async function pixels(img: Img, size: number) {
  const s = size / Math.max(img.width, img.height);
  const r = await run(img.uri, [{ resize: { width: Math.round(img.width * s), height: Math.round(img.height * s) } }], true);
  const raw = jpeg.decode(Buffer.from(r.base64!, 'base64'), { useTArray: true });
  return { data: raw.data as Uint8Array, width: raw.width, height: raw.height, scale: s };
}

export async function brightness(img: Img): Promise<number> {
  const p = await pixels(img, 48);
  let sum = 0;
  for (let i = 0; i < p.data.length; i += 4) sum += (p.data[i] + p.data[i + 1] + p.data[i + 2]) / 3;
  return sum / (p.data.length / 4) / 255;
}
