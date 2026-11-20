"""Convierte data/{train,val}.jsonl al formato SFT de QVAC (una línea = {"messages":[...]}). Uso: python to_qvac_dataset.py"""
import json
from pathlib import Path
for split in ("train", "val"):
    out = Path("qvac_data") / split
    out.mkdir(parents=True, exist_ok=True)
    with open(f"data/{split}.jsonl", encoding="utf-8") as f, open(out / f"{split}.jsonl", "w", encoding="utf-8") as g:
        n = 0
        for line in f:
            g.write(json.dumps({"messages": json.loads(line)["messages"]}, ensure_ascii=False) + "\n"); n += 1
    print(split, n, "→", out)
