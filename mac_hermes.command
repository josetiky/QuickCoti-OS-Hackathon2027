#!/bin/bash
# Corre en la M4 Max: evaluación base vs ajustado + conversión a GGUF para QVAC.
cd "$(dirname "$0")/training/llm" || exit 1
set -e
if [ ! -d .venv ]; then python3 -m venv .venv; fi
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q torch "transformers>=4.51,<4.57" "peft>=0.15,<0.18" "accelerate>=1.3,<1.11" sentencepiece gguf protobuf
echo "=== 1/2 EVALUACION base vs ajustado (12 reservados + 20 de test) ==="
python eval_assistant.py --adapter out/quickcoti-lora --n 20 --out EVAL_ASISTENTE.md 2>&1 | tee log_eval_mac.txt
echo "=== 2/2 EXPORTAR GGUF para QVAC ==="
bash export_gguf.sh 2>&1 | tee log_gguf_mac.txt
echo "LISTO. Revisa evento/models/"
ls -lh ../../models
