#!/bin/bash
# Hermes v2 — ajuste LoRA en el servidor NVIDIA (DLI). Un solo comando; corre en segundo plano y sobrevive si la terminal se congela.
# Uso (en una terminal del lab):  cd /dli/task/hermes_v2 && bash lab_train_v2.sh
cd "$(dirname "$0")"
LOG=/dli/task/hermes_v2/log_llm_v2.txt
{
echo "=== $(date -Iseconds) PREPARANDO ENTORNO ==="
# unset LD_LIBRARY_PATH (en la sesión nueva rompe torch: libcupti)
command -v python >/dev/null || ln -sf "$(command -v python3)" /usr/local/bin/python
printf "torch==2.5.1\ntorchvision==0.20.1\ntriton==3.1.0\n" > /dli/task/constraints.txt
pip install -q "nvidia-cuda-cupti-cu12==12.1.105" "nvidia-cuda-runtime-cu12==12.1.105" "nvidia-cuda-nvrtc-cu12==12.1.105" "nvidia-cublas-cu12==12.1.3.1" "nvidia-cudnn-cu12==9.1.0.70" "nvidia-cufft-cu12==11.0.2.54" "nvidia-curand-cu12==10.3.2.106" "nvidia-cusolver-cu12==11.4.5.107" "nvidia-cusparse-cu12==12.1.0.106" "nvidia-nccl-cu12==2.21.5" "nvidia-nvtx-cu12==12.1.105"
OK=$(python -c "import torch;print(torch.__version__.startswith('2.5.1') and torch.cuda.is_available())" 2>/dev/null)
if [ "$OK" != "True" ]; then
  echo "Instalando torch 2.5.1+cu121 (el driver del T4 es CUDA 12.x)…"
  pip install -q --force-reinstall --no-deps torch==2.5.1 torchvision==0.20.1 triton==3.1.0 --index-url https://download.pytorch.org/whl/cu121
  pip install -q nvidia-cudnn-cu12==9.1.0.70 nvidia-cublas-cu12==12.1.3.1 nvidia-cuda-runtime-cu12==12.1.105 nvidia-cuda-nvrtc-cu12==12.1.105 2>/dev/null
fi
pip install -q -c /dli/task/constraints.txt "transformers>=4.51,<4.57" "peft>=0.15,<0.18" "accelerate>=1.3,<1.11" "datasets==4.0.0" sentencepiece
python - <<'PY'
import torch, transformers, peft
print("torch", torch.__version__, "cuda", torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "-")
print("transformers", transformers.__version__, "peft", peft.__version__)
assert torch.cuda.is_available(), "SIN GPU"
PY
[ $? -ne 0 ] && { echo "❌ ENTORNO ROTO: manda captura de este log"; exit 1; }
echo "=== $(date -Iseconds) ENTRENANDO HERMES v2 (≈80-90 min en T4) ==="
python train_lora.py --data data_v2 --epochs 2 --bs 2 --grad_acc 8 --out out/quickcoti-lora-v2
[ $? -ne 0 ] && { echo "❌ FALLÓ EL ENTRENAMIENTO"; exit 1; }
echo "=== $(date -Iseconds) EMPAQUETANDO ==="
nvidia-smi > nvidia_smi_v2.txt 2>&1
tar czf /dli/task/HERMES_V2_ENTREGA.tar.gz out/quickcoti-lora-v2 data_v2/REPORTE_DATOS_LLM.json log_llm_v2.txt nvidia_smi_v2.txt
ls -lh /dli/task/HERMES_V2_ENTREGA.tar.gz
echo "✅ LISTO: descarga /dli/task/HERMES_V2_ENTREGA.tar.gz"
} > "$LOG" 2>&1 &
echo "▶️ Arrancó en segundo plano. Para ver el avance:  tail -5 $LOG"
