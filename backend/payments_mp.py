"""Cobro REAL celular a celular con Mercado Pago (Checkout Pro). El vendedor muestra un QR en su iPhone,
el cliente lo escanea con SU celular y paga (tarjeta, saldo MP, SPEI u OXXO). La app consulta el estado.
- Sandbox: MP_ACCESS_TOKEN=TEST-...  (bases §11 permiten entorno de prueba; se muestra solicitud, respuesta y estado)
- Producción: token APP_USR-... de tu cuenta (Mercado Pago cobra comisión por venta).
El token vive SOLO en la Mac (variable de entorno), nunca en la app ni en el repo."""
import os
import uuid
from typing import Any, Dict

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/payments/mp", tags=["Mercado Pago"])
API = "https://api.mercadopago.com"


def _token() -> str:
    t = os.getenv("MP_ACCESS_TOKEN", "")
    if not t:
        raise HTTPException(503, "Falta MP_ACCESS_TOKEN en la Mac. Crea credenciales de prueba en mercadopago.com.mx/developers.")
    return t


def mode() -> str:
    return "sandbox" if os.getenv("MP_ACCESS_TOKEN", "").startswith("TEST-") else ("produccion" if os.getenv("MP_ACCESS_TOKEN") else "sin_configurar")


class CreateReq(BaseModel):
    concept: str
    amount: float
    business_name: str = "QuickCoti"


@router.post("/create")
async def create(req: CreateReq) -> Dict[str, Any]:
    if req.amount <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0.")
    ref = f"QC-{uuid.uuid4().hex[:10].upper()}"
    body = {
        "items": [{"title": req.concept[:60] or "Venta", "quantity": 1, "unit_price": round(req.amount, 2), "currency_id": "MXN"}],
        "external_reference": ref,
        "statement_descriptor": req.business_name[:22],
        "payment_methods": {"installments": 1},
    }
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(f"{API}/checkout/preferences", json=body,
                             headers={"Authorization": f"Bearer {_token()}", "X-Idempotency-Key": ref})
    except httpx.HTTPError:
        raise HTTPException(503, "No hay conexión con Mercado Pago. Usa efectivo por contingencia.")
    if r.status_code >= 300:
        raise HTTPException(502, f"Mercado Pago rechazó la solicitud ({r.status_code}): {r.text[:200]}")
    d = r.json()
    url = d.get("sandbox_init_point") if mode() == "sandbox" else d.get("init_point")
    return {"reference": ref, "preference_id": d.get("id"), "pay_url": url or d.get("init_point"), "mode": mode(),
            "request": body, "response_status": r.status_code}


@router.get("/status/{ref}")
async def status(ref: str) -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{API}/v1/payments/search", params={"external_reference": ref, "sort": "date_created", "criteria": "desc"},
                            headers={"Authorization": f"Bearer {_token()}"})
    except httpx.HTTPError:
        raise HTTPException(503, "Sin conexión con Mercado Pago para consultar el pago.")
    if r.status_code >= 300:
        raise HTTPException(502, f"Error al consultar Mercado Pago ({r.status_code}).")
    res = r.json().get("results", [])
    if not res:
        return {"reference": ref, "status": "pending", "detail": "Esperando a que el cliente pague…", "mode": mode()}
    p = res[0]
    return {"reference": ref, "status": p.get("status"), "detail": p.get("status_detail"), "payment_id": p.get("id"),
            "method": p.get("payment_method_id"), "amount": p.get("transaction_amount"),
            "fee": sum(f.get("amount", 0) for f in p.get("fee_details", [])), "net": (p.get("transaction_details") or {}).get("net_received_amount"),
            "mode": mode()}
