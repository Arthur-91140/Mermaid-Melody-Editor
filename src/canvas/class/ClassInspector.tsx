import { ArrowLeftRight, Box, FolderOpen, StickyNote } from 'lucide-react';
import type { ClassMarker, ClassModel, ClassRelation } from '../../diagrams/class/model';
import {
  applyPreset,
  CLASS_ID_RE,
  classTaken,
  deleteClassItems,
  relationPreset,
  renameClass,
  renameNamespace,
  reverseRelation,
  setNamespace,
  updateClass,
  updateRelation,
  type RelationPreset,
  RELATION_PRESETS,
} from '../../diagrams/class/ops';
import { useDiagram } from '../../hooks/useDiagram';
import { useT, type TranslationKey } from '../../i18n';
import { ClassChips, classDefNames, ClassDefsEditor, DeleteButton, IdField, Section, StyleEditor } from '../../inspector/common';
import type { Layout } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { DraftInput, DraftTextarea, Field, Segmented, Select } from '../../ui/fields';
import { classIds } from './ids';

const MARKERS: ClassMarker[] = ['none', 'arrow', 'inheritance', 'composition', 'aggregation'];
const DIRECTIONS = ['TB', 'BT', 'LR', 'RL'];

function renameKey(l: Layout, from: string, to: string): Layout {
  if (!l[from]) return l;
  const { [from]: p, ...rest } = l;
  return { ...rest, [to]: p };
}

function ClassPanel({ id }: { id: string }) {
  const t = useT();
  const { model, layout, apply } = useDiagram<ClassModel>();
  const c = model.classes.find((x) => x.id === id);
  if (!c) return null;
  return (
    <>
      <Section title={t('class.class')} icon={<Box size={14} />}>
        <IdField
          value={c.id}
          pattern={CLASS_ID_RE}
          isTaken={(v) => classTaken(model, v)}
          onCommit={(v) => {
            apply(renameClass(model, c.id, v), renameKey(layout, c.id, v));
            useSelection.getState().set([classIds.cls(v)]);
          }}
        />
        <div className="field-row">
          <Field label={t('seq.alias')}>
            <DraftInput value={c.label ?? ''} placeholder={c.id} onCommit={(v) => apply(updateClass(model, id, { label: v.trim() || null }))} />
          </Field>
          <Field label={t('class.generic')}>
            <DraftInput mono value={c.generic ?? ''} placeholder="T" onCommit={(v) => apply(updateClass(model, id, { generic: v.trim() || null }))} />
          </Field>
        </div>
        <Field label={t('class.annotations')} hint="interface, abstract, enumeration…">
          <DraftInput
            value={c.annotations.join(', ')}
            onCommit={(v) => apply(updateClass(model, id, { annotations: v.split(',').map((a) => a.trim()).filter(Boolean) }))}
          />
        </Field>
        <Field label={t('class.members')} hint={t('class.membersHint')}>
          <DraftTextarea
            mono
            rows={Math.max(4, c.members.length + 1)}
            value={c.members.join('\n')}
            onCommit={(v) => apply(updateClass(model, id, { members: v.split('\n').map((l) => l.trim()).filter(Boolean) }))}
          />
        </Field>
        {model.namespaces.length > 0 && (
          <Field label={t('class.namespace')}>
            <Select
              value={c.namespace ?? ''}
              onChange={(v) => apply(setNamespace(model, [id], v || null))}
              options={[{ value: '', label: t('inspector.noParent') }, ...model.namespaces.map((n) => ({ value: n, label: n }))]}
            />
          </Field>
        )}
      </Section>
      <Section title={t('inspector.style')}>
        <StyleEditor style={c.style} onChange={(style) => apply(updateClass(model, id, { style }))} />
        <ClassChips
          available={classDefNames(model.classDefs)}
          active={c.cssClasses}
          onToggle={(cls) =>
            apply(updateClass(model, id, { cssClasses: c.cssClasses.includes(cls) ? c.cssClasses.filter((x) => x !== cls) : [...c.cssClasses, cls] }))
          }
        />
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteClassItems(model, [id], [], []));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function RelationPanel({ index }: { index: number }) {
  const t = useT();
  const { model, apply } = useDiagram<ClassModel>();
  const r = model.relations[index];
  if (!r) return null;
  const set = (patch: Partial<ClassRelation>) => apply(updateRelation(model, index, patch));
  const preset = relationPreset(r);
  const classes = model.classes.map((c) => ({ value: c.id, label: c.label ?? c.id }));
  return (
    <>
      <Section title={t('class.relation')} icon={<ArrowLeftRight size={14} />}>
        <div className="field-row">
          <Field label={t('inspector.from')}>
            <Select value={r.from} options={classes} onChange={(v) => set({ from: v })} />
          </Field>
          <Field label={t('inspector.to')}>
            <Select value={r.to} options={classes} onChange={(v) => set({ to: v })} />
          </Field>
        </div>
        <Field label={t('class.relation.kind')}>
          <Select
            value={preset ?? ''}
            onChange={(v) => v && apply(updateRelation(model, index, applyPreset(r, v as RelationPreset)))}
            options={[
              ...(preset ? [] : [{ value: '', label: '—' }]),
              ...(Object.keys(RELATION_PRESETS) as RelationPreset[]).map((p) => ({ value: p, label: t(`class.rel.${p}` as TranslationKey) })),
            ]}
          />
        </Field>
        <Field label={t('inspector.label')}>
          <DraftInput value={r.label ?? ''} onCommit={(v) => set({ label: v.trim() || null })} />
        </Field>
        <div className="field-row">
          <Field label={t('class.fromCard')}>
            <DraftInput value={r.fromCard ?? ''} placeholder="1" onCommit={(v) => set({ fromCard: v.trim() || null })} />
          </Field>
          <Field label={t('class.toCard')}>
            <DraftInput value={r.toCard ?? ''} placeholder="0..*" onCommit={(v) => set({ toCard: v.trim() || null })} />
          </Field>
        </div>
        <div className="field-row">
          <Field label={t('class.marker.from')}>
            <Select
              value={r.fromMarker}
              onChange={(v) => set({ fromMarker: v })}
              options={MARKERS.map((m) => ({ value: m, label: t(`class.marker.${m}` as TranslationKey) }))}
            />
          </Field>
          <Field label={t('class.marker.to')}>
            <Select
              value={r.toMarker}
              onChange={(v) => set({ toMarker: v })}
              options={MARKERS.map((m) => ({ value: m, label: t(`class.marker.${m}` as TranslationKey) }))}
            />
          </Field>
        </div>
        <Field label={t('inspector.line')}>
          <Segmented
            value={r.line}
            onChange={(line) => set({ line })}
            options={[
              { value: 'solid', label: t('class.line.solid') },
              { value: 'dashed', label: t('class.line.dashed') },
            ]}
          />
        </Field>
        <button type="button" className="btn small" onClick={() => apply(reverseRelation(model, index))}>
          <ArrowLeftRight size={14} />
          {t('inspector.reverse')}
        </button>
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteClassItems(model, [], [index], []));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function NotePanel({ index }: { index: number }) {
  const t = useT();
  const { model, apply } = useDiagram<ClassModel>();
  const n = model.notes[index];
  if (!n) return null;
  const setNote = (patch: Partial<typeof n>) => apply({ ...model, notes: model.notes.map((x, i) => (i === index ? { ...x, ...patch } : x)) });
  return (
    <>
      <Section title={t('class.note')} icon={<StickyNote size={14} />}>
        <Field label={t('inspector.label')}>
          <DraftTextarea value={n.text.replace(/\\n/g, '\n')} onCommit={(v) => setNote({ text: v.replace(/\n/g, '\\n').replace(/"/g, "'") })} />
        </Field>
        <Field label={t('inspector.to')}>
          <Select
            value={n.target ?? ''}
            onChange={(v) => setNote({ target: v || null })}
            options={[{ value: '', label: t('common.none') }, ...model.classes.map((c) => ({ value: c.id, label: c.label ?? c.id }))]}
          />
        </Field>
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteClassItems(model, [], [], [index]));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function NamespacePanel({ name }: { name: string }) {
  const t = useT();
  const { model, layout, apply } = useDiagram<ClassModel>();
  return (
    <>
      <Section title={t('class.namespace')} icon={<FolderOpen size={14} />}>
        <IdField
          value={name}
          pattern={/^[\w.]+$/}
          isTaken={(v) => model.namespaces.includes(v) || model.classes.some((c) => c.id === v)}
          onCommit={(v) => {
            apply(renameNamespace(model, name, v), renameKey(layout, `ns:${name}`, `ns:${v}`));
            useSelection.getState().set([classIds.ns(v)]);
          }}
        />
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteClassItems(model, [], [], [], [name]));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function DiagramPanel() {
  const t = useT();
  const { model, apply } = useDiagram<ClassModel>();
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
            options={DIRECTIONS.map((d) => ({ value: d, label: d, title: t(`dir.${d}` as TranslationKey) }))}
          />
        </Field>
      </Section>
      <Section title="classDef">
        <ClassDefsEditor defs={model.classDefs} onChange={(classDefs) => apply({ ...model, classDefs })} />
      </Section>
    </>
  );
}

export function ClassInspector() {
  const t = useT();
  const ids = useSelection((s) => s.ids);
  const { model, apply } = useDiagram<ClassModel>();
  if (!ids.length) return <DiagramPanel />;
  if (ids.length > 1) {
    const parsed = ids.map(classIds.parse);
    return (
      <Section title={t('inspector.multi', { count: ids.length })}>
        <DeleteButton
          onClick={() => {
            apply(
              deleteClassItems(
                model,
                parsed.filter((p) => p.kind === 'class').map((p) => p.id),
                parsed.filter((p) => p.kind === 'relation').map((p) => Number(p.id)),
                parsed.filter((p) => p.kind === 'note').map((p) => Number(p.id)),
              ),
            );
            useSelection.getState().clear();
          }}
        />
      </Section>
    );
  }
  const p = classIds.parse(ids[0]);
  if (p.kind === 'relation') return <RelationPanel key={ids[0]} index={Number(p.id)} />;
  if (p.kind === 'note') return <NotePanel key={ids[0]} index={Number(p.id)} />;
  if (p.kind === 'namespace') return <NamespacePanel key={ids[0]} name={p.id} />;
  return <ClassPanel key={ids[0]} id={p.id} />;
}
