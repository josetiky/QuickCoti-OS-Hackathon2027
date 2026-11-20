// Ajuste LoRA OFICIAL con QVAC (Qwen3-1.7B Q4_0 fine-tunable). Correr en el servidor NVIDIA:  node qvac_finetune.mjs
// Requiere: Node ≥ 22, npm i @qvac/sdk, Vulkan disponible (vulkaninfo). Si no hay Vulkan → usa train_lora.py (PEFT/CUDA) + export_gguf.sh.
import { loadModel, finetune, unloadModel, QWEN3_1_7B_INST_Q4 } from '@qvac/sdk';
import { writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';

const t0 = Date.now();
const log = { inicio: new Date().toISOString(), host: os.hostname(), herramienta: 'QVAC finetune (llama.cpp fabric, Vulkan)',
  modelo_base: 'QWEN3_1_7B_INST_Q4 (Qwen3-1.7B, Apache-2.0)', parametros: {} };
const options = {
  trainDatasetDir: './qvac_data/train',
  validation: { type: 'dataset', path: './qvac_data/val' },   // esquema verificado: none | split{fraction} | dataset{path}
  numberOfEpochs: Number(process.env.EPOCHS ?? 2),
  learningRate: Number(process.env.LR ?? 2e-4),
  assistantLossOnly: true,
  contextLength: Number(process.env.CTX ?? 1024),
  outputParametersDir: './out/qvac-lora',
  checkpointSaveDir: './out/qvac-ckpt',
};
log.parametros = options;
mkdirSync('./out', { recursive: true });
const modelId = await loadModel({ modelSrc: QWEN3_1_7B_INST_Q4, modelConfig: { device: 'gpu' } });
const handle = finetune({ modelId, options });
log.progreso = [];
for await (const p of handle.progressStream) { log.progreso.push(p); console.log('paso', p.global_steps, 'loss', p.loss); }
const res = await handle.result;
await unloadModel({ modelId });
log.resultado = res ?? null;
log.duracion_min = Math.round((Date.now() - t0) / 600) / 100;
log.fin = new Date().toISOString();
writeFileSync('./out/REGISTRO_QVAC_FINETUNE.json', JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
console.log('Adaptador .gguf en ./out/qvac-lora → cópialo a evento/models/quickcoti-lora.gguf');
