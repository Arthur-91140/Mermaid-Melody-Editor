// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb } from '../testing/mermaidDb';
import { addEntity, addErRelation, deleteErItems, duplicateEntities, renameEntity, reverseErRelation, updateEntity } from './ops';
import { parseEr } from './parse';
import { serializeEr } from './serialize';

const parse = (code: string) => parseEr(splitDocument(code).body);
const write = (m: ReturnType<typeof parse>) => {
  const s = serializeEr(m);
  return [s.header, ...s.body].join('\n');
};

describe('ER editing operations', () => {
  it('builds a valid diagram with attributes and aliases', async () => {
    let m = parse('erDiagram');
    const a = addEntity(m, 'CLIENT', [{ type: 'int', name: 'id', keys: ['PK'], comment: null }]);
    const b = addEntity(a.model, 'COMMANDE', [{ type: 'date', name: 'creee_le', keys: [], comment: 'Date de création' }]);
    m = addErRelation(b.model, a.id, b.id, 'passe des commandes');
    m = updateEntity(m, a.id, { alias: 'Client fidèle' });
    const db = await mermaidDb(write(m));
    expect(db.getEntities().get('CLIENT').alias).toBe('Client fidèle');
    expect(db.getRelationships()[0].roleA).toBe('passe des commandes');
  });

  it('renames, reverses, duplicates and deletes', () => {
    let m = parse('erDiagram\n  A ||--o{ B : has');
    m = renameEntity(m, 'A', 'OWNER');
    m = reverseErRelation(m, 0);
    expect(m.relations[0]).toMatchObject({ from: 'B', to: 'OWNER', fromCard: 'zero-many', toCard: 'exactly-one' });
    const dup = duplicateEntities(m, ['B']);
    expect(dup.mapping.get('B')).toBe('B2');
    m = deleteErItems(dup.model, ['OWNER'], []);
    expect(m.relations).toHaveLength(0);
    expect(m.entities.map((e) => e.id)).toEqual(['B', 'B2']);
  });
});
