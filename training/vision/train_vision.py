"""Entrenamiento OFICIAL del detector (correr en el servidor NVIDIA del concurso). Guarda registro completo para la sección 14-C.
Uso:  python train_vision.py --data dataset/data.yaml --epochs 60 --imgsz 960 --batch 16
Salida: runs/quickcoti/<nombre>/ (pesos, curvas) + REGISTRO_VISION.json + ejemplos/ (aciertos y errores) + exportes TensorRT/ONNX."""
import argparse
import datetime as dt
import json
import platform
import shutil
import subprocess
import time
from pathlib import Path


def sh(cmd):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30).stdout.strip()
    except Exception as e:
        return str(e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="dataset/data.yaml")
    ap.add_argument("--base", default="yolo11n.pt", help="Modelo base preentrenado (Ultralytics, AGPL-3.0). yolov8n.pt también sirve.")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--imgsz", type=int, default=960)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--name", default="oficial")
    ap.add_argument("--allow-cpu", action="store_true")
    a = ap.parse_args()

    import torch
    from ultralytics import YOLO

    if not torch.cuda.is_available() and not a.allow_cpu:
        raise SystemExit("❌ No hay GPU CUDA visible para torch. Revisa nvidia-smi y reinstala torch para tu versión de CUDA "
                         "(ej. pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121). "
                         "Usa --allow-cpu solo para pruebas.")
    log = {"inicio": dt.datetime.now().isoformat(timespec="seconds"), "host": platform.node(),
           "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
           "cuda_torch": torch.version.cuda, "nvidia_smi": sh("nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader"),
           "modelo_base": a.base, "parametros": vars(a)}
    t0 = time.time()
    model = YOLO(a.base)
    res = model.train(data=a.data, epochs=a.epochs, imgsz=a.imgsz, batch=a.batch, device=0 if torch.cuda.is_available() else "cpu",
                      project="runs/quickcoti", name=a.name, exist_ok=True, patience=20, seed=42,
                      degrees=8, perspective=0.0005, hsv_v=0.5, fliplr=0.0, mosaic=0.5)
    save_dir = Path(res.save_dir)
    best = save_dir / "weights" / "best.pt"
    log["duracion_entrenamiento_min"] = round((time.time() - t0) / 60, 1)

    tuned = YOLO(str(best))
    m = tuned.val(data=a.data, split="test", imgsz=a.imgsz, device=0 if torch.cuda.is_available() else "cpu", plots=True,
                  project="runs/quickcoti", name=a.name + "_test", exist_ok=True)
    names = tuned.names
    log["test"] = {"mAP50": round(float(m.box.map50), 4), "mAP50_95": round(float(m.box.map), 4),
                   "precision": round(float(m.box.mp), 4), "recall": round(float(m.box.mr), 4),
                   "mAP50_por_clase": {names[int(c)]: round(float(v), 4) for c, v in zip(m.box.ap_class_index, m.box.ap50)}}

    # Comparación con el modelo base: COCO no tiene estas clases → no es comparable por clase; se documenta.
    log["comparacion_base"] = ("El modelo base (COCO) no contiene las clases proveedor/fecha/renglon/total/folio/nota_*; "
                               "no puede evaluarse en la misma tarea. Se reporta su salida cualitativa en ejemplos/base_*.jpg.")

    # Ejemplos: predicciones en test (para elegir aciertos y errores a mano)
    test_imgs = sorted((Path(a.data).parent / "images" / "test").glob("*"))[:24]
    ex = Path("ejemplos")
    ex.mkdir(exist_ok=True)
    for i, p in enumerate(test_imgs):
        tuned.predict(str(p), imgsz=a.imgsz, conf=0.25, save=True, project=str(ex), name="ajustado", exist_ok=True, verbose=False)
        if i < 6:
            YOLO(a.base).predict(str(p), conf=0.25, save=True, project=str(ex), name="base", exist_ok=True, verbose=False)

    # Herramienta NVIDIA: TensorRT FP16
    exports = {}
    if torch.cuda.is_available():
        t1 = time.time()
        try:
            exports["tensorrt_fp16"] = str(tuned.export(format="engine", half=True, imgsz=a.imgsz, device=0))
            exports["tensorrt_min"] = round((time.time() - t1) / 60, 1)
        except Exception as e:
            exports["tensorrt_error"] = str(e)
    exports["onnx"] = str(tuned.export(format="onnx", imgsz=a.imgsz, simplify=True))
    log["exportes"] = exports

    # Latencia PyTorch vs TensorRT (evidencia de contribución técnica de NVIDIA)
    if test_imgs:
        def bench(w):
            mm = YOLO(w, task="detect")
            mm.predict(str(test_imgs[0]), imgsz=a.imgsz, verbose=False)
            t = time.time()
            for p in test_imgs[:20]:
                mm.predict(str(p), imgsz=a.imgsz, verbose=False)
            return round((time.time() - t) / min(20, len(test_imgs)) * 1000, 1)
        log["latencia_ms"] = {"pytorch": bench(str(best))}
        if "tensorrt_fp16" in exports:
            log["latencia_ms"]["tensorrt_fp16"] = bench(exports["tensorrt_fp16"])

    log["fin"] = dt.datetime.now().isoformat(timespec="seconds")
    log["epocas_ejecutadas"] = a.epochs
    log["pesos"] = str(best)
    Path("REGISTRO_VISION.json").write_text(json.dumps(log, indent=2, ensure_ascii=False))
    shutil.copy("REGISTRO_VISION.json", save_dir / "REGISTRO_VISION.json")
    print(json.dumps(log, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
