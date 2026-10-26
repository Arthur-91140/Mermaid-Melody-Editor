// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb, sortBy } from '../testing/mermaidDb';
import { ER_CORPUS } from './corpus';
import type { ErCard } from './model';
import { parseEr } from './parse';
import { serializeEr } from './serialize';

const CARD: Record<ErCard, string> = {
  'zero-one': 'ZERO_OR_ONE',
  'exactly-one': 'ONLY_ONE',
  'zero-many': 'ZERO_OR_MORE',
  'one-many': 'ONE_OR_MORE',
};

async function snapshot(code: string) {
  const db = await mermaidDb(code);
  const entries = [...db.getEntities().entries()] as [string, Record<string, any>][];
  const nameOf = new Map(entries.map(([name, e]) => [e.id, name]));
  return {
    direction: db.getDirection(),
    entities: sortBy(entries, ([name]) => name).map(([name, e]) => ({
      name,
      alias: e.alias,
      attributes: e.attributes,
      css: e.cssClasses,
      styles: e.cssStyles,
    })),
    relations: (db.getRelationships() as Record<string, any>[]).map((r) => [
      nameOf.get(r.entityA), nameOf.get(r.entityB), r.roleA, r.relSpec.cardB, r.relSpec.relType, r.relSpec.cardA,
    ]),
  };
}

describe('ER parser agrees with the Mermaid engine', () => {
  ER_CORPUS.forEach((code, i) => {
    it(`sample #${i}: model matches Mermaid's reading`, async () => {
      const m = parseEr(splitDocument(code).body);
      const snap = await snapshot(code);
      expect(m.entities.map((e) => e.id).sort((a, b) => a.localeCompare(b))).toEqual(snap.entities.map((e) => e.name));
      for (const e of m.entities) {
        const x = snap.entities.find((s) => s.name === e.id)!;
        expect([e.id, e.alias ?? '']).toEqual([e.id, x.alias]);
        expect(e.attributes.map((a) => ({ ...a, comment: a.comment ?? '' }))).toEqual(x.attributes);
      }
      expect(
        m.relations.map((r) => [r.from, r.to, r.label, CARD[r.fromCard], r.identifying ? 'IDENTIFYING' : 'NON_IDENTIFYING', CARD[r.toCard]]),
      ).toEqual(snap.relations);
    });

    it(`sample #${i}: regenerated code means the same thing to Mermaid`, async () => {
      const d = splitDocument(code);
      const s = serializeEr(parseEr(d.body));
      const regenerated = [...d.preamble, s.header, ...s.body].join('\n');
      expect(await snapshot(regenerated)).toEqual(await snapshot(code));
    });
  });
});
