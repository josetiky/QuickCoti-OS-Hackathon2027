# Impuestos, cotizaciones por cobrar, factura simulada y WhatsApp — diseño corto (aprobado por Tiki)

## Por qué
El dueño de un negocio pequeño necesita saber cuánto de lo que cobra le toca al SAT (IVA e ISR), no perder las
cotizaciones que se cobran después (anticipo y liquidación), facturar cuando el cliente lo pide y mandar el ticket
por WhatsApp. Todo en simulación donde haría falta un servicio real (timbrado del SAT).

## Metas
1. **Ventas pregunta primero.** El botón Ventas de Inicio abre «¿Qué vas a hacer?»:
   - Venta → Cobrar (como hoy). Suma a ganancias en cuanto se paga.
   - Cotización → Cotizar → «Guardar cotización» → queda en **Por cobrar**. No suma a ganancias.
2. **Por cobrar** (sección en Inicio + pantalla con la lista + detalle de cada cotización):
   - Saldo de cada cotización. Recibir anticipo (sugiere el % que se pidió) o cualquier pago ≤ saldo; cobrar lo que resta.
   - Cada pago abre Cobrar en modo cotización (monto fijo, renglones de la cotización a la vista) y se registra como
     venta normal: cuenta como ingreso el día que se cobra. Al llegar a $0 la cotización queda «pagada».
   - «¿Facturar después del pago?» Sí/No; compartir la cotización en PDF; mandarla por WhatsApp; cancelarla
     (lo ya cobrado se queda en ventas).
3. **Impuestos (estimación).** Ajustes → Impuestos: régimen RESICO (predeterminado) o «No calcular»; IVA de lo que
   vendes 16 % (predeterminado), 8 % frontera o 0 % alimentos básicos y medicinas. Precios con IVA incluido.
   - Estadísticas: IVA de ventas, IVA de compras, IVA a pagar (o a favor), ISR RESICO, total de impuestos y
     «Te queda después de impuestos». Inicio: impuestos estimados y lo que te queda.
   - ISR RESICO 2026, tabla mensual sobre ingresos cobrados sin IVA del mes, sin deducciones:
     ≤ 25,000 → 1.00 %; ≤ 50,000 → 1.10 %; ≤ 83,333.33 → 1.50 %; ≤ 208,333.33 → 2.00 %; más → 2.50 %.
   - Leyenda: «Estimación, confírmala con tu contador».
4. **Factura SIMULADA después del pago.**
   - Venta → «¿Tu cliente quiere factura?» Sí/No.
   - Cotización con «facturar» = Sí → al liquidarla se abre el formulario (por el total, con nota del anticipo).
   - Formulario: RFC, nombre o razón social, código postal, régimen fiscal y uso del CFDI; botón «Público en general».
     Aviso si el RFC es de persona moral: en la vida real retiene 1.25 % de ISR sin IVA (art. 113-J LISR).
   - PDF con «FACTURA SIMULADA · NO ES UN CFDI VÁLIDO ANTE EL SAT»: conceptos sin IVA, subtotal, IVA, total
     (= lo cobrado), forma de pago, método PUE, folio simulado, sin timbre ni UUID.
5. **WhatsApp** al final del ticket (y en la cotización): pide el número a 10 dígitos y abre `wa.me` con el texto
   (ticket y, si se hizo, la factura). Solo texto: el PDF sigue en Compartir. El número no se guarda.

## No-metas
CFDI real o timbrado, retenciones calculadas, IVA por producto, precios «+ IVA», RFC del negocio, declaración.

## Anti-metas
- Una cotización que suma a ganancias sin pago.
- Un pago mayor al saldo o a una cotización pagada o cancelada.
- RFC o WhatsApp del cliente, o datos del titular, en AsyncStorage o en la bitácora.
- Una factura sin la marca SIMULADA.
- Ventas viejas o estadísticas actuales rotas.

## Enfoques
- **A (elegido):** cotización guardada aparte con sus pagos ligados a ventas (`cotizacionId`). Cada pago es una venta
  normal, así el ingreso cuenta cuando se cobra (base de efectivo, como RESICO) y las estadísticas no cambian.
- B: guardar la cotización como venta «pendiente». Mezcla lo que se debe con lo cobrado y rompe ingresos y estadísticas.
- C: solo un recordatorio sin ligar pagos. No sabría el saldo ni cuándo facturar.

## Llamadas mías (Tiki puede corregirlas)
- La pregunta Venta/Cotización sale siempre, aunque el negocio no tenga activado el módulo de cotizaciones.
- Cotizar ya no cobra directo: «Cobrar todo» y «Cobrar anticipo» pasan al detalle en Por cobrar.
- Precios siempre con IVA incluido (se quitó el interruptor del diseño anterior).
- Sin RFC del negocio (dato personal del titular); la factura dice «RFC del emisor: no incluido (simulación)».
- WhatsApp también en la cotización (mismo componente).
- El IVA de compras se estima con la misma tasa que el de ventas. «Por cobrar» no entra al saldo.
- Tabla RESICO 2026 en un solo lugar (`src/impuestos.ts`): actualizar en enero de 2027 (reforma DOF 13-nov-2026).

## Agregado (mensaje de Tiki, 11:08): confirmación antes de registrar
- Antes de registrar cualquier cobro (efectivo, transferencia, contingencia; al iniciar Mercado Pago o el QR de CoDi,
  porque desde ahí el monto queda fijo): «¿Cobrar $X?» + método y resumen + «Una vez registrada, la venta ya no se
  puede modificar». Botones «Revisar» / «Sí, cobrar». También en pagos de cotización.
- Antes de guardar una compra: «¿Guardar la compra de $X?» + proveedor y renglones + «Una vez guardada, la compra ya no
  se puede modificar». Botones «Revisar» / «Sí, guardar». La revisión previa (corregir lo leído) se queda.
- Ventas y compras siguen sin poder editarse después de guardarse.

## Agregado (mensaje de Tiki, 11:11): permiso de galería
- «Elegir de la galería» y la cámara revisan el permiso: si iOS aún puede preguntar, sale su ventana; si ya se negó,
  la app explica cómo darlo y muestra «Abrir Ajustes» (Linking.openSettings). El acceso limitado a fotos también sirve.
