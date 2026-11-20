// Hermes por voz (asistente ajustado + órdenes de navegación), cumplimiento/bitácora y ajustes de modelos.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assistant, forceMock, setForceMock } from '../ai/hermes';
import { comando } from '../ai/comandos';
import { downloadModels, loadLLM, loadOCR, qvacState } from '../ai/qvac';
import { loadVision, visionLabel } from '../ai/vision';
import { audit, canonical } from '../ledger';
import { RULES, selfTest } from '../rules';
import { health } from '../payments';
import { snapshot, useStore } from '../store';
import { announce, buzz, speak, useDictation } from '../a11y';
import { Icon } from '../icons';
import { Banner, Btn, C, Card, Field, fs, H, IconButton, ListRow, MicButton, P, PageHeader, Row, Screen, Segmented, Small, T, ToggleRow } from '../ui';
import { TASAS_IVA, type RegimenImpuestos, type TasaIVA } from '../impuestos';
import { MisDatosCard } from './TitularScreen';
import { borrarTitular } from '../titular/secure';

type Msg = { mine: boolean; text: string; sources?: string[]; confirm?: boolean; oos?: boolean; model?: string };

export function AssistantScreen({ navigation, route }: any) {
  const st = useStore();
  const ins = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<Msg[]>([{ mine: false, text: 'Hola, soy Hermes. Pregúntame por tus ventas, compras o la ley de pagos digitales, o dame una orden como "cobra 50 pesos de un refresco".' }]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<any>(null);
  const dict = useDictation((text) => ask(text)); // al terminar de hablar, se envía solo
  const lastListen = useRef<any>(null);

  useEffect(() => { // el micrófono del Inicio abre Hermes ya escuchando
    const l = route?.params?.listen;
    if (l && l !== lastListen.current) { lastListen.current = l; dict.start(); }
  }, [route?.params?.listen]);

  const add = (m: Msg) => { setMsgs((x) => [...x, m]); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60); };

  async function ask(raw?: string) {
    const text = (raw ?? q).trim(); if (!text || busy) return;
    setQ(''); add({ mine: true, text });
    const cmd = comando(text, { profile: st.profile, products: st.products });
    if (cmd) { add({ mine: false, text: cmd.reply, model: 'Orden por reglas (solo navega y prepara borradores)' }); speak(cmd.reply); buzz('ok'); setTimeout(() => cmd.go(navigation), 700); return; }
    setBusy(true); announce('Hermes está pensando');
    try {
      const r = await assistant(text, st.profile, snapshot(st));
      add({ mine: false, text: r.answer, sources: r.sources, confirm: r.needs_confirmation, oos: r.out_of_scope, model: r.model });
      speak(r.answer);
    } catch (e: any) { add({ mine: false, text: 'No pude responder: ' + (e?.message ?? 'error') }); buzz('error'); }
    finally { setBusy(false); }
  }

  const sugerencias = ['¿Cuánto gané hoy?', '¿Puedo cobrar en efectivo si se cae el internet?', 'Cobra 50 pesos de un refresco',
    ...(st.profile?.modules.rentals ? ['¿Qué rentas tengo vencidas?'] : []), ...(st.profile?.modules.delivery ? ['¿Cuántas entregas me faltan?'] : [])];

  // La barra de pestañas flota encima: con el teclado cerrado, la barra de texto le deja espacio.
  const tabH = React.useContext(BottomTabBarHeightContext) ?? 0;
  const [tecladoAbierto, setTecladoAbierto] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardWillShow', () => setTecladoAbierto(true));
    const b = Keyboard.addListener('keyboardWillHide', () => setTecladoAbierto(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const espacioBarra = tabH && !tecladoAbierto ? tabH + Math.max(ins.bottom - 6, 10) : 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 20, paddingTop: ins.top + 10, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <PageHeader title="Hermes" subtitle="Habla o escribe · IA local en tu iPhone"
          right={<View accessible accessibilityLabel={qvacState.loraLoaded ? 'Modelo ajustado cargado' : 'Modelo sin cargar'} style={{ backgroundColor: qvacState.loraLoaded ? C.okBg : C.warnBg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontSize: fs(11), fontWeight: '800', color: qvacState.loraLoaded ? C.ok : C.warn }}>{qvacState.loraLoaded ? `LoRA v${qvacState.loraVersion}` : 'SIN CARGAR'}</Text></View>} />
        {msgs.map((m, i) => (
          <View key={i} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '90%', marginBottom: 12 }}>
            <View accessible accessibilityLabel={`${m.mine ? 'Tú' : 'Hermes'}: ${m.text}`}
              style={{ backgroundColor: m.mine ? C.pri : m.oos ? C.field : C.card, padding: 14, borderRadius: 18, borderBottomRightRadius: m.mine ? 6 : 18, borderBottomLeftRadius: m.mine ? 18 : 6,
                borderWidth: m.mine ? 0 : T.border, borderColor: T.hc ? C.line : C.hair }}>
              <Text maxFontSizeMultiplier={1.7} style={{ color: m.mine ? C.onPri : C.text, fontSize: fs(16), lineHeight: fs(16) * 1.4 }}>{m.text}</Text>
            </View>
            {!m.mine && (
              <Row style={{ marginTop: 4, flexWrap: 'wrap' }}>
                <Pressable accessibilityRole="button" accessibilityLabel="Escuchar esta respuesta" hitSlop={10} onPress={() => speak(m.text, true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingRight: 8, minHeight: 44 }}>
                  <Icon name="speaker" size={16} color={C.pri} /><Text style={{ color: C.pri, fontWeight: '700', fontSize: fs(13) }}>Escuchar</Text>
                </Pressable>
                {m.sources?.length ? <Small style={{ flex: 1 }}>Fuente: {m.sources.join('; ')}</Small> : null}
              </Row>
            )}
            {m.confirm && <Row>
              <Btn title="Sí, hazlo" onPress={() => add({ mine: false, text: 'Para cambiar tus registros usa la pantalla correspondiente: así revisas cada dato antes de guardar.' })} />
              <Btn title="Cancelar" kind="sec" onPress={() => add({ mine: false, text: 'Listo, no hice ningún cambio.' })} />
            </Row>}
            {m.model ? <Small>{m.model}</Small> : null}
          </View>
        ))}
        {busy && <Row accessible accessibilityLabel="Hermes está pensando"><ActivityIndicator color={C.pri} /><Small>Hermes está pensando… (IA local en tu iPhone)</Small></Row>}
        {msgs.length === 1 && (
          <View style={{ marginTop: 6 }}>
            <Small>Prueba con:</Small>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {sugerencias.map((s) => (
                <Pressable key={s} accessibilityRole="button" accessibilityLabel={`Preguntar: ${s}`} onPress={() => ask(s)}
                  style={{ backgroundColor: C.soft, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center', borderWidth: T.hc ? 2 : 0, borderColor: C.navy }}>
                  <Text style={{ color: T.hc ? C.priDark : C.pri, fontWeight: '700', fontSize: fs(14) }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      {dict.listening && (
        <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: C.soft }}>
          <Text style={{ color: C.pri, fontWeight: '800', fontSize: fs(14) }}>Escuchando… toca el botón rojo para terminar</Text>
          {dict.partial ? <P>{dict.partial}</P> : null}
        </View>
      )}
      {dict.error ? <View style={{ paddingHorizontal: 16 }}><Banner kind="warn" text={dict.error} /></View> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingBottom: 12 + espacioBarra, backgroundColor: C.card, borderTopWidth: T.border, borderColor: T.hc ? C.line : C.hair }}>
        <MicButton size={56} listening={dict.listening} onPress={dict.listening ? dict.stop : dict.start} label={dict.listening ? 'Terminar de dictar' : 'Dictar con la voz'} />
        <Field placeholder="Escribe o dicta tu pregunta…" value={q} onChangeText={setQ} onSubmitEditing={() => ask()} returnKeyType="send"
          accessibilityLabel="Pregunta para Hermes" containerStyle={{ flex: 1, marginBottom: 0 }} />
        <IconButton icon="send" label="Enviar pregunta" filled onPress={() => ask()} disabled={busy || !q.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

export function AuditScreen() {
  const st = useStore();
  const [res, setRes] = useState<string | null>(null);
  const [tests, setTests] = useState<ReturnType<typeof selfTest>>([]);
  return (
    <Screen padTop={false}>
      <Card>
        <Row><Icon name="shield" size={22} color={C.pri} /><H style={{ marginBottom: 0 }}>Integridad de la bitácora</H></Row>
        <Small style={{ marginVertical: 6 }}>Cada registro guarda SHA-256(datos + hash anterior). Si alguien cambia un monto, la cadena se rompe.</Small>
        <Btn title="Auditar integridad" icon="shield" onPress={async () => {
          const i = await audit(st.ledger);
          const r = i == null ? `Íntegra: ${st.ledger.length} registros sin alterar.` : `El registro número ${i} fue alterado. La cadena se rompe aquí.`;
          setRes(r); speak(r); buzz(i == null ? 'ok' : 'error');
        }} />
        {res && <Banner kind={res.startsWith('Íntegra') ? 'ok' : 'bad'} text={res} />}
      </Card>
      <Card>
        <H>Reglas de cumplimiento</H>
        <Btn title="Correr casos de prueba" kind="sec" onPress={() => { const r = selfTest(); setTests(r); announce(`${r.filter((x) => x.pass).length} de ${r.length} pruebas pasaron`); }} />
        {tests.map((t) => <Row key={t.name}><Icon name={t.pass ? 'check' : 'close'} size={16} color={t.pass ? C.ok : C.bad} /><Small color={t.pass ? C.ok : C.bad} style={{ flex: 1 }}>{t.name}</Small></Row>)}
        {RULES.map((r) => <View key={r.id} style={{ marginTop: 10 }}><P bold>{r.id} · {r.title}</P><Small>{r.source}</Small></View>)}
      </Card>
      <Card>
        <H>Bitácora ({st.ledger.length})</H>
        {[...st.ledger].reverse().slice(0, 60).map((e) => (
          <View key={e.index} style={{ borderBottomWidth: T.border, borderColor: C.line, paddingVertical: 8 }}>
            <P bold>#{e.index} · {e.type.replace(/_/g, ' ')}</P>
            <Small>{canonical(e.payload).slice(0, 180)}</Small>
            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10, color: C.sub }} accessibilityLabel="Huella digital del registro">hash {e.hash.slice(0, 16)}… ← {e.prevHash.slice(0, 10)}…</Text>
          </View>
        ))}
      </Card>
      <Btn title="Solo demo: alterar un registro" kind="bad" onPress={() => { st.tamperForDemo(); setRes(null); }} hint="Cambia un monto para demostrar que la auditoría lo detecta" />
    </Screen>
  );
}

export function SettingsScreen({ navigation }: any) {
  const st = useStore();
  const [log, setLog] = useState('');
  const [mock, setMock] = useState(forceMock);
  const [busy, setBusy] = useState(false);
  const say = (m: string) => setLog((l) => (l ? l + '\n' : '') + m);
  return (
    <Screen padTop={false}>
      <ListRow icon="a11y" title="Accesibilidad" subtitle="Letra más grande, alto contraste, voz y vibración" onPress={() => navigation.navigate('A11y')} />
      <MisDatosCard navigation={navigation} />
      <Card>
        <H>Impuestos (estimación)</H>
        <Small>Para ver en tu balance cuánto de lo que cobras le toca al SAT. Tus precios se toman con IVA incluido.</Small>
        <Small style={{ marginTop: 10, marginBottom: 6 }}>Régimen</Small>
        <Segmented label="Régimen fiscal" options={[{ v: 'resico', label: 'RESICO' }, { v: 'ninguno', label: 'No calcular' }]} value={st.impuestos.regimen}
          onChange={(v) => st.setImpuestos({ regimen: v as RegimenImpuestos })} />
        <Small style={{ marginTop: 10, marginBottom: 6 }}>IVA de lo que vendes</Small>
        <Segmented label="IVA de lo que vendes" options={TASAS_IVA} value={st.impuestos.tasaIVA} onChange={(v) => st.setImpuestos({ tasaIVA: v as TasaIVA })} />
        <Small style={{ marginTop: 8 }}>ISR con la tabla mensual RESICO 2026 sobre lo que cobras sin IVA. Si vendes con y sin IVA, elige el que más vendes. Es una estimación: confírmala con tu contador.</Small>
      </Card>
      <Card>
        <H>Modelos de IA (en este iPhone)</H>
        <ListRow icon="camera" title="Visión" subtitle={visionLabel} />
        <ListRow icon="sparkles" title="Hermes" subtitle={qvacState.llmLabel} />
        <ListRow icon="doc" title="OCR" subtitle={qvacState.ocrLabel} />
        {qvacState.error ? <Banner kind="bad" text={qvacState.error} /> : null}
        <Field label="Servidor de modelos (en la Mac: cd evento/models && python3 -m http.server 8080)" autoCapitalize="none" autoCorrect={false} value={st.modelsUrl} onChangeText={(v) => st.set({ modelsUrl: v })} />
        <Btn title="Descargar modelos entrenados" icon="down" loading={busy} onPress={async () => { setBusy(true); try { await downloadModels(st.modelsUrl, say); buzz('ok'); } catch (e: any) { say('⚠️ ' + e.message); buzz('error'); } setBusy(false); }} />
        <Btn title="Cargar IA local (QVAC)" kind="sec" icon="sparkles" loading={busy} onPress={async () => {
          setBusy(true);
          try {
            say('Cargando Hermes (Qwen3 + LoRA)… la primera vez descarga el modelo base'); await loadLLM(true); say('✔︎ ' + qvacState.llmLabel);
            say('Cargando OCR…'); await loadOCR(); say('✔︎ ' + qvacState.ocrLabel);
            say('Cargando visión…'); await loadVision(); say('✔︎ ' + visionLabel); buzz('ok'); announce('Modelos cargados');
          } catch (e: any) { say('⚠️ ' + (e?.message ?? e)); buzz('error'); }
          setBusy(false);
        }} />
        <ToggleRow label="Modo sin IA (solo para pruebas)" hint="Usa reglas en lugar de los modelos" value={mock} onChange={(v) => { setMock(v); setForceMock(v); }} />
        {log ? <Text accessibilityLiveRegion="polite" style={{ fontSize: fs(12), color: C.sub, marginTop: 6 }}>{log}</Text> : null}
      </Card>
      <Card>
        <H>Pagos (Mac con tu token de Mercado Pago)</H>
        <Field label="Servidor de pagos" autoCapitalize="none" autoCorrect={false} value={st.aiServerUrl} onChangeText={(v) => st.set({ aiServerUrl: v })} />
        <Btn title="Probar conexión" kind="sec" onPress={async () => { try { const h = await health(); say(`✔︎ Servidor OK · Mercado Pago: ${h.mercado_pago}`); } catch (e: any) { say('⚠️ ' + e.message); } }} />
      </Card>
      <Card>
        <H>Mi negocio</H>
        <Btn title="Volver a entrevistarme con Hermes" kind="sec" icon="sparkles" onPress={() => navigation.navigate('Interview')} />
        <Btn title="Borrar todo (nuevo negocio)" kind="bad" onPress={() => Alert.alert('¿Borrar todo?', 'Perfil, registros, bitácora y tus datos personales (nombre, CURP, teléfono y CLABE). No se puede deshacer.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: async () => {
          try { await borrarTitular(); useStore.getState().setTitular(null); } catch { Alert.alert('No se pudieron borrar tus datos personales', 'Bórralos desde Mis datos.'); }
          st.resetAll();
        } }])} />
      </Card>
    </Screen>
  );
}
