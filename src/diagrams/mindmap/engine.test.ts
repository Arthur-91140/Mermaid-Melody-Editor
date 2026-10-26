// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb } from '../testing/mermaidDb';
import { MINDMAP_CORPUS } from './corpus';
import { mindDisplayText, type MindNode, type MindShape } from './model';
import { parseMindmap } from './parse';
import { serializeMindmap } from './serialize';

const TYPE: Record<MindShape, number> = { default: 0, rounded: 1, square: 2, circle: 3, cloud: 4, bang: 5, hexagon: 6 };

interface EngineNode { nodeId: string; descr: string; type: number; icon?: string; class?: string; children: EngineNode[] }

const engineTree = (n: EngineNode): unknown => ({
  nodeId: n.nodeId,
  descr: n.descr,
  type: n.type,
  icon: n.icon ?? null,
  cls: n.class ?? null,
  children: n.children.map(engineTree),
});

const myTree = (n: MindNode): unknown => ({
  descr: mindDisplayText(n).replace(/\n/g, '<br>'),
  type: TYPE[n.shape],
  icon: n.icon,
  cls: n.cssClass,
  children: n.children.map(myTree),
});

const withoutIds = (t: any): unknown => ({ ...t, nodeId: undefined, children: t.children.map(withoutIds) });

describe('mindmap parser agrees with the Mermaid engine', () => {
  MINDMAP_CORPUS.forEach((code, i) => {
    it(`sample #${i}: model matches Mermaid's reading`, async () => {
      const m = parseMindmap(splitDocument(code).body);
      const db = await mermaidDb(code);
      const expected = withoutIds(engineTree(db.getMindmap()));
      expect(JSON.parse(JSON.stringify(myTree(m.root!)))).toEqual(JSON.parse(JSON.stringify(expected)));
    });

    it(`sample #${i}: regenerated code means the same thing to Mermaid`, async () => {
      const d = splitDocument(code);
      const s = serializeMindmap(parseMindmap(d.body));
      const regenerated = [...d.preamble, s.header, ...s.body].join('\n');
      const a = engineTree((await mermaidDb(regenerated)).getMindmap());
      const b = engineTree((await mermaidDb(code)).getMindmap());
      expect(a).toEqual(b);
    });
  });
});
