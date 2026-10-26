import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { ER_CORPUS } from './corpus';
import { parseEr } from './parse';
import { serializeEr } from './serialize';

const parse = (code: string) => parseEr(splitDocument(code).body);
const write = (code: string) => {
  const s = serializeEr(parse(code));
  return [s.header, ...s.body].join('\n');
};

describe('ER parser', () => {
  it('reads relations and cardinalities', () => {
    const m = parse(ER_CORPUS[0]);
    expect(m.relations).toEqual([
      { from: 'CUSTOMER', to: 'ORDER', fromCard: 'exactly-one', toCard: 'zero-many', identifying: true, label: 'places' },
      { from: 'ORDER', to: 'LINE-ITEM', fromCard: 'exactly-one', toCard: 'one-many', identifying: true, label: 'contains' },
      { from: 'CUSTOMER', to: 'DELIVERY-ADDRESS', fromCard: 'one-many', toCard: 'one-many', identifying: false, label: 'uses' },
    ]);
  });

  it('reads attributes, keys, comments and word cardinalities', () => {
    const m = parse(ER_CORPUS[1]);
    const person = m.entities.find((e) => e.id === 'PERSON')!;
    expect(person.attributes[0]).toEqual({ type: 'string', name: 'driversLicense', keys: ['PK'], comment: 'The license #' });
    expect(person.attributes[1]).toMatchObject({ type: 'string(99)', name: 'firstName' });
    expect(m.entities.find((e) => e.id === 'NAMED-DRIVER')!.attributes[0].keys).toEqual(['PK', 'FK']);
    expect(m.relations.at(-1)).toMatchObject({ from: 'MANUFACTURER', to: 'CAR', fromCard: 'exactly-one', toCard: 'zero-many' });
  });

  it('reads aliases, direction and styles', () => {
    const m = parse(ER_CORPUS[2]);
    expect(m.direction).toBe('LR');
    expect(m.entities.map((e) => [e.id, e.alias])).toEqual([
      ['p', 'Person'],
      ['a', 'Customer Account'],
      ['LONELY', null],
    ]);
    expect(m.relations[0].label).toBe('has an account');
    const s = parse(ER_CORPUS[3]);
    expect(s.entities.find((e) => e.id === 'CUSTOMER')!.cssClasses).toEqual(['hot']);
    expect(s.entities.find((e) => e.id === 'INVOICE')!.style).toBe('fill:#9cf');
  });

  ER_CORPUS.forEach((code, i) => {
    it(`sample #${i} round-trips to a stable form`, () => {
      const once = write(code);
      expect(write(once)).toBe(once);
      expect(parse(once).relations).toEqual(parse(code).relations);
    });
  });
});
