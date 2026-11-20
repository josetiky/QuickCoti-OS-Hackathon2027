// Detector de zonas (YOLO entrenado por el equipo en el servidor NVIDIA → exportado a ONNX) corriendo EN el iPhone.
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { VISION_PATH, fileExists } from './qvac';
import { pixels, type Img } from './image';
import type { Box, DocType } from '../types';

export const CLASSES = ['proveedor', 'fecha', 'renglon', 'total', 'folio', 'nota_impresa', 'nota_manuscrita'];
let session: InferenceSession | null = null;
export let visionLabel = 'sin cargar';
export let IMGSZ = 960; // debe coincidir con --imgsz del entrenamiento/export

export async function loadVision() {
  if (session) return session;
  if (!(await fileExists(VISION_PATH))) throw new Error('No encuentro el modelo de visión en el iPhone. Ve a Ajustes → Descargar modelos.');
  session = await InferenceSession.create(VISION_PATH.replace(/^file:\/\//, ''));
  visionLabel = 'quickcoti_vision.onnx (YOLO entrenado en el evento)';
  return session;
}

function iou(a: number[], b: number[]) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]), x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9);
}

export async function detect(img: Img, conf = 0.25): Promise<{ status: 'ok' | 'unreadable'; doc_type: DocType; boxes: Box[]; message?: string; model: string }> {
  const s = await loadVision();
  const px = await pixels(img, IMGSZ);
  const S = IMGSZ, padX = Math.floor((S - px.width) / 2), padY = Math.floor((S - px.height) / 2);
  const input = new Float32Array(3 * S * S).fill(114 / 255);
  for (let y = 0; y < px.height; y++) for (let x = 0; x < px.width; x++) {
    const i = (y * px.width + x) * 4, o = (y + padY) * S + (x + padX);
    input[o] = px.data[i] / 255; input[S * S + o] = px.data[i + 1] / 255; input[2 * S * S + o] = px.data[i + 2] / 255;
  }
  const feeds: Record<string, Tensor> = { [s.inputNames[0]]: new Tensor('float32', input, [1, 3, S, S]) };
  const out = (await s.run(feeds))[s.outputNames[0]];
  const data = out.data as Float32Array;
  const [, ch, n] = out.dims as number[];           // [1, 4+nc, N]
  const nc = ch - 4;
  const cand: { c: number; p: number; xyxy: number[] }[] = [];
  for (let i = 0; i < n; i++) {
    let best = 0, bc = 0;
    for (let c = 0; c < nc; c++) { const v = data[(4 + c) * n + i]; if (v > best) { best = v; bc = c; } }
    if (best < conf) continue;
    const cx = data[i], cy = data[n + i], w = data[2 * n + i], h = data[3 * n + i];
    cand.push({ c: bc, p: best, xyxy: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2] });
  }
  cand.sort((a, b) => b.p - a.p);
  const keep: typeof cand = [];
  for (const d of cand) if (!keep.some((k) => k.c === d.c && iou(k.xyxy, d.xyxy) > 0.5)) keep.push(d);
  const toNorm = (v: number, pad: number, len: number) => Math.min(1, Math.max(0, (v - pad) / px.scale / len));
  const boxes: Box[] = keep.map((d) => {
    const x1 = toNorm(d.xyxy[0], padX, img.width), y1 = toNorm(d.xyxy[1], padY, img.height);
    const x2 = toNorm(d.xyxy[2], padX, img.width), y2 = toNorm(d.xyxy[3], padY, img.height);
    return { label: CLASSES[d.c] ?? `c${d.c}`, confidence: Math.round(d.p * 1000) / 1000, bbox: [x1, y1, x2 - x1, y2 - y1] };
  });
  const docs = boxes.filter((b) => b.label.startsWith('nota_')).sort((a, b) => b.confidence - a.confidence);
  const doc_type: DocType = docs.length ? (docs[0].label === 'nota_manuscrita' ? 'manuscrito' : 'impreso') : 'desconocido';
  const fields = boxes.filter((b) => !b.label.startsWith('nota_'));
  if (!fields.length) return { status: 'unreadable', doc_type, boxes, model: visionLabel, message: 'No encontré datos en la foto. Intenta con más luz y la nota completa en cuadro.' };
  return { status: 'ok', doc_type, boxes, model: visionLabel };
}
