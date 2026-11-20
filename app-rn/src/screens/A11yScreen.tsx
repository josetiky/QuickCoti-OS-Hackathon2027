// Ajustes de accesibilidad: letra, contraste, lectura en voz alta, vibración, modo sencillo y prueba de dictado.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useStore } from '../store';
import { A11Y_DEFAULT, buzz, speak, TEXT_SIZES, useDictation, voiceSupport } from '../a11y';
import type { Tema } from '../tema';

const TEMAS: { v: Tema; label: string }[] = [{ v: 'claro', label: 'Claro' }, { v: 'oscuro', label: 'Oscuro' }];
import { Amount, Banner, Btn, C, Card, fs, H, MicButton, P, Row, Screen, Segmented, Small, ToggleRow } from '../ui';

export default function A11yScreen() {
  const a = useStore((s) => s.a11y);
  const set = useStore((s) => s.setA11y);
  const [oido, setOido] = useState('');
  const dict = useDictation((t) => { setOido(t); speak(`Escuché: ${t}`); });
  return (
    <Screen padTop={false}>
      <P color={C.sub}>QuickCoti se adapta a ti. Los cambios se aplican al momento y se guardan en este iPhone.</P>
      <View style={{ height: 12 }} />

      <Card>
        <H>Tamaño de letra</H>
        <Segmented label="Tamaño de letra" options={TEXT_SIZES} value={a.textScale} onChange={(v) => set({ textScale: v })} />
        <View style={{ marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: C.field }} accessible accessibilityLabel="Vista previa del tamaño de letra">
          <Small>Así se verá:</Small>
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}><P bold>Ventas de hoy</P><Amount n={1250} size={20} /></Row>
        </View>
        <Small style={{ marginTop: 8 }}>También respeta el tamaño de texto del iPhone (Ajustes → Accesibilidad → Pantalla y tamaño del texto).</Small>
      </Card>

      <Card>
        <H>Tema</H>
        <Segmented label="Tema" options={TEMAS} value={a.theme ?? 'claro'} onChange={(v) => set({ theme: v })} />
        <Small style={{ marginTop: 8 }}>Oscuro: azul marino con detalles champaña. Se guarda en este iPhone.</Small>
      </Card>

      <Card>
        <H>Ver mejor</H>
        <ToggleRow label="Alto contraste" hint="Colores más fuertes, bordes gruesos y sin transparencias" value={a.highContrast} onChange={(v) => set({ highContrast: v })} />
        <ToggleRow label="Modo sencillo" hint="Botones más grandes y una acción por fila en Inicio" value={a.simple} onChange={(v) => set({ simple: v })} />
      </Card>

      <Card>
        <H>Voz y vibración</H>
        <ToggleRow label="Leer en voz alta" hint="Hermes lee sus respuestas, las preguntas de la entrevista y los avisos importantes"
          value={a.speak} onChange={(v) => { set({ speak: v }); if (v) speak('Listo. Voy a leer en voz alta las respuestas y los avisos.', true); }} disabled={!voiceSupport.tts} />
        <Btn title="Probar la voz" kind="sec" icon="speaker" disabled={!voiceSupport.tts} onPress={() => speak('Hola, soy Hermes. Hoy llevas $1,250.00 en ventas.', true)} />
        <ToggleRow label="Vibración" hint="Vibra al tocar, al guardar y cuando algo sale mal" value={a.haptics} onChange={(v) => { set({ haptics: v }); if (v) buzz('ok'); }} disabled={!voiceSupport.haptics} />
        {!voiceSupport.tts || !voiceSupport.haptics ? <Banner kind="info" text="La voz y la vibración se activan al instalar la actualización de la app en el iPhone." /> : null}
      </Card>

      <Card>
        <H>Dictado por voz</H>
        <P color={C.sub}>Habla en lugar de escribir: en Inicio, en Hermes y en la entrevista. El reconocimiento corre en el iPhone cuando el modelo de español está disponible.</P>
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <MicButton size={84} listening={dict.listening} onPress={dict.listening ? dict.stop : dict.start} label={dict.listening ? 'Terminar prueba de dictado' : 'Probar el dictado'} />
          <Text style={{ marginTop: 8, fontSize: fs(14), fontWeight: '700', color: dict.listening ? C.bad : C.pri }}>{dict.listening ? 'Escuchando… toca para terminar' : 'Toca y di algo'}</Text>
        </View>
        {dict.partial || oido ? <Banner kind="ok" text={`Escuché: ${dict.listening ? dict.partial : oido}`} /> : null}
        {dict.error ? <Banner kind="warn" text={dict.error} /> : null}
      </Card>

      <Card>
        <H>Con VoiceOver</H>
        <Small>Todos los botones tienen nombre, los montos se leen en pesos y los avisos se anuncian solos. Actívalo en Ajustes → Accesibilidad → VoiceOver, o pide a Siri "activa VoiceOver".</Small>
      </Card>
      <Btn title="Restablecer accesibilidad" kind="ghost" onPress={() => set(A11Y_DEFAULT)} />
    </Screen>
  );
}
