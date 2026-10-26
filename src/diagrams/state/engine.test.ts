// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb, sortBy } from '../testing/mermaidDb';
import { STATE_CORPUS } from './corpus';
import { stateDisplay } from './model';
import { parseState } from './parse';
import { serializeState } from './serialize';

const noteId = (id: string) => id.replace(/----note-\d+$/, '----note');
const unescape = (s: unknown) =>
  s == null ? null : String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function snapshot(code: string) {
  const db = await mermaidDb(code);
  const data = db.getData();
  const nodes = data.nodes as Record<string, any>[];
  return {
    nodes: sortBy(nodes, (n) => noteId(n.id)).map((n) => ({
      id: noteId(n.id),
      label: n.label,
      shape: n.shape,
      parent: n.parentId ?? null,
      description: n.description ?? null,
      css: String(n.cssClasses ?? '').trim().split(/\s+/).sort().join(' '),
      dir: n.dir ?? null,
    })),
    edges: sortBy(
      (data.edges as Record<string, any>[]).map((e) => [noteId(e.start), noteId(e.end), unescape(e.label)].join(' | ')),
      (x) => x,
    ),
  };
}

const SHAPE: Record<string, string[]> = {
  state: ['rect', 'rectWithTitle', 'roundedWithTitle'],
  choice: ['choice'],
  fork: ['fork'],
  join: ['join'],
  start: ['stateStart'],
  end: ['stateEnd'],
};

describe('state parser agrees with the Mermaid engine', () => {
  STATE_CORPUS.forEach((code, i) => {
    it(`sample #${i}: model matches Mermaid's reading`, async () => {
      const d = splitDocument(code);
      const m = parseState(d.keyword, d.body);
      const snap = await snapshot(code);
      const engineStates = snap.nodes.filter((n) => !n.shape.startsWith('note'));
      expect(m.states.map((s) => s.id).sort((a, b) => a.localeCompare(b))).toEqual(engineStates.map((n) => n.id));
      for (const s of m.states) {
        const n = engineStates.find((x) => x.id === s.id)!;
        expect([s.id, SHAPE[s.kind].includes(n.shape)]).toEqual([s.id, true]);
        expect([s.id, s.parent]).toEqual([s.id, n.parent]);
        expect([s.id, stateDisplay(s).title]).toEqual([s.id, n.label]);
      }
      const edges = m.transitions.map((t) => [t.from, t.to, t.label ?? ''].join(' | ')).sort((a, b) => a.localeCompare(b));
      expect(edges).toEqual(snap.edges.filter((e) => !e.includes('----')));
    });

    it(`sample #${i}: regenerated code means the same thing to Mermaid`, async () => {
      const d = splitDocument(code);
      const s = serializeState(parseState(d.keyword, d.body));
      const regenerated = [...d.preamble, s.header, ...s.body].join('\n');
      expect(await snapshot(regenerated)).toEqual(await snapshot(code));
    });
  });
});
