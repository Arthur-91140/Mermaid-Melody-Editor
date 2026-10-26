// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb } from '../testing/mermaidDb';
import { SEQUENCE_CORPUS } from './corpus';
import { parseSequence } from './parse';
import { serializeSequence } from './serialize';

const NON_SIGNAL = new Set([2, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 26, 27, 28, 29, 30, 31, 32]);
const ARROW_TYPE: Record<string, number> = {
  '->>': 0, '-->>': 1, '-x': 3, '--x': 4, '->': 5, '-->': 6, '-)': 24, '--)': 25, '<<->>': 33, '<<-->>': 34,
};

const text = (s: unknown) =>
  typeof s === 'string' ? s.replace(/ﬂ°°?/g, '#').replace(/¶ß/g, ';') : JSON.stringify(s);

async function snapshot(code: string) {
  const db = await mermaidDb(code);
  const actors = db.getActors();
  return {
    title: db.getDiagramTitle?.() ?? null,
    actors: (db.getActorKeys() as string[]).map((k) => {
      const a = actors.get(k);
      return [k, a.description, a.type, a.box?.name ?? null];
    }),
    messages: (db.getMessages() as Record<string, unknown>[]).map((m) => [
      m.from ?? null, m.to ?? null, text(m.message), m.type, m.activate ?? null, m.placement ?? null,
    ]),
    boxes: (db.getBoxes() as { name: string; fill: string; actorKeys: string[] }[]).map((b) => [b.name, b.fill, b.actorKeys]),
    created: [...db.getCreatedActors().keys()],
    destroyed: [...db.getDestroyedActors().keys()],
  };
}

describe('sequence parser agrees with the Mermaid engine', () => {
  SEQUENCE_CORPUS.forEach((code, i) => {
    it(`sample #${i}: model matches Mermaid's reading`, async () => {
      const m = parseSequence(splitDocument(code).body);
      const snap = await snapshot(code);
      expect(m.participants.map((p) => [p.id, p.label ?? p.id])).toEqual(snap.actors.map((a) => [a[0], a[1]]));
      const signals = snap.messages.filter((x) => !NON_SIGNAL.has(x[3] as number));
      const mine = m.items.flatMap((it) => (it.t === 'message' ? [it] : []));
      expect(mine.map((x) => [x.from, x.to, x.text, ARROW_TYPE[x.arrow]])).toEqual(signals.map((x) => [x[0], x[1], x[2], x[3]]));
    });

    it(`sample #${i}: regenerated code means the same thing to Mermaid`, async () => {
      const d = splitDocument(code);
      const s = serializeSequence(parseSequence(d.body));
      const regenerated = [...d.preamble, s.header, ...s.body].join('\n');
      expect(await snapshot(regenerated)).toEqual(await snapshot(code));
    });
  });
});
