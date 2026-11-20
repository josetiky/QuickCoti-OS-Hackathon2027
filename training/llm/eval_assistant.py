"""Evaluación comparativa BASE vs AJUSTADO en las MISMAS condiciones (mismo system prompt, temperatura 0, mismos casos).
Usa data/test.jsonl + casos_reservados.jsonl (10+ casos escritos a mano, nunca vistos en entrenamiento).
Uso: python eval_assistant.py --base Qwen/Qwen3-1.7B --adapter out/quickcoti-lora --out EVAL_ASISTENTE.md"""
import argparse
import json
import re
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def jparse(t):
    t = re.sub(r"<think>.*?</think>", "", t, flags=re.S)
    s, e = t.find("{"), t.rfind("}")
    try:
        return json.loads(t[s:e + 1]) if s != -1 else None
    except Exception:
        return None


def num(v):
    try:
        return float(str(v).replace("$", "").replace(",", "").strip())
    except Exception:
        return 0.0


def score(case, out):
    try:
        return _score(case, out)
    except Exception:
        return {"json_valido": 1 if jparse(out) is not None else 0, "acierto": 0}


def _score(case, out):
    task, exp = case["task"], case["messages"][-1]["content"]
    if task == "T1":
        o, x = jparse(out), json.loads(exp)
        if o is None:
            return {"json_valido": 0, "acierto": 0}
        if not x["done"]:
            return {"json_valido": 1, "acierto": int(o.get("done") is False and bool(o.get("next_question")))}
        om, xm = (o.get("profile") or {}).get("modules", {}), x["profile"]["modules"]
        return {"json_valido": 1, "acierto": int(all(om.get(k) == v for k, v in xm.items()))}
    if task == "T2":
        o, x = jparse(out), json.loads(exp)
        if o is None:
            return {"json_valido": 0, "acierto": 0}
        tot_ok = (o.get("total") == x.get("total")) or (isinstance(o.get("total"), (int, float)) and x.get("total") and abs(o["total"] - x["total"]) < 1)
        q = sorted(round(num(i.get("qty")) * num(i.get("unit_cost")), 1) for i in (o.get("items") or []) if isinstance(i, dict))
        e = sorted(round(i["qty"] * i["unit_cost"], 1) for i in x["items"])
        return {"json_valido": 1, "acierto": int(bool(tot_ok) and q == e)}
    # T3: comportamiento
    want_conf, want_oos = exp.startswith("CONFIRMAR:"), exp.startswith("FUERA_DE_ALCANCE:")
    got_conf, got_oos = out.strip().startswith("CONFIRMAR:"), out.strip().startswith("FUERA_DE_ALCANCE:")
    cites = ("Fuente" in exp) <= ("Fuente" in out or "fuente" in out)
    return {"json_valido": None, "acierto": int(want_conf == got_conf and want_oos == got_oos and cites)}


def generate(model, tok, msgs):
    p = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    ids = tok(p, return_tensors="pt").to(model.device)
    with torch.no_grad():
        o = model.generate(**ids, max_new_tokens=400, do_sample=False, pad_token_id=tok.eos_token_id)
    return tok.decode(o[0][ids["input_ids"].shape[1]:], skip_special_tokens=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen3-1.7B")
    ap.add_argument("--adapter", default="out/quickcoti-lora")
    ap.add_argument("--test", default="data/test.jsonl")
    ap.add_argument("--reserved", default="casos_reservados.jsonl")
    ap.add_argument("--n", type=int, default=60, help="máximo de casos de test.jsonl (además de todos los reservados)")
    ap.add_argument("--out", default="EVAL_ASISTENTE.md")
    a = ap.parse_args()
    raw = Path(a.out).with_suffix(".raw.json")  # un caché por reporte (v1, v2…)
    if raw.exists():
        res = json.loads(raw.read_text(encoding="utf-8")); print("usando generaciones guardadas", raw, flush=True)
        return report(res, a)
    tok = AutoTokenizer.from_pretrained(a.base)
    dev = {"": 0} if torch.cuda.is_available() else ({"": "mps"} if torch.backends.mps.is_available() else {"": "cpu"})
    base = AutoModelForCausalLM.from_pretrained(a.base, torch_dtype=torch.float16, device_map=dev)
    print("dispositivo:", dev, flush=True)
    cases = [json.loads(l) for l in open(a.test, encoding="utf-8")][:a.n]
    reserved = [json.loads(l) for rp in a.reserved.split(",") if Path(rp).exists() for l in open(rp, encoding="utf-8")]
    for r in reserved:
        r["reservado"] = True
    allc = reserved + cases
    res = []
    for c in allc:
        res.append({"c": c, "base": generate(base, tok, c["messages"][:-1])}); print("base", len(res), "/", len(allc), flush=True)
    tuned = PeftModel.from_pretrained(base, a.adapter)
    for r in res:
        r["ajustado"] = generate(tuned, tok, r["c"]["messages"][:-1]); print("ajustado ok", flush=True)
    raw.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    report(res, a)


def report(res, a):
    rows, agg = [], {}
    for r in res:
        sb, sa = score(r["c"], r["base"]), score(r["c"], r["ajustado"])
        t = r["c"]["task"] + (" (reservado)" if r["c"].get("reservado") else "")
        g = agg.setdefault(r["c"]["task"], {"n": 0, "base": 0, "ajustado": 0, "json_b": 0, "json_a": 0})
        g["n"] += 1; g["base"] += sb["acierto"]; g["ajustado"] += sa["acierto"]
        g["json_b"] += sb["json_valido"] or 0; g["json_a"] += sa["json_valido"] or 0
        rows.append((t, r["c"]["messages"][-2]["content"][-160:].replace("\n", " "), sb["acierto"], sa["acierto"],
                     r["base"][:160].replace("\n", " "), r["ajustado"][:160].replace("\n", " ")))
    md = ["# Evaluación del asistente: base vs ajustado", "", f"Modelo base: `{a.base}` · Adaptador: `{a.adapter}` · temperatura 0 · mismo prompt de sistema", "",
          "| Tarea | Casos | Acierto base | Acierto ajustado | JSON válido base | JSON válido ajustado |", "|---|---|---|---|---|---|"]
    for k, g in agg.items():
        md.append(f"| {k} | {g['n']} | {g['base']}/{g['n']} | {g['ajustado']}/{g['n']} | {g['json_b']} | {g['json_a']} |")
    md += ["", "Criterios: T1 = módulos del perfil correctos (o pregunta válida si falta info). T2 = total y renglones correctos. "
           "T3 = pide confirmación / reconoce fuera de alcance / cita fuente cuando corresponde.", "",
           "## Casos (los reservados primero)", "", "| Tarea | Entrada (final) | Base | Ajustado | Salida base | Salida ajustado |", "|---|---|---|---|---|---|"]
    md += [f"| {t} | {i} | {'✔︎' if b else '✘'} | {'✔︎' if s else '✘'} | {ob} | {oa} |" for t, i, b, s, ob, oa in rows]
    Path(a.out).write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md[:12]))


if __name__ == "__main__":
    main()
