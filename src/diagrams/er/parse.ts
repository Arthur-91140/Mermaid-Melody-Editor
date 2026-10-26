import { splitStatements, unquote } from '../common';
import { emptyEntity, type ErCard, type ErEntity, type ErModel } from './model';

const CARD_TOKENS: Record<string, ErCard> = {
  '|o': 'zero-one',
  'o|': 'zero-one',
  'one or zero': 'zero-one',
  'zero or one': 'zero-one',
  '||': 'exactly-one',
  'only one': 'exactly-one',
  '1': 'exactly-one',
  '}o': 'zero-many',
  'o{': 'zero-many',
  'zero or more': 'zero-many',
  'zero or many': 'zero-many',
  'many(0)': 'zero-many',
  '0+': 'zero-many',
  '}|': 'one-many',
  '|{': 'one-many',
  'one or more': 'one-many',
  'one or many': 'one-many',
  'many(1)': 'one-many',
  '1+': 'one-many',
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CARD_ALT = Object.keys(CARD_TOKENS)
  .sort((a, b) => b.length - a.length)
  .map(escapeRe)
  .join('|');
const NAME = '"[^"]+"|[\\p{L}\\p{N}_\\-]+';

const RELATION_RE = new RegExp(
  `^(${NAME})\\s*(${CARD_ALT})\\s*(--|\\.\\.|optionally to|to)\\s*(${CARD_ALT})\\s*(${NAME})\\s*:\\s*(.*)$`,
  'u',
);
const ENTITY_RE = new RegExp(
  `^(${NAME})(?:\\s*\\[\\s*(.*?)\\s*\\])?(?::::([\\w-]+))?\\s*(\\{)?\\s*(\\})?$`,
  'u',
);
const ATTRIBUTE_RE = /^(\S+)\s+(\S+)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]*)")?$/;

export function parseEr(body: string[]): ErModel {
  const model: ErModel = { kind: 'er', direction: null, entities: [], relations: [], classDefs: [], extras: [] };
  const byId = new Map<string, ErEntity>();
  const ensure = (raw: string): ErEntity => {
    const id = unquote(raw);
    let e = byId.get(id);
    if (!e) {
      e = emptyEntity(id);
      byId.set(id, e);
      model.entities.push(e);
    }
    return e;
  };
  const classStmts: { ids: string[]; cls: string }[] = [];
  const styleStmts: { id: string; style: string }[] = [];
  let open: ErEntity | null = null;

  for (const { text: t } of splitStatements(body, false)) {
    let m: RegExpExecArray | null;
    if (open) {
      if (t === '}') open = null;
      else if ((m = ATTRIBUTE_RE.exec(t))) {
        open.attributes.push({
          type: m[1],
          name: m[2],
          keys: m[3] ? m[3].split(',').map((k) => k.trim()) : [],
          comment: m[4] ?? null,
        });
      } else model.extras.push(t);
      continue;
    }
    if (t.startsWith('%%') || /^(title|accTitle|accDescr)\b/.test(t)) {
      model.extras.push(t);
      continue;
    }
    if ((m = /^direction\s+(\S+)$/.exec(t))) {
      model.direction = m[1];
      continue;
    }
    if ((m = /^classDef\s+(\S+)\s+([\s\S]*)$/.exec(t))) {
      model.classDefs.push({ names: m[1], style: m[2].trim() });
      continue;
    }
    if ((m = /^class\s+(\S+)\s+([\w-]+)$/.exec(t))) {
      classStmts.push({ ids: m[1].split(',').filter(Boolean), cls: m[2] });
      continue;
    }
    if ((m = /^style\s+(\S+)\s+([\s\S]*)$/.exec(t))) {
      styleStmts.push({ id: m[1], style: m[2].trim() });
      continue;
    }
    if ((m = RELATION_RE.exec(t))) {
      const from = ensure(m[1]);
      const to = ensure(m[5]);
      model.relations.push({
        from: from.id,
        to: to.id,
        fromCard: CARD_TOKENS[m[2]],
        toCard: CARD_TOKENS[m[4]],
        identifying: m[3] === '--' || m[3] === 'to',
        label: unquote(m[6]),
      });
      continue;
    }
    if ((m = ENTITY_RE.exec(t))) {
      const e = ensure(m[1]);
      if (m[2] !== undefined) e.alias = unquote(m[2]);
      if (m[3] && !e.cssClasses.includes(m[3])) e.cssClasses.push(m[3]);
      if (m[4] && !m[5]) open = e;
      continue;
    }
    model.extras.push(t);
  }

  for (const s of classStmts) {
    for (const id of s.ids) {
      const e = byId.get(id);
      if (e && !e.cssClasses.includes(s.cls)) e.cssClasses.push(s.cls);
    }
    const unknown = s.ids.filter((id) => !byId.has(id));
    if (unknown.length) model.extras.push(`class ${unknown.join(',')} ${s.cls}`);
  }
  for (const s of styleStmts) {
    const e = byId.get(s.id);
    if (e) e.style = e.style ? `${e.style},${s.style}` : s.style;
    else model.extras.push(`style ${s.id} ${s.style}`);
  }
  return model;
}
