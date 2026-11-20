#!/bin/bash
# Hermes v2 en la M4 Max: desempaca lo entrenado en NVIDIA, evalúa base vs v1 vs v2 y convierte a GGUF para el iPhone.
# Antes: deja HERMES_V2_ENTREGA.tar.gz en evento/ (lo descargas del lab).
cd "$(dirname "$0")" || exit 1
EV=$(pwd)
[ -f HERMES_V2_ENTREGA.tar.gz ] || { echo "❌ Falta evento/HERMES_V2_ENTREGA.tar.gz"; exit 1; }
cd training/llm && tar xzf "$EV/HERMES_V2_ENTREGA.tar.gz" --overwrite 2>/dev/null || tar xzf "$EV/HERMES_V2_ENTREGA.tar.gz"
source .venv/bin/activate
set -e
echo "=== 1/3 EVAL v2 (test v2 + 12 reservados v2 + 12 reservados v1) ==="
python eval_assistant.py --adapter out/quickcoti-lora-v2 --test data_v2/test.jsonl --reserved casos_reservados_v2.jsonl,casos_reservados.jsonl --n 24 --out EVAL_ASISTENTE_V2.md
echo "=== 2/3 EVAL v1 en las MISMAS condiciones (para comparar) ==="
python eval_assistant.py --adapter out/quickcoti-lora --test data_v2/test.jsonl --reserved casos_reservados_v2.jsonl,casos_reservados.jsonl --n 24 --out EVAL_ASISTENTE_V1_en_v2.md
echo "=== 3/3 GGUF v2 para QVAC ==="
NAME=quickcoti-lora-v2 MERGE=0 ADAPTER=out/quickcoti-lora-v2 bash export_gguf.sh
ls -lh ../../models
echo "✅ LISTO. En el iPhone: Ajustes → Descargar modelos entrenados → Cargar IA local (QVAC). Debe decir 'LoRA QuickCoti v2'."
