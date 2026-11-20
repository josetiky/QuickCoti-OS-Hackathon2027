// Tema de QuickCoti: paletas claro/oscuro (+ alto contraste de cada una) y reglas para elegirlas.
// Puro (sin React Native) para probarlo con tsx: el contraste de cada paleta se verifica en tema.selftest.ts.
export type Tema = 'claro' | 'oscuro';
export const TEMA_PREDETERMINADO: Tema = 'claro';

export type Paleta = {
  bg: string; card: string; navy: string; text: string; sub: string; pri: string; priDark: string; onPri: string;
  soft: string; field: string; ok: string; okBg: string; warn: string; warnBg: string; bad: string; badBg: string; badFill: string;
  line: string; hair: string; track: string; placeholder: string; glassBg: string; glassLine: string; glow1: string; glow2: string;
};

// A · Claro cristal (los colores de siempre + vidrio blanco y brillo índigo).
const claro: Paleta = {
  bg: '#F6F8FB', card: '#FFFFFF', navy: '#13213F', text: '#1A2233', sub: '#5E6779', pri: '#4F54E5', priDark: '#3B3FC4', onPri: '#FFFFFF',
  soft: '#ECEDFF', field: '#F1F3F8', ok: '#15803D', okBg: '#DCFCE7', warn: '#B45309', warnBg: '#FEF3C7', bad: '#B91C1C', badBg: '#FEE2E2', badFill: '#B91C1C',
  line: '#E3E7EF', hair: 'rgba(19,33,63,0.07)', track: '#E5E7EB', placeholder: '#8A93A6',
  glassBg: 'rgba(255,255,255,0.62)', glassLine: 'rgba(255,255,255,0.95)', glow1: '#8B8FF5', glow2: '#C4B5FD',
};
// B · Oscuro premium: azul marino casi negro, marfil y champaña.
const oscuro: Paleta = {
  bg: '#0E1424', card: '#172036', navy: '#F5F3EE', text: '#E8E6E1', sub: '#A3ACBD', pri: '#D8BE8A', priDark: '#E9D5A8', onPri: '#13213F',
  soft: '#262C40', field: '#1C2640', ok: '#4ADE80', okBg: '#0F2E1D', warn: '#FBBF24', warnBg: '#33270A', bad: '#F87171', badBg: '#3A1414', badFill: '#B91C1C',
  line: '#2A3450', hair: 'rgba(255,255,255,0.08)', track: '#2A3450', placeholder: '#7C869A',
  glassBg: 'rgba(255,255,255,0.07)', glassLine: 'rgba(255,255,255,0.16)', glow1: '#4F54E5', glow2: '#C9A96E',
};
// Alto contraste (sin vidrio ni brillo).
const contrasteClaro: Paleta = {
  bg: '#FFFFFF', card: '#FFFFFF', navy: '#000000', text: '#000000', sub: '#1F2937', pri: '#2A2DB0', priDark: '#1B1D85', onPri: '#FFFFFF',
  soft: '#DCDDFF', field: '#FFFFFF', ok: '#0B5D2A', okBg: '#C7F5D6', warn: '#7A3A00', warnBg: '#FFE38A', bad: '#8B0000', badBg: '#FFD0D0', badFill: '#8B0000',
  line: '#111827', hair: '#111827', track: '#D1D5DB', placeholder: '#374151',
  glassBg: '#FFFFFF', glassLine: '#111827', glow1: '#FFFFFF', glow2: '#FFFFFF',
};
const contrasteOscuro: Paleta = {
  bg: '#000000', card: '#000000', navy: '#FFFFFF', text: '#FFFFFF', sub: '#E5E7EB', pri: '#FFD979', priDark: '#FFE7A8', onPri: '#000000',
  soft: '#1A1A1A', field: '#000000', ok: '#5CFF8A', okBg: '#002A10', warn: '#FFD54A', warnBg: '#2A2000', bad: '#FF8080', badBg: '#2A0000', badFill: '#C00000',
  line: '#FFFFFF', hair: '#FFFFFF', track: '#6B7280', placeholder: '#D1D5DB',
  glassBg: '#000000', glassLine: '#FFFFFF', glow1: '#000000', glow2: '#000000',
};
export const PALETAS = { claro, oscuro, contrasteClaro, contrasteOscuro };

// Contraste WCAG 2.x entre dos colores #RRGGBB.
function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const canal = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}
export function contraste(a: string, b: string): number {
  const la = luminancia(a); const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function elegirPaleta(a: { theme?: Tema; highContrast: boolean }, reducirTransparencia: boolean): { colores: Paleta; oscuro: boolean; vidrio: boolean } {
  const os = a.theme === 'oscuro';
  const hc = !!a.highContrast;
  const colores = hc ? (os ? PALETAS.contrasteOscuro : PALETAS.contrasteClaro) : os ? PALETAS.oscuro : PALETAS.claro;
  return { colores, oscuro: os, vidrio: !hc && !reducirTransparencia };
}

export function modoVidrio(vidrio: boolean, liquidDisponible: boolean): 'liquid' | 'translucido' | 'solido' {
  if (!vidrio) return 'solido';
  return liquidDisponible ? 'liquid' : 'translucido';
}
