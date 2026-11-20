"""Une fuentes YOLO, re-mapea clases por NOMBRE, deduplica (hash perceptual) y divide 70/15/15 SIN fugas.
Uso:
  python prepare_yolo.py --sources raw/cord raw/sroie raw/mis_notas --reserved raw/reservadas --out dataset
Cada fuente: carpeta con images/ y labels/ (+ data.yaml si viene de Roboflow, para leer los nombres de clase).
--reserved: TUS fotos que nunca se entrenan → van completas a test (y las usas en la demo).
Genera dataset/data.yaml y docs de distribución en dataset/REPORTE_DATOS.md"""
import argparse
import json
import random
import shutil
from collections import Counter
from pathlib import Path

import yaml
from PIL import Image

try:
    import imagehash
except ImportError:
    imagehash = None

CLASSES = ["proveedor", "fecha", "renglon", "total", "folio", "nota_impresa", "nota_manuscrita"]
# nombre en la fuente (minúsculas, contiene) → nuestra clase. None = descartar.
NAME_MAP = [("manuscrit", "nota_manuscrita"), ("handwrit", "nota_manuscrita"), ("nota_impresa", "nota_impresa"),
            ("receipt", "nota_impresa"), ("invoice", "nota_impresa"), ("ticket", "nota_impresa"),
            ("proveedor", "proveedor"), ("company", "proveedor"), ("store", "proveedor"), ("vendor", "proveedor"), ("shop", "proveedor"),
            ("fecha", "fecha"), ("date", "fecha"), ("renglon", "renglon"), ("item", "renglon"), ("menu", "renglon"), ("line", "renglon"),
            ("total", "total"), ("folio", "folio"), ("invoice_no", "folio"), ("number", "folio"),
            ("address", None), ("addr", None)]
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def class_names(src: Path):
    for y in list(src.glob("data.yaml")) + list(src.parent.glob("data.yaml")):
        d = yaml.safe_load(y.read_text())
        n = d.get("names")
        return list(n.values()) if isinstance(n, dict) else list(n)
    return CLASSES  # ya viene en nuestras clases (cord_to_yolo / tus etiquetas con nuestros nombres)


def map_name(name: str):
    n = name.lower().strip()
    if n in CLASSES:
        return CLASSES.index(n)
    for key, target in NAME_MAP:
        if key in n:
            return None if target is None else CLASSES.index(target)
    return None


def collect(src: Path):
    names = class_names(src)
    pairs = []
    for img in src.rglob("*"):
        if img.suffix.lower() not in IMG_EXT or "images" not in img.parts:
            continue
        lbl = Path(str(img.parent).replace("images", "labels")) / (img.stem + ".txt")
        if not lbl.exists():
            continue
        out = []
        for line in lbl.read_text().splitlines():
            p = line.split()
            if len(p) != 5:
                continue  # descarta polígonos/segmentación
            idx = int(p[0])
            c = map_name(names[idx]) if idx < len(names) else None
            if c is not None:
                out.append(" ".join([str(c)] + p[1:]))
        if out:
            pairs.append((img, out))
    return pairs


def phash(p: Path):
    if imagehash is None:
        return p.stem
    with Image.open(p) as im:
        return str(imagehash.phash(im.convert("L")))


def write(split, items, out: Path, stats):
    for img, labels in items:
        dst_name = f"{img.parent.parent.name}_{img.stem}"[:120]
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)
        shutil.copy(img, out / "images" / split / f"{dst_name}{img.suffix.lower()}")
        (out / "labels" / split / f"{dst_name}.txt").write_text("\n".join(labels) + "\n")
        for l in labels:
            stats[split][CLASSES[int(l.split()[0])]] += 1
        stats[split]["_imagenes"] += 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", nargs="+", required=True)
    ap.add_argument("--reserved", default=None)
    ap.add_argument("--out", default="dataset")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    out = Path(a.out)
    if out.exists():
        shutil.rmtree(out)
    random.seed(a.seed)

    pool = []
    for s in a.sources:
        got = collect(Path(s))
        print(f"{s}: {len(got)} imágenes con etiquetas útiles")
        pool += got
    reserved = collect(Path(a.reserved)) if a.reserved else []

    # Agrupa por hash perceptual: duplicados/variantes caen SIEMPRE en el mismo conjunto
    groups = {}
    for img, lab in pool:
        groups.setdefault(phash(img), []).append((img, lab))
    reserved_hashes = {phash(i) for i, _ in reserved}
    keys = [k for k in groups if k not in reserved_hashes]
    dropped = len(groups) - len(keys)
    random.shuffle(keys)
    n = len(keys)
    tr, va = keys[:int(.70 * n)], keys[int(.70 * n):int(.85 * n)]
    te = keys[int(.85 * n):]
    stats = {s: Counter() for s in ("train", "val", "test")}
    write("train", [x for k in tr for x in groups[k]], out, stats)
    write("val", [x for k in va for x in groups[k]], out, stats)
    write("test", [x for k in te for x in groups[k]] + reserved, out, stats)

    (out / "data.yaml").write_text(yaml.safe_dump({"path": str(out.resolve()), "train": "images/train", "val": "images/val",
                                                   "test": "images/test", "names": {i: c for i, c in enumerate(CLASSES)}},
                                                  allow_unicode=True, sort_keys=False))
    rep = ["# Distribución de datos de visión", "", f"Grupos únicos (tras deduplicar): {n}. Descartados por parecerse a reservadas: {dropped}.",
           f"Reservadas propias (solo test): {len(reserved)}.", "", "| clase | train | val | test |", "|---|---|---|---|"]
    for c in ["_imagenes"] + CLASSES:
        rep.append(f"| {c} | {stats['train'][c]} | {stats['val'][c]} | {stats['test'][c]} |")
    (out / "REPORTE_DATOS.md").write_text("\n".join(rep) + "\n")
    print("\n".join(rep))
    print(json.dumps({"data_yaml": str(out / 'data.yaml')}))


if __name__ == "__main__":
    main()
