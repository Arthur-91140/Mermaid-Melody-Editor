import { INDENT } from '../common';
import { MIND_DELIMS, type MindModel, type MindNode } from './model';

export function mindNodeText(n: MindNode): string {
  if (n.shape === 'default') return n.text;
  const [open, close] = MIND_DELIMS[n.shape];
  return `${n.nodeId ?? ''}${open}${n.text}${close}`;
}

export function serializeMindmap(m: MindModel): { header: string; body: string[] } {
  const body: string[] = m.extras.map((e) => INDENT + e);
  const write = (n: MindNode, depth: number) => {
    const pad = INDENT.repeat(depth + 1);
    body.push(pad + mindNodeText(n));
    if (n.icon) body.push(pad + INDENT + `::icon(${n.icon})`);
    if (n.cssClass) body.push(pad + INDENT + `:::${n.cssClass}`);
    n.children.forEach((c) => write(c, depth + 1));
  };
  if (m.root) write(m.root, 0);
  return { header: 'mindmap', body };
}
