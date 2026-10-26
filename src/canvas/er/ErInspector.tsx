import { ArrowLeftRight, Plus, Table, Workflow, X } from 'lucide-react';
import { ER_CARDS, type ErAttribute, type ErModel, type ErRelation } from '../../diagrams/er/model';
import {
  deleteErItems,
  ENTITY_ID_RE,
  entityTaken,
  renameEntity,
  reverseErRelation,
  updateEntity,
  updateErRelation,
} from '../../diagrams/er/ops';
import { useDiagram } from '../../hooks/useDiagram';
import { useT, type TranslationKey } from '../../i18n';
import { ClassChips, classDefNames, ClassDefsEditor, DeleteButton, IdField, Section, StyleEditor } from '../../inspector/common';
import type { Layout } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { Check, DraftInput, Field, Segmented, Select } from '../../ui/fields';
import { erIds } from './ids';

const KEYS = ['PK', 'FK', 'UK'];

function renameKey(l: Layout, from: string, to: string): Layout {
  if (!l[from]) return l;
  const { [from]: p, ...rest } = l;
  return { ...rest, [to]: p };
}

function AttributesEditor({ attributes, onChange }: { attributes: ErAttribute[]; onChange: (a: ErAttribute[]) => void }) {
  const t = useT();
  const set = (i: number, patch: Partial<ErAttribute>) => onChange(attributes.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  return (
    <div className="list-editor">
      {attributes.map((a, i) => (
        <div key={i} className="er-attr-row">
          <div className="list-row">
            <div style={{ width: 84, flex: 'none' }}>
              <DraftInput mono value={a.type} placeholder={t('er.attrType')} onCommit={(v) => v.trim() && set(i, { type: v.trim().replace(/\s+/g, '_') })} />
            </div>
            <DraftInput mono value={a.name} placeholder={t('er.attrName')} onCommit={(v) => v.trim() && set(i, { name: v.trim().replace(/\s+/g, '_') })} />
            <button type="button" className="icon-btn small" title={t('common.remove')} onClick={() => onChange(attributes.filter((_, k) => k !== i))}>
              <X size={14} />
            </button>
          </div>
          <div className="list-row">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className={`chip${a.keys.includes(k) ? ' on' : ''}`}
                onClick={() => set(i, { keys: a.keys.includes(k) ? a.keys.filter((x) => x !== k) : KEYS.filter((x) => x === k || a.keys.includes(x)) })}
              >
                {k}
              </button>
            ))}
            <DraftInput value={a.comment ?? ''} placeholder={t('er.attrComment')} onCommit={(v) => set(i, { comment: v.trim() ? v.replace(/"/g, "'") : null })} />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn ghost small"
        onClick={() => onChange([...attributes, { type: 'string', name: `field${attributes.length + 1}`, keys: [], comment: null }])}
      >
        <Plus size={14} />
        {t('er.addAttribute')}
      </button>
    </div>
  );
}

function EntityPanel({ id }: { id: string }) {
  const t = useT();
  const { model, layout, apply } = useDiagram<ErModel>();
  const e = model.entities.find((x) => x.id === id);
  if (!e) return null;
  return (
    <>
      <Section title={t('er.entity')} icon={<Table size={14} />}>
        <IdField
          value={e.id}
          pattern={ENTITY_ID_RE}
          isTaken={(v) => entityTaken(model, v)}
          onCommit={(v) => {
            apply(renameEntity(model, e.id, v), renameKey(layout, e.id, v));
            useSelection.getState().set([erIds.entity(v)]);
          }}
        />
        <Field label={t('er.alias')}>
          <DraftInput value={e.alias ?? ''} placeholder={e.id} onCommit={(v) => apply(updateEntity(model, id, { alias: v.trim() ? v.replace(/"/g, "'") : null }))} />
        </Field>
      </Section>
      <Section title={t('er.attributes')}>
        <AttributesEditor attributes={e.attributes} onChange={(attributes) => apply(updateEntity(model, id, { attributes }))} />
      </Section>
      <Section title={t('inspector.style')}>
        <StyleEditor style={e.style} keys={['fill', 'stroke', 'color']} onChange={(style) => apply(updateEntity(model, id, { style }))} />
        <ClassChips
          available={classDefNames(model.classDefs)}
          active={e.cssClasses}
          onToggle={(c) => apply(updateEntity(model, id, { cssClasses: e.cssClasses.includes(c) ? e.cssClasses.filter((x) => x !== c) : [...e.cssClasses, c] }))}
        />
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteErItems(model, [id], []));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function RelationPanel({ index }: { index: number }) {
  const t = useT();
  const { model, apply } = useDiagram<ErModel>();
  const r = model.relations[index];
  if (!r) return null;
  const set = (patch: Partial<ErRelation>) => apply(updateErRelation(model, index, patch));
  const entities = model.entities.map((e) => ({ value: e.id, label: e.alias ?? e.id }));
  const cards = ER_CARDS.map((c) => ({ value: c, label: t(`er.card.${c}` as TranslationKey) }));
  return (
    <>
      <Section title={t('er.relation')} icon={<Workflow size={14} />}>
        <div className="field-row">
          <Field label={t('inspector.from')}>
            <Select value={r.from} options={entities} onChange={(v) => set({ from: v })} />
          </Field>
          <Field label={t('inspector.to')}>
            <Select value={r.to} options={entities} onChange={(v) => set({ to: v })} />
          </Field>
        </div>
        <Field label={t('inspector.label')}>
          <DraftInput value={r.label} onCommit={(v) => v.trim() && set({ label: v.trim() })} />
        </Field>
        <Field label={t('er.fromCard')}>
          <Select value={r.fromCard} options={cards} onChange={(v) => set({ fromCard: v })} />
        </Field>
        <Field label={t('er.toCard')}>
          <Select value={r.toCard} options={cards} onChange={(v) => set({ toCard: v })} />
        </Field>
        <Check checked={r.identifying} onChange={(identifying) => set({ identifying })} label={t('er.identifying')} />
        <button type="button" className="btn small" style={{ marginTop: 8 }} onClick={() => apply(reverseErRelation(model, index))}>
          <ArrowLeftRight size={14} />
          {t('inspector.reverse')}
        </button>
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteErItems(model, [], [index]));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function DiagramPanel() {
  const t = useT();
  const { model, apply } = useDiagram<ErModel>();
  return (
    <>
      <Section title={t('inspector.diagram')}>
        <p className="field-hint" style={{ marginTop: 0 }}>
          {t('canvas.hintConnect')}
        </p>
        <Field label={t('canvas.direction')}>
          <Segmented
            value={model.direction ?? 'TB'}
            onChange={(d) => apply({ ...model, direction: d === 'TB' ? null : d })}
            options={['TB', 'BT', 'LR', 'RL'].map((d) => ({ value: d, label: d, title: t(`dir.${d}` as TranslationKey) }))}
          />
        </Field>
      </Section>
      <Section title="classDef">
        <ClassDefsEditor defs={model.classDefs} onChange={(classDefs) => apply({ ...model, classDefs })} />
      </Section>
    </>
  );
}

export function ErInspector() {
  const t = useT();
  const ids = useSelection((s) => s.ids);
  const { model, apply } = useDiagram<ErModel>();
  if (!ids.length) return <DiagramPanel />;
  if (ids.length > 1) {
    const parsed = ids.map(erIds.parse);
    return (
      <Section title={t('inspector.multi', { count: ids.length })}>
        <DeleteButton
          onClick={() => {
            apply(
              deleteErItems(
                model,
                parsed.filter((p) => p.kind === 'entity').map((p) => p.id),
                parsed.filter((p) => p.kind === 'relation').map((p) => Number(p.id)),
              ),
            );
            useSelection.getState().clear();
          }}
        />
      </Section>
    );
  }
  const p = erIds.parse(ids[0]);
  return p.kind === 'relation' ? <RelationPanel key={ids[0]} index={Number(p.id)} /> : <EntityPanel key={ids[0]} id={p.id} />;
}
