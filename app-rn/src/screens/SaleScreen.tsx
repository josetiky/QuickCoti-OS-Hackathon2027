// Cobro: efectivo · Mercado Pago REAL celular a celular (QR) · CoDi SIMULADO · efectivo por contingencia si falla lo digital.
// También cobra pagos de cotizaciones de Por cobrar (anticipo o liquidación, monto fijo). Antes de registrar pide confirmar:
// una venta registrada ya no se modifica. Después del cobro: factura SIMULADA (si el cliente la quiere) y WhatsApp.
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useStore } from '../store';
import { mpCreate, mpStatus } from '../payments';
import { crearCobroCodi, liquidarCodi, type CobroCodi } from '../codi';
import { compartirDocumento, compartirTicket, pdfDisponible, ticketTexto, type Ticket } from '../ticket';
import { facturaHTML, facturaTexto } from '../documentos';
import { money, PAYMENT_LABEL, uid, type PaymentMethod } from '../types';
import { agregarProducto, aRenglones, lineasDesdePreset, resumenRenglones, totalRenglones, type LineaVenta } from '../venta';
import { abierta, conceptoPago, pagado, saldo, tipoDePago, type Cotizacion } from '../cotizacion';
import { armarFactura, folioFactura, RFC_PUBLICO, normalizarRFC, tipoPersona, type Factura, type Receptor } from '../factura';
import { confirmacionCobro } from '../avisos';
import { Amount, Banner, Btn, C, Card, confirmar, Field, fs, H, IconButton, LineasEditor, P, Row, Small, T } from '../ui';
import { buzz, moneyA11y, speak } from '../a11y';
import { Icon } from '../icons';
import { EnviarWhatsApp, FacturaForm } from './Compartir';

type MP = { reference: string; pay_url: string; mode: string; request: any; response_status: number };
type PasoFactura = 'pregunta' | 'form' | 'hecha' | 'no' | 'al_liquidar';
const centavos = (n: number) => Math.round(n * 100) / 100;

export default function SaleScreen({ route, navigation }: any) {
  const st = useStore();
  const preset = route?.params ?? {};
  // Pago de una cotización (desde Por cobrar): monto fijo y renglones de la cotización a la vista, sin editor.
  const cotId: string | undefined = preset.cotizacionId;
  const modoCot = !!cotId;
  const cot = cotId ? st.cotizaciones.find((c) => c.id === cotId) : undefined;
  const montoCot = centavos(Number(preset.monto) || 0);
  const cotOk = !!cot && abierta(cot) && montoCot > 0 && montoCot <= saldo(cot) + 0.005;
  const tipoCot = cot ? tipoDePago(cot, montoCot) : 'anticipo';
  // Venta con varios artículos: renglones (de otra pantalla o vacíos).
  const [lineas, setLineas] = useState<LineaVenta[]>(() => (modoCot ? [] : lineasDesdePreset(preset, uid)));
  const [mp, setMp] = useState<MP | null>(null);
  const [mpState, setMpState] = useState<any>(null);
  const [codi, setCodi] = useState<CobroCodi | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comprador, setComprador] = useState<string>(preset.cliente ?? cot?.cliente ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rules, setRules] = useState<string[]>([]);
  // Después del cobro
  const [paso, setPaso] = useState<PasoFactura>('pregunta');
  const [factura, setFactura] = useState<Factura | null>(null);
  const [pagoCot, setPagoCot] = useState<{ cot: Cotizacion; antes: number } | null>(null);
  const [ventaId, setVentaId] = useState<string | undefined>();
  const [metodoPagado, setMetodoPagado] = useState<PaymentMethod>('efectivo');
  const poll = useRef<any>(null);
  const contingency = st.incidents.find((i) => !i.end);
  const items = modoCot ? [] : aRenglones(lineas);
  const amount = modoCot ? montoCot : totalRenglones(items);
  const term = st.profile?.terminology;
  const conceptR = modoCot ? (cot ? conceptoPago(cot, tipoCot) : 'Pago de cotización') : resumenRenglones(items);

  useEffect(() => () => clearInterval(poll.current), []);

  async function done(method: PaymentMethod, status: 'pagada' | 'fallida', sim: boolean, ref: string | null, extra?: Partial<Ticket>) {
    const antes = cot ? pagado(cot) : 0;
    const out = await st.registerSale({ concept: conceptR || 'Venta', amount, method, status, isSimulated: sim, reference: ref,
      items: modoCot ? undefined : items, cotizacionId: modoCot ? cotId : undefined });
    if (out.allowed && status === 'pagada') {
      const c2 = out.cotizacion;
      setTicket({ folio: ref ?? `VTA-${Date.now().toString().slice(-6)}`, negocio: st.profile?.business_name ?? 'Mi negocio', concepto: conceptR || 'Venta',
        monto: amount, metodo: PAYMENT_LABEL[method], estatus: 'PAGADO', fecha: new Date().toISOString(), cliente: comprador || undefined, simulado: sim,
        renglones: c2 ? c2.renglones : items,
        ...(c2 ? { cotizacion: { folio: c2.folio, total: c2.total, pagadoAntes: antes, resta: saldo(c2), tipo: c2.pagos[c2.pagos.length - 1].tipo } } : {}), ...extra });
      setVentaId(out.saleId); setMetodoPagado(method); setFactura(null);
      // Factura: venta → se pregunta; cotización liquidada → se abre sola si la pidió; anticipo → se hace al liquidar.
      if (c2) { setPagoCot({ cot: c2, antes }); setPaso(c2.estado === 'pagada' ? (c2.facturar ? 'form' : 'pregunta') : 'al_liquidar'); }
      else { setPagoCot(null); setPaso('pregunta'); }
    }
    setRules(out.messages);
    if (!out.allowed) { setMsg('No se registró: revisa el aviso.'); buzz('error'); speak('No se registró. Revisa el aviso.'); return false; }
    if (status === 'pagada') {
      setMsg(`✔︎ ${term?.sale ?? 'Venta'} registrada: ${money(amount)} · ${PAYMENT_LABEL[method]}`); buzz('ok');
      speak(`${term?.sale ?? 'Venta'} registrada por ${moneyA11y(amount)}, ${PAYMENT_LABEL[method]}.`);
      if (!modoCot) setLineas([{ id: uid(), desc: '', qty: '1', price: '' }]);
    }
    return true;
  }

  /** Una venta registrada ya no se modifica: se confirma antes de registrar (o de fijar el monto en un QR). */
  async function confirmarYCobrar(etiqueta: string, accion: () => unknown) {
    const m = confirmacionCobro({ monto: amount, metodo: etiqueta, resumen: conceptR });
    if (await confirmar(m.titulo, m.mensaje, 'Sí, cobrar')) await accion();
  }

  async function failDigital(method: PaymentMethod, reason: string) {
    clearInterval(poll.current);
    await st.openContingency(reason);
    await st.registerSale({ concept: conceptR || 'Cobro fallido', amount: Math.max(amount, 0.01), method, status: 'fallida', isSimulated: method !== 'tarjeta', reference: mp?.reference ?? null,
      cotizacionId: modoCot ? cotId : undefined }); // fallido: no toca la cotización; solo cuida que la bitácora lleve el folio
    setMp(null); setCodi(null);
    setMsg(`El pago digital falló (${reason}). Puedes cobrar en efectivo por contingencia: queda registrado para conciliar.`);
    buzz('warn'); speak('El pago digital falló. Puedes cobrar en efectivo por contingencia.');
  }

  async function startMP() {
    setBusy(true); setMsg(null); setMpState(null);
    try {
      const r: MP = await mpCreate(conceptR || 'Venta', amount, st.profile?.business_name ?? 'QuickCoti');
      setMp(r);
      clearInterval(poll.current);
      poll.current = setInterval(async () => {
        try {
          const s = await mpStatus(r.reference);
          setMpState(s);
          if (s.status === 'approved') { clearInterval(poll.current); await done('tarjeta', 'pagada', r.mode !== 'produccion', r.reference); setMp(null); }
          if (s.status === 'rejected' || s.status === 'cancelled') await failDigital('tarjeta', `Mercado Pago: ${s.detail}`);
        } catch {}
      }, 3000);
    } catch (e: any) { await failDigital('tarjeta', e?.message ?? 'sin conexión'); }
    finally { setBusy(false); }
  }

  // CoDi SIMULADO local (no depende de la Mac): QR → el cliente "paga" → liquidado con clave de rastreo → ticket PDF
  function startCodi() {
    setMsg(null); setTicket(null);
    setCodi(crearCobroCodi(amount, conceptR || 'Venta', st.profile?.business_name ?? 'Mi negocio', st.titular?.clabe ?? '', comprador));
    speak(`Cobro CoDi simulado por ${moneyA11y(amount)}. Muestra el código a tu cliente.`);
  }
  async function codiPagado() {
    if (!codi) return;
    const c = liquidarCodi(codi);
    const ok = await done('codi', 'pagada', true, c.referencia, { metodo: c.metodo, estatus: 'LIQUIDADO (SIMULADO)', clabe: c.clabe || undefined, rastreo: c.claveRastreo, fecha: c.fechaLiquidacion ?? undefined });
    if (ok) setCodi(null);
  }
  async function descargarTicket() {
    if (!ticket) return;
    try { const r = await compartirTicket(ticket); if (r === 'texto') speak('Compartí el ticket como texto.'); }
    catch (e: any) { setMsg('No pude generar el ticket: ' + (e?.message ?? e)); buzz('error'); }
  }

  function hacerFactura(r: Receptor) {
    if (!ticket) return;
    const c2 = pagoCot?.cot;
    const f = armarFactura({
      negocio: st.profile?.business_name ?? 'Mi negocio', folio: folioFactura(new Date()), fecha: new Date().toISOString(), receptor: r,
      renglones: c2 ? c2.renglones : ticket.renglones?.length ? ticket.renglones : [{ name: ticket.concepto, qty: 1, price: ticket.monto }],
      total: c2 ? c2.total : ticket.monto, metodo: metodoPagado, tasaIVA: st.impuestos.tasaIVA, regimenEmisor: st.impuestos.regimen === 'resico' ? '626' : null,
      nota: c2 && pagoCot && pagoCot.antes > 0 ? `Cotización ${c2.folio}: incluye anticipo(s) por ${money(pagoCot.antes)} ya pagado(s).` : undefined,
    });
    setFactura(f); setPaso('hecha');
    st.registrarFactura({ folio: f.folio, total: f.total, receptor: normalizarRFC(r.rfc) === RFC_PUBLICO ? 'publico' : tipoPersona(r.rfc), saleId: ventaId, cotizacionId: c2?.id });
    buzz('ok'); speak('Factura simulada lista.');
  }
  async function descargarFactura() {
    if (!factura) return;
    try { await compartirDocumento(facturaHTML(factura), facturaTexto(factura), `Factura ${factura.folio}`); }
    catch (e: any) { setMsg('No pude generar la factura: ' + (e?.message ?? e)); buzz('error'); }
  }
  function nuevoCobro() { setTicket(null); setMsg(null); setComprador(''); setFactura(null); setPaso('pregunta'); setPagoCot(null); setVentaId(undefined); }

  const valid = modoCot ? cotOk : amount > 0 && items.length > 0;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      {contingency && (
        <Card>
          <Banner text={`⚡ Contingencia activa: ${contingency.reason}`} />
          <Btn title="Ya regresaron los pagos digitales" kind="sec" onPress={() => st.closeContingency()} />
        </Card>
      )}
      {modoCot ? (!ticket ? (
        <Card>
          <H>Pago de cotización</H>
          {!cot ? <Banner kind="bad" text="No encontré esta cotización. Regresa a Por cobrar." /> : (
            <>
              <Row style={{ justifyContent: 'space-between' }}><P bold>{cot.folio}</P><Small>{cot.cliente}</Small></Row>
              {cot.renglones.map((r, i) => (
                <Row key={i} style={{ justifyContent: 'space-between', paddingVertical: 3 }}><P style={{ flex: 1 }}>{r.qty} × {r.name}</P><P>{money(r.qty * r.price)}</P></Row>
              ))}
              <View style={{ height: T.border, backgroundColor: C.line, marginVertical: 8 }} />
              <Row style={{ justifyContent: 'space-between' }}><P>Total de la cotización</P><P bold>{money(cot.total)}</P></Row>
              {cot.pagos.length ? <Row style={{ justifyContent: 'space-between' }}><P>Ya te pagó</P><P bold>{money(pagado(cot))}</P></Row> : null}
              <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
                <P bold size={17}>{tipoCot === 'liquidacion' ? 'Liquidación' : cot.pagos.length ? 'Este pago' : 'Anticipo'}</P><Amount n={montoCot} size={24} />
              </Row>
              <Small>{tipoCot === 'liquidacion' ? 'Con este pago queda liquidada.' : `Después quedará ${money(Math.max(0, centavos(saldo(cot) - montoCot)))} por cobrar.`}</Small>
              {!cotOk ? <Banner kind="bad" text="Esta cotización ya no tiene ese saldo por cobrar. Regresa a Por cobrar." /> : null}
            </>
          )}
        </Card>
      ) : null) : (
      <Card>
        <H>Qué cobras</H>
        {st.profile?.modules.inventory && st.products.length > 0 ? <Small style={{ marginBottom: 6 }}>Toca un producto para agregarlo, o escribe el artículo abajo.</Small> : null}
        {st.profile?.modules.inventory && st.products.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {st.products.map((p) => {
              const enLista = lineas.find((l) => l.productId === p.id);
              const on = !!enLista;
              return (
                <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${p.name}, quedan ${Math.round(p.stock)}${enLista ? `, en la venta: ${enLista.qty}` : ''}`} accessibilityHint="Toca para agregar uno a la venta"
                  onPress={() => { buzz('tap'); setLineas(agregarProducto(lineas, p, uid)); }}
                  style={{ paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, borderRadius: 12, backgroundColor: on ? C.pri : C.soft, borderWidth: T.hc ? 2 : 0, borderColor: C.navy, justifyContent: 'center' }}>
                  <Text style={{ color: on ? C.onPri : T.hc ? C.priDark : C.pri, fontWeight: '700', fontSize: fs(14) }}>{p.name}{enLista ? ` ×${enLista.qty}` : ''} · {Math.round(p.stock)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <LineasEditor lineas={lineas} onChange={setLineas} placeholder="Ej. Refresco" pasos textoAgregar="Agregar artículo" />
        <Field label="Nombre del cliente (opcional, sale en el ticket)" value={comprador} onChangeText={setComprador} />
      </Card>
      )}

      {mp ? (
        <Card style={{ alignItems: 'center' }}>
          <H style={{ textAlign: 'center' }}>Que tu cliente escanee con su celular</H>
          <View accessible accessibilityRole="image" accessibilityLabel={`Código QR de Mercado Pago por ${moneyA11y(amount)}`}><QRCode value={mp.pay_url} size={220} /></View>
          <P>{money(amount)} · ref {mp.reference}</P>
          <Small color={mp.mode === 'produccion' ? C.ok : C.warn}>Mercado Pago · {mp.mode === 'sandbox' ? 'MODO PRUEBA (sandbox real, sin dinero real)' : mp.mode}</Small>
          <Small>Estado: {mpState?.status ?? 'pending'} {mpState?.detail ? `· ${mpState.detail}` : ''}</Small>
          {mpState?.fee ? <Small>Comisión MP: {money(mpState.fee)} · Neto: {money(mpState.net ?? 0)}</Small> : null}
          <Btn title="Abrir link aquí (prueba)" kind="sec" onPress={() => Linking.openURL(mp.pay_url)} />
          <Btn title="El cliente no pudo pagar" kind="bad" onPress={() => failDigital('tarjeta', 'el cliente no pudo pagar')} />
          <Small>Solicitud: {JSON.stringify(mp.request?.items?.[0] ?? {})} → HTTP {mp.response_status}</Small>
        </Card>
      ) : codi ? (
        <Card style={{ alignItems: 'center' }}>
          <H style={{ textAlign: 'center' }}>Cobro CoDi</H>
          <View style={{ backgroundColor: C.badBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 }}>
            <Text style={{ color: C.bad, fontWeight: '800', fontSize: fs(12) }}>SIMULACIÓN · NO ES UN QR CoDi VÁLIDO</Text>
          </View>
          <View accessible accessibilityRole="image" accessibilityLabel={`Código QR simulado por ${moneyA11y(codi.monto)}`} style={{ padding: 12, backgroundColor: '#FFFFFF', borderRadius: 16 }}>
            <QRCode value={codi.qrPayload} size={200} />
          </View>
          <Amount n={codi.monto} size={28} />
          <Small>Folio {codi.referencia} · {codi.negocio}{codi.clabe ? ` · CLABE •••• ${codi.clabe.slice(-4)}` : ''}</Small>
          <Row style={{ marginVertical: 8 }}><Icon name="clock" size={18} color={C.warn} /><Small color={C.warn} style={{ fontWeight: '700' }}>Estado: PENDIENTE · esperando el pago del cliente</Small></Row>
          <Btn title="Simular: el cliente ya pagó" icon="check" onPress={codiPagado} hint="Marca el cobro como liquidado (simulación) y registra la venta" style={{ alignSelf: 'stretch' }} />
          <Btn title="El cobro falló" kind="bad" onPress={() => failDigital('codi', 'CoDi no respondió (simulado)')} style={{ alignSelf: 'stretch' }} />
          <Small style={{ textAlign: 'center' }}>Así se vería el flujo real: el banco avisa que el pago se liquidó y se genera el comprobante. Aquí no se mueve dinero.</Small>
        </Card>
      ) : !ticket || !modoCot ? (
        <Card>
          <H>Cómo te paga</H>
          {valid ? <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}><P>Total a cobrar</P><Amount n={amount} size={24} /></Row> : <Small>{modoCot ? 'Este pago ya no se puede cobrar.' : 'Escribe qué cobras y el monto para elegir cómo te pagan.'}</Small>}
          <Btn title="Efectivo" icon="cash" disabled={!valid} onPress={() => confirmarYCobrar('Efectivo', () => done('efectivo', 'pagada', false, null))} />
          <Btn title="Celular a celular (Mercado Pago)" icon="qr" disabled={!valid} loading={busy} onPress={() => confirmarYCobrar('Mercado Pago (celular a celular)', startMP)} />
          <Btn title="CoDi QR (simulado)" icon="qr" kind="sec" disabled={!valid} onPress={() => confirmarYCobrar('CoDi QR (simulado)', startCodi)} hint="Funciona sin internet: muestra un QR de prueba y genera ticket" />
          <Btn title="Transferencia (ya la recibí)" kind="sec" disabled={!valid} onPress={() => confirmarYCobrar('Transferencia', () => done('transferencia', 'pagada', false, null))} />
          {contingency && <Btn title="Efectivo por contingencia" kind="sec" disabled={!valid} onPress={() => confirmarYCobrar('Efectivo por contingencia', () => done('efectivo_contingencia', 'pagada', false, contingency.id))} />}
          <Small>Antes de registrar te pedimos confirmar: una venta registrada ya no se puede modificar.</Small>
        </Card>
      ) : null}
      {msg && <Banner text={msg} kind={msg.startsWith('✔') ? 'ok' : 'warn'} />}
      {ticket && (
        <Card>
          <Row><Icon name="doc" size={22} color={C.pri} /><P bold style={{ flex: 1 }}>Ticket {ticket.folio}{ticket.simulado ? ' (simulado)' : ''}</P><Amount n={ticket.monto} size={17} /></Row>
          {ticket.cotizacion ? <Small>{ticket.cotizacion.resta > 0 ? `Resta ${money(ticket.cotizacion.resta)} de ${ticket.cotizacion.folio}; sigue en Por cobrar.` : `${ticket.cotizacion.folio} quedó liquidada ✓`}</Small> : null}
          {ticket.rastreo ? <Small>Clave de rastreo: {ticket.rastreo}</Small> : null}
          <Btn title={pdfDisponible() ? 'Descargar ticket PDF' : 'Compartir ticket'} icon="down" onPress={descargarTicket} hint="Guárdalo en Archivos o envíalo por WhatsApp" />
        </Card>
      )}
      {ticket && (
        <Card>
          {paso === 'pregunta' ? (
            <>
              <H>¿Tu cliente quiere factura?</H>
              <Small>Se hace en simulación: no es un CFDI válido ante el SAT.</Small>
              <Row style={{ gap: 8, marginTop: 6 }}>
                <View style={{ flex: 1 }}><Btn title="No" kind="sec" onPress={() => setPaso('no')} /></View>
                <View style={{ flex: 1 }}><Btn title="Sí" onPress={() => setPaso('form')} /></View>
              </Row>
            </>
          ) : paso === 'form' ? (
            <>
              {pagoCot?.cot.facturar ? <Banner kind="info" text={`Tu cliente pidió factura de ${pagoCot.cot.folio}: llena sus datos y sale por el total (${money(pagoCot.cot.total)}).`} /> : null}
              <FacturaForm regimenEmisor={st.impuestos.regimen === 'resico' ? '626' : null} onListo={hacerFactura} onCancelar={() => setPaso('no')} />
            </>
          ) : paso === 'hecha' && factura ? (
            <>
              <Row><Icon name="doc" size={22} color={C.pri} /><P bold style={{ flex: 1 }}>Factura {factura.folio} (simulada)</P><Amount n={factura.total} size={17} /></Row>
              <Small color={C.bad} style={{ fontWeight: '700' }}>SIMULACIÓN · NO ES UN CFDI VÁLIDO ANTE EL SAT</Small>
              <Btn title={pdfDisponible() ? 'Descargar factura PDF' : 'Compartir factura'} icon="down" onPress={descargarFactura} />
            </>
          ) : paso === 'al_liquidar' ? (
            <Small>{pagoCot?.cot.facturar ? 'La factura (simulada) se hace cuando tu cliente liquide la cotización.' : 'Si tu cliente quiere factura, se hace cuando liquide la cotización.'}</Small>
          ) : null}
          <EnviarWhatsApp texto={ticketTexto(ticket) + (factura ? '\n\n' + facturaTexto(factura) : '')} titulo={factura ? 'Manda el ticket y la factura por WhatsApp' : 'Manda el ticket por WhatsApp'} />
          {modoCot
            ? <Btn title="Listo" icon="check" onPress={() => navigation.popToTop()} />
            : <Btn title="Nuevo cobro" kind="sec" icon="plus" onPress={nuevoCobro} />}
        </Card>
      )}
      {rules.map((r) => <Small key={r} color={C.warn}>{r}</Small>)}
    </ScrollView>
  );
}
