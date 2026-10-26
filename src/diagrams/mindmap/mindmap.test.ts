import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { MINDMAP_CORPUS } from './corpus';
import { walkMind } from './model';
import { parseMindmap } from './parse';
import { serializeMindmap } from './serialize';

const parse = (code: string) => parseMindmap(splitDocument(code).body);
const write = (code: string) => {
  const s = serializeMindmap(parse(code));
  return [s.header, ...s.body].join('\n');
};
const shape = (code: string) => {
  const out: string[] = [];
  walkMind(parse(code).root, (n, _p, depth) => out.push(`${depth}:${n.shape}:${n.nodeId ?? ''}:${n.text}:${n.icon ?? ''}:${n.cssClass ?? ''}`));
  return out;
};

describe('mindmap parser', () => {
  it('builds the tree from indentation', () => {
    const m = parse(MINDMAP_CORPUS[0]);
    expect(m.root).toMatchObject({ shape: 'circle', nodeId: 'root', text: 'mindmap' });
    expect(m.root!.children.map((c) => c.text)).toEqual(['Origins', 'Research', 'Tools']);
    expect(m.root!.children[0].children[0].icon).toBe('fa fa-book');
    expect(m.root!.children[1].children[1].children[0].children.map((c) => c.text)).toEqual([
      'Creative techniques',
      'Strategic planning',
      'Argument mapping',
    ]);
  });

  it('reads every shape', () => {
    const m = parse(MINDMAP_CORPUS[1]);
    expect(m.root!.children.map((c) => [c.nodeId, c.shape, c.text])).toEqual([
      ['A', 'square', 'Square'],
      ['B', 'rounded', 'Rounded'],
      ['C', 'circle', 'Circle'],
      ['D', 'bang', 'Bang'],
      ['E', 'cloud', 'Cloud'],
      ['F', 'hexagon', 'Hexagon'],
      ['G', 'square', '"`**Markdown** text`"'],
      [null, 'square', 'No id square'],
    ]);
    expect(m.root!.children[5].cssClass).toBe('urgent large');
  });

  it('attaches to the closest less indented node', () => {
    const m = parse(MINDMAP_CORPUS[2]);
    expect(m.root!.children.map((c) => c.text)).toEqual(['deeper', 'sibling']);
    expect(m.extras).toEqual(['%% a comment']);
  });

  MINDMAP_CORPUS.forEach((code, i) => {
    it(`sample #${i} round-trips to a stable form`, () => {
      const once = write(code);
      expect(write(once)).toBe(once);
      expect(shape(once)).toEqual(shape(code));
    });
  });
});
