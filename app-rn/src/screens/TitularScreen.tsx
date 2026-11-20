// Registro del titular: aviso de privacidad → formulario. Los datos van directo al llavero (Keychain) del iPhone:
// nunca pasan por Hermes/LLM, ni por la bitácora SHA-256, ni por AsyncStorage, y no se leen en voz alta.
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Banner, Btn, C, Card, Field, P, PageHeader, Row, Screen, Small, ToggleRow, fs } from '../ui';
import { Icon } from '../icons';
import { announce, buzz } from '../a11y';
import { useStore } from '../store';
import { borrarTitular, guardarTitular } from '../titular/secure';
import { FALTA_MODULO_SEGURO } from '../titular/almacen';
import { AVISO_CORTO, AVISO_VERSION } from '../titular/aviso';
import { DEMO_TITULAR, armarTitular, mascaraCLABE, mascaraCURP, mascaraTel, normCURP, soloDigitos, validarTitular, type ErroresTitular, type Titular } from '../titular/valida';
import type { LedgerEntry } from '../types';

const NOMBRE_CAMPO: Record<keyof ErroresTitular, string> = { nombre: 'nombre', curp: 'CURP', clabe: 'CLABE', telefono: 'teléfono' };

/** Campo con el motivo del error visible (no solo color) y leído por VoiceOver. */
function Campo({ error, ayuda, ...p }: React.ComponentProps<typeof Field> & { error?: string; ayuda?: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Field {...p} warn={!!error} accessibilityHint={error ?? ayuda} containerStyle={{ marginBottom: 4 }} />
      {error
        ? <Text accessibilityElementsHidden importantForAccessibility="no" maxFontSizeMultiplier={1.7} style={{ fontSize: fs(13), color: C.warn, fontWeight: '600' }}>{error}</Text>
        : ayuda ? <Small>{ayuda}</Small> : null}
    </View>
  );
}

type Props = { modo: 'registro' | 'editar'; onListo: (t: Titular) => void; onCancelar?: () => void; demo?: boolean; textoGuardar?: string };

export function TitularForm({ modo, onListo, onCancelar, demo, textoGuardar }: Props) {
  const previo = useStore((s) => s.titular);
  const clabeLegada = useStore((s) => s.clabeLegada);
  const editar = modo === 'editar';
  const [paso, setPaso] = useState<'aviso' | 'datos'>(editar ? 'datos' : 'aviso');
  const [acepto, setAcepto] = useState(false);
  const [nombre, setNombre] = useState(editar ? previo?.nombre ?? '' : '');
  const [curp, setCurp] = useState(editar ? previo?.curp ?? '' : '');
  const [clabe, setClabe] = useState(editar ? previo?.clabe ?? '' : clabeLegada);
  const [tel, setTel] = useState(editar ? previo?.telefono ?? '' : '');
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  const armar = () => armarTitular({ nombre, curp, clabe, telefono: tel }, editar ? previo : null, new Date().toISOString(), AVISO_VERSION);
  const err: ErroresTitular = intentado ? validarTitular(armar()) : {}; // se muestran al tocar Guardar, no mientras escribe
  const esDemo = normCURP(curp) === DEMO_TITULAR.curp && soloDigitos(clabe) === DEMO_TITULAR.clabe;

  async function guardar() {
    setIntentado(true); setFalla(null);
    const t = armar();
    const e = validarTitular(t);
    const malos = Object.keys(e) as (keyof ErroresTitular)[];
    if (malos.length) {
      buzz('warn');
      announce(`Revisa ${malos.map((k) => NOMBRE_CAMPO[k]).join(', ')}. ${e[malos[0]]}`);
      return;
    }
    setGuardando(true);
    try { await guardarTitular(t); } catch (x: any) {
      setGuardando(false); buzz('error');
      setFalla(x?.message === FALTA_MODULO_SEGURO
        ? 'Falta el módulo de seguridad del iPhone (expo-secure-store), así que tus datos no se guardaron. Reinstala la app con el comando de instalación (incluye pod install).'
        : 'No se pudieron guardar tus datos de forma segura en este iPhone. Intenta de nuevo.');
      announce('No se pudieron guardar tus datos. Intenta de nuevo.');
      return;
    }
    setGuardando(false); buzz('ok');
    announce(editar ? 'Datos actualizados.' : 'Datos guardados.');
    useStore.getState().setTitular(t);
    onListo(t);
  }

  function usarDemo() {
    setNombre(DEMO_TITULAR.nombre); setCurp(DEMO_TITULAR.curp); setClabe(DEMO_TITULAR.clabe); setTel('');
    announce('Se llenaron datos ficticios de demostración.');
  }

  if (paso === 'aviso') return (
    <Screen padTop={!editar}>
      <PageHeader title="Aviso de privacidad" subtitle="Antes de pedirte tus datos, esto es lo que hacemos con ellos." />
      <Banner kind="info" text="Tus datos se guardan cifrados solo en este iPhone. No los ve Hermes ni ningún servidor." />
      <Card>{AVISO_CORTO.map((t, i) => <P key={i} style={{ marginBottom: 10 }}>{t}</P>)}</Card>
      <Card><ToggleRow label="He leído y acepto el aviso de privacidad" value={acepto} onChange={setAcepto} hint="Es obligatorio para continuar" /></Card>
      <Btn title="Continuar" icon="chevron" disabled={!acepto} hint={acepto ? undefined : 'Primero acepta el aviso de privacidad'}
        onPress={() => { setPaso('datos'); announce('Formulario de tus datos'); }} />
      {onCancelar ? <Btn title="Regresar" kind="ghost" onPress={onCancelar} /> : null}
    </Screen>
  );

  return (
    <Screen padTop={!editar} teclado>
      <PageHeader title={editar ? 'Mis datos' : 'Tus datos'} subtitle="Nombre, CURP y CLABE son obligatorios. El teléfono es opcional." />
      {esDemo ? <Banner kind="warn" text="DEMO · Datos ficticios de demostración. No pertenecen a nadie." /> : null}
      {falla ? <Banner kind="bad" text={falla} /> : null}
      <Card>
        <Campo label="Nombre completo" value={nombre} onChangeText={setNombre} autoCapitalize="words" autoCorrect={false}
          textContentType="name" autoComplete="name" error={err.nombre} ayuda="Como aparece en tu identificación." />
        <Campo label="CURP" value={curp} onChangeText={(v) => setCurp(normCURP(v))} autoCapitalize="characters" autoCorrect={false}
          spellCheck={false} autoComplete="off" maxLength={24} error={err.curp} ayuda="18 caracteres. La encuentras en gob.mx/curp." />
        <Campo label="CLABE interbancaria" value={clabe} onChangeText={(v) => setClabe(soloDigitos(v))} keyboardType="number-pad"
          autoComplete="off" maxLength={24} error={err.clabe}
          ayuda={!editar && !!clabeLegada && soloDigitos(clabe) === clabeLegada ? 'La tomamos de tus Ajustes. Revisa que sea correcta.' : '18 dígitos. Es la cuenta donde se depositaría lo que cobras.'} />
        <Campo label="Teléfono celular (opcional)" value={tel} onChangeText={setTel} keyboardType="phone-pad" textContentType="telephoneNumber"
          autoComplete="tel" maxLength={16} error={err.telefono} ayuda="10 dígitos." />
      </Card>
      <Row style={{ marginBottom: 12, alignItems: 'flex-start' }}>
        <Icon name="shield" size={fs(18)} color={C.sub} />
        <Small style={{ flex: 1 }}>Se guardan cifrados solo en este iPhone. Puedes verlos, corregirlos o borrarlos en Ajustes → Mis datos.</Small>
      </Row>
      <Btn title={textoGuardar ?? (editar ? 'Guardar cambios' : 'Guardar y continuar')} icon="check" loading={guardando} onPress={guardar} />
      {demo ? <Btn title="Usar datos DEMO (ficticios)" kind="sec" icon="sparkles" onPress={usarDemo} hint="Llena nombre, CURP y CLABE ficticios que pasan la validación" /> : null}
      {editar
        ? (onCancelar ? <Btn title="Cancelar" kind="ghost" onPress={onCancelar} /> : null)
        : <Btn title="Regresar al aviso" kind="ghost" onPress={() => setPaso('aviso')} />}
    </Screen>
  );
}

/** Ajustes → Mis datos → Editar. */
export function TitularScreen({ navigation }: any) {
  return <TitularForm modo="editar" onListo={() => navigation.goBack()} onCancelar={() => navigation.goBack()} />;
}

const perfilDemo = (ledger: LedgerEntry[]) => [...ledger].reverse().find((e) => e.type === 'perfil_confirmado')?.payload.modelo_ia === 'manual (demo)';

/** Compuerta al abrir la app: hay negocio pero faltan los datos del titular (instalación previa o datos borrados). */
export function RegistroTitularScreen() {
  const demo = useStore((s) => perfilDemo(s.ledger));
  return <TitularForm modo="registro" demo={demo} onListo={() => {}} />;
}

/** Ajustes → tarjeta "Mis datos": vista enmascarada + Editar + Borrar (derechos ARCO). */
export function MisDatosCard({ navigation }: { navigation: any }) {
  const t = useStore((s) => s.titular);
  if (!t) return null;
  let fecha = t.aceptoAviso.slice(0, 10);
  try { fecha = new Date(t.aceptoAviso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }); } catch {}
  function borrar() {
    Alert.alert('¿Borrar tus datos?', 'Se borrarán tu nombre, CURP, teléfono y CLABE de este iPhone. Para seguir usando la app tendrás que registrarlos de nuevo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => {
        try { await borrarTitular(); useStore.getState().setTitular(null); buzz('ok'); announce('Tus datos se borraron.'); }
        catch { buzz('error'); Alert.alert('No se pudieron borrar', 'Intenta de nuevo.'); }
      } },
    ]);
  }
  return (
    <Card>
      <Row style={{ marginBottom: 8 }}>
        <Icon name="user" size={fs(22)} color={C.pri} />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={{ flex: 1, fontSize: fs(21), fontWeight: '700', color: C.navy }}>Mis datos</Text>
        {t.demo ? <View accessible accessibilityLabel="Datos de demostración" style={{ borderWidth: 1.5, borderColor: C.warn, backgroundColor: C.warnBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text maxFontSizeMultiplier={1.5} style={{ color: C.warn, fontWeight: '800', fontSize: fs(12) }}>DEMO</Text></View> : null}
      </Row>
      <Dato etiqueta="Nombre" valor={t.nombre} />
      <Dato etiqueta="CURP" valor={mascaraCURP(t.curp)} a11y={`CURP terminación ${t.curp.slice(-2)}`} />
      <Dato etiqueta="CLABE" valor={mascaraCLABE(t.clabe)} a11y={`CLABE terminación ${t.clabe.slice(-4)}`} />
      {t.telefono ? <Dato etiqueta="Teléfono" valor={mascaraTel(t.telefono)} a11y={`Teléfono terminación ${t.telefono.slice(-4)}`} /> : null}
      <Small style={{ marginTop: 4, marginBottom: 4 }}>Aceptaste el aviso de privacidad el {fecha}. Se guardan cifrados solo en este iPhone.</Small>
      <Btn title="Editar mis datos" kind="sec" icon="pen" onPress={() => navigation.navigate('Titular')} />
      <Btn title="Borrar mis datos" kind="bad" onPress={borrar} hint="Borra nombre, CURP, teléfono y CLABE de este iPhone" />
    </Card>
  );
}

function Dato({ etiqueta, valor, a11y }: { etiqueta: string; valor: string; a11y?: string }) {
  return (
    <Row accessible accessibilityLabel={`${etiqueta}: ${a11y ?? valor}`} style={{ paddingVertical: 4, alignItems: 'flex-start' }}>
      <Small style={{ width: fs(78) }}>{etiqueta}</Small>
      <P style={{ flex: 1 }}>{valor}</P>
    </Row>
  );
}
