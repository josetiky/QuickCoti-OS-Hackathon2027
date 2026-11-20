// Bitácora encadenada: hash = SHA256(index|timestamp|type|payload canónico|prevHash). Append-only.
import * as Crypto from 'expo-crypto';
import type { LedgerEntry } from './types';

export const canonical = (p: Record<string, string>) => Object.keys(p).sort().map((k) => `${k}=${p[k] ?? ''}`).join('&');
export const sha256 = (s: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s);

export async function makeEntry(prev: LedgerEntry | undefined, type: string, payload: Record<string, string>): Promise<LedgerEntry> {
  const index = prev ? prev.index + 1 : 0;
  const prevHash = prev?.hash ?? 'GENESIS';
  const timestamp = new Date().toISOString();
  const hash = await sha256(`${index}|${timestamp}|${type}|${canonical(payload)}|${prevHash}`);
  return { index, timestamp, type, payload, prevHash, hash };
}

/** null = íntegra; si no, índice del primer registro alterado. */
export async function audit(entries: LedgerEntry[]): Promise<number | null> {
  let prev = 'GENESIS';
  for (const e of entries) {
    const h = await sha256(`${e.index}|${e.timestamp}|${e.type}|${canonical(e.payload)}|${e.prevHash}`);
    if (e.prevHash !== prev || h !== e.hash) return e.index;
    prev = e.hash;
  }
  return null;
}
