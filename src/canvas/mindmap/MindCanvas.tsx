import {
  BaseEdge,
  getBezierPath,
  Position,
  useInternalNode,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import { CornerDownRight, ListPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { mindDisplayText, walkMind, type MindModel, type MindShape } from '../../diagrams/mindmap/model';
import { addChild, addSibling, deleteMind, duplicateMind, findMind, keyAfterReparse, moveMind, setMindText } from '../../diagrams/mindmap/ops';
import { useDiagram } from '../../hooks/useDiagram';
import { useT } from '../../i18n';
import { useDocuments } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { toast } from '../../ui/toast';
import { EditableText, NodeHandles, startEditing } from '../graph/context';
import { containsPoint } from '../graph/geometry';
import { GraphCanvas } from '../graph/GraphCanvas';
import { Palette } from '../graph/Palette';
import { layoutMind } from './mindLayout';

const BRANCH_COLORS = ['#7c6cf2', '#e0567f', '#ef8f2f', '#2f9e6e', '#2d8fd5', '#c55bd6', '#d4a72c', '#4aa3a2'];
const branchColor = (branch: number) => (branch < 0 ? 'var(--accent)' : BRANCH_COLORS[branch % BRANCH_COLORS.length]);

interface MindData extends Record<string, unknown> {
  text: string;
  shape: MindShape;
  icon: string | null;
  color: string;
  root: boolean;
  boundary: 'rect';
}

const CLIP: Partial<Record<MindShape, string>> = {
  hexagon: 'polygon(14% 0, 86% 0, 100% 50%, 86% 100%, 14% 100%, 0 50%)',
  bang: 'polygon(0 18%, 14% 22%, 18% 0, 34% 14%, 50% 0, 62% 16%, 80% 2%, 84% 22%, 100% 20%, 92% 42%, 100% 60%, 86% 72%, 92% 96%, 70% 86%, 54% 100%, 40% 86%, 20% 98%, 16% 78%, 0 76%, 8% 54%, 0 36%, 10% 30%)',
};

function MindNodeView({ id, data, selected }: NodeProps<Node<MindData, 'mind'>>) {
  const c = data.color;
  const filled = data.root || data.shape !== 'default';
  const radius =
    data.shape === 'circle' ? '50%' : data.shape === 'rounded' ? 14 : data.shape === 'cloud' ? '45% 55% 50% 50% / 60% 55% 45% 40%' : data.shape === 'square' ? 3 : 8;
  return (
    <div
      className={`mind-node${selected ? ' selected' : ''}${data.root ? ' root' : ''}`}
      style={{
        borderRadius: radius,
        clipPath: CLIP[data.shape],
        background: data.root ? c : filled ? `color-mix(in srgb, ${c} 16%, var(--panel))` : 'transparent',
        border: filled && !CLIP[data.shape] ? `1.5px solid ${c}` : undefined,
        borderBottom: filled ? undefined : `2.5px solid ${c}`,
        color: data.root ? '#fff' : 'var(--text)',
        aspectRatio: data.shape === 'circle' ? '1' : undefined,
        padding: data.shape === 'hexagon' ? '8px 24px' : data.shape === 'bang' || data.shape === 'cloud' ? '12px 22px' : undefined,
      }}
    >
      <NodeHandles />
      {data.icon && <div className="mind-icon">{data.icon}</div>}
      <EditableText id={id} text={data.text} />
    </div>
  );
}

function MindEdge({ id, source, target, data }: EdgeProps<Edge<{ color: string; depth: number }, 'mindLink'>>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t) return null;
  const sx = s.internals.positionAbsolute.x;
  const sw = s.measured.width ?? 80;
  const sy = s.internals.positionAbsolute.y + (s.measured.height ?? 30) / 2;
  const tx = t.internals.positionAbsolute.x;
  const tw = t.measured.width ?? 80;
  const ty = t.internals.positionAbsolute.y + (t.measured.height ?? 30) / 2;
  const right = tx >= sx + sw / 2;
  const [path] = getBezierPath({
    sourceX: right ? sx + sw : sx,
    sourceY: sy,
    sourcePosition: right ? Position.Right : Position.Left,
    targetX: right ? tx : tx + tw,
    targetY: ty,
    targetPosition: right ? Position.Left : Position.Right,
  });
  return <BaseEdge id={id} path={path} style={{ stroke: data?.color, strokeWidth: Math.max(1.4, 4 - (data?.depth ?? 1)) }} />;
}

const NODE_TYPES: NodeTypes = { mind: MindNodeView };
const EDGE_TYPES = { mindLink: MindEdge };

export function MindCanvas() {
  const t = useT();
  const { model, apply } = useDiagram<MindModel>();
  const docId = useDocuments((s) => s.currentId) ?? '';
  const [version, setVersion] = useState(0);
  const placement = useMemo(() => layoutMind(model.root), [model.root]);

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    walkMind(model.root, (n, parent, depth) => {
      const p = placement.get(n.key)!;
      nodes.push({
        id: n.key,
        type: 'mind',
        position: { x: p.x, y: p.y },
        data: { text: mindDisplayText(n), shape: n.shape, icon: n.icon, color: branchColor(p.branch), root: depth === 0, boundary: 'rect', version },
      });
      if (parent) {
        edges.push({
          id: `${parent.key}->${n.key}`,
          source: parent.key,
          target: n.key,
          type: 'mindLink',
          selectable: false,
          deletable: false,
          data: { color: branchColor(p.branch), depth },
        });
      }
    });
    return { nodes, edges };
  }, [model.root, placement, version]);

  const select = (next: MindModel, key: string, edit: boolean) => {
    const k = keyAfterReparse(next, key);
    apply(next);
    useSelection.getState().set([k]);
    if (edit) setTimeout(() => startEditing(k), 80);
  };

  const addChildTo = (key: string | undefined) => {
    const target = key ?? model.root?.key;
    if (!target) return;
    const res = addChild(model, target, t('mind.newIdea'));
    select(res.model, res.key, true);
  };
  const addSiblingOf = (key: string | undefined) => {
    if (!key) return addChildTo(undefined);
    const res = addSibling(model, key, t('mind.newIdea'));
    select(res.model, res.key, true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, .cm-editor, .dialog')) return;
      const ids = useSelection.getState().ids;
      if (ids.length !== 1) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        addChildTo(ids[0]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        addSiblingOf(ids[0]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const selected = useSelection((s) => s.ids);

  return (
    <GraphCanvas
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      fitKey={docId}
      palette={
        <Palette
          onAdd={(payload) => (payload === 'child' ? addChildTo(selected[0]) : addSiblingOf(selected[0]))}
          items={[
            { payload: 'child', title: `${t('mind.addChild')} (Tab)`, icon: <CornerDownRight size={16} /> },
            { payload: 'sibling', title: `${t('mind.addSibling')} (↵)`, icon: <ListPlus size={16} /> },
          ]}
        />
      }
      onMove={(moved) => {
        setVersion((v) => v + 1);
        const [key, pos] = Object.entries(moved)[0] ?? [];
        if (!key || !pos) return;
        const self = placement.get(key);
        if (!self) return;
        const center = { x: pos.x + self.w / 2, y: pos.y + self.h / 2 };
        const loc = findMind(model.root, key);
        if (!loc) return;
        let target: string | null = null;
        for (const [k, p] of placement) {
          if (k === key || findMind(loc.node, k)) continue;
          if (containsPoint({ x: p.x - 8, y: p.y - 8, w: p.w + 16, h: p.h + 16 }, center)) target = k;
        }
        if (target && target !== loc.parent?.key) apply(moveMind(model, key, target));
      }}
      onConnectToEmpty={(source) => addChildTo(source)}
      onDelete={(nodeIds) => {
        if (model.root && nodeIds.includes(model.root.key)) toast(t('mind.rootRequired'), 'error');
        apply(deleteMind(model, nodeIds));
        useSelection.getState().clear();
      }}
      onDuplicate={(ids) => {
        if (!ids[0]) return;
        const res = duplicateMind(model, ids[0]);
        select(res.model, res.key, false);
      }}
      onCommitText={(key, text) => text.trim() && apply(setMindText(model, key, text))}
    />
  );
}
