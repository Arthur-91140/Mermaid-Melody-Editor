import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from './share';

describe('share links', () => {
  it('round-trips code, name and layout including non-ASCII text', () => {
    const payload = { code: 'flowchart LR\n  A[Été ☀️] --> B', name: 'Démo', layout: { A: { x: 1, y: 2 } } };
    const encoded = encodeShare(payload);
    expect(encoded.startsWith('pako:')).toBe(true);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeShare('#' + encoded)).toEqual(payload);
  });

  it('rejects malformed hashes', () => {
    expect(decodeShare('#pako:%%%')).toBeNull();
    expect(decodeShare('#something')).toBeNull();
  });
});
