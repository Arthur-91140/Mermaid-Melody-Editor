import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { SEQUENCE_CORPUS } from './corpus';
import { parseSequence } from './parse';
import { serializeSequence } from './serialize';

const parse = (code: string) => parseSequence(splitDocument(code).body);
const write = (code: string) => {
  const s = serializeSequence(parse(code));
  return [s.header, ...s.body].join('\n');
};

describe('sequence parser', () => {
  it('reads participants, messages and notes', () => {
    const m = parse(SEQUENCE_CORPUS[2]);
    expect(m.title).toBe('Shop');
    expect(m.participants.map((p) => [p.id, p.label, p.kind, p.meta])).toEqual([
      ['U', 'User', 'actor', null],
      ['W', 'Web server', 'participant', null],
      ['D', null, 'participant', '@{ "type": "database" }'],
    ]);
    expect(m.items[0]).toEqual({ t: 'message', from: 'U', to: 'W', arrow: '->>', text: 'GET /cart', activate: '+' });
    expect(m.items.map((i) => (i.t === 'message' ? i.arrow : i.t))).toEqual([
      '->>', '->>', '-->>', '-->>', '-x', '--x', '--)', '<<->>', '<<-->>',
    ]);
  });

  it('reads blocks, branches and boxes', () => {
    const m = parse(SEQUENCE_CORPUS[3]);
    const kinds = m.items.filter((i) => i.t === 'block' || i.t === 'branch' || i.t === 'end').map((i) => ('kind' in i ? i.kind : 'end'));
    expect(kinds).toEqual([
      'alt', 'else', 'end', 'opt', 'end', 'par', 'and', 'end', 'critical', 'option', 'end', 'break', 'end', 'rect', 'end',
    ]);
    const boxes = parse(SEQUENCE_CORPUS[4]).boxes;
    expect(boxes).toEqual([
      { raw: 'Purple Alice & John', members: ['A', 'J'] },
      { raw: 'Another Group', members: ['B', 'C'] },
    ]);
  });

  it('keeps entity codes intact and creation order', () => {
    const m = parse(SEQUENCE_CORPUS[5]);
    const last = m.items.at(-1)!;
    expect(last).toMatchObject({ t: 'message', text: 'I #9829; you #59; really' });
    expect(m.participants.map((p) => [p.id, p.created])).toEqual([
      ['Alice', false],
      ['Bob', false],
      ['Carl', true],
      ['D', true],
    ]);
  });

  it('declares only what is needed', () => {
    expect(write(SEQUENCE_CORPUS[0])).toBe(`sequenceDiagram
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    Alice-)John: See you later!`);
    expect(write(SEQUENCE_CORPUS[6])).toContain('participant Zed');
  });

  SEQUENCE_CORPUS.forEach((code, i) => {
    it(`sample #${i} round-trips to a stable form`, () => {
      const once = write(code);
      expect(write(once)).toBe(once);
      expect(parse(once).items).toEqual(parse(code).items);
    });
  });
});
