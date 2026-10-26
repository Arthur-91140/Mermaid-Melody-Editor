import { emptyEntity, type ErAttribute, type ErEntity, type ErModel, type ErRelation } from './model';

export const ENTITY_ID_RE = /^[\p{L}\p{N}_-]+$/u;

export const entityTaken = (m: ErModel, id: string) => m.entities.some((e) => e.id === id);

export function nextEntityName(m: ErModel, base: string): string {
  const clean = base.replace(/[^\p{L}\p{N}_-]/gu, '') || 'ENTITY';
  if (!entityTaken(m, clean)) return clean;
  let n = 2;
  while (entityTaken(m, `${clean}${n}`)) n++;
  return `${clean}${n}`;
}

export function addEntity(m: ErModel, base: string, attributes: ErAttribute[] = []): { model: ErModel; id: string } {
  const id = nextEntityName(m, base);
  return { model: { ...m, entities: [...m.entities, { ...emptyEntity(id), attributes }] }, id };
}

export function updateEntity(m: ErModel, id: string, patch: Partial<ErEntity>): ErModel {
  return { ...m, entities: m.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

export function renameEntity(m: ErModel, from: string, to: string): ErModel {
  if (from === to || entityTaken(m, to)) return m;
  const r = (id: string) => (id === from ? to : id);
  return {
    ...m,
    entities: m.entities.map((e) => (e.id === from ? { ...e, id: to } : e)),
    relations: m.relations.map((rel) => ({ ...rel, from: r(rel.from), to: r(rel.to) })),
  };
}

export function addErRelation(m: ErModel, from: string, to: string, label: string): ErModel {
  const rel: ErRelation = { from, to, fromCard: 'exactly-one', toCard: 'zero-many', identifying: true, label };
  return { ...m, relations: [...m.relations, rel] };
}

export function updateErRelation(m: ErModel, index: number, patch: Partial<ErRelation>): ErModel {
  return { ...m, relations: m.relations.map((r, i) => (i === index ? { ...r, ...patch } : r)) };
}

export function reverseErRelation(m: ErModel, index: number): ErModel {
  const r = m.relations[index];
  if (!r) return m;
  return updateErRelation(m, index, { from: r.to, to: r.from, fromCard: r.toCard, toCard: r.fromCard });
}

export function deleteErItems(m: ErModel, entityIds: string[], relationIdx: number[]): ErModel {
  const ents = new Set(entityIds);
  const rels = new Set(relationIdx);
  return {
    ...m,
    entities: m.entities.filter((e) => !ents.has(e.id)),
    relations: m.relations.filter((r, i) => !rels.has(i) && !ents.has(r.from) && !ents.has(r.to)),
  };
}

export function duplicateEntities(m: ErModel, ids: string[]): { model: ErModel; mapping: Map<string, string> } {
  let model = m;
  const mapping = new Map<string, string>();
  for (const id of ids) {
    const src = m.entities.find((e) => e.id === id);
    if (!src) continue;
    const res = addEntity(model, src.id, src.attributes.map((a) => ({ ...a, keys: [...a.keys] })));
    model = updateEntity(res.model, res.id, { alias: src.alias, cssClasses: [...src.cssClasses], style: src.style });
    mapping.set(id, res.id);
  }
  return { model, mapping };
}
