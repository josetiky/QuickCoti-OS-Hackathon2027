// Rentas (con depósito y fecha de devolución) y entregas a domicilio. Se activan si Hermes + Configurador detectan que el negocio las usa.
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { DELIVERY_LABEL, money, type DeliveryStatus } from '../types';
import { Banner, Btn, C, Card, Field, H, LineasEditor, lineasValidas, nuevaLinea, P, resumenLineas, Row, Small, totalLineas, type Linea } from '../ui';

const hoyMas = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const vencida = (f: string) => !!f && new Date(f + 'T23:59:59') < new Date();

const vacio = () => ({ client: '', phone: '', address: '', flete: '', deposit: '', returnDate: hoyMas(1) });

export function RentalsScreen({ navigation, route }: any) {
  const st = useStore();
  const [nuevo, setNuevo] = useState(false);
  const [f, setF] = useState(vacio());
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea()]);
  // Viene de "Convertir en renta" en Cotizar: precarga cliente y conceptos
  useEffect(() => {
    const p = route?.params;
    if (p?.lineas?.length) { setF({ ...vacio(), client: p.client ?? '', flete: p.extra ? String(p.extra) : '' }); setLineas(p.lineas); setNuevo(true); navigation.setParams({ lineas: undefined }); }
  }, [route?.params?.lineas]);
  const activas = st.rentals.filter((r) => r.status === 'activa');
  const vencidas = activas.filter((r) => vencida(r.returnDate));
  const amount = totalLineas(lineas) + (parseFloat(f.flete) || 0);
  const valid = !!f.client.trim() && lineasValidas(lineas).length > 0 && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(f.returnDate);

  async function guardar(cobrar: boolean) {
    const deposit = parseFloat(f.deposit) || 0, flete = parseFloat(f.flete) || 0;
    const items = resumenLineas(lineas) + (flete ? ` + flete ${money(flete)}` : '') + (f.address.trim() ? ` · entregar en ${f.address.trim()}` : '');
    const r = await st.addRental({ client: f.client.trim(), phone: f.phone.trim(), items, amount, deposit, returnDate: f.returnDate });
    if (f.address.trim() && st.profile?.modules.delivery)
      await st.addDelivery({ client: r.client, phone: r.phone, address: f.address.trim(), concept: `Renta: ${resumenLineas(lineas)}`, amount: 0, fee: flete });
    setNuevo(false); setF(vacio()); setLineas([nuevaLinea()]);
    if (cobrar) navigation.navigate('Sale', { concept: `Renta: ${r.items} (${r.client})` + (deposit ? ` + depósito ${money(deposit)}` : ''), amount: amount + deposit });
  }

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <P color={C.sub}>Lo que rentas, el depósito que te dejan y cuándo te lo regresan.</P>
      <View style={{ height: 10 }} />
      <Row style={{ gap: 8 }}>
        <Card style={{ flex: 1 }}><Small>Activas</Small><Text style={{ fontSize: 22, fontWeight: '800', color: C.navy }}>{activas.length}</Text></Card>
        <Card style={{ flex: 1 }}><Small>Depósitos que debes</Small><Text style={{ fontSize: 18, fontWeight: '800', color: C.navy }}>{money(activas.reduce((a, r) => a + r.deposit, 0))}</Text></Card>
      </Row>
      {vencidas.length > 0 && <Banner color={C.bad} text={`⏰ ${vencidas.length} renta(s) ya debían regresar: ${vencidas.map((r) => r.client).join(', ')}`} />}
      {!nuevo ? <Btn title="+ Nueva renta" onPress={() => setNuevo(true)} /> : (
        <Card>
          <Field label="Cliente" value={f.client} onChangeText={(v) => setF({ ...f, client: v })} />
          <Field label="Teléfono (opcional)" keyboardType="phone-pad" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} />
          <Small>¿Qué rentas? (un renglón por cosa)</Small>
          <LineasEditor lineas={lineas} onChange={setLineas} placeholder="Ej. Sillas" />
          <View style={{ marginTop: 10 }} />
          <Field label="Dirección del evento (opcional)" placeholder="Si lo llevas tú" value={f.address} onChangeText={(v) => setF({ ...f, address: v })} />
          <Row><View style={{ flex: 1 }}><Field label="Flete / instalación $" keyboardType="decimal-pad" value={f.flete} onChangeText={(v) => setF({ ...f, flete: v })} /></View>
            <View style={{ flex: 1 }}><Field label="Depósito $" keyboardType="decimal-pad" value={f.deposit} onChangeText={(v) => setF({ ...f, deposit: v })} /></View></Row>
          <Field label="Fecha de devolución (AAAA-MM-DD)" value={f.returnDate} onChangeText={(v) => setF({ ...f, returnDate: v })} />
          <Row>{[0, 1, 3, 7].map((d) => (
            <Pressable key={d} onPress={() => setF({ ...f, returnDate: hoyMas(d) })} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: C.soft }}>
              <Text style={{ color: C.pri, fontWeight: '600' }}>{d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `${d} días`}</Text></Pressable>))}</Row>
          <P>Renta {money(amount)} + depósito {money(parseFloat(f.deposit) || 0)} = <Text style={{ fontWeight: '800' }}>{money(amount + (parseFloat(f.deposit) || 0))}</Text></P>
          {f.address.trim() && st.profile?.modules.delivery ? <Small>También se crea la entrega en 🛵 Entregas.</Small> : null}
          <Btn title="Guardar y cobrar" disabled={!valid} onPress={() => guardar(true)} />
          <Btn title="Solo guardar (cobro después)" kind="sec" disabled={!valid} onPress={() => guardar(false)} />
          <Btn title="Cancelar" kind="sec" onPress={() => { setNuevo(false); setLineas([nuevaLinea()]); }} />
        </Card>
      )}
      {[...st.rentals].reverse().map((r) => (
        <Card key={r.id}>
          <Row style={{ justifyContent: 'space-between' }}><P>{r.client}</P><P>{money(r.amount)}</P></Row>
          <Small>{r.items}{r.phone ? ` · ${r.phone}` : ''}</Small>
          <Small color={r.status === 'activa' && vencida(r.returnDate) ? C.bad : C.sub}>
            {r.status === 'activa' ? `Regresa: ${r.returnDate}${vencida(r.returnDate) ? ' (VENCIDA)' : ''}` : `Devuelta ${new Date(r.returnedAt!).toLocaleDateString('es-MX')}`}
            {r.deposit ? ` · Depósito ${money(r.deposit)}${r.status === 'devuelta' ? (r.depositReturned ? ' devuelto' : ' retenido') : ''}` : ''}</Small>
          {r.status === 'activa' && (
            <Btn title="Marcar como devuelta" kind="sec" onPress={() => r.deposit
              ? Alert.alert('¿Regresas el depósito?', `${money(r.deposit)} a ${r.client}`, [
                  { text: 'Sí, completo', onPress: () => st.returnRental(r.id, true) },
                  { text: 'No (daño o faltante)', style: 'destructive', onPress: () => st.returnRental(r.id, false) },
                  { text: 'Cancelar', style: 'cancel' }])
              : st.returnRental(r.id, false)} />
          )}
        </Card>
      ))}
      {!st.rentals.length && !nuevo && <Small>Aún no registras rentas.</Small>}
    </ScrollView>
  );
}

const NEXT: Record<DeliveryStatus, DeliveryStatus | null> = { pendiente: 'en_camino', en_camino: 'entregado', entregado: null, cancelado: null };

export function DeliveriesScreen({ navigation }: any) {
  const st = useStore();
  const [nuevo, setNuevo] = useState(false);
  const [f, setF] = useState({ client: '', phone: '', address: '', concept: '', amount: '', fee: '' });
  const abiertas = st.deliveries.filter((d) => d.status === 'pendiente' || d.status === 'en_camino');
  const valid = f.client.trim() && f.address.trim() && f.concept.trim() && (parseFloat(f.amount) || 0) > 0;

  async function guardar(cobrar: boolean) {
    const amount = parseFloat(f.amount) || 0, fee = parseFloat(f.fee) || 0;
    const d = await st.addDelivery({ client: f.client.trim(), phone: f.phone.trim(), address: f.address.trim(), concept: f.concept.trim(), amount, fee });
    setNuevo(false); setF({ client: '', phone: '', address: '', concept: '', amount: '', fee: '' });
    if (cobrar) navigation.navigate('Sale', { concept: `${d.concept} a domicilio (${d.client})` + (fee ? ` + envío ${money(fee)}` : ''), amount: amount + fee });
  }

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <P color={C.sub}>Pedidos que llevas a casa del cliente, con su estado.</P>
      <View style={{ height: 10 }} />
      <Card><Row style={{ justifyContent: 'space-between' }}><P>Por entregar</P><Text style={{ fontSize: 22, fontWeight: '800', color: C.navy }}>{abiertas.length}</Text></Row></Card>
      {!nuevo ? <Btn title="+ Nuevo pedido a domicilio" onPress={() => setNuevo(true)} /> : (
        <Card>
          <Field label="Cliente" value={f.client} onChangeText={(v) => setF({ ...f, client: v })} />
          <Field label="Teléfono (opcional)" keyboardType="phone-pad" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} />
          <Field label="Dirección o referencia" placeholder="Ej. Calle Juárez 12, portón verde" value={f.address} onChangeText={(v) => setF({ ...f, address: v })} />
          <Field label="¿Qué lleva?" placeholder="Ej. 2 comidas corridas" value={f.concept} onChangeText={(v) => setF({ ...f, concept: v })} />
          <Row><View style={{ flex: 1 }}><Field label="Importe $" keyboardType="decimal-pad" value={f.amount} onChangeText={(v) => setF({ ...f, amount: v })} /></View>
            <View style={{ flex: 1 }}><Field label="Costo de envío $" keyboardType="decimal-pad" value={f.fee} onChangeText={(v) => setF({ ...f, fee: v })} /></View></Row>
          <P>Total: {money((parseFloat(f.amount) || 0) + (parseFloat(f.fee) || 0))}</P>
          <Btn title="Guardar y cobrar ahora" disabled={!valid} onPress={() => guardar(true)} />
          <Btn title="Guardar (cobra al entregar)" kind="sec" disabled={!valid} onPress={() => guardar(false)} />
          <Btn title="Cancelar" kind="sec" onPress={() => setNuevo(false)} />
        </Card>
      )}
      <FlatList scrollEnabled={false} data={[...st.deliveries].reverse()} keyExtractor={(d) => d.id}
        ListEmptyComponent={!nuevo ? <Small>Aún no hay pedidos a domicilio.</Small> : null}
        renderItem={({ item: d }) => (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}><P>{d.client}</P><P>{money(d.amount + d.fee)}</P></Row>
            <Small>{d.concept} · {d.address}{d.phone ? ` · ${d.phone}` : ''}</Small>
            <Small color={d.status === 'cancelado' ? C.bad : d.status === 'entregado' ? C.ok : C.warn} style={{ fontWeight: '700' }}>{DELIVERY_LABEL[d.status]}</Small>
            {NEXT[d.status] && (
              <Row style={{ marginTop: 6 }}>
                <View style={{ flex: 1 }}><Btn title={NEXT[d.status] === 'en_camino' ? 'Salió a entregar' : 'Entregado'} onPress={() => st.setDeliveryStatus(d.id, NEXT[d.status]!)} /></View>
                <View style={{ flex: 1 }}><Btn title="Cobrar" kind="sec" onPress={() => navigation.navigate('Sale', { concept: `${d.concept} a domicilio (${d.client})`, amount: d.amount + d.fee })} /></View>
              </Row>
            )}
            {d.status === 'pendiente' && <Pressable accessibilityRole="button" accessibilityLabel={`Cancelar pedido de ${d.client}`} style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => st.setDeliveryStatus(d.id, 'cancelado')}><Small color={C.bad} style={{ fontWeight: '700' }}>Cancelar pedido</Small></Pressable>}
          </Card>
        )} />
    </ScrollView>
  );
}
