"""Convierte CORD-v2 (Hugging Face: naver-clova-ix/cord-v2, licencia CC-BY-4.0) a YOLO con NUESTRAS clases.
Uso:  python cord_to_yolo.py --out raw/cord --max 1000
Clases: 2 renglon (cada renglón de producto), 3 total, 5 nota_impresa (todo el ticket)."""
import argparse
import json
from collections import defaultdict
from pathlib import Path

from datasets import load_dataset

CLS = {"renglon": 2, "total": 3, "nota_impresa": 5}


def quad_box(words):
    xs = [w["quad"][k] for w in words for k in ("x1", "x2", "x3", "x4")]
    ys = [w["quad"][k] for w in words for k in ("y1", "y2", "y3", "y4")]
    return min(xs), min(ys), max(xs), max(ys)


def to_yolo(b, W, H):
    x1, y1, x2, y2 = max(0, b[0]), max(0, b[1]), min(W, b[2]), min(H, b[3])
    if x2 <= x1 or y2 <= y1:
        return None
    return f"{(x1 + x2) / 2 / W:.6f} {(y1 + y2) / 2 / H:.6f} {(x2 - x1) / W:.6f} {(y2 - y1) / H:.6f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="raw/cord")
    ap.add_argument("--max", type=int, default=1000)
    a = ap.parse_args()
    out = Path(a.out)
    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "labels").mkdir(parents=True, exist_ok=True)
    n = 0
    for split in ("train", "validation", "test"):
        for i, ex in enumerate(load_dataset("naver-clova-ix/cord-v2", split=split)):
            if n >= a.max:
                break
            gt = json.loads(ex["ground_truth"])
            img = ex["image"].convert("RGB")
            W, H = img.size
            rows, totals, allw = defaultdict(list), [], []
            for line in gt.get("valid_line", []):
                cat, words = line.get("category", ""), line.get("words", [])
                if not words:
                    continue
                allw += words
                if cat.startswith("menu."):
                    rows[line.get("group_id", id(line))] += words
                elif cat in ("total.total_price", "total.total_etc"):
                    totals += words
            lines = []
            for ws in rows.values():
                y = to_yolo(quad_box(ws), W, H)
                if y:
                    lines.append(f"{CLS['renglon']} {y}")
            if totals:
                y = to_yolo(quad_box(totals), W, H)
                if y:
                    lines.append(f"{CLS['total']} {y}")
            if allw:
                x1, y1, x2, y2 = quad_box(allw)
                pad = 0.02 * max(W, H)
                y = to_yolo((x1 - pad, y1 - pad, x2 + pad, y2 + pad), W, H)
                if y:
                    lines.append(f"{CLS['nota_impresa']} {y}")
            if not lines:
                continue
            name = f"cord_{split}_{i:04d}"
            img.save(out / "images" / f"{name}.jpg", quality=90)
            (out / "labels" / f"{name}.txt").write_text("\n".join(lines) + "\n")
            n += 1
    print(f"CORD convertidas: {n} imágenes → {out}")


if __name__ == "__main__":
    main()
