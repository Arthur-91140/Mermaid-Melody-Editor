import { splitStatements } from '../common';
import {
  SEQ_ARROWS,
  type BlockKind,
  type BranchKind,
  type NotePosition,
  type ParticipantKind,
  type SeqModel,
  type SeqParticipant,
} from './model';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const ARROW_ALT = SEQ_ARROWS.map(escapeRe).join('|');
const MESSAGE_RE = new RegExp(`^([^:]+?)\\s*(${ARROW_ALT})\\s*([+-]?)\\s*([^:]+?)\\s*(?::(.*))?$`);

export function parseSequence(body: string[]): SeqModel {
  const model: SeqModel = { kind: 'sequence', title: null, participants: [], boxes: [], items: [] };
  const byId = new Map<string, SeqParticipant>();
  let openBox: number | null = null;
  let blockDepth = 0;

  const ensure = (id: string): SeqParticipant => {
    let p = byId.get(id);
    if (!p) {
      p = { id, label: null, kind: 'participant', meta: null, declared: false, created: false };
      byId.set(id, p);
      model.participants.push(p);
    }
    return p;
  };

  const declare = (kind: ParticipantKind, rest: string, created: boolean): SeqParticipant | null => {
    const m = /^(.+?)\s*(@\{[\s\S]*\})?(?:\s+as\s+(.+))?$/.exec(rest.trim());
    if (!m) return null;
    const id = m[1].trim();
    const existing = byId.get(id);
    const p = existing ?? ensure(id);
    p.kind = kind;
    p.declared = true;
    p.created = created;
    if (m[2]) p.meta = m[2];
    if (m[3] !== undefined) p.label = m[3].trim();
    return p;
  };

  for (const { text: t } of splitStatements(body)) {
    let m: RegExpExecArray | null;
    if (t.startsWith('%%') || t.startsWith('#')) {
      model.items.push({ t: 'raw', text: t });
      continue;
    }
    if ((m = /^title(?::\s*|\s+)(.*)$/i.exec(t))) {
      model.title = m[1].trim();
      continue;
    }
    if ((m = /^box(?:\s+(.*))?$/i.exec(t))) {
      model.boxes.push({ raw: (m[1] ?? '').trim(), members: [] });
      openBox = model.boxes.length - 1;
      continue;
    }
    if ((m = /^create\s+(participant|actor)\s+(.+)$/i.exec(t))) {
      const p = declare(m[1].toLowerCase() as ParticipantKind, m[2], true);
      if (p) model.items.push({ t: 'create', id: p.id });
      else model.items.push({ t: 'raw', text: t });
      continue;
    }
    if ((m = /^(participant|actor)\s+(.+)$/i.exec(t))) {
      const p = declare(m[1].toLowerCase() as ParticipantKind, m[2], false);
      if (!p) model.items.push({ t: 'raw', text: t });
      else if (openBox !== null && !model.boxes[openBox].members.includes(p.id)) {
        model.boxes[openBox].members.push(p.id);
      }
      continue;
    }
    if ((m = /^destroy\s+(.+)$/i.exec(t))) {
      const actor = m[1].trim();
      ensure(actor);
      model.items.push({ t: 'destroy', actor });
      continue;
    }
    if ((m = /^(activate|deactivate)\s+(.+)$/i.exec(t))) {
      const actor = m[2].trim();
      ensure(actor);
      model.items.push({ t: m[1].toLowerCase() as 'activate' | 'deactivate', actor });
      continue;
    }
    if ((m = /^note\s+(left of|right of|over)\s+([^:]+?)\s*:(.*)$/i.exec(t))) {
      const actors = m[2].split(',').map((a) => a.trim()).filter(Boolean);
      actors.forEach(ensure);
      model.items.push({
        t: 'note',
        position: m[1].toLowerCase().replace(/\s+/, ' ') as NotePosition,
        actors,
        text: m[3].trim(),
      });
      continue;
    }
    if ((m = /^(loop|alt|opt|par_over|par|critical|break|rect)\b\s*(.*)$/i.exec(t))) {
      blockDepth++;
      model.items.push({ t: 'block', kind: m[1].toLowerCase() as BlockKind, label: m[2].trim() });
      continue;
    }
    if ((m = /^(else|and|option)\b\s*(.*)$/i.exec(t))) {
      model.items.push({ t: 'branch', kind: m[1].toLowerCase() as BranchKind, label: m[2].trim() });
      continue;
    }
    if (/^end$/i.test(t)) {
      if (openBox !== null && blockDepth === 0) openBox = null;
      else {
        blockDepth = Math.max(0, blockDepth - 1);
        model.items.push({ t: 'end' });
      }
      continue;
    }
    if ((m = MESSAGE_RE.exec(t))) {
      const from = m[1].trim();
      const to = m[4].trim();
      ensure(from);
      ensure(to);
      model.items.push({
        t: 'message',
        from,
        to,
        arrow: m[2],
        text: (m[5] ?? '').trim(),
        activate: m[3] as '' | '+' | '-',
      });
      continue;
    }
    model.items.push({ t: 'raw', text: t });
  }
  return model;
}
