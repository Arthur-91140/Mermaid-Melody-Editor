import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { STATE_CORPUS } from './corpus';
import { parseState } from './parse';
import { serializeState } from './serialize';

const parse = (code: string) => {
  const d = splitDocument(code);
  return parseState(d.keyword, d.body);
};
const write = (code: string) => {
  const s = serializeState(parse(code));
  return [s.header, ...s.body].join('\n');
};

describe('state parser', () => {
  it('maps [*] to start and end pseudo-states per scope', () => {
    const m = parse(STATE_CORPUS[0]);
    expect(m.transitions[0]).toEqual({ from: 'root_start', to: 'Still', label: null, scope: null });
    expect(m.transitions[1]).toMatchObject({ from: 'Still', to: 'root_end' });
    const c = parse(STATE_CORPUS[2]);
    expect(c.transitions.find((t) => t.to === 'second')).toMatchObject({ from: 'First_start', scope: 'First' });
    expect(c.states.find((s) => s.id === 'First_start')!.parent).toBe('First');
  });

  it('reads descriptions, labels and pseudo kinds', () => {
    const m = parse(STATE_CORPUS[1]);
    const get = (id: string) => m.states.find((s) => s.id === id)!;
    expect(get('s2').label).toBe('This is a state description');
    expect(get('s1').descriptions).toEqual(['This is a state description', 'with two lines']);
    expect(get('fork_state').kind).toBe('fork');
    expect(get('join_state').kind).toBe('join');
    expect(get('if_state').kind).toBe('choice');
    expect(m.transitions.find((t) => t.to === 'False')!.label).toBe('if n < 0');
  });

  it('reads composites, nesting and directions', () => {
    const m = parse(STATE_CORPUS[2]);
    const get = (id: string) => m.states.find((s) => s.id === id)!;
    expect(get('LC')).toMatchObject({ composite: true, label: 'Labelled composite', direction: 'LR', parent: null });
    expect(get('Inner')).toMatchObject({ composite: true, parent: 'LC' });
    expect(get('a').parent).toBe('Inner');
    expect(get('NamedComposite').descriptions).toEqual(['Another Composite']);
  });

  it('reads notes and classes', () => {
    const m = parse(STATE_CORPUS[3]);
    expect(m.notes).toEqual([
      { target: 'State1', position: 'right of', text: 'Important information! You can write\nnotes.', scope: null },
      { target: 'State2', position: 'left of', text: 'This is the note to the left.', scope: null },
    ]);
    expect(m.states.find((s) => s.id === 'State2')!.cssClasses).toEqual(['badBadEvent']);
    expect(m.states.find((s) => s.id === 'State1')!.cssClasses).toEqual(['badBadEvent']);
  });

  it('flags concurrency as read-only', () => {
    const m = parse(`stateDiagram-v2
    state Active {
        [*] --> A
        --
        [*] --> B
    }`);
    expect(m.readOnlyReason).toBe('concurrency');
  });

  STATE_CORPUS.forEach((code, i) => {
    it(`sample #${i} round-trips to a stable form`, () => {
      const once = write(code);
      expect(write(once)).toBe(once);
      const key = (t: { from: string; to: string; label: string | null }) => `${t.from}|${t.to}|${t.label}`;
      const sorted = (ts: Parameters<typeof key>[0][]) => ts.map(key).sort();
      expect(sorted(parse(once).transitions)).toEqual(sorted(parse(code).transitions));
    });
  });
});
