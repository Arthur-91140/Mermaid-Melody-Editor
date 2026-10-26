import { splitStatements } from '../common';
import { emptyState, endId, startId, type StateModel, type StateNode } from './model';

const ID = '[\\p{L}\\p{N}_$.\\-]+';
const REF = `\\[\\*\\]|${ID}`;
// The source is lazy so that `A-->B` splits on the arrow.
const TRANSITION_RE = new RegExp(
  `^(\\[\\*\\]|${ID}?)(?::::([\\w-]+))?\\s*-->\\s*(${REF})(?::::([\\w-]+))?\\s*(?::\\s*(.*))?$`,
  'u',
);
const STATE_RE = new RegExp(
  `^state\\s+(?:"([^"]*)"\\s+as\\s+)?(${ID})(?:\\s+as\\s+"([^"]*)")?(?::::([\\w-]+))?\\s*(<<(choice|fork|join)>>)?\\s*(\\{)?$`,
  'u',
);
const DESCRIPTION_RE = new RegExp(`^(${ID})\\s*:\\s*(.*)$`, 'u');

export function parseState(keyword: string, body: string[]): StateModel {
  const model: StateModel = {
    kind: 'state',
    keyword,
    direction: null,
    states: [],
    transitions: [],
    notes: [],
    classDefs: [],
    extras: [],
    readOnlyReason: null,
  };
  const byId = new Map<string, StateNode>();
  const stack: string[] = [];
  const scope = () => (stack.length ? stack[stack.length - 1] : null);

  const ensure = (id: string): StateNode => {
    let s = byId.get(id);
    if (!s) {
      s = emptyState(id, scope());
      byId.set(id, s);
      model.states.push(s);
    }
    return s;
  };
  const pseudo = (kind: 'start' | 'end'): StateNode => {
    const sc = scope();
    const id = kind === 'start' ? startId(sc) : endId(sc);
    const s = ensure(id);
    s.kind = kind;
    return s;
  };
  const addCss = (s: StateNode, cls: string | undefined) => {
    if (cls && !s.cssClasses.includes(cls)) s.cssClasses.push(cls);
  };

  const classStmts: { ids: string[]; cls: string }[] = [];
  const styleStmts: { id: string; style: string }[] = [];
  let note: { target: string; position: 'left of' | 'right of'; lines: string[]; scope: string | null } | null = null;

  for (const { text: t } of splitStatements(body, false)) {
    let m: RegExpExecArray | null;
    if (note) {
      if (/^end\s+note$/i.test(t)) {
        model.notes.push({ target: note.target, position: note.position, text: note.lines.join('\n'), scope: note.scope });
        note = null;
      } else note.lines.push(t);
      continue;
    }
    if (t.startsWith('%%') || /^(hide empty description|scale\s|title\b|accTitle|accDescr)/.test(t)) {
      model.extras.push(t);
      continue;
    }
    if (t === '--') {
      model.readOnlyReason = 'concurrency';
      continue;
    }
    if (t === '}') {
      stack.pop();
      continue;
    }
    if ((m = /^direction\s+(\S+)$/.exec(t))) {
      const sc = scope();
      if (sc) ensure(sc).direction = m[1];
      else model.direction = m[1];
      continue;
    }
    if ((m = /^note\s+(left of|right of)\s+([^:]+?)\s*(?::\s*(.*))?$/i.exec(t))) {
      const target = m[2].trim();
      ensure(target);
      const position = m[1].toLowerCase() as 'left of' | 'right of';
      if (m[3] !== undefined) model.notes.push({ target, position, text: m[3], scope: scope() });
      else note = { target, position, lines: [], scope: scope() };
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
    if ((m = STATE_RE.exec(t))) {
      const s = ensure(m[2]);
      const label = m[1] ?? m[3];
      if (label !== undefined) s.label = label;
      addCss(s, m[4]);
      if (m[6]) s.kind = m[6] as 'choice' | 'fork' | 'join';
      if (m[7]) {
        s.composite = true;
        stack.push(s.id);
      }
      continue;
    }
    if ((m = TRANSITION_RE.exec(t))) {
      const from = m[1] === '[*]' ? pseudo('start') : ensure(m[1]);
      const to = m[3] === '[*]' ? pseudo('end') : ensure(m[3]);
      addCss(from, m[2]);
      addCss(to, m[4]);
      model.transitions.push({ from: from.id, to: to.id, label: m[5]?.trim() || null, scope: scope() });
      continue;
    }
    if ((m = DESCRIPTION_RE.exec(t)) && !t.includes(':::')) {
      ensure(m[1]).descriptions.push(m[2].trim());
      continue;
    }
    if ((m = new RegExp(`^(${ID})$`, 'u').exec(t))) {
      ensure(m[1]);
      continue;
    }
    model.extras.push(t);
  }

  for (const s of classStmts) {
    for (const id of s.ids) {
      const st = byId.get(id);
      if (st) addCss(st, s.cls);
    }
    const unknown = s.ids.filter((id) => !byId.has(id));
    if (unknown.length) model.extras.push(`class ${unknown.join(',')} ${s.cls}`);
  }
  for (const s of styleStmts) {
    const st = byId.get(s.id);
    if (st) st.style = st.style ? `${st.style},${s.style}` : s.style;
    else model.extras.push(`style ${s.id} ${s.style}`);
  }
  return model;
}
