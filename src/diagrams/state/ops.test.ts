// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb } from '../testing/mermaidDb';
import {
  addNote,
  addState,
  addTransition,
  deleteStateItems,
  moveStates,
  renameState,
  setStateTitle,
  updateState,
} from './ops';
import { parseState } from './parse';
import { serializeState } from './serialize';

const parse = (code: string) => {
  const d = splitDocument(code);
  return parseState(d.keyword, d.body);
};
const write = (m: ReturnType<typeof parse>) => {
  const s = serializeState(m);
  return [s.header, ...s.body].join('\n');
};

describe('state diagram editing operations', () => {
  it('builds a valid diagram with a composite, pseudo-states, a choice and a note', async () => {
    let m = parse('stateDiagram-v2');
    let r = addState(m, 'start', null);
    m = r.model;
    const start = r.id;
    r = addState(m, 'state', null, 'Idle');
    m = r.model;
    const idle = r.id;
    r = addState(m, 'state', null, 'Busy');
    m = updateState(r.model, r.id, { composite: true });
    const busy = r.id;
    r = addState(m, 'start', busy);
    m = r.model;
    const innerStart = r.id;
    r = addState(m, 'state', busy, 'Work');
    m = r.model;
    const work = r.id;
    r = addState(m, 'choice', null);
    m = r.model;
    const choice = r.id;
    m = addTransition(m, start, idle);
    m = addTransition(m, idle, busy, 'go');
    m = addTransition(m, innerStart, work);
    m = addTransition(m, busy, choice);
    m = addNote(m, idle, 'waiting');
    expect(addState(m, 'start', null).id).toBe(start);
    const code = write(m);
    expect(code).toContain('state Busy1 {');
    const data = (await mermaidDb(code)).getData();
    expect(data.nodes.find((n: { id: string }) => n.id === 'Work1').parentId).toBe('Busy1');
    expect(data.nodes.find((n: { id: string }) => n.id === 'choice1').shape).toBe('choice');
  });

  it('refuses transitions into a start or out of an end', () => {
    const m = parse('stateDiagram-v2\n  [*] --> A\n  A --> [*]');
    expect(addTransition(m, 'A', 'root_start')).toBe(m);
    expect(addTransition(m, 'root_end', 'A')).toBe(m);
  });

  it('renames composites with their pseudo-states', () => {
    const m = renameState(parse('stateDiagram-v2\n  state C {\n    [*] --> x\n  }\n  C --> D'), 'C', 'Comp');
    expect(m.states.map((s) => [s.id, s.parent])).toEqual([
      ['Comp', null],
      ['Comp_start', 'Comp'],
      ['x', 'Comp'],
      ['D', null],
    ]);
    expect(m.transitions[0]).toMatchObject({ from: 'Comp_start', scope: 'Comp' });
  });

  it('deletes a composite and lifts its content', () => {
    const m = deleteStateItems(parse('stateDiagram-v2\n  state C {\n    [*] --> x\n    x --> y\n  }'), ['C'], [], []);
    expect(m.states.map((s) => [s.id, s.parent])).toEqual([
      ['x', null],
      ['y', null],
    ]);
    expect(m.transitions).toEqual([{ from: 'x', to: 'y', label: null, scope: null }]);
  });

  it('moves states without creating cycles and edits titles', () => {
    let m = parse('stateDiagram-v2\n  state C {\n    a\n  }\n  b\n  s1 : described');
    m = moveStates(m, ['b', 'C'], 'C');
    expect(m.states.find((s) => s.id === 'b')!.parent).toBe('C');
    expect(m.states.find((s) => s.id === 'C')!.parent).toBe(null);
    expect(setStateTitle(m, 'b', 'Renamed').id).toBe('Renamed');
    expect(setStateTitle(m, 's1', 'New text').model.states.find((s) => s.id === 's1')!.descriptions).toEqual(['New text']);
    expect(setStateTitle(m, 'a', 'Two words').model.states.find((s) => s.id === 'a')!.label).toBe('Two words');
  });
});
