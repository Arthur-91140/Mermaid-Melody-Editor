import { splitStatements } from '../common';
import { emptyClass, type ClassMarker, type ClassModel, type ClassNode } from './model';

const ID = '[A-Za-z0-9_$.]+?';
const LEFT: Record<string, ClassMarker> = { '<|': 'inheritance', '*': 'composition', o: 'aggregation', '<': 'arrow' };
const RIGHT: Record<string, ClassMarker> = { '|>': 'inheritance', '*': 'composition', o: 'aggregation', '>': 'arrow' };

const RELATION_RE = new RegExp(
  `^(${ID})(~[^~]+~)?\\s*(?:"([^"]*)"\\s*)?(<\\||\\*|o|<)?(--|\\.\\.)(\\|>|\\*|o|>)?\\s*(?:"([^"]*)"\\s*)?(${ID.slice(0, -1)})(~[^~]+~)?\\s*(?::\\s*(.*))?$`,
);
const CLASS_RE = /^class\s+([A-Za-z0-9_$.]+)(?:~([^~]+)~)?(?:\s*\["(.*)"\])?(?::::([\w-]+))?\s*(?:(\{)\s*(.*?)\s*(\})?)?$/;

export function parseClass(keyword: string, body: string[]): ClassModel {
  const model: ClassModel = {
    kind: 'class',
    keyword,
    direction: null,
    classes: [],
    relations: [],
    notes: [],
    namespaces: [],
    classDefs: [],
    extras: [],
  };
  const byId = new Map<string, ClassNode>();
  const ensure = (id: string): ClassNode => {
    let c = byId.get(id);
    if (!c) {
      c = emptyClass(id);
      byId.set(id, c);
      model.classes.push(c);
    }
    return c;
  };
  const styleStmts: { id: string; style: string }[] = [];
  const cssStmts: { ids: string[]; cls: string }[] = [];

  let openClass: ClassNode | null = null;
  let namespace: string | null = null;

  for (const { text: t } of splitStatements(body, false)) {
    let m: RegExpExecArray | null;
    if (openClass) {
      if (t === '}') {
        openClass = null;
      } else if ((m = /^<<(.+)>>$/.exec(t))) {
        openClass.annotations.push(m[1].trim());
      } else {
        openClass.members.push(t);
      }
      continue;
    }
    if (t.startsWith('%%')) {
      model.extras.push(t);
      continue;
    }
    if ((m = /^namespace\s+([\w.$-]+)\s*\{?$/.exec(t))) {
      namespace = m[1];
      if (!model.namespaces.includes(namespace)) model.namespaces.push(namespace);
      continue;
    }
    if (t === '}' && namespace) {
      namespace = null;
      continue;
    }
    if ((m = /^direction\s+(\S+)$/.exec(t))) {
      model.direction = m[1];
      continue;
    }
    if ((m = CLASS_RE.exec(t))) {
      const c = ensure(m[1]);
      c.declared = true;
      if (m[2]) c.generic = m[2];
      if (m[3] !== undefined) c.label = m[3];
      if (m[4] && !c.cssClasses.includes(m[4])) c.cssClasses.push(m[4]);
      if (namespace) c.namespace = namespace;
      if (m[5]) {
        const inline = m[6];
        if (inline) c.members.push(...inline.split(/\s*;\s*/).filter(Boolean));
        if (!m[7]) openClass = c;
      }
      continue;
    }
    if ((m = /^<<(.+)>>\s+([A-Za-z0-9_$.]+)$/.exec(t))) {
      ensure(m[2]).annotations.push(m[1].trim());
      continue;
    }
    if ((m = /^note\s+for\s+([A-Za-z0-9_$.]+)\s+"([\s\S]*)"$/.exec(t))) {
      model.notes.push({ target: m[1], text: m[2] });
      continue;
    }
    if ((m = /^note\s+"([\s\S]*)"$/.exec(t))) {
      model.notes.push({ target: null, text: m[1] });
      continue;
    }
    if ((m = /^classDef\s+(\S+)\s+([\s\S]*)$/.exec(t))) {
      model.classDefs.push({ names: m[1], style: m[2].trim() });
      continue;
    }
    if ((m = /^cssClass\s+"([^"]*)"\s+([\w-]+)$/.exec(t))) {
      cssStmts.push({ ids: m[1].split(',').map((x) => x.trim()).filter(Boolean), cls: m[2] });
      continue;
    }
    if ((m = /^style\s+(\S+)\s+([\s\S]*)$/.exec(t))) {
      styleStmts.push({ id: m[1], style: m[2].trim() });
      continue;
    }
    if (/^(click|link|callback|accTitle|accDescr)\b/.test(t)) {
      model.extras.push(t);
      continue;
    }
    if ((m = RELATION_RE.exec(t))) {
      const from = ensure(m[1]);
      const to = ensure(m[8]);
      if (m[2] && !from.generic) from.generic = m[2].slice(1, -1);
      if (m[9] && !to.generic) to.generic = m[9].slice(1, -1);
      model.relations.push({
        from: from.id,
        to: to.id,
        fromMarker: m[4] ? LEFT[m[4]] : 'none',
        toMarker: m[6] ? RIGHT[m[6]] : 'none',
        line: m[5] === '..' ? 'dashed' : 'solid',
        fromCard: m[3] ?? null,
        toCard: m[7] ?? null,
        label: m[10]?.trim() || null,
      });
      continue;
    }
    if ((m = /^([A-Za-z0-9_$.]+)\s*:\s*(.+)$/.exec(t))) {
      ensure(m[1]).members.push(m[2].trim());
      continue;
    }
    model.extras.push(t);
  }

  for (const s of styleStmts) {
    const c = byId.get(s.id);
    if (c) c.style = c.style ? `${c.style},${s.style}` : s.style;
    else model.extras.push(`style ${s.id} ${s.style}`);
  }
  for (const s of cssStmts) {
    const unknown = s.ids.filter((id) => !byId.has(id));
    for (const id of s.ids) {
      const c = byId.get(id);
      if (c && !c.cssClasses.includes(s.cls)) c.cssClasses.push(s.cls);
    }
    if (unknown.length) model.extras.push(`cssClass "${unknown.join(',')}" ${s.cls}`);
  }
  return model;
}
