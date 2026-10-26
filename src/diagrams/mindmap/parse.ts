import { MIND_DELIMS, type MindModel, type MindNode, type MindShape } from './model';

const SHAPE_ORDER: Exclude<MindShape, 'default'>[] = ['circle', 'bang', 'hexagon', 'rounded', 'cloud', 'square'];

function parseNodeText(content: string): Pick<MindNode, 'nodeId' | 'text' | 'shape'> {
  for (const shape of SHAPE_ORDER) {
    const [open, close] = MIND_DELIMS[shape];
    const at = content.search(/[()[\]{}]/);
    if (at === -1) break;
    if (!content.startsWith(open, at) || !content.endsWith(close)) continue;
    const inner = content.slice(at + open.length, content.length - close.length);
    const id = content.slice(0, at);
    return { nodeId: id || null, text: inner, shape };
  }
  return { nodeId: null, text: content, shape: 'default' };
}

export function parseMindmap(body: string[]): MindModel {
  const model: MindModel = { kind: 'mindmap', root: null, extras: [] };
  const stack: { level: number; node: MindNode }[] = [];
  let last: MindNode | null = null;
  let count = 0;

  for (const raw of body) {
    const content = raw.trim();
    if (!content) continue;
    if (content.startsWith('%%')) {
      model.extras.push(content);
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^::icon\((.*)\)$/.exec(content))) {
      if (last) last.icon = m[1].trim();
      continue;
    }
    if ((m = /^:::(.*)$/.exec(content))) {
      if (last) last.cssClass = m[1].trim();
      continue;
    }
    const level = raw.length - raw.trimStart().length;
    const node: MindNode = { key: `m${count++}`, icon: null, cssClass: null, children: [], ...parseNodeText(content) };
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack.length ? stack[stack.length - 1].node : model.root;
    if (!model.root) model.root = node;
    else (parent ?? model.root).children.push(node);
    stack.push({ level, node });
    last = node;
  }
  return model;
}
