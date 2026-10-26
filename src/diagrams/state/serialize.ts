import { INDENT, indent } from '../common';
import { isPseudo, type StateModel, type StateNode, type StateTransition } from './model';

function ref(s: StateNode | undefined, id: string): string {
  return s && isPseudo(s) ? '[*]' : id;
}

function noteLines(target: string, position: string, text: string): string[] {
  if (!text.includes('\n')) return [`note ${position} ${target} : ${text}`];
  return [`note ${position} ${target}`, ...text.split('\n').map((l) => INDENT + l), 'end note'];
}

export function serializeState(m: StateModel): { header: string; body: string[] } {
  const byId = new Map(m.states.map((s) => [s.id, s]));
  const line = (t: StateTransition) => {
    const label = t.label ? ` : ${t.label}` : '';
    return `${ref(byId.get(t.from), t.from)} --> ${ref(byId.get(t.to), t.to)}${label}`;
  };

  /** States referenced by a transition written in another scope must be declared in their own. */
  const mentionedIn = new Map<string, Set<string | null>>();
  for (const t of m.transitions) {
    for (const id of [t.from, t.to]) {
      if (!mentionedIn.has(id)) mentionedIn.set(id, new Set());
      mentionedIn.get(id)!.add(t.scope);
    }
  }
  const needsDecl = (s: StateNode) => {
    const scopes = mentionedIn.get(s.id);
    return !scopes || !scopes.has(s.parent) || [...scopes].some((sc) => sc !== s.parent);
  };

  const writeScope = (scope: string | null): string[] => {
    const out: string[] = [];
    const members = m.states.filter((s) => s.parent === scope && !isPseudo(s));
    for (const s of members) {
      if (s.composite) continue;
      if (s.kind !== 'state') out.push(`state ${s.id} <<${s.kind}>>`);
      else if (s.label !== null) out.push(`state "${s.label}" as ${s.id}`);
      else if (needsDecl(s) && !s.descriptions.length) out.push(`state ${s.id}`);
      for (const d of s.descriptions) out.push(`${s.id} : ${d}`);
    }
    for (const s of members) {
      if (!s.composite) continue;
      const head = s.label !== null ? `state "${s.label}" as ${s.id} {` : `state ${s.id} {`;
      const inner = [...(s.direction ? [`direction ${s.direction}`] : []), ...writeScope(s.id)];
      out.push(head, ...indent(inner), '}');
      for (const d of s.descriptions) out.push(`${s.id} : ${d}`);
    }
    for (const t of m.transitions) if (t.scope === scope) out.push(line(t));
    for (const n of m.notes) if (n.scope === scope) out.push(...noteLines(n.target, n.position, n.text));
    return out;
  };

  const body: string[] = [];
  if (m.direction) body.push(`direction ${m.direction}`);
  body.push(...m.extras, ...writeScope(null));
  for (const cd of m.classDefs) body.push(`classDef ${cd.names} ${cd.style}`);
  const byCss = new Map<string, string[]>();
  for (const s of m.states) {
    for (const cls of s.cssClasses) {
      if (!byCss.has(cls)) byCss.set(cls, []);
      byCss.get(cls)!.push(s.id);
    }
  }
  for (const [cls, ids] of byCss) body.push(`class ${ids.join(',')} ${cls}`);
  for (const s of m.states) if (s.style) body.push(`style ${s.id} ${s.style}`);
  return { header: m.keyword, body: indent(body) };
}
