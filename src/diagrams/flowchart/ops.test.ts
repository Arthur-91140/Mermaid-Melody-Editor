// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb } from '../testing/mermaidDb';
import { parseFlowchart } from './parse';
import {
  addEdge,
  addNode,
  deleteItems,
  duplicateNodes,
  groupItems,
  nextNodeId,
  renameId,
  reparent,
  reverseEdge,
  setShape,
} from './ops';
import { serializeFlowchart } from './serialize';

const parse = (code: string) => {
  const d = splitDocument(code);
  return parseFlowchart(d.keyword, d.headerRest, d.body);
};
const write = (m: ReturnType<typeof parse>) => {
  const s = serializeFlowchart(m);
  return [s.header, ...s.body].join('\n');
};

describe('flowchart editing operations', () => {
  it('generates free ids', () => {
    expect(nextNodeId(parse('flowchart LR\n  A --> B\n  C'))).toBe('D');
  });

  it('adds nodes with any shape and links them', async () => {
    let m = parse('flowchart LR\n  A[Start]');
    const r = addNode(m, { shape: 'doc', label: 'Report (v2)' });
    m = addEdge(setShape(r.model, 'A', 'stadium'), 'A', r.id, { label: 'writes' });
    const code = write(m);
    expect(code).toContain('A([Start])');
    expect(code).toContain('B@{ shape: doc, label: "Report (v2)" }');
    const db = await mermaidDb(code);
    expect(db.getEdges()).toHaveLength(1);
  });

  it('renames ids everywhere', () => {
    const m = renameId(parse('flowchart LR\n  subgraph S\n    A\n  end\n  A --> B\n  style A fill:#f00'), 'A', 'Start');
    expect(m.nodes.map((n) => n.id)).toEqual(['Start', 'B']);
    expect(m.edges[0].from).toBe('Start');
    expect(renameId(m, 'Start', 'B')).toBe(m);
  });

  it('deletes nodes with their links and ungroups deleted subgraphs', () => {
    const m = parse('flowchart LR\n  subgraph Outer\n    subgraph Inner\n      A\n    end\n  end\n  A --> B\n  B --> C');
    const res = deleteItems(m, ['C'], ['Inner'], []);
    expect(res.subgraphs.map((s) => s.id)).toEqual(['Outer']);
    expect(res.nodes.find((n) => n.id === 'A')!.parent).toBe('Outer');
    expect(res.edges).toHaveLength(1);
  });

  it('groups, reparents without cycles, duplicates and reverses', async () => {
    let m = parse('flowchart TD\n  A --> B\n  B --> C');
    const g = groupItems(m, ['A', 'B'], 'Group');
    m = g.model;
    expect(m.nodes.filter((n) => n.parent === g.id).map((n) => n.id)).toEqual(['A', 'B']);
    const inner = groupItems(m, ['A'], 'Inner');
    m = reparent(inner.model, [g.id], inner.id);
    expect(m.subgraphs.find((s) => s.id === g.id)!.parent).toBe(null);
    const dup = duplicateNodes(m, ['B', 'C']);
    expect(dup.model.edges).toHaveLength(3);
    m = reverseEdge(dup.model, 0);
    expect(m.edges[0]).toMatchObject({ from: 'B', to: 'A' });
    const db = await mermaidDb(write(m));
    expect(db.getSubGraphs()).toHaveLength(2);
  });
});
