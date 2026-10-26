import type { Edge, Node, NodeProps, NodeTypes } from '@xyflow/react';
import { Table } from 'lucide-react';
import { useMemo } from 'react';
import type { ErAttribute, ErCard, ErModel } from '../../diagrams/er/model';
import {
  addEntity,
  addErRelation,
  deleteErItems,
  duplicateEntities,
  ENTITY_ID_RE,
  entityTaken,
  renameEntity,
  updateEntity,
  updateErRelation,
} from '../../diagrams/er/ops';
import { classStyles, textColorFor, visualStyle, type VisualStyle } from '../../diagrams/style';
import { useDiagram } from '../../hooks/useDiagram';
import { useT } from '../../i18n';
import { useDocuments, type Layout, type Pos } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { EditableText, NodeHandles, startEditing } from '../graph/context';
import { assignBends, type FloatingEdgeData } from '../graph/FloatingEdge';
import { estimateText } from '../graph/geometry';
import { GraphCanvas } from '../graph/GraphCanvas';
import { toRankDir, type LayoutItem } from '../graph/layout';
import type { MarkerName } from '../graph/markers';
import { Palette } from '../graph/Palette';
import { useGraphLayout } from '../graph/useGraphLayout';
import { erIds } from './ids';

interface EntityData extends Record<string, unknown> {
  name: string;
  attributes: ErAttribute[];
  visual: VisualStyle;
  boundary: 'rect';
}

function EntityNode({ id, data, selected }: NodeProps<Node<EntityData, 'entity'>>) {
  const v = data.visual;
  return (
    <div className={`er-entity${selected ? ' selected' : ''}`} style={{ background: v.fill, borderColor: selected ? undefined : v.stroke, color: textColorFor(v) }}>
      <NodeHandles />
      <div className="er-head">
        <EditableText id={id} text={data.name} multiline={false} />
      </div>
      {data.attributes.length > 0 && (
        <table className="er-table">
          <tbody>
            {data.attributes.map((a, i) => (
              <tr key={i}>
                <td className="er-type">{a.type}</td>
                <td className="er-name">{a.name}</td>
                <td className="er-keys">{a.keys.join(', ')}</td>
                {data.attributes.some((x) => x.comment) && <td className="er-comment">{a.comment ?? ''}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const NODE_TYPES: NodeTypes = { entity: EntityNode };

const CARD_MARKER: Record<ErCard, MarkerName> = {
  'exactly-one': 'er-one',
  'zero-one': 'er-zero-one',
  'one-many': 'er-one-many',
  'zero-many': 'er-zero-many',
};

function entitySize(e: ErModel['entities'][number]): { width: number; height: number } {
  const rows = e.attributes.map((a) => [a.type, a.name, a.keys.join(','), a.comment ?? ''].join('   '));
  const t = estimateText([e.alias ?? e.id, ...rows].join('\n'), 7, 22);
  return { width: Math.max(120, t.w + 30), height: t.h + 18 };
}

export function ErCanvas() {
  const t = useT();
  const { model, apply } = useDiagram<ErModel>();
  const docId = useDocuments((s) => s.currentId) ?? '';
  const items: LayoutItem[] = useMemo(() => model.entities.map((e) => ({ id: e.id, ...entitySize(e) })), [model.entities]);
  const links = useMemo(() => model.relations.map((r) => ({ source: r.from, target: r.to })), [model.relations]);
  const { positions, layout, onMove, relayout, spotFor } = useGraphLayout(items, links, toRankDir(model.direction), erIds.entity, 1.6);

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = model.entities.map((e) => ({
      id: erIds.entity(e.id),
      type: 'entity',
      position: positions[e.id] ?? { x: 0, y: 0 },
      data: {
        name: e.alias ?? e.id,
        attributes: e.attributes,
        visual: visualStyle(...classStyles(model.classDefs, e.cssClasses), e.style),
        boundary: 'rect',
      },
    }));
    const edges: Edge<FloatingEdgeData>[] = model.relations.map((r, i) => ({
      id: erIds.rel(i),
      source: erIds.entity(r.from),
      target: erIds.entity(r.to),
      type: 'floating',
      data: {
        label: r.label,
        line: r.identifying ? 'solid' : 'dashed',
        markerStart: CARD_MARKER[r.fromCard],
        markerEnd: CARD_MARKER[r.toCard],
        editable: true,
      },
    }));
    return { nodes, edges: assignBends(edges) };
  }, [model, positions]);

  const renameKey = (l: Layout, from: string, to: string): Layout => {
    if (!l[from]) return l;
    const { [from]: p, ...rest } = l;
    return { ...rest, [to]: p };
  };

  const addAt = (_payload: string, pos: Pos, free: boolean) => {
    const res = addEntity(model, t('er.newEntity'), [{ type: 'int', name: 'id', keys: ['PK'], comment: null }]);
    apply(res.model, { ...layout, [res.id]: spotFor(pos, 130, 70, free) });
    useSelection.getState().set([erIds.entity(res.id)]);
    setTimeout(() => startEditing(erIds.entity(res.id)), 60);
  };

  return (
    <GraphCanvas
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      fitKey={docId}
      palette={<Palette onAdd={addAt} items={[{ payload: 'entity', title: t('er.addEntity'), icon: <Table size={16} /> }]} />}
      onMove={(moved) => onMove(moved, (cid) => erIds.parse(cid).id)}
      onConnect={(s, tg) => apply(addErRelation(model, erIds.parse(s).id, erIds.parse(tg).id, t('er.newRelation')))}
      onConnectToEmpty={(s, pos) => {
        const res = addEntity(model, t('er.newEntity'), [{ type: 'int', name: 'id', keys: ['PK'], comment: null }]);
        apply(addErRelation(res.model, erIds.parse(s).id, res.id, t('er.newRelation')), {
          ...layout,
          [res.id]: { x: Math.round(pos.x - 65), y: Math.round(pos.y - 35) },
        });
        useSelection.getState().set([erIds.entity(res.id)]);
        setTimeout(() => startEditing(erIds.entity(res.id)), 60);
      }}
      onDelete={(nodeIds, edgeIds) => {
        apply(
          deleteErItems(
            model,
            nodeIds.map((n) => erIds.parse(n).id),
            edgeIds.map((e) => Number(erIds.parse(e).id)),
          ),
        );
        useSelection.getState().clear();
      }}
      onDropItem={(payload, pos) => addAt(payload, pos, false)}
      onDuplicate={(ids) => {
        const { model: next, mapping } = duplicateEntities(model, ids.map((i) => erIds.parse(i).id));
        const l = { ...layout };
        for (const [from, to] of mapping) if (positions[from]) l[to] = { x: positions[from].x + 40, y: positions[from].y + 40 };
        apply(next, l);
        useSelection.getState().set([...mapping.values()].map(erIds.entity));
      }}
      onCommitText={(cid, text) => {
        const p = erIds.parse(cid);
        const value = text.trim();
        if (!value) return;
        if (p.kind === 'relation') {
          apply(updateErRelation(model, Number(p.id), { label: value }));
          return;
        }
        if (ENTITY_ID_RE.test(value) && !entityTaken(model, value)) {
          apply(updateEntity(renameEntity(model, p.id, value), value, { alias: null }), renameKey(layout, p.id, value));
          useSelection.getState().set([erIds.entity(value)]);
        } else if (value !== p.id) apply(updateEntity(model, p.id, { alias: value }));
      }}
      onAutoLayout={relayout}
    />
  );
}
