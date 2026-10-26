import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { parseFlowchart } from './parse';
import { setStyle } from '../style';
import { updateNode } from './ops';
import { serializeFlowchart } from './serialize';

function parse(code: string) {
  const d = splitDocument(code);
  return parseFlowchart(d.keyword, d.headerRest, d.body);
}

function roundTrip(code: string) {
  const m1 = parse(code);
  const s = serializeFlowchart(m1);
  const code2 = [s.header, ...s.body].join('\n');
  const m2 = parse(code2);
  const s2 = serializeFlowchart(m2);
  const code3 = [s2.header, ...s2.body].join('\n');
  return { m1, m2, code2, code3 };
}

describe('flowchart parser', () => {
  it('reads direction, shapes and labels', () => {
    const m = parse(`flowchart LR
    A[Start] --> B(Rounded)
    B --> C{Decision?}
    C -->|Yes| D([Stadium])
    C -- No --> E[(Database)]
    F((Circle)) & G>Flag] --> H{{Hex}}
    I[/lean right/] --- J[\\lean left\\]
    K[/trap b\\] -.-> L[\\trap t/]
    M[[sub]] ==> N(((double)))`);
    expect(m.direction).toBe('LR');
    const shape = (id: string) => m.nodes.find((n) => n.id === id)!.shape;
    expect(shape('A')).toBe('rect');
    expect(shape('B')).toBe('rounded');
    expect(shape('C')).toBe('diam');
    expect(shape('D')).toBe('stadium');
    expect(shape('E')).toBe('cyl');
    expect(shape('F')).toBe('circle');
    expect(shape('G')).toBe('odd');
    expect(shape('H')).toBe('hex');
    expect(shape('I')).toBe('lean-r');
    expect(shape('J')).toBe('lean-l');
    expect(shape('K')).toBe('trap-b');
    expect(shape('L')).toBe('trap-t');
    expect(shape('M')).toBe('fr-rect');
    expect(shape('N')).toBe('dbl-circ');
    expect(m.nodes.find((n) => n.id === 'C')!.label).toBe('Decision?');
    expect(m.edges).toHaveLength(9);
    expect(m.edges[2]).toMatchObject({ from: 'C', to: 'D', label: 'Yes', head: 'arrow' });
    expect(m.edges[3]).toMatchObject({ from: 'C', to: 'E', label: 'No', line: 'solid' });
    expect(m.edges.filter((e) => e.to === 'H').map((e) => e.from)).toEqual(['F', 'G']);
    expect(m.edges[6]).toMatchObject({ from: 'I', to: 'J', head: 'none' });
    expect(m.edges[7]).toMatchObject({ line: 'dotted', head: 'arrow' });
    expect(m.edges[8]).toMatchObject({ line: 'thick', head: 'arrow' });
  });

  it('reads link variants', () => {
    const m = parse(`graph TD
    A --o B
    A --x C
    A <--> D
    A x--x E
    A ---> F
    A -.- G
    A ~~~ H
    A == thick label ==> I
    A -. dotted label .-> J
    A -->|"quoted | pipe"| K`);
    expect(m.edges.map((e) => [e.tail, e.line, e.head, e.length, e.label])).toEqual([
      ['none', 'solid', 'circle', 1, null],
      ['none', 'solid', 'cross', 1, null],
      ['arrow', 'solid', 'arrow', 1, null],
      ['cross', 'solid', 'cross', 1, null],
      ['none', 'solid', 'arrow', 2, null],
      ['none', 'dotted', 'none', 1, null],
      ['none', 'invisible', 'none', 1, null],
      ['none', 'thick', 'arrow', 1, 'thick label'],
      ['none', 'dotted', 'arrow', 1, 'dotted label'],
      ['none', 'solid', 'arrow', 1, 'quoted | pipe'],
    ]);
  });

  it('handles subgraphs, nesting and membership', () => {
    const m = parse(`flowchart TB
    c1-->a2
    subgraph one
    a1-->a2
    end
    subgraph two [Second group]
    direction LR
    b1-->b2
    subgraph inner
      b3
    end
    end
    subgraph "Implicit title"
      z
    end
    one --> two`);
    expect(m.subgraphs.map((s) => [s.id, s.title, s.parent])).toEqual([
      ['one', null, null],
      ['two', 'Second group', null],
      ['inner', null, 'two'],
      ['__subgraph0', 'Implicit title', null],
    ]);
    expect(m.subgraphs[1].direction).toBe('LR');
    const parent = (id: string) => m.nodes.find((n) => n.id === id)!.parent;
    expect(parent('c1')).toBe(null);
    expect(parent('a1')).toBe('one');
    expect(parent('a2')).toBe('one');
    expect(parent('b1')).toBe('two');
    expect(parent('b3')).toBe('inner');
    expect(parent('z')).toBe('__subgraph0');
    expect(m.nodes.find((n) => n.id === 'one')).toBeUndefined();
    expect(m.edges.at(-1)).toMatchObject({ from: 'one', to: 'two' });
  });

  it('reads styling statements', () => {
    const m = parse(`flowchart LR
    A:::hot --> B
    classDef hot fill:#f96,stroke:#333
    class B cold
    style A stroke-width:4px
    linkStyle 0 stroke:red
    click B "https://example.com" "tip"
    %% a comment`);
    const a = m.nodes.find((n) => n.id === 'A')!;
    expect(a.classes).toEqual(['hot']);
    expect(a.style).toBe('stroke-width:4px');
    expect(m.nodes.find((n) => n.id === 'B')!.classes).toEqual(['cold']);
    expect(m.edges[0].style).toBe('stroke:red');
    expect(m.classDefs).toEqual([{ names: 'hot', style: 'fill:#f96,stroke:#333' }]);
    expect(m.nodes.find((n) => n.id === 'B')!.click).toBe('"https://example.com" "tip"');
    expect(m.extras).toEqual(['%% a comment']);
  });

  it('writes a single-line node as a white-space style that reads back', () => {
    const m = parse('flowchart TD\n    A["Responsable opérationnel - Salle de jeux"] --> B');
    const a = m.nodes.find((n) => n.id === 'A')!;
    const s = serializeFlowchart(updateNode(m, 'A', { style: setStyle(a.style, 'white-space', 'nowrap') }));
    const code = [s.header, ...s.body].join('\n');
    expect(code).toContain('style A white-space:nowrap');
    expect(parse(code).nodes.find((n) => n.id === 'A')!.style).toBe('white-space:nowrap');
  });

  it('reads the @{ } shape syntax and inline header statements', () => {
    const m = parse(`graph TD; A@{ shape: doc, label: "My doc" } --> B@{ shape: diamond }; B-->C`);
    expect(m.direction).toBe('TD');
    expect(m.nodes[0]).toMatchObject({ id: 'A', shape: 'doc', label: 'My doc', syntax: 'at' });
    expect(m.nodes[1]).toMatchObject({ id: 'B', shape: 'diam', shapeName: 'diamond' });
    expect(m.edges).toHaveLength(2);
  });

  it('keeps unknown statements as extras', () => {
    const m = parse(`flowchart LR
    A --> B
    this is not valid ->`);
    expect(m.extras).toEqual(['this is not valid ->']);
  });

  it('round-trips without losing information', () => {
    const src = `---
title: Demo
---
flowchart LR
    %% comment
    A[Hello world] -->|go| B(("Circle (big)"))
    B -.-> C{Choice}
    C ==>|yes| D[(DB)]
    C --o E@{ shape: doc, label: "Report" }
    subgraph S1 [Group one]
        direction TB
        D
        subgraph S2
            F
        end
    end
    E --- F
    classDef warm fill:#fc9
    class A,F warm
    style B fill:#9cf
    linkStyle 1 stroke:#f00
    click A "https://mermaid.js.org"`;
    const { m1, m2, code2, code3 } = roundTrip(src);
    const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
    expect({ ...m2, nodes: [...m2.nodes].sort(byId) }).toEqual({ ...m1, nodes: [...m1.nodes].sort(byId) });
    expect(code3).toBe(code2);
    expect(code2).toContain('A[Hello world]');
    expect(code2).toContain('subgraph S1 [Group one]');
  });
});
