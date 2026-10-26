import { CornerDownRight, ListPlus } from 'lucide-react';
import { mindDisplayText, type MindModel } from '../diagrams/mindmap/model';
import { addChild, addSibling, deleteMind, findMind, keyAfterReparse, moveMind, setMindText } from '../diagrams/mindmap/ops';
import type { Translate } from '../i18n';
import { cleanId, tag, type PreviewEdit, type PreviewEditing } from './types';

function created(model: MindModel, key: string): PreviewEdit<MindModel> {
  const k = keyAfterReparse(model, key);
  return { model, select: [k], edit: k };
}

function child(m: MindModel, selection: string[], t: Translate): PreviewEdit<MindModel> | null {
  const target = selection[0] ?? m.root?.key;
  if (!target) return null;
  const res = addChild(m, target, t('mind.newIdea'));
  return created(res.model, res.key);
}

function sibling(m: MindModel, selection: string[], t: Translate): PreviewEdit<MindModel> | null {
  if (!selection[0]) return child(m, selection, t);
  const res = addSibling(m, selection[0], t('mind.newIdea'));
  return created(res.model, res.key);
}

export const mindPreview: PreviewEditing<MindModel> = {
  annotate(svg, m) {
    let count = 0;
    const walk = (n: MindModel['root']) => {
      if (!n) return;
      count++;
      n.children.forEach(walk);
    };
    walk(m.root);
    svg.querySelectorAll('g.node').forEach((g) => {
      const n = /^node_(\d+)$/.exec(cleanId(g.id))?.[1];
      if (n !== undefined && Number(n) < count) tag(g, `m${n}`);
    });
    svg.querySelectorAll('path[data-id^="edge_"]').forEach((p) => {
      const m2 = /^edge_(\d+)_(\d+)$/.exec(p.getAttribute('data-id') ?? '');
      if (m2) p.setAttribute('data-mme-link', `ml:${m2[1]}:${m2[2]}`);
    });
  },

  structure(m) {
    const edges: { id: string; from: string; to: string }[] = [];
    let i = 0;
    const index = new Map<string, number>();
    const walk = (n: MindModel['root']) => {
      if (!n) return;
      index.set(n.key, i++);
      n.children.forEach(walk);
    };
    walk(m.root);
    const link = (n: MindModel['root']) => {
      if (!n) return;
      for (const c of n.children) {
        edges.push({ id: `ml:${index.get(n.key)}:${index.get(c.key)}`, from: `m${index.get(n.key)}`, to: `m${index.get(c.key)}` });
        link(c);
      }
    };
    link(m.root);
    return { edges, clusters: [] };
  },

  textOf: (m, key) => {
    const n = findMind(m.root, key)?.node;
    return n ? mindDisplayText(n) : null;
  },

  commitText: (m, key, text) => (text.trim() ? { model: setMindText(m, key, text) } : null),

  remove: (m, ids) => deleteMind(m, ids),

  /** Dragging an idea onto another one moves it there. */
  connect(m, from, to) {
    const next = moveMind(m, from, to);
    return next === m ? null : { model: next };
  },

  addActions: (t) => [
    { id: 'child', title: `${t('mind.addChild')} (Tab)`, icon: <CornerDownRight size={16} />, run: (m, sel) => child(m, sel, t) },
    { id: 'sibling', title: `${t('mind.addSibling')} (↵)`, icon: <ListPlus size={16} />, run: (m, sel) => sibling(m, sel, t) },
  ],

  onKey(e, m, selection, t) {
    if (selection.length !== 1) return null;
    if (e.key === 'Tab') return child(m, selection, t);
    if (e.key === 'Enter') return sibling(m, selection, t);
    return null;
  },
};
