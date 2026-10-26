export type MindShape = 'default' | 'rounded' | 'square' | 'circle' | 'cloud' | 'bang' | 'hexagon';

export interface MindNode {
  /** Editor-only key, unique within the tree. */
  key: string;
  /** Id written before the shape (`id1[...]`), or null. */
  nodeId: string | null;
  /** Raw text between the delimiters (may keep quotes / backticks). */
  text: string;
  shape: MindShape;
  icon: string | null;
  cssClass: string | null;
  children: MindNode[];
}

export interface MindModel {
  kind: 'mindmap';
  root: MindNode | null;
  extras: string[];
}

export const MIND_DELIMS: Record<Exclude<MindShape, 'default'>, [string, string]> = {
  circle: ['((', '))'],
  bang: ['))', '(('],
  hexagon: ['{{', '}}'],
  rounded: ['(', ')'],
  cloud: [')', '('],
  square: ['[', ']'],
};

export const MIND_SHAPES: MindShape[] = ['default', 'rounded', 'square', 'circle', 'cloud', 'bang', 'hexagon'];

export function walkMind(node: MindNode | null, fn: (n: MindNode, parent: MindNode | null, depth: number) => void) {
  const visit = (n: MindNode, parent: MindNode | null, depth: number) => {
    fn(n, parent, depth);
    n.children.forEach((c) => visit(c, n, depth + 1));
  };
  if (node) visit(node, null, 0);
}

/** Text as Mermaid displays it: quotes and markdown backticks removed. */
export function mindDisplayText(n: MindNode): string {
  let t = n.text;
  if (n.shape !== 'default' && t.length >= 2 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  if (n.shape !== 'default' && t.length >= 2 && t.startsWith('`') && t.endsWith('`')) t = t.slice(1, -1);
  return t.replace(/<br\s*\/?>/gi, '\n');
}
