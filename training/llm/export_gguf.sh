#!/bin/bash
# Convierte el resultado del ajuste a GGUF para servirlo con QVAC (llama.cpp por dentro). Correr en el servidor NVIDIA tras train_lora.py.
# Produce: ../../models/quickcoti-lora.gguf (adaptador, evidencia) y ../../models/quickcoti-merged-q8_0.gguf (base+LoRA fusionado, lo que sirve QVAC)
set -e
BASE=${BASE:-Qwen/Qwen3-1.7B}
ADAPTER=${ADAPTER:-out/quickcoti-lora}
OUT=${OUT:-../../models}
NAME=${NAME:-quickcoti-lora}     # v2: NAME=quickcoti-lora-v2
MERGE=${MERGE:-1}                # 0 = solo el adaptador (lo que usa la app)
mkdir -p "$OUT"
[ -d llama.cpp ] || git clone --depth 1 https://github.com/ggml-org/llama.cpp
pip install -q -r llama.cpp/requirements/requirements-convert_hf_to_gguf.txt || pip install -q gguf sentencepiece
# 1) adaptador LoRA → GGUF
python llama.cpp/convert_lora_to_gguf.py "$ADAPTER" --base-model-id "$BASE" --outfile "$OUT/$NAME.gguf" --outtype f16 \
  || echo "⚠️  convert_lora_to_gguf falló; se usará solo el modelo fusionado"
if [ "$MERGE" = "1" ]; then
# 2) fusionar base + LoRA y convertir a GGUF Q8_0 (formato que QVAC acepta para ajustes posteriores)
python - <<PY
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
m = AutoModelForCausalLM.from_pretrained("$BASE", torch_dtype=torch.float16)
m = PeftModel.from_pretrained(m, "$ADAPTER").merge_and_unload()
m.save_pretrained("merged"); AutoTokenizer.from_pretrained("$BASE").save_pretrained("merged")
PY
python llama.cpp/convert_hf_to_gguf.py merged --outfile "$OUT/quickcoti-merged-q8_0.gguf" --outtype q8_0
fi
(command -v sha256sum >/dev/null && sha256sum "$OUT"/*.gguf || shasum -a 256 "$OUT"/*.gguf) | tee "$OUT/SHA256SUMS.txt"
