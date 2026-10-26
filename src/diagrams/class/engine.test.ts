// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb, sortBy } from '../testing/mermaidDb';
import { CLASS_CORPUS } from './corpus';
import type { ClassMarker } from './model';
import { parseClass } from './parse';
import { serializeClass } from './serialize';

const MARKER_TYPE: Record<ClassMarker, number | 'none'> = {
  none: 'none', aggregation: 0, inheritance: 1, composition: 2, arrow: 3,
};

/** Style entries coming from `classDef` lines: Mermaid inlines them or not depending on statement order. */
function classDefStyles(code: string): Set<string> {
  const out = new Set<string>();
  for (const m of code.matchAll(/^\s*classDef\s+\S+\s+(.*)$/gm)) {
    for (const part of m[1].split(',')) out.add(part.trim());
  }
  return out;
}

async function snapshot(code: string) {
  const db = await mermaidDb(code);
  const fromDefs = classDefStyles(code);
  const classes = [...db.getClasses().values()] as Record<string, any>[];
  return {
    direction: db.getDirection(),
    classes: sortBy(classes, (c) => c.id).map((c) => ({
      id: c.id,
      label: c.label,
      type: c.type,
      annotations: c.annotations,
      members: c.members.map((x: any) => x.getDisplayDetails?.().displayText ?? x.text),
      methods: c.methods.map((x: any) => x.getDisplayDetails?.().displayText ?? x.text),
      css: c.cssClasses,
      styles: (c.styles as string[]).filter((x) => !fromDefs.has(x.trim())),
      parent: c.parent ?? null,
    })),
    relations: (db.getRelations() as Record<string, any>[]).map((r) => [
      r.id1, r.id2, r.relation.type1, r.relation.type2, r.relation.lineType, r.relationTitle1, r.relationTitle2, r.title ?? null,
    ]),
    notes: [...(db.getNotes()?.values?.() ?? [])].map((n: any) => [n.class ?? null, n.text]),
  };
}

describe('class parser agrees with the Mermaid engine', () => {
  CLASS_CORPUS.forEach((code, i) => {
    it(`sample #${i}: model matches Mermaid's reading`, async () => {
      const d = splitDocument(code);
      const m = parseClass(d.keyword, d.body);
      const snap = await snapshot(code);
      expect(m.classes.map((c) => c.id).sort()).toEqual(snap.classes.map((c) => c.id));
      for (const c of m.classes) {
        const e = snap.classes.find((x) => x.id === c.id)!;
        expect([c.id, c.generic ?? '', c.annotations, c.namespace]).toEqual([c.id, e.type, e.annotations, e.parent]);
        expect([c.id, c.members.length]).toEqual([c.id, e.members.length + e.methods.length]);
      }
      expect(
        m.relations.map((r) => [r.from, r.to, MARKER_TYPE[r.fromMarker], MARKER_TYPE[r.toMarker], r.line === 'dashed' ? 1 : 0, r.fromCard ?? 'none', r.toCard ?? 'none']),
      ).toEqual(snap.relations.map((r) => r.slice(0, 7)));
    });

    it(`sample #${i}: regenerated code means the same thing to Mermaid`, async () => {
      const d = splitDocument(code);
      const s = serializeClass(parseClass(d.keyword, d.body));
      const regenerated = [...d.preamble, s.header, ...s.body].join('\n');
      expect(await snapshot(regenerated)).toEqual(await snapshot(code));
    });
  });
});
