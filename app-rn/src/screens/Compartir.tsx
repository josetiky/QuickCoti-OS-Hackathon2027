// Después de cobrar o cotizar: mandar por WhatsApp y llenar los datos de la factura SIMULADA.
// El celular y los datos fiscales del cliente viven solo aquí (estado de la pantalla): no se guardan ni van a la bitácora.
import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { enlaceWhatsApp } from '../whatsapp';
import { avisoRetencion, normalizarRFC, PUBLICO_GENERAL, REGIMENES, RFC_PUBLICO, USOS, validarReceptor, type Receptor, type RegimenFiscal, type UsoCFDI } from '../factura';
import { Banner, Btn, C, Field, H, P, Segmented, Small } from '../ui';
import { buzz, speak } from '../a11y';

/** Campo con el error visible debajo (y leído por VoiceOver), sin el aviso genérico de "la IA". */
function Campo({ error, ...p }: React.ComponentProps<typeof Field> & { error?: string }) {
  return (
    <View>
      <Field {...p} accessibilityHint={error ?? p.accessibilityHint ?? p.hint} />
      {error ? <Small color={C.bad} style={{ marginTop: -6, marginBottom: 8 }}>{error}</Small> : null}
    </View>
  );
}

export function EnviarWhatsApp({ texto, titulo = 'Mándalo por WhatsApp' }: { texto: string; titulo?: string }) {
  const [cel, setCel] = useState('');
  const [error, setError] = useState<string | undefined>();
  async function enviar() {
    const url = enlaceWhatsApp(cel, texto);
    if (!url) { setError('Escribe el celular a 10 dígitos, por ejemplo 55 1234 5678.'); buzz('error'); return; }
    setError(undefined);
    try { await Linking.openURL(url); buzz('ok'); }
    catch { setError('No pude abrir WhatsApp. Revisa que esté instalado.'); buzz('error'); }
  }
  return (
    <View style={{ marginTop: 8 }}>
      <P bold>{titulo}</P>
      <Campo label="Celular del cliente (10 dígitos)" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" value={cel}
        onChangeText={(v) => { setCel(v); setError(undefined); }} error={error} hint="No guardamos este número" />
      <Btn title="Enviar por WhatsApp" icon="send" kind="sec" onPress={enviar} hint="Abre WhatsApp con el mensaje listo; tú lo envías" />
      <Small>Se manda como texto. Para mandar el PDF usa Compartir y elige WhatsApp. No guardamos el número.</Small>
    </View>
  );
}

export function FacturaForm({ regimenEmisor, onListo, onCancelar }: { regimenEmisor: string | null; onListo: (r: Receptor) => void; onCancelar?: () => void }) {
  const [r, setR] = useState<Receptor>({ rfc: '', nombre: '', cp: '', regimen: '612', uso: 'G03' });
  const [intento, setIntento] = useState(false);
  const errores = validarReceptor(r);
  const ver = (k: keyof Receptor) => (intento ? errores[k] : undefined);
  const aviso = avisoRetencion(r.rfc, regimenEmisor);
  function listo() {
    setIntento(true);
    if (Object.keys(errores).length) { buzz('error'); speak('Revisa los datos marcados en rojo.'); return; }
    onListo({ ...r });
  }
  return (
    <View>
      <H>Datos fiscales de tu cliente</H>
      <Small>Como aparecen en su constancia de situación fiscal. Solo se usan para esta factura simulada; no los guardamos.</Small>
      <Btn title="Es público en general" kind="ghost" icon="user" onPress={() => setR({ ...r, ...PUBLICO_GENERAL })} hint="Pone el RFC genérico XAXX010101000, régimen 616 y uso S01" />
      <Campo label="RFC" autoCapitalize="characters" autoCorrect={false} value={r.rfc} error={ver('rfc')} onChangeText={(v) => setR({ ...r, rfc: v.toUpperCase() })} />
      <Campo label="Nombre o razón social" autoCapitalize="characters" value={r.nombre} error={ver('nombre')} onChangeText={(v) => setR({ ...r, nombre: v })} />
      <Campo label={normalizarRFC(r.rfc) === RFC_PUBLICO ? 'Código postal (el de tu negocio)' : 'Código postal'} keyboardType="number-pad" value={r.cp} error={ver('cp')}
        onChangeText={(v) => setR({ ...r, cp: v.replace(/\D/g, '').slice(0, 5) })} />
      <Small style={{ marginTop: 2, marginBottom: 6 }}>Régimen fiscal de tu cliente</Small>
      <Segmented label="Régimen fiscal de tu cliente" options={REGIMENES.map((x) => ({ v: x.v, label: x.label }))} value={r.regimen} onChange={(v) => setR({ ...r, regimen: v as RegimenFiscal })} />
      {ver('regimen') ? <Small color={C.bad}>{ver('regimen')}</Small> : null}
      <Small style={{ marginTop: 10, marginBottom: 6 }}>Uso del CFDI</Small>
      <Segmented label="Uso del CFDI" options={USOS.map((x) => ({ v: x.v, label: x.label }))} value={r.uso} onChange={(v) => setR({ ...r, uso: v as UsoCFDI })} />
      {ver('uso') ? <Small color={C.bad}>{ver('uso')}</Small> : null}
      {aviso ? <View style={{ marginTop: 10 }}><Banner kind="info" text={aviso} /></View> : null}
      <Btn title="Hacer factura (simulada)" icon="doc" onPress={listo} style={{ marginTop: 10 }} />
      {onCancelar ? <Btn title="Mejor sin factura" kind="ghost" onPress={onCancelar} /> : null}
    </View>
  );
}
