import { INDENT } from '../common';
import type { SeqItem, SeqModel, SeqParticipant } from './model';

function participantDecl(p: SeqParticipant): string {
  return `${p.kind} ${p.id}${p.meta ?? ''}${p.label !== null ? ` as ${p.label}` : ''}`;
}

function textPart(text: string): string {
  if (!text || /^(no)?wrap:/i.test(text)) return `:${text}`;
  return `: ${text}`;
}

function itemLine(item: SeqItem, byId: Map<string, SeqParticipant>): string {
  switch (item.t) {
    case 'message':
      return `${item.from}${item.arrow}${item.activate}${item.to}${textPart(item.text)}`;
    case 'note':
      return `Note ${item.position} ${item.actors.join(',')}: ${item.text}`;
    case 'activate':
    case 'deactivate':
      return `${item.t} ${item.actor}`;
    case 'block':
      return item.label ? `${item.kind} ${item.label}` : item.kind;
    case 'branch':
      return item.label ? `${item.kind} ${item.label}` : item.kind;
    case 'end':
      return 'end';
    case 'create': {
      const p = byId.get(item.id);
      return `create ${p ? participantDecl(p) : `participant ${item.id}`}`;
    }
    case 'destroy':
      return `destroy ${item.actor}`;
    case 'raw':
      return item.text;
  }
}

/** Participants (in order) that are first introduced by a mention rather than a declaration. */
function firstMentions(m: SeqModel): string[] {
  const seen: string[] = [];
  const see = (id: string) => {
    if (!seen.includes(id)) seen.push(id);
  };
  for (const it of m.items) {
    if (it.t === 'message') {
      see(it.from);
      see(it.to);
    } else if (it.t === 'note') it.actors.forEach(see);
    else if (it.t === 'activate' || it.t === 'deactivate' || it.t === 'destroy') see(it.actor);
    else if (it.t === 'create') see(it.id);
  }
  return seen;
}

/** Decides which participants must be declared up front to keep their order and details. */
export function participantsToDeclare(m: SeqModel): SeqParticipant[] {
  const top = m.participants.filter((p) => !p.created);
  const boxed = new Set(m.boxes.flatMap((b) => b.members));
  const needs = (p: SeqParticipant) =>
    p.declared || p.label !== null || p.kind !== 'participant' || p.meta !== null || boxed.has(p.id);
  let k = -1;
  top.forEach((p, i) => {
    if (needs(p)) k = i;
  });
  const declared = top.slice(0, k + 1);
  const rest = top.slice(k + 1).map((p) => p.id);
  const declaredIds = new Set(declared.map((p) => p.id));
  const createdIds = new Set(m.participants.filter((p) => p.created).map((p) => p.id));
  const implicitOrder = firstMentions(m).filter((id) => !declaredIds.has(id) && !createdIds.has(id));
  if (implicitOrder.join('\u0000') !== rest.join('\u0000')) return top;
  return declared;
}

export function serializeSequence(m: SeqModel): { header: string; body: string[] } {
  const body: string[] = [];
  const byId = new Map(m.participants.map((p) => [p.id, p]));
  if (m.title) body.push(`${INDENT}title ${m.title}`);

  const boxOf = new Map<string, number>();
  m.boxes.forEach((b, i) => b.members.forEach((id) => boxOf.set(id, i)));
  const emittedBoxes = new Set<number>();
  const toDeclare = participantsToDeclare(m);
  for (const p of toDeclare) {
    const bi = boxOf.get(p.id);
    if (bi === undefined) {
      body.push(INDENT + participantDecl(p));
      continue;
    }
    if (emittedBoxes.has(bi)) continue;
    emittedBoxes.add(bi);
    const box = m.boxes[bi];
    body.push(INDENT + (box.raw ? `box ${box.raw}` : 'box'));
    for (const id of box.members) {
      const member = byId.get(id);
      if (member) body.push(INDENT + INDENT + participantDecl(member));
    }
    body.push(INDENT + 'end');
  }

  let depth = 1;
  for (const it of m.items) {
    if (it.t === 'end') depth = Math.max(1, depth - 1);
    const d = it.t === 'branch' ? Math.max(1, depth - 1) : depth;
    body.push(INDENT.repeat(d) + itemLine(it, byId));
    if (it.t === 'block') depth++;
  }
  return { header: 'sequenceDiagram', body };
}
