// Por cobrar: cotizaciones guardadas que se cobran después (anticipo y liquidación). No suman a tus ganancias hasta que
// te pagan: cada pago se registra en Cobrar como una venta normal ligada a la cotización.
import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useStore } from '../store';
import { money } from '../types';
import { buzz, moneyA11y, speak } from '../a11y';
import { abierta, anticipoSugerido, etiquetaEstado, pagado, porCobrar, saldo, totalPorCobrar, type Cotizacion, type EstadoCotizacion } from '../cotizacion';
import { cotizacionHTML, cotizacionTexto } from '../documentos';
import { compartirDocumento, pdfDisponible } from '../ticket';
import { Amount, Banner, Btn, C, Card, Field, fs, H, ListRow, P, Row, Screen, Segmented, Small, T } from '../ui';
import { EnviarWhatsApp } from './Compartir';

const dia = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
const centavos = (n: number) => Math.round(n * 100) / 100;
const ESTADO: Record<EstadoCotizacion, { txt: string; color: () => string; bg: () => string }> = {
  pendiente: { txt: 'Pendiente', color: () => C.warn, bg: () => C.warnBg },
  anticipo: { txt: 'Con anticipo', color: () => C.pri, bg: () => C.soft },
  pagada: { txt: 'Pagada', color: () => C.ok, bg: () => C.okBg },
  cancelada: { txt: 'Cancelada', color: () => C.sub, bg: () => C.track },
};

/** Renglón de una cotización (Inicio y Por cobrar): lo que resta si está abierta; el total si ya se cerró. */
export function FilaCotizacion({ c, onPress }: { c: Cotizacion; onPress: () => void }) {
  const v = abierta(c) ? saldo(c) : c.total;
  return <ListRow icon="doc" iconColor={ESTADO[c.estado].color()} iconBg={ESTADO[c.estado].bg()} title={`${c.folio}${c.cliente ? ` · ${c.cliente}` : ''}`}
    subtitle={`${etiquetaEstado(c)} · ${dia(c.fecha)}`} value={money(v)} valueA11y={`${abierta(c) ? 'resta ' : ''}${moneyA11y(v)}`} onPress={onPress} />;
}

export function PorCobrarScreen({ navigation }: any) {
  const st = useStore();
  const lista = porCobrar(st.cotizaciones);
  const cerradas = st.cotizaciones.filter((c) => !abierta(c)).sort((a, b) => (a.actualizada < b.actualizada ? 1 : -1)).slice(0, 10);
  const tot = totalPorCobrar(st.cotizaciones);
  return (
    <Screen padTop={false}>
      <View accessible accessibilityLabel={lista.length ? `${lista.length} por cobrar, en total ${moneyA11y(tot)}` : 'Nada por cobrar'}>
        <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(13), fontWeight: '700', color: C.sub, letterSpacing: 0.6 }}>POR COBRAR</Text>
        <Amount n={tot} size={30} />
      </View>
      <Small style={{ marginBottom: 6 }}>No suma a tus ganancias hasta que te pagan.</Small>
      <Btn title="Nueva cotización" icon="plus" onPress={() => navigation.navigate('Cotizar')} />
      <View style={{ height: 8 }} />
      {lista.length === 0
        ? <Card><P color={C.sub}>Cuando guardes una cotización aparece aquí hasta que te la paguen.</P></Card>
        : lista.map((c) => <FilaCotizacion key={c.id} c={c} onPress={() => navigation.navigate('Cotizacion', { id: c.id })} />)}
      {cerradas.length ? (
        <>
          <H style={{ marginTop: 16 }}>Pagadas y canceladas</H>
          {cerradas.map((c) => <FilaCotizacion key={c.id} c={c} onPress={() => navigation.navigate('Cotizacion', { id: c.id })} />)}
        </>
      ) : null}
    </Screen>
  );
}

export function CotizacionScreen({ navigation, route }: any) {
  const st = useStore();
  const c = st.cotizaciones.find((x) => x.id === route?.params?.id);
  const nueva = !!route?.params?.nueva;
  const [respondio, setRespondio] = useState(!nueva);
  const [montoTxt, setMontoTxt] = useState(() => (c ? String(anticipoSugerido(c)) : ''));
  // Al volver de Cobrar con un pago nuevo, propone otra vez lo que resta.
  useEffect(() => { if (c) setMontoTxt(String(anticipoSugerido(c))); }, [c?.pagos.length]);
  if (!c) return <Screen padTop={false}><Card><P>No encontré esta cotización.</P></Card></Screen>;

  const negocio = st.profile?.business_name ?? 'Mi negocio';
  const tasa = st.impuestos.tasaIVA;
  const s = saldo(c);
  const monto = centavos(parseFloat(montoTxt.replace(',', '.')) || 0);
  const montoOk = monto > 0 && monto <= s + 0.005;
  const esTodo = montoOk && monto >= s - 0.005;
  const e = ESTADO[c.estado];
  const cobrar = (m: number) => navigation.push('Sale', { cotizacionId: c.id, monto: m });
  const facturar = (v: boolean) => { st.setFacturarCotizacion(c.id, v); setRespondio(true); buzz('tap'); };

  async function compartir() {
    try { await compartirDocumento(cotizacionHTML(c!, negocio, tasa), cotizacionTexto(c!, negocio, tasa), `Cotización ${c!.folio}`); }
    catch (err: any) { Alert.alert('No pude generar el PDF', String(err?.message ?? err)); }
  }
  function cancelar() {
    const ya = pagado(c!);
    Alert.alert('¿Cancelar la cotización?', ya > 0 ? `Lo que ya te pagaron (${money(ya)}) se queda en tus ventas.` : 'Ya no aparecerá en Por cobrar.', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: async () => { if (await st.cancelarCotizacion(c!.id)) { buzz('ok'); speak('Cotización cancelada.'); } } },
    ]);
  }

  return (
    <Screen padTop={false} teclado>
      {nueva && abierta(c) ? <Banner kind="ok" text={`${c.folio} guardada en Por cobrar. No suma a tus ganancias hasta que te paguen.`} /> : null}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <P bold size={19}>{c.folio}</P>
          <View style={{ backgroundColor: e.bg(), borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: T.hc ? 2 : 0, borderColor: e.color() }}>
            <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(12), fontWeight: '800', color: e.color() }}>{e.txt}</Text>
          </View>
        </Row>
        <Small>{c.cliente || 'Sin nombre'} · {dia(c.fecha)}</Small>
        <View style={{ marginTop: 8 }}>
          {c.renglones.map((r, i) => (
            <Row key={i} accessible accessibilityLabel={`${r.qty} ${r.name}, ${moneyA11y(r.qty * r.price)}`} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
              <P style={{ flex: 1 }}>{r.qty} × {r.name}</P><P>{money(r.qty * r.price)}</P>
            </Row>
          ))}
        </View>
        <View style={{ height: T.border, backgroundColor: C.line, marginVertical: 8 }} />
        <Row style={{ justifyContent: 'space-between' }}><P bold>Total</P><Amount n={c.total} size={18} /></Row>
        {c.pagos.length ? <Row style={{ justifyContent: 'space-between' }}><P>Ya te pagó</P><P bold color={C.ok}>{money(pagado(c))}</P></Row> : null}
        {abierta(c) ? <Row style={{ justifyContent: 'space-between', marginTop: 4 }}><P bold size={17}>Resta</P><Amount n={s} size={24} /></Row> : null}
        {c.estado === 'pagada' ? <Banner kind="ok" text="Pagada por completo ✓" /> : null}
      </Card>

      {abierta(c) ? (
        <Card>
          <H>Cobrar</H>
          <Field label={c.pagos.length ? '¿Cuánto te paga ahora? $' : '¿Cuánto te da de anticipo? $'} keyboardType="decimal-pad" value={montoTxt} onChangeText={setMontoTxt}
            hint={!c.pagos.length && c.anticipoPct > 0 ? `Pediste ${c.anticipoPct} %` : undefined} />
          {!c.pagos.length && c.anticipoPct > 0 ? <Small>Pediste {c.anticipoPct} % de anticipo = {money(anticipoSugerido(c))}.</Small> : null}
          {!montoOk && montoTxt.trim() ? <Small color={C.bad}>{monto > s ? `Máximo ${money(s)}, lo que resta.` : 'Escribe cuánto te paga.'}</Small> : null}
          <Btn title={esTodo ? `Cobrar ${money(monto)} y liquidar` : `Recibir ${c.pagos.length ? 'pago' : 'anticipo'} de ${money(monto)}`} icon="cash" disabled={!montoOk}
            onPress={() => cobrar(monto)} hint="Abre Cobrar con este monto. Cuenta como ingreso hoy." />
          {!esTodo ? <Btn title={`Cobrar todo lo que resta (${money(s)})`} kind="sec" onPress={() => cobrar(s)} /> : null}
        </Card>
      ) : null}

      {abierta(c) ? (
        <Card>
          <H>¿Facturar después del pago?</H>
          {!respondio ? (
            <>
              <Small>Si dices Sí, cuando la liquide te pedimos los datos fiscales del cliente y se hace la factura (simulada) por el total.</Small>
              <Row style={{ gap: 8, marginTop: 6 }}>
                <View style={{ flex: 1 }}><Btn title="No" kind="sec" onPress={() => facturar(false)} /></View>
                <View style={{ flex: 1 }}><Btn title="Sí" onPress={() => facturar(true)} /></View>
              </Row>
            </>
          ) : (
            <>
              <Segmented label="¿Facturar después del pago?" options={[{ v: 'no', label: 'No' }, { v: 'si', label: 'Sí' }]} value={c.facturar ? 'si' : 'no'}
                onChange={(v) => st.setFacturarCotizacion(c.id, v === 'si')} />
              <Small style={{ marginTop: 6 }}>{c.facturar ? 'Al liquidarla se abre la factura (simulada) por el total.' : 'No se hará factura.'}</Small>
            </>
          )}
        </Card>
      ) : null}

      <Card>
        <H>Mandar al cliente</H>
        <Btn title={pdfDisponible() ? 'Compartir cotización (PDF)' : 'Compartir cotización'} icon="down" kind="sec" onPress={compartir} hint="Guárdala en Archivos o mándala por WhatsApp como PDF" />
        <EnviarWhatsApp texto={cotizacionTexto(c, negocio, tasa)} titulo="O por WhatsApp (texto)" />
      </Card>

      {c.pagos.length ? (
        <Card>
          <H>Pagos</H>
          {c.pagos.map((p, i) => (
            <Row key={p.saleId} accessible accessibilityLabel={`${p.tipo === 'anticipo' ? 'Anticipo' : 'Liquidación'} del ${dia(p.fecha)}: ${moneyA11y(p.monto)}`}
              style={{ justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: i ? T.border : 0, borderColor: C.line }}>
              <P style={{ flex: 1 }}>{p.tipo === 'anticipo' ? 'Anticipo' : 'Liquidación'} · {dia(p.fecha)}</P><P bold>{money(p.monto)}</P>
            </Row>
          ))}
        </Card>
      ) : null}

      {abierta(c) ? <Btn title="Cancelar cotización" kind="ghost" icon="close" onPress={cancelar} /> : null}
    </Screen>
  );
}
