import { emptyClass, type ClassMarker, type ClassModel, type ClassNode, type ClassRelation } from './model';

export const CLASS_ID_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function classTaken(m: ClassModel, id: string): boolean {
  return m.classes.some((c) => c.id === id) || m.namespaces.includes(id);
}

export function nextClassName(m: ClassModel, base: string): string {
  const clean = base.replace(/[^A-Za-z0-9_]/g, '') || 'Class';
  if (!classTaken(m, clean)) return clean;
  let n = 2;
  while (classTaken(m, `${clean}${n}`)) n++;
  return `${clean}${n}`;
}

export function addClass(m: ClassModel, name: string, namespace: string | null = null): { model: ClassModel; id: string } {
  const id = nextClassName(m, name);
  const c: ClassNode = { ...emptyClass(id), declared: true, namespace };
  return { model: { ...m, classes: [...m.classes, c] }, id };
}

export function updateClass(m: ClassModel, id: string, patch: Partial<ClassNode>): ClassModel {
  return { ...m, classes: m.classes.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

export function renameClass(m: ClassModel, from: string, to: string): ClassModel {
  if (from === to || classTaken(m, to)) return m;
  const r = (id: string) => (id === from ? to : id);
  return {
    ...m,
    classes: m.classes.map((c) => (c.id === from ? { ...c, id: to } : c)),
    relations: m.relations.map((rel) => ({ ...rel, from: r(rel.from), to: r(rel.to) })),
    notes: m.notes.map((n) => (n.target === from ? { ...n, target: to } : n)),
  };
}

export type RelationPreset =
  | 'association'
  | 'inheritance'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'realization'
  | 'link'
  | 'dashed';

export const RELATION_PRESETS: Record<RelationPreset, { marker: ClassMarker; line: 'solid' | 'dashed' }> = {
  association: { marker: 'arrow', line: 'solid' },
  inheritance: { marker: 'inheritance', line: 'solid' },
  composition: { marker: 'composition', line: 'solid' },
  aggregation: { marker: 'aggregation', line: 'solid' },
  dependency: { marker: 'arrow', line: 'dashed' },
  realization: { marker: 'inheritance', line: 'dashed' },
  link: { marker: 'none', line: 'solid' },
  dashed: { marker: 'none', line: 'dashed' },
};

/** Preset matching a relation whose marker sits on a single end, or null for custom combinations. */
export function relationPreset(r: ClassRelation): RelationPreset | null {
  if (r.fromMarker !== 'none' && r.toMarker !== 'none') return null;
  const marker = r.toMarker !== 'none' ? r.toMarker : r.fromMarker;
  for (const [name, p] of Object.entries(RELATION_PRESETS) as [RelationPreset, (typeof RELATION_PRESETS)[RelationPreset]][]) {
    if (p.marker === marker && p.line === r.line) return name;
  }
  return null;
}

/** Applies a preset, keeping the marker on the end that already had one (the target by default). */
export function applyPreset(r: ClassRelation, preset: RelationPreset): ClassRelation {
  const p = RELATION_PRESETS[preset];
  const onFrom = r.fromMarker !== 'none' && r.toMarker === 'none';
  return { ...r, line: p.line, fromMarker: onFrom ? p.marker : 'none', toMarker: onFrom ? 'none' : p.marker };
}

export function addRelation(m: ClassModel, from: string, to: string, preset: RelationPreset = 'association'): ClassModel {
  const base: ClassRelation = {
    from,
    to,
    fromMarker: 'none',
    toMarker: 'none',
    line: 'solid',
    fromCard: null,
    toCard: null,
    label: null,
  };
  return { ...m, relations: [...m.relations, applyPreset(base, preset)] };
}

export function updateRelation(m: ClassModel, index: number, patch: Partial<ClassRelation>): ClassModel {
  return { ...m, relations: m.relations.map((r, i) => (i === index ? { ...r, ...patch } : r)) };
}

export function reverseRelation(m: ClassModel, index: number): ClassModel {
  const r = m.relations[index];
  if (!r) return m;
  return updateRelation(m, index, {
    from: r.to,
    to: r.from,
    fromMarker: r.toMarker,
    toMarker: r.fromMarker,
    fromCard: r.toCard,
    toCard: r.fromCard,
  });
}

export function deleteClassItems(m: ClassModel, classIds: string[], relationIdx: number[], noteIdx: number[], namespaces: string[] = []): ClassModel {
  const cls = new Set(classIds);
  const rels = new Set(relationIdx);
  const notes = new Set(noteIdx);
  const ns = new Set(namespaces);
  return {
    ...m,
    classes: m.classes
      .filter((c) => !cls.has(c.id))
      .map((c) => (c.namespace && ns.has(c.namespace) ? { ...c, namespace: null } : c)),
    relations: m.relations.filter((r, i) => !rels.has(i) && !cls.has(r.from) && !cls.has(r.to)),
    notes: m.notes.filter((n, i) => !notes.has(i) && !(n.target && cls.has(n.target))),
    namespaces: m.namespaces.filter((x) => !ns.has(x)),
  };
}

export function setNamespace(m: ClassModel, ids: string[], namespace: string | null): ClassModel {
  const set = new Set(ids);
  return { ...m, classes: m.classes.map((c) => (set.has(c.id) ? { ...c, namespace } : c)) };
}

export function addNamespace(m: ClassModel, base: string, members: string[] = []): { model: ClassModel; name: string } {
  let name = base.replace(/[^A-Za-z0-9_.]/g, '') || 'Namespace';
  let n = 2;
  while (m.namespaces.includes(name) || m.classes.some((c) => c.id === name)) name = `${base}${n++}`;
  return { model: setNamespace({ ...m, namespaces: [...m.namespaces, name] }, members, name), name };
}

export function renameNamespace(m: ClassModel, from: string, to: string): ClassModel {
  if (!to || from === to || m.namespaces.includes(to) || m.classes.some((c) => c.id === to)) return m;
  return {
    ...m,
    namespaces: m.namespaces.map((x) => (x === from ? to : x)),
    classes: m.classes.map((c) => (c.namespace === from ? { ...c, namespace: to } : c)),
  };
}

export function duplicateClasses(m: ClassModel, ids: string[]): { model: ClassModel; mapping: Map<string, string> } {
  let model = m;
  const mapping = new Map<string, string>();
  for (const id of ids) {
    const src = m.classes.find((c) => c.id === id);
    if (!src) continue;
    const res = addClass(model, src.id, src.namespace);
    model = updateClass(res.model, res.id, {
      label: src.label,
      generic: src.generic,
      annotations: [...src.annotations],
      members: [...src.members],
      cssClasses: [...src.cssClasses],
      style: src.style,
    });
    mapping.set(id, res.id);
  }
  return { model, mapping };
}

/** Mermaid-like display of a member line: generics as <T>, method return types after a colon. */
export function formatMember(raw: string): { text: string; isStatic: boolean; isAbstract: boolean } {
  let s = raw.trim();
  let isStatic = false;
  let isAbstract = false;
  if (s.endsWith('$')) {
    isStatic = true;
    s = s.slice(0, -1);
  } else if (s.endsWith('*')) {
    isAbstract = true;
    s = s.slice(0, -1);
  }
  const close = s.lastIndexOf(')');
  if (close !== -1) {
    let rest = s.slice(close + 1).trim();
    // Classifiers may sit right after the parenthesis (`count()$ int`) or at the end.
    for (const flag of ['$', '*']) {
      if (rest.startsWith(flag) || rest.endsWith(flag)) {
        if (flag === '$') isStatic = true;
        else isAbstract = true;
        rest = (rest.startsWith(flag) ? rest.slice(1) : rest.slice(0, -1)).trim();
      }
    }
    const head = s.slice(0, close + 1);
    s = rest ? `${head} : ${rest}` : head;
  }
  return { text: s.replace(/~([^~]*)~/g, '<$1>'), isStatic, isAbstract };
}
