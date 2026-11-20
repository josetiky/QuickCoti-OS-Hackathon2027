// Red de seguridad: si una pantalla truena al dibujarse, en lugar de cerrarse la app muestra un mensaje y deja reintentar.
// (En la compilación Release, un error sin atrapar cierra la app.) Lo ya guardado no se pierde: vive en el almacenamiento.
import React from 'react';
import { View } from 'react-native';
import { Btn, C, H, IconChip, P } from '../ui';

type Props = {
  children: React.ReactNode; titulo?: string; mensaje?: string; textoReintentar?: string;
  onReintentar: () => void; onSalir?: () => void; extra?: React.ReactNode;
};

export class Atrapa extends React.Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.warn('Pantalla atrapada por la red de seguridad', error); }
  render() {
    if (!this.state.error) return this.props.children;
    const p = this.props;
    const mensaje = p.mensaje ?? 'No se perdió nada de lo que ya guardaste. Intenta de nuevo.';
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg, gap: 8 }}>
        <IconChip name="alert" size={72} color={C.bad} bg={C.badBg} />
        <H style={{ textAlign: 'center' }}>{p.titulo ?? 'Algo no salió bien'}</H>
        <View accessible accessibilityRole="alert" accessibilityLabel={mensaje}><P style={{ textAlign: 'center' }}>{mensaje}</P></View>
        <View style={{ width: '100%', marginTop: 16 }}>
          <Btn title={p.textoReintentar ?? 'Intentar de nuevo'} icon="check" onPress={p.onReintentar} />
          {p.extra}
          {p.onSalir ? <Btn title="Volver" kind="sec" onPress={p.onSalir} /> : null}
        </View>
      </View>
    );
  }
}
