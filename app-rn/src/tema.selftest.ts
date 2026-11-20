// Pruebas del tema: contraste WCAG AA en las 4 paletas y reglas de elección. Ejecuta: npm run test:tema
import { PALETAS, TEMA_PREDETERMINADO, contraste, elegirPaleta, modoVidrio, type Paleta } from './tema';

const casos: { name: string; pass: boolean }[] = [];
function caso(name: string, fn: () => boolean) {
  let pass = false;
  try { pass = fn(); } catch { pass = false; }
  casos.push({ name, pass });
}
const cerca = (a: number, b: number) => Math.abs(a - b) < 0.01;

caso('Contraste negro/blanco = 21', () => cerca(contraste('#000000', '#FFFFFF'), 21));
caso('Contraste #777777/blanco ≈ 4.48 (vector conocido)', () => cerca(contraste('#777777', '#FFFFFF'), 4.48));
caso('Contraste es simétrico', () => cerca(contraste('#4F54E5', '#ECEDFF'), contraste('#ECEDFF', '#4F54E5')));
caso('Tema predeterminado es claro', () => TEMA_PREDETERMINADO === 'claro');
caso('Sin tema guardado → claro, con vidrio', () => {
  const r = elegirPaleta({ highContrast: false }, false);
  return r.colores === PALETAS.claro && !r.oscuro && r.vidrio;
});
caso('Oscuro → paleta oscura, con vidrio', () => {
  const r = elegirPaleta({ theme: 'oscuro', highContrast: false }, false);
  return r.colores === PALETAS.oscuro && r.oscuro && r.vidrio;
});
caso('Oscuro + alto contraste → contraste oscuro, sin vidrio', () => {
  const r = elegirPaleta({ theme: 'oscuro', highContrast: true }, false);
  return r.colores === PALETAS.contrasteOscuro && r.oscuro && !r.vidrio;
});
caso('Claro + alto contraste → contraste claro, sin vidrio', () => {
  const r = elegirPaleta({ theme: 'claro', highContrast: true }, false);
  return r.colores === PALETAS.contrasteClaro && !r.oscuro && !r.vidrio;
});
caso('Reducir transparencia apaga el vidrio', () => !elegirPaleta({ theme: 'claro', highContrast: false }, true).vidrio);
caso('Las 4 paletas tienen las mismas llaves', () => {
  const k = (p: Paleta) => Object.keys(p).sort().join(',');
  return [PALETAS.oscuro, PALETAS.contrasteClaro, PALETAS.contrasteOscuro].every((p) => k(p) === k(PALETAS.claro));
});
const PARES: [keyof Paleta | '#FFFFFF', keyof Paleta][] = [
  ['text', 'bg'], ['text', 'card'], ['navy', 'bg'], ['navy', 'card'], ['sub', 'bg'], ['sub', 'card'],
  ['onPri', 'pri'], ['pri', 'bg'], ['pri', 'soft'], ['priDark', 'soft'], ['ok', 'okBg'], ['warn', 'warnBg'],
  ['bad', 'badBg'], ['#FFFFFF', 'badFill'], ['warn', 'card'], ['bad', 'card'], ['text', 'field'],
];
for (const [nombre, p] of Object.entries(PALETAS) as [string, Paleta][]) {
  for (const [a, b] of PARES) {
    const ca = a === '#FFFFFF' ? a : p[a];
    caso(`AA ${nombre}: ${a} sobre ${b} ≥ 4.5`, () => contraste(ca, p[b]) >= 4.5);
  }
}
caso('modoVidrio: con vidrio y Liquid Glass → liquid', () => modoVidrio(true, true) === 'liquid');
caso('modoVidrio: con vidrio sin Liquid Glass → translucido', () => modoVidrio(true, false) === 'translucido');
caso('modoVidrio: sin vidrio → solido', () => modoVidrio(false, true) === 'solido');

const malos = casos.filter((t) => !t.pass);
for (const t of malos) console.log(`✘ ${t.name}`);
console.log(`${casos.length - malos.length}/${casos.length} casos pasan`);
if (!malos.length) console.log('OK tema');
process.exit(malos.length ? 1 : 0);
