import { deflate, inflate } from 'pako';
import type { Layout } from '../store/documents';
import type { MermaidTheme } from '../store/settings';

/**
 * Payload of a share link. It uses the same `pako:` encoding as Mermaid Live
 * (`code` + `mermaid` config), so links can be opened there too.
 */
export interface SharePayload {
  code: string;
  mermaid?: string;
  name?: string;
  layout?: Layout;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeShare(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  return 'pako:' + toBase64Url(deflate(new TextEncoder().encode(json), { level: 9 }));
}

export function decodeShare(hash: string): SharePayload | null {
  const raw = hash.replace(/^#/, '');
  if (!raw.startsWith('pako:')) return null;
  try {
    const json = inflate(fromBase64Url(raw.slice(5)), { toText: true });
    const data = JSON.parse(json) as SharePayload;
    return typeof data.code === 'string' ? data : null;
  } catch {
    return null;
  }
}

export function shareUrl(payload: SharePayload): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#${encodeShare(payload)}`;
}

export function mermaidLiveUrl(code: string, theme: MermaidTheme): string {
  return `https://mermaid.live/edit#${encodeShare({ code, mermaid: JSON.stringify({ theme }) })}`;
}
