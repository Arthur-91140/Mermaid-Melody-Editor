import type { Edge, Node, NodeTypes } from '@xyflow/react';
import { Box, FolderOpen, StickyNote } from 'lucide-react';
import { useMemo } from 'react';
import type { ClassMarker, ClassModel } from '../../diagrams/class/model';
import { emptyClass, isMethod } from '../../diagrams/class/model';
import {
  addClass,
  addNamespace,
  addRelation,
  CLASS_ID_RE,
  classTaken,
  deleteClassItems,
  duplicateClasses,
  formatMember,
  renameClass,
  renameNamespace,
  setNamespace,
  updateClass,
  updateRelation,
} from '../../diagrams/class/ops';
import { classStyles, visualStyle } from '../../diagrams/style';
import { useDiagram } from '../../hooks/useDiagram';
import { useT } from '../../i18n';
import { useDocuments, type Layout, type Pos } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { startEditing } from '../graph/context';
import { assignBends, type FloatingEdgeData } from '../graph/FloatingEdge';
import { estimateText } from '../graph/geometry';
import { GraphCanvas } from '../graph/GraphCanvas';
import { GroupNode } from '../graph/GroupNode';
import { toRankDir, type LayoutItem } from '../graph/layout';
import type { MarkerName } from '../graph/markers';
import { NoteNode } from '../graph/NoteNode';
import { Palette } from '../graph/Palette';
import { useGraphLayout } from '../graph/useGraphLayout';
import { ClassNodeView } from './ClassNodeView';
import { classIds } from './ids';

const NODE_TYPES: NodeTypes = { umlClass: ClassNodeView, mmeGroup: GroupNode, note: NoteNode };

const MARKER: Record<ClassMarker, MarkerName | null> = {
  none: null,
  inheritance: 'triangle',
  composition: 'diamond-filled',
  aggregation: 'diamond-hollow',
  arrow: 'arrow-open',
};

const noteKey = (i: number) => `note:${i}`;
const nsKey = (name: string) => `ns:${name}`;

function classSize(c: ClassModel['classes'][number]): { width: number; height: number } {
  const lines = [...c.annotations.map((a) => `«${a}»`), c.label ?? c.id, ...c.members.map((m) => formatMember(m).text)];
  const t = estimateText(lines.join('\n'), 7.2, 19);
  return { width: Math.max(110, t.w + 28), height: t.h + 30 };
}

export function ClassCanvas() {
  const t = useT();
  const { model, apply } = useDiagram<ClassModel>();
  const docId = useDocuments((s) => s.currentId) ?? '';

  const items: LayoutItem[] = useMemo(
    () => [
      ...model.classes.map((c) => ({ id: c.id, parent: c.namespace ? nsKey(c.namespace) : null, ...classSize(c) })),
      ...model.notes.map((n, i) => ({ id: noteKey(i), ...estimateNoteSize(n.text) })),
      ...model.namespaces.map((ns) => ({ id: nsKey(ns), isGroup: true, width: 0, height: 0 })),
    ],
    [model],
  );
  const links = useMemo(
    () => [
      ...model.relations.map((r) => ({ source: r.from, target: r.to })),
      ...model.notes.flatMap((n, i) => (n.target ? [{ source: noteKey(i), target: n.target }] : [])),
    ],
    [model],
  );
  const toCid = (key: string) =>
    key.startsWith('note:') ? key : key.startsWith('ns:') ? key : classIds.cls(key);
  const { positions, layout, onMove, relayout, spotFor } = useGraphLayout(items, links, toRankDir(model.direction), toCid, 1.6);

  const { nodes, edges } = useMemo(() => {
    const groups: Node[] = model.namespaces.map((ns) => ({
      id: classIds.ns(ns),
      type: 'mmeGroup',
      position: layout[nsKey(ns)] ?? { x: 0, y: 0 },
      zIndex: -10,
      data: {
        isGroup: true,
        members: model.classes.filter((c) => c.namespace === ns).map((c) => classIds.cls(c.id)),
        title: ns,
      },
    }));
    const classes: Node[] = model.classes.map((c) => {
      const members = c.members.map(formatMember);
      return {
        id: classIds.cls(c.id),
        type: 'umlClass',
        position: positions[c.id] ?? { x: 0, y: 0 },
        data: {
          name: (c.label ?? c.id) + (c.generic ? `<${c.generic.replace(/~([^~]*)~/g, '<$1>')}>` : ''),
          annotations: c.annotations,
          attributes: members.filter((_, i) => !isMethod(c.members[i])),
          methods: members.filter((_, i) => isMethod(c.members[i])),
          visual: visualStyle(...classStyles(model.classDefs, c.cssClasses), c.style),
          boundary: 'rect',
        },
      };
    });
    const notes: Node[] = model.notes.map((n, i) => ({
      id: classIds.note(i),
      type: 'note',
      position: positions[noteKey(i)] ?? { x: 0, y: 0 },
      data: { text: n.text.replace(/\\n/g, '\n'), boundary: 'rect' },
    }));
    const rels: Edge<FloatingEdgeData>[] = model.relations.map((r, i) => ({
      id: classIds.rel(i),
      source: classIds.cls(r.from),
      target: classIds.cls(r.to),
      type: 'floating',
      data: {
        label: r.label ?? '',
        line: r.line === 'dashed' ? 'dashed' : 'solid',
        markerStart: MARKER[r.fromMarker],
        markerEnd: MARKER[r.toMarker],
        startLabel: r.fromCard ?? undefined,
        endLabel: r.toCard ?? undefined,
        editable: true,
      },
    }));
    const noteLinks: Edge<FloatingEdgeData>[] = model.notes.flatMap((n, i) =>
      n.target
        ? [
            {
              id: classIds.noteLink(i),
              source: classIds.note(i),
              target: classIds.cls(n.target),
              type: 'floating',
              selectable: false,
              deletable: false,
              data: { line: 'dotted' },
            },
          ]
        : [],
    );
    return { nodes: [...groups, ...classes, ...notes], edges: [...assignBends(rels), ...noteLinks] };
  }, [model, positions, layout]);

  const keyOf = (cid: string): string | null => {
    const p = classIds.parse(cid);
    if (p.kind === 'class') return p.id;
    if (p.kind === 'note') return noteKey(Number(p.id));
    if (p.kind === 'namespace') return nsKey(p.id);
    return null;
  };

  const addAt = (payload: string, pos: Pos, free: boolean) => {
    if (payload === 'class') {
      const res = addClass(model, t('class.newClass'));
      const size = classSize(emptyClass(res.id));
      apply(res.model, { ...layout, [res.id]: spotFor(pos, size.width, size.height, free) });
      useSelection.getState().set([classIds.cls(res.id)]);
      setTimeout(() => startEditing(classIds.cls(res.id)), 60);
    } else if (payload === 'note') {
      const i = model.notes.length;
      apply({ ...model, notes: [...model.notes, { target: null, text: t('class.note') }] }, { ...layout, [noteKey(i)]: spotFor(pos, 120, 40, free) });
      useSelection.getState().set([classIds.note(i)]);
      setTimeout(() => startEditing(classIds.note(i)), 60);
    } else if (payload === 'namespace') {
      const res = addNamespace(model, t('class.namespace').replace(/\W/g, '') || 'Namespace');
      apply(res.model, { ...layout, [nsKey(res.name)]: spotFor(pos, 200, 110, free) });
    }
  };

  const renameLayoutKey = (l: Layout, from: string, to: string): Layout => {
    if (!l[from]) return l;
    const { [from]: p, ...rest } = l;
    return { ...rest, [to]: p };
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
            { payload: 'class', title: t('class.addClass'), icon: <Box size={16} /> },
            { payload: 'note', title: t('class.addNote'), icon: <StickyNote size={16} /> },
            { payload: 'namespace', title: t('class.namespace'), icon: <FolderOpen size={16} />, separatorBefore: true },
          ]}
        />
      }
      onMove={(moved) => onMove(moved, keyOf)}
      onConnect={(s, tg) => {
        const a = classIds.parse(s);
        const b = classIds.parse(tg);
        if (a.kind === 'class' && b.kind === 'class') apply(addRelation(model, a.id, b.id));
        else if (a.kind === 'note' && b.kind === 'class') {
          apply({ ...model, notes: model.notes.map((n, i) => (i === Number(a.id) ? { ...n, target: b.id } : n)) });
        } else if (b.kind === 'note' && a.kind === 'class') {
          apply({ ...model, notes: model.notes.map((n, i) => (i === Number(b.id) ? { ...n, target: a.id } : n)) });
        }
      }}
      onConnectToEmpty={(s, pos) => {
        const from = classIds.parse(s);
        if (from.kind !== 'class') return;
        const res = addClass(model, t('class.newClass'));
        apply(addRelation(res.model, from.id, res.id), { ...layout, [res.id]: { x: Math.round(pos.x - 60), y: Math.round(pos.y - 25) } });
        useSelection.getState().set([classIds.cls(res.id)]);
        setTimeout(() => startEditing(classIds.cls(res.id)), 60);
      }}
      onDelete={(nodeIds, edgeIds) => {
        const parsed = [...nodeIds, ...edgeIds].map(classIds.parse);
        apply(
          deleteClassItems(
            model,
            parsed.filter((p) => p.kind === 'class').map((p) => p.id),
            parsed.filter((p) => p.kind === 'relation').map((p) => Number(p.id)),
            parsed.filter((p) => p.kind === 'note').map((p) => Number(p.id)),
            parsed.filter((p) => p.kind === 'namespace').map((p) => p.id),
          ),
        );
        useSelection.getState().clear();
      }}
      onReparent={(ids, group) => {
        const cls = ids.map(classIds.parse).filter((p) => p.kind === 'class').map((p) => p.id);
        if (cls.length) apply(setNamespace(model, cls, group ? classIds.parse(group).id : null));
      }}
      onDropItem={(payload, pos) => addAt(payload, pos, false)}
      onDuplicate={(ids) => {
        const cls = ids.map(classIds.parse).filter((p) => p.kind === 'class').map((p) => p.id);
        const { model: next, mapping } = duplicateClasses(model, cls);
        const l = { ...layout };
        for (const [from, to] of mapping) if (positions[from]) l[to] = { x: positions[from].x + 40, y: positions[from].y + 40 };
        apply(next, l);
        useSelection.getState().set([...mapping.values()].map(classIds.cls));
      }}
      onCommitText={(cid, text) => {
        const p = classIds.parse(cid);
        const value = text.trim();
        if (p.kind === 'class') {
          const c = model.classes.find((x) => x.id === p.id);
          if (!c || !value) return;
          if (CLASS_ID_RE.test(value) && !classTaken(model, value)) {
            apply(updateClass(renameClass(model, p.id, value), value, { label: null }), renameLayoutKey(layout, p.id, value));
            useSelection.getState().set([classIds.cls(value)]);
          } else if (value !== c.id) apply(updateClass(model, p.id, { label: value }));
        } else if (p.kind === 'note') {
          const i = Number(p.id);
          apply({ ...model, notes: model.notes.map((n, k) => (k === i ? { ...n, text: text.replace(/\n/g, '\\n').replace(/"/g, "'") } : n)) });
        } else if (p.kind === 'relation') {
          apply(updateRelation(model, Number(p.id), { label: value || null }));
        } else if (p.kind === 'namespace' && /^[\w.]+$/.test(value)) {
          apply(renameNamespace(model, p.id, value), renameLayoutKey(layout, nsKey(p.id), nsKey(value)));
        }
      }}
      onAutoLayout={relayout}
    />
  );
}

function estimateNoteSize(text: string) {
  const t = estimateText(text.replace(/\\n/g, '\n'));
  return { width: Math.max(90, t.w + 24), height: t.h + 20 };
}
