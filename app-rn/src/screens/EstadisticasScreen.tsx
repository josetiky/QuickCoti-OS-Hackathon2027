// Estadísticas (adaptado de "Ganancias & Gastos" de la app SwiftUI anterior): balance, resumen, lo que más vendes,
// compras por proveedor y tendencia. Todo se calcula en el iPhone con estadisticas.ts.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useStore } from '../store';
import { configurar } from '../ai/configurador';
import { money } from '../types';
import { moneyA11y } from '../a11y';
import { Icon, type IconName } from '../icons';
import { C, Card, fs, H, P, Row, Screen, Segmented, Small, T } from '../ui';
import { periodoDeMeta, porProveedor, rangoPeriodo, resumen, tendencia, topConceptos, type Periodo } from '../estadisticas';
import { estimarImpuestos } from '../impuestos';
import { Barras, Dona, PALETA_DONA } from '../graficas';

const PERIODOS: { v: Periodo; label: string }[] = [{ v: 'semana', label: 'Semana' }, { v: 'mes', label: 'Mes' }, { v: 'trimestre', label: 'Trimestre' }, { v: 'anio', label: 'Año' }];
const NOMBRE: Record<Periodo, string> = { semana: 'esta semana', mes: 'este mes', trimestre: 'este trimestre', anio: 'este año' };
// Unidades vendidas: los pagos de cotización se reparten, así que puede haber fracciones (0.5 = medio trabajo pagado).
const unidades = (n: number) => { const x = Math.round(n * 10) / 10; return Number.isInteger(x) ? String(x) : x.toFixed(1); };
const signo = (n: number) => (n < 0 ? '−' : '') + money(Math.abs(n));

function Linea({ k, v, bold, color }: { k: string; v: string; bold?: boolean; color?: string }) {
  return <Row style={{ justifyContent: 'space-between', paddingVertical: 3 }}><P color={bold ? undefined : C.sub} bold={bold} style={{ flex: 1 }}>{k}</P><P bold color={color}>{v}</P></Row>;
}

function Dato({ titulo, valor, a11y, icono, alerta }: { titulo: string; valor: string; a11y?: string; icono: IconName; alerta?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${titulo}: ${a11y ?? valor}`} style={{ width: T.simple ? '100%' : '48.5%', backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 10, gap: 6,
      borderWidth: alerta ? 2 : T.border, borderColor: alerta ? C.bad : T.hc ? C.line : C.hair }}>
      <Icon name={icono} size={20} color={alerta ? C.bad : C.pri} />
      <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(22), fontWeight: '800', color: C.navy }}>{valor}</Text>
      <Small>{titulo}</Small>
    </View>
  );
}

export default function EstadisticasScreen() {
  const st = useStore();
  const prof = st.profile!;
  const ui = prof.ui ?? configurar(prof);
  const [per, setPer] = useState<Periodo>(periodoDeMeta(ui.periodicidadMeta));
  const ahora = new Date();
  const r = rangoPeriodo(per, ahora);
  const res = resumen(st.sales, st.purchases, r);
  const top = topConceptos(st.sales, r, 6, st.cotizaciones);
  const imp = estimarImpuestos(st.sales, st.purchases, r, st.impuestos);
  const queda = Math.round((res.saldo - imp.total) * 100) / 100;
  const pctIVA = `${Math.round(st.impuestos.tasaIVA * 100)} %`;
  const prov = porProveedor(st.purchases, r);
  const ten = tendencia(st.sales, st.purchases, per, ahora);
  const aFavor = res.saldo >= 0;
  const totalTop = top.reduce((a, x) => a + x.monto, 0);
  const pct = (m: number) => (totalTop > 0 ? Math.round((m / totalTop) * 100) : 0);
  const colorSaldo = aFavor ? C.ok : C.bad;

  return (
    <Screen padTop={false}>
      <Segmented label="Periodo" options={PERIODOS} value={per} onChange={(v) => setPer(v as Periodo)} />

      <Card style={{ marginTop: 12 }}>
        <View accessible accessibilityLabel={`Balance de ${NOMBRE[per]}: ingresos ${moneyA11y(res.ingresos)}, gastos ${moneyA11y(res.gastos)}. Saldo ${moneyA11y(Math.abs(res.saldo))} ${aFavor ? 'a favor' : 'en contra'}.`}>
          <Small>Balance de {NOMBRE[per]} (ventas − compras)</Small>
          <Row style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Icon name={aFavor ? 'up' : 'down'} size={24} color={colorSaldo} />
            <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(30), fontWeight: '800', color: colorSaldo }}>{money(Math.abs(res.saldo))}</Text>
            <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(15), fontWeight: '700', color: colorSaldo }}>{aFavor ? 'a favor' : 'en contra'}</Text>
          </Row>
          <Row style={{ marginTop: 10 }}>
            <View style={{ flex: 1 }}><Small>Ingresos</Small><P bold>+{money(res.ingresos)}</P></View>
            <View style={{ flex: 1 }}><Small>Gastos (compras)</Small><P bold>−{money(res.gastos)}</P></View>
          </Row>
        </View>
      </Card>

      <Card>
        <H>Impuestos estimados</H>
        {!imp.calcula ? <Small>Activa el cálculo en Ajustes → Impuestos.</Small> : (
          <View accessible accessibilityLabel={`Impuestos estimados de ${NOMBRE[per]}: IVA ${imp.ivaAFavor > 0 ? `a favor ${moneyA11y(imp.ivaAFavor)}` : `a pagar ${moneyA11y(imp.ivaPorPagar)}`}, ISR ${moneyA11y(imp.isr)}. Total ${moneyA11y(imp.total)}. Te queda ${queda < 0 ? 'menos ' : ''}${moneyA11y(Math.abs(queda))}.`}>
            <Linea k={`IVA de tus ventas (${pctIVA})`} v={money(imp.ivaVentas)} />
            <Linea k="IVA de tus compras" v={'−' + money(imp.ivaCompras)} />
            {imp.ivaAFavor > 0 ? <Linea k="IVA a favor (no pagas)" v={money(imp.ivaAFavor)} bold color={C.ok} /> : <Linea k="IVA a pagar" v={money(imp.ivaPorPagar)} bold />}
            <Linea k={`ISR RESICO${imp.isr > 0 ? ` (${(imp.tasaISR * 100).toFixed(2)} %)` : ''}`} v={money(imp.isr)} bold />
            <View style={{ height: T.border, backgroundColor: C.line, marginVertical: 6 }} />
            <Linea k="Total de impuestos" v={money(imp.total)} bold />
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <P bold size={17} style={{ flex: 1 }}>Te queda después de impuestos</P>
              <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(19), fontWeight: '800', color: queda >= 0 ? C.ok : C.bad }}>{signo(queda)}</Text>
            </Row>
            <Small style={{ marginTop: 6 }}>Estimación con IVA {pctIVA} y la tabla RESICO 2026 sobre lo cobrado. Confírmala con tu contador.</Small>
          </View>
        )}
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Dato titulo="Ingresos cobrados" valor={money(res.ingresos)} a11y={moneyA11y(res.ingresos)} icono="cash" />
        <Dato titulo="Ventas realizadas" valor={String(res.ventas)} icono="ticket" />
        <Dato titulo="Cobros fallidos" valor={String(res.fallidos)} icono="alert" alerta={res.fallidos > 0} />
        <Dato titulo="Compras registradas" valor={String(res.compras)} icono="cart" />
      </View>

      <Card>
        <H>¿Qué vendes más?</H>
        {top.length === 0 ? <Small>Aún no hay ventas pagadas {NOMBRE[per]}.</Small> : (
          <>
            <Dona datos={top.map((x, i) => ({ etiqueta: x.concepto, valor: x.monto, color: PALETA_DONA[i % PALETA_DONA.length] }))}
              a11y={`Gráfica de ventas por concepto: ${top.map((x) => `${x.concepto} ${pct(x.monto)} por ciento`).join(', ')}`} />
            <View style={{ marginTop: 10 }}>
              {top.map((x, i) => (
                <Row key={x.concepto} accessible accessibilityLabel={`${x.concepto}: ${unidades(x.veces)} ${unidades(x.veces) === '1' ? 'vendido' : 'vendidos'}, ${moneyA11y(x.monto)}, ${pct(x.monto)} por ciento`}
                  style={{ paddingVertical: 8, borderTopWidth: i ? T.border : 0, borderColor: C.line }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: PALETA_DONA[i % PALETA_DONA.length] }} />
                  <View style={{ flex: 1 }}><P bold>{x.concepto}</P><Small>{unidades(x.veces)} {unidades(x.veces) === '1' ? 'vendido' : 'vendidos'} · {pct(x.monto)}%</Small></View>
                  <P bold>{money(x.monto)}</P>
                </Row>
              ))}
            </View>
          </>
        )}
      </Card>

      <Card>
        <H>Compras por proveedor</H>
        {prov.length === 0 ? <Small>Aún no hay compras {NOMBRE[per]}.</Small> : prov.map((x, i) => (
          <Row key={x.proveedor} accessible accessibilityLabel={`${x.proveedor}: ${x.compras} ${x.compras === 1 ? 'compra' : 'compras'}, ${moneyA11y(x.monto)}`}
            style={{ paddingVertical: 8, borderTopWidth: i ? T.border : 0, borderColor: C.line }}>
            <Icon name="cart" size={18} color={C.sub} />
            <View style={{ flex: 1 }}><P bold>{x.proveedor}</P><Small>{x.compras} {x.compras === 1 ? 'compra' : 'compras'}</Small></View>
            <P bold>−{money(x.monto)}</P>
          </Row>
        ))}
      </Card>

      <Card>
        <H>Tendencia</H>
        {!ten.some((x) => x.ventas || x.compras) ? <Small>Sin movimientos {NOMBRE[per]}.</Small> : (
          <Barras datos={ten} a11y={`Ventas y compras de ${NOMBRE[per]}: ${ten.filter((x) => x.ventas || x.compras).map((x) => `${x.etiqueta}, ventas ${moneyA11y(x.ventas)}, compras ${moneyA11y(x.compras)}`).join('; ')}`} />
        )}
      </Card>
    </Screen>
  );
}
