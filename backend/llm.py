"""Cliente del LLM ajustado (servido por QVAC con API compatible con OpenAI) + respaldos deterministas en MOCK_MODE."""
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None

from prompts import INTERVIEW_SYSTEM, STRUCTURE_SYSTEM, ASSISTANT_SYSTEM

MOCK = os.getenv("MOCK_MODE", "0") == "1"
BASE_URL = os.getenv("QVAC_BASE_URL", "http://127.0.0.1:11435/v1")
MODEL = os.getenv("QVAC_MODEL", "quickcoti-qwen3-1.7b-lora")
TIMEOUT = float(os.getenv("LLM_TIMEOUT", "40"))

_client = None
if not MOCK and OpenAI is not None:
    _client = OpenAI(base_url=BASE_URL, api_key=os.getenv("QVAC_API_KEY", "local"), timeout=TIMEOUT)


class LLMError(Exception):
    pass


def model_label() -> str:
    return "MOCK (sin modelo)" if MOCK else MODEL


def extract_json(text: str) -> Dict[str, Any]:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise LLMError("El modelo no devolvió JSON.")
    return json.loads(text[start:end + 1])


def chat(system: str, messages: List[Dict[str, str]], temperature: float = 0.2, max_tokens: int = 700) -> str:
    if _client is None:
        raise LLMError("No hay conexión con el modelo (QVAC). Revisa que el servidor esté encendido.")
    try:
        r = _client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": system}] + messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except Exception as e:  # red, timeout, servidor caído
        raise LLMError(f"No pude hablar con el modelo: {e.__class__.__name__}")
    return r.choices[0].message.content or ""


def chat_json(system: str, messages: List[Dict[str, str]], **kw) -> Dict[str, Any]:
    out = chat(system, messages, **kw)
    try:
        return extract_json(out)
    except (LLMError, json.JSONDecodeError):
        retry = messages + [{"role": "assistant", "content": out},
                            {"role": "user", "content": "Tu respuesta no fue JSON válido. Responde SOLO el JSON."}]
        return extract_json(chat(system, retry, **kw))


# ───────────────────────────── Entrevista ─────────────────────────────
MOCK_QUESTIONS = [
    "¡Hola! Soy Hermes. ¿Cómo se llama tu negocio y a qué se dedica?",
    "¿Compras mercancía a proveedores para revenderla? (por ejemplo Bimbo, Coca-Cola)",
    "¿Haces trabajos a la medida o das cotizaciones antes de cobrar?",
    "¿Cómo te pagan tus clientes? (efectivo, tarjeta, transferencia, CoDi)",
]


def mock_profile(history: List[Dict[str, str]]) -> Dict[str, Any]:
    t = " ".join(h["content"].lower() for h in history if h["role"] == "user")
    herreria = any(w in t for w in ["herrer", "soldad", "taller", "carpinter", "a la medida", "medida"])
    revende = any(w in t for w in ["tienda", "tiendita", "abarrote", "bimbo", "coca", "sabritas", "revend", "miscel"]) and "no compro" not in t
    pays = [p for p, ks in {"efectivo": ["efectivo"], "tarjeta": ["tarjeta"], "codi": ["codi"], "transferencia": ["transfer", "spei"]}.items()
            if any(k in t for k in ks)] or ["efectivo"]
    first = next((h["content"] for h in history if h["role"] == "user"), "Mi negocio")
    name = first.split(",")[0].split(" y ")[0][:40].strip().capitalize() or "Mi negocio"
    if herreria and not revende:
        return {"business_name": name, "giro": "herreria",
                "modules": {"sales": True, "purchases": True, "inventory": False, "quotes": True, "deposits": True},
                "intake_modes": ["voice", "handwritten_note_photo", "manual"],
                "terminology": {"item": "Material", "items": "Materiales", "stock": "Material en taller", "purchase": "Compra de material", "sale": "Trabajo"},
                "payment_methods": pays, "suppliers": [], "units": ["pieza", "metro", "kilo"], "missing_info": []}
    return {"business_name": name, "giro": "tienda_abarrotes" if revende else "otro",
            "modules": {"sales": True, "purchases": True, "inventory": revende, "quotes": False, "deposits": False},
            "intake_modes": ["supplier_ticket_photo", "handwritten_note_photo", "manual"],
            "terminology": {"item": "Producto", "items": "Productos", "stock": "Existencias", "purchase": "Surtido", "sale": "Venta"},
            "payment_methods": pays, "suppliers": [s for s in ["Bimbo", "Coca-Cola", "Sabritas", "Lala"] if s.lower() in t],
            "units": ["pieza", "paquete", "caja"], "missing_info": []}


def interview(history: List[Dict[str, str]]) -> Dict[str, Any]:
    user_turns = sum(1 for h in history if h["role"] == "user")
    if MOCK:
        if user_turns < len(MOCK_QUESTIONS):
            return {"done": False, "next_question": MOCK_QUESTIONS[user_turns]}
        return {"done": True, "profile": mock_profile(history)}
    msgs = list(history) or [{"role": "user", "content": "Hola, quiero configurar mi negocio."}]
    if user_turns >= 6:
        msgs = msgs + [{"role": "user", "content": "Ya no hay más preguntas. Genera el perfil final ahora (done=true)."}]
    return chat_json(INTERVIEW_SYSTEM, msgs, temperature=0.3)


# ─────────────────────── Estructurar texto OCR ───────────────────────
LINE_RE = re.compile(r"^\s*(\d+(?:[.,]\d+)?)\s*(?:x|pz|pzs|pza|cj|caja|cajas|paq)?\.?\s+(.+?)\s+\$?\s*(\d+(?:[.,]\d{1,2})?)\s*$", re.I)


def _num(s: str) -> float:
    return float(s.replace(",", ".").replace("O", "0").replace("o", "0"))


def mock_structure(zones: Dict[str, List[str]]) -> Dict[str, Any]:
    items, missing = [], []
    for line in zones.get("renglon", []):
        m = LINE_RE.match(line.replace("$", " $").strip())
        if m:
            qty, name, amount = _num(m.group(1)), m.group(2).strip(), _num(m.group(3))
            unit = round(amount / qty, 2) if qty else amount
            items.append({"name": name.title(), "qty": qty, "unit_cost": unit, "confidence": 0.6})
        else:
            missing.append(f"renglón ilegible: «{line}»")
    total = None
    for t in zones.get("total", []):
        nums = re.findall(r"\d+(?:[.,]\d{1,2})?", t)
        if nums:
            total = _num(nums[-1])
    if total is None:
        missing.append("total")
    sup = (zones.get("proveedor") or [None])[0]
    date = (zones.get("fecha") or [None])[0]
    return {"supplier": {"value": sup, "confidence": 0.6 if sup else 0.0},
            "date": {"value": date, "confidence": 0.5 if date else 0.0},
            "items": items, "total": total, "missing": missing + ([] if sup else ["proveedor"])}


def structure(zones: Dict[str, List[str]], doc_type: str, known_products: List[str]) -> Dict[str, Any]:
    if MOCK:
        return mock_structure(zones)
    payload = {"tipo_documento": doc_type, "zonas_ocr": zones, "productos_conocidos": known_products[:60]}
    return chat_json(STRUCTURE_SYSTEM, [{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}], temperature=0.0)


# ───────────────────────────── Asistente ─────────────────────────────
def assistant(query: str, context_legal: List[Dict[str, str]], profile: Optional[Dict], snapshot: Optional[Dict]) -> str:
    if MOCK:
        q = query.lower()
        if any(w in q for w in ["registra", "borra", "agrega", "cambia"]):
            return "CONFIRMAR: Voy a hacer ese cambio en tus registros. ¿Lo confirmas?"
        if context_legal:
            c = context_legal[0]
            return f"{c['content']} (Fuente: {c['source']})"
        return "FUERA_DE_ALCANCE: Solo puedo ayudarte con tu negocio y con la app."
    ctx = "\n".join(f"- [{c['source']}] {c['content']}" for c in context_legal) or "(sin contexto legal relevante)"
    user = (f"CONTEXTO LEGAL:\n{ctx}\n\nPERFIL DEL NEGOCIO: {json.dumps(profile or {}, ensure_ascii=False)}\n"
            f"DATOS DEL NEGOCIO: {json.dumps(snapshot or {}, ensure_ascii=False)}\n\nPREGUNTA: {query}")
    return chat(ASSISTANT_SYSTEM, [{"role": "user", "content": user}], temperature=0.3, max_tokens=400).strip()
