// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb } from '../testing/mermaidDb';
import {
  addClass,
  addNamespace,
  addRelation,
  applyPreset,
  deleteClassItems,
  duplicateClasses,
  formatMember,
  relationPreset,
  renameClass,
  reverseRelation,
  updateClass,
} from './ops';
import { parseClass } from './parse';
import { serializeClass } from './serialize';

const parse = (code: string) => {
  const d = splitDocument(code);
  return parseClass(d.keyword, d.body);
};
const write = (m: ReturnType<typeof parse>) => {
  const s = serializeClass(m);
  return [s.header, ...s.body].join('\n');
};

describe('class diagram editing operations', () => {
  it('builds a valid diagram from scratch', async () => {
    let m = parse('classDiagram');
    const a = addClass(m, 'Animal');
    m = updateClass(a.model, a.id, { members: ['+String name', '+eat() void'], annotations: ['abstract'] });
    const d = addClass(m, 'Dog');
    m = addRelation(d.model, d.id, a.id, 'inheritance');
    const ns = addNamespace(m, 'Zoo', [d.id]);
    const code = write(ns.model);
    expect(code).toContain('Dog --|> Animal');
    const db = await mermaidDb(code);
    expect(db.getRelations()[0].relation.type2).toBe(1);
    expect(db.getClass('Dog').parent).toBe('Zoo');
  });

  it('detects and applies presets on the marked end', () => {
    const m = parse('classDiagram\n  A <|-- B\n  C ..> D\n  E *--o F');
    expect(m.relations.map(relationPreset)).toEqual(['inheritance', 'dependency', null]);
    expect(applyPreset(m.relations[0], 'composition')).toMatchObject({ fromMarker: 'composition', toMarker: 'none', line: 'solid' });
  });

  it('renames, reverses, duplicates and deletes', () => {
    let m = parse('classDiagram\n  A "1" --> "*" B : has\n  note for A "hello"');
    m = renameClass(m, 'A', 'Owner');
    expect(m.relations[0].from).toBe('Owner');
    expect(m.notes[0].target).toBe('Owner');
    m = reverseRelation(m, 0);
    expect(m.relations[0]).toMatchObject({ from: 'B', to: 'Owner', fromMarker: 'arrow', toMarker: 'none', fromCard: '*', toCard: '1' });
    const dup = duplicateClasses(m, ['Owner']);
    expect(dup.mapping.get('Owner')).toBe('Owner2');
    m = deleteClassItems(dup.model, ['Owner'], [], []);
    expect(m.relations).toHaveLength(0);
    expect(m.notes).toHaveLength(0);
  });

  it('formats members like Mermaid', () => {
    expect(formatMember('+eat(food) bool')).toEqual({ text: '+eat(food) : bool', isStatic: false, isAbstract: false });
    expect(formatMember('+List~int~ items')).toMatchObject({ text: '+List<int> items' });
    expect(formatMember('+count()$ int')).toMatchObject({ isStatic: true });
    expect(formatMember('+draw()*')).toMatchObject({ text: '+draw()', isAbstract: true });
  });
});
