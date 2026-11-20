// Foto de nota/ticket → NUESTRO detector (ONNX en el iPhone) → OCR QVAC por zona → Hermes estructura → REVISIÓN → confirmar.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { detect } from '../ai/vision';
import { ocrBlocks, ocrText, qvacState } from '../ai/qvac';
import { toLines, zonificar } from '../ai/zonas';
import { structure } from '../ai/hermes';
import { brightness, crop, normalize, type Img } from '../ai/image';
import { useStore } from '../store';
import { money, uid, type Box, type ReceiptItem } from '../types';
import { Amount, Banner, Btn, C, Card, confirmar, Field, fs, H, IconButton, IconChip, P, Row, Small, T, ToggleRow } from '../ui';
import { confirmacionCompra, pasoPermiso } from '../avisos';
import { Icon } from '../icons';
import { announce, buzz, moneyA11y, speak } from '../a11y';

type Phase = { k: 'pick' } | { k: 'work'; msg: string } | { k: 'review' } | { k: 'error'; msg: string; ajustes?: boolean } | { k: 'done'; secs: number };
const COLORS: Record<string, string> = { proveedor: '#7C3AED', fecha: '#2563EB', renglon: '#16A34A', total: '#DC2626', folio: '#6B7280' };

export default function ReceiptFlowScreen({ navigation, route, manual }: any) {
  const st = useStore();
  // manual: viene de la red de seguridad («Capturar a mano») → directo a capturar, sin abrir la cámara.
  const [phase, setPhase] = useState<Phase>(manual ? { k: 'review' } : { k: 'pick' });
  const [img, setImg] = useState<Img | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [docType, setDocType] = useState('desconocido');
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState('');
  const [items, setItems] = useState<ReceiptItem[]>(() => (manual ? [{ id: uid(), name: '', qty: 1, unit_cost: 0, confidence: 1 }] : []));
  const [total, setTotal] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [models, setModels] = useState('');
  const [ocrZones, setOcrZones] = useState<Record<string, string[]>>({});
  const [showOcr, setShowOcr] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [rules, setRules] = useState<string[]>([]);
  const [t0, setT0] = useState(Date.now());
  const term = st.profile?.terminology;

  // Botón "Compras" de Inicio: abre la cámara en cuanto entras (si cancelas, quedan las opciones de cámara y galería).
  useEffect(() => { if (route?.params?.camara && !manual) pick(true); }, [route?.params?.camara]);

  // Permisos: si iOS aún puede preguntar, sale su ventana; si ya se negó, explicamos cómo darlo y llevamos a Ajustes.
  // El acceso limitado a fotos (solo algunas) también sirve.
  async function pick(camera: boolean) {
    const actual = camera ? await ImagePicker.getCameraPermissionsAsync() : await ImagePicker.getMediaLibraryPermissionsAsync();
    let paso = pasoPermiso(actual);
    if (paso === 'pedir') paso = pasoPermiso(camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync());
    if (paso !== 'usar') return setPhase({ k: 'error', ajustes: true, msg: camera
      ? 'QuickCoti no tiene permiso para usar la cámara. Dáselo en Ajustes → QuickCoti → Cámara, o elige la foto de tu galería.'
      : 'QuickCoti no tiene permiso para ver tus fotos. Dáselo en Ajustes → QuickCoti → Fotos (acceso completo o limitado).' });
    const r = camera ? await ImagePicker.launchCameraAsync({ quality: 0.9 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, mediaTypes: ['images'] as any });
    if (r.canceled || !r.assets?.[0]) return;
    process(r.assets[0].uri);
  }

  async function process(uri: string) {
    setT0(Date.now());
    try {
      setPhase({ k: 'work', msg: 'Preparando la foto…' });
      const im = await normalize(uri); setImg(im);
      if ((await brightness(im)) < 0.18) return setPhase({ k: 'error', msg: 'La foto está muy oscura. Busca más luz e intenta de nuevo.' });
      setPhase({ k: 'work', msg: 'Buscando datos en la nota… (modelo de visión del equipo)' });
      // Si el detector no corre o no encuentra campos, NO nos rendimos: el OCR lee la foto completa y las reglas ordenan.
      let d: Awaited<ReturnType<typeof detect>> = { status: 'unreadable', doc_type: 'desconocido', boxes: [], model: 'sin detector' };
      try { d = await detect(im); } catch (e) { console.warn('El detector no corrió; sigo solo con OCR', e); }
      setBoxes(d.boxes); setDocType(d.doc_type);
      setPhase({ k: 'work', msg: d.doc_type === 'manuscrito' ? 'Leyendo letra a mano… (OCR QVAC)' : 'Leyendo el ticket… (OCR QVAC)' });
      // Lectura híbrida: OCR de la foto completa → renglones → zona según nuestro detector (o reglas si no hay caja)
      let zones: Record<string, string[]> = {};
      try { zones = zonificar(toLines(await ocrBlocks(im.uri), im.width, im.height), d.boxes); } catch (e) { console.warn('OCR completo falló, uso OCR por zona', e); }
      if (!zones.renglon?.length) { // respaldo: OCR solo dentro de las cajas (como antes), separando renglones
        // (sin recortes diminutos: el OCR nativo no los necesita y le pueden fallar)
        const fields = d.boxes.filter((b) => !b.label.startsWith('nota_') && b.bbox[2] * im.width >= 24 && b.bbox[3] * im.height >= 12).sort((a, b) => a.bbox[1] - b.bbox[1]);
        for (const b of fields) {
          const text = await ocrText(await crop(im, b.bbox));
          if (text.trim()) (zones[b.label] ??= []).push(text.trim());
        }
      }
      if (!Object.values(zones).some((v) => v.length)) return setPhase({ k: 'error', msg: 'No pude leer el texto del ticket. Toma la foto de frente, completa y con buena luz, o captúralo a mano.' });
      setOcrZones(zones);
      setPhase({ k: 'work', msg: 'Ordenando la información… (Hermes)' });
      const s = await structure(zones, d.doc_type, st.products.map((p) => p.name));
      if (s.status === 'unreadable') return setPhase({ k: 'error', msg: 'No pude leer los productos ni el total de este ticket. Prueba con otra foto (completa, plana y con buena luz) o captúralo a mano.' });
      setSupplier(s.supplier.value ?? ''); setDate(s.date.value ?? '');
      setItems(s.items.length ? s.items : [{ id: uid(), name: '', qty: 1, unit_cost: 0, confidence: 0 }]);
      setTotal(s.total != null ? s.total.toFixed(2) : ''); setMissing(s.missing);
      setModels(`${d.model} + ${qvacState.ocrLabel} + ${s.model}`);
      setPhase({ k: 'review' });
      const dudosos = s.items.filter((i) => i.confidence < 0.6).length;
      speak(`Leí ${s.items.length} renglones${s.total != null ? ` y un total de ${moneyA11y(s.total)}` : ''}.${dudosos ? ` ${dudosos} hay que revisarlos.` : ''} Revisa antes de guardar.`);
      buzz(dudosos || s.missing.length ? 'warn' : 'ok');
    } catch (e: any) {
      setPhase({ k: 'error', msg: e?.message ?? 'Algo falló al procesar la foto.' }); buzz('error');
    }
  }

  const sum = items.reduce((a, i) => a + i.qty * i.unit_cost, 0);
  const totalN = parseFloat(total.replace(',', '.'));
  const mismatch = !isNaN(totalN) && Math.abs(totalN - sum) > Math.max(1, 0.02 * totalN);
  const canConfirm = !isNaN(totalN) && items.length > 0 && items.every((i) => i.name.trim() && i.qty > 0);
  const upd = (id: string, p: Partial<ReceiptItem>) => setItems(items.map((i) => (i.id === id ? { ...i, ...p, confidence: 1 } : i)));

  async function confirm() {
    // Una compra guardada ya no se modifica: se confirma antes (la revisión de lo leído se hace arriba).
    const aviso = confirmacionCompra({ total: totalN, proveedor: supplier, renglones: items.length });
    if (!(await confirmar(aviso.titulo, aviso.mensaje, 'Sí, guardar'))) return;
    const source = !img ? 'manual' : docType === 'manuscrito' ? 'foto_manuscrito' : 'foto_impreso';
    const out = await st.confirmPurchase({ supplier, items, total: totalN, source, aiModel: img ? models : null, userConfirmed: true });
    setRules(out.messages);
    if (out.allowed) { setPhase({ k: 'done', secs: Math.round((Date.now() - t0) / 1000) }); buzz('ok'); speak(`${term?.purchase ?? 'Compra'} registrada por ${moneyA11y(totalN)}.`); }
    else buzz('error');
  }

  if (phase.k === 'work') return <Center><ActivityIndicator size="large" color={C.pri} /><View accessible accessibilityLiveRegion="polite" accessibilityLabel={phase.msg}><P style={{ textAlign: 'center' }}>{phase.msg}</P></View></Center>;
  if (phase.k === 'pick') return (
    <Center>
      <IconChip name="camera" size={84} />
      <H style={{ textAlign: 'center', marginTop: 10 }}>Toma foto a la nota o ticket de tu proveedor</H>
      <P color={C.sub} style={{ textAlign: 'center' }}>Sirve impresa o escrita a mano. Ponla plana, completa y con buena luz.</P>
      <View style={{ width: '100%', marginTop: 16 }}>
        <Btn title="Tomar foto" icon="camera" onPress={() => pick(true)} hint="Abre la cámara" />
        <Btn title="Elegir de la galería" icon="image" kind="sec" onPress={() => pick(false)} />
        <Btn title="Capturar a mano, sin foto" icon="pen" kind="sec" onPress={() => { setItems([{ id: uid(), name: '', qty: 1, unit_cost: 0, confidence: 1 }]); setPhase({ k: 'review' }); }} />
      </View>
    </Center>
  );
  if (phase.k === 'error') return (
    <Center>
      <IconChip name="alert" size={72} color={C.bad} bg={C.badBg} />
      <View accessible accessibilityRole="alert" accessibilityLabel={phase.msg}><P style={{ textAlign: 'center' }}>{phase.msg}</P></View>
      <View style={{ width: '100%', marginTop: 16 }}>
        {phase.ajustes ? <Btn title="Abrir Ajustes" icon="sliders" onPress={() => Linking.openSettings()} hint="Abre los ajustes de QuickCoti en tu iPhone para dar el permiso" /> : null}
        <Btn title="Intentar con otra foto" icon="camera" kind={phase.ajustes ? 'sec' : 'pri'} onPress={() => setPhase({ k: 'pick' })} />
        <Btn title="Elegir de la galería" icon="image" kind="sec" onPress={() => pick(false)} />
        <Btn title="Capturar a mano" kind="sec" onPress={() => { setImg(null); setItems([{ id: uid(), name: '', qty: 1, unit_cost: 0, confidence: 1 }]); setPhase({ k: 'review' }); }} />
      </View>
    </Center>
  );
  if (phase.k === 'done') return (
    <Center>
      <IconChip name="check" size={84} color={C.ok} bg={C.okBg} />
      <H style={{ marginTop: 10 }}>{term?.purchase ?? 'Compra'} registrada</H>
      {st.profile?.modules.inventory ? <P>Tu {term?.stock.toLowerCase()} se actualizó con {items.length} {term?.items.toLowerCase()}.</P> : null}
      <Small>Tiempo total: {phase.secs} s</Small>
      {rules.map((r) => <Small key={r}>{r}</Small>)}
      <View style={{ width: '100%', marginTop: 16 }}><Btn title="Listo" onPress={() => navigation.goBack()} /></View>
    </Center>
  );

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      {img && (
        <Card>
          <ToggleRow label="Ver lo que detectó el modelo" hint="Recuadros de proveedor, fecha, renglones y total" value={showBoxes} onChange={setShowBoxes} />
          <Boxed img={img} boxes={showBoxes ? boxes : []} />
          <Small>{docType === 'manuscrito' ? 'Nota a mano ✍️' : docType === 'impreso' ? 'Ticket impreso 🧾' : 'Tipo no identificado'}</Small>
        </Card>
      )}
      <Banner text="✋ Revisa y corrige antes de guardar. Lo marcado en ámbar la IA no lo leyó con seguridad." />
      {missing.map((m) => <Banner key={m} text={'Falta o ilegible: ' + m} color={C.bad} />)}
      {Object.keys(ocrZones).length > 0 && (
        <Card>
          <Pressable onPress={() => setShowOcr(!showOcr)}><Small color={C.pri}>{showOcr ? '▾ Ocultar' : '▸ Ver'} lo que leyó el OCR (transparencia)</Small></Pressable>
          {showOcr && Object.entries(ocrZones).map(([k, v]) => (
            <View key={k} style={{ marginTop: 6 }}><Small>{k.toUpperCase()}</Small>{v.map((t, i) => <Text key={i} style={{ fontSize: 12, color: C.text }}>• {t}</Text>)}</View>
          ))}
        </Card>
      )}
      <Card>
        <Field label="Proveedor" value={supplier} onChangeText={setSupplier} warn={!supplier} />
        <Field label="Fecha" value={date} onChangeText={setDate} />
      </Card>
      <Card>
        <Small>{term?.items ?? 'Productos'}</Small>
        {items.map((it) => (
          <View key={it.id} style={{ backgroundColor: it.confidence < 0.6 ? C.warnBg : 'transparent', borderRadius: 12, padding: 8, marginVertical: 4, borderWidth: it.confidence < 0.6 ? 1 : 0, borderColor: C.warn }}>
            {it.confidence < 0.6 ? <Small color={C.warn} style={{ fontWeight: '800', marginBottom: 4 }}>⚠︎ Revisa este renglón: la IA no lo leyó con seguridad</Small> : null}
            <Field placeholder={term?.item ?? 'Producto'} accessibilityLabel={`${term?.item ?? 'Producto'}, renglón ${items.indexOf(it) + 1}`} value={it.name} onChangeText={(v) => upd(it.id, { name: v })} />
            <Row>
              <View style={{ flex: 1 }}><Field label="Cant." keyboardType="decimal-pad" value={String(it.qty)} onChangeText={(v) => upd(it.id, { qty: parseFloat(v) || 0 })} /></View>
              <View style={{ flex: 1 }}><Field label="Costo c/u $" keyboardType="decimal-pad" value={String(it.unit_cost)} onChangeText={(v) => upd(it.id, { unit_cost: parseFloat(v) || 0 })} /></View>
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}><Amount n={it.qty * it.unit_cost} size={16} />
                <IconButton icon="close" label={`Quitar renglón ${items.indexOf(it) + 1}`} size={44} color={C.bad} onPress={() => setItems(items.filter((x) => x.id !== it.id))} /></View>
            </Row>
          </View>
        ))}
        <Btn title="Agregar renglón" icon="plus" kind="sec" onPress={() => setItems([...items, { id: uid(), name: '', qty: 1, unit_cost: 0, confidence: 1 }])} />
      </Card>
      <Card>
        <Field label="Total de la nota $" keyboardType="decimal-pad" value={total} onChangeText={setTotal} warn={isNaN(totalN)} />
        <Row style={{ justifyContent: 'space-between' }}><P>Suma de renglones</P><Amount n={sum} size={18} /></Row>
        {mismatch && <Banner text="La suma no cuadra con el total. Revisa cantidades o precios." />}
      </Card>
      <Btn title="Confirmar y guardar" icon="check" onPress={confirm} disabled={!canConfirm} hint="Guarda la compra y actualiza tu inventario" />
      {!canConfirm && <Small>Para guardar necesito el total y al menos un renglón con nombre y cantidad.</Small>}
      {rules.map((r) => <Small key={r} color={C.bad}>{r}</Small>)}
      {models ? <Small>Modelos usados: {models}</Small> : null}
    </ScrollView>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg, gap: 8 }}>{children}</View>
);

function Boxed({ img, boxes }: { img: Img; boxes: Box[] }) {
  const [w, setW] = useState(0);
  const h = 280;
  const sc = w ? Math.min(w / img.width, h / img.height) : 0;
  const dw = img.width * sc, dh = img.height * sc, ox = (w - dw) / 2, oy = (h - dh) / 2;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Foto de la nota. El modelo marcó ${boxes.filter((b) => !b.label.startsWith('nota_')).length} zonas.`}
      style={{ height: h, marginVertical: 8 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Image source={{ uri: img.uri }} style={{ width: '100%', height: h }} resizeMode="contain" />
      {sc > 0 && boxes.filter((b) => !b.label.startsWith('nota_')).map((b, i) => (
        <View key={i} style={{ position: 'absolute', left: ox + b.bbox[0] * dw, top: oy + b.bbox[1] * dh, width: b.bbox[2] * dw, height: b.bbox[3] * dh,
          borderWidth: 2, borderColor: COLORS[b.label] ?? '#F59E0B' }}>
          <Text style={{ position: 'absolute', top: -14, fontSize: 9, fontWeight: '700', color: '#fff', backgroundColor: COLORS[b.label] ?? '#F59E0B', paddingHorizontal: 2 }}>
            {b.label} {Math.round(b.confidence * 100)}%
          </Text>
        </View>
      ))}
    </View>
  );
}
