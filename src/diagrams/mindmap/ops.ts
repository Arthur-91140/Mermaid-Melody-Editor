import { walkMind, type MindModel, type MindNode, type MindShape } from './model';

export function findMind(root: MindNode | null, key: string): { node: MindNode; parent: MindNode | null } | null {
  let found: { node: MindNode; parent: MindNode | null } | null = null;
  walkMind(root, (n, parent) => {
    if (!found && n.key === key) found = { node: n, parent };
  });
  return found;
}

/** Rebuilds the tree, replacing nodes through `fn` (return null to drop a node). */
function mapTree(n: MindNode, fn: (n: MindNode) => MindNode | null): MindNode | null {
  const mapped = fn(n);
  if (!mapped) return null;
  return { ...mapped, children: mapped.children.map((c) => mapTree(c, fn)).filter((c): c is MindNode => !!c) };
}

let fresh = 0;
const newKey = () => `new${Date.now().toString(36)}${fresh++}`;

/** Key the parser will give `key`'s node once the code is regenerated (depth-first order). */
export function keyAfterReparse(m: MindModel, key: string): string {
  let i = 0;
  let out = key;
  walkMind(m.root, (n) => {
    if (n.key === key) out = `m${i}`;
    i++;
  });
  return out;
}

/** Mindmap text cannot hold delimiters in a borderless node; quotes are allowed inside shapes. */
export function encodeMindText(text: string, shape: MindShape): { text: string; shape: MindShape } {
  const raw = text.replace(/\r?\n/g, '<br>').replace(/"/g, "'");
  if (/[()[\]{}]/.test(raw)) return { text: `"${raw}"`, shape: shape === 'default' ? 'square' : shape };
  return { text: raw, shape };
}

export function updateMind(m: MindModel, key: string, patch: Partial<MindNode>): MindModel {
  if (!m.root) return m;
  return { ...m, root: mapTree(m.root, (n) => (n.key === key ? { ...n, ...patch } : n)) };
}

export function setMindText(m: MindModel, key: string, display: string): MindModel {
  const target = findMind(m.root, key)?.node;
  if (!target) return m;
  const enc = encodeMindText(display, target.shape);
  return updateMind(m, key, { text: enc.text, shape: enc.shape });
}

export function addChild(m: MindModel, parentKey: string, text: string): { model: MindModel; key: string } {
  const key = newKey();
  const child: MindNode = { key, nodeId: null, text, shape: 'default', icon: null, cssClass: null, children: [] };
  if (!m.root) return { model: { ...m, root: child }, key };
  return { model: { ...m, root: mapTree(m.root, (n) => (n.key === parentKey ? { ...n, children: [...n.children, child] } : n)) }, key };
}

/** Adds a node right after `key` under the same parent (a child when `key` is the root). */
export function addSibling(m: MindModel, key: string, text: string): { model: MindModel; key: string } {
  const loc = findMind(m.root, key);
  if (!loc) return { model: m, key };
  if (!loc.parent) return addChild(m, key, text);
  const nk = newKey();
  const sib: MindNode = { key: nk, nodeId: null, text, shape: loc.node.shape === 'default' ? 'default' : loc.node.shape, icon: null, cssClass: null, children: [] };
  const parentKey = loc.parent.key;
  return {
    model: {
      ...m,
      root: mapTree(m.root!, (n) => {
        if (n.key !== parentKey) return n;
        const i = n.children.findIndex((c) => c.key === key);
        const children = [...n.children];
        children.splice(i + 1, 0, sib);
        return { ...n, children };
      }),
    },
    key: nk,
  };
}

/** Deletes nodes and their subtrees; the root is kept. */
export function deleteMind(m: MindModel, keys: string[]): MindModel {
  if (!m.root) return m;
  const set = new Set(keys.filter((k) => k !== m.root!.key));
  return { ...m, root: mapTree(m.root, (n) => (set.has(n.key) ? null : n)) };
}

function contains(n: MindNode, key: string): boolean {
  return n.key === key || n.children.some((c) => contains(c, key));
}

/** Moves a subtree under another node (refusing moves into itself). `index` defaults to the end. */
export function moveMind(m: MindModel, key: string, newParent: string, index?: number): MindModel {
  const loc = findMind(m.root, key);
  if (!m.root || !loc || !loc.parent || contains(loc.node, newParent)) return m;
  const without = mapTree(m.root, (n) => (n.key === key ? null : n))!;
  return {
    ...m,
    root: mapTree(without, (n) => {
      if (n.key !== newParent) return n;
      const children = [...n.children];
      children.splice(index ?? children.length, 0, loc.node);
      return { ...n, children };
    }),
  };
}

export function duplicateMind(m: MindModel, key: string): { model: MindModel; key: string } {
  const loc = findMind(m.root, key);
  if (!loc || !loc.parent) return { model: m, key };
  const clone = (n: MindNode): MindNode => ({ ...n, key: newKey(), children: n.children.map(clone) });
  const copy = clone(loc.node);
  const parentKey = loc.parent.key;
  return {
    model: {
      ...m,
      root: mapTree(m.root!, (n) => {
        if (n.key !== parentKey) return n;
        const i = n.children.findIndex((c) => c.key === key);
        const children = [...n.children];
        children.splice(i + 1, 0, copy);
        return { ...n, children };
      }),
    },
    key: copy.key,
  };
}
