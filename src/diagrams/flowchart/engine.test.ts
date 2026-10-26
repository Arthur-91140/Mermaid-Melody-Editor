// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isMarkdownLabel, splitDocument } from '../common';
import { mermaidDb, sortBy } from '../testing/mermaidDb';
import { FLOWCHART_CORPUS } from './corpus';
import type { FlowEdge, FlowModel } from './model';
import { parseFlowchart } from './parse';
import { serializeFlowchart } from './serialize';
import { normalizeShape } from './shapes';

const TYPE_TO_SHAPE: Record<string, string> = {
  square: 'rect',
  round: 'rounded',
  stadium: 'stadium',
  subroutine: 'fr-rect',
  cylinder: 'cyl',
  circle: 'circle',
  odd: 'odd',
  diamond: 'diam',
  hexagon: 'hex',
  lean_right: 'lean-r',
  lean_left: 'lean-l',
  trapezoid: 'trap-b',
  inv_trapezoid: 'trap-t',
  doublecircle: 'dbl-circ',
};

function edgeType(e: FlowEdge): string {
  const base = { arrow: 'point', circle: 'circle', cross: 'cross', none: 'open' }[e.head];
  if (e.head !== 'none' && e.tail === e.head) return `double_arrow_${base}`;
  return `arrow_${base}`;
}

const STROKE = { solid: 'normal', dotted: 'dotted', thick: 'thick', invisible: 'invisible' };

function parse(code: string): FlowModel {
  const d = splitDocument(code);
  return parseFlowchart(d.keyword, d.headerRest, d.body);
}

/** Engine view of a diagram, independent of declaration order and generated ids. */
async function snapshot(code: string) {
  const db = await mermaidDb(code);
  const subgraphs = db.getSubGraphs() as { id: string; title: string; nodes: string[]; dir?: string }[];
  const sgName = (id: string) => {
    const sg = subgraphs.find((s) => s.id === id);
    return sg && /^subGraph\d+$/.test(id) ? `implicit:${sg.title}` : id;
  };
  const vertices = [...db.getVertices().values()] as {
    id: string;
    type?: string;
    text: string;
    classes: string[];
    styles: string[];
  }[];
  return {
    direction: db.getDirection(),
    vertices: sortBy(vertices, (v) => v.id).map((v) => ({
      id: v.id,
      type: v.type ?? null,
      // Mermaid swaps entity markers for placeholders until rendering.
      text: v.text.replace(/ﬂ°°?/g, '#').replace(/¶ß/g, ';'),
      classes: [...v.classes].sort(),
      styles: v.styles,
    })),
    edges: (db.getEdges() as Record<string, unknown>[]).map((e) => ({
      start: e.start,
      end: e.end,
      type: e.type,
      stroke: e.stroke,
      text: e.text,
      length: e.length,
      style: e.style ?? null,
    })),
    subgraphs: sortBy(subgraphs, (s) => sgName(s.id)).map((s) => ({
      id: sgName(s.id),
      title: s.title,
      nodes: s.nodes.map(sgName).sort(),
      dir: s.dir ?? null,
    })),
    classes: [...db.getClasses().entries()].map(([k, v]: [string, { styles: string[] }]) => [k, v.styles]),
  };
}

describe('flowchart parser agrees with the Mermaid engine', () => {
  FLOWCHART_CORPUS.forEach((code, i) => {
    it(`sample #${i}: model matches Mermaid's reading`, async () => {
      const m = parse(code);
      const snap = await snapshot(code);
      // Mermaid also registers subgraph ids used as edge ends as vertices.
      const sgIds = new Set(m.subgraphs.map((sg) => sg.id));
      expect(m.nodes.map((n) => n.id).sort()).toEqual(
        snap.vertices.map((v) => v.id).filter((id) => !sgIds.has(id)),
      );
      for (const n of m.nodes) {
        const v = snap.vertices.find((x) => x.id === n.id)!;
        const engineShape = v.type ? (TYPE_TO_SHAPE[v.type] ?? normalizeShape(v.type)) : 'rect';
        expect([n.id, n.shape]).toEqual([n.id, engineShape]);
        const text = isMarkdownLabel(n.label) ? n.label!.slice(1, -1) : (n.label ?? n.id);
        expect([n.id, text]).toEqual([n.id, v.text]);
      }
      expect(
        m.edges.map((e) => ({ start: e.from, end: e.to, type: edgeType(e), stroke: STROKE[e.line], text: e.label ?? '', length: e.length })),
      ).toEqual(snap.edges.map(({ style: _s, ...rest }) => rest));
      for (const sg of snap.subgraphs) {
        if (sg.id.startsWith('implicit:')) continue;
        const members = [
          ...m.nodes.filter((n) => n.parent === sg.id).map((n) => n.id),
          ...m.subgraphs.filter((s) => s.parent === sg.id).map((s) => s.id),
        ].sort();
        expect([sg.id, members]).toEqual([sg.id, sg.nodes]);
      }
    });

    it(`sample #${i}: regenerated code means the same thing to Mermaid`, async () => {
      const d = splitDocument(code);
      const s = serializeFlowchart(parse(code));
      const regenerated = [...d.preamble, s.header, ...s.body].join('\n');
      expect(await snapshot(regenerated)).toEqual(await snapshot(code));
    });
  });
});
