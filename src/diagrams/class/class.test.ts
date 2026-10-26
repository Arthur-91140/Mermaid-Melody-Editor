import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { CLASS_CORPUS } from './corpus';
import { parseClass } from './parse';
import { serializeClass } from './serialize';

const parse = (code: string) => {
  const d = splitDocument(code);
  return parseClass(d.keyword, d.body);
};
const write = (code: string) => {
  const s = serializeClass(parse(code));
  return [s.header, ...s.body].join('\n');
};

describe('class diagram parser', () => {
  it('reads classes, members and notes', () => {
    const m = parse(CLASS_CORPUS[0]);
    const animal = m.classes.find((c) => c.id === 'Animal')!;
    expect(animal.members).toEqual(['+int age', '+String gender', '+isMammal()', '+mate()']);
    expect(m.classes.find((c) => c.id === 'Duck')!.members).toEqual(['+String beakColor', '+swim()', '+quack()']);
    expect(m.notes).toEqual([
      { target: null, text: 'From Duck till Zebra' },
      { target: 'Duck', text: 'can fly\\ncan swim' },
    ]);
    expect(m.relations[0]).toMatchObject({ from: 'Animal', to: 'Duck', fromMarker: 'inheritance', toMarker: 'none' });
  });

  it('reads every relation kind', () => {
    const m = parse(CLASS_CORPUS[1]);
    expect(m.direction).toBe('RL');
    expect(m.relations.map((r) => [r.fromMarker, r.line, r.toMarker, r.label])).toEqual([
      ['none', 'solid', 'inheritance', 'Inheritance'],
      ['none', 'solid', 'composition', 'Composition'],
      ['none', 'solid', 'aggregation', 'Aggregation'],
      ['none', 'solid', 'arrow', 'Association'],
      ['none', 'solid', 'none', 'Link(Solid)'],
      ['none', 'dashed', 'arrow', 'Dependency'],
      ['none', 'dashed', 'inheritance', 'Realization'],
      ['none', 'dashed', 'none', 'Link(Dashed)'],
    ]);
  });

  it('reads cardinalities, annotations, generics and namespaces', () => {
    const m = parse(CLASS_CORPUS[2]);
    expect(m.relations[1]).toMatchObject({ from: 'Student', to: 'Course', fromCard: '1', toCard: '1..*' });
    expect(m.relations[2]).toMatchObject({ fromCard: null, toCard: 'many', label: 'Contains' });
    expect(m.relations[3]).toMatchObject({ fromMarker: 'inheritance', toMarker: 'inheritance' });
    const m3 = parse(CLASS_CORPUS[3]);
    expect(m3.classes.find((c) => c.id === 'Square')!.generic).toBe('Shape');
    expect(m3.classes.find((c) => c.id === 'Engine')!.annotations).toEqual(['Service']);
    expect(m3.classes.find((c) => c.id === 'Animal')!.label).toBe('Animal with a label');
    const m4 = parse(CLASS_CORPUS[4]);
    expect(m4.classes.filter((c) => c.namespace === 'BaseShapes').map((c) => c.id)).toEqual(['Triangle', 'Rectangle']);
  });

  CLASS_CORPUS.forEach((code, i) => {
    it(`sample #${i} round-trips to a stable form`, () => {
      const once = write(code);
      expect(write(once)).toBe(once);
      expect(parse(once).relations).toEqual(parse(code).relations);
    });
  });
});
