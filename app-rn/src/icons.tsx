// Íconos de línea (estilo SF Symbols del diseño SwiftUI de referencia), dibujados con react-native-svg. Decorativos: no los lee VoiceOver.
import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home' | 'box' | 'cart' | 'cash' | 'mic' | 'menu' | 'camera' | 'qr' | 'key' | 'truck' | 'doc' | 'sparkles' | 'sliders'
  | 'shield' | 'chevron' | 'plus' | 'check' | 'speaker' | 'close' | 'user' | 'a11y' | 'up' | 'down' | 'clock' | 'stop'
  | 'send' | 'alert' | 'image' | 'pen' | 'target' | 'list' | 'ticket' | 'minus';

const D: Record<IconName, React.ReactNode> = {
  home: <><Path d="M3 10.5 12 3l9 7.5" /><Path d="M5 9.5V21h14V9.5" /><Path d="M10 21v-6h4v6" /></>,
  box: <><Path d="M21 8 12 3 3 8v8l9 5 9-5z" /><Path d="M3 8l9 5 9-5" /><Path d="M12 13v8" /></>,
  cart: <><Path d="M2 3h3l2.4 11.2a1 1 0 0 0 1 .8h9.8a1 1 0 0 0 1-.8L21 7H6" /><Circle cx="9" cy="20" r="1.5" /><Circle cx="18" cy="20" r="1.5" /></>,
  cash: <><Rect x="2" y="6" width="20" height="12" rx="2" /><Circle cx="12" cy="12" r="2.5" /><Path d="M6 12h.01M18 12h.01" /></>,
  mic: <><Rect x="9" y="2" width="6" height="12" rx="3" /><Path d="M5 11a7 7 0 0 0 14 0" /><Path d="M12 18v4M8 22h8" /></>,
  menu: <Path d="M4 6h16M4 12h16M4 18h16" />,
  camera: <><Path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H8l1.5-2h5L16 6h2.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" /><Circle cx="12" cy="13" r="3.5" /></>,
  qr: <><Rect x="3" y="3" width="7" height="7" rx="1" /><Rect x="14" y="3" width="7" height="7" rx="1" /><Rect x="3" y="14" width="7" height="7" rx="1" /><Path d="M14 14h3v3h-3zM18 18h3v3h-3zM21 14v.01M14 21h.01" /></>,
  key: <><Circle cx="7.5" cy="15.5" r="4.5" /><Path d="M10.7 12.3 20 3M16.5 6.5 19 9M14 9l2 2" /></>,
  truck: <><Path d="M2 6h12v11H2z" /><Path d="M14 10h4l3 3.5V17h-7" /><Circle cx="6.5" cy="18" r="2" /><Circle cx="17.5" cy="18" r="2" /></>,
  minus: <Path d="M5 12h14" />,
  ticket: <><Path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" /><Path d="M9 8h6M9 12h6M9 16h3" /></>,
  doc: <><Path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><Path d="M14 3v5h5" /><Path d="M8.5 13h7M8.5 17h4.5" /></>,
  sparkles: <><Path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><Path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>,
  sliders: <><Path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><Circle cx="15" cy="6" r="2" /><Circle cx="9" cy="12" r="2" /><Circle cx="17" cy="18" r="2" /></>,
  shield: <><Path d="M12 3l8 3v6c0 4.8-3.4 7.9-8 9-4.6-1.1-8-4.2-8-9V6z" /><Path d="M9 12l2.2 2.2L15.5 10" /></>,
  chevron: <Path d="M9 6l6 6-6 6" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  speaker: <><Path d="M11 5 6 9H3v6h3l5 4z" /><Path d="M15.5 9a4 4 0 0 1 0 6M18.5 6a8 8 0 0 1 0 12" /></>,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M4 21a8 8 0 0 1 16 0" /></>,
  a11y: <><Circle cx="12" cy="4.5" r="1.8" /><Path d="M5 8.5l7 1.5 7-1.5M12 10v4.5M12 14.5 9 21M12 14.5l3 6.5" /></>,
  up: <Path d="M7 17 17 7M9 7h8v8" />,
  down: <Path d="M17 7 7 17M15 17H7V9" />,
  clock: <><Circle cx="12" cy="12" r="9" /><Path d="M12 7v5l3 2" /></>,
  stop: <Rect x="6" y="6" width="12" height="12" rx="2" />,
  send: <><Path d="M4 12 20 4l-4 16-4-7z" /><Path d="M12 13 20 4" /></>,
  alert: <><Path d="M12 3 2 20h20z" /><Path d="M12 10v4M12 17h.01" /></>,
  image: <><Rect x="3" y="4" width="18" height="16" rx="2" /><Circle cx="9" cy="10" r="2" /><Path d="M21 16l-5-5L5 20" /></>,
  pen: <><Path d="M4 20h4L19 9l-4-4L4 16z" /><Path d="M13.5 6.5l4 4" /></>,
  target: <><Circle cx="12" cy="12" r="9" /><Circle cx="12" cy="12" r="5" /><Circle cx="12" cy="12" r="1" /></>,
  list: <Path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
};

let colorPredeterminado = '#13213F'; // lo ajusta applyTheme (ui.tsx) según el tema
export const setIconColor = (c: string) => { colorPredeterminado = c; };

export function Icon({ name, size = 22, color, strokeWidth = 2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} importantForAccessibility="no-hide-descendants">
      <G fill="none" stroke={color ?? colorPredeterminado} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">{D[name]}</G>
    </Svg>
  );
}
