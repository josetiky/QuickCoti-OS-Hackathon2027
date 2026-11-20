// Puente con QVAC (IA local en el iPhone). Si QVAC no carga (simulador, Expo Go), la app sigue en modo MOCK y lo muestra en pantalla.
import * as FileSystem from 'expo-file-system/legacy';
import * as Q from '@qvac/sdk';

export const MODELS_DIR = FileSystem.documentDirectory + 'models/';
export const LORA_PATH = MODELS_DIR + 'quickcoti-lora.gguf';
export const LORA_V2_PATH = MODELS_DIR + 'quickcoti-lora-v2.gguf'; // Hermes v2: rentas + entregas (2.º ajuste en NVIDIA)
export const VISION_PATH = MODELS_DIR + 'quickcoti_vision.onnx';

type State = { llmId?: string; ocrId?: string; llmLabel: string; ocrLabel: string; error?: string; loraLoaded: boolean; loraVersion: 0 | 1 | 2 };
export const qvacState: State = { llmLabel: 'sin cargar', ocrLabel: 'sin cargar', loraLoaded: false, loraVersion: 0 };

const strip = (p: string) => p.replace(/^file:\/\//, '');

export async function fileExists(uri: string) {
  try { return (await FileSystem.getInfoAsync(uri)).exists; } catch { return false; }
}

/** Descarga modelos que dejaste en la Mac:  cd evento/models && python3 -m http.server 8080 */
export async function downloadModels(baseUrl: string, onMsg: (m: string) => void) {
  await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true }).catch(() => {});
  const files: [string, string][] = [['quickcoti-lora-v2.gguf', LORA_V2_PATH], ['quickcoti-lora.gguf', LORA_PATH], ['quickcoti_vision.onnx', VISION_PATH]];
  const ok: string[] = [];
  for (const [name, dest] of files) {
    onMsg(`Descargando ${name}…`);
    let r: any;
    try { r = await FileSystem.downloadAsync(baseUrl.replace(/\/$/, '') + '/' + name, dest + '.tmp'); }
    catch (e: any) { throw new Error(`No hay conexión con ${baseUrl}. ¿Misma Wi-Fi y servidor corriendo en la Mac? (${e?.message ?? e})`); }
    if (r.status !== 200) { await FileSystem.deleteAsync(dest + '.tmp', { idempotent: true }); onMsg(`⏭️ ${name} aún no está en la Mac (HTTP ${r.status}), lo salto.`); continue; }
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.moveAsync({ from: dest + '.tmp', to: dest });
    ok.push(name);
  }
  onMsg(ok.length ? `Listo ✔︎ descargado: ${ok.join(', ')}` : 'No se descargó ningún modelo.');
}

export async function loadLLM(force = false) {
  if (qvacState.llmId && !force) return qvacState.llmId;
  const v2 = await fileExists(LORA_V2_PATH);
  const hasLora = v2 || (await fileExists(LORA_PATH));
  const modelConfig: any = { device: 'gpu', ctx_size: 4096 };
  if (hasLora) modelConfig.lora = strip(v2 ? LORA_V2_PATH : LORA_PATH); // campo verificado en @qvac/inference model-config-schemas (lora: string)
  try {
    if (qvacState.llmId) await Q.unloadModel({ modelId: qvacState.llmId }).catch(() => {});
    qvacState.llmId = await Q.loadModel({ modelSrc: Q.QWEN3_1_7B_INST_Q4, modelConfig });
    qvacState.loraLoaded = hasLora;
    qvacState.loraVersion = v2 ? 2 : hasLora ? 1 : 0;
    qvacState.llmLabel = `QVAC · Qwen3-1.7B Q4${hasLora ? ` + LoRA QuickCoti v${v2 ? 2 : 1} (entrenado en NVIDIA en el evento)` : ' (BASE, sin LoRA)'}`;
    qvacState.error = undefined;
    return qvacState.llmId;
  } catch (e: any) {
    qvacState.error = 'QVAC no pudo cargar el modelo: ' + (e?.message ?? String(e));
    qvacState.llmLabel = 'MOCK (QVAC no disponible)';
    throw e;
  }
}

export async function chat(system: string, history: { role: string; content: string }[], maxTokens = 700): Promise<string> {
  const modelId = await loadLLM();
  const r: any = Q.completion({ modelId, history: [{ role: 'system', content: system + '\n/no_think' }, ...history], stream: true,
    generationParams: { temp: 0.2, predict: maxTokens } } as any);
  let out = '';
  for await (const t of r.tokenStream) out += t;
  return out.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// El detector de texto (CRAFT) amplía la foto ×1.5; sin tope procesa ~2400 px y se queda sin memoria en el iPhone
// ("ggml_gallocr_alloc_graph failed"). @qvac/ocr-ggml recomienda canvasSize 1280 en celulares.
const OCR_MEMORIA = { canvasSize: 1280 };

export async function loadOCR() {
  if (qvacState.ocrId) return qvacState.ocrId;
  try {
    qvacState.ocrId = await Q.loadModel({ modelSrc: Q.OCR_LATIN.src, modelType: Q.MODEL_TYPES.ggmlOcr, modelConfig: { langList: ['es', 'en'], ...OCR_MEMORIA } } as any);
  } catch {
    qvacState.ocrId = await Q.loadModel({ modelSrc: Q.OCR_LATIN.src, modelType: Q.MODEL_TYPES.ggmlOcr, modelConfig: { ...OCR_MEMORIA } } as any);
  }
  qvacState.ocrLabel = 'QVAC OCR · EasyOCR latino (preentrenado, complemento)';
  return qvacState.ocrId;
}

/** Bloques crudos del OCR (texto + caja) para la lectura híbrida de ai/zonas.ts */
export async function ocrBlocks(imageUri: string): Promise<any[]> {
  const modelId = await loadOCR();
  const { blocks } = Q.ocr({ modelId, image: strip(imageUri), options: { paragraph: false } } as any);
  return (await blocks) as any[];
}

export async function ocrText(imageUri: string): Promise<string> {
  const modelId = await loadOCR();
  const { blocks } = Q.ocr({ modelId, image: strip(imageUri), options: { paragraph: false } } as any);
  const res: any[] = await blocks;
  // ordena de arriba hacia abajo si trae bbox
  const y = (b: any) => (Array.isArray(b?.bbox) ? (Array.isArray(b.bbox[0]) ? b.bbox[0][1] : b.bbox[1]) : 0);
  return res.slice().sort((a, b) => y(a) - y(b)).map((b) => b.text).filter(Boolean).join(' ');
}
