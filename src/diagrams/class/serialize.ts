import { INDENT, indent } from '../common';
import { LEFT_MARKER, RIGHT_MARKER, type ClassModel, type ClassNode, type ClassRelation } from './model';

function classBlock(c: ClassNode): string[] {
  let head = `class ${c.id}`;
  if (c.generic) head += `~${c.generic}~`;
  if (c.label !== null) head += `["${c.label.replace(/"/g, '#quot;')}"]`;
  const inner = [...c.annotations.map((a) => `<<${a}>>`), ...c.members];
  if (!inner.length) return [head];
  return [`${head} {`, ...inner.map((l) => INDENT + l), '}'];
}

function relationLine(r: ClassRelation): string {
  const op = LEFT_MARKER[r.fromMarker] + (r.line === 'dashed' ? '..' : '--') + RIGHT_MARKER[r.toMarker];
  const fromCard = r.fromCard !== null ? ` "${r.fromCard}"` : '';
  const toCard = r.toCard !== null ? `"${r.toCard}" ` : '';
  const label = r.label ? ` : ${r.label}` : '';
  return `${r.from}${fromCard} ${op} ${toCard}${r.to}${label}`;
}

function needsDeclaration(c: ClassNode, referenced: Set<string>): boolean {
  return (
    c.declared ||
    c.label !== null ||
    c.generic !== null ||
    c.members.length > 0 ||
    c.annotations.length > 0 ||
    c.namespace !== null ||
    !referenced.has(c.id)
  );
}

export function serializeClass(m: ClassModel): { header: string; body: string[] } {
  const body: string[] = [];
  if (m.direction) body.push(`direction ${m.direction}`);
  body.push(...m.extras);

  const referenced = new Set(m.relations.flatMap((r) => [r.from, r.to]));
  for (const c of m.classes) {
    if (c.namespace === null && needsDeclaration(c, referenced)) body.push(...classBlock(c));
  }
  for (const ns of m.namespaces) {
    const members = m.classes.filter((c) => c.namespace === ns);
    body.push(`namespace ${ns} {`, ...indent(members.flatMap(classBlock)), '}');
  }
  for (const r of m.relations) body.push(relationLine(r));
  for (const n of m.notes) {
    body.push(n.target ? `note for ${n.target} "${n.text}"` : `note "${n.text}"`);
  }

  const byCss = new Map<string, string[]>();
  for (const c of m.classes) {
    for (const cls of c.cssClasses) {
      if (!byCss.has(cls)) byCss.set(cls, []);
      byCss.get(cls)!.push(c.id);
    }
  }
  for (const [cls, ids] of byCss) body.push(`cssClass "${ids.join(',')}" ${cls}`);
  // After the assignments, so that Mermaid applies the definitions to every class using them.
  for (const cd of m.classDefs) body.push(`classDef ${cd.names} ${cd.style}`);
  for (const c of m.classes) if (c.style) body.push(`style ${c.id} ${c.style}`);

  return { header: m.keyword, body: indent(body) };
}
