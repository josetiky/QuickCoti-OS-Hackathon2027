// Inicio (micrófono de Hermes + accesos rápidos + reciente), ventas, compras, inventario y cotizaciones.
// Diseño basado en la referencia SwiftUI "PyME NVIDIA", con lectura correcta para VoiceOver.
import React, { useState } from 'react';
import { ActionSheetIOS, Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { snapshot, useStore } from '../store';
import { DELIVERY_LABEL, money, PAYMENT_LABEL, PREDISENOS, type HomeCard } from '../types';
import { configurar } from '../ai/configurador';
import { Icon, type IconName } from '../icons';
import { buzz, moneyA11y, speak } from '../a11y';
import { periodoDeMeta, rangoPeriodo, resumen } from '../estadisticas';
import { estimarImpuestos } from '../impuestos';
import { porCobrar, totalPorCobrar } from '../cotizacion';
import { aRenglones, totalRenglones } from '../venta';
import { FilaCotizacion } from './Cotizaciones';
import {
  Amount, Banner, Btn, C, Card, Field, fs, H, IconButton, LineasEditor, lineasValidas, ListRow, nuevaLinea, P, PageHeader, Vidrio,
  ProgressBar, Row, Screen, Small, T, Tile, type Linea,
} from '../ui';

const hora = (iso: string) => new Date(iso).toLocaleString('es-MX', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** Botón principal de Inicio (Compras / Ventas): grande, con ícono y texto, apto para VoiceOver. */
function BotonGrande({ icon, titulo, sub, hint, onPress }: { icon: IconName; titulo: string; sub: string; hint: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${titulo}. ${sub}`} accessibilityHint={hint} onPress={() => { buzz('tap'); onPress(); }}
      style={({ pressed }) => ({ flex: T.simple ? undefined : 1, minHeight: T.simple ? 120 : 150, borderRadius: 24, padding: 16, justifyContent: 'space-between',
        backgroundColor: C.pri, opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }], borderWidth: T.hc ? 3 : 0, borderColor: C.navy,
        shadowColor: C.pri, shadowOpacity: T.glass ? 0.25 : 0, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } })}>
      <Icon name={icon} size={T.simple ? 34 : 38} color={C.onPri} strokeWidth={2.2} />
      <View>
        <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(23), fontWeight: '800', color: C.onPri }}>{titulo}</Text>
        <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(13.5), fontWeight: '600', color: C.onPri, marginTop: 2 }}>{sub}</Text>
      </View>
    </Pressable>
  );
}

/** Opción grande dentro de la pregunta «¿Qué vas a hacer?». */
function Opcion({ icon, titulo, sub, onPress }: { icon: IconName; titulo: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${titulo}. ${sub}`} onPress={() => { buzz('tap'); onPress(); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: T.simple ? 92 : 78, borderRadius: 20, padding: 14,
        backgroundColor: C.soft, opacity: pressed ? 0.85 : 1, borderWidth: T.hc ? 2 : 0, borderColor: C.navy })}>
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: C.pri, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color={C.onPri} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(19), fontWeight: '800', color: C.navy }}>{titulo}</Text>
        <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(13.5), color: C.sub, marginTop: 2 }}>{sub}</Text>
      </View>
      <Icon name="chevron" size={20} color={C.sub} />
    </Pressable>
  );
}

/** Botón Ventas: ¿es una venta (te pagan ahora) o una cotización (te pagan después, queda en Por cobrar)? */
function ElegirVenta({ visible, onVenta, onCotizacion, onCerrar }: { visible: boolean; onVenta: () => void; onCotizacion: () => void; onCerrar: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onCerrar} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,12,24,0.45)' }]} />
        <View accessibilityViewIsModal style={{ backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, gap: 12,
          borderWidth: T.hc ? 2 : 0, borderColor: C.navy }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line }} />
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={{ fontSize: fs(22), fontWeight: '800', color: C.navy }}>¿Qué vas a hacer?</Text>
          <Opcion icon="ticket" titulo="Venta" sub="Te pagan ahora. Suma a tus ganancias." onPress={onVenta} />
          <Opcion icon="doc" titulo="Cotización" sub="Te pagan después. Queda en Por cobrar." onPress={onCotizacion} />
          <Btn title="Cancelar" kind="ghost" onPress={onCerrar} />
        </View>
      </View>
    </Modal>
  );
}

/** Acceso chico (Cotizar, Rentas, Entregas, Inventario) con su aviso, al final de Inicio. */
function AccesoChico({ icon, title, subtitle, alert, onPress }: { icon: IconName; title: string; subtitle: string; alert?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} onPress={() => { buzz('tap'); onPress(); }}
      style={({ pressed }) => ({ width: T.simple ? '100%' : '31%', minHeight: 88, borderRadius: 18, padding: 12, gap: 6, backgroundColor: C.card, opacity: pressed ? 0.85 : 1,
        borderWidth: alert ? 2 : T.border, borderColor: alert ? C.bad : T.hc ? C.line : C.hair })}>
      <Icon name={icon} size={22} color={alert ? C.bad : C.pri} />
      <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={{ fontSize: fs(14), fontWeight: '800', color: C.navy }}>{title}</Text>
      <Text maxFontSizeMultiplier={1.4} numberOfLines={2} style={{ fontSize: fs(11.5), color: alert ? C.bad : C.sub, fontWeight: alert ? '700' : '400' }}>{subtitle}</Text>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: any) {
  const st = useStore();
  const s = snapshot(st);
  const prof = st.profile!;
  const t = prof.terminology;
  const ui = prof.ui ?? configurar(prof); // perfiles viejos: el Configurador los arma al vuelo
  const th = PREDISENOS[ui.predisenoId] ?? PREDISENOS.comercio_inventario;
  const now = new Date();
  // Periodo de la meta (semana desde el lunes o mes desde el día 1): ventas pagadas − compras = saldo.
  const per = periodoDeMeta(ui.periodicidadMeta);
  const res = resumen(st.sales, st.purchases, rangoPeriodo(per, now));
  const conMeta = ui.ordenTarjetasHome.includes('meta_ingresos') && ui.ingresoMetaMXN > 0;
  const avance = conMeta ? res.ingresos / ui.ingresoMetaMXN : 0;
  const aFavor = res.saldo >= 0;
  const nombrePer = per === 'mes' ? 'Este mes' : 'Esta semana';
  const low = st.products.filter((p) => p.stock <= 2);
  const rentasAct = (st.rentals ?? []).filter((r) => r.status === 'activa');
  const vencidas = rentasAct.filter((r) => r.returnDate && new Date(r.returnDate + 'T23:59:59') < now);
  const porEntregar = (st.deliveries ?? []).filter((d) => d.status === 'pendiente' || d.status === 'en_camino');
  const contingencia = st.incidents.find((i) => !i.end);
  // Impuestos estimados del mismo periodo (Ajustes → Impuestos) y cotizaciones que aún no se cobran.
  const imp = estimarImpuestos(st.sales, st.purchases, rangoPeriodo(per, now), st.impuestos);
  const queda = Math.round((res.saldo - imp.total) * 100) / 100;
  const pend = porCobrar(st.cotizaciones ?? []);
  const [elegir, setElegir] = useState(false);

  function menu() {
    const ops: [string, () => void][] = [
      ['Estadísticas', () => navigation.navigate('Estadisticas')],
      ['Por cobrar (cotizaciones)', () => navigation.navigate('PorCobrar')],
      ...(prof.modules.quotes || prof.modules.rentals ? [['Cotizar', () => navigation.navigate('Cotizar')] as [string, () => void]] : []),
      ...(prof.modules.rentals ? [['Rentas', () => navigation.navigate('Rentas')] as [string, () => void]] : []),
      ...(prof.modules.delivery ? [['Entregas a domicilio', () => navigation.navigate('Entregas')] as [string, () => void]] : []),
      ['Accesibilidad', () => navigation.navigate('A11y')],
      ['Ajustes y modelos de IA', () => navigation.navigate('Settings')],
      ['Cumplimiento y bitácora', () => navigation.navigate('Audit')],
      ['Volver a entrevistarme con Hermes', () => navigation.navigate('Interview')],
    ];
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ title: prof.business_name, options: [...ops.map((o) => o[0]), 'Cancelar'], cancelButtonIndex: ops.length }, (i) => ops[i]?.[1]());
    else Alert.alert('Menú', undefined, [...ops.map(([text, onPress]) => ({ text, onPress })), { text: 'Cancelar', style: 'cancel' as const }]);
  }

  const TILES: Partial<Record<HomeCard, { icon: IconName; title: string; subtitle: string; go: () => void; alert?: boolean } | null>> = {
    escaner_recibos: { icon: 'camera', title: 'Foto a nota', subtitle: `Registra tu ${t.purchase.toLowerCase()}`, go: () => navigation.navigate('Receipt') },
    cobro: { icon: 'cash', title: 'Cobrar', subtitle: 'Efectivo, QR o transferencia', go: () => navigation.navigate('Sale') },
    cotizar: prof.modules.quotes || prof.modules.rentals ? { icon: 'doc', title: 'Cotizar', subtitle: 'Varios conceptos y anticipo', go: () => navigation.navigate('Cotizar') } : null,
    rentas: prof.modules.rentals ? { icon: 'key', title: 'Rentas', subtitle: vencidas.length ? `${vencidas.length} ya debían regresar` : `${rentasAct.length} activa(s)`, alert: vencidas.length > 0, go: () => navigation.navigate('Rentas') } : null,
    entregas: prof.modules.delivery ? { icon: 'truck', title: 'Entregas', subtitle: porEntregar.length ? `${porEntregar.length} por entregar` : 'Sin pendientes', go: () => navigation.navigate('Entregas') } : null,
    inventario: prof.modules.inventory ? { icon: 'box', title: t.stock, subtitle: low.length ? `${low.length} por acabarse` : `${st.products.length} ${t.items.toLowerCase()}`, alert: low.length > 0, go: () => navigation.navigate('Inventario') } : null,
  };
  const orden: HomeCard[] = ui.ordenTarjetasHome.filter((k) => k !== 'meta_ingresos' && k !== 'asistente');
  // Compras y Ventas son los dos botones grandes; el resto queda como accesos chicos (en el orden del Configurador).
  const accesos = orden.filter((k) => k !== 'escaner_recibos' && k !== 'cobro').map((k) => ({ k, d: TILES[k] })).filter((x) => !!x.d) as { k: HomeCard; d: NonNullable<(typeof TILES)[HomeCard]> }[];

  type Mov = { id: string; date: string; icon: IconName; color: string; bg: string; title: string; sub: string; amount?: number; sign: string };
  const movs: Mov[] = [
    ...st.sales.map((x) => ({ id: 's' + x.id, date: x.date, icon: (x.status === 'pagada' ? 'up' : 'alert') as IconName, color: x.status === 'pagada' ? C.ok : C.bad, bg: x.status === 'pagada' ? C.okBg : C.badBg,
      title: x.status === 'pagada' ? x.concept : `Cobro fallido · ${x.concept}`, sub: `${PAYMENT_LABEL[x.method]} · ${hora(x.date)}`, amount: x.amount, sign: x.status === 'pagada' ? '+' : '' })),
    ...st.purchases.map((x) => ({ id: 'p' + x.id, date: x.date, icon: 'down' as IconName, color: C.pri, bg: C.soft, title: `${t.purchase}: ${x.supplier || 'proveedor'}`, sub: `${x.items.length} renglones · ${hora(x.date)}`, amount: x.total, sign: '−' })),
    ...(st.rentals ?? []).map((x) => ({ id: 'r' + x.id, date: x.date, icon: 'key' as IconName, color: C.pri, bg: C.soft, title: `Renta: ${x.client}`, sub: `${x.status === 'activa' ? 'Regresa ' + x.returnDate : 'Devuelta'} · ${hora(x.date)}`, amount: x.amount, sign: '' })),
    ...(st.deliveries ?? []).map((x) => ({ id: 'd' + x.id, date: x.updatedAt ?? x.date, icon: 'truck' as IconName, color: C.pri, bg: C.soft, title: `Entrega: ${x.client}`, sub: `${DELIVERY_LABEL[x.status].replace(/^\S+\s/, '')} · ${hora(x.updatedAt ?? x.date)}`, amount: x.amount + x.fee, sign: '' })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <IconButton icon="menu" label="Menú: accesibilidad, ajustes, cumplimiento" onPress={menu} size={48} />
        <Vidrio radius={18} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
          <View accessible accessibilityLabel={`Ventas de hoy: ${moneyA11y(s.ventas_hoy)}`} style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: fs(11), fontWeight: '800', color: C.sub, letterSpacing: 0.8 }}>VENTAS DE HOY</Text>
            <Amount n={s.ventas_hoy} size={25} />
          </View>
        </Vidrio>
      </Row>

      <View style={{ marginTop: 18 }}>
        <Text style={{ fontSize: fs(15), color: C.sub }}>Hola, bienvenido <Text accessibilityElementsHidden importantForAccessibility="no">👋</Text></Text>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={{ fontSize: fs(31), fontWeight: '800', color: C.navy, letterSpacing: -0.5 }}>{prof.business_name}</Text>
        <View accessible accessibilityLabel={`Diseño: ${th.label}`} style={{ alignSelf: 'flex-start', marginTop: 6, backgroundColor: th.soft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: T.hc ? 2 : 0, borderColor: th.accent }}>
          <Text style={{ fontSize: fs(12), fontWeight: '700', color: th.accent }}>{th.emoji} {th.label}</Text>
        </View>
      </View>

      {contingencia ? <View style={{ marginTop: 14 }}><Banner kind="warn" text={`Contingencia de pagos activa: ${contingencia.reason}. Puedes cobrar en efectivo y queda registrado.`} /></View> : null}

      <View style={{ flexDirection: T.simple ? 'column' : 'row', gap: 12, marginTop: 18, marginBottom: 14 }}>
        <BotonGrande icon="camera" titulo="Compras" sub="Foto a tu ticket" hint="Abre la cámara, lee el ticket y te deja revisar la compra antes de guardarla"
          onPress={() => navigation.navigate('Receipt', { camara: Date.now() })} />
        <BotonGrande icon="ticket" titulo="Ventas" sub="Cobra o cotiza" hint="Te pregunta si es una venta (te pagan ahora) o una cotización (te pagan después)"
          onPress={() => setElegir(true)} />
      </View>
      <ElegirVenta visible={elegir} onCerrar={() => setElegir(false)}
        onVenta={() => { setElegir(false); navigation.navigate('Sale'); }}
        onCotizacion={() => { setElegir(false); navigation.navigate('Cotizar'); }} />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row><Icon name="target" size={20} color={th.accent} /><P bold>{nombrePer}</P></Row>
          {conMeta ? <Small>{Math.round(avance * 100)}% de tu meta</Small> : null}
        </Row>
        {conMeta ? (
          <View style={{ marginTop: 8 }}>
            <ProgressBar value={avance} label={`Avance de tu meta ${ui.periodicidadMeta}`} color={th.accent} />
            <Small style={{ marginTop: 4 }}>{money(res.ingresos)} de {money(ui.ingresoMetaMXN)}</Small>
          </View>
        ) : null}
        <View accessible style={{ marginTop: 10 }}
          accessibilityLabel={`${nombrePer}: ventas ${moneyA11y(res.ingresos)}, compras ${moneyA11y(res.gastos)}. Saldo ${moneyA11y(Math.abs(res.saldo))} ${aFavor ? 'a favor' : 'en contra'}.`
            + (imp.calcula ? ` Impuestos estimados ${moneyA11y(imp.total)}. Te queda ${queda < 0 ? 'menos ' : ''}${moneyA11y(Math.abs(queda))}.` : '')}>
          <Row style={{ justifyContent: 'space-between' }}><P>Ventas</P><P bold>+{money(res.ingresos)}</P></Row>
          <Row style={{ justifyContent: 'space-between' }}><P>Compras</P><P bold>−{money(res.gastos)}</P></Row>
          <View style={{ height: T.border, backgroundColor: C.line, marginVertical: 8 }} />
          <Row style={{ justifyContent: 'space-between' }}>
            <P bold size={17}>Saldo</P>
            <Row style={{ gap: 4 }}>
              <Icon name={aFavor ? 'up' : 'down'} size={18} color={aFavor ? C.ok : C.bad} />
              <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(19), fontWeight: '800', color: aFavor ? C.ok : C.bad }}>{money(Math.abs(res.saldo))}</Text>
              <Text maxFontSizeMultiplier={1.4} style={{ fontSize: fs(14), fontWeight: '700', color: aFavor ? C.ok : C.bad }}>{aFavor ? 'a favor' : 'en contra'}</Text>
            </Row>
          </Row>
          {imp.calcula ? (
            <>
              <Row style={{ justifyContent: 'space-between', marginTop: 6 }}><P color={C.sub}>Impuestos estimados (IVA + ISR)</P><P bold>−{money(imp.total)}</P></Row>
              <Row style={{ justifyContent: 'space-between' }}><P bold>Te queda</P><P bold color={queda >= 0 ? C.ok : C.bad}>{queda < 0 ? '−' : ''}{money(Math.abs(queda))}</P></Row>
            </>
          ) : null}
        </View>
        <Btn title="Ver estadísticas" kind="ghost" icon="chevron" onPress={() => navigation.navigate('Estadisticas')} style={{ marginTop: 6 }} />
      </Card>

      {pend.length ? (
        <>
          <Row style={{ justifyContent: 'space-between', marginTop: 8, marginBottom: 8 }}>
            <H style={{ marginBottom: 0 }}>Por cobrar</H>
            <Small>{money(totalPorCobrar(pend))} · no suma aún</Small>
          </Row>
          {pend.slice(0, 3).map((c) => <FilaCotizacion key={c.id} c={c} onPress={() => navigation.navigate('Cotizacion', { id: c.id })} />)}
          <Btn title={pend.length > 3 ? `Ver todas (${pend.length})` : 'Ver Por cobrar'} kind="ghost" icon="chevron" onPress={() => navigation.navigate('PorCobrar')} />
        </>
      ) : null}

      <Row style={{ justifyContent: 'space-between', marginTop: 8, marginBottom: 8 }}>
        <H style={{ marginBottom: 0 }}>Movimientos</H>
        <Small>Los más recientes</Small>
      </Row>
      {movs.length === 0
        ? <Card><Row><Icon name="clock" size={20} color={C.sub} /><P color={C.sub} style={{ flex: 1 }}>Aún no hay movimientos. Registra tu primera operación.</P></Row></Card>
        : movs.map((m) => (
          <ListRow key={m.id} icon={m.icon} iconColor={m.color} iconBg={m.bg} title={m.title} subtitle={m.sub}
            value={m.amount != null ? `${m.sign}${money(m.amount)}` : undefined} valueA11y={m.amount != null ? moneyA11y(m.amount) : undefined}
            valueColor={m.sign === '+' ? C.ok : C.navy} />
        ))}
      {accesos.length ? (
        <>
          <H style={{ marginTop: 16 }}>Más herramientas</H>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {accesos.map(({ k, d }) => <AccesoChico key={k} icon={d.icon} title={d.title} subtitle={d.subtitle} alert={d.alert} onPress={d.go} />)}
          </View>
        </>
      ) : null}
      <Small style={{ textAlign: 'center', marginTop: 8 }}>IA local en tu iPhone · tus datos no salen del teléfono</Small>
    </Screen>
  );
}

export function SalesScreen({ navigation }: any) {
  const st = useStore();
  const t = st.profile!.terminology;
  const today = new Date().toDateString();
  const list = st.sales.filter((s) => new Date(s.date).toDateString() === today).reverse();
  const tot = list.filter((s) => s.status === 'pagada').reduce((a, s) => a + s.amount, 0);
  return (
    <Screen>
      <PageHeader title={`${t.sale}s`} subtitle={`Hoy llevas ${money(tot)} en ${list.filter((s) => s.status === 'pagada').length} cobro(s)`} />
      <Btn title={`Nueva ${t.sale.toLowerCase()}`} icon="plus" onPress={() => navigation.navigate('Sale')} hint="Abre la pantalla de cobro" />
      <View style={{ height: 10 }} />
      {list.length === 0 ? <Card><P color={C.sub}>Sin movimientos hoy.</P></Card> : list.map((s) => (
        <ListRow key={s.id} icon={s.status === 'pagada' ? 'up' : 'alert'} iconColor={s.status === 'pagada' ? C.ok : C.bad} iconBg={s.status === 'pagada' ? C.okBg : C.badBg}
          title={s.concept} subtitle={`${PAYMENT_LABEL[s.method]} · ${s.status}${s.isSimulated ? ' · simulado/prueba' : ''} · ${hora(s.date)}`}
          value={money(s.amount)} valueA11y={moneyA11y(s.amount)} valueColor={s.status === 'pagada' ? C.ok : C.bad} />
      ))}
    </Screen>
  );
}

export function PurchasesScreen({ navigation }: any) {
  const st = useStore();
  const t = st.profile!.terminology;
  return (
    <Screen>
      <PageHeader title={t.purchase} subtitle="Notas y tickets de tus proveedores" />
      <Btn title={`Nueva ${t.purchase.toLowerCase()} con foto`} icon="camera" onPress={() => navigation.navigate('Receipt')} hint="Toma foto a la nota impresa o escrita a mano" />
      <View style={{ height: 10 }} />
      {st.purchases.length === 0 ? <Card><P color={C.sub}>Aún no registras compras.</P></Card> : [...st.purchases].reverse().map((p) => (
        <ListRow key={p.id} icon="down" title={p.supplier || 'Proveedor'} subtitle={`${hora(p.date)} · ${p.items.length} renglones · ${p.source.replace(/_/g, ' ')}`}
          value={money(p.total)} valueA11y={moneyA11y(p.total)} />
      ))}
    </Screen>
  );
}

export function InventoryScreen({ navigation }: any) {
  const st = useStore();
  const t = st.profile!.terminology;
  return (
    <Screen>
      <PageHeader title={t.stock} subtitle="Existencias, costo y precio de venta" />
      <Card>
        <Row><Icon name="box" size={20} color={C.pri} /><P bold>{st.products.length} {t.items.toLowerCase()} registrados</P></Row>
      </Card>
      {st.products.length === 0 ? (
        <Card><P>Sin {t.items.toLowerCase()} todavía.</P><Small>Toma foto a la nota de tu proveedor y se llenan solos.</Small></Card>
      ) : (
        <Card>
          <Row style={{ marginBottom: 8 }} >
            <Small style={{ flex: 1, fontWeight: '700' }}>{t.item}</Small><Small style={{ width: 56, textAlign: 'right', fontWeight: '700' }}>Cant.</Small><Small style={{ width: 92, textAlign: 'right', fontWeight: '700' }}>Precio</Small>
          </Row>
          {st.products.map((p) => <ProductRow key={p.id} id={p.id} />)}
        </Card>
      )}
      <Small>Lo que lee la cámara siempre se revisa antes de guardar.</Small>
      <Btn title="Escanear nota de proveedor" icon="camera" onPress={() => navigation.navigate('Receipt')} />
    </Screen>
  );
}

function ProductRow({ id }: { id: string }) {
  const st = useStore();
  const p = st.products.find((x) => x.id === id)!;
  const [precio, setPrecio] = useState(p.price != null ? String(p.price) : '');
  const bajo = p.stock <= 2;
  return (
    <View style={{ borderTopWidth: T.border, borderColor: C.line, paddingVertical: 10 }}>
      <View accessible accessibilityLabel={`${p.name}: ${Math.round(p.stock)} en existencia${bajo ? ', por acabarse' : ''}. Costo ${moneyA11y(p.unitCost)}.`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <P style={{ flex: 1 }} bold>{p.name}</P>
        <Text style={{ width: 56, textAlign: 'right', fontSize: fs(18), fontWeight: '800', color: bajo ? C.bad : C.navy }}>{Math.round(p.stock)}</Text>
        <View style={{ width: 92 }} />
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Small>Costo {money(p.unitCost)}{bajo ? ' · ⚠︎ por acabarse' : ''}</Small>
        <Field accessibilityLabel={`Precio de venta de ${p.name}`} keyboardType="decimal-pad" placeholder="Precio $" value={precio} onChangeText={setPrecio}
          containerStyle={{ width: 110, marginBottom: 0 }} style={{ minHeight: 40, paddingVertical: 8, textAlign: 'right' }}
          onEndEditing={() => st.set({ products: st.products.map((x) => (x.id === p.id ? { ...x, price: parseFloat(precio) || null } : x)) })} />
      </Row>
    </View>
  );
}

export function QuotesScreen({ navigation }: any) {
  const st = useStore();
  const prof = st.profile!;
  const renta = !!prof.modules.rentals;
  const [client, setClient] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea()]);
  const [extra, setExtra] = useState(''); // flete / envío / instalación
  const [dep, setDep] = useState(prof.modules.deposits ? '50' : '0');
  const [guardando, setGuardando] = useState(false);
  const items = aRenglones(lineas);
  const ex = Math.max(0, parseFloat(extra.replace(',', '.')) || 0), a = Math.round((totalRenglones(items) + ex) * 100) / 100;
  const pct = Math.min(100, Math.max(0, parseFloat(dep.replace(',', '.')) || 0));
  const d = Math.round(a * pct) / 100;
  const ok = !!client.trim() && items.length > 0;
  // Se guarda en Por cobrar; los cobros (anticipo y liquidación) se hacen desde ahí cuando el cliente confirma.
  async function guardar() {
    if (!ok || guardando) return;
    setGuardando(true);
    const renglones = [...items, ...(ex > 0 ? [{ name: 'Cargos (flete y extras)', qty: 1, price: ex }] : [])];
    const c = await st.guardarCotizacion({ cliente: client, renglones, anticipoPct: pct });
    buzz('ok'); speak(`Cotización ${c.folio} guardada en Por cobrar.`);
    navigation.replace('Cotizacion', { id: c.id, nueva: true });
  }
  return (
    <Screen padTop={false}>
      <P color={C.sub}>Un renglón por cosa (50 sillas, 5 mesas, 1 inflable…). El total se calcula solo.</P>
      <View style={{ height: 10 }} />
      <Card>
        <Field label="Cliente" value={client} onChangeText={setClient} />
        <LineasEditor lineas={lineas} onChange={setLineas} placeholder={renta ? 'Ej. Sillas plegables' : 'Ej. Protección 1.2×1.5'} />
        <View style={{ marginTop: 10 }}>
          <Field label={prof.modules.delivery || renta ? 'Flete, envío o instalación $ (opcional)' : 'Otros cargos $ (opcional)'} keyboardType="decimal-pad" value={extra} onChangeText={setExtra} />
          <Field label="Anticipo que pides % (0 si no pides)" keyboardType="number-pad" value={dep} onChangeText={setDep} />
        </View>
        <Row style={{ justifyContent: 'space-between' }}><P bold size={18}>Total</P><Amount n={a} size={22} /></Row>
        {d > 0 ? <Small>Anticipo {money(d)} · Resta {money(Math.round((a - d) * 100) / 100)}</Small> : null}
      </Card>
      <Btn title="Guardar cotización" icon="doc" disabled={!ok} loading={guardando} onPress={guardar} hint="Queda en Por cobrar; no suma a tus ganancias hasta que te paguen" />
      {renta && <Btn title="Convertir en renta" icon="key" kind="sec" disabled={!ok} hint="Pasa la cotización a Rentas con depósito y fecha de devolución"
        onPress={() => navigation.navigate('Rentas', { client, lineas: lineasValidas(lineas), extra: ex })} />}
      <Small>{ok ? 'Al guardarla queda en Por cobrar: ahí recibes el anticipo o cobras todo cuando tu cliente confirme.' : 'Para continuar pon el cliente y al menos un renglón con concepto y precio.'}</Small>
    </Screen>
  );
}
