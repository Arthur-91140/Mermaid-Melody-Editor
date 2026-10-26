import { MessageSquarePlus, StickyNote, User, UserPlus } from 'lucide-react';
import { seqIds } from '../canvas/sequence/ids';
import { decodeEntities } from '../diagrams/common';
import type { SeqItem, SeqModel } from '../diagrams/sequence/model';
import {
  addParticipant,
  deleteItems,
  deleteParticipants,
  insertItem,
  PARTICIPANT_ID_RE,
  participantTaken,
  renameParticipant,
  updateItem,
  updateParticipant,
} from '../diagrams/sequence/ops';
import { addHitArea, tag, type PreviewEditing } from './types';

const display = (s: string) => decodeEntities(s.replace(/<br\s*\/?>/gi, '\n'));
const encode = (s: string) => s.replace(/\r?\n/g, '<br>').replace(/;/g, '#59;').replace(/#(?!\w+;)/g, '#35;');

/** Indexes of the items of a given kind, in order. */
function indexesOf(m: SeqModel, pred: (it: SeqItem) => boolean): number[] {
  return m.items.flatMap((it, i) => (pred(it) ? [i] : []));
}

export const sequencePreview: PreviewEditing<SeqModel> = {
  annotate(svg, m) {
    const ids = new Set(m.participants.map((p) => p.id));
    svg.querySelectorAll('[name], [data-id]').forEach((el) => {
      const id = el.getAttribute('name') ?? el.getAttribute('data-id');
      if (id && ids.has(id) && !/messageLine/.test(el.getAttribute('class') ?? '')) tag(el, seqIds.participant(id));
    });
    svg.querySelectorAll('text.actor').forEach((el) => {
      const prev = el.previousElementSibling?.getAttribute('data-mme');
      if (prev) tag(el, prev);
    });
    // Stick figures and lifelines are thin strokes: give them a comfortable hit area.
    svg.querySelectorAll('g.actor-man[data-mme], line.actor-line[data-mme]').forEach((el) => addHitArea(el, el.getAttribute('data-mme')!));
    const messages = indexesOf(m, (it) => it.t === 'message');
    svg.querySelectorAll('[class^="messageLine"]').forEach((el, k) => messages[k] !== undefined && tag(el, seqIds.item(messages[k])));
    svg.querySelectorAll('text.messageText').forEach((el, k) => messages[k] !== undefined && tag(el, seqIds.item(messages[k])));
    const notes = indexesOf(m, (it) => it.t === 'note');
    const rects = [...svg.querySelectorAll('rect.note')];
    rects.forEach((el, k) => notes[k] !== undefined && tag(el, seqIds.item(notes[k])));
    svg.querySelectorAll('text.noteText').forEach((el) => {
      let prev = el.previousElementSibling;
      while (prev && !prev.matches('rect.note')) prev = prev.previousElementSibling;
      const id = prev?.getAttribute('data-mme');
      if (id) tag(el, id);
    });
    const blocks = indexesOf(m, (it) => it.t === 'block' && it.kind !== 'rect');
    svg.querySelectorAll('text.labelText').forEach((el, k) => {
      if (blocks[k] === undefined) return;
      tag(el, seqIds.item(blocks[k]));
      const box = el.previousElementSibling;
      if (box?.matches('polygon.labelBox')) tag(box, seqIds.item(blocks[k]));
    });
  },

  textOf(m, cid) {
    const p = seqIds.parse(cid);
    if (p.kind === 'participant') {
      const part = m.participants.find((x) => x.id === p.id);
      return part ? (part.label ?? part.id) : null;
    }
    const it = m.items[Number(p.id)];
    if (it?.t === 'message' || it?.t === 'note') return display(it.text);
    if (it?.t === 'block' || it?.t === 'branch') return it.label;
    return null;
  },

  commitText(m, cid, text) {
    const p = seqIds.parse(cid);
    const value = text.trim();
    if (p.kind === 'participant') {
      const part = m.participants.find((x) => x.id === p.id);
      if (!part || !value) return null;
      if (part.label === null && PARTICIPANT_ID_RE.test(value) && !participantTaken(m, value)) {
        return { model: renameParticipant(m, p.id, value), select: [seqIds.participant(value)] };
      }
      return { model: updateParticipant(m, p.id, { label: value === p.id ? null : value }) };
    }
    const i = Number(p.id);
    const it = m.items[i];
    if (it?.t === 'message' || it?.t === 'note') return { model: updateItem(m, i, { text: encode(value) }) };
    if (it?.t === 'block' || it?.t === 'branch') return { model: updateItem(m, i, { label: value }) };
    return null;
  },

  remove(m, ids) {
    const parsed = ids.map(seqIds.parse);
    return deleteParticipants(
      deleteItems(
        m,
        parsed.filter((p) => p.kind === 'item').map((p) => Number(p.id)),
      ),
      parsed.filter((p) => p.kind === 'participant').map((p) => p.id),
    );
  },

  connect(m, from, to, t) {
    const a = seqIds.parse(from);
    const b = seqIds.parse(to);
    if (a.kind !== 'participant' || b.kind !== 'participant') return null;
    const index = m.items.length;
    const item: SeqItem = { t: 'message', from: a.id, to: b.id, arrow: '->>', text: t('seq.newMessage'), activate: '' };
    return { model: insertItem(m, item, index), select: [seqIds.item(index)], edit: seqIds.item(index) };
  },

  addActions: (t) => {
    const after = (selection: string[], m: SeqModel) => {
      const items = selection.map(seqIds.parse).filter((p) => p.kind === 'item').map((p) => Number(p.id));
      return items.length ? Math.max(...items) + 1 : m.items.length;
    };
    const participant = (kind: 'participant' | 'actor') => (m: SeqModel) => {
      const res = addParticipant(m, kind, kind === 'actor' ? t('seq.actor') : t('seq.participant'));
      return { model: res.model, select: [seqIds.participant(res.id)], edit: seqIds.participant(res.id) };
    };
    return [
      { id: 'participant', title: t('seq.addParticipant'), icon: <UserPlus size={16} />, run: participant('participant') },
      { id: 'actor', title: t('seq.addActor'), icon: <User size={16} />, run: participant('actor') },
      {
        id: 'message',
        title: t('seq.addMessage'),
        icon: <MessageSquarePlus size={16} />,
        run(m, selection) {
          let model = m;
          while (model.participants.length < 2) model = addParticipant(model, 'participant', t('seq.participant')).model;
          const sel = selection.map(seqIds.parse).find((p) => p.kind === 'participant')?.id;
          const fromIdx = Math.max(0, model.participants.findIndex((p) => p.id === sel));
          const from = model.participants[fromIdx].id;
          const to = model.participants[(fromIdx + 1) % model.participants.length].id;
          const index = after(selection, model);
          model = insertItem(model, { t: 'message', from, to, arrow: '->>', text: t('seq.newMessage'), activate: '' }, index);
          return { model, select: [seqIds.item(index)], edit: seqIds.item(index) };
        },
      },
      {
        id: 'note',
        title: t('seq.addNote'),
        icon: <StickyNote size={16} />,
        run(m, selection) {
          let model = m;
          if (!model.participants.length) model = addParticipant(model, 'participant', t('seq.participant')).model;
          const actor = selection.map(seqIds.parse).find((p) => p.kind === 'participant')?.id ?? model.participants[0].id;
          const index = after(selection, model);
          model = insertItem(model, { t: 'note', position: 'right of', actors: [actor], text: t('seq.newNote') }, index);
          return { model, select: [seqIds.item(index)], edit: seqIds.item(index) };
        },
      },
    ];
  },
};
