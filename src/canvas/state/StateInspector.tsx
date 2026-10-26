import { ArrowRight, CircleDot, StickyNote } from 'lucide-react';
import { isPseudo, type StateKind, type StateModel } from '../../diagrams/state/model';
import {
  deleteStateItems,
  moveStates,
  renameState,
  STATE_ID_RE,
  stateTaken,
  updateState,
  updateTransition,
} from '../../diagrams/state/ops';
import { useDiagram } from '../../hooks/useDiagram';
import { useT, type TranslationKey } from '../../i18n';
import { ClassChips, classDefNames, ClassDefsEditor, DeleteButton, IdField, Section, StyleEditor } from '../../inspector/common';
import { renameLayoutId } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { Check, DraftInput, DraftTextarea, Field, Segmented, Select } from '../../ui/fields';
import { stateIds } from './ids';


function stateLabel(m: StateModel, id: string, t: (k: TranslationKey) => string): string {
  const s = m.states.find((x) => x.id === id);
  if (!s) return id;
  if (s.kind === 'start') return `${t('state.kind.start')}${s.parent ? ` (${s.parent})` : ''}`;
  if (s.kind === 'end') return `${t('state.kind.end')}${s.parent ? ` (${s.parent})` : ''}`;
  return s.label ?? s.id;
}

function StatePanel({ id }: { id: string }) {
  const t = useT();
  const { model, layout, apply } = useDiagram<StateModel>();
  const s = model.states.find((x) => x.id === id);
  if (!s) return null;
  const composites = model.states.filter((x) => x.composite && x.id !== id);
  const del = () => {
    apply(deleteStateItems(model, [id], [], []));
    useSelection.getState().clear();
  };
  if (isPseudo(s)) {
    return (
      <Section title={t(`state.kind.${s.kind}` as TranslationKey)} icon={<CircleDot size={14} />}>
        <DeleteButton onClick={del} />
      </Section>
    );
  }
  return (
    <>
      <Section title={t('state.state')} icon={<CircleDot size={14} />}>
        <IdField
          value={s.id}
          pattern={STATE_ID_RE}
          isTaken={(v) => stateTaken(model, v)}
          onCommit={(v) => {
            apply(renameState(model, s.id, v), renameLayoutId(layout, s.id, v));
            useSelection.getState().set([s.composite ? stateIds.group(v) : stateIds.state(v)]);
          }}
        />
        <Field label={t('state.kind')}>
          <Select
            value={s.kind}
            onChange={(kind) => apply(updateState(model, id, { kind: kind as StateKind, composite: kind === 'state' ? s.composite : false }))}
            options={(['state', 'choice', 'fork', 'join'] as const).map((k) => ({ value: k, label: t(`state.kind.${k}`) }))}
          />
        </Field>
        {s.kind === 'state' && (
          <>
            <Field label={t('seq.alias')}>
              <DraftInput value={s.label ?? ''} placeholder={s.id} onCommit={(v) => apply(updateState(model, id, { label: v.trim() ? v.replace(/"/g, "'") : null }))} />
            </Field>
            <Field label={t('state.descriptions')} hint={t('state.descriptionsHint')}>
              <DraftTextarea
                value={s.descriptions.join('\n')}
                onCommit={(v) => apply(updateState(model, id, { descriptions: v.split('\n').map((l) => l.trim()).filter(Boolean) }))}
              />
            </Field>
            <Check checked={s.composite} label={t('state.composite')} onChange={(composite) => apply(updateState(model, id, { composite }))} />
          </>
        )}
        {composites.length > 0 && (
          <Field label={t('inspector.parent')}>
            <Select
              value={s.parent ?? ''}
              onChange={(v) => apply(moveStates(model, [id], v || null))}
              options={[{ value: '', label: t('inspector.noParent') }, ...composites.map((c) => ({ value: c.id, label: c.label ?? c.id }))]}
            />
          </Field>
        )}
      </Section>
      {s.kind === 'state' && (
        <Section title={t('inspector.style')}>
          <StyleEditor style={s.style} onChange={(style) => apply(updateState(model, id, { style }))} />
          <ClassChips
            available={classDefNames(model.classDefs)}
            active={s.cssClasses}
            onToggle={(c) => apply(updateState(model, id, { cssClasses: s.cssClasses.includes(c) ? s.cssClasses.filter((x) => x !== c) : [...s.cssClasses, c] }))}
          />
        </Section>
      )}
      <Section title="">
        <DeleteButton onClick={del} />
      </Section>
    </>
  );
}

function TransitionPanel({ index }: { index: number }) {
  const t = useT();
  const { model, apply } = useDiagram<StateModel>();
  const tr = model.transitions[index];
  if (!tr) return null;
  return (
    <>
      <Section title={t('state.transition')} icon={<ArrowRight size={14} />}>
        <p className="field-hint" style={{ marginTop: 0 }}>
          {stateLabel(model, tr.from, t)} → {stateLabel(model, tr.to, t)}
        </p>
        <Field label={t('inspector.label')}>
          <DraftInput value={tr.label ?? ''} onCommit={(v) => apply(updateTransition(model, index, { label: v.trim() || null }))} />
        </Field>
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteStateItems(model, [], [index], []));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function NotePanel({ index }: { index: number }) {
  const t = useT();
  const { model, apply } = useDiagram<StateModel>();
  const n = model.notes[index];
  if (!n) return null;
  const set = (patch: Partial<typeof n>) => apply({ ...model, notes: model.notes.map((x, i) => (i === index ? { ...x, ...patch } : x)) });
  return (
    <>
      <Section title={t('state.note')} icon={<StickyNote size={14} />}>
        <Field label={t('inspector.label')}>
          <DraftTextarea value={n.text} onCommit={(text) => text.trim() && set({ text })} />
        </Field>
        <Field label={t('inspector.to')}>
          <Select
            value={n.target}
            onChange={(target) => set({ target, scope: model.states.find((s) => s.id === target)?.parent ?? null })}
            options={model.states.filter((s) => !isPseudo(s)).map((s) => ({ value: s.id, label: s.label ?? s.id }))}
          />
        </Field>
        <Field label={t('state.notePosition')}>
          <Segmented
            value={n.position}
            onChange={(position) => set({ position })}
            options={[
              { value: 'left of', label: t('seq.pos.left of') },
              { value: 'right of', label: t('seq.pos.right of') },
            ]}
          />
        </Field>
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            apply(deleteStateItems(model, [], [], [index]));
            useSelection.getState().clear();
          }}
        />
      </Section>
    </>
  );
}

function DiagramPanel() {
  const t = useT();
  const { model, apply } = useDiagram<StateModel>();
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

export function StateInspector() {
  const t = useT();
  const ids = useSelection((s) => s.ids);
  const { model, apply } = useDiagram<StateModel>();
  if (!ids.length) return <DiagramPanel />;
  if (ids.length > 1) {
    const parsed = ids.map(stateIds.parse);
    return (
      <Section title={t('inspector.multi', { count: ids.length })}>
        <DeleteButton
          onClick={() => {
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
        />
      </Section>
    );
  }
  const p = stateIds.parse(ids[0]);
  if (p.kind === 'transition') return <TransitionPanel key={ids[0]} index={Number(p.id)} />;
  if (p.kind === 'note') return <NotePanel key={ids[0]} index={Number(p.id)} />;
  return <StatePanel key={ids[0]} id={p.id} />;
}
