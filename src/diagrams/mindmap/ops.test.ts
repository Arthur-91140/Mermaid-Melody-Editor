// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb } from '../testing/mermaidDb';
import { walkMind } from './model';
import { addChild, addSibling, deleteMind, duplicateMind, keyAfterReparse, moveMind, setMindText, updateMind } from './ops';
import { parseMindmap } from './parse';
import { serializeMindmap } from './serialize';

const parse = (code: string) => parseMindmap(splitDocument(code).body);
const write = (m: ReturnType<typeof parse>) => {
  const s = serializeMindmap(m);
  return [s.header, ...s.body].join('\n');
};
const texts = (m: ReturnType<typeof parse>) => {
  const out: string[] = [];
  walkMind(m.root, (n, _p, d) => out.push(`${d}:${n.text}`));
  return out;
};

describe('mindmap editing operations', () => {
  it('adds children and siblings and predicts their keys after reparse', async () => {
    let m = parse('mindmap\n  root((Root))\n    A\n    B');
    const c = addChild(m, 'm1', 'A1');
    m = c.model;
    const s = addSibling(m, 'm1', 'A bis');
    m = s.model;
    expect(texts(m)).toEqual(['0:Root', '1:A', '2:A1', '1:A bis', '1:B']);
    expect(keyAfterReparse(m, s.key)).toBe('m3');
    const re = parse(write(m));
    expect(texts(re)).toEqual(texts(m));
    const db = await mermaidDb(write(m));
    expect(db.getMindmap().children).toHaveLength(3);
  });

  it('escapes delimiters in text', async () => {
    let m = parse('mindmap\n  root\n    A');
    m = setMindText(m, 'm1', 'Budget (2026)\nsecond line');
    const code = write(m);
    expect(code).toContain('["Budget (2026)<br>second line"]');
    const db = await mermaidDb(code);
    expect(db.getMindmap().children[0].descr).toBe('Budget (2026)<br>second line');
  });

  it('moves, duplicates and deletes subtrees, never the root', () => {
    let m = parse('mindmap\n  root\n    A\n      A1\n    B');
    m = moveMind(m, 'm1', 'm3');
    expect(texts(m)).toEqual(['0:root', '1:B', '2:A', '3:A1']);
    expect(moveMind(m, 'm3', 'm2')).toBe(m);
    m = duplicateMind(m, 'm1').model;
    expect(texts(m)).toEqual(['0:root', '1:B', '2:A', '3:A1', '2:A', '3:A1']);
    m = deleteMind(m, ['m0', 'm3']);
    expect(texts(m)).toEqual(['0:root']);
    expect(updateMind(m, 'm0', { shape: 'cloud' }).root!.shape).toBe('cloud');
  });
});
