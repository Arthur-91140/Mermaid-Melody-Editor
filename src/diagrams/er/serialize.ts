import { INDENT, indent } from '../common';
import { LEFT_CARD, RIGHT_CARD, type ErAttribute, type ErEntity, type ErModel } from './model';

const entityName = (id: string) => (/^[\p{L}\p{N}_-]+$/u.test(id) ? id : `"${id}"`);

function labelText(label: string): string {
  return /^[\p{L}\p{N}_-]+$/u.test(label) ? label : `"${label.replace(/"/g, "'")}"`;
}

function attributeLine(a: ErAttribute): string {
  let s = `${a.type} ${a.name}`;
  if (a.keys.length) s += ` ${a.keys.join(', ')}`;
  if (a.comment !== null) s += ` "${a.comment}"`;
  return s;
}

function entityBlock(e: ErEntity): string[] {
  const head = entityName(e.id) + (e.alias !== null ? `["${e.alias}"]` : '');
  if (!e.attributes.length) return [head];
  return [`${head} {`, ...e.attributes.map((a) => INDENT + attributeLine(a)), '}'];
}

export function serializeEr(m: ErModel): { header: string; body: string[] } {
  const body: string[] = [];
  if (m.direction) body.push(`direction ${m.direction}`);
  body.push(...m.extras);
  for (const r of m.relations) {
    const op = LEFT_CARD[r.fromCard] + (r.identifying ? '--' : '..') + RIGHT_CARD[r.toCard];
    body.push(`${entityName(r.from)} ${op} ${entityName(r.to)} : ${labelText(r.label)}`);
  }
  const related = new Set(m.relations.flatMap((r) => [r.from, r.to]));
  for (const e of m.entities) {
    if (e.attributes.length || e.alias !== null || !related.has(e.id)) body.push(...entityBlock(e));
  }
  const byCss = new Map<string, string[]>();
  for (const e of m.entities) {
    for (const cls of e.cssClasses) {
      if (!byCss.has(cls)) byCss.set(cls, []);
      byCss.get(cls)!.push(entityName(e.id));
    }
  }
  for (const [cls, ids] of byCss) body.push(`class ${ids.join(',')} ${cls}`);
  for (const cd of m.classDefs) body.push(`classDef ${cd.names} ${cd.style}`);
  for (const e of m.entities) if (e.style) body.push(`style ${entityName(e.id)} ${e.style}`);
  return { header: 'erDiagram', body: indent(body) };
}
