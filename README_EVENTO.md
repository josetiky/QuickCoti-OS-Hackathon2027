# QuickCoti OS — comandos del evento (en orden)

## 1. Servidor NVIDIA: preparar (≈15 min)
```bash
# sube la carpeta evento/ al servidor (scp, Jupyter upload o git)
cd evento/training/vision
nvidia-smi                                   # anota GPU y versión de CUDA
python -c "import torch;print(torch.__version__, torch.version.cuda, torch.cuda.is_available())"
# Si sale False o CUDA ≠ driver:  pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121   (cu124/cu126 según driver)
apt-get update && apt-get install -y libgl1 libglib2.0-0 || true
pip install -r requirements.txt
```

## 2. Datos de visión (≈20 min + tu etiquetado)
```bash
python cord_to_yolo.py --out raw/cord --max 800              # CORD-v2 → nuestras clases (renglon, total, nota_impresa)
# SROIE: en Roboflow (samias-workspace/sroie_yolo) → Download → YOLOv8 → descomprime en raw/sroie
# Tus notas a mano: proyecto Roboflow con clases EXACTAS: proveedor fecha renglon total folio nota_impresa nota_manuscrita
#   export YOLOv8 → raw/mis_notas        Las 10 reservadas (nunca entrenan) → raw/reservadas (mismo formato)
python prepare_yolo.py --sources raw/cord raw/sroie raw/mis_notas --reserved raw/reservadas --out dataset
cat dataset/REPORTE_DATOS.md
```

## 3. Entrenamiento OFICIAL de visión (déjalo corriendo)
```bash
nohup python train_vision.py --data dataset/data.yaml --epochs 60 --imgsz 960 --batch 16 > log_vision.txt 2>&1 &
tail -f log_vision.txt
```
Si la GPU tiene poca memoria: `--batch 8 --imgsz 640`.

## 4. Entrenamiento OFICIAL del asistente (en paralelo si hay GPU libre, si no, después)
```bash
cd ../llm && pip install -r requirements.txt
python build_llm_dataset.py --out data          # sintético; revisa 30 ejemplos al azar: shuf -n 30 data/train.jsonl
nohup python train_lora.py --data data --base Qwen/Qwen3-1.7B --epochs 2 --out out/quickcoti-lora > log_llm.txt 2>&1 &
```

## 5. Evaluar y exportar
```bash
python eval_assistant.py --adapter out/quickcoti-lora --out EVAL_ASISTENTE.md
./export_gguf.sh                                 # → evento/models/*.gguf + SHA256SUMS.txt
# visión: los exportes quedan en training/vision/runs/quickcoti/oficial/weights/ (best.engine, best.onnx) + REGISTRO_VISION.json
```
Copia a tu Mac en `evento/models/`: `best.onnx` → `quickcoti_vision.onnx`, `quickcoti-merged-q8_0.gguf`, `quickcoti-lora.gguf`, los REGISTRO_*.json y EVAL_ASISTENTE.md.
(.engine de TensorRT solo corre en GPU NVIDIA: úsalo si el backend corre en el servidor; en la Mac usa el .onnx exportado del MISMO best.pt.)

## 6. Mac: levantar todo
```bash
cd evento/backend
./iniciar_mock.command        # para desarrollar la app sin modelos (MOCK)
./iniciar_qvac.command        # modelo ajustado vía QVAC en :11435
./iniciar_real.command        # backend con modelos reales
curl http://localhost:8000/api/v1/health      # muestra hashes de los pesos = evidencia
```
iPhone y Mac en la misma red (o hotspot del iPhone). En la app: Ajustes → Servidor → `http://IP_DE_TU_MAC:8000`.

---
## ⚡ Versión React Native + QVAC (la que se presenta)
- App: `evento/app-rn/README.md`.
- Ajuste del asistente CON QVAC (preferido, en el servidor NVIDIA):
```bash
cd evento/training/llm
python build_llm_dataset.py --out data && python to_qvac_dataset.py
npm i @qvac/sdk && vulkaninfo | head -5        # QVAC entrena con Vulkan sobre la GPU NVIDIA
node qvac_finetune.mjs                          # → out/qvac-lora/*.gguf + out/REGISTRO_QVAC_FINETUNE.json
cp out/qvac-lora/*.gguf ../../models/quickcoti-lora.gguf
```
Si no hay Vulkan en el servidor: `train_lora.py` (PEFT/CUDA) + `export_gguf.sh` → usa `models/quickcoti-lora.gguf`.
- Visión: igual que arriba (pasos 2–3); copia `best.onnx` a `evento/models/quickcoti_vision.onnx` (export con el mismo `--imgsz` que usa la app: 960).
