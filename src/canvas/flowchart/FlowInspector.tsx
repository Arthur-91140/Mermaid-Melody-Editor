import { ArrowLeftRight, Group, Link2, Shapes, Square, SquareDashed } from 'lucide-react';
import { useState } from 'react';
import { displayToLabel, isMarkdownLabel, labelToDisplay } from '../../diagrams/common';
import type { FlowEdge, FlowMarker, FlowModel } from '../../diagrams/flowchart/model';
import {
  deleteItems,
  groupItems,
  isTaken,
  renameId,
  reparent,
  reverseEdge,
  setShape,
  toggleClass,
  updateEdge,
  updateNode,
  updateSubgraph,
} from '../../diagrams/flowchart/ops';
import { EXTRA_SHAPES, PALETTE_SHAPES } from '../../diagrams/flowchart/shapes';
import { setStyle } from '../../diagrams/style';
import { useDiagram } from '../../hooks/useDiagram';
import { ClassChips, classDefNames, DeleteButton, IdField, Section, StyleEditor } from '../../inspector/common';
import { tryT, useT, type TranslationKey } from '../../i18n';
import type { Layout } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { Check, ColorField, DraftInput, DraftTextarea, Field, Segmented, Select } from '../../ui/fields';
import { ShapeIcon } from './FlowShape';
import { flowIds } from './ids';

const DIRECTIONS = ['TB', 'BT', 'LR', 'RL'] as const;

function renameLayout(layout: Layout, from: string, to: string): Layout {
  if (!layout[from]) return layout;
  const { [from]: pos, ...rest } = layout;
  return { ...rest, [to]: pos };
}

function ShapePicker({ value, onPick }: { value: string; onPick: (shape: string) => void }) {
  const t = useT();
  const [more, setMore] = useState(EXTRA_SHAPES.includes(value));
  const list = more ? [...PALETTE_SHAPES, ...EXTRA_SHAPES] : PALETTE_SHAPES;
  return (
    <Field label={t('inspector.shape')}>
      <div className="shape-grid">
        {list.map((s) => (
          <button
            key={s}
            type="button"
            className={`shape-btn${s === value ? ' on' : ''}`}
            title={tryT(t, `shape.${s}`, s)}
            onClick={() => onPick(s)}
          >
            <ShapeIcon shape={s} size={14} />
          </button>
        ))}
      </div>
      {!more && (
        <button type="button" className="btn ghost small" onClick={() => setMore(true)}>
          {t('canvas.moreShapes')}
        </button>
      )}
    </Field>
  );
}

function urlOf(click: string | null): string | null {
  if (!click) return '';
  const m = /^(?:href\s+)?"([^"]*)"/.exec(click);
  return m ? m[1] : null;
}

function ParentSelect({ model, value, exclude, onChange }: { model: FlowModel; value: string | null; exclude?: string; onChange: (p: string | null) => void }) {
  const t = useT();
  if (!model.subgraphs.length) return null;
  return (
    <Field label={t('inspector.parent')}>
      <Select
        value={value ?? ''}
        onChange={(v) => onChange(v || null)}
        options={[
          { value: '', label: t('inspector.noParent') },
          ...model.subgraphs.filter((s) => s.id !== exclude).map((s) => ({ value: s.id, label: labelToDisplay(s.title ?? s.id) })),
        ]}
      />
    </Field>
  );
}

function NodePanel({ id }: { id: string }) {
  const t = useT();
  const { model, layout, apply } = useDiagram<FlowModel>();
  const n = model.nodes.find((x) => x.id === id);
  if (!n) return null;
  const markdown = isMarkdownLabel(n.label);
  const url = urlOf(n.click);
  return (
    <>
      <Section title={t('flow.node')} icon={<Square size={14} />}>
        <IdField
          value={n.id}
          isTaken={(v) => isTaken(model, v)}
          onCommit={(v) => {
            apply(renameId(model, n.id, v), renameLayout(layout, n.id, v));
            useSelection.getState().set([flowIds.node(v)]);
          }}
        />
        <Field label={t('inspector.label')}>
          <DraftTextarea
            value={labelToDisplay(n.label ?? n.id)}
            rows={2}
            onCommit={(v) => apply(updateNode(model, id, { label: v === n.id && n.label === null ? null : displayToLabel(v, markdown) }))}
          />
        </Field>
        <Check
          checked={markdown}
          label={t('inspector.markdown')}
          onChange={(on) => apply(updateNode(model, id, { label: displayToLabel(labelToDisplay(n.label ?? n.id), on) }))}
        />
        <ShapePicker value={n.shape} onPick={(s) => apply(setShape(model, id, s))} />
        <ParentSelect model={model} value={n.parent} onChange={(p) => apply(reparent(model, [id], p))} />
      </Section>
      <Section title={t('inspector.style')}>
        <StyleEditor style={n.style} onChange={(style) => apply(updateNode(model, id, { style }))} />
        <ClassChips
          available={classDefNames(model.classDefs)}
          active={n.classes}
          onToggle={(c) => apply(toggleClass(model, id, c))}
        />
      </Section>
      <Section title={t('inspector.link')} icon={<Link2 size={14} />}>
        {url !== null ? (
          <DraftInput
            value={url}
            placeholder="https://…"
            onCommit={(v) => apply(updateNode(model, id, { click: v.trim() ? `href "${v.trim()}"` : null }))}
          />
        ) : (
          <DraftInput mono value={n.click ?? ''} onCommit={(v) => apply(updateNode(model, id, { click: v.trim() || null }))} />
        )}
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteItems(model, [id], [], []));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function EdgePanel({ index }: { index: number }) {
  const t = useT();
  const { model, apply } = useDiagram<FlowModel>();
  const e = model.edges[index];
  if (!e) return null;
  const set = (patch: Partial<FlowEdge>) => apply(updateEdge(model, index, patch));
  const ends = e.head === 'none' ? 'none' : e.tail === 'none' ? 'end' : 'both';
  const marker: FlowMarker = e.head === 'none' ? 'arrow' : e.head;
  const targets = [
    ...model.nodes.map((n) => ({ value: n.id, label: `${n.id} — ${labelToDisplay(n.label ?? n.id).split('\n')[0]}` })),
    ...model.subgraphs.map((s) => ({ value: s.id, label: `${s.id} — ${labelToDisplay(s.title ?? s.id)}` })),
  ];
  return (
    <>
      <Section title={t('flow.edge')} icon={<ArrowLeftRight size={14} />}>
        <div className="field-row">
          <Field label={t('inspector.from')}>
            <Select value={e.from} options={targets} onChange={(v) => set({ from: v })} />
          </Field>
          <Field label={t('inspector.to')}>
            <Select value={e.to} options={targets} onChange={(v) => set({ to: v })} />
          </Field>
        </div>
        <Field label={t('inspector.label')}>
          <DraftInput
            value={e.label ? labelToDisplay(e.label) : ''}
            onCommit={(v) => set({ label: v.trim() ? displayToLabel(v, isMarkdownLabel(e.label)) : null })}
          />
        </Field>
        <Field label={t('inspector.line')}>
          <Segmented
            value={e.line}
            onChange={(line) => set({ line })}
            options={(['solid', 'dotted', 'thick', 'invisible'] as const).map((l) => ({ value: l, label: t(`inspector.line.${l}`) }))}
          />
        </Field>
        <Field label={t('inspector.arrow')}>
          <Segmented
            value={ends}
            onChange={(v) =>
              set(v === 'none' ? { head: 'none', tail: 'none' } : v === 'end' ? { head: marker, tail: 'none' } : { head: marker, tail: marker })
            }
            options={(['none', 'end', 'both'] as const).map((v) => ({ value: v, label: t(`inspector.arrow.${v}`) }))}
          />
        </Field>
        {ends !== 'none' && (
          <Field label={t('inspector.marker')}>
            <Segmented
              value={marker}
              onChange={(m) => set({ head: m, tail: ends === 'both' ? m : 'none' })}
              options={(['arrow', 'circle', 'cross'] as const).map((m) => ({ value: m, label: t(`inspector.marker.${m}`) }))}
            />
          </Field>
        )}
        <Field label={t('inspector.length')}>
          <Segmented
            value={String(e.length)}
            onChange={(v) => set({ length: Number(v) })}
            options={['1', '2', '3', '4'].map((v) => ({ value: v, label: v }))}
          />
        </Field>
        <button type="button" className="btn small" onClick={() => apply(reverseEdge(model, index))}>
          <ArrowLeftRight size={14} />
          {t('inspector.reverse')}
        </button>
      </Section>
      <Section title={t('inspector.style')}>
        <StyleEditor style={e.style} keys={['stroke', 'color', 'stroke-width', 'stroke-dasharray']} onChange={(style) => set({ style })} />
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteItems(model, [], [], [index]));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function GroupPanel({ id }: { id: string }) {
  const t = useT();
  const { model, layout, apply } = useDiagram<FlowModel>();
  const sg = model.subgraphs.find((s) => s.id === id);
  if (!sg) return null;
  return (
    <>
      <Section title={t('flow.subgraph')} icon={<SquareDashed size={14} />}>
        {!sg.implicitId && (
          <IdField
            value={sg.id}
            isTaken={(v) => isTaken(model, v)}
            onCommit={(v) => {
              apply(renameId(model, sg.id, v), renameLayout(layout, sg.id, v));
              useSelection.getState().set([flowIds.group(v)]);
            }}
          />
        )}
        <Field label={t('inspector.title.field')}>
          <DraftInput
            value={labelToDisplay(sg.title ?? sg.id)}
            onCommit={(v) => apply(updateSubgraph(model, id, { title: v.trim() ? displayToLabel(v) : null }))}
          />
        </Field>
        <Field label={t('inspector.direction')}>
          <Select
            value={sg.direction ?? ''}
            onChange={(v) => apply(updateSubgraph(model, id, { direction: v || null }))}
            options={[{ value: '', label: t('common.default') }, ...DIRECTIONS.map((d) => ({ value: d, label: t(`dir.${d}` as TranslationKey) }))]}
          />
        </Field>
        <ParentSelect model={model} value={sg.parent} exclude={id} onChange={(p) => apply(reparent(model, [id], p))} />
      </Section>
      <Section title={t('inspector.style')}>
        <StyleEditor style={sg.style} keys={['fill', 'stroke', 'color', 'stroke-width', 'stroke-dasharray']} onChange={(style) => apply(updateSubgraph(model, id, { style }))} />
        <ClassChips available={classDefNames(model.classDefs)} active={sg.classes} onToggle={(c) => apply(toggleClass(model, id, c))} />
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteItems(model, [], [id], []));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function MultiPanel({ ids }: { ids: string[] }) {
  const t = useT();
  const { model, apply } = useDiagram<FlowModel>();
  const parsed = ids.map(flowIds.parse);
  const nodeIds = parsed.filter((p) => p.kind === 'node').map((p) => p.id);
  const groupIds = parsed.filter((p) => p.kind === 'group').map((p) => p.id);
  const edgeIdx = parsed.filter((p) => p.kind === 'edge').map((p) => Number(p.id));
  return (
    <>
      <Section title={t('inspector.multi', { count: ids.length })} icon={<Shapes size={14} />}>
        {nodeIds.length + groupIds.length > 0 && (
          <button
            type="button"
            className="btn small"
            onClick={() => {
              const res = groupItems(model, [...nodeIds, ...groupIds], t('flow.newSubgraph'));
              apply(res.model);
              useSelection.getState().set([flowIds.group(res.id)]);
            }}
          >
            <Group size={14} />
            {t('flow.addSubgraph')}
          </button>
        )}
      </Section>
      {nodeIds.length > 0 && (
        <Section title={t('inspector.shape')}>
          <ShapePicker
            value=""
            onPick={(s) => apply(nodeIds.reduce((m, id) => setShape(m, id, s), model))}
          />
          <div className="field-row">
            {(['fill', 'stroke'] as const).map((key) => (
              <Field key={key} label={t(key === 'fill' ? 'inspector.fill' : 'inspector.stroke')}>
                <ColorField
                  value=""
                  onCommit={(v) =>
                    apply(
                      nodeIds.reduce(
                        (m, id) => updateNode(m, id, { style: setStyle(m.nodes.find((x) => x.id === id)?.style, key, v || null) }),
                        model,
                      ),
                    )
                  }
                />
              </Field>
            ))}
          </div>
        </Section>
      )}
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteItems(model, nodeIds, groupIds, edgeIdx));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function ClassDefsEditor() {
  const t = useT();
  const { model, apply } = useDiagram<FlowModel>();
  const set = (i: number, patch: Partial<{ names: string; style: string }>) =>
    apply({ ...model, classDefs: model.classDefs.map((cd, k) => (k === i ? { ...cd, ...patch } : cd)) });
  return (
    <div className="list-editor">
      {model.classDefs.map((cd, i) => (
        <div key={i} className="list-row">
          <div style={{ width: 90, flex: 'none' }}>
            <DraftInput mono value={cd.names} onCommit={(v) => v.trim() && set(i, { names: v.trim() })} />
          </div>
          <DraftInput mono value={cd.style} onCommit={(v) => set(i, { style: v.trim() })} />
          <button
            type="button"
            className="icon-btn small"
            title={t('common.remove')}
            onClick={() => apply({ ...model, classDefs: model.classDefs.filter((_, k) => k !== i) })}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn ghost small"
        onClick={() => {
          let n = model.classDefs.length + 1;
          const names = new Set(classDefNames(model.classDefs));
          while (names.has(`style${n}`)) n++;
          apply({ ...model, classDefs: [...model.classDefs, { names: `style${n}`, style: 'fill:#fde68a,stroke:#d97706' }] });
        }}
      >
        + classDef
      </button>
    </div>
  );
}

function DiagramPanel() {
  const t = useT();
  const { model, apply } = useDiagram<FlowModel>();
  const dir = (DIRECTIONS as readonly string[]).includes(model.direction) ? model.direction : model.direction === 'TD' || !model.direction ? 'TB' : model.direction;
  return (
    <>
      <Section title={t('inspector.diagram')}>
        <p className="field-hint" style={{ marginTop: 0 }}>
          {t('canvas.hintConnect')}
        </p>
        <Field label={t('canvas.direction')}>
          <Segmented
            value={dir}
            onChange={(d) => apply({ ...model, direction: d })}
            options={DIRECTIONS.map((d) => ({ value: d, label: d, title: t(`dir.${d}` as TranslationKey) }))}
          />
        </Field>
        <p className="field-hint">
          {model.nodes.length} × {t('flow.node').toLowerCase()} · {model.edges.length} × {t('flow.edge').toLowerCase()}
        </p>
      </Section>
      <Section title="classDef">
        <ClassDefsEditor />
      </Section>
    </>
  );
}

export function FlowInspector() {
  const ids = useSelection((s) => s.ids);
  if (!ids.length) return <DiagramPanel />;
  if (ids.length > 1) return <MultiPanel ids={ids} />;
  const p = flowIds.parse(ids[0]);
  if (p.kind === 'edge') return <EdgePanel key={ids[0]} index={Number(p.id)} />;
  if (p.kind === 'group') return <GroupPanel key={ids[0]} id={p.id} />;
  return <NodePanel key={ids[0]} id={p.id} />;
}
