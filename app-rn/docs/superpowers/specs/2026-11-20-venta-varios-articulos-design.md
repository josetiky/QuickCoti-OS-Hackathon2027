# Venta con varios artículos — diseño corto (aprobado por Tiki)

## Por qué
Una venta real lleva varias cosas (2 pizzas y 1 refresco). Hoy Cobrar acepta un solo renglón.

## Metas
- "Qué cobras" = lista de renglones (artículo, cantidad con − y +, precio, importe, quitar) + "Agregar artículo". Reutiliza el editor de Cotizar (LineasEditor) con un modo de pasos.
- Fichas del inventario: tocar agrega el producto con su precio (precio o costo × 1.25); si ya está, suma 1.
- Total = suma de renglones; VoiceOver lo lee en pesos.
- Al cobrar: se descuenta cada producto del inventario; el ticket lista cada renglón y el total.
- Estadísticas cuentan por artículo; ventas viejas (un concepto) igual que antes.
- Cotizar → "Cobrar todo" llega con los renglones (+ cargos) y el cliente; el anticipo sigue siendo un renglón.

## No-metas
No cambian reglas, bitácora (se guarda el resumen como concepto) ni métodos de pago.

## Anti-metas
Inventario descontado dos veces o negativo; total distinto a la suma de renglones; ventas viejas rotas.
