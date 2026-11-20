"""Recuperación simple por palabras clave sobre knowledge_base_ley.json (sin dependencias pesadas)."""
import json
import re
import unicodedata
from pathlib import Path
from typing import List, Dict

DOCS: List[Dict[str, str]] = json.loads(Path(__file__).with_name("knowledge_base_ley.json").read_text(encoding="utf-8"))
STOP = set("de la el en y a que los las un una por para con del se es mi me lo al si no como qué que".split())


def _norm(s: str) -> List[str]:
    s = unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
    return [w for w in re.findall(r"[a-z0-9]+", s) if w not in STOP and len(w) > 2]


def retrieve(query: str, k: int = 2, min_score: int = 1) -> List[Dict[str, str]]:
    q = set(_norm(query))
    scored = []
    for d in DOCS:
        words = set(_norm(d["topic"] + " " + d["content"]))
        # coincidencia por prefijo de 5 letras para tolerar plurales/conjugaciones
        score = sum(1 for w in q if any(x.startswith(w[:5]) for x in words))
        scored.append((score, d))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [d for s, d in scored[:k] if s >= min_score]
