import { Box, StickyNote } from 'lucide-react';
import { classIds } from '../canvas/class/ids';
import type { ClassModel } from '../diagrams/class/model';
import {
  addClass,
  addRelation,
  CLASS_ID_RE,
  classTaken,
  deleteClassItems,
  renameClass,
  renameNamespace,
  updateClass,
  updateRelation,
} from '../diagrams/class/ops';
import { renameLayoutId } from '../store/documents';
import { cleanId, tag, type PreviewEditing } from './types';

export const classPreview: PreviewEditing<ClassModel> = {
  annotate(svg, m) {
    svg.querySelectorAll('g.node').forEach((g) => {
      const id = cleanId(g.id);
      const cls = /^classId-(.+)-\d+$/.exec(id)?.[1];
      if (cls && m.classes.some((c) => c.id === cls)) tag(g, classIds.cls(cls));
      const note = /^note(\d+)$/.exec(id)?.[1];
      if (note !== undefined) tag(g, classIds.note(Number(note)));
    });
    svg.querySelectorAll('g.cluster').forEach((g) => {
      const id = cleanId(g.id);
      if (m.namespaces.includes(id)) tag(g, classIds.ns(id));
    });
    const relIndex = new Map<string, number>();
    let i = 0;
    svg.querySelectorAll('path.relation').forEach((p) => {
      const dataId = p.getAttribute('data-id') ?? '';
      if (!dataId.startsWith('id_') || i >= m.relations.length) return;
      relIndex.set(dataId, i);
      tag(p, classIds.rel(i++));
    });
    svg.querySelectorAll('g.edgeLabel').forEach((g) => {
      const dataId = g.querySelector('[data-id]')?.getAttribute('data-id');
      const k = dataId ? relIndex.get(dataId) : undefined;
      if (k !== undefined) tag(g, classIds.rel(k));
    });
  },

  textOf(m, cid) {
    const p = classIds.parse(cid);
    if (p.kind === 'class') {
      const c = m.classes.find((x) => x.id === p.id);
      return c ? (c.label ?? c.id) : null;
    }
    if (p.kind === 'note') return m.notes[Number(p.id)]?.text.replace(/\\n/g, '\n') ?? null;
    if (p.kind === 'relation') return m.relations[Number(p.id)]?.label ?? '';
    if (p.kind === 'namespace') return p.id;
    return null;
  },

  commitText(m, cid, text, layout) {
    const p = classIds.parse(cid);
    const value = text.trim();
    if (p.kind === 'class') {
      const c = m.classes.find((x) => x.id === p.id);
      if (!c || !value) return null;
      if (CLASS_ID_RE.test(value) && !classTaken(m, value)) {
        return {
          model: updateClass(renameClass(m, p.id, value), value, { label: null }),
          layout: renameLayoutId(layout, p.id, value),
          select: [classIds.cls(value)],
        };
      }
      return value === c.id ? null : { model: updateClass(m, p.id, { label: value }) };
    }
    if (p.kind === 'note') {
      const i = Number(p.id);
      return { model: { ...m, notes: m.notes.map((n, k) => (k === i ? { ...n, text: text.replace(/\n/g, '\\n').replace(/"/g, "'") } : n)) } };
    }
    if (p.kind === 'relation') return { model: updateRelation(m, Number(p.id), { label: value || null }) };
    if (p.kind === 'namespace' && /^[\w.]+$/.test(value)) {
      return { model: renameNamespace(m, p.id, value), layout: renameLayoutId(layout, `ns:${p.id}`, `ns:${value}`), select: [classIds.ns(value)] };
    }
    return null;
  },

  remove(m, ids) {
    const parsed = ids.map(classIds.parse);
    return deleteClassItems(
      m,
      parsed.filter((p) => p.kind === 'class').map((p) => p.id),
      parsed.filter((p) => p.kind === 'relation').map((p) => Number(p.id)),
      parsed.filter((p) => p.kind === 'note').map((p) => Number(p.id)),
      parsed.filter((p) => p.kind === 'namespace').map((p) => p.id),
    );
  },

  connect(m, from, to) {
    const a = classIds.parse(from);
    const b = classIds.parse(to);
    if (a.kind === 'class' && b.kind === 'class') return { model: addRelation(m, a.id, b.id), select: [classIds.rel(m.relations.length)] };
    if (a.kind === 'note' && b.kind === 'class') {
      return { model: { ...m, notes: m.notes.map((n, i) => (i === Number(a.id) ? { ...n, target: b.id } : n)) } };
    }
    return null;
  },

  addActions: (t) => [
    {
      id: 'class',
      title: t('class.addClass'),
      icon: <Box size={16} />,
      run(m, selection) {
        const anchor = selection.map(classIds.parse).find((p) => p.kind === 'class');
        const res = addClass(m, t('class.newClass'), anchor ? (m.classes.find((c) => c.id === anchor.id)?.namespace ?? null) : null);
        const model = anchor ? addRelation(res.model, anchor.id, res.id) : res.model;
        return { model, select: [classIds.cls(res.id)], edit: classIds.cls(res.id) };
      },
    },
    {
      id: 'note',
      title: t('class.addNote'),
      icon: <StickyNote size={16} />,
      run(m, selection) {
        const target = selection.map(classIds.parse).find((p) => p.kind === 'class')?.id ?? null;
        const i = m.notes.length;
        return { model: { ...m, notes: [...m.notes, { target, text: t('class.note') }] }, select: [classIds.note(i)], edit: classIds.note(i) };
      },
    },
  ],
};
