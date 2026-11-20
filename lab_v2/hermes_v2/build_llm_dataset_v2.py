"""Dataset SINTÉTICO v2 de Hermes (declararlo así en la ficha). Extiende el v1 con:
  · T1: rentas (mobiliario para fiestas, ropa, equipo, cuartos) y entregas a domicilio → modules.rentals / modules.delivery
  · T3: preguntas sobre rentas vencidas, depósitos, entregas pendientes y cotizaciones de varios conceptos
  · T2 (tickets OCR) se conserva del v1 para que no se olvide (evita "olvido catastrófico").
Uso: python3 build_llm_dataset_v2.py --out data_v2 --seed 11   (+ escribe casos_reservados_v2.jsonl, escritos a mano)"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import build_llm_dataset as v1  # reutiliza T2/T3 del v1 y su generador aleatorio
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from prompts import INTERVIEW_SYSTEM_V2, ASSISTANT_SYSTEM  # noqa: E402

R = v1.R
TERM = ["item", "items", "stock", "purchase", "sale"]

# giro, nombres, revende, a_medida, anticipos, P(renta), P(entrega), term, proveedores, unidades, qué renta (si aplica)
GIROS_V2 = [(*g[:5], 0.0, {"fonda": .5, "tienda_abarrotes": .3, "tortilleria": .3, "papeleria": .1, "puesto_mercado": .2}.get(g[0], 0.0), *g[5:], None)
            for g in v1.GIROS] + [
    ("renta_mobiliario", ["Renta de Sillas y Mesas Lupita", "Eventos y Brincolines El Chapulín", "Mobiliario para Fiestas La Calenda"], False, True, True, 1.0, 1.0,
     ("Artículo", "Mobiliario", "Mobiliario disponible", "Compra de mobiliario", "Renta"), ["Plásticos del Sur"], ["pieza", "juego"],
     ["sillas y mesas", "inflables y brincolines", "carpas, sillas y manteles", "mesas, sillas y loza"]),
    ("renta_vestidos", ["Vestidos de Gala Isabel", "Trajes y Smokings Elegance"], False, False, True, 1.0, 0.2,
     ("Prenda", "Prendas", "Prendas disponibles", "Compra de prendas", "Renta"), [], ["pieza"], ["vestidos de XV y de novia", "trajes y smokings"]),
    ("renta_maquinaria", ["Renta de Andamios Oaxaca", "Maquinaria Ligera Monte Albán"], False, True, True, 1.0, 0.8,
     ("Equipo", "Equipos", "Equipo disponible", "Compra de equipo", "Renta"), [], ["pieza", "día"], ["andamios y revolvedoras", "rotomartillos y compactadoras"]),
    ("renta_cuartos", ["Cuartos Doña Chela", "Departamentos Los Arcos"], False, False, True, 1.0, 0.0,
     ("Cuarto", "Cuartos", "Cuartos disponibles", "Gasto de mantenimiento", "Renta"), [], ["mes"], ["cuartos por mes", "departamentos amueblados"]),
    ("comida_domicilio", ["Pizzas El Horno de Leña", "Comida Corrida Mamá Tere", "Tlayudas Doña Rosa"], True, False, False, 0.0, 1.0,
     ("Insumo", "Insumos", "Despensa", "Compra de insumos", "Pedido"), ["Central de Abasto", "Lala"], ["kilo", "pieza"], None),
    ("agua_purificada", ["Purificadora La Gota", "Agua Cristal del Valle"], True, False, False, 0.0, 1.0,
     ("Garrafón", "Garrafones", "Garrafones llenos", "Compra de insumos", "Venta"), ["Tapas y Sellos del Sur"], ["garrafón"], None),
    ("farmacia", ["Farmacia San Judas", "Farmacia del Barrio"], True, False, False, 0.0, 0.6,
     ("Medicamento", "Medicamentos", "Existencias", "Surtido", "Venta"), ["Distribuidora Nadro"], ["caja", "pieza"], None),
]

Q2 = ["¡Hola! Soy Hermes. ¿Cómo se llama tu negocio y a qué te dedicas?",
      "¿Compras mercancía a proveedores para volver a venderla?",
      "¿Haces trabajos a la medida o das cotizaciones antes de cobrar?",
      "¿Te pagan por adelantado una parte (anticipo)?",
      "¿Rentas cosas a tus clientes que luego te regresan? (sillas, equipo, ropa, cuartos…)",
      "¿Haces entregas a domicilio?",
      "¿Cómo te pagan tus clientes? (efectivo, tarjeta, transferencia, CoDi)"]


def ans_renta(v, que):
    if v:
        return R.choice([f"sí, rento {que}", f"sí, {que} por día", "sí, cobro depósito y me lo regresan", f"claro, {que}", "sí, se rentan por evento"])
    return R.choice(["no", "no rento nada", "nel", "no, solo vendo", "no, eso no"])


def ans_entrega(v):
    if v:
        return R.choice(["sí, a domicilio", "sí, llevo los pedidos en moto", "sí, me piden por WhatsApp y lo llevo", "sí, cobro el envío aparte",
                         "sí, nosotros lo llevamos y lo instalamos", "a veces, si es cerca"])
    return R.choice(["no, vienen al local", "no", "solo en el local", "no, que pasen por ello"])


def interview_examples_v2(per_giro=6, p_prefix=0.45):
    out = []
    for giro, nombres, rev, med, ant, p_r, p_d, term, provs, units, que in GIROS_V2:
        for n in range(per_giro):
            name = R.choice(nombres)
            rent, deliv = R.random() < p_r, R.random() < p_d
            pays = R.sample(list(v1.PAGOS), R.randint(1, 3))
            if "efectivo" not in pays and R.random() < 0.7:
                pays.append("efectivo")
            mis_prov = R.sample(provs, min(len(provs), R.randint(1, 2))) if (rev or med) and provs else []
            desc = giro.replace("_", " ")
            ans = [f"{name}, {R.choice(['es una', 'tengo una', 'somos una', 'me dedico a la'])} {desc}" if R.random() < .8 else name,
                   v1.say_yes_no(rev, "me surte " + " y ".join(mis_prov) if (mis_prov and rev) else ""),
                   v1.say_yes_no(med, "cotizo según lo que pidan"),
                   v1.say_yes_no(ant, "la mitad"),
                   ans_renta(rent, R.choice(que) if que else "cosas"),
                   ans_entrega(deliv),
                   ", ".join(R.choice(v1.PAGOS[p]) for p in pays)]
            vague = R.random() < 0.12
            if vague:
                ans[0] = R.choice(["pues vendo de todo un poco", "un negocito", "de todo"])
            gid = f"T1v2-{giro}-{n}-{R.random():.6f}"
            hist = []
            for k in range(len(Q2)):
                if k == 0 or R.random() < p_prefix:  # no todos los prefijos: menos tokens, mismo aprendizaje
                    out.append({"task": "T1", "group": gid, "messages": [{"role": "system", "content": INTERVIEW_SYSTEM_V2}] + list(hist) +
                                ([{"role": "user", "content": "Hola"}] if not hist else []) +
                                [{"role": "assistant", "content": json.dumps({"done": False, "next_question": Q2[k]}, ensure_ascii=False)}]})
                hist = hist + ([{"role": "user", "content": "Hola"}] if not hist else []) + \
                    [{"role": "assistant", "content": json.dumps({"done": False, "next_question": Q2[k]}, ensure_ascii=False)},
                     {"role": "user", "content": ans[k]}]
            modes = (["supplier_ticket_photo", "handwritten_note_photo"] if rev else ["handwritten_note_photo"]) + (["voice"] if med else []) + ["manual"]
            prof = {"schema_version": 2, "business_name": name, "giro": "otro" if vague else giro,
                    "modules": {"sales": True, "purchases": True, "inventory": rev, "quotes": med, "deposits": ant or rent, "rentals": rent, "delivery": deliv},
                    "intake_modes": modes, "terminology": dict(zip(TERM, term)),
                    "payment_methods": sorted(set(pays)), "suppliers": mis_prov, "digital_only_sector": False,
                    "units": units, "missing_info": ["giro del negocio"] if vague else []}
            out.append({"task": "T1", "group": gid, "messages": [{"role": "system", "content": INTERVIEW_SYSTEM_V2}] + hist +
                        [{"role": "assistant", "content": json.dumps({"done": True, "profile": prof}, ensure_ascii=False)}]})
    return out


def wrap(q, prof, snap, a, ctx=()):
    return v1.wrap(q, list(ctx), prof, snap, a)


def assistant_examples_v2(n=160):
    out = []
    renta_g = [g for g in GIROS_V2 if g[5] > 0]
    entrega_g = [g for g in GIROS_V2 if g[6] > 0]
    clientes = ["Doña Mari", "Sr. López", "la señora Juana", "Pepe", "el salón Las Palmas", "Lic. Ramírez", "Toño", "Carmen"]
    for _ in range(n):
        kind = R.choices(["vencidas", "depositos", "entregas", "cotiza", "confirmar_renta", "confirmar_entrega", "sin_datos"], [3, 2, 3, 4, 2, 1, 1])[0]
        if kind in ("vencidas", "depositos", "cotiza", "confirmar_renta"):
            g = R.choice(renta_g)
        else:
            g = R.choice(entrega_g)
        prof = {"business_name": R.choice(g[1]), "giro": g[0], "inventory": g[2], "rentals": g[5] > 0, "delivery": g[6] > 0}
        ventas = R.randint(300, 6000)
        snap = {"ventas_hoy": ventas, "compras_hoy": R.randint(0, 1500)}
        if kind == "vencidas":
            act, ven = R.randint(0, 9), 0
            ven = R.randint(0, act)
            dep = R.choice([0, 300, 500, 1200, 2000]) * max(act, 1)
            snap.update({"rentas_activas": act, "rentas_vencidas": ven, "depositos_por_devolver": dep})
            q = R.choice(["¿qué rentas tengo vencidas?", "¿alguien no me ha regresado lo que rentó?", "¿cuántas rentas tengo fuera?"])
            a = (f"Tienes {act} renta(s) activa(s); {ven} ya debían regresar. Revísalas en la pestaña Rentas y llama a esos clientes." if ven
                 else f"Tienes {act} renta(s) activa(s) y ninguna está vencida.") if act else "No tienes rentas activas en este momento."
            out.append(wrap(q, prof, snap, a))
        elif kind == "depositos":
            act = R.randint(1, 8)
            dep = R.choice([300, 500, 800, 1500]) * act
            snap.update({"rentas_activas": act, "rentas_vencidas": 0, "depositos_por_devolver": dep})
            q = R.choice(["¿cuánto dinero de depósitos tengo que devolver?", "¿cuánto tengo en depósitos?"])
            a = f"Tienes ${dep:,} en depósitos de {act} renta(s) activa(s). Ese dinero no es ganancia: lo regresas cuando te devuelvan todo completo."
            out.append(wrap(q, prof, snap, a))
        elif kind == "entregas":
            pend, hoy = R.randint(0, 7), R.randint(0, 12)
            snap.update({"entregas_pendientes": pend, "entregas_hoy": hoy})
            q = R.choice(["¿cuántas entregas me faltan?", "¿qué pedidos tengo por llevar?", "¿cuántos pedidos entregué hoy?"])
            if "entregué" in q:
                a = f"Hoy entregaste {hoy} pedido(s) y te faltan {pend}."
            else:
                a = f"Te faltan {pend} entrega(s). Las ves en la pestaña Entregas, ordenadas de la más reciente." if pend else "No tienes entregas pendientes. ¡Todo entregado!"
            out.append(wrap(q, prof, snap, a))
        elif kind == "cotiza":
            cat = [("sillas", (8, 15)), ("mesas", (40, 80)), ("manteles", (15, 30)), ("inflable", (600, 1200)), ("carpa", (900, 2500)),
                   ("andamio", (80, 150)), ("revolvedora", (350, 600)), ("vestido de XV", (900, 2500)), ("traje", (450, 900))]
            k = R.randint(2, 4)
            lines = []
            for nom, (lo, hi) in R.sample(cat, k):
                qty = R.choice([1, 1, 2, 5, 10, 20, 50, 100]) if nom not in ("inflable", "carpa", "vestido de XV", "traje", "revolvedora") else R.choice([1, 1, 2])
                lines.append((qty, nom, R.randrange(lo, hi + 1, 5)))
            flete = R.choice([0, 0, 150, 250, 400])
            pedido = ", ".join(f"{q} {n} a ${p}" for q, n, p in lines) + (f" y ${flete} de flete" if flete else "")
            q = R.choice(["cotiza ", "¿cuánto sale ", "hazme la cuenta de "]) + pedido
            detalle = "; ".join(f"{qq} {n} × ${p:,} = ${qq * p:,}" for qq, n, p in lines)
            tot = sum(qq * p for qq, n, p in lines) + flete
            a = f"Serían: {detalle}" + (f"; flete ${flete:,}" if flete else "") + f". Total: ${tot:,}. Puedes guardarla en Cotizar y convertirla en renta."
            out.append(wrap(q, prof, snap, a))
        elif kind == "confirmar_renta":
            cli = R.choice(clientes)
            cosa = R.choice(g[10]) if g[10] else "el equipo"
            q = R.choice([f"registra la renta de {cosa} para {cli}", f"apunta que {cli} rentó {cosa}", f"marca como devuelta la renta de {cli}"])
            a = (f"CONFIRMAR: Voy a marcar como devuelta la renta de {cli}. ¿Lo confirmas? Antes revisa que te regresaron todo completo para devolver el depósito."
                 if "devuelta" in q else f"CONFIRMAR: Voy a registrar la renta de {cosa} para {cli}. ¿Lo confirmas? Te pediré el depósito y la fecha de devolución.")
            out.append(wrap(q, prof, snap, a))
        elif kind == "confirmar_entrega":
            cli = R.choice(clientes)
            q = R.choice([f"marca como entregado el pedido de {cli}", f"cancela la entrega de {cli}"])
            a = f"CONFIRMAR: Voy a {'cancelar la entrega' if 'cancela' in q else 'marcar como entregado el pedido'} de {cli}. ¿Lo confirmas?"
            out.append(wrap(q, prof, snap, a))
        else:  # sin datos de rentas/entregas en el snapshot → no inventar
            q = R.choice(["¿qué rentas tengo vencidas?", "¿cuántas entregas me faltan?"])
            a = "Todavía no tengo datos de eso. Activa el módulo en Ajustes o registra tu primera " + ("renta." if "rentas" in q else "entrega.")
            out.append(wrap(q, {k: v for k, v in prof.items() if k not in ("rentals", "delivery")}, snap, a))
    return out


# ───────────── Casos reservados v2 (escritos a mano, nombres y frases que NO están en el generador) ─────────────
def _t1(answers, profile):
    msgs = [{"role": "system", "content": INTERVIEW_SYSTEM_V2}, {"role": "user", "content": "Hola"}]
    for q, a in zip(Q2, answers):
        msgs += [{"role": "assistant", "content": json.dumps({"done": False, "next_question": q}, ensure_ascii=False)}, {"role": "user", "content": a}]
    prof = {"schema_version": 2, "digital_only_sector": False, "missing_info": [], **profile}
    return {"task": "T1", "messages": msgs + [{"role": "assistant", "content": json.dumps({"done": True, "profile": prof}, ensure_ascii=False)}]}


def _mod(inv, quo, dep, ren, deli):
    return {"sales": True, "purchases": True, "inventory": inv, "quotes": quo, "deposits": dep, "rentals": ren, "delivery": deli}


def reservados_v2():
    c = [
        _t1(["Fiestas Mágicas Tlacolula, rentamos todo para fiestas", "no, el mobiliario es mío", "sí, les paso presupuesto según el evento",
             "sí, el 30% para apartar la fecha", "sí: sillas tiffany, mesas redondas y un castillo inflable", "sí, lo llevamos y lo montamos", "efectivo y transferencia"],
            {"business_name": "Fiestas Mágicas Tlacolula", "giro": "renta_mobiliario", "modules": _mod(False, True, True, True, True),
             "intake_modes": ["handwritten_note_photo", "voice", "manual"], "terminology": {"item": "Artículo", "items": "Mobiliario", "stock": "Mobiliario disponible", "purchase": "Compra de mobiliario", "sale": "Renta"},
             "payment_methods": ["efectivo", "transferencia"], "suppliers": [], "units": ["pieza", "juego"]}),
        _t1(["Memelas y Antojitos La Soledad", "sí, compro masa, quesillo y frijol en el mercado", "no", "no", "no", "sí, por WhatsApp y los manda mi hijo en bici", "efectivo y con QR del banco"],
            {"business_name": "Memelas y Antojitos La Soledad", "giro": "comida_domicilio", "modules": _mod(True, False, False, False, True),
             "intake_modes": ["supplier_ticket_photo", "handwritten_note_photo", "manual"], "terminology": {"item": "Insumo", "items": "Insumos", "stock": "Despensa", "purchase": "Compra de insumos", "sale": "Pedido"},
             "payment_methods": ["codi", "efectivo"], "suppliers": [], "units": ["kilo", "pieza"]}),
        _t1(["Boutique Novias Oaxaca", "no", "no", "sí, dejan una parte al apartar", "sí, vestidos de novia por fin de semana y los regresan el lunes", "no, aquí se los prueban", "tarjeta y efectivo"],
            {"business_name": "Boutique Novias Oaxaca", "giro": "renta_vestidos", "modules": _mod(False, False, True, True, False),
             "intake_modes": ["handwritten_note_photo", "manual"], "terminology": {"item": "Prenda", "items": "Prendas", "stock": "Prendas disponibles", "purchase": "Compra de prendas", "sale": "Renta"},
             "payment_methods": ["efectivo", "tarjeta"], "suppliers": [], "units": ["pieza"]}),
        _t1(["Casa de Huéspedes San Felipe", "no", "no", "sí, un mes de depósito", "sí, cuartos para estudiantes", "no", "transferencia"],
            {"business_name": "Casa de Huéspedes San Felipe", "giro": "renta_cuartos", "modules": _mod(False, False, True, True, False),
             "intake_modes": ["handwritten_note_photo", "manual"], "terminology": {"item": "Cuarto", "items": "Cuartos", "stock": "Cuartos disponibles", "purchase": "Gasto de mantenimiento", "sale": "Renta"},
             "payment_methods": ["transferencia"], "suppliers": [], "units": ["mes"]}),
        _t1(["Abarrotes El Tule", "sí, me surten Bimbo y Coca", "no", "no", "no", "no, la gente viene a la tienda", "efectivo"],
            {"business_name": "Abarrotes El Tule", "giro": "tienda_abarrotes", "modules": _mod(True, False, False, False, False),
             "intake_modes": ["supplier_ticket_photo", "handwritten_note_photo", "manual"], "terminology": {"item": "Producto", "items": "Productos", "stock": "Existencias", "purchase": "Surtido", "sale": "Venta"},
             "payment_methods": ["efectivo"], "suppliers": ["Bimbo", "Coca-Cola"], "units": ["pieza", "paquete", "caja"]}),
        _t1(["Agua Purificada Xoxocotlán", "sí, compro tapas, sellos y garrafones", "no", "no", "no", "sí, repartimos garrafones en camioneta", "efectivo"],
            {"business_name": "Agua Purificada Xoxocotlán", "giro": "agua_purificada", "modules": _mod(True, False, False, False, True),
             "intake_modes": ["supplier_ticket_photo", "handwritten_note_photo", "manual"], "terminology": {"item": "Garrafón", "items": "Garrafones", "stock": "Garrafones llenos", "purchase": "Compra de insumos", "sale": "Venta"},
             "payment_methods": ["efectivo"], "suppliers": [], "units": ["garrafón"]}),
    ]
    # T1 a media entrevista: después del anticipo debe preguntar por rentas
    mid = _t1(["Lonas y Toldos Zaachila", "no", "sí, cotizo", "sí, la mitad"], {})["messages"][:2 + 2 * 4]
    c.append({"task": "T1", "messages": mid + [{"role": "assistant", "content": json.dumps({"done": False, "next_question": Q2[4]}, ensure_ascii=False)}]})
    pr = {"business_name": "Fiestas Mágicas Tlacolula", "giro": "renta_mobiliario", "inventory": False, "rentals": True, "delivery": True}
    c += [
        wrap("oye ¿quién no me ha devuelto las sillas?", pr, {"ventas_hoy": 900, "compras_hoy": 0, "rentas_activas": 5, "rentas_vencidas": 2, "depositos_por_devolver": 2500},
             "Tienes 5 renta(s) activa(s); 2 ya debían regresar. Revísalas en la pestaña Rentas y llama a esos clientes."),
        wrap("¿cuánto sale 80 sillas a $12, 10 mesas a $55 y $300 de flete?", pr, {"ventas_hoy": 0, "compras_hoy": 0},
             "Serían: 80 sillas × $12 = $960; 10 mesas × $55 = $550; flete $300. Total: $1,810. Puedes guardarla en Cotizar y convertirla en renta."),
        wrap("¿cuántos pedidos me faltan por llevar?", {"business_name": "Memelas y Antojitos La Soledad", "giro": "comida_domicilio", "inventory": True, "delivery": True},
             {"ventas_hoy": 1450, "compras_hoy": 300, "entregas_pendientes": 3, "entregas_hoy": 9},
             "Te faltan 3 entrega(s). Las ves en la pestaña Entregas, ordenadas de la más reciente."),
        wrap("apunta que la señora Eufemia rentó el castillo inflable", pr, {"ventas_hoy": 0, "compras_hoy": 0},
             "CONFIRMAR: Voy a registrar la renta del castillo inflable para la señora Eufemia. ¿Lo confirmas? Te pediré el depósito y la fecha de devolución."),
        wrap("¿el depósito cuenta como ganancia?", pr, {"ventas_hoy": 500, "compras_hoy": 0, "rentas_activas": 3, "rentas_vencidas": 0, "depositos_por_devolver": 1500},
             "No. Tienes $1,500 en depósitos de 3 renta(s) activa(s). Ese dinero no es ganancia: lo regresas cuando te devuelvan todo completo."),
    ]
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data_v2")
    ap.add_argument("--seed", type=int, default=11)
    a = ap.parse_args()
    R.seed(a.seed)
    data = interview_examples_v2() + v1.ocr_examples(240) + v1.assistant_examples(170) + assistant_examples_v2()
    seen, uniq = set(), []
    for d in data:
        k = json.dumps(d["messages"][1:], ensure_ascii=False)
        if k not in seen:
            seen.add(k); uniq.append(d)
    groups = {}
    for i, d in enumerate(uniq):
        groups.setdefault(d.get("group", f"g{i}"), []).append(d)
    keys = list(groups); R.shuffle(keys); g = len(keys)
    pick = lambda ks: [d for k in ks for d in groups[k]]
    splits = {"train": pick(keys[:int(.85 * g)]), "val": pick(keys[int(.85 * g):int(.92 * g)]), "test": pick(keys[int(.92 * g):])}
    out = Path(a.out); out.mkdir(exist_ok=True)
    for s, rows in splits.items():
        with (out / f"{s}.jsonl").open("w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps({**r, "synthetic": True}, ensure_ascii=False) + "\n")
    res = reservados_v2()
    with open("casos_reservados_v2.jsonl", "w", encoding="utf-8") as f:
        for r in res:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    rep = {s: dict(Counter(r["task"] for r in rows)) for s, rows in splits.items()}
    (out / "REPORTE_DATOS_LLM.json").write_text(json.dumps({"version": 2, "total": len(uniq), "por_conjunto": rep, "sintetico": True,
        "reservados_escritos_a_mano": len(res), "novedades": ["rentals", "delivery", "cotización de varios conceptos"]}, indent=2, ensure_ascii=False))
    print(json.dumps(rep, indent=2), "reservados:", len(res))


if __name__ == "__main__":
    main()
