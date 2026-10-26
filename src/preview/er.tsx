import { Table } from 'lucide-react';
import { erIds } from '../canvas/er/ids';
import type { ErModel } from '../diagrams/er/model';
import { addEntity, addErRelation, deleteErItems, ENTITY_ID_RE, entityTaken, renameEntity, updateEntity, updateErRelation } from '../diagrams/er/ops';
import { cleanId, renameKey, tag, type PreviewEditing } from './types';

export const erPreview: PreviewEditing<ErModel> = {
  annotate(svg, m) {
    svg.querySelectorAll('g.node').forEach((g) => {
      const name = /^entity-(.+)-\d+$/.exec(cleanId(g.id))?.[1];
      if (name && m.entities.some((e) => e.id === name)) tag(g, erIds.entity(name));
    });
    const relIndex = new Map<string, number>();
    svg.querySelectorAll('path.relationshipLine').forEach((p) => {
      const dataId = p.getAttribute('data-id') ?? '';
      const i = Number(/_(\d+)$/.exec(dataId)?.[1]);
      if (!Number.isInteger(i) || i >= m.relations.length) return;
      relIndex.set(dataId, i);
      tag(p, erIds.rel(i));
    });
    svg.querySelectorAll('g.edgeLabel').forEach((g) => {
      const dataId = g.querySelector('[data-id]')?.getAttribute('data-id');
      const i = dataId ? relIndex.get(dataId) : undefined;
      if (i !== undefined) tag(g, erIds.rel(i));
    });
  },

  textOf(m, cid) {
    const p = erIds.parse(cid);
    if (p.kind === 'relation') return m.relations[Number(p.id)]?.label ?? null;
    const e = m.entities.find((x) => x.id === p.id);
    return e ? (e.alias ?? e.id) : null;
  },

  commitText(m, cid, text, layout) {
    const p = erIds.parse(cid);
    const value = text.trim();
    if (!value) return null;
    if (p.kind === 'relation') return { model: updateErRelation(m, Number(p.id), { label: value }) };
    if (ENTITY_ID_RE.test(value) && !entityTaken(m, value)) {
      return {
        model: updateEntity(renameEntity(m, p.id, value), value, { alias: null }),
        layout: renameKey(layout, p.id, value),
        select: [erIds.entity(value)],
      };
    }
    return value === p.id ? null : { model: updateEntity(m, p.id, { alias: value.replace(/"/g, "'") }) };
  },

  remove(m, ids) {
    const parsed = ids.map(erIds.parse);
    return deleteErItems(
      m,
      parsed.filter((p) => p.kind === 'entity').map((p) => p.id),
      parsed.filter((p) => p.kind === 'relation').map((p) => Number(p.id)),
    );
  },

  connect(m, from, to, t) {
    const a = erIds.parse(from);
    const b = erIds.parse(to);
    if (a.kind !== 'entity' || b.kind !== 'entity') return null;
    return { model: addErRelation(m, a.id, b.id, t('er.newRelation')), select: [erIds.rel(m.relations.length)] };
  },

  addActions: (t) => [
    {
      id: 'entity',
      title: t('er.addEntity'),
      icon: <Table size={16} />,
      run(m, selection) {
        const anchor = selection.map(erIds.parse).find((p) => p.kind === 'entity');
        const res = addEntity(m, t('er.newEntity'), [{ type: 'int', name: 'id', keys: ['PK'], comment: null }]);
        const model = anchor ? addErRelation(res.model, anchor.id, res.id, t('er.newRelation')) : res.model;
        return { model, select: [erIds.entity(res.id)], edit: erIds.entity(res.id) };
      },
    },
  ],
};
