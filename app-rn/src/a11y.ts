// Accesibilidad de QuickCoti: ajustes (letra, contraste, voz, vibración, modo sencillo), lectura en voz alta,
// dictado por voz (reconocimiento de Apple en el iPhone, sin enviar audio a nuestros servidores), vibración y avisos para VoiceOver.
// Los módulos nativos se cargan con try: si no están instalados, la app sigue funcionando y lo dice.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { TEMA_PREDETERMINADO, type Tema } from './tema';

export type A11y = { textScale: number; highContrast: boolean; speak: boolean; haptics: boolean; simple: boolean; theme: Tema };
export const A11Y_DEFAULT: A11y = { textScale: 1, highContrast: false, speak: false, haptics: true, simple: false, theme: TEMA_PREDETERMINADO };
export const TEXT_SIZES = [{ v: 1, label: 'Normal' }, { v: 1.18, label: 'Grande' }, { v: 1.36, label: 'Muy grande' }];

let Speech: any = null, Haptics: any = null, SR: any = null;
// @ts-ignore — módulo opcional
try { Speech = require('expo-speech'); } catch { Speech = null; }
// @ts-ignore — módulo opcional
try { Haptics = require('expo-haptics'); } catch { Haptics = null; }
// @ts-ignore — módulo opcional
try { SR = require('expo-speech-recognition').ExpoSpeechRecognitionModule; } catch { SR = null; }
export const voiceSupport = { tts: !!Speech, stt: !!SR, haptics: !!Haptics };

let current: A11y = A11Y_DEFAULT;
export const setA11yRuntime = (a: A11y) => { current = a; };

let screenReader = false;
AccessibilityInfo.isScreenReaderEnabled().then((v) => { screenReader = v; }).catch(() => {});
AccessibilityInfo.addEventListener('screenReaderChanged', (v: boolean) => { screenReader = v; });
export const isScreenReaderOn = () => screenReader;

/** Avisa si el iPhone tiene "Reducir transparencia": entonces el vidrio se vuelve sólido. Devuelve cómo dejar de escuchar. */
export function vigilarTransparencia(cb: (v: boolean) => void): () => void {
  const ai: any = AccessibilityInfo;
  ai.isReduceTransparencyEnabled?.().then((v: boolean) => cb(!!v)).catch(() => {});
  const sub = ai.addEventListener?.('reduceTransparencyChanged', (v: boolean) => cb(!!v));
  return () => { try { sub?.remove?.(); } catch {} };
}

/** Lee los ajustes del iPhone (Aumentar contraste, Reducir movimiento) para proponer valores iniciales. */
export async function detectSystemA11y(): Promise<Partial<A11y>> {
  const ai: any = AccessibilityInfo;
  const safe = async (f?: () => Promise<boolean>) => { try { return f ? await f() : false; } catch { return false; } };
  const hc = await safe(ai.isDarkerSystemColorsEnabled?.bind(ai));
  const sr = await safe(ai.isScreenReaderEnabled?.bind(ai));
  return { highContrast: !!hc, simple: false, speak: false, haptics: true, ...(sr ? { simple: true } : {}) };
}

/** Quita emojis y símbolos decorativos para que VoiceOver y la voz no los lean. */
export const stripEmoji = (s: string) =>
  String(s ?? '').replace(/[←-⇿⌀-➿⬀-⯿️‍]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '').replace(/\s{2,}/g, ' ').trim();

/** $1,234.50 → "1,234 pesos con 50 centavos" (VoiceOver en español lee "$" como dólares). */
export function moneyA11y(n: number) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const p = Math.trunc(v), c = Math.round(Math.abs(v - p) * 100);
  return `${p.toLocaleString('es-MX')} ${Math.abs(p) === 1 ? 'peso' : 'pesos'}${c ? ` con ${c} centavos` : ''}`;
}

/** Texto apto para voz: montos en pesos, sin emojis, "×" como "por". */
export function forSpeech(t: string) {
  return stripEmoji(t)
    .replace(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g, (_m, ent, dec) => moneyA11y(parseFloat(String(ent).replace(/,/g, '') + (dec ? '.' + dec : ''))))
    .replace(/×/g, ' por ').replace(/·/g, ', ').replace(/\s{2,}/g, ' ').trim();
}

/** Anuncia a VoiceOver (si está activo) o lee en voz alta (si el usuario lo activó o se pide con force). */
export function speak(text: string, force = false) {
  const t = forSpeech(text);
  if (!t) return;
  if (screenReader) { AccessibilityInfo.announceForAccessibility(t); return; }
  if ((current.speak || force) && Speech) {
    try { Speech.stop(); Speech.speak(t, { language: 'es-MX', rate: 0.95, pitch: 1.0 }); } catch {}
  }
}
export function stopSpeaking() { try { Speech?.stop(); } catch {} }
/** Solo para VoiceOver (cambios de estado importantes: "compra registrada", errores). */
export function announce(text: string) { const t = forSpeech(text); if (t && screenReader) AccessibilityInfo.announceForAccessibility(t); }

/** Vibración: tap (selección), ok (éxito), warn (revisar), error. */
export function buzz(kind: 'tap' | 'ok' | 'warn' | 'error' = 'tap') {
  if (!current.haptics || !Haptics) return;
  try {
    if (kind === 'tap') Haptics.selectionAsync?.();
    else Haptics.notificationAsync?.(kind === 'ok' ? Haptics.NotificationFeedbackType.Success : kind === 'warn' ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Error);
  } catch {}
}

// ─── Dictado por voz ───
let owner = 0;
let seq = 0;
const ERR: Record<string, string> = {
  'not-allowed': 'Permite el micrófono y el reconocimiento de voz en Ajustes del iPhone.',
  'audio-capture': 'No pude usar el micrófono. ¿Otra app lo está usando?',
  'network': 'El dictado necesita internet en este iPhone. Escribe tu respuesta o usa el micrófono del teclado.',
  'language-not-supported': 'El dictado en español no está disponible en este iPhone. Usa el micrófono del teclado.',
  'service-not-allowed': 'El dictado no está disponible ahora. Usa el micrófono del teclado.',
  'busy': 'El micrófono está ocupado; intenta de nuevo.',
  'interrupted': 'Se interrumpió el dictado (llamada o Siri). Intenta de nuevo.',
};
const PALABRAS = ['Hermes', 'QuickCoti', 'CoDi', 'Mercado Pago', 'Bimbo', 'Coca-Cola', 'anticipo', 'renta', 'cotización', 'surtido', 'inventario', 'entregas a domicilio'];

/** Dictado: start() escucha, stop() termina; al terminar llama onFinal(texto). Solo el componente que inició recibe el texto. */
export function useDictation(onFinal?: (text: string) => void) {
  const id = useRef(++seq).current;
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const finalRef = useRef(onFinal); finalRef.current = onFinal;
  const textRef = useRef('');
  const onDeviceRef = useRef(false);

  useEffect(() => {
    if (!SR?.addListener) return;
    const subs = [
      SR.addListener('result', (e: any) => { if (owner !== id) return; const t = e?.results?.[0]?.transcript ?? ''; textRef.current = t; setPartial(t); }),
      SR.addListener('end', () => {
        if (owner !== id) return;
        setListening(false); owner = 0;
        const t = textRef.current.trim(); textRef.current = '';
        if (t) { buzz('ok'); finalRef.current?.(t); }
      }),
      SR.addListener('error', (e: any) => {
        if (owner !== id) return;
        const code = e?.error ?? '';
        if (onDeviceRef.current && (code === 'language-not-supported' || code === 'service-not-allowed')) { // reintento sin "solo en el iPhone"
          onDeviceRef.current = false;
          try { SR.start(opts(false)); return; } catch {}
        }
        setListening(false); owner = 0;
        if (code !== 'aborted' && code !== 'no-speech') { setError(ERR[code] ?? 'No pude escucharte. Intenta de nuevo o escribe.'); buzz('error'); }
      }),
    ];
    return () => { subs.forEach((s: any) => s?.remove?.()); if (owner === id) { try { SR.abort?.(); } catch {} owner = 0; } };
  }, [id]);

  const opts = (onDevice: boolean) => ({ lang: 'es-MX', interimResults: true, addsPunctuation: true, continuous: false, requiresOnDeviceRecognition: onDevice, contextualStrings: PALABRAS });

  const start = useCallback(async () => {
    setError(null); setPartial(''); textRef.current = '';
    if (!SR) { setError('El dictado por voz se activa al instalar la actualización. Mientras, usa el micrófono del teclado del iPhone.'); return; }
    try {
      const p = await SR.requestPermissionsAsync();
      if (!p?.granted) { setError(ERR['not-allowed']); buzz('error'); return; }
      stopSpeaking();
      owner = id;
      onDeviceRef.current = !!SR.supportsOnDeviceRecognition?.();
      SR.start(opts(onDeviceRef.current));
      setListening(true); buzz('tap');
    } catch (e: any) { owner = 0; setListening(false); setError('No pude usar el micrófono: ' + (e?.message ?? e)); }
  }, [id]);

  const stop = useCallback(() => { try { SR?.stop?.(); } catch {} }, []);
  return { available: !!SR, listening, partial, error, start, stop, clearError: () => setError(null) };
}
