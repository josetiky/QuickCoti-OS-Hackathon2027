// Aviso de privacidad que la app muestra antes de pedir los datos del titular.
// Cubre los elementos del art. 15 de la LFPDPPP (DOF 20-03-2025) y el consentimiento expreso para datos financieros (art. 7).
// Versión completa: evento/docs_entrega/AVISO_PRIVACIDAD.md
export const AVISO_VERSION = '2026-11-20';

export const AVISO_CORTO: string[] = [
  'Responsable: equipo QuickCoti (prototipo del Hackathon Oaxaca 2027), Oaxaca de Juárez, Oaxaca. El aviso completo, con domicilio y correo de contacto, está en la ficha del proyecto.',
  'Datos que te pedimos: nombre completo, CURP, cuenta CLABE (dato financiero) y, si quieres, tu teléfono. No pedimos datos sensibles.',
  'Para qué: identificarte como titular del negocio dentro de la app y saber a qué cuenta CLABE se depositaría lo que cobras (en este prototipo los cobros son simulados). No los usamos para publicidad ni para hacer perfiles, y no los compartimos.',
  'Dónde quedan: cifrados en el llavero (Keychain) de este iPhone y solo en este dispositivo. No se sincronizan con iCloud, no se envían a ningún servidor y no pasan por Hermes (la IA). El QR y el ticket solo muestran los últimos 4 dígitos de tu CLABE.',
  'Tus derechos ARCO: en Ajustes → Mis datos puedes verlos (acceso), corregirlos (rectificación) y borrarlos (cancelación). Borrarlos también retira tu consentimiento, y puedes oponerte a su uso dejando de usar esta función.',
  'Al activar "Acepto" das tu consentimiento expreso, que la ley pide para datos financieros como la CLABE. Si este aviso cambia, lo publicaremos en la ficha del proyecto y en la app.',
];
