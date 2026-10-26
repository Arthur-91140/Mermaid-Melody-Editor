import { Circle, CircleDot, Diamond, Square } from 'lucide-react';
import { stateIds } from '../canvas/state/ids';
import { stateDisplay, type StateKind, type StateModel } from '../diagrams/state/model';
import { addState, addTransition, deleteStateItems, setStateTitle, updateTransition } from '../diagrams/state/ops';
import { renameLayoutId } from '../store/documents';
import { cleanId, tag, type PreviewEditing } from './types';

const cidOf = (m: StateModel, id: string) =>
  m.states.find((s) => s.id === id)?.composite ? stateIds.group(id) : stateIds.state(id);

export const statePreview: PreviewEditing<StateModel> = {
  annotate(svg, m) {
    const noteSeen = new Map<string, number>();
    svg.querySelectorAll('g.node').forEach((g) => {
      const raw = /^state-(.+)-\d+$/.exec(cleanId(g.id))?.[1];
      if (!raw) return;
      const note = /^(.+)----note$/.exec(raw)?.[1];
      if (note) {
        const k = noteSeen.get(note) ?? 0;
        noteSeen.set(note, k + 1);
        const index = m.notes.map((n, i) => (n.target === note ? i : -1)).filter((i) => i >= 0)[k];
        if (index !== undefined) tag(g, stateIds.note(index));
        return;
      }
      if (m.states.some((s) => s.id === raw)) tag(g, cidOf(m, raw));
    });
    svg.querySelectorAll('g.statediagram-cluster').forEach((g) => {
      const id = g.getAttribute('data-id');
      if (id && m.states.some((s) => s.id === id)) tag(g, stateIds.group(id));
    });
    svg.querySelectorAll('path.transition').forEach((p) => {
      const n = /^edge(\d+)$/.exec(p.getAttribute('data-id') ?? '')?.[1];
      if (n !== undefined && Number(n) < m.transitions.length) tag(p, stateIds.transition(Number(n)));
    });
    svg.querySelectorAll('g.edgeLabel').forEach((g) => {
      const n = /^edge(\d+)$/.exec(g.querySelector('[data-id]')?.getAttribute('data-id') ?? '')?.[1];
      if (n !== undefined && Number(n) < m.transitions.length) tag(g, stateIds.transition(Number(n)));
    });
  },

  textOf(m, cid) {
    const p = stateIds.parse(cid);
    if (p.kind === 'note') return m.notes[Number(p.id)]?.text ?? null;
    if (p.kind === 'transition') return m.transitions[Number(p.id)]?.label ?? '';
    const s = m.states.find((x) => x.id === p.id);
    return s && s.kind === 'state' ? stateDisplay(s).title : null;
  },

  commitText(m, cid, text, layout) {
    const p = stateIds.parse(cid);
    if (p.kind === 'note') {
      const i = Number(p.id);
      return text.trim() ? { model: { ...m, notes: m.notes.map((n, k) => (k === i ? { ...n, text } : n)) } } : null;
    }
    if (p.kind === 'transition') return { model: updateTransition(m, Number(p.id), { label: text.trim() || null }) };
    const res = setStateTitle(m, p.id, text);
    if (res.model === m) return null;
    return { model: res.model, layout: renameLayoutId(layout, p.id, res.id), select: res.id !== p.id ? [cidOf(res.model, res.id)] : undefined };
  },

  remove(m, ids) {
    const parsed = ids.map(stateIds.parse);
    return deleteStateItems(
      m,
      parsed.filter((p) => p.kind === 'state').map((p) => p.id),
      parsed.filter((p) => p.kind === 'transition').map((p) => Number(p.id)),
      parsed.filter((p) => p.kind === 'note').map((p) => Number(p.id)),
    );
  },

  connect(m, from, to) {
    const a = stateIds.parse(from);
    const b = stateIds.parse(to);
    if (a.kind !== 'state' || b.kind !== 'state') return null;
    const next = addTransition(m, a.id, b.id);
    return next === m ? null : { model: next, select: [stateIds.transition(m.transitions.length)] };
  },

  addActions: (t) => {
    const add = (kind: StateKind) => (m: StateModel, selection: string[]) => {
      const sel = selection.map(stateIds.parse).find((p) => p.kind === 'state');
      const anchor = sel ? m.states.find((s) => s.id === sel.id) : undefined;
      const parent = anchor ? (anchor.composite ? anchor.id : anchor.parent) : null;
      const res = addState(m, kind, parent, t('state.newState'));
      let model = res.model;
      // Chain from the selected state; addTransition refuses invalid start/end combinations.
      if (anchor && kind !== 'start') model = addTransition(model, anchor.id, res.id);
      const cid = stateIds.state(res.id);
      return { model, select: [cid], edit: kind === 'state' ? cid : undefined };
    };
    return [
      { id: 'state', title: t('state.addState'), icon: <Square size={16} />, run: add('state') },
      { id: 'start', title: t('state.addStart'), icon: <Circle size={16} fill="currentColor" />, run: add('start') },
      { id: 'end', title: t('state.addEnd'), icon: <CircleDot size={16} />, run: add('end') },
      { id: 'choice', title: t('state.addChoice'), icon: <Diamond size={16} />, run: add('choice') },
    ];
  },
};
