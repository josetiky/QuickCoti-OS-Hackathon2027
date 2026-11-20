// Onboarding multiagente con el diseño "Tu negocio, a tu manera": una pregunta a la vez, opciones A/B/C, voz o texto.
// Agente 1 = Hermes (entrevista, LoRA entrenado en NVIDIA) → Agente 2 = Configurador (diseño, meta, orden del Inicio).
// El usuario revisa y decide antes de armar la app (los interruptores mandan, no la IA).
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { interview } from '../ai/hermes';
import { configurar, conExtras, detectarExtras, extraerMonto, leerRespuestaExtras, PREGUNTA_EXTRAS, PREGUNTA_META } from '../ai/configurador';
import { useStore } from '../store';
import { HERRERO, PREDISENOS, TIENDITA, type BusinessProfile, type ChatTurn, type PredisenoId } from '../types';
import { announce, buzz, speak, stripEmoji, useDictation } from '../a11y';
import { Icon } from '../icons';
import { Banner, Btn, C, Card, Field, fs, H, IconButton, MicButton, OptionButton, P, ProgressBar, Row, Segmented, Small, T, ToggleRow } from '../ui';
import { TitularForm } from './TitularScreen';

const SUGERENCIAS = [
  { l: '🛒 Tienda de abarrotes', t: 'Tengo una tienda de abarrotes, me surte Bimbo y Coca-Cola y quiero llevar mi inventario' },
  { l: '✂️ Estética (sin inventario)', t: 'Tengo una estética, no manejo inventario y gano como 12 mil a la semana' },
  { l: '☕ Cafetería de mostrador', t: 'Tengo una cafetería de mostrador, vendo como 18 mil al mes y quiero cobrar rápido con QR' },
  { l: '🔨 Herrería a la medida', t: 'Soy herrero, hago portones y protecciones a la medida y cobro anticipo' },
  { l: '🎪 Renta de sillas y mesas', t: 'Rento sillas, mesas e inflables para fiestas, cobro depósito y los llevo a domicilio' },
  { l: '🛵 Comida con envíos', t: 'Vendo comida corrida y hago entregas a domicilio en moto, como 20 mil al mes' },
];
const N = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
type Opc = { multi: boolean; items: { l: string; t: string }[] } | null;

/** Opciones rápidas según lo que pregunta Hermes (siempre se puede contestar con voz o texto libre). */
function opciones(q: string, asking: string | null, turno: number): Opc {
  const t = N(q);
  const s = (xs: string[]) => xs.map((x) => ({ l: x, t: x }));
  if (asking === 'extras') return { multi: false, items: [{ l: 'Sí, rento cosas', t: 'rentas' }, { l: 'Sí, hago entregas a domicilio', t: 'entregas' }, { l: 'Las dos', t: 'las dos' }, { l: 'Ninguna', t: 'no' }] };
  if (asking === 'meta') return { multi: false, items: s(['10 mil a la semana', '30 mil al mes', '60 mil al mes']) };
  if (turno === 0) return { multi: false, items: SUGERENCIAS };
  if (/pagan|medios de pago|efectivo|tarjeta|transferencia/.test(t)) return { multi: true, items: s(['Efectivo', 'Tarjeta', 'Transferencia', 'CoDi']) };
  if (/^\W*(compras|haces|te pagan|rentas|cobras|das|vendes|tienes|manejas|llevas|aceptas|trabajas|ofreces|entregas)\b/.test(t)) return { multi: false, items: s(['Sí', 'No', 'A veces']) };
  return null;
}
const LETRAS = 'ABCDEFGH';

export default function InterviewScreen({ onDone }: { onDone?: () => void }) {
  const setProfile = useStore((s) => s.setProfile);
  const ins = useSafeAreaInsets();
  const [hist, setHist] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BusinessProfile | null>(null);
  const [perfilPendiente, setPerfilPendiente] = useState<BusinessProfile | null>(null); // perfil confirmado, esperando los datos del titular
  const [armando, setArmando] = useState(false);
  const [model, setModel] = useState('');
  const [pending, setPending] = useState<BusinessProfile | null>(null); // perfil de Hermes, esperando preguntas del Configurador
  const [asking, setAsking] = useState<'extras' | 'meta' | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [verChat, setVerChat] = useState(false);
  const dict = useDictation((t) => setInput(t)); // lo dictado queda en el campo para que lo revises antes de enviar
  const userTurns = hist.filter((h) => h.role === 'user').length;
  const pregunta = [...hist].reverse().find((h) => h.role === 'assistant')?.content ?? '';
  const ops = loading ? null : opciones(pregunta, asking, userTurns);
  const conUI = (p: BusinessProfile, h: ChatTurn[] = []) => ({ ...p, ui: configurar(p, h) });
  const textoUsuario = (h: ChatTurn[]) => h.filter((x) => x.role === 'user').map((x) => x.content).join(' ');

  useEffect(() => { setSel([]); if (pregunta) speak(pregunta); }, [pregunta]);

  function listo(p: BusinessProfile) { // pantalla "Estamos armando tu app" y luego revisión
    setArmando(true); announce('Estamos armando tu app'); buzz('ok');
    setTimeout(() => { setDraft(p); setArmando(false); }, 1300);
  }

  // Agente 2 · Configurador: completa lo que Hermes no preguntó (rentas, entregas a domicilio, meta) y arma la app
  function siguientePaso(p: BusinessProfile, h: ChatTurn[], yaPreguntoExtras: boolean) {
    const ex = detectarExtras(textoUsuario(h));
    if (!yaPreguntoExtras && ex.rentals == null && ex.delivery == null) {
      setPending(p); setAsking('extras'); setHist([...h, { role: 'assistant', content: PREGUNTA_EXTRAS }]); return;
    }
    if (extraerMonto(textoUsuario(h)) == null) {
      setPending(p); setAsking('meta'); setHist([...h, { role: 'assistant', content: PREGUNTA_META }]); return;
    }
    setPending(null); setAsking(null); listo(conUI(p, h));
  }

  async function send(text?: string) {
    const h = text ? [...hist, { role: 'user' as const, content: text }] : hist;
    setHist(h); setError(null); setInput('');
    if (pending && text && asking === 'extras') { siguientePaso(conExtras(pending, leerRespuestaExtras(text)), h, true); return; }
    if (pending && text && asking === 'meta') { setPending(null); setAsking(null); listo(conUI(pending, h)); return; }
    setLoading(true);
    try {
      const r: any = await interview(h);
      setModel(r.model);
      // Hermes v2 ya pregunta rentas/entregas (trae booleanos): el Configurador no repite la pregunta
      if (r.done && r.profile) siguientePaso(conExtras(r.profile, detectarExtras(textoUsuario(h))), h, typeof r.profile.modules?.rentals === 'boolean');
      else setHist([...h, { role: 'assistant', content: r.next_question }]);
    } catch (e: any) { setError(e?.message ?? 'Hermes no pudo continuar.'); buzz('error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (!hist.length) send(); }, []);

  function continuar() {
    if (!ops) return;
    const elegidas = sel.map((i) => ops.items[i].t);
    if (!elegidas.length) return;
    const txt = ops.multi ? (elegidas.length > 1 ? elegidas.slice(0, -1).join(', ') + ' y ' + elegidas[elegidas.length - 1] : elegidas[0]).toLowerCase() : elegidas[0];
    send(txt);
  }

  // Datos del titular (formulario aparte: nunca pasan por Hermes). Solo se piden si aún no están en el llavero.
  if (perfilPendiente) return <TitularForm modo="registro" demo={model === 'manual (demo)'} textoGuardar="Guardar y crear mi espacio"
    onCancelar={() => { setDraft(perfilPendiente); setPerfilPendiente(null); }}
    onListo={async () => { await setProfile(perfilPendiente, model); onDone?.(); }} />;

  if (draft) return <ProfileReview profile={draft} model={model} onRestart={() => { setDraft(null); setPending(null); setAsking(null); setHist([]); setTimeout(() => send(), 0); }}
    onConfirm={async (p) => { if (!useStore.getState().titular) { setPerfilPendiente(p); return; } await setProfile(p, model); buzz('ok'); onDone?.(); }} />;

  if (armando) return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }}>
      <ActivityIndicator size="large" color={C.pri} />
      <Text accessibilityRole="header" style={{ fontSize: fs(24), fontWeight: '800', color: C.navy, textAlign: 'center' }}>Estamos armando tu app</Text>
      <View style={{ gap: 8 }}>
        <Row><Icon name="check" size={20} color={C.ok} /><P>Hermes entendió tu negocio</P></Row>
        <Row><Icon name="sparkles" size={20} color={C.pri} /><P>El Configurador elige tu diseño y tu Inicio…</P></Row>
      </View>
    </View>
  );

  const total = Math.max(7, userTurns + (asking ? 1 : 2));
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: ins.top + 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Icon name="sparkles" size={36} color={C.pri} />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={{ fontSize: fs(31), fontWeight: '800', color: C.navy, marginTop: 10, letterSpacing: -0.5 }}>Tu negocio, a tu manera</Text>
        <Small style={{ marginTop: 6 }}>{asking ? 'Agente 2 · Configurador · último paso' : `Pregunta ${userTurns + 1} de ~${total} · Hermes (IA en tu iPhone)`}</Small>
        <View style={{ marginTop: 8 }}><ProgressBar value={(userTurns + 1) / total} label="Avance de la entrevista" /></View>

        <View style={{ marginTop: 22, marginBottom: 14 }}>
          {loading ? (
            <Row accessible accessibilityLabel="Hermes está pensando la siguiente pregunta"><ActivityIndicator color={C.pri} /><P color={C.sub}>Hermes está pensando…</P></Row>
          ) : pregunta ? (
            <Row style={{ alignItems: 'flex-start' }}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ flex: 1, fontSize: fs(23), fontWeight: '800', color: C.navy, lineHeight: fs(23) * 1.3 }}>{pregunta}</Text>
              <IconButton icon="speaker" label="Escuchar la pregunta" onPress={() => speak(pregunta, true)} size={44} />
            </Row>
          ) : null}
        </View>

        {error && (
          <Card>
            <Banner kind="bad" text={error} />
            <Btn title="Reintentar" onPress={() => send()} kind="sec" />
            <Btn title="Configurar a mano" onPress={() => { setModel('manual'); listo(conUI({ ...TIENDITA, business_name: 'Mi negocio' })); }} kind="sec" />
          </Card>
        )}

        {ops && (
          <View accessibilityRole={ops.multi ? undefined : 'radiogroup'} accessibilityLabel={ops.multi ? 'Elige una o varias' : 'Elige una opción'}>
            {ops.multi ? <Small style={{ marginBottom: 8 }}>Puedes elegir varias</Small> : null}
            {ops.items.map((o, i) => (
              <OptionButton key={o.l} letter={LETRAS[i]} label={stripEmoji(o.l)} multi={ops.multi} selected={sel.includes(i)}
                hint={o.t !== o.l ? `Responde: ${o.t}` : undefined}
                onPress={() => setSel(ops.multi ? (sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]) : [i])} />
            ))}
            <Btn title={asking === 'meta' ? 'Crear mi espacio' : 'Continuar'} icon="chevron" disabled={!sel.length || loading} onPress={continuar} />
          </View>
        )}

        <View style={{ marginTop: 14 }}>
          <Small style={{ marginBottom: 6 }}>{ops ? 'O contesta con tus palabras:' : 'Contesta con tus palabras:'}</Small>
          {dict.listening ? <Banner kind="info" text={dict.partial ? `Escuchando: ${dict.partial}` : 'Escuchando… habla y toca el botón rojo al terminar'} /> : null}
          {dict.error ? <Banner kind="warn" text={dict.error} /> : null}
          <Row>
            <MicButton size={54} listening={dict.listening} onPress={dict.listening ? dict.stop : dict.start} label={dict.listening ? 'Terminar de dictar' : 'Dictar respuesta con la voz'} />
            <Field placeholder="Escribe o dicta tu respuesta…" value={input} onChangeText={setInput} accessibilityLabel="Tu respuesta"
              onSubmitEditing={() => { const t = input.trim(); if (t) send(t); }} returnKeyType="send" containerStyle={{ flex: 1, marginBottom: 0 }} />
            <IconButton icon="send" label="Enviar respuesta" filled disabled={!input.trim() || loading} onPress={() => { const t = input.trim(); if (t) send(t); }} />
          </Row>
        </View>

        {userTurns > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel={verChat ? 'Ocultar mis respuestas' : `Ver mis respuestas (${userTurns})`} onPress={() => setVerChat(!verChat)} style={{ marginTop: 16, minHeight: 44, justifyContent: 'center' }}>
            <Small color={C.pri} style={{ fontWeight: '700' }}>{verChat ? '▾ Ocultar mis respuestas' : `▸ Ver mis respuestas (${userTurns})`}</Small>
          </Pressable>
        )}
        {verChat && hist.map((t, i) => (
          <View key={i} accessible accessibilityLabel={`${t.role === 'user' ? 'Tú' : 'Hermes'}: ${t.content}`} style={{ alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', marginBottom: 8,
            backgroundColor: t.role === 'user' ? C.pri : C.card, padding: 12, borderRadius: 16, borderWidth: t.role === 'user' ? 0 : T.border, borderColor: C.hair }}>
            <Text style={{ color: t.role === 'user' ? C.onPri : C.text, fontSize: fs(15) }}>{t.content}</Text>
          </View>
        ))}

        <View style={{ marginTop: 22, borderTopWidth: T.border, borderColor: C.line, paddingTop: 12 }}>
          <Small>¿Solo quieres probar la app?</Small>
          <Row>
            <Btn title="Demo tiendita" kind="ghost" onPress={() => { setModel('manual (demo)'); listo(conUI(TIENDITA, [{ role: 'user', content: 'vendo 15 mil a la semana' }])); }} />
            <Btn title="Demo herrería" kind="ghost" onPress={() => { setModel('manual (demo)'); listo(conUI(HERRERO, [{ role: 'user', content: 'saco como 40 mil al mes' }])); }} />
          </Row>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function ProfileReview({ profile, model, onConfirm, onRestart }: { profile: BusinessProfile; model: string; onConfirm: (p: BusinessProfile) => void; onRestart: () => void }) {
  const ins = useSafeAreaInsets();
  const [p, setP] = useState(profile);
  const ui = p.ui ?? configurar(p);
  const [showJson, setShowJson] = useState(false);
  const setUI = (patch: Partial<typeof ui>) => setP({ ...p, ui: { ...ui, ...patch } });
  // Al confirmar, el Configurador recalcula el orden de tarjetas según los módulos finales; respeta prediseño y meta del usuario
  const confirmar = () => { const base = configurar(p); onConfirm({ ...p, ui: { ...base, predisenoId: ui.predisenoId, ingresoMetaMXN: ui.ingresoMetaMXN, periodicidadMeta: ui.periodicidadMeta, metaDeclarada: ui.metaDeclarada } }); };
  const theme = PREDISENOS[ui.predisenoId] ?? PREDISENOS.comercio_inventario;
  // Al prender/apagar un módulo, el Configurador vuelve a proponer diseño y mensaje (respeta la meta que ya pusiste)
  const mod = (k: keyof BusinessProfile['modules'], v: boolean) => {
    const np = { ...p, modules: { ...p.modules, [k]: v } };
    setP({ ...np, ui: { ...configurar(np), ingresoMetaMXN: ui.ingresoMetaMXN, periodicidadMeta: ui.periodicidadMeta, metaDeclarada: ui.metaDeclarada } });
  };
  const term = (k: keyof BusinessProfile['terminology'], v: string) => setP({ ...p, terminology: { ...p.terminology, [k]: v } });
  useEffect(() => { speak(`Esto entendí. ${ui.mensajeBienvenida} Revisa y toca Listo para armar tu app.`); }, []);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingTop: ins.top + 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={{ fontSize: fs(31), fontWeight: '800', color: C.navy, letterSpacing: -0.5 }}>Esto entendí</Text>
      <P color={C.sub} style={{ marginTop: 4, marginBottom: 14 }}>Hermes entendió tu negocio y el Configurador armó tu pantalla. Tú decides: cambia lo que no te sirva.</P>
      <Card style={{ backgroundColor: theme.soft, borderWidth: T.hc ? 2 : 1, borderColor: theme.accent }}>
        <Small color={theme.accent} style={{ fontWeight: '800' }}>AGENTE 2 · CONFIGURADOR</Small>
        <Text style={{ fontSize: fs(19), fontWeight: '800', color: C.navy, marginTop: 4 }}>{theme.emoji} {theme.label}</Text>
        <P color={C.text} style={{ marginTop: 4 }}>{ui.mensajeBienvenida}</P>
        <Small style={{ marginTop: 10, marginBottom: 6 }}>Diseño de tu app</Small>
        <Segmented label="Diseño de tu app" value={ui.predisenoId} onChange={(v) => setUI({ predisenoId: v as PredisenoId })}
          options={(Object.keys(PREDISENOS) as PredisenoId[]).map((k) => ({ v: k, label: `${PREDISENOS[k].emoji} ${PREDISENOS[k].label}` }))} />
        <View style={{ marginTop: 12 }}>
          <Field label={ui.metaDeclarada ? 'Meta de ingresos (lo que me dijiste)' : 'Meta de ingresos (no me la dijiste, pon la tuya)'} keyboardType="number-pad"
            value={String(ui.ingresoMetaMXN)} warn={!ui.metaDeclarada} onChangeText={(v) => setUI({ ingresoMetaMXN: Number(v.replace(/\D/g, '')) || 0, metaDeclarada: true })} />
          <Segmented label="Periodicidad de la meta" value={ui.periodicidadMeta} onChange={(v) => setUI({ periodicidadMeta: v })}
            options={[{ v: 'semanal' as const, label: 'Por semana' }, { v: 'mensual' as const, label: 'Por mes' }]} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setShowJson(!showJson)} style={{ marginTop: 10, minHeight: 44, justifyContent: 'center' }}>
          <Small color={C.pri} style={{ fontWeight: '700' }}>{showJson ? 'Ocultar' : 'Ver'} configuración (JSON)</Small>
        </Pressable>
        {showJson && <Text accessibilityLabel="Configuración en formato JSON" style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, backgroundColor: '#0F172A', color: '#6EE7B7', padding: 10, borderRadius: 10 }}>{JSON.stringify({ modules: p.modules, ui }, null, 2)}</Text>}
      </Card>
      {p.missing_info?.length ? <Banner kind="warn" text={'Me faltó saber: ' + p.missing_info.join(', ')} /> : null}
      <Card>
        <Field label="Nombre del negocio" value={p.business_name} onChangeText={(v) => setP({ ...p, business_name: v })} />
        <Field label="Giro" value={p.giro} onChangeText={(v) => setP({ ...p, giro: v })} />
      </Card>
      <Card>
        <H>Qué incluye tu app</H>
        <ToggleRow label="Ventas" hint="Siempre incluido" value onChange={() => {}} disabled />
        <ToggleRow label="Compras" hint="Siempre incluido" value onChange={() => {}} disabled />
        <ToggleRow label={`Inventario (${p.terminology.stock})`} hint="Se llena con las notas de tus proveedores" value={p.modules.inventory} onChange={(v) => mod('inventory', v)} />
        <ToggleRow label="Cotizaciones" hint="Trabajos a la medida o varios conceptos" value={p.modules.quotes} onChange={(v) => mod('quotes', v)} />
        <ToggleRow label="Anticipos" value={p.modules.deposits} onChange={(v) => mod('deposits', v)} />
        <ToggleRow label="Rentas" hint="Con depósito y fecha de devolución" value={!!p.modules.rentals} onChange={(v) => mod('rentals', v)} />
        <ToggleRow label="Entregas a domicilio" value={!!p.modules.delivery} onChange={(v) => mod('delivery', v)} />
        <ToggleRow label="Mi giro solo acepta pagos digitales" value={p.digital_only_sector} onChange={(v) => setP({ ...p, digital_only_sector: v })} />
      </Card>
      <Card>
        <H>Cómo le llamas a las cosas</H>
        <Field label="Lo que vendes o usas" value={p.terminology.item} onChangeText={(v) => term('item', v)} />
        <Field label="Comprar a tu proveedor" value={p.terminology.purchase} onChangeText={(v) => term('purchase', v)} />
        <Field label="Cobrar al cliente" value={p.terminology.sale} onChangeText={(v) => term('sale', v)} />
        <Field label="Tu inventario" value={p.terminology.stock} onChangeText={(v) => term('stock', v)} />
      </Card>
      <Btn title="Listo, crear mi espacio" icon="check" onPress={confirmar} />
      <Btn title="Volver a empezar la entrevista" kind="sec" onPress={onRestart} />
      <Small style={{ marginTop: 6 }}>Perfil: {model} · Presentación: Agente Configurador (reglas)</Small>
    </ScrollView>
  );
}
