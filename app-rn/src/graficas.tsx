// Gráficas sencillas con react-native-svg (colores del tema). Siempre acompañadas de su lista o tabla y de una
// etiqueta para VoiceOver: nunca dependen solo del color.
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { C, Row, Small } from './ui';

/** Colores por categoría de la dona (se distinguen en tema claro y oscuro). */
export const PALETA_DONA = ['#4F54E5', '#0EA5E9', '#14B8A6', '#F59E0B', '#EC4899', '#8B5CF6', '#94A3B8'];

export function Dona({ datos, tamano = 150, a11y }: { datos: { etiqueta: string; valor: number; color: string }[]; tamano?: number; a11y: string }) {
  const total = datos.reduce((a, d) => a + d.valor, 0);
  const c = tamano / 2; const r = c - 14; const circ = 2 * Math.PI * r;
  let acum = 0;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11y} style={{ alignItems: 'center' }}>
      <Svg width={tamano} height={tamano}>
        <G rotation={-90} origin={`${c}, ${c}`}>
          <Circle cx={c} cy={c} r={r} stroke={C.track} strokeWidth={22} fill="none" />
          {total > 0 && datos.map((d, i) => {
            const largo = (d.valor / total) * circ;
            const arco = <Circle key={i} cx={c} cy={c} r={r} stroke={d.color} strokeWidth={22} fill="none" strokeDasharray={`${largo} ${circ - largo}`} strokeDashoffset={-acum} />;
            acum += largo;
            return arco;
          })}
        </G>
      </Svg>
    </View>
  );
}

export function Barras({ datos, a11y }: { datos: { etiqueta: string; ventas: number; compras: number }[]; a11y: string }) {
  const W = 340; const H = 170; const base = 140; const arriba = 10; const n = Math.max(1, datos.length);
  const max = Math.max(1, ...datos.flatMap((d) => [d.ventas, d.compras]));
  const paso = W / n; const ancho = Math.min(14, paso * 0.32);
  const alto = (v: number) => ((base - arriba) * v) / max;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11y}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={base} width={W} height={1} fill={C.line} />
        {datos.map((d, i) => {
          const cx = paso * i + paso / 2;
          return (
            <G key={i}>
              <Rect x={cx - ancho - 1} y={base - alto(d.ventas)} width={ancho} height={alto(d.ventas)} rx={3} fill={C.pri} />
              <Rect x={cx + 1} y={base - alto(d.compras)} width={ancho} height={alto(d.compras)} rx={3} fill={C.warn} />
              <SvgText x={cx} y={H - 8} fontSize={n > 7 ? 9 : 11} fill={C.sub} textAnchor="middle">{d.etiqueta}</SvgText>
            </G>
          );
        })}
      </Svg>
      <Row style={{ gap: 16, justifyContent: 'center', marginTop: 4 }}>
        <Row style={{ gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: C.pri }} /><Small>Ventas</Small></Row>
        <Row style={{ gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: C.warn }} /><Small>Compras</Small></Row>
      </Row>
    </View>
  );
}
