"""Genera el dataset SINTÉTICO (declararlo así en la ficha) para ajustar el asistente. Revisa a mano 30 ejemplos al azar.
Tareas: T1 entrevista→BusinessProfile, T2 texto OCR ruidoso→JSON de compra, T3 asistente (explicar, confirmar, fuera de alcance).
Uso: python build_llm_dataset.py --out data --seed 7   → data/train.jsonl, data/val.jsonl, data/test.jsonl"""
import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from prompts import INTERVIEW_SYSTEM, STRUCTURE_SYSTEM, ASSISTANT_SYSTEM  # noqa: E402

KB = json.loads((Path(__file__).resolve().parents[2] / "backend" / "knowledge_base_ley.json").read_text(encoding="utf-8"))
R = random.Random()

# ───────────── T1: giros ─────────────
GIROS = [
    # giro, ejemplos de nombre, revende, a_medida, anticipos, term(item, items, stock, purchase, sale), proveedores, unidades
    ("tienda_abarrotes", ["Abarrotes Doña Lupe", "Miscelánea El Güero", "Tiendita La Esperanza"], True, False, False,
     ("Producto", "Productos", "Existencias", "Surtido", "Venta"), ["Bimbo", "Coca-Cola", "Sabritas", "Lala", "Marinela"], ["pieza", "paquete", "caja"]),
    ("herreria", ["Herrería Hermanos Ruiz", "Taller de Herrería San José"], False, True, True,
     ("Material", "Materiales", "Material en taller", "Compra de material", "Trabajo"), ["Aceros del Valle", "Ferretería Juárez"], ["pieza", "metro", "kilo"]),
    ("fonda", ["Fonda Doña Mary", "Cocina Económica La Abuela"], True, False, False,
     ("Insumo", "Insumos", "Despensa", "Compra de insumos", "Comida"), ["Central de Abasto", "Pollería El Gallo"], ["kilo", "pieza", "litro"]),
    ("papeleria", ["Papelería El Lápiz", "Papelería y Copias Estrella"], True, False, False,
     ("Artículo", "Artículos", "Existencias", "Surtido", "Venta"), ["Office Depot", "Distribuidora Scribe"], ["pieza", "paquete"]),
    ("carpinteria", ["Carpintería Don Toño", "Muebles Artesanales Mitla"], False, True, True,
     ("Material", "Materiales", "Material", "Compra de madera", "Trabajo"), ["Maderería del Sur"], ["pieza", "tabla", "metro"]),
    ("taller_mecanico", ["Taller Mecánico El Chino", "Servicio Automotriz Oaxaca"], True, True, True,
     ("Refacción", "Refacciones", "Refacciones en stock", "Compra de refacciones", "Servicio"), ["Refaccionaria Zapata"], ["pieza", "litro"]),
    ("estetica", ["Estética Glamour", "Barbería Los Compas"], True, False, False,
     ("Producto", "Productos", "Existencias", "Compra", "Servicio"), ["Distribuidora Belleza"], ["pieza"]),
    ("tortilleria", ["Tortillería La Guelaguetza", "Tortillería Doña Chuy"], True, False, False,
     ("Insumo", "Insumos", "Inventario", "Compra de maíz", "Venta"), ["Maseca", "Molino San Juan"], ["kilo", "bulto"]),
    ("puesto_mercado", ["Frutas y Verduras Lupita", "Puesto de Chiles El Oaxaqueño"], True, False, False,
     ("Producto", "Productos", "Mercancía", "Compra", "Venta"), ["Central de Abasto"], ["kilo", "caja", "pieza"]),
    ("costura", ["Costuras y Arreglos Rosy", "Sastrería Elegante"], False, True, True,
     ("Material", "Materiales", "Material", "Compra de tela", "Trabajo"), ["Telas Parisina"], ["metro", "pieza"]),
]
PAGOS = {"efectivo": ["efectivo", "en billete", "cash"], "tarjeta": ["con tarjeta", "terminal", "tarjeta"],
         "transferencia": ["transferencia", "SPEI", "me depositan"], "codi": ["CoDi", "con QR del banco"]}
Q = ["¡Hola! Soy Hermes. ¿Cómo se llama tu negocio y a qué te dedicas?",
     "¿Compras mercancía a proveedores para volver a venderla?",
     "¿Haces trabajos a la medida o das cotizaciones antes de cobrar?",
     "¿Te pagan por adelantado una parte (anticipo)?",
     "¿Cómo te pagan tus clientes? (efectivo, tarjeta, transferencia, CoDi)"]


def say_yes_no(v, tema):
    si = ["sí", "simón", "sí, siempre", "a veces sí", "claro"]
    no = ["no", "nel", "no, nada de eso", "casi nunca, no"]
    base = R.choice(si if v else no)
    return base + (f", {tema}" if v and R.random() < 0.5 else "")


def interview_examples():
    out = []
    for giro, nombres, rev, med, ant, term, provs, units in GIROS:
        for _ in range(7):
            name = R.choice(nombres)
            pays = R.sample(list(PAGOS), R.randint(1, 3))
            if "efectivo" not in pays and R.random() < 0.7:
                pays.append("efectivo")
            mis_prov = R.sample(provs, min(len(provs), R.randint(1, 2))) if rev or med else []
            desc = giro.replace("_", " ")
            ans = [f"{name}, {R.choice(['es una', 'tengo una', 'somos una'])} {desc}" if R.random() < .8 else f"{name}",
                   say_yes_no(rev, "me surte " + " y ".join(mis_prov) if mis_prov else ""),
                   say_yes_no(med, "todo es sobre pedido"),
                   say_yes_no(ant, "la mitad"),
                   ", ".join(R.choice(PAGOS[p]) for p in pays)]
            vague = R.random() < 0.15  # respuesta vaga en el giro → missing_info
            if vague:
                ans[0] = R.choice(["pues vendo de todo un poco", "un negocito", "de todo"])
            hist = []
            gid = f"T1-{giro}-{_}-{R.random():.6f}"
            for k in range(len(Q)):
                hist_k = list(hist)
                out.append({"task": "T1", "group": gid, "messages": [{"role": "system", "content": INTERVIEW_SYSTEM}] + hist_k +
                            ([{"role": "user", "content": "Hola"}] if not hist_k else []) +
                            [{"role": "assistant", "content": json.dumps({"done": False, "next_question": Q[k]}, ensure_ascii=False)}]})
                hist = hist + ([{"role": "user", "content": "Hola"}] if not hist else []) + \
                    [{"role": "assistant", "content": json.dumps({"done": False, "next_question": Q[k]}, ensure_ascii=False)},
                     {"role": "user", "content": ans[k]}]
            modes = (["supplier_ticket_photo", "handwritten_note_photo"] if rev else ["handwritten_note_photo"]) + (["voice"] if med else []) + ["manual"]
            prof = {"schema_version": 1, "business_name": name, "giro": "otro" if vague else giro,
                    "modules": {"sales": True, "purchases": True, "inventory": rev, "quotes": med, "deposits": ant},
                    "intake_modes": modes,
                    "terminology": dict(zip(["item", "items", "stock", "purchase", "sale"], term)),
                    "payment_methods": sorted(set(pays)), "suppliers": mis_prov, "digital_only_sector": False,
                    "units": units, "missing_info": ["giro del negocio"] if vague else []}
            out.append({"task": "T1", "group": gid, "messages": [{"role": "system", "content": INTERVIEW_SYSTEM}] + hist +
                        [{"role": "assistant", "content": json.dumps({"done": True, "profile": prof}, ensure_ascii=False)}]})
    return out


# ───────────── T2: OCR ruidoso → JSON ─────────────
CATALOGO = {
    "Bimbo": [("Pan blanco grande", 42), ("Pan integral", 48), ("Mantecadas", 20), ("Gansito", 17), ("Roles canela", 25), ("Medias noches", 38)],
    "Coca-Cola": [("Coca-Cola 600 ml", 18), ("Coca-Cola 2 L", 38), ("Sprite 600 ml", 16), ("Ciel 1 L", 11), ("Fanta 600 ml", 16)],
    "Sabritas": [("Sabritas sal 45 g", 17), ("Doritos nacho", 18), ("Ruffles queso", 18), ("Cheetos", 14)],
    "Lala": [("Leche entera 1 L", 28), ("Yogurt fresa", 14), ("Crema 200 ml", 22)],
    "Ferretería Juárez": [("Ángulo 1 pulg", 185), ("Solera 1/4", 120), ("Electrodo 6013 kg", 95), ("Disco de corte", 35), ("Pintura anticorrosiva L", 160)],
    "Central de Abasto": [("Jitomate kg", 24), ("Cebolla kg", 22), ("Chile de agua kg", 60), ("Aguacate kg", 70)],
}
ABREV = {"Pan blanco grande": "PAN BCO GDE", "Coca-Cola 600 ml": "COCA 600", "Coca-Cola 2 L": "COCA 2LT", "Sabritas sal 45 g": "SAB SAL 45G",
         "Leche entera 1 L": "LECHE ENT 1L", "Electrodo 6013 kg": "ELECT 6013", "Pintura anticorrosiva L": "PINT ANTICORR"}


def noisy(s, rate):
    sw = {"0": "O", "1": "l", "5": "S", "8": "B", "O": "0", "l": "1"}
    return "".join(sw[c] if c in sw and R.random() < rate else c for c in s)


def ocr_examples(n=320):
    out = []
    for _ in range(n):
        prov = R.choice(list(CATALOGO))
        manus = R.random() < 0.45
        k = R.randint(1, 5)
        items = []
        for name, price in R.sample(CATALOGO[prov], min(k, len(CATALOGO[prov]))):
            qty = R.choice([1, 2, 3, 4, 5, 6, 10, 12, 24])
            items.append({"name": name, "qty": qty, "unit_cost": float(price)})
        total = round(sum(i["qty"] * i["unit_cost"] for i in items), 2)
        rate = 0.12 if manus else 0.04
        lines, missing, conf_items = [], [], []
        for it in items:
            label = it["name"].lower() if manus else ABREV.get(it["name"], it["name"].upper())
            imp = it["qty"] * it["unit_cost"]
            fmt = R.choice(["{q} {n} {a:.2f}", "{q} {n} ${a:.0f}", "{q}x {n} {a:.2f}"]) if not manus else R.choice(["{q} {n} ${a:.0f}", "{q} {n} - {a:.0f}"])
            lines.append(noisy(fmt.format(q=it["qty"], n=label, a=imp), rate))
        illegible = manus and R.random() < 0.2
        if illegible:
            j = R.randrange(len(lines))
            lines[j] = "".join(R.choice("~-.,;") if R.random() < 0.6 else c for c in lines[j])
            missing.append(f"renglón ilegible: «{lines[j]}»")
        sin_total = R.random() < 0.12
        zones = {"proveedor": [noisy(prov.upper() if not manus else prov, rate)] if R.random() > 0.1 else [],
                 "fecha": [f"{R.randint(1, 28):02d}/11/2026"] if R.random() > 0.2 else [],
                 "renglon": lines, "total": [] if sin_total else [noisy(f"TOTAL ${total:.2f}", rate)]}
        tgt_items = []
        for i, it in enumerate(items):
            if illegible and missing and lines[i] in missing[0]:
                continue
            tgt_items.append({**it, "confidence": round(0.65 if manus else 0.9, 2)})
        if not zones["proveedor"]:
            missing.append("proveedor")
        if sin_total:
            missing.append("total")
        date = None
        if zones["fecha"]:
            d = zones["fecha"][0].split("/")
            date = f"2026-11-{d[0]}"
        target = {"supplier": {"value": prov if zones["proveedor"] else None, "confidence": 0.9 if zones["proveedor"] else 0.0},
                  "date": {"value": date, "confidence": 0.8 if date else 0.0},
                  "items": tgt_items, "total": None if sin_total else total, "missing": missing}
        user = json.dumps({"tipo_documento": "manuscrito" if manus else "impreso", "zonas_ocr": zones, "productos_conocidos": []}, ensure_ascii=False)
        out.append({"task": "T2", "messages": [{"role": "system", "content": STRUCTURE_SYSTEM}, {"role": "user", "content": user},
                                               {"role": "assistant", "content": json.dumps(target, ensure_ascii=False)}]})
    return out


# ───────────── T3: asistente ─────────────
def kb(topic_kw):
    return next(d for d in KB if topic_kw.lower() in d["topic"].lower())


def wrap(query, ctx, profile, snap, answer):
    c = "\n".join(f"- [{d['source']}] {d['content']}" for d in ctx) or "(sin contexto legal relevante)"
    user = (f"CONTEXTO LEGAL:\n{c}\n\nPERFIL DEL NEGOCIO: {json.dumps(profile, ensure_ascii=False)}\n"
            f"DATOS DEL NEGOCIO: {json.dumps(snap, ensure_ascii=False)}\n\nPREGUNTA: {query}")
    return {"task": "T3", "messages": [{"role": "system", "content": ASSISTANT_SYSTEM}, {"role": "user", "content": user},
                                       {"role": "assistant", "content": answer}]}


def assistant_examples(n=220):
    out = []
    efect = kb("efectivo")
    medios = kb("Medios de pago")
    margen = kb("margen")
    for _ in range(n):
        g = R.choice(GIROS)
        prof = {"business_name": R.choice(g[1]), "giro": g[0], "inventory": g[2]}
        ventas, compras = R.randint(300, 4000), R.randint(100, 3000)
        ef = R.randint(0, ventas)
        snap = {"ventas_hoy": ventas, "compras_hoy": compras, "ventas_efectivo": ef, "ventas_digitales": ventas - ef}
        kind = R.choices(["ganancia", "efectivo_ley", "medios", "confirmar", "fuera", "faltan", "stock", "margen"], [3, 2, 1, 2, 2, 1, 1, 1])[0]
        if kind == "ganancia":
            q = R.choice(["¿cuánto gané hoy?", "¿cómo me fue hoy?", "¿me quedó algo hoy?"])
            d = ventas - compras
            a = (f"Hoy vendiste ${ventas:,} y compraste ${compras:,}. "
                 + (f"Te quedan ${d:,} antes de otros gastos." if d >= 0 else f"Gastaste ${-d:,} más de lo que vendiste; puede ser normal si hoy surtiste."))
            out.append(wrap(q, [], prof, snap, a))
        elif kind == "efectivo_ley":
            q = R.choice(["si se cae el internet ¿puedo cobrar en efectivo?", "¿ya es ilegal recibir efectivo?", "¿me pueden multar por aceptar efectivo?"])
            a = ("No de forma general. La ley no elimina el efectivo de golpe: la SHCP irá definiendo qué sectores deben cobrar solo con medios digitales, "
                 "y si falla el sistema de pagos o la conexión se permite cobrar en efectivo o cheque de forma temporal. "
                 "En la app, ese cobro queda marcado como 'efectivo por contingencia'. "
                 f"(Fuente: {efect['source']})")
            out.append(wrap(q, [efect], prof, snap, a))
        elif kind == "medios":
            q = R.choice(["¿qué cuenta como pago digital?", "¿CoDi cuenta como pago digital?"])
            a = f"Según la ley, cuentan tarjetas de débito y crédito, transferencias (SPEI), domiciliaciones, códigos QR como CoDi y DiMo, y pagos sin contacto (NFC). (Fuente: {medios['source']})"
            out.append(wrap(q, [medios], prof, snap, a))
        elif kind == "confirmar":
            it = R.choice([p for v in CATALOGO.values() for p, _ in v])
            nq = R.choice([5, 10, 24, 100])
            q = R.choice([f"registra {nq} {it}", f"agrega {nq} de {it} al inventario", f"borra la venta de ayer"])
            a = f"CONFIRMAR: Voy a {'registrar ' + str(nq) + ' de ' + it if 'borra' not in q else 'borrar la venta de ayer'}. ¿Lo confirmas? Revisa la cantidad antes de aceptar."
            out.append(wrap(q, [], prof, snap, a))
        elif kind == "fuera":
            q = R.choice(["¿qué acciones me recomiendas comprar?", "¿quién gana el partido hoy?", "escríbeme un poema", "¿me das el teléfono de mi proveedor?"])
            a = "FUERA_DE_ALCANCE: Eso no lo puedo resolver. Te ayudo con las ventas, compras, inventario y cobros de tu negocio, o con cómo usar la app."
            out.append(wrap(q, [], prof, snap, a))
        elif kind == "faltan":
            q = R.choice(["¿cuánto le gano a cada pan?", "¿cuál es mi margen del refresco?"])
            a = "Para calcularlo necesito el precio al que lo vendes. ¿Me dices cuánto cobras por pieza? El costo ya lo tengo de tu última compra."
            out.append(wrap(q, [margen], prof, {"ventas_hoy": ventas}, a))
        elif kind == "stock" and g[2]:
            it = R.choice(CATALOGO["Bimbo"])[0]
            s = R.randint(0, 8)
            snap2 = {**snap, "existencias": {it: s}}
            q = f"¿cuánto {it} me queda?"
            a = f"Te quedan {s} de {it}." + (" Ya casi se te acaba; considera pedir en tu próximo surtido." if s <= 2 else "")
            out.append(wrap(q, [], prof, snap2, a))
        elif kind == "margen":
            costo, precio = R.randint(10, 40), 0
            precio = costo + R.randint(2, 15)
            q = f"si compro a ${costo} y vendo a ${precio}, ¿cuánto margen tengo?"
            m = round((precio - costo) / precio * 100, 1)
            a = f"Tu margen es de {m}%: ganas ${precio - costo} por pieza, que es ({precio} - {costo}) / {precio}. (Fuente: {margen['source']})"
            out.append(wrap(q, [margen], prof, snap, a))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data")
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    R.seed(a.seed)
    data = interview_examples() + ocr_examples() + assistant_examples()
    # dedupe exacto
    seen, uniq = set(), []
    for d in data:
        k = json.dumps(d["messages"][1:], ensure_ascii=False)
        if k not in seen:
            seen.add(k)
            uniq.append(d)
    # división por grupo: los prefijos de una misma entrevista nunca quedan en conjuntos distintos
    groups = {}
    for i, d in enumerate(uniq):
        groups.setdefault(d.get("group", f"g{i}"), []).append(d)
    keys = list(groups)
    R.shuffle(keys)
    n = len(uniq)
    g = len(keys)
    pick = lambda ks: [d for k in ks for d in groups[k]]
    splits = {"train": pick(keys[:int(.8 * g)]), "val": pick(keys[int(.8 * g):int(.9 * g)]), "test": pick(keys[int(.9 * g):])}
    out = Path(a.out)
    out.mkdir(exist_ok=True)
    for s, rows in splits.items():
        with (out / f"{s}.jsonl").open("w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps({**r, "synthetic": True}, ensure_ascii=False) + "\n")
    from collections import Counter
    rep = {s: dict(Counter(r["task"] for r in rows)) for s, rows in splits.items()}
    (out / "REPORTE_DATOS_LLM.json").write_text(json.dumps({"total": n, "por_conjunto": rep, "sintetico": True}, indent=2, ensure_ascii=False))
    print(json.dumps(rep, indent=2))


if __name__ == "__main__":
    main()
