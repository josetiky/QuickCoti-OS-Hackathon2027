#!/bin/bash
# Usa los modelos entrenados. Antes: levanta QVAC (ver ../README_EVENTO.md, paso 6).
cd "$(dirname "$0")" || exit 1
source .venv/bin/activate
pip install -q ultralytics onnxruntime
export MOCK_MODE=0
# export MP_ACCESS_TOKEN="TEST-..."   # credencial de PRUEBA de Mercado Pago (no la subas al repo)
export VISION_WEIGHTS="${VISION_WEIGHTS:-../models/quickcoti_vision.onnx}"
export LORA_ADAPTER="${LORA_ADAPTER:-../models/quickcoti-lora.gguf}"
export QVAC_BASE_URL="${QVAC_BASE_URL:-http://127.0.0.1:11435/v1}"
export QVAC_MODEL="${QVAC_MODEL:-quickcoti}"
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}')
echo "En la app usa:  http://$IP:8000"
uvicorn main:app --host 0.0.0.0 --port 8000
