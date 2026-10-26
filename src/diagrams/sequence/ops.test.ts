// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb } from '../testing/mermaidDb';
import {
  addBranch,
  addParticipant,
  blockStructure,
  columnsUsed,
  deleteItems,
  deleteParticipants,
  hasAutonumber,
  insertItem,
  moveItem,
  moveParticipant,
  renameParticipant,
  toggleAutonumber,
  wrapItems,
} from './ops';
import { parseSequence } from './parse';
import { serializeSequence } from './serialize';

const parse = (code: string) => parseSequence(splitDocument(code).body);
const write = (m: ReturnType<typeof parse>) => {
  const s = serializeSequence(m);
  return [s.header, ...s.body].join('\n');
};

describe('sequence editing operations', () => {
  it('builds a valid diagram with participants, messages and blocks', async () => {
    let m = parse('sequenceDiagram');
    const a = addParticipant(m, 'actor', 'User');
    const b = addParticipant(a.model, 'participant', 'Server');
    m = insertItem(b.model, { t: 'message', from: a.id, to: b.id, arrow: '->>', text: 'Hello', activate: '+' });
    m = insertItem(m, { t: 'message', from: b.id, to: a.id, arrow: '-->>', text: 'Hi', activate: '-' });
    m = wrapItems(m, 0, 1, 'alt', 'ok');
    m = addBranch(m, 0, 'ko');
    m = insertItem(m, { t: 'note', position: 'over', actors: [a.id, b.id], text: 'done' });
    m = toggleAutonumber(m, true);
    expect(hasAutonumber(m)).toBe(true);
    const code = write(m);
    expect(code).toContain('alt ok');
    expect(code).toContain('else ko');
    const db = await mermaidDb(code);
    expect(db.getActorKeys()).toEqual(['User1', 'Server1']);
    expect(db.getMessages().filter((x: { type: number }) => x.type === 12)).toHaveLength(1);
  });

  it('keeps blocks well nested when moving and deleting', () => {
    const m = parse('sequenceDiagram\n  A->>B: 1\n  loop L\n    A->>B: 2\n  end\n  A->>B: 3');
    expect(blockStructure(m.items)!.get(1)).toMatchObject({ start: 1, end: 3 });
    expect(moveItem(m, 3, 0)).toBe(m);
    const moved = moveItem(m, 4, 2);
    expect(moved.items.map((i) => i.t)).toEqual(['message', 'block', 'message', 'message', 'end']);
    expect(deleteItems(m, [3]).items.map((i) => i.t)).toEqual(['message', 'message', 'message']);
    expect(columnsUsed(m, 1, 3)).toEqual([0, 1]);
  });

  it('renames, reorders and deletes participants', () => {
    let m = parse('sequenceDiagram\n  A->>B: hi\n  Note over A,B: n\n  B->>C: x');
    m = renameParticipant(m, 'A', 'Alice');
    expect(m.items[0]).toMatchObject({ from: 'Alice' });
    m = moveParticipant(m, 'C', 0);
    expect(m.participants.map((p) => p.id)).toEqual(['C', 'Alice', 'B']);
    m = deleteParticipants(m, ['B']);
    expect(m.items).toEqual([{ t: 'note', position: 'over', actors: ['Alice'], text: 'n' }]);
    expect(write(m)).toContain('participant C');
  });
});
