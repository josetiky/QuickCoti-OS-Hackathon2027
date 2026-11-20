"""QuickCoti OS — backend del hackathon. Ejecuta:  MOCK_MODE=1 uvicorn main:app --host 0.0.0.0 --port 8000"""
import hashlib
import os
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, RedirectResponse

import llm
import rag
import vision
import payments_mp
from schemas import (AssistantRequest, AssistantResponse, BusinessProfile, CoDiRequest, DetectResponse,
                     InterviewRequest, InterviewResponse, StructureRequest, StructureResponse)

app = FastAPI(title="QuickCoti OS API", version="1.0.0")
app.include_router(payments_mp.router)
MAX_BYTES = 12 * 1024 * 1024


def sha256_of(path: str) -> str:
    p = Path(path)
    if not p.exists():
        return "no-encontrado"
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


@app.get("/api/v1/health")
def health():
    """Evidencia para el jurado: qué pesos está usando la app (hash = el del paquete de entrenamiento)."""
    return {"status": "ok", "mock_mode": llm.MOCK, "mercado_pago": payments_mp.mode(),
            "vision": {"file": vision.model_label(), "sha256": sha256_of(vision.WEIGHTS)},
            "llm": {"model": llm.model_label(), "base_url": llm.BASE_URL,
                    "lora_sha256": sha256_of(os.getenv("LORA_ADAPTER", "../models/quickcoti-lora.gguf"))}}


@app.post("/api/v1/agent/interview", response_model=InterviewResponse)
def interview(req: InterviewRequest):
    history = [t.model_dump() for t in req.history]
    try:
        out = llm.interview(history)
    except llm.LLMError as e:
        return InterviewResponse(done=False, model=llm.model_label(), error=str(e))
    except Exception:
        return InterviewResponse(done=False, model=llm.model_label(), error="No entendí la respuesta del modelo. Intenta de nuevo.")
    if out.get("done"):
        try:
            profile = BusinessProfile(**(out.get("profile") or {}))
        except Exception:
            return InterviewResponse(done=False, model=llm.model_label(),
                                     next_question="Perdón, no me quedó claro. ¿Me cuentas otra vez a qué se dedica tu negocio?")
        profile.modules.sales = profile.modules.purchases = True  # núcleo siempre activo
        return InterviewResponse(done=True, profile=profile, model=llm.model_label())
    return InterviewResponse(done=False, next_question=out.get("next_question") or "¿Me cuentas un poco más?", model=llm.model_label())


@app.post("/api/v1/vision/detect", response_model=DetectResponse)
async def detect(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "El archivo no es una imagen.")
    tmp = Path(tempfile.gettempdir()) / f"qc_{uuid.uuid4().hex}.jpg"
    try:
        with tmp.open("wb") as f:
            shutil.copyfileobj(file.file, f)
        if tmp.stat().st_size > MAX_BYTES:
            raise HTTPException(413, "La foto es muy pesada (máx. 12 MB).")
        try:
            return vision.detect(str(tmp))
        except FileNotFoundError as e:
            raise HTTPException(503, str(e))
        except Exception:
            return DetectResponse(status="unreadable", doc_type="desconocido", boxes=[], model=vision.model_label(),
                                  message="No pude procesar la imagen. Intenta con otra foto.")
    finally:
        tmp.unlink(missing_ok=True)


@app.post("/api/v1/receipt/structure", response_model=StructureResponse)
def structure(req: StructureRequest):
    if not any(req.zones.values()):
        return StructureResponse(status="unreadable", supplier={}, date={}, items=[], missing=["todo"], model=llm.model_label())
    try:
        out = llm.structure(req.zones, req.doc_type, req.known_products)
    except llm.LLMError as e:
        raise HTTPException(503, str(e))
    except Exception:
        out = llm.mock_structure(req.zones)  # respaldo determinista, se marca en model
        out["_fallback"] = True
    items = []
    for it in out.get("items") or []:
        try:
            items.append({"name": str(it["name"]), "qty": float(it.get("qty") or 0), "unit_cost": float(it.get("unit_cost") or 0),
                          "confidence": float(it.get("confidence", 0.5))})
        except (KeyError, TypeError, ValueError):
            continue
    total = out.get("total")
    total = float(total) if isinstance(total, (int, float)) else None
    s = round(sum(i["qty"] * i["unit_cost"] for i in items), 2)
    matches = total is not None and abs(s - total) <= max(1.0, 0.02 * total)
    missing = list(out.get("missing") or [])
    low = any(i["confidence"] < 0.6 for i in items)
    status = "ok" if (matches and not missing and not low and items) else ("unreadable" if not items and total is None else "needs_review")
    model = llm.model_label() + (" + respaldo reglas" if out.get("_fallback") else "")
    return StructureResponse(status=status, supplier=out.get("supplier") or {}, date=out.get("date") or {},
                             items=items, total=total, sum_items_matches_total=matches, missing=missing, model=model)


@app.post("/api/v1/assistant/chat", response_model=AssistantResponse)
def assistant(req: AssistantRequest):
    if not req.query.strip():
        raise HTTPException(400, "Escribe una pregunta.")
    ctx = rag.retrieve(req.query)
    try:
        text = llm.assistant(req.query, ctx, req.profile.model_dump() if req.profile else None, req.business_snapshot)
    except llm.LLMError as e:
        raise HTTPException(503, str(e))
    confirm = text.startswith("CONFIRMAR:")
    oos = text.startswith("FUERA_DE_ALCANCE:")
    clean = text.split(":", 1)[1].strip() if (confirm or oos) else text
    return AssistantResponse(answer=clean, needs_confirmation=confirm, out_of_scope=oos,
                             sources=sorted({c["source"] for c in ctx}), model=llm.model_label())


@app.post("/api/v1/payments/codi-qr")
def codi_qr(req: CoDiRequest):
    """SIMULADO: no hay conexión con Banxico/CoDi. Se identifica como simulación (sección 11 de las bases)."""
    if req.amount <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0.")
    ref = f"QC{uuid.uuid4().hex[:8].upper()}"
    return {"is_simulated": True, "status": "pending", "reference": ref, "amount": round(req.amount, 2), "currency": "MXN",
            "qr_string": f"SIMULADO|CODI|{ref}|{req.amount:.2f}|MXN|{req.description[:30]}",
            "notice": "SIMULADO — sin conexión a Banxico. No se mueve dinero."}


@app.exception_handler(Exception)
async def unhandled(_, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor. Intenta de nuevo."})
