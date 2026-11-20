"""Detector de zonas de notas/tickets (YOLO entrenado por el equipo). Acepta .engine (TensorRT), .onnx o .pt."""
import os
from typing import Dict, Any, List

CLASSES = ["proveedor", "fecha", "renglon", "total", "folio", "nota_impresa", "nota_manuscrita"]
WEIGHTS = os.getenv("VISION_WEIGHTS", "../models/quickcoti_vision.engine")
MOCK = os.getenv("MOCK_MODE", "0") == "1"
MIN_CONF = float(os.getenv("VISION_MIN_CONF", "0.25"))

_model = None


def _load():
    global _model
    if _model is None:
        from ultralytics import YOLO
        if not os.path.exists(WEIGHTS):
            raise FileNotFoundError(f"No encuentro los pesos de visión en {WEIGHTS}")
        _model = YOLO(WEIGHTS, task="detect")
    return _model


def model_label() -> str:
    return "MOCK (sin modelo)" if MOCK else os.path.basename(WEIGHTS)


def detect(image_path: str) -> Dict[str, Any]:
    if MOCK:
        return {"status": "ok", "doc_type": "manuscrito", "model": model_label(), "boxes": [
            {"label": "nota_manuscrita", "confidence": 0.9, "bbox": [0.05, 0.05, 0.9, 0.9]},
            {"label": "proveedor", "confidence": 0.82, "bbox": [0.1, 0.08, 0.5, 0.08]},
            {"label": "fecha", "confidence": 0.7, "bbox": [0.62, 0.08, 0.3, 0.06]},
            {"label": "renglon", "confidence": 0.75, "bbox": [0.1, 0.25, 0.8, 0.07]},
            {"label": "renglon", "confidence": 0.71, "bbox": [0.1, 0.33, 0.8, 0.07]},
            {"label": "total", "confidence": 0.86, "bbox": [0.5, 0.8, 0.4, 0.08]}]}
    model = _load()
    r = model.predict(image_path, conf=MIN_CONF, verbose=False)[0]
    h, w = r.orig_shape
    boxes: List[Dict[str, Any]] = []
    for b in r.boxes:
        x1, y1, x2, y2 = [float(v) for v in b.xyxy[0].tolist()]
        boxes.append({"label": CLASSES[int(b.cls)], "confidence": round(float(b.conf), 3),
                      "bbox": [x1 / w, y1 / h, (x2 - x1) / w, (y2 - y1) / h]})
    doc = [b for b in boxes if b["label"].startswith("nota_")]
    doc_type = "desconocido"
    if doc:
        best = max(doc, key=lambda b: b["confidence"])
        doc_type = "manuscrito" if best["label"] == "nota_manuscrita" else "impreso"
    fields = [b for b in boxes if not b["label"].startswith("nota_")]
    if not fields:
        return {"status": "unreadable", "doc_type": doc_type, "boxes": boxes, "model": model_label(),
                "message": "No encontré datos en la foto. Intenta con más luz y la nota completa en cuadro."}
    return {"status": "ok", "doc_type": doc_type, "boxes": boxes, "model": model_label()}
