import type { Edge, Node, NodeTypes } from '@xyflow/react';
import { Circle, CircleDot, Diamond, GitFork, GitMerge, Square, SquareDashed, StickyNote } from 'lucide-react';
import { useMemo } from 'react';
import { isPseudo, stateDisplay, type StateKind, type StateModel } from '../../diagrams/state/model';
import {
  addNote,
  addState,
  addTransition,
  deleteStateItems,
  duplicateStates,
  moveStates,
  setStateTitle,
  updateState,
  updateTransition,
} from '../../diagrams/state/ops';
import { classStyles, visualStyle } from '../../diagrams/style';
import { useDiagram } from '../../hooks/useDiagram';
import { useT } from '../../i18n';
import { renameLayoutId, useDocuments, type Pos } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { startEditing } from '../graph/context';
import { assignBends, type FloatingEdgeData } from '../graph/FloatingEdge';
import { containsPoint, estimateText, type Box } from '../graph/geometry';
import { GraphCanvas } from '../graph/GraphCanvas';
import { GroupNode } from '../graph/GroupNode';
import { toRankDir, type LayoutItem } from '../graph/layout';
import { NoteNode } from '../graph/NoteNode';
import { Palette } from '../graph/Palette';
import { useGraphLayout } from '../graph/useGraphLayout';
import { stateIds } from './ids';
import { StateNodeView } from './StateNodes';

const NODE_TYPES: NodeTypes = { state: StateNodeView, mmeGroup: GroupNode, note: NoteNode };
const noteKey = (i: number) => `note:${i}`;

function stateSize(s: StateModel['states'][number], vertical: boolean): { width: number; height: number } {
  switch (s.kind) {
    case 'start':
      return { width: 20, height: 20 };
    case 'end':
      return { width: 22, height: 22 };
    case 'choice':
      return { width: 30, height: 30 };
    case 'fork':
    case 'join':
      return vertical ? { width: 8, height: 90 } : { width: 90, height: 8 };
    default: {
      const d = stateDisplay(s);
      const t = estimateText([d.title, ...d.lines].join('\n'));
      return { width: Math.max(80, t.w + 30), height: t.h + 20 + (d.lines.length ? 8 : 0) };
    }
  }
}

export function StateCanvas() {
  const t = useT();
  const { model, apply } = useDiagram<StateModel>();
  const docId = useDocuments((s) => s.currentId) ?? '';
  const dir = toRankDir(model.direction);
  const vertical = dir === 'LR' || dir === 'RL';

  const items: LayoutItem[] = useMemo(
    () => [
      ...model.states.map((s) =>
        s.composite ? { id: s.id, parent: s.parent, isGroup: true, width: 0, height: 0 } : { id: s.id, parent: s.parent, ...stateSize(s, vertical) },
      ),
      ...model.notes.map((n, i) => {
        const e = estimateText(n.text);
        return { id: noteKey(i), parent: n.scope, width: Math.max(90, e.w + 24), height: e.h + 20 };
      }),
    ],
    [model, vertical],
  );
  const links = useMemo(
    () => [
      ...model.transitions.map((tr) => ({ source: tr.from, target: tr.to })),
      ...model.notes.map((n, i) => ({ source: noteKey(i), target: n.target })),
    ],
    [model],
  );
  const composites = useMemo(() => new Set(model.states.filter((s) => s.composite).map((s) => s.id)), [model.states]);
  const cid = (id: string) => (id.startsWith('note:') ? id : composites.has(id) ? stateIds.group(id) : stateIds.state(id));
  const { positions, layout, onMove, relayout, spotFor } = useGraphLayout(items, links, dir, cid, 1.2);

  const { nodes, edges } = useMemo(() => {
    const groups: Node[] = model.states
      .filter((s) => s.composite)
      .map((s) => ({
        id: stateIds.group(s.id),
        type: 'mmeGroup',
        position: layout[s.id] ?? { x: 0, y: 0 },
        zIndex: -10,
        data: {
          isGroup: true,
          rounded: true,
          connectable: true,
          title: stateDisplay(s).title,
          visual: visualStyle(...classStyles(model.classDefs, s.cssClasses), s.style),
          members: [
            ...model.states.filter((c) => c.parent === s.id).map((c) => cid(c.id)),
            ...model.notes.flatMap((n, i) => (n.scope === s.id ? [noteKey(i)] : [])),
          ],
        },
      }));
    const states: Node[] = model.states
      .filter((s) => !s.composite)
      .map((s) => {
        const d = stateDisplay(s);
        return {
          id: stateIds.state(s.id),
          type: 'state',
          position: positions[s.id] ?? { x: 0, y: 0 },
          data: {
            kind: s.kind,
            title: d.title,
            lines: d.lines,
            vertical,
            visual: visualStyle(...classStyles(model.classDefs, s.cssClasses), s.style),
            boundary: s.kind === 'start' || s.kind === 'end' ? 'ellipse' : s.kind === 'choice' ? 'diamond' : 'rect',
          },
        };
      });
    const notes: Node[] = model.notes.map((n, i) => ({
      id: noteKey(i),
      type: 'note',
      position: positions[noteKey(i)] ?? { x: 0, y: 0 },
      data: { text: n.text, boundary: 'rect' },
    }));
    const trans: Edge<FloatingEdgeData>[] = model.transitions.map((tr, i) => ({
      id: stateIds.transition(i),
      source: cid(tr.from),
      target: cid(tr.to),
      type: 'floating',
      data: { label: tr.label ?? '', markerEnd: 'arrow', editable: true },
    }));
    const noteLinks: Edge<FloatingEdgeData>[] = model.notes.map((n, i) => ({
      id: stateIds.noteLink(i),
      source: noteKey(i),
      target: cid(n.target),
      type: 'floating',
      selectable: false,
      deletable: false,
      data: { line: 'dotted' },
    }));
    return { nodes: [...groups, ...states, ...notes], edges: [...assignBends(trans), ...noteLinks] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, positions, layout, vertical]);

  /** Approximate composite boxes, to know where a palette item is dropped. */
  const compositeAt = (p: Pos): string | null => {
    const boxes = new Map<string, Box>();
    const boxOf = (id: string): Box | null => {
      if (boxes.has(id)) return boxes.get(id)!;
      const rects: Box[] = [];
      for (const it of items) {
        if (it.parent !== id) continue;
        const b = it.isGroup ? boxOf(it.id) : positions[it.id] ? { x: positions[it.id].x, y: positions[it.id].y, w: it.width, h: it.height } : null;
        if (b) rects.push(b);
      }
      const own = layout[id];
      if (!rects.length) return own ? { x: own.x, y: own.y, w: 200, h: 110 } : null;
      const x = Math.min(...rects.map((r) => r.x)) - 18;
      const y = Math.min(...rects.map((r) => r.y)) - 48;
      const box = { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) + 18 - x, h: Math.max(...rects.map((r) => r.y + r.h)) + 18 - y };
      boxes.set(id, box);
      return box;
    };
    const hits = [...composites].map((id) => ({ id, box: boxOf(id) })).filter((h) => h.box && containsPoint(h.box, p));
    hits.sort((a, b) => a.box!.w * a.box!.h - b.box!.w * b.box!.h);
    return hits[0]?.id ?? null;
  };

  const addAt = (payload: string, pos: Pos, free: boolean) => {
    const parent = free ? null : compositeAt(pos);
    if (payload === 'note') {
      const target = model.states.find((s) => !isPseudo(s))?.id;
      if (!target) return;
      const i = model.notes.length;
      apply(addNote(model, target, t('state.note')), { ...layout, [noteKey(i)]: spotFor(pos, 100, 36, free) });
      useSelection.getState().set([noteKey(i)]);
      setTimeout(() => startEditing(noteKey(i)), 60);
      return;
    }
    const kind = (payload === 'composite' ? 'state' : payload) as StateKind;
    const res = addState(model, kind, parent, t('state.newState'));
    if (res.model === model) return;
    let next = res.model;
    if (payload === 'composite') next = updateState(next, res.id, { composite: true });
    const size = payload === 'composite' ? { width: 200, height: 110 } : stateSize(next.states.find((s) => s.id === res.id)!, vertical);
    apply(next, { ...layout, [res.id]: spotFor(pos, size.width, size.height, free) });
    const id = payload === 'composite' ? stateIds.group(res.id) : stateIds.state(res.id);
    useSelection.getState().set([id]);
    if (kind === 'state') setTimeout(() => startEditing(id), 60);
  };


  const modelKey = (c: string): string | null => {
    const p = stateIds.parse(c);
    if (p.kind === 'note') return noteKey(Number(p.id));
    if (p.kind === 'state') return p.id;
    return null;
  };

  return (
    <GraphCanvas
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      fitKey={docId}
      palette={
        <Palette
          onAdd={addAt}
          items={[
            { payload: 'state', title: t('state.addState'), icon: <Square size={16} /> },
            { payload: 'start', title: t('state.addStart'), icon: <Circle size={16} fill="currentColor" /> },
            { payload: 'end', title: t('state.addEnd'), icon: <CircleDot size={16} /> },
            { payload: 'choice', title: t('state.addChoice'), icon: <Diamond size={16} /> },
            { payload: 'fork', title: t('state.addFork'), icon: <GitFork size={16} /> },
            { payload: 'join', title: t('state.addJoin'), icon: <GitMerge size={16} /> },
            { payload: 'composite', title: t('state.addComposite'), icon: <SquareDashed size={16} />, separatorBefore: true },
            { payload: 'note', title: t('state.addNote'), icon: <StickyNote size={16} /> },
          ]}
        />
      }
      onMove={(moved) => onMove(moved, modelKey)}
      onConnect={(s, tg) => {
        const a = stateIds.parse(s);
        const b = stateIds.parse(tg);
        if (a.kind === 'state' && b.kind === 'state') apply(addTransition(model, a.id, b.id));
        else if (a.kind === 'note' && b.kind === 'state') {
          apply({ ...model, notes: model.notes.map((n, i) => (i === Number(a.id) ? { ...n, target: b.id } : n)) });
        }
      }}
      onConnectToEmpty={(s, pos) => {
        const from = stateIds.parse(s);
        if (from.kind !== 'state') return;
        const src = model.states.find((x) => x.id === from.id);
        if (!src || src.kind === 'end') return;
        const res = addState(model, 'state', src.composite ? src.id : src.parent, t('state.newState'));
        apply(addTransition(res.model, from.id, res.id), { ...layout, [res.id]: { x: Math.round(pos.x - 45), y: Math.round(pos.y - 19) } });
        useSelection.getState().set([stateIds.state(res.id)]);
        setTimeout(() => startEditing(stateIds.state(res.id)), 60);
      }}
      onDelete={(nodeIds, edgeIds) => {
        const parsed = [...nodeIds, ...edgeIds].map(stateIds.parse);
        apply(
          deleteStateItems(
            model,
            parsed.filter((p) => p.kind === 'state').map((p) => p.id),
            parsed.filter((p) => p.kind === 'transition').map((p) => Number(p.id)),
            parsed.filter((p) => p.kind === 'note').map((p) => Number(p.id)),
          ),
        );
        useSelection.getState().clear();
      }}
      onReparent={(ids, group) => {
        const states = ids.map(stateIds.parse).filter((p) => p.kind === 'state').map((p) => p.id);
        if (states.length) apply(moveStates(model, states, group ? stateIds.parse(group).id : null));
      }}
      onDropItem={(payload, pos) => addAt(payload, pos, false)}
      onDuplicate={(ids) => {
        const { model: next, mapping } = duplicateStates(model, ids.map(stateIds.parse).filter((p) => p.kind === 'state').map((p) => p.id));
        const l = { ...layout };
        for (const [from, to] of mapping) if (positions[from]) l[to] = { x: positions[from].x + 40, y: positions[from].y + 40 };
        apply(next, l);
        useSelection.getState().set([...mapping.values()].map(stateIds.state));
      }}
      onCommitText={(c, text) => {
        const p = stateIds.parse(c);
        if (p.kind === 'state') {
          const res = setStateTitle(model, p.id, text);
          if (res.model === model) return;
          apply(res.model, renameLayoutId(layout, p.id, res.id));
          if (res.id !== p.id) {
            const composite = model.states.find((x) => x.id === p.id)?.composite;
            useSelection.getState().set([composite ? stateIds.group(res.id) : stateIds.state(res.id)]);
          }
        } else if (p.kind === 'note') {
          const i = Number(p.id);
          apply({ ...model, notes: model.notes.map((n, k) => (k === i ? { ...n, text } : n)) });
        } else if (p.kind === 'transition') {
          apply(updateTransition(model, Number(p.id), { label: text.trim() || null }));
        }
      }}
      canEdit={(c) => {
        const p = stateIds.parse(c);
        if (p.kind !== 'state') return true;
        const s = model.states.find((x) => x.id === p.id);
        return !!s && s.kind === 'state';
      }}
      onAutoLayout={relayout}
    />
  );
}
